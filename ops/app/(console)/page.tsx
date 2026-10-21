import {
  RiArrowRightSLine,
  RiCloseCircleLine,
  RiInbox2Line,
  RiPlugLine,
  RiRobot2Line,
  RiTimeLine,
} from "@remixicon/react"
import Link from "next/link"

import { AutoRefresh, RoundBars } from "@/components/ops-client"
import { PageHeader, PageTitle, RoundParts, RoundStats } from "@/components/ops"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  cause,
  getBoard,
  getOpenRepairs,
  phase,
  REPAIR_STATE,
  type Source,
} from "@/lib/ops"
import { fmtHour, fmtMs, fmtSince, fmtTime } from "@/lib/utils"

const ICONS: Record<string, typeof RiPlugLine> = {
  代理连不上: RiPlugLine,
  返回空数据: RiInbox2Line,
  超时: RiTimeLine,
}

export default async function Overview() {
  const { latest, running, progress, rounds, sources } = await getBoard()
  if (!latest) {
    return (
      <>
        <PageHeader crumbs={[["概况"]]} />
        <p className="p-6 text-muted-foreground">
          还没有运行记录。task.py 下一次整点运行后这里就有数据了。
        </p>
      </>
    )
  }
  const failing = sources.filter(
    (s) => s.run.status === "empty" || s.run.status === "error"
  )
  const low = sources.filter((s) => s.low)
  const repairs = (await getOpenRepairs()).filter((r) =>
    sources.some((s) => s.id === r.source)
  )
  // A source is "new" when it wrote data in the round before this one.
  const isNew = (s: Source) => s.history.at(-2)?.status === "ok"
  const fresh = failing.filter(isNew)
  const groups = Map.groupBy(failing, (s) => cause(s.run)!)
  const prevOk = rounds.at(-2)
    ? sources.filter((s) => s.history.at(-2)?.status === "ok").length
    : null
  const total =
    latest.crawl_ms != null && latest.etl_ms != null && latest.embed_ms != null
      ? latest.crawl_ms + latest.etl_ms + latest.embed_ms
      : null

  return (
    <>
      <PageHeader
        crumbs={[["运维", "/"], ["概况"]]}
        updated={latest.finished_at}
      />
      {running && <AutoRefresh seconds={15} />}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="概况">
          {fmtTime(latest.started_at)} 这一轮{phase(latest)}
          {total != null && `，用时 ${fmtMs(total)}`}。
          {failing.length === 0
            ? "所有源都写入了。"
            : fresh.length
              ? `${failing.length} 个源没写入，其中 ${fresh.length} 个是这一轮新出现的。`
              : `${failing.length} 个源没写入，都是之前就坏的。`}
        </PageTitle>

        {running && (
          <Card size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {fmtTime(running.started_at)} 这一轮{phase(running)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {progress.length} / {running.sources} 个源跑完，
                  {
                    progress.filter(
                      (r) => r.status === "empty" || r.status === "error"
                    ).length
                  }{" "}
                  个没写入
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${(progress.length / running.sources) * 100}%`,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <RoundStats
          round={latest}
          runs={sources.map((s) => s.run)}
          prevOk={prevOk}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_452px]">
          <Card>
            <CardHeader>
              <CardTitle>最近 {rounds.length} 轮没写入的源</CardTitle>
              <CardDescription>每小时一轮，柱子越高坏的越多</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <RoundBars
                label="没写入的源"
                color="var(--destructive)"
                fade
                data={rounds.map((r, i) => {
                  const value = sources.filter(
                    (s) =>
                      s.history[i] &&
                      (s.history[i]!.status === "empty" ||
                        s.history[i]!.status === "error")
                  ).length
                  return {
                    key: String(r.started_at),
                    hour: fmtHour(r.started_at),
                    title: `${fmtTime(r.started_at)} 这一轮`,
                    value,
                    tone: i === rounds.length - 1 ? "bad" : undefined,
                  }
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>需要处理</CardTitle>
              <CardDescription>
                {failing.length
                  ? `这一轮没写入的 ${failing.length} 个源，按原因分组`
                  : "这一轮所有源都写入了"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {repairs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <RiRobot2Line className="size-4 text-primary" />
                    <span className="flex-1 font-medium">AI 修复</span>
                    <Badge>
                      {
                        repairs.filter((r) => r.state === "awaiting_review")
                          .length
                      }{" "}
                      个待 review
                    </Badge>
                  </div>
                  {repairs.map((r) => (
                    <SourceLink
                      key={r.id}
                      s={sources.find((s) => s.id === r.source)!}
                      note={REPAIR_STATE[r.state]}
                    />
                  ))}
                </div>
              )}
              {[...groups].map(([label, list], gi) => {
                const Icon = ICONS[label] ?? RiCloseCircleLine
                const where =
                  label === "代理连不上"
                    ? list
                        .map((s) =>
                          s.run.error?.match(/connect to (\S+) port (\d+)/)
                        )
                        .find(Boolean)
                    : null
                return (
                  <div key={label} className="flex flex-col gap-1">
                    {(gi > 0 || repairs.length > 0) && (
                      <Separator className="mb-3" />
                    )}
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-destructive" />
                      <span className="flex-1 font-medium">{label}</span>
                      <Badge variant="destructive">{list.length} 个源</Badge>
                    </div>
                    {where && (
                      <Link
                        href="/status"
                        className="font-mono text-xs text-muted-foreground hover:underline"
                      >{`代理端口 ${where[2]} 拒绝连接 · 看代理状态`}</Link>
                    )}
                    {list
                      .sort((a, b) => (a.lastOk ?? 0) - (b.lastOk ?? 0))
                      .map((s) => (
                        <SourceLink
                          key={s.id}
                          s={s}
                          note={isNew(s) ? "这一轮开始" : fmtSince(s.lastOk)}
                        />
                      ))}
                  </div>
                )
              })}
              {low.length > 0 && (
                <div className="flex flex-col gap-1">
                  {(groups.size > 0 || repairs.length > 0) && (
                    <Separator className="mb-3" />
                  )}
                  <div className="flex items-center gap-2">
                    <RiInbox2Line className="size-4 text-amber-600" />
                    <span className="flex-1 font-medium">条数偏低</span>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {low.length} 个源
                    </Badge>
                  </div>
                  {low.map((s) => (
                    <SourceLink
                      key={s.id}
                      s={s}
                      note={`${s.run.items} 条，平时 ${s.usual} 条`}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <RoundParts round={latest} runs={sources.map((s) => s.run)} />
      </div>
    </>
  )
}

function SourceLink({ s, note }: { s: Source; note: string }) {
  return (
    <Link
      href={`/sources/${s.id}`}
      className="-mx-2 flex h-8 items-center gap-2 rounded-lg px-2 hover:bg-muted"
    >
      <span className="flex-1 truncate">{s.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{note}</span>
      <RiArrowRightSLine className="size-4 text-muted-foreground" />
    </Link>
  )
}
