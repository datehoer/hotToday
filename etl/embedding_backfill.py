# -*- coding: utf-8 -*-
"""
为 hot_topic 中 embedding IS NULL 的行批量生成向量 (text-embedding-3-small)。

特点:
- 分批 (batch) 调 API: input 传字符串列表, 一次最多 100 条
- 断点续跑: 只处理 embedding IS NULL 的行, 失败重跑自动跳过已完成
- 幂等: 按 id 回写, 不会重复写
- 并发: 异步 httpx 并发 N 个请求, 默认 5
- 小标题先清洗: 拼 'source: title' 前缀提升区分度 (可选)

用法:
    python etl/embedding_backfill.py --limit 5000 --batch 64 --concurrency 5
    python etl/embedding_backfill.py --table weibo_hot_search
    python etl/embedding_backfill.py --all          # 全部回填
"""
import argparse
import asyncio
import json
import os
import sys
import time

import httpx
import psycopg2
from psycopg2.extras import execute_values

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD  # noqa: E402

EMBED_URL = "https://api.hotday.uk/v1/embeddings"
EMBED_KEY = "sk-gxLHudWTZNt80dXE8eFuMSFeGyA5TNdgH17x9d6JTOXij60j"
EMBED_MODEL = "text-embedding-3-small"
BATCH = 2048        # API 批量上限 (文档最大 2048)
CONCURRENCY = 2     # 并发请求数(网关不稳时调低)
MAX_RETRIES = 8     # 单批最大重试次数(指数退避)



def get_conn():
    return psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname=PG_DB,
                            user=PG_USER, password=PG_PASSWORD)


def fetch_titles(cur, limit, table=None):
    if table:
        cur.execute(
            "SELECT id, source, title FROM hot_topic "
            "WHERE source=%s AND embedding IS NULL ORDER BY id LIMIT %s",
            (table, limit))
    else:
        cur.execute(
            "SELECT id, source, title FROM hot_topic "
            "WHERE embedding IS NULL ORDER BY id LIMIT %s", (limit,))
    return cur.fetchall()


async def embed_batch(client, texts):
    """一次请求批量向量化, 返回 list[embedding] 或 None(失败)"""
    payload = {"model": EMBED_MODEL, "input": texts}
    headers = {"Authorization": f"Bearer {EMBED_KEY}",
               "Content-Type": "application/json"}
    for attempt in range(MAX_RETRIES):
        try:
            r = await client.post(EMBED_URL, json=payload, headers=headers,
                                  timeout=600)
            if r.status_code == 200:
                data = r.json()
                emb = [d["embedding"] for d in data["data"]]
                if len(emb) != len(texts):
                    print(f'  返回条数不符 {len(emb)}!={len(texts)}, 重试', flush=True)
                    await asyncio.sleep(2 ** attempt)
                    continue
                return emb
            # 429/5xx 退避重试
            if r.status_code in (429, 500, 502, 503, 504):
                await asyncio.sleep(min(2 ** attempt, 30))
                continue
            print(f'API {r.status_code}: {r.text[:200]}', flush=True)
            return None
        except Exception as exc:
            print(f'API err: {exc}', flush=True)
            await asyncio.sleep(min(2 ** attempt, 30))
    return None


async def writer(write_queue, total):
    """独立回写: 每批完成立即写库, 不攒内存"""
    conn = get_conn()
    cur = conn.cursor()
    ok = 0
    try:
        while True:
            item = await write_queue.get()
            if item is None:
                break
            ids, emb = item
            vals = [(json.dumps(e), i) for e, i in zip(emb, ids)]
            execute_values(
                cur,
                "UPDATE hot_topic SET embedding = v.emb::vector "
                "FROM (VALUES %s) AS v(emb, id) WHERE hot_topic.id = v.id",
                vals, page_size=200)
            conn.commit()
            ok += len(ids)
            print(f'  回写 {len(ids)} 条 (累计 {ok}/{total})', flush=True)
            write_queue.task_done()
    finally:
        conn.close()
    return ok


async def worker(sem, client, queue, results):
    while True:
        item = await queue.get()
        if item is None:
            break
        ids, texts = item
        async with sem:
            emb = await embed_batch(client, texts)
        if emb:
            results.append((ids, emb))
        else:
            print(f'  批次失败, 跳过 {len(ids)} 条(下次重跑补)', flush=True)
        queue.task_done()


async def run(limit, table, batch, concurrency):
    """分轮处理: 每轮拉 min(remaining, ROUND) 条, 处理完再拉下一轮, 内存可控"""
    ROUND = 20000
    conn = get_conn()
    cur = conn.cursor()
    total_done = 0
    total_failed = 0
    rounds = 0
    while True:
        remaining = limit - total_done
        if remaining <= 0:
            break
        rows = fetch_titles(cur, min(ROUND, remaining), table)
        total = len(rows)
        if total == 0:
            break
        rounds += 1
        print(f'[第{rounds}轮] 待处理: {total} 条', flush=True)

        queue = asyncio.Queue(maxsize=concurrency * 2)
        write_queue = asyncio.Queue(maxsize=concurrency * 2)
        sem = asyncio.Semaphore(concurrency)
        failed = 0

        async with httpx.AsyncClient(
                limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
                timeout=httpx.Timeout(600.0)) as client:

            w_task = asyncio.create_task(writer(write_queue, total))

            async def worker():
                nonlocal failed
                while True:
                    item = await queue.get()
                    if item is None:
                        break
                    ids, texts = item
                    async with sem:
                        emb = await embed_batch(client, texts)
                    if emb:
                        await write_queue.put((ids, emb))
                    else:
                        failed += len(ids)
                        print(f'  批次失败, 跳过 {len(ids)} 条(下轮重试)', flush=True)
                    queue.task_done()

            workers = [asyncio.create_task(worker()) for _ in range(concurrency)]
            for i in range(0, total, batch):
                chunk = rows[i:i + batch]
                ids = [r[0] for r in chunk]
                texts = [f"{r[1]}: {r[2]}" for r in chunk]  # source: title
                await queue.put((ids, texts))
            for _ in range(concurrency):
                await queue.put(None)
            await asyncio.gather(*workers)
            await write_queue.put(None)
            await w_task

        total_done += total - failed
        total_failed += failed
        rows = None  # 释放本轮内存
        import gc
        gc.collect()
        if limit != 10 ** 9 and total_done >= limit:
            break

    conn.close()
    print(f'全部完成: 成功 {total_done} 失败 {total_failed}', flush=True)
    return total_done, total_failed


def run_embedding_incremental(limit=5000, batch=BATCH, concurrency=CONCURRENCY):
    """同步入口: 供 task.py 增量链路调用, 只处理 embedding IS NULL 的行"""
    return asyncio.run(run(limit, None, batch, concurrency))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=2000)
    ap.add_argument('--table', default=None)
    ap.add_argument('--batch', type=int, default=BATCH)
    ap.add_argument('--concurrency', type=int, default=CONCURRENCY)
    ap.add_argument('--all', action='store_true', help='全部回填(不分批)')
    args = ap.parse_args()
    if args.all:
        args.limit = 10 ** 9
    asyncio.run(run(args.limit, args.table, args.batch, args.concurrency))
