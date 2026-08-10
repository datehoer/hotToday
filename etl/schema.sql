-- ============================================================================
-- hotToday 清洗链路 schema (migration)
-- 新增 3 张表: hot_topic / hot_topic_detail / etl_checkpoint
-- 由 etl/incremental.py + etl/embedding_backfill.py 使用
--
-- 应用方式:
--   psql -h <PG_HOST> -U admin -d hotday -f etl/schema.sql
-- 幂等: 全部使用 IF NOT EXISTS / ON CONFLICT, 可重复执行
-- ============================================================================

-- 0. 前置: 向量扩展 (需要 postgresql-16-pgvector 已安装, 见 docs)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. hot_topic: 热榜标题清洗汇总表 (82 源表 -> 统一唯一 source+title)
--    增量 ETL 的 upsert 目标, embedding 由 text-embedding-3-small 生成
-- ============================================================================
CREATE TABLE IF NOT EXISTS hot_topic (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source     text NOT NULL,
    title      text NOT NULL,
    url        text,
    hot_value  text,
    first_seen bigint NOT NULL,
    last_seen  bigint NOT NULL,
    seen_count integer DEFAULT 1,
    embedding  vector(1536),
    CONSTRAINT hot_topic_source_title_key UNIQUE (source, title)
);

CREATE INDEX IF NOT EXISTS idx_hot_topic_embedding
    ON hot_topic USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_hot_topic_last_seen
    ON hot_topic (last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_hot_topic_url
    ON hot_topic (url) WHERE url IS NOT NULL;

-- ============================================================================
-- 2. hot_topic_detail: 标题详情表 (预留, 存正文/摘要及其向量)
--    目前代码未写入, 表结构先行定义
-- ============================================================================
CREATE TABLE IF NOT EXISTS hot_topic_detail (
    id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source            text NOT NULL,
    title             text NOT NULL,
    url               text NOT NULL,
    content           text,
    summary           text,
    content_embedding vector(1536),
    summary_embedding vector(1536),
    first_seen        bigint,
    last_seen         bigint,
    fetch_status      smallint DEFAULT 0,
    last_fetch_at     bigint,
    CONSTRAINT hot_topic_detail_url_key UNIQUE (url)
);

CREATE INDEX IF NOT EXISTS idx_hot_topic_detail_content_emb
    ON hot_topic_detail USING hnsw (content_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_hot_topic_detail_summary_emb
    ON hot_topic_detail USING hnsw (summary_embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_hot_topic_detail_last_seen
    ON hot_topic_detail (last_seen DESC);

-- ============================================================================
-- 3. etl_checkpoint: 增量 ETL 水位线, 每张源表已处理到的最大 id
-- ============================================================================
CREATE TABLE IF NOT EXISTS etl_checkpoint (
    source      text NOT NULL PRIMARY KEY,
    last_id     bigint NOT NULL DEFAULT 0,
    last_run_at bigint,
    last_new    integer DEFAULT 0,
    last_items  integer DEFAULT 0
);

-- ============================================================================
-- 可选: 82 张源表加 embedding 列 + HNSW 索引 (若需要源表级向量检索)
-- 已在生产库执行过, 这里保留为幂等脚本
-- ============================================================================
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT IN ('hot_topic', 'hot_topic_detail', 'etl_checkpoint')
    LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS embedding vector(1536)', t);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_embedding ON %I USING hnsw (embedding vector_cosine_ops)', t, t);
    END LOOP;
END $$;
