import type { Metadata } from "next"
import Link from "next/link"

import { AutoRefresh, LoadMore } from "@/components/ops-client"
import {
  modelLine,
  PageHeader,
  PageTitle,
  PillNav,
  RepairBadge,
  RepairTimeline,
} from "@/components/ops"
import { Card } from "@/components/ui/card"
import {
  countRepairs,
  getBoard,
  getRepairLog,
  getRunsAfter,
  getT,
  type RepairState,
} from "@/lib/ops"
import { listSize } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("AI repair", "AI 修复") }
}

const STEP = 30
const FILTERS = {
  all: [["All", "全部"], null],
  open: [
    ["In progress", "进行中"],
    ["analyzing", "awaiting_review", "observing"],
  ],
  human: [
    ["Needs a human", "要人处理"],
    ["needs_human", "handed_off", "failed"],
  ],
  done: [
    ["Closed", "已结束"],
    ["resolved", "superseded", "rejected", "reverted"],
  ],
} as const satisfies Record<
  string,
  readonly [readonly [string, string], RepairState[] | null]
>
type Filter = keyof typeof FILTERS

export default async function Repairs({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; n?: string }>
}) {
  const query = await searchParams
  const t = await getT()
  const filter: Filter =
    query.f && query.f in FILTERS ? (query.f as Filter) : "all"
  const n = listSize(query.n, STEP, 600)
  const states = FILTERS[filter][1]
  const [{ sources }, page, counts] = await Promise.all([
    getBoard(),
    getRepairLog(states && [...states], n + 1),
    countRepairs(),
  ])
  const repairs = page.slice(0, n)
  const after = await getRunsAfter(repairs)
  const count = (states: readonly RepairState[] | null) =>
    counts
      .filter((c) => !states || states.includes(c.state))
      .reduce((a, c) => a + c.n, 0)
  const name = (id: string) => sources.find((s) => s.id === id)?.name ?? id
  const href = (f: Filter, size?: number) =>
    `/repairs?${new URLSearchParams({
      ...(f !== "all" && { f }),
      ...(size && { n: String(size) }),
    })}`

  return (
    <>
      <PageHeader
        crumbs={[[t("Ops", "运维"), "/"], [t("AI repair", "AI 修复")]]}
      />
      {repairs.some((r) => r.state === "analyzing") && (
        <AutoRefresh seconds={10} />
      )}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("AI repair", "AI 修复")}>
          {count(["awaiting_review"]) > 0 &&
            t(
              `${count(["awaiting_review"])} awaiting review`,
              `${count(["awaiting_review"])} 个待 review`
            )}
        </PageTitle>
        <PillNav
          items={(Object.keys(FILTERS) as Filter[]).map((f) => ({
            href: href(f),
            label: t(...FILTERS[f][0]),
            count: count(FILTERS[f][1]),
            active: filter === f,
          }))}
        />
        <Card className="gap-0 py-0">
          {repairs.map((r) => (
            <section
              key={r.id}
              className="flex flex-col gap-2.5 border-b px-4 py-4 last:border-0 sm:px-6"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <RepairBadge state={r.state} />
                <Link
                  href={`/sources/${r.source}`}
                  className="font-medium hover:underline"
                >
                  {name(r.source)}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {[`#${r.id}`, r.reason, r.model && modelLine(t, r)]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {t.time(r.updated_at)}
                </span>
              </div>
              {r.summary && r.summary !== r.log[0]?.note && (
                <p className="text-sm leading-relaxed">{r.summary}</p>
              )}
              <RepairTimeline repair={r} after={after.get(r.id)} />
            </section>
          ))}
          {!repairs.length && (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              {t("No repair task matches", "没有符合条件的修复任务")}
            </p>
          )}
          {page.length > n && (
            <LoadMore href={href(filter, n + STEP)}>
              {t(
                `${STEP} more (${n} shown)`,
                `再看 ${STEP} 个（已显示 ${n} 个）`
              )}
            </LoadMore>
          )}
        </Card>
      </div>
    </>
  )
}
