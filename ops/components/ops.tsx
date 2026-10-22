import Link from "next/link"
import { Fragment } from "react"

import { LinkPending } from "@/components/ops-client"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  phase,
  REPAIR_STATE,
  type Repair,
  type RepairState,
  type Round,
  type Run,
} from "@/lib/ops"
import { cn, fmtMs, fmtNum, fmtTime } from "@/lib/utils"

export const STATUS = {
  ok: "正常",
  empty: "返回空数据",
  error: "出错",
  disabled: "已停用",
} as const

export function StatusBadge({
  run,
  low,
}: {
  run: Pick<Run, "status">
  low?: boolean
}) {
  if (low)
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
        条数偏低
      </Badge>
    )
  if (run.status === "ok") return <Badge variant="outline">正常</Badge>
  if (run.status === "disabled")
    return <Badge variant="secondary">已停用</Badge>
  return <Badge variant="destructive">{STATUS[run.status]}</Badge>
}

export function PhaseBadge({ round }: { round: Round }) {
  const p = phase(round)
  if (p === "没跑完") return <Badge variant="destructive">没跑完</Badge>
  if (p !== "已完成") return <Badge>{p}</Badge>
  return round.error ? (
    <Badge variant="destructive" title={round.error}>
      有错误
    </Badge>
  ) : (
    <Badge variant="outline">已完成</Badge>
  )
}

/** One bar per round, oldest first: blue wrote data, red wrote nothing, grey no record. */
export function Spark({ history }: { history: (Run | null)[] }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {history.map((h, i) => (
        <i
          key={i}
          title={
            h
              ? `${fmtTime(h.round_at)} ${STATUS[h.status]}${h.items != null ? ` · ${h.items} 条` : ""}`
              : "没有记录"
          }
          className={cn(
            "h-[18px] w-1 rounded-[2px]",
            !h
              ? "bg-muted"
              : h.status === "ok"
                ? "bg-primary/75"
                : h.status === "disabled"
                  ? "bg-muted-foreground/25"
                  : "bg-destructive"
          )}
        />
      ))}
    </span>
  )
}

/** Label / value rows, e.g. a model's settings or a server's numbers. */
export function Facts({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Pill-shaped links that switch a server-rendered view (?f=, ?tab=…). */
export function PillNav({
  items,
}: {
  items: {
    href: string | { pathname: string; query: Record<string, string> }
    label: string
    count?: number
    active: boolean
  }[]
}) {
  return (
    <nav className="inline-flex h-9 w-fit items-center rounded-full bg-muted p-1 text-sm">
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          scroll={false}
          data-active={it.active || undefined}
          className="inline-flex h-full items-center gap-1.5 rounded-full px-3 font-medium text-foreground/60 transition-colors hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm"
        >
          {it.label}
          {it.count != null && (
            <span className="text-xs font-normal text-muted-foreground tabular-nums">
              {it.count}
            </span>
          )}
          <LinkPending />
        </Link>
      ))}
    </nav>
  )
}

export function Stat({
  label,
  value,
  unit,
  note,
  href,
}: {
  label: React.ReactNode
  value: React.ReactNode
  unit?: string
  note?: React.ReactNode
  href?: string // the whole card links there
}) {
  return (
    <Card
      size="sm"
      className={cn(
        href && "relative transition-colors has-[a:hover]:bg-muted/50"
      )}
    >
      <CardContent className="flex flex-col gap-1">
        {href ? (
          <Link
            href={href}
            className="text-muted-foreground after:absolute after:inset-0"
          >
            {label}
          </Link>
        ) : (
          <span className="text-muted-foreground">{label}</span>
        )}
        <span className="flex items-baseline gap-1.5">
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
          {unit && <span className="text-muted-foreground">{unit}</span>}
        </span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </CardContent>
    </Card>
  )
}

export function PageHeader({
  crumbs,
  updated,
}: {
  crumbs: [string, string?][]
  updated?: number | null
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mr-1 data-vertical:h-4 data-vertical:self-auto"
      />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          {crumbs.map(([label, href], i) => (
            <Fragment key={label}>
              {i > 0 && <BreadcrumbSeparator className="hidden sm:block" />}
              <BreadcrumbItem
                className={
                  i < crumbs.length - 1 ? "hidden sm:inline-flex" : "min-w-0"
                }
              >
                {href ? (
                  <BreadcrumbLink render={<Link href={href} />}>
                    {label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate">{label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {updated != null && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtTime(updated)} 更新
        </span>
      )}
    </header>
  )
}

/** The loading.tsx fallback: shown at once while a page's data loads. The header keeps the
 * sidebar button; a bar runs along under it. */
export function PageSkeleton() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-1 data-vertical:h-4 data-vertical:self-auto"
        />
        <Skeleton className="h-4 w-28 rounded-full" />
      </header>
      <div
        role="progressbar"
        aria-label="加载中"
        className="relative -mt-px h-0.5 overflow-hidden"
      >
        <i className="absolute inset-y-0 w-1/3 animate-loading-bar rounded-full bg-primary motion-reduce:animate-none" />
      </div>
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
        <Skeleton className="h-44" />
      </div>
    </>
  )
}

export function PageTitle({
  title,
  children,
  aside,
}: {
  title: React.ReactNode
  children?: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold">
          {title}
        </h1>
        {children && (
          <p className="text-sm text-muted-foreground">{children}</p>
        )}
      </div>
      {aside}
    </div>
  )
}

/** Proportional bar with a legend, e.g. 状态分布 or the three steps of a round; a part with an
 * href links there from both its segment and its legend entry. */
export function Segments({
  parts,
}: {
  parts: {
    label: string
    value: number
    className: string
    text?: string
    href?: string
  }[]
}) {
  const shown = parts.filter((p) => p.value > 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {shown.map((p) =>
          p.href ? (
            <Link
              key={p.label}
              href={p.href}
              aria-label={p.text ?? `${p.label} ${p.value}`}
              className={cn(p.className, "transition-opacity hover:opacity-75")}
              style={{ flexGrow: p.value }}
            />
          ) : (
            <i
              key={p.label}
              className={p.className}
              style={{ flexGrow: p.value }}
            />
          )
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => {
          const body = (
            <>
              <i className={cn("size-2 rounded-full", p.className)} />
              {p.text ?? `${p.label} ${p.value}`}
            </>
          )
          return p.href ? (
            <Link
              key={p.label}
              href={p.href}
              className="inline-flex items-center gap-1.5 hover:text-foreground hover:underline"
            >
              {body}
            </Link>
          ) : (
            <span key={p.label} className="inline-flex items-center gap-1.5">
              {body}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** The three steps of a round, as an ordinal ramp of the theme's blues: the first step has the most
 * contrast with the card. Checked with the dataviz validator for both themes (the theme's lightest
 * blue is too faint on white, its darkest too faint on the dark card). */
export const STAGES = [
  {
    key: "crawl_ms",
    label: "抓取",
    light: "var(--chart-5)",
    dark: "var(--chart-1)",
    className: "bg-chart-5 dark:bg-chart-1",
  },
  {
    key: "etl_ms",
    label: "清洗",
    light: "var(--chart-4)",
    dark: "var(--chart-2)",
    className: "bg-chart-4 dark:bg-chart-2",
  },
  {
    key: "embed_ms",
    label: "向量化",
    light: "var(--chart-2)",
    dark: "var(--chart-4)",
    className: "bg-chart-2 dark:bg-chart-4",
  },
] as const

/** Ranked rows with a proportional bar, each a link, e.g. the slowest sources of a round. */
export function BarList({
  rows,
  format,
}: {
  rows: {
    key: string
    label: string
    value: number
    href: string
    note?: string
  }[]
  format: (v: number) => string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ol className="flex flex-col">
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            href={r.href}
            className="-mx-2 grid h-8 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 hover:bg-muted"
          >
            <span className="truncate">{r.label}</span>
            <i
              className="h-2 min-w-1 rounded-r-[4px] bg-chart-3"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {format(r.value)}
              {r.note && ` · ${r.note}`}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}

const tally = (runs: Pick<Run, "status">[]) => ({
  ok: runs.filter((r) => r.status === "ok").length,
  error: runs.filter((r) => r.status === "error").length,
  empty: runs.filter((r) => r.status === "empty").length,
  disabled: runs.filter((r) => r.status === "disabled").length,
})

/** The four numbers of one round (概况 and 运行详情); linked on 概况, where they open the
 * matching source list or the round. */
export function RoundStats({
  round,
  runs,
  prevOk,
  linked,
}: {
  round: Round
  runs: Pick<Run, "status">[]
  prevOk?: number | null
  linked?: boolean
}) {
  const n = tally(runs)
  const at = linked ? `/runs/${round.started_at}` : undefined
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Stat
        label="写入成功"
        value={n.ok}
        unit={`/ ${round.sources}`}
        href={linked ? "/sources?f=ok" : undefined}
        note={
          prevOk == null
            ? undefined
            : n.ok === prevOk
              ? "和上一轮持平"
              : `比上一轮${n.ok > prevOk ? "多" : "少"} ${Math.abs(n.ok - prevOk)} 个`
        }
      />
      <Stat
        label="没写入"
        value={n.error + n.empty}
        unit="个源"
        href={linked ? "/sources?f=attention" : undefined}
        note={`${n.error} 个出错 · ${n.empty} 个返回空数据`}
      />
      <Stat
        label="新增标题"
        value={fmtNum(round.new_titles)}
        unit="条"
        href={at}
        note={`清洗用时 ${fmtMs(round.etl_ms)}`}
      />
      <Stat
        label="向量化"
        value={fmtNum(round.embedded)}
        unit="条"
        href={at}
        note={`失败 ${fmtNum(round.embed_failed)} · 用时 ${fmtMs(round.embed_ms)}`}
      />
    </div>
  )
}

/** Status split and step timings of one round; on 概况 (linked) the parts open the source list or
 * the round, and stack (one column) to sit beside another card. */
export function RoundParts({
  round,
  runs,
  linked,
  stack,
}: {
  round: Round
  runs: Pick<Run, "status">[]
  linked?: boolean
  stack?: boolean
}) {
  const n = tally(runs)
  const to = (href: string) => (linked ? href : undefined)
  return (
    <div className={cn("grid gap-4", !stack && "lg:grid-cols-2")}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>{runs.length} 个源</CardTitle>
          <CardDescription>这一轮的状态</CardDescription>
        </CardHeader>
        <CardContent>
          <Segments
            parts={[
              {
                label: "正常",
                value: n.ok,
                className: "bg-primary",
                href: to("/sources?f=ok"),
              },
              {
                label: "出错",
                value: n.error,
                className: "bg-destructive",
                href: to("/sources?f=attention"),
              },
              {
                label: "返回空数据",
                value: n.empty,
                className: "bg-amber-600",
                href: to("/sources?f=attention"),
              },
              {
                label: "已停用",
                value: n.disabled,
                className: "bg-muted-foreground/30",
                href: to("/sources?f=disabled"),
              },
            ]}
          />
        </CardContent>
      </Card>
      <Card size="sm">
        <CardHeader>
          <CardTitle>这一轮各阶段</CardTitle>
          <CardDescription>
            {round.error ? (
              <span className="text-destructive">{round.error}</span>
            ) : (
              "抓取 → 清洗 → 向量化"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Segments
            parts={STAGES.map((s) => ({
              label: s.label,
              value: round[s.key] ?? 0,
              className: s.className,
              text: `${s.label} ${fmtMs(round[s.key])}`,
              href: to(`/runs/${round.started_at}`),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export function RepairBadge({ state }: { state: RepairState }) {
  const tone: Partial<Record<RepairState, string>> = {
    awaiting_review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  }
  const variant =
    state === "analyzing"
      ? "default"
      : state === "needs_human" || state === "failed"
        ? "destructive"
        : state === "observing" || state === "superseded"
          ? "outline"
          : "secondary"
  return (
    <Badge variant={variant} className={tone[state]}>
      {REPAIR_STATE[state]}
    </Badge>
  )
}

const WHO: Record<string, string> = {
  system: "系统",
  agent: "AI",
  test: "测试",
}

/** What happened to a repair task, oldest first: its state changes (who and why), the run right after
 * approval and the first two rounds after the patch went live. */
export function RepairTimeline({
  repair: r,
  after = [],
}: {
  repair: Repair
  after?: Run[]
}) {
  const v = r.verify
  const events = [
    ...r.log.map((l) => ({
      ts: l.ts,
      who: WHO[l.by] ?? l.by,
      text: REPAIR_STATE[l.to] + (l.note ? `：${l.note}` : ""),
      bad: l.to === "failed" || l.to === "needs_human",
    })),
    ...(v
      ? [
          {
            ts: v.ts,
            who: "运行",
            text:
              v.status === "ok"
                ? `批准后用新代码跑了一次：${v.items} 条，已写入${v.cleaned ? "并清洗" : `，清洗出错：${v.etl_error}`}`
                : `批准后用新代码跑了一次：${v.status === "empty" ? "返回空数据" : `出错：${v.error}`}，没写入`,
            bad: v.status !== "ok",
          },
        ]
      : []),
    ...after.map((u) => ({
      ts: u.finished_at,
      who: "整点",
      text: `${fmtTime(u.round_at)} 这一轮${STATUS[u.status]}${u.items != null ? `，${u.items} 条` : ""}${u.error ? `：${u.error}` : ""}`,
      bad: u.status === "empty" || u.status === "error",
    })),
  ].sort((a, b) => a.ts - b.ts)
  return (
    <ol className="flex flex-col gap-1 text-xs">
      {events.map((e, i) => (
        <li key={i} className="flex gap-2">
          <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
            {fmtTime(e.ts)}
          </span>
          <span className="w-8 shrink-0 text-muted-foreground">{e.who}</span>
          <span
            className={cn(
              "min-w-0 [overflow-wrap:anywhere]",
              e.bad && "text-destructive"
            )}
          >
            {e.text}
          </span>
        </li>
      ))}
    </ol>
  )
}
