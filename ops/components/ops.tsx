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
import { phase, type Round, type Run } from "@/lib/ops"
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
}: {
  label: React.ReactNode
  value: React.ReactNode
  unit?: string
  note?: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <span className="text-muted-foreground">{label}</span>
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

/** Proportional bar with a legend, e.g. 状态分布 or the three steps of a round. */
export function Segments({
  parts,
}: {
  parts: { label: string; value: number; className: string; text?: string }[]
}) {
  const shown = parts.filter((p) => p.value > 0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {shown.map((p) => (
          <i
            key={p.label}
            className={p.className}
            style={{ flexGrow: p.value }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <i className={cn("size-2 rounded-full", p.className)} />
            {p.text ?? `${p.label} ${p.value}`}
          </span>
        ))}
      </div>
    </div>
  )
}

const tally = (runs: Pick<Run, "status">[]) => ({
  ok: runs.filter((r) => r.status === "ok").length,
  error: runs.filter((r) => r.status === "error").length,
  empty: runs.filter((r) => r.status === "empty").length,
  disabled: runs.filter((r) => r.status === "disabled").length,
})

/** The four numbers of one round (概况 and 运行详情). */
export function RoundStats({
  round,
  runs,
  prevOk,
}: {
  round: Round
  runs: Pick<Run, "status">[]
  prevOk?: number | null
}) {
  const n = tally(runs)
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Stat
        label="写入成功"
        value={n.ok}
        unit={`/ ${round.sources}`}
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
        note={`${n.error} 个出错 · ${n.empty} 个返回空数据`}
      />
      <Stat
        label="新增标题"
        value={fmtNum(round.new_titles)}
        unit="条"
        note={`清洗用时 ${fmtMs(round.etl_ms)}`}
      />
      <Stat
        label="向量化"
        value={fmtNum(round.embedded)}
        unit="条"
        note={`失败 ${fmtNum(round.embed_failed)} · 用时 ${fmtMs(round.embed_ms)}`}
      />
    </div>
  )
}

/** Status split and step timings of one round. */
export function RoundParts({
  round,
  runs,
}: {
  round: Round
  runs: Pick<Run, "status">[]
}) {
  const n = tally(runs)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card size="sm">
        <CardHeader>
          <CardTitle>{runs.length} 个源</CardTitle>
          <CardDescription>这一轮的状态</CardDescription>
        </CardHeader>
        <CardContent>
          <Segments
            parts={[
              { label: "正常", value: n.ok, className: "bg-primary" },
              { label: "出错", value: n.error, className: "bg-destructive" },
              {
                label: "返回空数据",
                value: n.empty,
                className: "bg-amber-600",
              },
              {
                label: "已停用",
                value: n.disabled,
                className: "bg-muted-foreground/30",
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
            parts={[
              {
                label: "抓取",
                value: round.crawl_ms ?? 0,
                className: "bg-chart-4",
                text: `抓取 ${fmtMs(round.crawl_ms)}`,
              },
              {
                label: "清洗",
                value: round.etl_ms ?? 0,
                className: "bg-chart-2",
                text: `清洗 ${fmtMs(round.etl_ms)}`,
              },
              {
                label: "向量化",
                value: round.embed_ms ?? 0,
                className: "bg-chart-1",
                text: `向量化 ${fmtMs(round.embed_ms)}`,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  )
}
