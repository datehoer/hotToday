import type { Metadata } from "next"
import Link from "next/link"

import { AutoRefresh, LoadMore } from "@/components/ops-client"
import { PageHeader, PageTitle, PhaseBadge } from "@/components/ops"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getBoard, getRounds } from "@/lib/ops"
import { cn, fmtMs, fmtNum, fmtTime, listSize } from "@/lib/utils"

export const metadata: Metadata = { title: "运行" }

const STEP = 48 // two days; ops.round keeps 30 days

export default async function Runs({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>
}) {
  const n = listSize((await searchParams).n, STEP, 30 * 24)
  const [{ latest, running }, page] = await Promise.all([
    getBoard(),
    getRounds(n + 1),
  ])
  const rounds = page.slice(0, n)
  const took = rounds
    .filter((r) => r.finished_at != null)
    .map((r) => r.finished_at! - r.started_at)
  const avg = took.length ? took.reduce((a, b) => a + b, 0) / took.length : null

  return (
    <>
      <PageHeader
        crumbs={[["运维", "/"], ["运行"]]}
        updated={latest?.finished_at}
      />
      {running && <AutoRefresh seconds={15} />}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="运行">
          每小时整点一轮：抓取 → 清洗 → 向量化。
          {avg != null &&
            `最近 ${took.length} 轮平均用时 ${fmtMs(avg * 1000)}。`}
        </PageTitle>
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">开始</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="hidden sm:table-cell">写入成功</TableHead>
                <TableHead className="pr-4 sm:pr-3">没写入</TableHead>
                <TableHead className="hidden lg:table-cell">抓取</TableHead>
                <TableHead className="hidden lg:table-cell">清洗</TableHead>
                <TableHead className="hidden lg:table-cell">向量化</TableHead>
                <TableHead className="hidden md:table-cell">新增标题</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell sm:pr-6">
                  用时
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.map((r) => (
                <TableRow key={r.started_at} className="relative">
                  <TableCell className="pl-4 font-medium tabular-nums sm:pl-6">
                    <Link
                      href={`/runs/${r.started_at}`}
                      className="after:absolute after:inset-0"
                    >
                      {fmtTime(r.started_at)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <PhaseBadge round={r} />
                  </TableCell>
                  <TableCell className="hidden tabular-nums sm:table-cell">
                    {r.ok}{" "}
                    <span className="text-muted-foreground">/ {r.sources}</span>
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 tabular-nums sm:pr-3",
                      r.failed > 0 && "text-destructive"
                    )}
                  >
                    {r.failed}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {fmtMs(r.crawl_ms)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {fmtMs(r.etl_ms)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {fmtMs(r.embed_ms)}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {fmtNum(r.new_titles)}
                  </TableCell>
                  <TableCell className="hidden pr-4 tabular-nums sm:table-cell sm:pr-6">
                    {r.finished_at != null
                      ? fmtMs((r.finished_at - r.started_at) * 1000)
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!rounds.length && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="py-10 text-center text-muted-foreground"
                  >
                    还没有运行记录
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {page.length > n && (
            <LoadMore href={`/runs?n=${n + STEP}`}>
              再看 {STEP} 轮（已显示 {n} 轮）
            </LoadMore>
          )}
        </Card>
      </div>
    </>
  )
}
