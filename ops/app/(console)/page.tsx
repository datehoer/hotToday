import {
  RiArrowRightSLine,
  RiCloseCircleLine,
  RiInbox2Line,
  RiPlugLine,
  RiRobot2Line,
  RiTimeLine,
} from "@remixicon/react"
import Link from "next/link"

import { AutoRefresh, RoundBars, StackBars } from "@/components/ops-client"
import {
  BarList,
  PageHeader,
  PageTitle,
  RoundParts,
  RoundStats,
  STAGES,
} from "@/components/ops"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { count, type Translate } from "@/lib/i18n"
import {
  cause,
  CAUSE,
  getActiveRepairs,
  getBoard,
  getT,
  phase,
  PHASE,
  REPAIR_STATE,
  type Cause,
  type Repair,
  type Source,
} from "@/lib/ops"
import { fmtHour } from "@/lib/utils"

const ICONS: Partial<Record<Cause, typeof RiPlugLine>> = {
  proxy: RiPlugLine,
  empty: RiInbox2Line,
  timeout: RiTimeLine,
}

export default async function Overview() {
  const t = await getT()
  const { latest, running, progress, rounds, sources } = await getBoard()
  if (!latest) {
    return (
      <>
        <PageHeader crumbs={[[t("Overview", "概况")]]} />
        <p className="p-6 text-muted-foreground">
          {t(
            "No rounds recorded yet. Data shows up here after task.py's next hourly run.",
            "还没有运行记录。task.py 下一次整点运行后这里就有数据了。"
          )}
        </p>
      </>
    )
  }
  const failing = sources.filter(
    (s) => s.run.status === "empty" || s.run.status === "error"
  )
  const low = sources.filter((s) => s.low)
  // Open tasks and the ones that changed since the round before last (approved, recovered, …)
  const repairs = (
    await getActiveRepairs(rounds.at(-2)?.started_at ?? latest.started_at)
  ).filter((r) => sources.some((s) => s.id === r.source))
  // A source is "new" when it wrote data in the round before this one.
  const isNew = (s: Source) => s.history.at(-2)?.status === "ok"
  const groups = Map.groupBy(failing, (s) => cause(s.run)!)
  const round = (r: { started_at: number }) =>
    t(`${t.time(r.started_at)} round`, `${t.time(r.started_at)} 这一轮`)
  const slowest = sources
    .filter((s) => s.run.status !== "disabled" && s.run.ms != null)
    .toSorted((a, b) => b.run.ms! - a.run.ms!)
    .slice(0, 10)
  const prevOk = rounds.at(-2)
    ? sources.filter((s) => s.history.at(-2)?.status === "ok").length
    : null

  return (
    <>
      <PageHeader
        crumbs={[[t("Ops", "运维"), "/"], [t("Overview", "概况")]]}
        updated={latest.finished_at}
      />
      {running && <AutoRefresh seconds={15} />}
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("Overview", "概况")} />

        {running && (
          <Card size="sm">
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {t(
                    `${round(running)}: ${PHASE[phase(running)][0].toLowerCase()}`,
                    `${round(running)}${PHASE[phase(running)][1]}`
                  )}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {t(
                    `${progress.length} / ${running.sources} sources done, ${progress.filter((r) => r.status === "empty" || r.status === "error").length} wrote nothing`,
                    `${progress.length} / ${running.sources} 个源跑完，${progress.filter((r) => r.status === "empty" || r.status === "error").length} 个没写入`
                  )}
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
          linked
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_452px]">
          <Card>
            <CardHeader>
              <CardTitle>
                {t(
                  `Sources that wrote nothing, last ${count(rounds.length, "round")}`,
                  `最近 ${rounds.length} 轮没写入的源`
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <RoundBars
                label={t("Sources that wrote nothing", "没写入的源")}
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
                    title: round(r),
                    value,
                    tone: i === rounds.length - 1 ? "bad" : undefined,
                    href: `/runs/${r.started_at}`,
                  }
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Needs attention", "需要处理")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {failing.length === 0 && (
                <p className="text-muted-foreground">
                  {t(
                    "Every source wrote data this round",
                    "这一轮所有源都写入了"
                  )}
                </p>
              )}
              {repairs.length > 0 && (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <RiRobot2Line className="size-4 text-primary" />
                    <Link
                      href="/repairs"
                      className="flex-1 font-medium hover:underline"
                    >
                      {t("AI repair", "AI 修复")}
                    </Link>
                    {repairs.some((r) => r.state === "awaiting_review") && (
                      <Badge>
                        {t(
                          `${repairs.filter((r) => r.state === "awaiting_review").length} awaiting review`,
                          `${repairs.filter((r) => r.state === "awaiting_review").length} 个待 review`
                        )}
                      </Badge>
                    )}
                  </div>
                  {repairs.map((r) => (
                    <SourceLink
                      key={r.id}
                      s={sources.find((s) => s.id === r.source)!}
                      note={repairNote(t, r)}
                    />
                  ))}
                </div>
              )}
              {[...groups].map(([why, list], gi) => {
                const Icon = ICONS[why] ?? RiCloseCircleLine
                const where =
                  why === "proxy"
                    ? list
                        .map((s) =>
                          s.run.error?.match(/connect to (\S+) port (\d+)/)
                        )
                        .find(Boolean)
                    : null
                return (
                  <div key={why} className="flex flex-col gap-1">
                    {(gi > 0 || repairs.length > 0) && (
                      <Separator className="mb-3" />
                    )}
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-destructive" />
                      <span className="flex-1 font-medium">
                        {t(...CAUSE[why])}
                      </span>
                      <Badge variant="destructive">
                        {t(count(list.length, "source"), `${list.length} 个源`)}
                      </Badge>
                    </div>
                    {where && (
                      <Link
                        href="/status"
                        className="font-mono text-xs text-muted-foreground hover:underline"
                      >
                        {t(
                          `Proxy port ${where[2]} refused the connection · proxy status`,
                          `代理端口 ${where[2]} 拒绝连接 · 看代理状态`
                        )}
                      </Link>
                    )}
                    {list
                      .sort((a, b) => (a.lastOk ?? 0) - (b.lastOk ?? 0))
                      .map((s) => (
                        <SourceLink
                          key={s.id}
                          s={s}
                          note={
                            isNew(s)
                              ? t("since this round", "这一轮开始")
                              : t.since(s.lastOk)
                          }
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
                    <span className="flex-1 font-medium">
                      {t("Low count", "条数偏低")}
                    </span>
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      {t(count(low.length, "source"), `${low.length} 个源`)}
                    </Badge>
                  </div>
                  {low.map((s) => (
                    <SourceLink
                      key={s.id}
                      s={s}
                      note={t(
                        `${count(s.run.items ?? 0, "item")}, usually ${s.usual}`,
                        `${s.run.items} 条，平时 ${s.usual} 条`
                      )}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("New titles per round", "每轮新增标题")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RoundBars
                label={t("New titles", "新增标题")}
                fade
                data={rounds.map((r) => ({
                  key: String(r.started_at),
                  hour: fmtHour(r.started_at),
                  title: round(r),
                  value: r.new_titles ?? 0,
                  href: `/runs/${r.started_at}`,
                }))}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("Time per round", "每轮用时")}</CardTitle>
            </CardHeader>
            <CardContent>
              <StackBars
                parts={STAGES}
                data={rounds.map((r) => ({
                  key: String(r.started_at),
                  hour: fmtHour(r.started_at),
                  title: round(r),
                  href: `/runs/${r.started_at}`,
                  ...Object.fromEntries(
                    STAGES.map((s) => [s.key, r[s.key] ?? 0])
                  ),
                }))}
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card size="sm">
            <CardHeader>
              <CardTitle>
                {t(
                  `The ${slowest.length} slowest sources this round`,
                  `这一轮最慢的 ${slowest.length} 个源`
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BarList
                format={t.ms}
                rows={slowest.map((s) => ({
                  key: s.id,
                  label: s.name,
                  value: s.run.ms ?? 0,
                  href: `/sources/${s.id}`,
                  note:
                    s.run.status === "ok"
                      ? undefined
                      : t(...CAUSE[cause(s.run)!]),
                }))}
              />
            </CardContent>
          </Card>
          <RoundParts
            round={latest}
            runs={sources.map((s) => s.run)}
            linked
            stack
          />
        </div>
      </div>
    </>
  )
}

// What a task in the "needs attention" card is waiting for, or how it ended.
function repairNote(t: Translate, r: Repair) {
  if (r.state === "observing")
    return r.verify?.status === "ok"
      ? t(
          `Observing · ${count(r.verify.items ?? 0, "item")} after approval`,
          `观察中 · 批准后 ${r.verify.items} 条`
        )
      : r.verify
        ? t(
            "Observing · still nothing written after approval",
            "观察中 · 批准后还是没写入"
          )
        : t(...REPAIR_STATE.observing)
  return t(...REPAIR_STATE[r.state])
}

function SourceLink({ s, note }: { s: Source; note: string }) {
  return (
    <Link
      href={`/sources/${s.id}`}
      className="-mx-2 flex h-8 items-center gap-2 rounded-xl px-2 hover:bg-muted"
    >
      <span className="flex-1 truncate">{s.name}</span>
      <span className="text-xs text-muted-foreground tabular-nums">{note}</span>
      <RiArrowRightSLine className="size-4 text-muted-foreground" />
    </Link>
  )
}
