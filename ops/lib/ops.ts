// Server-only data access: hotToday's task.py writes ops.round / ops.run every hour;
// source tables and hot_topic belong to the crawler and ETL. Credentials: PG* in .env.local (read-only role).
import { execFile } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import net from "node:net"
import { promisify } from "node:util"
import { connection } from "next/server"
import pg from "pg"
import { cache } from "react"

import { requireUser } from "@/lib/auth"

pg.types.setTypeParser(pg.types.builtins.INT8, Number)
const pool = new pg.Pool({ max: 4 })

export type Status = "ok" | "empty" | "error" | "disabled"
export type Round = {
  started_at: number
  finished_at: number | null
  sources: number
  crawl_ms: number | null
  etl_ms: number | null
  new_titles: number | null
  embed_ms: number | null
  embedded: number | null
  embed_failed: number | null
  error: string | null
}
export type Run = {
  round_at: number
  source: string
  name: string
  status: Status
  items: number | null
  ms: number | null
  error: string | null
  finished_at: number
}
export type Source = {
  id: string
  name: string
  run: Run // result in the latest finished round
  history: (Run | null)[] // oldest first, one slot per round
  usual: number | null // median items of the last 20 ok runs in history, given at least 5
  lastOk: number | null // epoch seconds of the last snapshot written
  low: boolean // ok, but far fewer items than usual
}

async function query<T>(sql: string, args: unknown[] = []) {
  await connection()
  await requireUser()
  return (await pool.query(sql, args)).rows as T[]
}

// The site is public: keep server addresses (the proxy's IP) out of error texts.
const maskIp = (text: string) =>
  text.replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, "•••")

async function queryRuns(sql: string, args: unknown[]) {
  const rows = await query<Run>(sql, args)
  for (const r of rows) r.error = r.error && maskIp(r.error)
  return rows
}

export const HISTORY = 24

// The PRD's count_low rule: fewer than half the median of the last 20 successful runs (needs 5).
export const isLow = (run: Run | null, usual: number | null) =>
  run?.status === "ok" && usual != null && (run.items ?? 0) < usual / 2

// A round that never wrote finished_at (crashed run) counts as finished once the next one is due.
const isDone = (r: Round) =>
  r.finished_at != null || Date.now() / 1000 >= nextRound(r)

// Cached per request: the layout (sidebar) and the page both read the board.
export const getBoard = cache(async () => {
  const rounds = await query<Round>(
    "select * from ops.round order by started_at desc limit $1",
    [HISTORY + 1]
  )
  const running = rounds[0] && !isDone(rounds[0]) ? rounds[0] : null
  const done = rounds
    .filter((r) => r !== running)
    .slice(0, HISTORY)
    .reverse()
  const runs = await queryRuns(
    "select * from ops.run where round_at = any($1::bigint[])",
    [rounds.map((r) => r.started_at)]
  )
  const latest = done.at(-1) ?? null
  const byRound = new Map<number, Map<string, Run>>()
  for (const run of runs) {
    if (!byRound.has(run.round_at)) byRound.set(run.round_at, new Map())
    byRound.get(run.round_at)!.set(run.source, run)
  }
  const current = latest
    ? [...(byRound.get(latest.started_at)?.values() ?? [])]
    : []
  const sources = current.map((run): Source => {
    const history = done.map(
      (r) => byRound.get(r.started_at)?.get(run.source) ?? null
    )
    const oks = history.filter((h) => h?.status === "ok")
    const counts = oks
      .slice(-20)
      .map((h) => h!.items)
      .filter((n): n is number => n != null)
      .sort((a, b) => a - b)
    const usual =
      counts.length >= 5 ? counts[Math.floor(counts.length / 2)] : null
    const low = isLow(run, usual)
    return {
      id: run.source,
      name: run.name,
      run,
      history,
      usual,
      lastOk: oks.at(-1)?.finished_at ?? null,
      low,
    }
  })
  await fillLastOk(
    sources.filter((s) => s.lastOk == null && s.run.status !== "disabled")
  )
  const progress = running
    ? [...(byRound.get(running.started_at)?.values() ?? [])].filter(
        (r) => r.status !== "disabled"
      )
    : []
  return { latest, running, progress, rounds: done, sources }
})

// Sources with no ok run in the loaded history: read the time of the newest snapshot in their own table.
async function fillLastOk(sources: Source[]) {
  const ids = sources.map((s) => s.id).filter((id) => /^[a-z0-9_]+$/.test(id))
  if (!ids.length) return
  // Not "as id": ORDER BY would then sort by the alias instead of the table's id.
  const sql = ids
    .map(
      (id) =>
        `(select '${id}' as source, insert_time from "${id}" t order by t.id desc limit 1)`
    )
    .join(" union all ")
  const rows = await query<{ source: string; insert_time: number }>(sql)
  for (const row of rows) {
    const s = sources.find((s) => s.id === row.source)
    if (s) s.lastOk = row.insert_time
  }
}

// Cached per request: generateMetadata and the page both read it.
export const getSource = cache(async (id: string) => {
  const board = await getBoard()
  const source = board.sources.find((s) => s.id === id)
  return source ? { board, source } : null
})

export const getSourceRuns = (id: string, limit: number) =>
  queryRuns(
    "select * from ops.run where source = $1 order by round_at desc limit $2",
    [id, limit]
  )

export const getSourceItems = (id: string, limit: number) =>
  query<{ title: string; url: string | null; last_seen: number }>(
    "select title, url, last_seen from hot_topic where source = $1 order by last_seen desc, id desc limit $2",
    [id, limit]
  )

export async function getRound(startedAt: number) {
  const [round] = await query<Round>(
    "select * from ops.round where started_at = $1",
    [startedAt]
  )
  if (!round) return null
  const runs = await queryRuns(
    "select * from ops.run where round_at = $1 order by finished_at, source",
    [startedAt]
  )
  return { round, runs }
}

export async function getRounds(limit = 72) {
  const rounds = await query<Round & { ok: number; failed: number }>(
    `select r.*, count(*) filter (where u.status = 'ok')::int as ok,
            count(*) filter (where u.status in ('empty', 'error'))::int as failed
       from ops.round r left join ops.run u on u.round_at = r.started_at
      group by r.started_at order by r.started_at desc limit $1`,
    [limit]
  )
  return rounds
}

export function phase(r: Round) {
  if (r.finished_at != null) return "已完成"
  if (isDone(r)) return "没跑完"
  return r.crawl_ms == null
    ? "抓取中"
    : r.etl_ms == null
      ? "清洗中"
      : "向量化中"
}

export const nextRound = (r: Round) =>
  Math.floor(r.started_at / 3600) * 3600 + 3600

// Why a run wrote nothing, as a group label. 6666 is the port of config.PROXY in hotToday.
export function cause(run: Run) {
  if (run.status === "empty") return "返回空数据"
  if (run.status !== "error") return null
  const e = run.error ?? ""
  if (/proxy|port 6666\b/i.test(e)) return "代理连不上"
  if (/timed? ?out/i.test(e)) return "超时"
  if (/status=\d{3}|HTTP \d{3}/i.test(e)) return "状态码异常"
  if (/connect|resolve|reset|Empty reply/i.test(e)) return "连不上"
  return "出错"
}

// AI repair tasks: hotToday's repair.py writes ops.repair (the table appears with its first task).
export type RepairState =
  | "analyzing"
  | "handed_off"
  | "needs_human"
  | "awaiting_review"
  | "observing"
  | "resolved"
  | "rejected"
  | "superseded"
  | "failed"
  | "reverted"
export type Check = { name: string; ok: boolean; note: string }
export type Repair = {
  id: number
  source: string
  state: RepairState
  category: "structural" | "ops" | "human" | null
  reason: string | null
  summary: string | null
  evidence: string[] | null
  model: string | null
  tokens: number
  attempts: number
  diff: string | null
  dry_run: {
    status: string
    items: number | null
    ms: number | null
    error: string | null
    sample: [string, string | null, string | null][] | null
  } | null
  checks: Check[] | null
  steps: { ts: number; tool: string; note: string }[]
  log: { ts: number; to: RepairState; by: string; note: string | null }[]
  created_at: number
  updated_at: number
  applied_at: number | null
}

// The PRD's wording for each state.
export const REPAIR_STATE: Record<RepairState, string> = {
  analyzing: "分析中",
  handed_off: "运维处理",
  needs_human: "需要人工",
  awaiting_review: "待 review",
  observing: "观察中",
  resolved: "已恢复",
  rejected: "已驳回",
  superseded: "已自行恢复",
  failed: "失败",
  reverted: "已撤销",
}

async function queryRepairs(where: string, args: unknown[]) {
  try {
    const rows = await query<Repair>(
      `select id, source, state, category, reason, summary, evidence, model, tokens, attempts, diff,
              dry_run, checks, steps, log, created_at, updated_at, applied_at
         from ops.repair where ${where} order by id desc limit 20`,
      args
    )
    // Not the diff: version numbers in User-Agent strings look like IPs.
    return rows.map(({ diff, ...r }) => ({
      ...(JSON.parse(maskIp(JSON.stringify(r))) as Omit<Repair, "diff">),
      diff,
    }))
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return [] // no task yet
    throw e
  }
}

export const getRepairs = (source: string) =>
  queryRepairs("source = $1", [source])

export const getOpenRepairs = () =>
  queryRepairs("state in ('analyzing', 'awaiting_review')", [])

// The spider's configuration as it sees it: `task.py --config` inside the container validates every
// source.yaml and reports the AI repair settings (no passwords or keys). Takes about a second.
export type SourceConfig = {
  key: string
  name?: string
  enabled?: boolean
  disabled_reason?: string | null
  schedule?: string
  timeout?: string
  retries?: number
  proxy?: string
  type?: "json" | "rss" | "python"
  target?: string // fetch.url, or fetch.entry for python sources
  error?: string // source.yaml doesn't validate
}
export type SpiderConfig = {
  sources: SourceConfig[]
  proxies: Record<string, string>
  keep_days: number
  repair: {
    model: string
    api_url: string
    key: string | null // which environment variable holds the key
    daily: number
    max_turns: number
    max_patches: number
    max_fetches: number
    max_tokens: number
    task_seconds: number
    dry_run_seconds: number
    system: string
    final: string
    tools: { name: string; description: string }[]
    ops_rules: { pattern: string; reason: string; label: string }[]
    safe_imports: string[]
  }
}

const run = promisify(execFile)

export async function getConfig() {
  await requireUser()
  const { stdout } = await run(
    "/usr/bin/docker",
    [
      "exec",
      "-u",
      "1000:1000",
      "-w",
      "/app",
      "hottoday-spider",
      "python",
      "-B",
      "task.py",
      "--config",
    ],
    { timeout: 30_000, maxBuffer: 8 << 20 }
  )
  return JSON.parse(maskIp(stdout)) as SpiderConfig
}

const HOTTODAY = process.env.HOTTODAY_DIR ?? "/srv/projects/hotToday"

// Hard-coded cookies and tokens in spider code, proxy accounts and keys in URLs (as hotToday's
// redact and repair.SECRET_RE do). No IP masking here: User-Agent versions look like IPs.
const hideSecrets = (text: string) =>
  text
    .replace(/\/\/[^/@\s'"]+@/g, "//***@")
    .replace(/\b(key|token|secret|sign|password)=[^&\s'"]+/gi, "$1=***")
    .replace(
      /(['"](?:cookie|authorization|token|x-token|x-api-key|apikey)['"]\s*:\s*)(['"])(.+?)\2/gi,
      "$1$2***$2"
    )

/** source.yaml first, then the source's Python files, read from the hotToday checkout. */
export async function getSourceFiles(id: string) {
  await requireUser()
  if (!/^[a-z0-9_]+$/.test(id)) return []
  const dir = `${HOTTODAY}/sources/${id}`
  const names = (await readdir(dir).catch(() => [] as string[]))
    .filter((n) => /\.(ya?ml|py)$/.test(n))
    .sort(
      (a, b) =>
        Number(/\.py$/.test(a)) - Number(/\.py$/.test(b)) || a.localeCompare(b)
    )
  return Promise.all(
    names.map(async (name) => ({
      name,
      text: hideSecrets(await readFile(`${dir}/${name}`, "utf8")),
    }))
  )
}

// Live status for /status. The proxy pool (/srv/projects/subpool, subpool.service) serves its own
// stats on localhost; node addresses are masked like every other address on the site.
export type Probe = { t: number; ms: number; err?: string }
export type ProxyStats = {
  version: string
  pool: {
    total_nodes: number
    available_nodes: number
    dial_ok: number
    dial_fail: number
    uptime_sec: number
    strategy: string
    check_interval_sec: number
  }
  subscribe: { at: string; nodes: number; error?: string }
  watchdog: {
    interval_sec: number
    fail_limit: number
    fails_in_a_row: number
    target: string
    probes: Probe[]
  }
  nodes: {
    addr: string
    kind: string
    enabled: boolean
    latency_ms: number
    failures: number
  }[]
}

const SUBPOOL_STATS = process.env.SUBPOOL_STATS ?? "http://127.0.0.1:9090/stats"

// fetch() hides the reason (ECONNREFUSED, timeout) in error.cause.
const failure = (e: unknown) => {
  const err = e as Error & { cause?: Error }
  return maskIp(err?.cause?.message ?? err?.message ?? String(e))
}

export async function getProxyStats() {
  await requireUser()
  try {
    const res = await fetch(SUBPOOL_STATS, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return { error: `统计接口返回 HTTP ${res.status}` }
    return { stats: JSON.parse(maskIp(await res.text())) as ProxyStats }
  } catch (e) {
    return { error: failure(e) }
  }
}

export async function getPgStatus() {
  try {
    const start = performance.now()
    const [row] = await query<{
      version: string
      started: number
      max_conn: number
      conns: number
      active: number
      size: number
      hit: number | null
      deadlocks: number
    }>(
      `select current_setting('server_version') as version,
              extract(epoch from pg_postmaster_start_time())::bigint as started,
              current_setting('max_connections')::int as max_conn,
              (select count(*) from pg_stat_activity)::int as conns,
              (select count(*) from pg_stat_activity where state = 'active')::int as active,
              pg_database_size(current_database()) as size,
              d.blks_hit::float8 / nullif(d.blks_hit + d.blks_read, 0) as hit,
              d.deadlocks
         from pg_stat_database d where d.datname = current_database()`
    )
    return { ...row, ms: performance.now() - start }
  } catch (e) {
    return { error: failure(e) }
  }
}

// One INFO over a raw socket: the status page needs a single command, not a client library.
export async function getRedisInfo() {
  await requireUser()
  const url = new URL(process.env.REDIS_URL ?? "redis://127.0.0.1:6379")
  const cmd = (...args: string[]) =>
    `*${args.length}\r\n` +
    args.map((a) => `$${Buffer.byteLength(a)}\r\n${a}\r\n`).join("")
  try {
    const start = performance.now()
    const reply = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      const sock = net.connect(Number(url.port) || 6379, url.hostname, () =>
        sock.write(
          (url.password ? cmd("AUTH", decodeURIComponent(url.password)) : "") +
            cmd("INFO") +
            cmd("QUIT")
        )
      )
      sock.setTimeout(3000, () => sock.destroy(new Error("3 秒没有响应")))
      sock.on("data", (c) => chunks.push(c))
      sock.on("error", reject)
      sock.on("close", () => resolve(Buffer.concat(chunks).toString()))
    })
    const ms = performance.now() - start
    const error = reply.split("\r\n").find((l) => l.startsWith("-"))
    if (error) return { error: error.slice(1) }
    const info: Record<string, string> = {}
    for (const line of reply.split("\r\n")) {
      const i = line.indexOf(":")
      if (i > 0 && !line.startsWith("#"))
        info[line.slice(0, i)] = line.slice(i + 1)
    }
    if (!info.redis_version) return { error: "INFO 没有返回内容" }
    return { info, ms }
  } catch (e) {
    return { error: failure(e) }
  }
}
