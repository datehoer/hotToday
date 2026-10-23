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
import { getBoard, getRounds, getT } from "@/lib/ops"
import { cn, fmtNum, listSize } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("Rounds", "运行") }
}

const STEP = 48 // two days; ops.round keeps 30 days

export default async function Runs({
  searchParams,
}: {
  searchParams: Promise<{ n?: string }>
}) {
  const n = listSize((await searchParams).n, STEP, 30 * 24)
  const t = await getT()
  const [{ latest, running }, page] = await Promise.all([
    getBoard(),
    getRounds(n + 1),
  ])
  const rounds = page.slice(0, n)

  return (
    <>
      <PageHeader
        crumbs={[[t("Ops", "运维"), "/"], [t("Rounds", "运行")]]}
        updated={latest?.finished_at}
      />
      {running && <AutoRefresh seconds={15} />}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("Rounds", "运行")} />
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">
                  {t("Started", "开始")}
                </TableHead>
                <TableHead>{t("Status", "状态")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("Wrote data", "写入成功")}
                </TableHead>
                <TableHead className="pr-4 sm:pr-3">
                  {t("Nothing", "没写入")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("Crawl", "抓取")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("Clean", "清洗")}
                </TableHead>
                <TableHead className="hidden lg:table-cell">
                  {t("Embed", "向量化")}
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  {t("New titles", "新增标题")}
                </TableHead>
                <TableHead className="hidden pr-4 sm:table-cell sm:pr-6">
                  {t("Took", "用时")}
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
                      {t.time(r.started_at)}
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
                    {t.ms(r.crawl_ms)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {t.ms(r.etl_ms)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums lg:table-cell">
                    {t.ms(r.embed_ms)}
                  </TableCell>
                  <TableCell className="hidden tabular-nums md:table-cell">
                    {fmtNum(r.new_titles)}
                  </TableCell>
                  <TableCell className="hidden pr-4 tabular-nums sm:table-cell sm:pr-6">
                    {r.finished_at != null
                      ? t.ms((r.finished_at - r.started_at) * 1000)
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
                    {t("No rounds recorded yet", "还没有运行记录")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {page.length > n && (
            <LoadMore href={`/runs?n=${n + STEP}`}>
              {t(
                `${STEP} more rounds (${n} shown)`,
                `再看 ${STEP} 轮（已显示 ${n} 轮）`
              )}
            </LoadMore>
          )}
        </Card>
      </div>
    </>
  )
}
