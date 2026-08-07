# -*- coding: utf-8 -*-
"""
历史回填: 从 82 张源表(近 N 个月) 提取 title, upsert 到 hot_topic 清洗表。
用法: python etl/backfill.py [--months 3] [--table 表名(可选,只处理单表)]
"""
import argparse
import json
import os
import sys
import time

import psycopg2
from psycopg2.extras import execute_values

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from config import PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD  # noqa: E402
from etl.extractors import extract_items  # noqa: E402

BATCH = 5000


def get_tables(cur):
    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' "
                "AND tablename NOT IN ('hot_topic','hot_topic_detail') ORDER BY tablename")
    return [r[0] for r in cur.fetchall()]


def collect(cur, table, cutoff):
    """读一张表近3月数据, 返回 {(source,title): {first,last,count,url,hot}}"""
    cur.execute(f'SELECT data, insert_time FROM "{table}" WHERE insert_time >= %s ORDER BY insert_time',
                (cutoff,))
    agg = {}
    n_rows = 0
    n_items = 0
    for data, ts in cur.fetchall():
        n_rows += 1
        try:
            items = extract_items(table, data)
        except Exception:
            items = []
        for title, url, hot in items:
            n_items += 1
            key = (table, title)
            if key in agg:
                e = agg[key]
                e['last'] = max(e['last'], ts)
                e['count'] += 1
                if not e['url'] and url:
                    e['url'] = url
            else:
                agg[key] = {'first': ts, 'last': ts, 'count': 1, 'url': url, 'hot': hot}
    return agg, n_rows, n_items


def upsert(cur, rows):
    """rows: list of (source, title, url, hot, first, last, count)"""
    if not rows:
        return 0
    sql = """
        INSERT INTO hot_topic (source, title, url, hot_value, first_seen, last_seen, seen_count)
        VALUES %s
        ON CONFLICT (source, title) DO UPDATE SET
            last_seen  = EXCLUDED.last_seen,
            seen_count = hot_topic.seen_count + EXCLUDED.seen_count,
            url        = COALESCE(hot_topic.url, EXCLUDED.url)
    """
    execute_values(cur, sql, rows, page_size=BATCH)
    return len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--months', type=int, default=3)
    ap.add_argument('--table', default=None)
    args = ap.parse_args()

    cutoff = int(time.time()) - args.months * 30 * 86400
    conn = psycopg2.connect(host=PG_HOST, port=PG_PORT, dbname=PG_DB,
                            user=PG_USER, password=PG_PASSWORD)
    conn.autocommit = False
    cur = conn.cursor()

    tables = [args.table] if args.table else get_tables(cur)
    t0 = time.monotonic()
    total_rows = total_items = total_new = 0
    pending = []
    for table in tables:
        agg, n_rows, n_items = collect(cur, table, cutoff)
        total_rows += n_rows
        total_items += n_items
        rows = [(s, t, e['url'], e['hot'], e['first'], e['last'], e['count'])
                for (s, t), e in agg.items()]
        pending.extend(rows)
        total_new += len(rows)
        print(f'{table:22s} 行{n_rows:5d} title实例{n_items:6d} 唯一{len(rows):6d} '
              f'({time.monotonic()-t0:.0f}s)', flush=True)

        if len(pending) >= BATCH:
            upsert(cur, pending)
            conn.commit()
            pending = []

    if pending:
        upsert(cur, pending)
        conn.commit()

    cur.execute('SELECT count(*) FROM hot_topic')
    db_total = cur.fetchone()[0]
    conn.close()
    print(f'\n完成: 表{len(tables)} 源行{total_rows:,} title实例{total_items:,} '
          f'本次新增唯一{total_new:,} hot_topic总行数{db_total:,} '
          f'耗时{time.monotonic()-t0:.0f}s')


if __name__ == '__main__':
    main()
