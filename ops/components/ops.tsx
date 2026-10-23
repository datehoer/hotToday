import { RiCheckLine, RiCloseLine } from "@remixicon/react"
import Link from "next/link"
import { Fragment } from "react"

import { LinkPending, LoadingBar } from "@/components/ops-client"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { count, type Translate } from "@/lib/i18n"
import {
  fixed,
  getT,
  OPEN_REPAIR,
  phase,
  PHASE,
  REPAIR_STATE,
  type Check,
  type Repair,
  type RepairState,
  type Round,
  type Run,
  type Source,
  type Status,
} from "@/lib/ops"
import { cn, fmtNum } from "@/lib/utils"

export const STATUS: Record<Status, [string, string]> = {
  ok: ["OK", "正常"],
  empty: ["Empty response", "返回空数据"],
  error: ["Error", "出错"],
  disabled: ["Disabled", "已停用"],
}

export async function StatusBadge({
  run,
  low,
}: {
  run: Pick<Run, "status">
  low?: boolean
}) {
  const t = await getT()
  if (low)
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
        {t("Low count", "条数偏低")}
      </Badge>
    )
  if (run.status === "ok")
    return <Badge variant="outline">{t(...STATUS.ok)}</Badge>
  if (run.status === "disabled")
    return <Badge variant="secondary">{t(...STATUS.disabled)}</Badge>
  return <Badge variant="destructive">{t(...STATUS[run.status])}</Badge>
}

/** A source's status in the list and on its page: the latest round's, or OK after approval when an approved
 * patch wrote data since; an open AI repair task shows beside it. */
export async function SourceStatus({ source: s }: { source: Source }) {
  const t = await getT()
  const v = fixed(s)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {v ? (
        <Badge
          className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
          title={t(
            `The run right after approval at ${t.time(v.ts)}; the hourly round hasn't run the new code yet`,
            `${t.time(v.ts)} 批准后立即跑的那一次；整点那轮还没跑新代码`
          )}
        >
          {t(
            `OK after approval · ${count(v.items ?? 0, "item")}`,
            `批准后正常 · ${v.items} 条`
          )}
        </Badge>
      ) : (
        <StatusBadge run={s.run} low={s.low} />
      )}
      {s.repair && !v && OPEN_REPAIR.includes(s.repair.state) && (
        <RepairBadge state={s.repair.state} />
      )}
    </span>
  )
}

export async function PhaseBadge({ round }: { round: Round }) {
  const t = await getT()
  const p = phase(round)
  if (p === "unfinished")
    return <Badge variant="destructive">{t(...PHASE[p])}</Badge>
  if (p !== "done") return <Badge>{t(...PHASE[p])}</Badge>
  return round.error ? (
    <Badge variant="destructive" title={round.error}>
      {t("Has errors", "有错误")}
    </Badge>
  ) : (
    <Badge variant="outline">{t(...PHASE.done)}</Badge>
  )
}

/** One bar per round, oldest first: blue wrote data, red wrote nothing, grey no record. */
export async function Spark({ history }: { history: (Run | null)[] }) {
  const t = await getT()
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {history.map((h, i) => (
        <i
          key={i}
          title={
            h
              ? `${t.time(h.round_at)} ${t(...STATUS[h.status])}${
                  h.items != null
                    ? t(` · ${count(h.items, "item")}`, ` · ${h.items} 条`)
                    : ""
                }`
              : t("no record", "没有记录")
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
    <nav className="inline-flex h-9 w-fit items-center rounded-3xl bg-muted p-1 text-sm">
      {items.map((it) => (
        <Link
          key={it.label}
          href={it.href}
          scroll={false}
          data-active={it.active || undefined}
          className="inline-flex h-full items-center gap-1.5 rounded-lg px-3 font-medium text-foreground/60 transition-colors hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm"
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

export async function PageHeader({
  crumbs,
  updated,
}: {
  crumbs: [string, string?][]
  updated?: number | null
}) {
  const t = await getT()
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
          {t(`Updated ${t.time(updated)}`, `${t.time(updated)} 更新`)}
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
      <LoadingBar />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-4xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-4xl" />
        <Skeleton className="h-44 rounded-4xl" />
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
    label: ["Crawl", "抓取"],
    light: "var(--chart-5)",
    dark: "var(--chart-1)",
    className: "bg-chart-5 dark:bg-chart-1",
  },
  {
    key: "etl_ms",
    label: ["Clean", "清洗"],
    light: "var(--chart-4)",
    dark: "var(--chart-2)",
    className: "bg-chart-4 dark:bg-chart-2",
  },
  {
    key: "embed_ms",
    label: ["Embed", "向量化"],
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
            className="-mx-2 grid h-8 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-2 hover:bg-muted"
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

/** The four numbers of one round (overview and round detail); linked on the overview, where they
 * open the matching source list or the round. */
export async function RoundStats({
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
  const t = await getT()
  const n = tally(runs)
  const at = linked ? `/runs/${round.started_at}` : undefined
  const diff = prevOk == null ? 0 : Math.abs(n.ok - prevOk)
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Stat
        label={t("Wrote data", "写入成功")}
        value={n.ok}
        unit={`/ ${round.sources}`}
        href={linked ? "/sources?f=ok" : undefined}
        note={
          prevOk == null
            ? undefined
            : n.ok === prevOk
              ? t("same as the round before", "和上一轮持平")
              : n.ok > prevOk
                ? t(
                    `${diff} more than the round before`,
                    `比上一轮多 ${diff} 个`
                  )
                : t(
                    `${diff} fewer than the round before`,
                    `比上一轮少 ${diff} 个`
                  )
        }
      />
      <Stat
        label={t("Wrote nothing", "没写入")}
        value={n.error + n.empty}
        unit={t(n.error + n.empty === 1 ? "source" : "sources", "个源")}
        href={linked ? "/sources?f=attention" : undefined}
        note={t(
          `${count(n.error, "error")} · ${n.empty} empty`,
          `${n.error} 个出错 · ${n.empty} 个返回空数据`
        )}
      />
      <Stat
        label={t("New titles", "新增标题")}
        value={fmtNum(round.new_titles)}
        unit={t("", "条")}
        href={at}
      />
      <Stat
        label={t("Embedded", "向量化")}
        value={fmtNum(round.embedded)}
        unit={t("", "条")}
        href={at}
        note={t(
          `${fmtNum(round.embed_failed)} failed`,
          `失败 ${fmtNum(round.embed_failed)}`
        )}
      />
    </div>
  )
}

/** Status split and step timings of one round; on the overview (linked) the parts open the source
 * list or the round, and stack (one column) to sit beside another card. */
export async function RoundParts({
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
  const t = await getT()
  const n = tally(runs)
  const to = (href: string) => (linked ? href : undefined)
  const total = STAGES.every((s) => round[s.key] != null)
    ? STAGES.reduce((sum, s) => sum + round[s.key]!, 0)
    : null
  return (
    <div className={cn("grid gap-4", !stack && "lg:grid-cols-2")}>
      <Card size="sm">
        <CardHeader>
          <CardTitle>
            {t(count(runs.length, "source"), `${runs.length} 个源`)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Segments
            parts={[
              {
                label: t(...STATUS.ok),
                value: n.ok,
                className: "bg-primary",
                href: to("/sources?f=ok"),
              },
              {
                label: t(...STATUS.error),
                value: n.error,
                className: "bg-destructive",
                href: to("/sources?f=attention"),
              },
              {
                label: t(...STATUS.empty),
                value: n.empty,
                className: "bg-amber-600",
                href: to("/sources?f=attention"),
              },
              {
                label: t(...STATUS.disabled),
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
          <CardTitle>
            {t("Steps in this round", "这一轮各阶段")}
            {total != null && ` · ${t.ms(total)}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {round.error && (
            <p className="[overflow-wrap:anywhere] text-destructive">
              {round.error}
            </p>
          )}
          <Segments
            parts={STAGES.map((s) => ({
              label: t(...s.label),
              value: round[s.key] ?? 0,
              className: s.className,
              text: `${t(...s.label)} ${t.ms(round[s.key])}`,
              href: to(`/runs/${round.started_at}`),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  )
}

export async function RepairBadge({ state }: { state: RepairState }) {
  const t = await getT()
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
      {t(...REPAIR_STATE[state])}
    </Badge>
  )
}

/** "deepseek-v4-pro · 61,204 tokens · 2 patches" */
export const modelLine = (
  t: Translate,
  r: Pick<Repair, "model" | "tokens" | "attempts">
) =>
  t(
    `${r.model} · ${fmtNum(r.tokens)} tokens · ${count(r.attempts, "patch", "patches")}`,
    `${r.model} · ${fmtNum(r.tokens)} tokens · 补丁 ${r.attempts} 次`
  )

const WHO: Record<string, [string, string]> = {
  system: ["System", "系统"],
  agent: ["AI", "AI"],
  test: ["Test", "测试"],
}

/** What happened to a repair task, oldest first: its state changes (who and why), the run right after
 * approval and the first two rounds after the patch went live. Notes are repair.py's, in Chinese. */
export async function RepairTimeline({
  repair: r,
  after = [],
}: {
  repair: Repair
  after?: Run[]
}) {
  const t = await getT()
  const v = r.verify
  const events = [
    ...r.log.map((l) => ({
      ts: l.ts,
      who: WHO[l.by] ? t(...WHO[l.by]) : l.by,
      text:
        t(...REPAIR_STATE[l.to]) +
        (l.note ? t(`: ${l.note}`, `：${l.note}`) : ""),
      bad: l.to === "failed" || l.to === "needs_human",
    })),
    ...(v
      ? [
          {
            ts: v.ts,
            who: t("Run", "运行"),
            text:
              v.status === "ok"
                ? t(
                    `Ran once with the new code after approval: ${count(v.items ?? 0, "item")}, written${v.cleaned ? " and cleaned" : `; cleaning failed: ${v.etl_error}`}`,
                    `批准后用新代码跑了一次：${v.items} 条，已写入${v.cleaned ? "并清洗" : `，清洗出错：${v.etl_error}`}`
                  )
                : t(
                    `Ran once with the new code after approval: ${v.status === "empty" ? "empty response" : `error: ${v.error}`}; nothing written`,
                    `批准后用新代码跑了一次：${v.status === "empty" ? "返回空数据" : `出错：${v.error}`}，没写入`
                  ),
            bad: v.status !== "ok",
          },
        ]
      : []),
    ...after.map((u) => ({
      ts: u.finished_at,
      who: t("Round", "整点"),
      text: t(
        `${t.time(u.round_at)} round: ${STATUS[u.status][0].toLowerCase()}${u.items != null ? `, ${count(u.items, "item")}` : ""}${u.error ? `: ${u.error}` : ""}`,
        `${t.time(u.round_at)} 这一轮${STATUS[u.status][1]}${u.items != null ? `，${u.items} 条` : ""}${u.error ? `：${u.error}` : ""}`
      ),
      bad: u.status === "empty" || u.status === "error",
    })),
  ].sort((a, b) => a.ts - b.ts)
  return (
    <ol className="flex flex-col gap-1 text-xs">
      {events.map((e, i) => (
        <li key={i} className="flex gap-2">
          <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
            {t.time(e.ts)}
          </span>
          <span
            className={cn("shrink-0 text-muted-foreground", t("w-12", "w-8"))}
          >
            {e.who}
          </span>
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

/** A patch's checks, as repair.py wrote them (in Chinese). */
export function Checks({ checks }: { checks: Check[] }) {
  return (
    <ul className="flex flex-col gap-1.5">
      {checks.map((c) => (
        <li key={c.name} className="flex items-start gap-2">
          {c.ok ? (
            <RiCheckLine className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          ) : (
            <RiCloseLine className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span className="shrink-0 font-medium">{c.name}</span>
          <span className="break-all text-muted-foreground">{c.note}</span>
        </li>
      ))}
    </ul>
  )
}

/** A patch's crawl in the sandbox: the result and the first five titles. */
export async function DryRun({ run }: { run: NonNullable<Repair["dry_run"]> }) {
  const t = await getT()
  const link = (u: string | null) => (u && /^https?:\/\//.test(u) ? u : null)
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium">
        {t("Sandbox crawl: ", "沙箱试抓：")}
        {run.status}
        {run.items != null &&
          t(
            `, ${count(run.items, "item")} extracted`,
            `，提取到 ${run.items} 条`
          )}
        {run.ms != null && t(", ", "，") + t.ms(run.ms)}
      </span>
      {run.error && (
        <span className="font-mono text-xs break-all text-muted-foreground">
          {run.error}
        </span>
      )}
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
        {run.sample?.slice(0, 5).map(([title, url], i) => (
          <li key={i}>
            {link(url) ? (
              <a
                href={link(url)!}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {title}
              </a>
            ) : (
              title
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** A unified diff, collapsible: added lines green, removed ones red. */
export async function PatchDiff({
  diff,
  open,
}: {
  diff: string
  open?: boolean
}) {
  const t = await getT()
  return (
    <details open={open} className="group">
      <summary className="cursor-pointer font-medium">
        {t("Patch", "补丁")}
      </summary>
      <pre className="mt-2 max-h-[480px] w-0 min-w-full overflow-auto rounded-in-card bg-muted/50 p-3 font-mono text-xs leading-5">
        <span className="block w-max min-w-full">
          {diff.split("\n").map((line, i) => (
            <span
              key={i}
              className={cn(
                "block",
                /^\+(?!\+\+)/.test(line) &&
                  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                /^-(?!--)/.test(line) && "bg-destructive/10 text-destructive",
                line.startsWith("@@") && "text-muted-foreground"
              )}
            >
              {line || " "}
            </span>
          ))}
        </span>
      </pre>
    </details>
  )
}
