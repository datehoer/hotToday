import { RiErrorWarningLine } from "@remixicon/react"
import type { Metadata } from "next"

import { AutoRefresh, LoadMore } from "@/components/ops-client"
import { Facts, PageHeader, PageTitle, PillNav, Stat } from "@/components/ops"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  getPgStatus,
  getProxyStats,
  getRedisInfo,
  type Probe,
  type ProxyStats,
} from "@/lib/ops"
import {
  cn,
  fmtBytes,
  fmtDay,
  fmtNum,
  fmtTime,
  fmtUptime,
  listSize,
} from "@/lib/utils"

export const metadata: Metadata = { title: "状态" }

const NODES = 50 // per page
const NODE_FILTERS = { all: "全部", up: "可用", down: "不可用" } as const
type NodeFilter = keyof typeof NODE_FILTERS

const pct = (part: number, whole: number) =>
  whole ? `${((part / whole) * 100).toFixed(1)}%` : "—"
const ms = (n: number) => `${Math.round(n)} ms`

function Health({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad"
  children: string
}) {
  if (tone === "ok") return <Badge variant="outline">{children}</Badge>
  if (tone === "bad") return <Badge variant="destructive">{children}</Badge>
  return (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
      {children}
    </Badge>
  )
}

export default async function Status({
  searchParams,
}: {
  searchParams: Promise<{ nodes?: string; n?: string }>
}) {
  const query = await searchParams
  const filter: NodeFilter =
    query.nodes === "up" || query.nodes === "down" ? query.nodes : "all"
  const [proxy, pg, redis] = await Promise.all([
    getProxyStats(),
    getPgStatus(),
    getRedisInfo(),
  ])
  const p = "stats" in proxy ? proxy.stats : null
  // eslint-disable-next-line react-hooks/purity -- a server component, rendered once per request
  const now = Date.now() / 1000
  const lastHour = p?.watchdog.probes.filter((x) => x.t > now - 3600) ?? []
  const okHour = lastHour.filter((x) => x.ms >= 0)
  const proxyTone = !p
    ? "bad"
    : !p.pool.available_nodes
      ? "bad"
      : p.watchdog.fails_in_a_row
        ? "warn"
        : "ok"
  const info = "info" in redis ? redis.info : null

  return (
    <>
      <PageHeader crumbs={[["运维", "/"], ["状态"]]} />
      <AutoRefresh seconds={30} />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="状态">
          爬虫用到的代理、PostgreSQL 和 Redis，打开时现查，每 30 秒刷新一次。
        </PageTitle>

        <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
          <Stat
            label={
              <span className="flex items-center justify-between">
                代理 subpool
                <Health tone={proxyTone}>
                  {!p
                    ? "没在运行"
                    : !p.pool.available_nodes
                      ? "没有可用节点"
                      : p.watchdog.fails_in_a_row
                        ? "探测失败"
                        : "正常"}
                </Health>
              </span>
            }
            value={p ? p.pool.available_nodes : "—"}
            unit={p ? `/ ${p.pool.total_nodes} 个节点可用` : undefined}
            note={
              p
                ? lastHour.length
                  ? `最近 1 小时探测 ${okHour.length}/${lastHour.length} 次成功`
                  : "看门狗还没有探测结果"
                : "统计接口连不上"
            }
          />
          <Stat
            label={
              <span className="flex items-center justify-between">
                PostgreSQL
                <Health tone={"error" in pg ? "bad" : "ok"}>
                  {"error" in pg ? "连不上" : "正常"}
                </Health>
              </span>
            }
            value={"error" in pg ? "—" : pg.conns}
            unit={"error" in pg ? undefined : `/ ${pg.max_conn} 个连接`}
            note={
              "error" in pg
                ? pg.error
                : `查询 ${ms(pg.ms)} · hotday 库 ${fmtBytes(pg.size)}`
            }
          />
          <Stat
            label={
              <span className="flex items-center justify-between">
                Redis
                <Health tone={info ? "ok" : "bad"}>
                  {info ? "正常" : "连不上"}
                </Health>
              </span>
            }
            value={info ? info.used_memory_human : "—"}
            unit={info ? "内存" : undefined}
            note={
              info && "ms" in redis
                ? `查询 ${ms(redis.ms!)} · ${info.connected_clients} 个客户端`
                : "error" in redis
                  ? redis.error
                  : undefined
            }
          />
        </div>

        {p ? (
          <ProxyCard
            p={p}
            lastHour={lastHour}
            filter={filter}
            n={listSize(query.n, NODES, 2000)}
          />
        ) : (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            <RiErrorWarningLine />
            <AlertTitle>代理没在运行</AlertTitle>
            <AlertDescription>
              <span className="font-mono break-all">
                {"error" in proxy && proxy.error}
              </span>
              <br />用 subpool 代理的源这一轮会失败。在服务器上看 sudo systemctl
              status subpool，日志在 /srv/projects/subpool/logs/。
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                PostgreSQL
                <Health tone={"error" in pg ? "bad" : "ok"}>
                  {"error" in pg ? "连不上" : "正常"}
                </Health>
              </CardTitle>
              <CardDescription>
                postgres-main 容器，127.0.0.1:5432；这里用只读账号查
              </CardDescription>
            </CardHeader>
            <CardContent>
              {"error" in pg ? (
                <span className="font-mono text-sm break-all text-destructive">
                  {pg.error}
                </span>
              ) : (
                <Facts
                  rows={[
                    ["版本", pg.version],
                    [
                      "已运行",
                      `${fmtUptime(now - pg.started)}（${fmtDay(pg.started)}起）`,
                    ],
                    [
                      "连接",
                      `${pg.conns} / ${pg.max_conn}，${pg.active} 个在执行`,
                    ],
                    ["hotday 库", fmtBytes(pg.size)],
                    ["缓存命中率", pg.hit == null ? "—" : pct(pg.hit, 1)],
                    ["死锁", `${fmtNum(pg.deadlocks)} 次（统计重置以来）`],
                    ["这次查询", ms(pg.ms)],
                  ]}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Redis
                <Health tone={info ? "ok" : "bad"}>
                  {info ? "正常" : "连不上"}
                </Health>
              </CardTitle>
              <CardDescription>
                redis-main 容器，127.0.0.1:6379；hot-rank-web 的缓存在 db7
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!info ? (
                <span className="font-mono text-sm break-all text-destructive">
                  {"error" in redis && redis.error}
                </span>
              ) : (
                <Facts
                  rows={[
                    ["版本", info.redis_version],
                    ["已运行", fmtUptime(Number(info.uptime_in_seconds))],
                    [
                      "内存",
                      `${info.used_memory_human}，峰值 ${info.used_memory_peak_human}，上限 ${info.maxmemory_human === "0B" ? "不限" : info.maxmemory_human}`,
                    ],
                    ["客户端", info.connected_clients],
                    ["每秒操作", info.instantaneous_ops_per_sec],
                    [
                      "命中率",
                      pct(
                        Number(info.keyspace_hits),
                        Number(info.keyspace_hits) +
                          Number(info.keyspace_misses)
                      ),
                    ],
                    [
                      "键",
                      Object.keys(info)
                        .filter((k) => /^db\d+$/.test(k))
                        .map(
                          (k) => `${k} ${info[k].match(/keys=(\d+)/)?.[1]} 个`
                        )
                        .join("，") || "没有",
                    ],
                    [
                      "上次落盘",
                      `${fmtTime(Number(info.rdb_last_save_time))}，${info.rdb_last_bgsave_status === "ok" ? "成功" : info.rdb_last_bgsave_status}`,
                    ],
                    ["这次查询", "ms" in redis ? ms(redis.ms!) : "—"],
                  ]}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

function ProxyCard({
  p,
  lastHour,
  filter,
  n,
}: {
  p: ProxyStats
  lastHour: Probe[]
  filter: NodeFilter
  n: number
}) {
  const { pool, watchdog, subscribe } = p
  const probes = watchdog.probes
  // One slot per probe for the last 60, grey until the watchdog has run that long.
  const recent = probes.slice(-60)
  const slots = [
    ...Array(60 - recent.length).fill(null),
    ...recent,
  ] as (Probe | null)[]
  const okHour = lastHour.filter((x) => x.ms >= 0)
  const lastFail = probes.findLast((x) => x.ms < 0)
  const nodes = p.nodes
    .filter((x) => filter === "all" || x.enabled === (filter === "up"))
    // available first, fastest first; unmeasured latency (0) after the measured ones
    .sort(
      (a, b) =>
        Number(b.enabled) - Number(a.enabled) ||
        (a.latency_ms || 1e9) - (b.latency_ms || 1e9) ||
        b.failures - a.failures
    )
  const href = (f: NodeFilter, size?: number) =>
    `/status?${new URLSearchParams({
      ...(f !== "all" && { nodes: f }),
      ...(size && { n: String(size) }),
    })}`

  return (
    <Card className="py-2">
      <CardHeader className="pt-4">
        <CardTitle>代理 subpool</CardTitle>
        <CardDescription>
          subpool.service，/srv/projects/subpool · 版本 {p.version} · 已运行{" "}
          {fmtUptime(pool.uptime_sec)} · 调度 {pool.strategy} · 每{" "}
          {pool.check_interval_sec} 秒检测一次节点
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Facts
          rows={[
            [
              "订阅",
              subscribe.error ? (
                <span className="text-destructive">
                  {fmtTime(Date.parse(subscribe.at) / 1000)} 加载失败：
                  {subscribe.error}
                </span>
              ) : (
                `${fmtTime(Date.parse(subscribe.at) / 1000)} 加载，${subscribe.nodes} 个节点；每小时刷新`
              ),
            ],
            [
              "看门狗",
              watchdog.interval_sec
                ? `每 ${watchdog.interval_sec} 秒经代理端口抓一次 ${watchdog.target}` +
                  (watchdog.fail_limit
                    ? `；有可用节点却连续 ${watchdog.fail_limit} 次失败就自动重启`
                    : "")
                : "没开",
            ],
            [
              "拨号",
              `启动以来成功 ${fmtNum(pool.dial_ok)} 次，失败 ${fmtNum(pool.dial_fail)} 次`,
            ],
          ]}
        />
        {recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">最近 60 次探测</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                最近 1 小时 {okHour.length}/{lastHour.length} 次成功
                {okHour.length > 0 &&
                  `，平均 ${ms(okHour.reduce((a, x) => a + x.ms, 0) / okHour.length)}`}
                {probes.length > lastHour.length &&
                  ` · 最近 ${fmtUptime(probes.length * watchdog.interval_sec)} ${pct(probes.filter((x) => x.ms >= 0).length, probes.length)}`}
              </span>
            </span>
            <span className="flex items-end gap-0.5" aria-hidden>
              {slots.map((x, i) => (
                <i
                  key={x?.t ?? `empty-${i}`}
                  title={
                    x
                      ? `${fmtTime(x.t)} ${x.ms >= 0 ? ms(x.ms) : `失败：${x.err}`}`
                      : "还没有探测"
                  }
                  className={cn(
                    "h-[18px] min-w-0 flex-1 rounded-[2px]",
                    !x
                      ? "bg-muted"
                      : x.ms >= 0
                        ? "bg-primary/75"
                        : "bg-destructive"
                  )}
                />
              ))}
            </span>
            {lastFail && (
              <span className="font-mono text-xs break-all text-muted-foreground">
                上次失败 {fmtTime(lastFail.t)}：{lastFail.err}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-2 sm:px-6">
        <span className="text-sm font-medium">节点</span>
        <PillNav
          items={(Object.keys(NODE_FILTERS) as NodeFilter[]).map((f) => ({
            href: href(f),
            label: NODE_FILTERS[f],
            count: p.nodes.filter(
              (x) => f === "all" || x.enabled === (f === "up")
            ).length,
            active: filter === f,
          }))}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 sm:pl-6">地址</TableHead>
            <TableHead className="hidden sm:table-cell">协议</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">延迟</TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell sm:pr-6">
              连续失败
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {nodes.slice(0, n).map((x, i) => (
            <TableRow key={`${x.addr}-${i}`}>
              <TableCell className="w-full max-w-0 pl-4 sm:pl-6">
                <span
                  className="block truncate font-mono text-xs"
                  title={x.addr}
                >
                  {/* chains list every hop ("a:443,b:443"); the first is where traffic enters */}
                  {x.addr.split(",")[0]}
                </span>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {x.kind}
              </TableCell>
              <TableCell>
                {x.enabled ? (
                  <Badge variant="outline">可用</Badge>
                ) : (
                  <Badge variant="secondary">不可用</Badge>
                )}
              </TableCell>
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {x.latency_ms ? ms(x.latency_ms) : "—"}
              </TableCell>
              <TableCell className="hidden pr-4 text-right text-muted-foreground tabular-nums sm:table-cell sm:pr-6">
                {x.failures}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {nodes.length > n && (
        <LoadMore href={href(filter, n + NODES)}>
          再看 {Math.min(NODES, nodes.length - n)} 个（共 {nodes.length} 个）
        </LoadMore>
      )}
    </Card>
  )
}
