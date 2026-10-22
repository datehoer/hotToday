import { RiSearchLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  PageHeader,
  PageTitle,
  PillNav,
  Spark,
  StatusBadge,
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
import { getBoard, type Source } from "@/lib/ops"
import { cn, fmtMs, fmtNum, fmtTime } from "@/lib/utils"

export const metadata: Metadata = { title: "源" }

const bad = (s: Source) => s.run.status === "empty" || s.run.status === "error"
const FILTERS = {
  all: ["全部", () => true],
  attention: ["需要处理", (s: Source) => bad(s) || s.low],
  ok: ["正常", (s: Source) => s.run.status === "ok" && !s.low],
  disabled: ["已停用", (s: Source) => s.run.status === "disabled"],
} as const
type Filter = keyof typeof FILTERS
const rank = (s: Source) =>
  bad(s) ? 0 : s.low ? 1 : s.run.status === "disabled" ? 3 : 2

export default async function Sources({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>
}) {
  const { f, q = "" } = await searchParams
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
  const enabled = sources.filter((s) => s.run.status !== "disabled").length

  return (
    <>
      <PageHeader
        crumbs={[["运维", "/"], ["源"]]}
        updated={latest?.finished_at}
      />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="源">
          {sources.length} 个源：{enabled} 个每小时抓一次，
          {sources.length - enabled} 个已停用
        </PageTitle>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PillNav
            items={(Object.keys(FILTERS) as Filter[]).map((key) => ({
              href: {
                pathname: "/sources",
                query: { ...(key !== "all" && { f: key }), ...(q && { q }) },
              },
              label: FILTERS[key][0],
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
              placeholder="搜索名称或表名"
              className="h-9 w-full rounded-full border border-transparent bg-input/50 pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </form>
        </div>
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden md:table-cell">
                  最近 24 轮
                </TableHead>
                <TableHead className="hidden sm:table-cell">本轮条数</TableHead>
                <TableHead className="hidden lg:table-cell">平时</TableHead>
                <TableHead className="hidden lg:table-cell">耗时</TableHead>
                <TableHead className="pr-4 sm:pr-6">最近写入</TableHead>
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
                    <StatusBadge run={s.run} low={s.low} />
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
                    {fmtMs(s.run.ms)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 tabular-nums sm:pr-6",
                      bad(s) ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {s.lastOk ? fmtTime(s.lastOk) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!rows.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-10 text-center text-muted-foreground"
                  >
                    没有符合条件的源
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
