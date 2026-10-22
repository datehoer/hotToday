// Server-only data access: hotToday's task.py writes ops.round / ops.run every hour;
// source tables and hot_topic belong to the crawler and ETL. Credentials: PG* in .env.local (read-only role).
import { execFile } from "node:child_process"
import { readdir, readFile } from "node:fs/promises"
import net from "node:net"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { connection } from "next/server"
import pg from "pg"
import { cache } from "react"

import { requireUser } from "@/lib/auth"
import { isLang, LANG_COOKIE, T } from "@/lib/i18n"

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

/** The visitor's language as a translator (lib/i18n.ts): the "lang" cookie, English by default. */
export const getT = cache(async () => {
  const lang = (await cookies()).get(LANG_COOKIE)?.value
  return T[isLang(lang) ? lang : "en"]
})

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
// A source that has never saved has no table (task.py makes it on the first save), and one missing
// table would fail the whole query, and with it every page (the sidebar reads the board).
async function fillLastOk(sources: Source[]) {
  const named = sources.map((s) => s.id).filter((id) => /^[a-z0-9_]+$/.test(id))
  if (!named.length) return
  const ids = (
    await query<{ id: string }>(
      "select id from unnest($1::text[]) id where to_regclass(quote_ident(id)) is not null",
      [named]
    )
  ).map((r) => r.id)
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

export type Phase =
  "done" | "unfinished" | "crawling" | "cleaning" | "embedding"
export const PHASE: Record<Phase, [string, string]> = {
  done: ["Finished", "已完成"],
  unfinished: ["Didn't finish", "没跑完"],
  crawling: ["Crawling", "抓取中"],
  cleaning: ["Cleaning", "清洗中"],
  embedding: ["Embedding", "向量化中"],
}

export function phase(r: Round): Phase {
  if (r.finished_at != null) return "done"
  if (isDone(r)) return "unfinished"
  return r.crawl_ms == null
    ? "crawling"
    : r.etl_ms == null
      ? "cleaning"
      : "embedding"
}

export const nextRound = (r: Round) =>
  Math.floor(r.started_at / 3600) * 3600 + 3600

// Why a run wrote nothing, as a group. 6666 is the port of config.PROXY in hotToday.
export type Cause =
  "empty" | "proxy" | "timeout" | "status" | "connect" | "error"
export const CAUSE: Record<Cause, [string, string]> = {
  empty: ["Empty response", "返回空数据"],
  proxy: ["Proxy unreachable", "代理连不上"],
  timeout: ["Timed out", "超时"],
  status: ["Bad status code", "状态码异常"],
  connect: ["Can't connect", "连不上"],
  error: ["Error", "出错"],
}

export function cause(run: Run): Cause | null {
  if (run.status === "empty") return "empty"
  if (run.status !== "error") return null
  const e = run.error ?? ""
  if (/proxy|port 6666\b/i.test(e)) return "proxy"
  if (/timed? ?out/i.test(e)) return "timeout"
  if (/status=\d{3}|HTTP \d{3}/i.test(e)) return "status"
  if (/connect|resolve|reset|Empty reply/i.test(e)) return "connect"
  return "error"
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
  // The run right after approval, with the new code and the production write path
  verify: {
    ts: number
    status: "ok" | "empty" | "error"
    items: number | null
    ms: number
    error: string | null
    limit: number // seconds it was allowed
    cleaned?: boolean
    etl_error?: string
  } | null
  steps: { ts: number; tool: string; note: string }[]
  log: { ts: number; to: RepairState; by: string; note: string | null }[]
  created_at: number
  updated_at: number
  applied_at: number | null
}

// The PRD's wording for each state.
export const REPAIR_STATE: Record<RepairState, [string, string]> = {
  analyzing: ["Analyzing", "分析中"],
  handed_off: ["Ops issue", "运维处理"],
  needs_human: ["Needs a human", "需要人工"],
  awaiting_review: ["Awaiting review", "待 review"],
  observing: ["Observing", "观察中"],
  resolved: ["Recovered", "已恢复"],
  rejected: ["Rejected", "已驳回"],
  superseded: ["Recovered on its own", "已自行恢复"],
  failed: ["Failed", "失败"],
  reverted: ["Reverted", "已撤销"],
}

// ops.repair appears with repair.py's first run; until then there is nothing to show.
async function ifRepairs<T>(read: () => Promise<T>, none: T) {
  try {
    return await read()
  } catch (e) {
    if ((e as { code?: string }).code === "42P01") return none
    throw e
  }
}

const queryRepairs = (
  where: string,
  args: unknown[],
  order = "id desc",
  limit = 20
) =>
  ifRepairs(async () => {
    const rows = await query<Repair>(
      `select id, source, state, category, reason, summary, evidence, model, tokens, attempts, diff,
              dry_run, checks, verify, steps, log, created_at, updated_at, applied_at
         from ops.repair where ${where} order by ${order} limit ${Math.trunc(limit)}`,
      args
    )
    // Not the diff: version numbers in User-Agent strings look like IPs.
    return rows.map(({ diff, ...r }) => ({
      ...(JSON.parse(maskIp(JSON.stringify(r))) as Omit<Repair, "diff">),
      diff,
    }))
  }, [])

export const getRepairs = (source: string) =>
  queryRepairs("source = $1", [source])

// Open tasks, plus the ones that moved in the last day (approved, recovered, …).
export const getActiveRepairs = (since: number) =>
  queryRepairs(
    "state in ('analyzing', 'awaiting_review', 'observing') or updated_at > $1",
    [since],
    "updated_at desc"
  )

/** Every task, the most recently changed first; states narrows it. */
export const getRepairLog = (states: RepairState[] | null, limit: number) =>
  queryRepairs(
    states ? "state = any($1)" : "true",
    states ? [states] : [],
    "updated_at desc, id desc",
    limit
  )

export const countRepairs = () =>
  ifRepairs(
    () =>
      query<{ state: RepairState; n: number }>(
        "select state, count(*)::int as n from ops.repair group by state"
      ),
    []
  )

/** The first two rounds after each applied patch went live (what settle() judges it by), by task id. */
export async function getRunsAfter(repairs: Repair[]) {
  const ids = repairs.filter((r) => r.applied_at).map((r) => r.id)
  const rows = ids.length
    ? await queryRuns(
        `select r.id as repair, u.*
           from ops.repair r
           join lateral (select * from ops.run u
                          where u.source = r.source and u.round_at > r.applied_at
                          order by u.round_at limit 2) u on true
          where r.id = any($1::bigint[])
          order by u.round_at`,
        [ids]
      )
    : []
  return Map.groupBy(rows as (Run & { repair: number })[], (r) => r.repair)
}

// The spider's configuration as it sees it: `task.py --config` inside the container validates every
// source.yaml and reports the AI repair settings (ops.setting merged with repair.py's defaults; no
// passwords or keys). Takes about a second.
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
  repair: RepairSettings & {
    key: string | null // which line of hotToday/.env holds the key (never the key itself)
    models: string[] // GET {api_base}/models with that key, sorted
    models_error: string | null
    custom_system: boolean // false: the prompt built into repair.py
    defaults: RepairSettings
    ranges: Record<RepairLimit, [number, number, string]> // min, max, name
    updated_at: number | null
    updated_by: string | null
    doc: string // what {doc} in the prompt stands for
    final: string
    tools: { name: string; description: string }[]
    ops_rules: { pattern: string; reason: string; label: string }[]
    safe_imports: string[]
  }
}

/** A server action's answer, shown in the dialog that ran it; ok: it did what was asked. */
export type Reply = { ok: boolean; text: string }
export const done = (text: string): Reply => ({ ok: true, text })
export const failed = (text: string): Reply => ({ ok: false, text })

// Saved in ops.setting by `repair.py settings`; system is the prompt template with its placeholders.
export const REPAIR_LIMITS = [
  "daily",
  "max_turns",
  "max_tokens",
  "task_minutes",
  "max_patches",
  "max_fetches",
  "dry_run_seconds",
] as const
export type RepairLimit = (typeof REPAIR_LIMITS)[number]
export type RepairSettings = Record<RepairLimit, number> & {
  model: string
  api_base: string // OpenAI-compatible: {api_base}/chat/completions, {api_base}/models
  system: string
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

export const HOTTODAY = process.env.HOTTODAY_DIR ?? "/srv/projects/hotToday"

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
  subscribe: {
    at: string
    nodes: number
    error?: string
    // One per subscription in subpool.conf order (u= lines, then f= lines); a URL shows only its origin
    sources?: {
      kind: "url" | "file"
      name: string
      nodes: number
      available: number // of its nodes, how many pass health checks now
      ms: number
      error?: string
    }[]
  }
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
export const failure = (e: unknown) => {
  const err = e as Error & { cause?: Error }
  return maskIp(err?.cause?.message ?? err?.message ?? String(e))
}

export async function getProxyStats() {
  await requireUser()
  const t = await getT()
  try {
    const res = await fetch(SUBPOOL_STATS, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok)
      return {
        error: t(
          `the stats endpoint returned HTTP ${res.status}`,
          `统计接口返回 HTTP ${res.status}`
        ),
      }
    return { stats: JSON.parse(maskIp(await res.text())) as ProxyStats }
  } catch (e) {
    return { error: failure(e) }
  }
}

// subpool.conf (conflag KEY=VALUE lines): the site shows the tuning keys and the subscriptions in full
// (behind the login); the listener line, which holds the proxy's password, never leaves the server.
export const SUBPOOL_CONF =
  process.env.SUBPOOL_CONF ?? "/srv/projects/subpool/subpool.conf"
export const SUBPOOL_DEFAULTS = {
  s: "rr",
  dr: "3",
  ri: "3600",
  c: "http://www.msftconnecttest.com/connecttest.txt#expect=200",
  ci: "600",
  ct: "10",
  wi: "60",
  wf: "0",
}
export type SubpoolKey = keyof typeof SUBPOOL_DEFAULTS
// What the config page edits besides s (strategy) and c (check URL); range is what saving accepts.
// Labels and hints are [English, 中文].
export const SUBPOOL_FIELDS: {
  key: SubpoolKey
  label: [string, string]
  hint: [string, string]
  range: [number, number]
}[] = [
  {
    key: "dr",
    label: ["Dial failures before switching node", "拨号失败换节点"],
    hint: ["times", "次"],
    range: [0, 10],
  },
  {
    key: "ri",
    label: ["Subscription refresh interval", "订阅刷新间隔"],
    hint: ["seconds; 0 never refreshes", "秒；填 0 不刷新"],
    range: [0, 86400],
  },
  {
    key: "ci",
    label: ["Node check interval", "节点检测间隔"],
    hint: ["seconds", "秒"],
    range: [30, 86400],
  },
  {
    key: "ct",
    label: ["Node check timeout", "节点检测超时"],
    hint: ["seconds", "秒"],
    range: [1, 60],
  },
  {
    key: "wi",
    label: ["Watchdog probe interval", "看门狗探测间隔"],
    hint: ["seconds; 0 turns it off", "秒；填 0 关闭"],
    range: [0, 3600],
  },
  {
    key: "wf",
    label: ["Watchdog failures in a row", "看门狗连续失败"],
    hint: [
      "then it exits and systemd restarts it; 0 never exits",
      "次后退出，由 systemd 重启；填 0 不退出",
    ],
    range: [0, 100],
  },
]
export const SUBPOOL_STRATEGIES: Record<string, [string, string]> = {
  rr: ["rr round robin", "rr 轮询"],
  random: ["random", "random 随机"],
  wrr: [
    "wrr weighted round robin (low latency more often)",
    "wrr 加权轮询（延迟低的多用）",
  ],
  ha: [
    "ha high availability (first available node)",
    "ha 高可用（一直用第一个可用节点）",
  ],
  lha: ["lha lowest latency", "lha 最低延迟"],
  dh: ["dh same node per destination", "dh 同一目标固定节点"],
}

export async function getSubpoolConf() {
  await requireUser()
  let text: string
  try {
    text = await readFile(/*turbopackIgnore: true*/ SUBPOOL_CONF, "utf8")
  } catch (e) {
    return { error: failure(e) }
  }
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim(),
    ])
  const all = (key: string) =>
    lines.filter(([k]) => k === key).map(([, v]) => v)
  const values = { ...SUBPOOL_DEFAULTS }
  for (const key of Object.keys(values) as SubpoolKey[])
    values[key] = all(key).at(-1) ?? values[key]
  return { values, urls: all("u"), files: all("f") }
}

/** How subpool's /stats names a subscription URL: by its origin, masked like the rest of the stats. */
export const statsName = (url: string) => maskIp(URL.parse(url)?.origin ?? "?")

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
  const t = await getT()
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
      sock.setTimeout(3000, () =>
        sock.destroy(new Error(t("no answer in 3 s", "3 秒没有响应")))
      )
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
    if (!info.redis_version)
      return { error: t("INFO returned nothing", "INFO 没有返回内容") }
    return { info, ms }
  } catch (e) {
    return { error: failure(e) }
  }
}
