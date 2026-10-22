import { RiErrorWarningLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

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
import { count, type Translate } from "@/lib/i18n"
import {
  getPgStatus,
  getProxyStats,
  getRedisInfo,
  getT,
  type Probe,
  type ProxyStats,
} from "@/lib/ops"
import { cn, fmtBytes, fmtNum, listSize } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("Status", "状态") }
}

const NODES = 50 // per page
const NODE_FILTERS = {
  all: ["All", "全部"],
  up: ["Available", "可用"],
  down: ["Unavailable", "不可用"],
} as const
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
  const t = await getT()
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
  const up = t("OK", "正常")
  const down = t("Can't connect", "连不上")

  return (
    <>
      <PageHeader crumbs={[[t("Ops", "运维"), "/"], [t("Status", "状态")]]} />
      <AutoRefresh seconds={30} />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("Status", "状态")}>
          {t(
            "The proxy, PostgreSQL and Redis the crawler uses, checked when the page opens and every 30 seconds.",
            "爬虫用到的代理、PostgreSQL 和 Redis，打开时现查，每 30 秒刷新一次。"
          )}
        </PageTitle>

        <div className="grid gap-3 sm:grid-cols-3 md:gap-4">
          <Stat
            label={
              <span className="flex items-center justify-between">
                {t("Proxy subpool", "代理 subpool")}
                <Health tone={proxyTone}>
                  {!p
                    ? t("Not running", "没在运行")
                    : !p.pool.available_nodes
                      ? t("No available node", "没有可用节点")
                      : p.watchdog.fails_in_a_row
                        ? t("Probe failing", "探测失败")
                        : up}
                </Health>
              </span>
            }
            value={p ? p.pool.available_nodes : "—"}
            unit={
              p
                ? t(
                    `/ ${p.pool.total_nodes} nodes available`,
                    `/ ${p.pool.total_nodes} 个节点可用`
                  )
                : undefined
            }
            note={
              p
                ? lastHour.length
                  ? t(
                      `${okHour.length}/${lastHour.length} probes OK in the last hour`,
                      `最近 1 小时探测 ${okHour.length}/${lastHour.length} 次成功`
                    )
                  : t("No watchdog probes yet", "看门狗还没有探测结果")
                : t("The stats endpoint doesn't answer", "统计接口连不上")
            }
          />
          <Stat
            label={
              <span className="flex items-center justify-between">
                PostgreSQL
                <Health tone={"error" in pg ? "bad" : "ok"}>
                  {"error" in pg ? down : up}
                </Health>
              </span>
            }
            value={"error" in pg ? "—" : pg.conns}
            unit={
              "error" in pg
                ? undefined
                : t(`/ ${pg.max_conn} connections`, `/ ${pg.max_conn} 个连接`)
            }
            note={
              "error" in pg
                ? pg.error
                : t(
                    `query ${ms(pg.ms)} · hotday database ${fmtBytes(pg.size)}`,
                    `查询 ${ms(pg.ms)} · hotday 库 ${fmtBytes(pg.size)}`
                  )
            }
          />
          <Stat
            label={
              <span className="flex items-center justify-between">
                Redis
                <Health tone={info ? "ok" : "bad"}>{info ? up : down}</Health>
              </span>
            }
            value={info ? info.used_memory_human : "—"}
            unit={info ? t("memory", "内存") : undefined}
            note={
              info && "ms" in redis
                ? t(
                    `query ${ms(redis.ms!)} · ${count(Number(info.connected_clients), "client")}`,
                    `查询 ${ms(redis.ms!)} · ${info.connected_clients} 个客户端`
                  )
                : "error" in redis
                  ? redis.error
                  : undefined
            }
          />
        </div>

        {p ? (
          <ProxyCard
            t={t}
            p={p}
            lastHour={lastHour}
            filter={filter}
            n={listSize(query.n, NODES, 2000)}
          />
        ) : (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            <RiErrorWarningLine />
            <AlertTitle>
              {t("The proxy isn't running", "代理没在运行")}
            </AlertTitle>
            <AlertDescription>
              <span className="font-mono break-all">
                {"error" in proxy && proxy.error}
              </span>
              <br />
              {t(
                "Sources that use the subpool proxy fail this round. On the server: sudo systemctl status subpool; logs are in /srv/projects/subpool/logs/.",
                "用 subpool 代理的源这一轮会失败。在服务器上看 sudo systemctl status subpool，日志在 /srv/projects/subpool/logs/。"
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                PostgreSQL
                <Health tone={"error" in pg ? "bad" : "ok"}>
                  {"error" in pg ? down : up}
                </Health>
              </CardTitle>
              <CardDescription>
                {t(
                  "The postgres-main container, 127.0.0.1:5432; read here with a read-only account",
                  "postgres-main 容器，127.0.0.1:5432；这里用只读账号查"
                )}
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
                    [t("Version", "版本"), pg.version],
                    [
                      t("Up for", "已运行"),
                      t(
                        `${t.uptime(now - pg.started)} (since ${t.day(pg.started)})`,
                        `${t.uptime(now - pg.started)}（${t.day(pg.started)}起）`
                      ),
                    ],
                    [
                      t("Connections", "连接"),
                      t(
                        `${pg.conns} / ${pg.max_conn}, ${pg.active} active`,
                        `${pg.conns} / ${pg.max_conn}，${pg.active} 个在执行`
                      ),
                    ],
                    [t("hotday database", "hotday 库"), fmtBytes(pg.size)],
                    [
                      t("Cache hit rate", "缓存命中率"),
                      pg.hit == null ? "—" : pct(pg.hit, 1),
                    ],
                    [
                      t("Deadlocks", "死锁"),
                      t(
                        `${fmtNum(pg.deadlocks)} since the stats were reset`,
                        `${fmtNum(pg.deadlocks)} 次（统计重置以来）`
                      ),
                    ],
                    [t("This query", "这次查询"), ms(pg.ms)],
                  ]}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Redis
                <Health tone={info ? "ok" : "bad"}>{info ? up : down}</Health>
              </CardTitle>
              <CardDescription>
                {t(
                  "The redis-main container, 127.0.0.1:6379; hot-rank-web caches in db7",
                  "redis-main 容器，127.0.0.1:6379；hot-rank-web 的缓存在 db7"
                )}
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
                    [t("Version", "版本"), info.redis_version],
                    [
                      t("Up for", "已运行"),
                      t.uptime(Number(info.uptime_in_seconds)),
                    ],
                    [
                      t("Memory", "内存"),
                      t(
                        `${info.used_memory_human}, peak ${info.used_memory_peak_human}, limit ${info.maxmemory_human === "0B" ? "none" : info.maxmemory_human}`,
                        `${info.used_memory_human}，峰值 ${info.used_memory_peak_human}，上限 ${info.maxmemory_human === "0B" ? "不限" : info.maxmemory_human}`
                      ),
                    ],
                    [t("Clients", "客户端"), info.connected_clients],
                    [
                      t("Ops per second", "每秒操作"),
                      info.instantaneous_ops_per_sec,
                    ],
                    [
                      t("Hit rate", "命中率"),
                      pct(
                        Number(info.keyspace_hits),
                        Number(info.keyspace_hits) +
                          Number(info.keyspace_misses)
                      ),
                    ],
                    [
                      t("Keys", "键"),
                      Object.keys(info)
                        .filter((k) => /^db\d+$/.test(k))
                        .map((k) => {
                          const n = info[k].match(/keys=(\d+)/)?.[1]
                          return t(`${k} ${n}`, `${k} ${n} 个`)
                        })
                        .join(t(", ", "，")) || t("none", "没有"),
                    ],
                    [
                      t("Last save", "上次落盘"),
                      t(
                        `${t.time(Number(info.rdb_last_save_time))}, ${info.rdb_last_bgsave_status}`,
                        `${t.time(Number(info.rdb_last_save_time))}，${info.rdb_last_bgsave_status === "ok" ? "成功" : info.rdb_last_bgsave_status}`
                      ),
                    ],
                    [
                      t("This query", "这次查询"),
                      "ms" in redis ? ms(redis.ms!) : "—",
                    ],
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
  t,
  p,
  lastHour,
  filter,
  n,
}: {
  t: Translate
  p: ProxyStats
  lastHour: Probe[]
  filter: NodeFilter
  n: number
}) {
  const { pool, watchdog, subscribe } = p
  // Right after a start every node is still unchecked, so "no available node" waits for the checks.
  const badSubs =
    subscribe.sources?.filter(
      (s) => s.error || (!s.available && pool.uptime_sec >= 30)
    ).length ?? 0
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
  const loaded = t.time(Date.parse(subscribe.at) / 1000)

  return (
    <Card className="py-2">
      <CardHeader className="pt-4">
        <CardTitle>{t("Proxy subpool", "代理 subpool")}</CardTitle>
        <CardDescription>
          {t(
            `subpool.service, /srv/projects/subpool · version ${p.version} · up ${t.uptime(pool.uptime_sec)} · strategy ${pool.strategy} · nodes checked every ${pool.check_interval_sec} s`,
            `subpool.service，/srv/projects/subpool · 版本 ${p.version} · 已运行 ${t.uptime(pool.uptime_sec)} · 调度 ${pool.strategy} · 每 ${pool.check_interval_sec} 秒检测一次节点`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Facts
          rows={[
            [
              t("Subscriptions", "订阅"),
              <span key="v">
                {subscribe.error ? (
                  <span className="text-destructive">
                    {t(
                      `Loading failed at ${loaded}: ${subscribe.error}`,
                      `${loaded} 加载失败：${subscribe.error}`
                    )}
                  </span>
                ) : (
                  t(
                    `Loaded at ${loaded}, ${count(subscribe.nodes, "node")}; refreshed every hour. `,
                    `${loaded} 加载，${subscribe.nodes} 个节点；每小时刷新。`
                  )
                )}
                {badSubs > 0 && (
                  <span className="text-destructive">
                    {t(
                      `${badSubs} ${badSubs === 1 ? "subscription failed to load or has" : "subscriptions failed to load or have"} no available node.`,
                      `${badSubs} 个订阅拉取失败或没有可用节点。`
                    )}
                  </span>
                )}
                <Link
                  href="/config?tab=subpool"
                  className="ml-1 underline-offset-4 hover:underline"
                >
                  {t("See each subscription", "各个订阅")}
                </Link>
              </span>,
            ],
            [
              t("Watchdog", "看门狗"),
              watchdog.interval_sec
                ? t(
                    `Fetches ${watchdog.target} through the proxy port every ${watchdog.interval_sec} s` +
                      (watchdog.fail_limit
                        ? `; restarts subpool after ${watchdog.fail_limit} failures in a row while nodes are available`
                        : ""),
                    `每 ${watchdog.interval_sec} 秒经代理端口抓一次 ${watchdog.target}` +
                      (watchdog.fail_limit
                        ? `；有可用节点却连续 ${watchdog.fail_limit} 次失败就自动重启`
                        : "")
                  )
                : t("Off", "没开"),
            ],
            [
              t("Dials", "拨号"),
              t(
                `${fmtNum(pool.dial_ok)} OK, ${fmtNum(pool.dial_fail)} failed since the start`,
                `启动以来成功 ${fmtNum(pool.dial_ok)} 次，失败 ${fmtNum(pool.dial_fail)} 次`
              ),
            ],
          ]}
        />
        {recent.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {t("The last 60 probes", "最近 60 次探测")}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t(
                  `${okHour.length}/${lastHour.length} OK in the last hour`,
                  `最近 1 小时 ${okHour.length}/${lastHour.length} 次成功`
                )}
                {okHour.length > 0 &&
                  t(
                    `, ${ms(okHour.reduce((a, x) => a + x.ms, 0) / okHour.length)} on average`,
                    `，平均 ${ms(okHour.reduce((a, x) => a + x.ms, 0) / okHour.length)}`
                  )}
                {probes.length > lastHour.length &&
                  t(
                    ` · last ${t.uptime(probes.length * watchdog.interval_sec)}: ${pct(probes.filter((x) => x.ms >= 0).length, probes.length)}`,
                    ` · 最近 ${t.uptime(probes.length * watchdog.interval_sec)} ${pct(probes.filter((x) => x.ms >= 0).length, probes.length)}`
                  )}
              </span>
            </span>
            <span className="flex items-end gap-0.5" aria-hidden>
              {slots.map((x, i) => (
                <i
                  key={x?.t ?? `empty-${i}`}
                  title={
                    x
                      ? `${t.time(x.t)} ${x.ms >= 0 ? ms(x.ms) : t(`failed: ${x.err}`, `失败：${x.err}`)}`
                      : t("no probe yet", "还没有探测")
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
                {t(
                  `Last failure ${t.time(lastFail.t)}: ${lastFail.err}`,
                  `上次失败 ${t.time(lastFail.t)}：${lastFail.err}`
                )}
              </span>
            )}
          </div>
        )}
      </CardContent>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-2 sm:px-6">
        <span className="text-sm font-medium">{t("Nodes", "节点")}</span>
        <PillNav
          items={(Object.keys(NODE_FILTERS) as NodeFilter[]).map((f) => ({
            href: href(f),
            label: t(...NODE_FILTERS[f]),
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
            <TableHead className="pl-4 sm:pl-6">
              {t("Address", "地址")}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("Protocol", "协议")}
            </TableHead>
            <TableHead>{t("Status", "状态")}</TableHead>
            <TableHead>{t("Latency", "延迟")}</TableHead>
            <TableHead className="hidden pr-4 sm:table-cell sm:pr-6">
              {t("Failures in a row", "连续失败")}
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
                  <Badge variant="outline">{t(...NODE_FILTERS.up)}</Badge>
                ) : (
                  <Badge variant="secondary">{t(...NODE_FILTERS.down)}</Badge>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {x.latency_ms ? ms(x.latency_ms) : "—"}
              </TableCell>
              <TableCell className="hidden pr-4 text-muted-foreground tabular-nums sm:table-cell sm:pr-6">
                {x.failures}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {nodes.length > n && (
        <LoadMore href={href(filter, n + NODES)}>
          {t(
            `${Math.min(NODES, nodes.length - n)} more (${nodes.length} in all)`,
            `再看 ${Math.min(NODES, nodes.length - n)} 个（共 ${nodes.length} 个）`
          )}
        </LoadMore>
      )}
    </Card>
  )
}
