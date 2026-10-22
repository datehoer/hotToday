# -*- coding: utf-8 -*-
"""每小时一轮: 按 sources/*/source.yaml 逐个抓取并写入源表, 然后增量清洗和向量化,
最后把连续两轮失败的源交给 AI 修复 (repair.py)。

    python task.py                                     跑一轮 (容器每个整点调用)
    python task.py --only weibo_hot_search douyin_hot  只抓不写库, 用来试跑
    python task.py --check                             只校验全部 source.yaml
    python task.py --config                            打印当前生效的配置 (JSON, 运维页的配置页读它)
"""
import argparse
import glob
import json
import os
import sys
import time

import psycopg2
from loguru import logger

import plugins
from plugins import redact
from config import PG_HOST, PG_DB, PG_PORT, PG_USER, PG_PASSWORD

PG_CONNECT_TIMEOUT = int(os.getenv("HOT_PG_CONNECT_TIMEOUT", "10"))
OPS_KEEP_DAYS = 30  # ops.round / ops.run 保留天数

def manage_log_files(log_dir, max_logs=10):
    """管理日志文件数量，保留最新的max_logs个文件"""
    try:
        # 获取所有日志文件
        log_pattern = os.path.join(log_dir, 'hot_log_*.log')
        log_files = glob.glob(log_pattern)

        if len(log_files) > max_logs:
            # 按修改时间排序，最新的在前
            log_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)

            # 删除超出数量的旧文件
            files_to_delete = log_files[max_logs:]
            for file_path in files_to_delete:
                try:
                    os.remove(file_path)
                    logger.info(f"删除旧日志文件: {file_path}")
                except Exception as e:
                    logger.warning(f"删除日志文件失败 {file_path}: {e}")

    except Exception as e:
        logger.warning(f"管理日志文件时出错: {e}")


def open_log_file():
    current_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime())
    log_dir = os.getenv("HOT_LOG_DIR", "/opt/hotToday/logs")
    try:
        os.makedirs(log_dir, exist_ok=True)
    except Exception:
        log_dir = os.path.join(os.path.dirname(__file__), "logs")
        os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, f'hot_log_{current_time}.log')
    logger.add(
        log_path,
        level=os.getenv("HOT_LOG_LEVEL", "INFO"),
        format="{time:YYYY-MM-DD HH:mm:ss} {level} {message}",
        encoding="utf-8",
        enqueue=True,
    )
    # 管理日志文件数量
    manage_log_files(log_dir, max_logs=10)
    logger.info(f"日志路径: {log_path}")
    logger.info(f"PG connect timeout: {PG_CONNECT_TIMEOUT}s")


logger.remove()
logger.add(sys.stderr, level=os.getenv("HOT_LOG_LEVEL", "INFO"))

# 运维页 (ops.example.com) 读的两张表, 放在 ops schema: 清洗只扫 public 下的源表
OPS_SCHEMA = """
CREATE SCHEMA IF NOT EXISTS ops;
CREATE TABLE IF NOT EXISTS ops.round (
    started_at   bigint PRIMARY KEY,
    finished_at  bigint,
    sources      integer NOT NULL,
    crawl_ms     integer,
    etl_ms       integer,
    new_titles   integer,
    embed_ms     integer,
    embedded     integer,
    embed_failed integer,
    error        text
);
CREATE TABLE IF NOT EXISTS ops.run (
    round_at    bigint NOT NULL REFERENCES ops.round ON DELETE CASCADE,
    source      text NOT NULL,
    name        text NOT NULL,
    status      text NOT NULL,
    items       integer,
    ms          integer,
    error       text,
    finished_at bigint NOT NULL,
    PRIMARY KEY (round_at, source)
);
CREATE INDEX IF NOT EXISTS run_source_idx ON ops.run (source, round_at DESC);
"""
RUN_SQL = ("INSERT INTO ops.run (round_at, source, name, status, items, ms, error, finished_at) "
           "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING")
# 新源第一次写入时自动建表, 结构和已有源表一样 (key 只含小写字母、数字和下划线)
TABLE_SQL = 'CREATE TABLE IF NOT EXISTS "{}" (id SERIAL PRIMARY KEY, data JSONB, insert_time BIGINT)'


def crawl(cur, spec):
    """抓一个源并写入快照, 返回 (status, items, error)。cur 为 None 时只抓不写"""
    table = spec["key"]
    try:
        data = plugins.fetch(spec)
    except Exception as err:
        logger.exception(f"[{table}] fetch error: {err}")
        return "error", None, redact(err)
    if isinstance(data, dict) and "data" in data:
        data = data["data"]
    # 空结果同样视为失败，避免把 {"data": []} 当作成功写入
    if not data:
        logger.error(f"{table} data is empty, skip insert")
        return "empty", 0, None
    try:
        items = len(plugins.extract_items(table, data))
    except Exception:
        items = None
    if cur:
        try:
            cur.execute(TABLE_SQL.format(table))
            cur.execute(f'INSERT INTO "{table}" (data, insert_time) VALUES (%s, %s)',
                        (json.dumps(data), int(time.time())))
        except Exception as err:
            logger.exception(f"Error inserting into {table}: {err}")
            return "error", items, redact(f"insert: {err}")
    return "ok", items, None


def record(cur, sql, args=None):
    """写运维记录; 失败只打警告, 不影响抓取"""
    try:
        cur.execute(sql, args)
    except Exception as err:
        logger.warning(f"ops record failed: {err}")


def run_round():
    open_log_file()
    run_start = time.monotonic()
    logger.info("task.py start")
    specs, bad = plugins.load_sources()
    enabled = [s for s in specs if s["enabled"]]
    logger.info(f"{len(specs) + len(bad)} 个源: {len(enabled)} 个启用, "
                f"{len(specs) - len(enabled)} 个停用, {len(bad)} 个配置错误")
    logger.info("Connecting to PostgreSQL...")
    conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        database=PG_DB,
        connect_timeout=PG_CONNECT_TIMEOUT,
    )
    # 每个源单独提交: 一个源写库失败不会连累后面的源, 运维页也能看到本轮进度
    conn.autocommit = True
    cur = conn.cursor()
    round_at = int(time.time())
    record(cur, OPS_SCHEMA)
    record(cur, "DELETE FROM ops.round WHERE started_at < %s", (round_at - OPS_KEEP_DAYS * 86400,))
    record(cur, "INSERT INTO ops.round (started_at, sources) VALUES (%s, %s)",
           (round_at, len(enabled) + len(bad)))
    # 停用的源每轮也记一行, 运维页才知道一共有哪些源; 配置错误的源记为 error
    for spec in specs:
        if not spec["enabled"]:
            record(cur, RUN_SQL, (round_at, spec["key"], spec["name"], "disabled", None, None,
                                  spec["disabled_reason"], round_at))
    for key, error in bad.items():
        logger.error(f"[{key}] source.yaml 有错: {error}")
        record(cur, RUN_SQL, (round_at, key, key, "error", None, None,
                              redact(f"source.yaml 有错: {error}"), int(time.time())))
    try:
        for spec in enabled:
            table = spec["key"]
            start = time.monotonic()
            logger.info(f"[{table}] fetch start")
            status, items, error = crawl(cur, spec)
            ms = int((time.monotonic() - start) * 1000)
            logger.info(f"[{table}] {status} items={items} ({ms / 1000:.2f}s)")
            record(cur, RUN_SQL, (round_at, table, spec["name"], status, items, ms, error, int(time.time())))
    except Exception as error:
        logger.exception(f"some error happen: {error}")
    record(cur, "UPDATE ops.round SET crawl_ms = %s WHERE started_at = %s",
           (int((time.monotonic() - run_start) * 1000), round_at))

    errors = []
    # 爬取完成后增量清洗: 新行 upsert 到 hot_topic (独立连接, 失败不影响主流程)
    etl_start = time.monotonic()
    new_titles = None
    try:
        from etl.incremental import run_incremental
        new_titles = run_incremental()
        logger.info(f"ETL done in {time.monotonic() - etl_start:.2f}s, new titles: {new_titles}")
    except Exception as e:
        logger.exception(f"ETL error: {e}")
        errors.append(f"清洗: {redact(e)}")
    record(cur, "UPDATE ops.round SET etl_ms = %s, new_titles = %s WHERE started_at = %s",
           (int((time.monotonic() - etl_start) * 1000), new_titles, round_at))

    # 新增 title 向量化 (无条件跑: 幂等只处理 embedding IS NULL, 残留失败自动补)
    emb_start = time.monotonic()
    done = failed = None
    try:
        from etl.embedding_backfill import run_embedding_incremental
        done, failed = run_embedding_incremental(limit=8000)
        logger.info(f"Embedding done in {time.monotonic() - emb_start:.2f}s, "
                    f"success {done}, failed {failed}")
    except Exception as e:
        logger.exception(f"Embedding error: {e}")
        errors.append(f"向量化: {redact(e)}")
    record(cur, "UPDATE ops.round SET embed_ms = %s, embedded = %s, embed_failed = %s, finished_at = %s, "
                "error = %s WHERE started_at = %s",
           (int((time.monotonic() - emb_start) * 1000), done, failed, int(time.time()),
            "; ".join(errors) or None, round_at))
    # 放在 finished_at 之后: 运维页不把修复的时间算进这一轮; 修复出错不影响下一轮
    try:
        import repair
        repair.after_round(cur, round_at)
    except Exception as e:
        logger.exception(f"repair error: {e}")
    conn.close()
    logger.info(f"task.py done in {time.monotonic() - run_start:.2f}s")


def try_sources(keys):
    """只抓不写库, 停用的源也能试: python task.py --only weibo_hot_search douyin_hot"""
    specs, bad = plugins.load_sources()
    by_key = {spec["key"]: spec for spec in specs}
    for key in keys:
        if key in bad:
            print(f"{key}: source.yaml 有错: {bad[key]}")
            continue
        if key not in by_key:
            print(f"{key}: sources/ 里没有这个源")
            continue
        start = time.monotonic()
        status, items, error = crawl(None, by_key[key])
        note = "" if by_key[key]["enabled"] else " (已停用)"
        print(f"{key}{note}: {status} items={items} ({time.monotonic() - start:.2f}s) {error or ''}")


def check_sources():
    """校验全部 source.yaml, 有错时返回 1"""
    specs, bad = plugins.load_sources()
    for key, error in bad.items():
        print(f"{key}: {error}")
    enabled = sum(spec["enabled"] for spec in specs)
    print(f"{len(specs) + len(bad)} 个源: {enabled} 个启用, {len(specs) - enabled} 个停用, "
          f"{len(bad)} 个配置错误")
    return 1 if bad else 0


def print_config():
    """源、代理和 AI 修复的当前配置, 打印成 JSON; 代理账号和 URL 里的密钥已去掉"""
    import repair
    specs, bad = plugins.load_sources(import_entries=False)
    sources = [{
        "key": spec["key"], "name": spec["name"], "enabled": spec["enabled"],
        "disabled_reason": spec.get("disabled_reason"), "schedule": spec["schedule"], "timeout": spec["timeout"],
        "retries": spec["retries"], "proxy": spec["proxy"], "type": spec["fetch"]["type"],
        "target": redact(spec["fetch"].get("url") or spec["fetch"].get("entry") or ""),
    } for spec in specs] + [{"key": key, "error": error} for key, error in bad.items()]
    print(json.dumps({"sources": sources, "proxies": {name: redact(url) for name, url in plugins.PROXIES.items()},
                      "keep_days": OPS_KEEP_DAYS, "repair": repair.settings(repair.connect())}, ensure_ascii=False))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", nargs="+", metavar="KEY", help="只抓这几个源, 不写库也不跑清洗")
    parser.add_argument("--check", action="store_true", help="只校验 sources/*/source.yaml")
    parser.add_argument("--config", action="store_true", help="打印当前生效的配置 (JSON)")
    args = parser.parse_args()
    if args.check:
        sys.exit(check_sources())
    elif args.config:
        print_config()
    elif args.only:
        try_sources(args.only)
    else:
        run_round()
