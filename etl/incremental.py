# -*- coding: utf-8 -*-
"""
增量 ETL: 只处理源表新增的行 (id > checkpoint.last_id), upsert 到 hot_topic。

设计要点:
- checkpoint 表 (etl_checkpoint) 记录每张源表已处理到的最大 id, 逐表维护
- 每批 500 行一个事务: 提取 -> upsert hot_topic -> 更新 checkpoint, 原子提交
- 幂等: ON CONFLICT 时 last_seen 取 GREATEST, 且仅当 EXCLUDED.last_seen 更新时才累加
  seen_count, 因此重复处理同一批(崩溃重跑)不会重复计数
- 快速跳过: max(id) == last_id 的表直接跳过, 不做任何读

用法:
    python etl/incremental.py              # 处理全部源表
    python etl/incremental.py --table 表名 # 只处理一张
"""
import argparse
import os
import sys
import time

import psycopg2
from psycopg2.extras import execute_values

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD  # noqa: E402
from etl.extractors import extract_items  # noqa: E402

BATCH = 500
EXCLUDE = {'hot_topic', 'hot_topic_detail', 'etl_checkpoint'}

# 幂等 upsert: 重复处理同批不重复累加 seen_count
UPSERT_SQL = """
    INSERT INTO hot_topic (source, title, url, hot_value, first_seen, last_seen, seen_count)
    VALUES %s
    ON CONFLICT (source, title) DO UPDATE SET
        last_seen  = GREATEST(hot_topic.last_seen, EXCLUDED.last_seen),
        seen_count = CASE WHEN EXCLUDED.last_seen > hot_topic.last_seen
                          THEN hot_topic.seen_count + 1
                          ELSE hot_topic.seen_count END,
        url        = COALESCE(hot_topic.url, EXCLUDED.url),
        hot_value  = COALESCE(NULLIF(hot_topic.hot_value, ''), EXCLUDED.hot_value)
"""

CHECKPOINT_SQL = """
    INSERT INTO etl_checkpoint (source, last_id, last_run_at, last_new, last_items)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (source) DO UPDATE SET
        last_id     = EXCLUDED.last_id,
        last_run_at = EXCLUDED.last_run_at,
        last_new    = EXCLUDED.last_new,
        last_items  = EXCLUDED.last_items
"""


def get_sources(cur, only=None):
    if only:
        return [only]
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' "
                "ORDER BY tablename")
    return [r[0] for r in cur.fetchall() if r[0] not in EXCLUDE]


def get_checkpoints(cur):
    cur.execute("SELECT source, last_id FROM etl_checkpoint")
    return dict(cur.fetchall())


def process_batch(conn, cur, table, rows):
    """rows: list of (id, data, insert_time)"""
    items_by_title = {}
    for _, data, ts in rows:
        try:
            items = extract_items(table, data)
        except Exception:
            items = []
        for title, url, hot in items:
            key = title
            if key in items_by_title:
                e = items_by_title[key]
                e['last'] = max(e['last'], ts)
                e['count'] += 1
                if not e['url'] and url:
                    e['url'] = url
            else:
                items_by_title[key] = {'first': ts, 'last': ts, 'count': 1,
                                       'url': url, 'hot': hot}
    if not items_by_title:
        return 0
    vals = [(table, t, e['url'], e['hot'], e['first'], e['last'], e['count'])
            for t, e in items_by_title.items()]
    execute_values(cur, UPSERT_SQL, vals, page_size=BATCH)
    return len(vals)


def process_table(conn, table, last_id):
    """处理一张表, 返回 (new_unique, items, max_id)"""
    cur = conn.cursor()
    try:
        cur.execute(f'SELECT max(id) FROM "{table}"')
        max_id = cur.fetchone()[0]
        if max_id is None or max_id <= last_id:
            return 0, 0, last_id

        new_unique = items = 0
        cursor_id = last_id
        while True:
            cur.execute(
                f'SELECT id, data, insert_time FROM "{table}" '
                f'WHERE id > %s ORDER BY id LIMIT {BATCH}',
                (cursor_id,))
            rows = cur.fetchall()
            if not rows:
                break
            n = process_batch(conn, cur, table, rows)
            new_unique += n
            items += len(rows)
            cursor_id = rows[-1][0]
            # 每批一个事务: upsert + checkpoint 原子提交
            cur.execute(CHECKPOINT_SQL,
                        (table, cursor_id, int(time.time()), n, len(rows)))
            conn.commit()
        return new_unique, items, cursor_id
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()


def run_incremental(only=None):
    conn = psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname=PG_DB,
                            user=PG_USER, password=PG_PASSWORD)
    conn.autocommit = False
    cur = conn.cursor()
    sources = get_sources(cur, only)
    checkpoints = get_checkpoints(cur)
    t0 = time.monotonic()
    total_new = total_items = 0
    skipped = 0
    for table in sources:
        last_id = checkpoints.get(table, 0)
        st = time.monotonic()
        try:
            new_unique, items, cursor_id = process_table(conn, table, last_id)
        except Exception as exc:
            print(f'{table:22s} ERROR: {exc}', flush=True)
            continue
        if items == 0:
            skipped += 1
            if only:
                print(f'{table:22s} 无新增 (last_id={last_id})', flush=True)
            continue
        total_new += new_unique
        total_items += items
        print(f'{table:22s} 新行{items:4d} 新title{new_unique:5d} '
              f'last_id {last_id}->{cursor_id} ({time.monotonic()-st:.1f}s)', flush=True)
    conn.close()
    print(f'\n完成: 表{len(sources)} (跳过{skipped}) 源行{total_items:,} '
          f'新增唯一title{total_new:,} 耗时{time.monotonic()-t0:.0f}s', flush=True)
    return total_new


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--table', default=None)
    args = ap.parse_args()
    run_incremental(only=args.table)
