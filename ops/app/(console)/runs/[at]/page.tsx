import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AutoRefresh } from "@/components/ops-client"
import {
  PageHeader,
  PageTitle,
  PhaseBadge,
  RoundParts,
  RoundStats,
  StatusBadge,
} from "@/components/ops"
import {
  Card,
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
import { getRound, phase, type Run } from "@/lib/ops"
import { cn, fmtMs, fmtNum, fmtTime } from "@/lib/utils"

type Props = { params: Promise<{ at: string }> }

const load = async (params: Props["params"]) => {
  const { at } = await params
  return /^\d{1,12}$/.test(at) ? getRound(Number(at)) : null
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params)
  return { title: data ? `${fmtTime(data.round.started_at)} 这一轮` : "运行" }
}

// Failed sources first, then in the order they finished.
const rank = (r: Run) =>
  r.status === "error" || r.status === "empty" ? 0 : r.status === "ok" ? 1 : 2

export default async function RoundDetail({ params }: Props) {
  const data = await load(params)
  if (!data) notFound()
  const { round, runs } = data
  const running = phase(round).endsWith("中")
  const rows = runs.toSorted(
    (a, b) => rank(a) - rank(b) || a.finished_at - b.finished_at
  )

  return (
    <>
      <PageHeader
        crumbs={[["运维", "/"], ["运行", "/runs"], [fmtTime(round.started_at)]]}
        updated={round.finished_at}
      />
      {running && <AutoRefresh seconds={15} />}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle
          title={
            <>
              {fmtTime(round.started_at)} 这一轮
              <PhaseBadge round={round} />
            </>
          }
        >
          {round.finished_at != null
            ? `${fmtTime(round.started_at)} 开始，${fmtTime(round.finished_at)} 结束，用时 ${fmtMs((round.finished_at - round.started_at) * 1000)}。`
            : `${fmtTime(round.started_at)} 开始，${runs.filter((r) => r.status !== "disabled").length} / ${round.sources} 个源跑完。`}
        </PageTitle>
        <RoundStats round={round} runs={runs} />
        <RoundParts round={round} runs={runs} />
        <Card className="py-2">
          <CardHeader className="pt-4">
            <CardTitle>各源结果</CardTitle>
            <CardDescription>
              没写入的排在前面，其余按跑完的先后
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">源</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>条数</TableHead>
                <TableHead className="hidden sm:table-cell">耗时</TableHead>
                <TableHead className="hidden pr-4 sm:pr-6 md:table-cell">
                  说明
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.source} className="relative">
                  <TableCell className="pl-4 sm:pl-6">
                    <Link
                      href={`/sources/${r.source}`}
                      className="flex flex-col after:absolute after:inset-0"
                    >
                      <span className="font-medium">{r.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.source}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge run={r} />
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {fmtNum(r.items)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {fmtMs(r.ms)}
                  </TableCell>
                  <TableCell className="hidden w-full max-w-0 pr-4 sm:pr-6 md:table-cell">
                    <span
                      title={r.error ?? undefined}
                      className={cn(
                        "block truncate text-xs text-muted-foreground",
                        r.error && "font-mono"
                      )}
                    >
                      {r.error ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  )
}
