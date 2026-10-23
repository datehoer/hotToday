import { RiSearchLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  PageHeader,
  PageTitle,
  PillNav,
  SourceStatus,
  Spark,
} from "@/components/ops"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { failing, fixed, getBoard, getT, HISTORY, type Source } from "@/lib/ops"
import { cn, fmtNum } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("Sources", "源") }
}

const FILTERS = {
  all: [["All", "全部"], () => true],
  attention: [
    ["Needs attention", "需要处理"],
    (s: Source) => failing(s) || s.low,
  ],
  ok: [
    ["OK", "正常"],
    (s: Source) => (s.run.status === "ok" || !!fixed(s)) && !s.low,
  ],
  disabled: [
    ["Disabled", "已停用"],
    (s: Source) => s.run.status === "disabled",
  ],
} as const
type Filter = keyof typeof FILTERS
const rank = (s: Source) =>
  failing(s) ? 0 : s.low ? 1 : s.run.status === "disabled" ? 3 : 2

export default async function Sources({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>
}) {
  const { f, q = "" } = await searchParams
  const t = await getT()
  const filter: Filter = f && f in FILTERS ? (f as Filter) : "all"
  const { latest, sources } = await getBoard()
  const needle = q.trim().toLowerCase()
  const rows = sources
    .filter(FILTERS[filter][1])
    .filter(
      (s) =>
        !needle ||
        s.name.toLowerCase().includes(needle) ||
        s.id.includes(needle)
    )
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (a.lastOk ?? 0) - (b.lastOk ?? 0) ||
        a.run.finished_at - b.run.finished_at
    )

  return (
    <>
      <PageHeader
        crumbs={[[t("Ops", "运维"), "/"], [t("Sources", "源")]]}
        updated={latest?.finished_at}
      />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("Sources", "源")} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillNav
            items={(Object.keys(FILTERS) as Filter[]).map((key) => ({
              href: {
                pathname: "/sources",
                query: { ...(key !== "all" && { f: key }), ...(q && { q }) },
              },
              label: t(...FILTERS[key][0]),
              count: sources.filter(FILTERS[key][1]).length,
              active: filter === key,
            }))}
          />
          <form action="/sources" className="relative w-full sm:w-72">
            {filter !== "all" && (
              <input type="hidden" name="f" value={filter} />
            )}
            <RiSearchLine className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q}
              placeholder={t("Search by name or table", "搜索名称或表名")}
              className="h-9 w-full rounded-3xl border border-transparent bg-input/50 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </form>
        </div>
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">
                  {t("Source", "源")}
                </TableHead>
                <TableHead>{t("Status", "状态")}</TableHead>
                <TableHead className="hidden md:table-cell">
                  {t(`Last ${HISTORY} rounds`, `最近 ${HISTORY} 轮`)}
                </TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("Items", "本轮条数")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("Usually", "平时")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("Took", "耗时")}
                </TableHead>
                <TableHead className="pr-4 sm:pr-6">
                  {t("Last write", "最近写入")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} className="relative">
                  <TableCell className="pl-4 sm:pl-6">
                    <Link
                      href={`/sources/${s.id}`}
                      className="flex flex-col after:absolute after:inset-0"
                    >
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.id}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <SourceStatus source={s} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {s.run.status !== "disabled" && (
                      <Spark history={s.history} />
                    )}
                  </TableCell>
                  <TableCell className="hidden font-medium tabular-nums sm:table-cell">
                    {s.run.status === "disabled" ? "—" : fmtNum(s.run.items)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {fmtNum(s.usual)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {t.ms(s.run.ms)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 tabular-nums sm:pr-6",
                      failing(s) ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {s.lastOk ? t.time(s.lastOk) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {t("No source matches", "没有符合条件的源")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
