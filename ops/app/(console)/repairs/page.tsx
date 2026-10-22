import type { Metadata } from "next"
import Link from "next/link"

import { AutoRefresh, LoadMore } from "@/components/ops-client"
import {
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
  type RepairState,
} from "@/lib/ops"
import { fmtNum, fmtTime, listSize } from "@/lib/utils"

export const metadata: Metadata = { title: "AI 修复" }

const STEP = 30
const FILTERS = {
  all: ["全部", null],
  open: ["进行中", ["analyzing", "awaiting_review", "observing"]],
  human: ["要人处理", ["needs_human", "handed_off", "failed"]],
  done: ["已结束", ["resolved", "superseded", "rejected", "reverted"]],
} as const satisfies Record<string, readonly [string, RepairState[] | null]>
type Filter = keyof typeof FILTERS

export default async function Repairs({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; n?: string }>
}) {
  const query = await searchParams
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
      <PageHeader crumbs={[["运维", "/"], ["AI 修复"]]} />
      {repairs.some((r) => r.state === "analyzing") && (
        <AutoRefresh seconds={10} />
      )}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="AI 修复">
          每个修复任务的经过，最近有变化的在前：谁开的、诊断、批准后用新代码跑的那一次，和补丁上线后的两轮。
          {count(["awaiting_review"]) > 0 &&
            `${count(["awaiting_review"])} 个待 review。`}
        </PageTitle>
        <PillNav
          items={(Object.keys(FILTERS) as Filter[]).map((f) => ({
            href: href(f),
            label: FILTERS[f][0],
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
                  {[
                    `#${r.id}`,
                    r.reason,
                    r.model &&
                      `${r.model} · ${fmtNum(r.tokens)} tokens · 补丁 ${r.attempts} 次`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {fmtTime(r.updated_at)}
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
              没有符合条件的修复任务
            </p>
          )}
          {page.length > n && (
            <LoadMore href={href(filter, n + STEP)}>
              再看 {STEP} 个（已显示 {n} 个）
            </LoadMore>
          )}
        </Card>
      </div>
    </>
  )
}
