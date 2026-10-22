import {
  RiArrowRightUpLine,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiInbox2Line,
  RiPauseCircleLine,
} from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import {
  AutoRefresh,
  LoadMore,
  RepairButtons,
  RoundBars,
  type RepairOp,
} from "@/components/ops-client"
import {
  modelLine,
  PageHeader,
  PageTitle,
  RepairBadge,
  RepairTimeline,
  STATUS,
  Stat,
  StatusBadge,
} from "@/components/ops"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { count } from "@/lib/i18n"
import {
  cause,
  CAUSE,
  getRepairs,
  getRunsAfter,
  getSource,
  getSourceFiles,
  getSourceItems,
  getSourceRuns,
  getT,
  isLow,
  type Repair,
  type RepairState,
  type Run,
} from "@/lib/ops"
import { cn, daysSince, fmtHour, fmtNum, listSize } from "@/lib/utils"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ runs?: string; items?: string }>
}

const RUNS = 48 // per page; ops.run keeps 30 days
const ITEMS = 20 // fills the card, so more load only when you scroll inside it

export async function generateMetadata({
  params,
}: Pick<Props, "params">): Promise<Metadata> {
  const data = await getSource((await params).id)
  const t = await getT()
  return { title: data?.source.name ?? t("Source", "源") }
}

const failed = (r: Run | null) => r?.status === "empty" || r?.status === "error"

export default async function SourceDetail({ params, searchParams }: Props) {
  const data = await getSource((await params).id)
  if (!data) notFound()
  const { board, source: s } = data
  const t = await getT()
  const query = await searchParams
  const nRuns = listSize(query.runs, RUNS, 30 * 24)
  const nItems = listSize(query.items, ITEMS, 200)
  const [runPage, itemPage, repairs, files] = await Promise.all([
    getSourceRuns(s.id, nRuns + 1),
    getSourceItems(s.id, nItems + 1),
    getRepairs(s.id),
    getSourceFiles(s.id),
  ])
  const after = (await getRunsAfter(repairs.slice(0, 1))).get(repairs[0]?.id)
  const runs = runPage.slice(0, nRuns)
  const items = itemPage.slice(0, nItems)
  // Each list grows on its own; the other keeps its length in the link.
  const more = (key: "runs" | "items", n: number) =>
    `/sources/${s.id}?${new URLSearchParams({
      ...(nRuns > RUNS && { runs: String(nRuns) }),
      ...(nItems > ITEMS && { items: String(nItems) }),
      [key]: String(n),
    })}`
  const seen = s.history.filter(
    (h): h is Run => h != null && h.status !== "disabled"
  )
  const times = seen.map((h) => h.ms).filter((n): n is number => n != null)
  const avg = times.length
    ? times.reduce((a, b) => a + b, 0) / times.length
    : null
  const lastOkRun = runs.find((r) => r.status === "ok")
  const host = items.map((i) => URL.parse(i.url ?? "")?.host).find(Boolean)
  // Consecutive rounds that wrote nothing, counting back from this one.
  // A run right after approving a patch is newer than this round; the board catches up next round.
  const verified = repairs[0]?.verify
  const verifiedLater =
    verified && verified.ts > s.run.finished_at ? verified : null
  const streak =
    s.history.length - 1 - s.history.findLastIndex((h) => !failed(h))

  return (
    <>
      <PageHeader
        crumbs={[
          [t("Ops", "运维"), "/"],
          [t("Sources", "源"), "/sources"],
          [s.name],
        ]}
        updated={board.latest?.finished_at}
      />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle
          title={
            <>
              {s.name}
              <StatusBadge run={s.run} low={s.low} />
            </>
          }
          aside={
            host && (
              <Button
                variant="outline"
                nativeButton={false}
                render={
                  <a
                    href={`https://${host}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                {t("Open", "打开")} {host.replace(/^www\./, "")}
                <RiArrowRightUpLine data-icon="inline-end" />
              </Button>
            )
          }
        >
          <span className="font-mono">
            {s.id}
            {host && ` · ${host}`} ·{" "}
            {s.run.status === "disabled"
              ? t("disabled", "已停用")
              : t("every hour", "每小时一轮")}
          </span>
        </PageTitle>

        {failed(s.run) && (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            {s.run.status === "empty" ? (
              <RiInbox2Line />
            ) : (
              <RiErrorWarningLine />
            )}
            <AlertTitle>
              {t(
                `This round: ${CAUSE[cause(s.run)!][0].toLowerCase()}, nothing written`,
                `这一轮${CAUSE[cause(s.run)!][1]}，没写入`
              )}
            </AlertTitle>
            <AlertDescription>
              {s.run.status === "empty" ? (
                t(
                  "The request worked, but no items were parsed.",
                  "请求成功了，但没解析出条目。"
                )
              ) : (
                <span className="font-mono break-all">{s.run.error}</span>
              )}
              <br />
              {lastOkRun
                ? t(
                    `Last write ${t.time(lastOkRun.finished_at)}, ${count(lastOkRun.items ?? 0, "item")}. `,
                    `上一次写入是 ${t.time(lastOkRun.finished_at)}，${lastOkRun.items} 条。`
                  )
                : s.lastOk
                  ? t(
                      `Last write ${t.time(s.lastOk)} (${count(daysSince(s.lastOk), "day")} ago). `,
                      `上一次写入是 ${t.time(s.lastOk)}（${daysSince(s.lastOk)} 天前）。`
                    )
                  : t("No writes on record. ", "没有写入记录。")}
              {streak >= s.history.length
                ? t(
                    `Nothing written in any of the last ${count(s.history.length, "round")}.`,
                    `最近 ${s.history.length} 轮都没写入。`
                  )
                : streak > 1
                  ? t(
                      `Nothing written ${streak} rounds in a row.`,
                      `已经连续 ${streak} 轮没写入。`
                    )
                  : seen.length > 1 &&
                    t(
                      `${seen.filter((h) => h.status === "ok").length} of the ${count(seen.length - 1, "round")} before were OK.`,
                      `之前 ${seen.length - 1} 轮里 ${seen.filter((h) => h.status === "ok").length} 轮正常。`
                    )}
              {verifiedLater && (
                <>
                  <br />
                  {t(
                    `After the patch was approved at ${t.time(verifiedLater.ts)}, the new code ran once: ${verifiedLater.status === "ok" ? `${count(verifiedLater.items ?? 0, "item")}, written.` : "still nothing written."} The status here updates with the next round.`,
                    `${t.time(verifiedLater.ts)} 批准补丁后用新代码跑过一次：${verifiedLater.status === "ok" ? `${verifiedLater.items} 条，已写入。` : "还是没写入。"}这里的状态下一轮才更新。`
                  )}
                </>
              )}
            </AlertDescription>
          </Alert>
        )}
        {s.low && (
          <Alert className="border-amber-600/15 bg-amber-500/5 text-amber-700 dark:text-amber-400">
            <RiInbox2Line />
            <AlertTitle>
              {t(
                `Only ${count(s.run.items ?? 0, "item")} this round, usually ${s.usual}`,
                `这一轮只有 ${s.run.items} 条，平时 ${s.usual} 条`
              )}
            </AlertTitle>
            <AlertDescription>
              {t(
                "Written, but fewer than half the usual count: maybe only part of the page was parsed.",
                "写入了，但条数不到平时的一半，可能只解析到了一部分页面。"
              )}
            </AlertDescription>
          </Alert>
        )}
        {s.run.status === "disabled" && (
          <Alert className="bg-muted/50">
            <RiPauseCircleLine />
            <AlertTitle>{t("Disabled", "已停用")}</AlertTitle>
            <AlertDescription>
              {s.run.error ??
                t(
                  "task.py doesn't enable this source.",
                  "task.py 里没有启用这个源。"
                )}
            </AlertDescription>
          </Alert>
        )}

        {(repairs.length > 0 || failed(s.run) || s.low) && (
          <RepairCard
            source={s.id}
            repairs={repairs}
            after={after}
            broken={failed(s.run) || s.low}
          />
        )}

        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Stat
            label={t("Last write", "最近写入")}
            value={s.lastOk ? t.time(s.lastOk) : "—"}
            note={
              lastOkRun
                ? t(
                    count(lastOkRun.items ?? 0, "item"),
                    `${lastOkRun.items} 条`
                  )
                : s.lastOk
                  ? t("before the run records", "早于运行记录")
                  : t("no writes on record", "没有写入记录")
            }
          />
          <Stat
            label={t("Usual count", "平时条数")}
            value={fmtNum(s.usual)}
            note={
              s.usual == null
                ? t(
                    "fewer than 5 successes, can't tell yet",
                    "成功不到 5 次，算不出"
                  )
                : t(
                    `median of the last ${count(Math.min(20, seen.filter((h) => h.status === "ok").length), "success", "successes")}`,
                    `最近 ${Math.min(20, seen.filter((h) => h.status === "ok").length)} 次成功的中位数`
                  )
            }
          />
          <Stat
            label={t("Succeeded", "成功")}
            value={seen.filter((h) => h.status === "ok").length}
            unit={`/ ${seen.length}`}
            note={t(
              `last ${count(seen.length, "round")}`,
              `最近 ${seen.length} 轮`
            )}
          />
          <Stat
            label={t("Average time", "平均耗时")}
            value={t.ms(avg)}
            note={
              times.length
                ? t(
                    `last ${count(times.length, "round")}`,
                    `最近 ${times.length} 轮`
                  )
                : t("no timings on record", "没有耗时记录")
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_452px]">
          <Card>
            <CardHeader>
              <CardTitle>{t("Items per round", "每轮条数")}</CardTitle>
              <CardDescription>
                {t(
                  `Last ${count(board.rounds.length, "round")}: red wrote nothing, orange is a low count. Click a bar to open its round`,
                  `最近 ${board.rounds.length} 轮，红色是没写入的轮次，橙色是条数偏低；点柱子看那一轮`
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <RoundBars
                label={t("Items", "条数")}
                data={board.rounds.map((r, i) => {
                  const h = s.history[i]
                  return {
                    key: String(r.started_at),
                    hour: fmtHour(r.started_at),
                    title: `${t.time(r.started_at)} · ${h ? t(...STATUS[h.status]) : t("no record", "没有记录")}`,
                    value: h?.items ?? 0,
                    href: `/runs/${r.started_at}`,
                    tone:
                      !h || h.status === "disabled"
                        ? "muted"
                        : failed(h)
                          ? "bad"
                          : isLow(h, s.usual)
                            ? "low"
                            : undefined,
                  }
                })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("Latest items", "最近写入的条目")}</CardTitle>
              <CardDescription>
                {items.length
                  ? t(
                      `Titles after cleaning, last seen ${t.time(items[0].last_seen)}`,
                      `清洗后的标题，${t.time(items[0].last_seen)} 最后出现`
                    )
                  : t(
                      "No titles from this source in the cleaned table yet",
                      "清洗后的表里还没有这个源的标题"
                    )}
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[480px] overflow-y-auto">
              <ol className="flex flex-col gap-2.5">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="w-4 shrink-0 text-right font-medium text-muted-foreground tabular-nums">
                      {i + 1}
                    </span>
                    {it.url ? (
                      <a
                        href={it.url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 hover:underline"
                      >
                        {it.title}
                      </a>
                    ) : (
                      <span className="line-clamp-2">{it.title}</span>
                    )}
                  </li>
                ))}
              </ol>
              {itemPage.length > nItems && (
                <LoadMore href={more("items", nItems + 20)}>
                  {t("20 more", "再看 20 条")}
                </LoadMore>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="py-2">
          <CardHeader className="pt-4">
            <CardTitle>{t("Run history", "运行记录")}</CardTitle>
            <CardDescription>
              {t(
                `Last ${count(runs.length, "round")}, newest first`,
                `最近 ${runs.length} 轮，新的在前`
              )}
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">
                  {t("Time", "时间")}
                </TableHead>
                <TableHead>{t("Status", "状态")}</TableHead>
                <TableHead>{t("Items", "条数")}</TableHead>
                <TableHead className="hidden sm:table-cell">
                  {t("Took", "耗时")}
                </TableHead>
                <TableHead className="hidden pr-4 sm:pr-6 md:table-cell">
                  {t("Details", "说明")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.round_at}>
                  <TableCell className="pl-4 tabular-nums sm:pl-6">
                    <Link
                      href={`/runs/${r.round_at}`}
                      className="hover:underline"
                    >
                      {t.time(r.round_at)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge run={r} low={isLow(r, s.usual)} />
                  </TableCell>
                  <TableCell className="font-medium tabular-nums">
                    {fmtNum(r.items)}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {t.ms(r.ms)}
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
          {runPage.length > nRuns && (
            <LoadMore href={more("runs", nRuns + RUNS)}>
              {t(
                `${RUNS} more rounds (${nRuns} shown)`,
                `再看 ${RUNS} 轮（已显示 ${nRuns} 轮）`
              )}
            </LoadMore>
          )}
        </Card>

        {files.length > 0 && (
          <Card id="config">
            <CardHeader>
              <CardTitle>{t("Config", "配置")}</CardTitle>
              <CardDescription>
                {t(
                  `The files in sources/${s.id}/ of the hotToday repo, read-only; hard-coded cookies and tokens are hidden.`,
                  `hotToday 仓库 sources/${s.id}/ 里的文件，只读；写死的 cookie 和 token 已隐藏。`
                )}
                <Link
                  href="/config"
                  className="ml-1 underline-offset-4 hover:underline"
                >
                  {t("All sources' config", "所有源的配置")}
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {files.map((f, i) => (
                <details key={f.name} open={i === 0}>
                  <summary className="cursor-pointer font-mono text-sm font-medium">
                    {f.name}
                    <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                      {t(
                        count(f.text.split("\n").length, "line"),
                        `${f.text.split("\n").length} 行`
                      )}
                    </span>
                  </summary>
                  <pre className="mt-2 max-h-[560px] w-0 min-w-full overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs leading-5">
                    {f.text}
                  </pre>
                </details>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

const OPEN: RepairState[] = ["analyzing", "awaiting_review", "observing"]

/** The latest AI repair task for this source: diagnosis, checks, the sandbox run, the diff and what to
 * do next. Diagnosis, notes and checks are written by repair.py and the model, in Chinese. */
async function RepairCard({
  source,
  repairs,
  after,
  broken,
}: {
  source: string
  repairs: Repair[]
  after?: Run[]
  broken: boolean
}) {
  const t = await getT()
  const [r, ...older] = repairs
  const ops: RepairOp[] = []
  if (r?.state === "awaiting_review")
    ops.push(
      {
        op: "approve",
        label: t("Approve and apply", "批准并应用"),
        variant: "default",
        confirm: {
          title: t("Approve and apply this patch?", "批准并应用这个补丁？"),
          text: t(
            `The patch goes into sources/${source}/ and the source runs once with the new code right away; if that works it writes to the source table, like the hourly round. You can revert it later.`,
            `补丁会写进 sources/${source}/，并立即用新代码跑一次：成功就写进源表，和整点那轮一样。之后可以撤销。`
          ),
        },
      },
      {
        op: "reject",
        label: t("Reject", "驳回"),
        confirm: {
          title: t("Reject this patch?", "驳回这个补丁？"),
          text: t(
            "The task closes; the files in sources/ stay as they are.",
            "任务会关闭，sources/ 里的文件不变。"
          ),
        },
      }
    )
  if (
    r?.applied_at &&
    ["observing", "resolved", "needs_human"].includes(r.state)
  )
    ops.push({
      op: "revert",
      label: t("Revert the patch", "撤销补丁"),
      variant: "destructive",
      confirm: {
        title: t("Revert this patch?", "撤销这个补丁？"),
        text: t(
          `The files in sources/${source}/ go back to how they were before the patch.`,
          `sources/${source}/ 里的文件会改回应用补丁之前的样子。`
        ),
      },
    })
  if (broken && !(r && OPEN.includes(r.state)))
    ops.push({
      op: "run",
      label: r
        ? t("Analyze again", "再让 AI 分析")
        : t("Let AI analyze", "让 AI 分析"),
      confirm: {
        title: t("Let AI analyze this source?", "让 AI 分析这个源？"),
        text: t(
          "The model reads this source's files and its last rounds, test-crawls in a sandbox and may propose a patch (it only goes in once you approve it). It counts toward the tasks per day; results come within a few minutes.",
          "模型读这个源的文件和最近几轮的结果，在沙箱里试抓，可能提交补丁（要你批准才写进去）。算进「每天最多几个任务」，几分钟内出结果。"
        ),
      },
    })
  const by = r?.log[0]?.by
  const link = (u: string | null) => (u && /^https?:\/\//.test(u) ? u : null)

  return (
    <Card>
      {r?.state === "analyzing" && <AutoRefresh seconds={10} />}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t("AI repair", "AI 修复")}
          {r && <RepairBadge state={r.state} />}
        </CardTitle>
        <CardDescription>
          {r
            ? [
                `#${r.id}`,
                by === "system"
                  ? t(
                      `started automatically ${t.time(r.created_at)}`,
                      `${t.time(r.created_at)} 自动开始`
                    )
                  : t(
                      `started by ${by} ${t.time(r.created_at)}`,
                      `${t.time(r.created_at)} ${by} 手动开始`
                    ),
                r.model && modelLine(t, r),
              ]
                .filter(Boolean)
                .join(" · ")
            : t(
                "After two failed rounds in a row, the end of a round starts an analysis by itself; you can also start one now. A patch only goes in once someone approves it.",
                "连续两轮失败时，每轮结束会自动分析；也可以现在手动开始。补丁要人批准才会写进去。"
              )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {r && (
          <p className="leading-relaxed">
            {r.state === "analyzing"
              ? t(
                  `Analyzing: ${r.steps.at(-1)?.note ?? "test crawl"}`,
                  `正在分析：${r.steps.at(-1)?.note ?? "试抓中"}`
                )
              : (r.summary ?? r.log.at(-1)?.note)}
          </p>
        )}
        {r?.verify && <VerifyRun verify={r.verify} />}
        {r && (
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">{t("Log", "记录")}</span>
            <RepairTimeline repair={r} after={after} />
          </div>
        )}
        {!!r?.evidence?.length && (
          <ul className="flex list-disc flex-col gap-1 pl-5 break-all text-muted-foreground">
            {r.evidence.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {!!r?.checks?.length && (
          <ul className="flex flex-col gap-1.5">
            {r.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-2">
                {c.ok ? (
                  <RiCheckLine className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <RiCloseLine className="mt-0.5 size-4 shrink-0 text-destructive" />
                )}
                <span className="shrink-0 font-medium">{c.name}</span>
                <span className="break-all text-muted-foreground">
                  {c.note}
                </span>
              </li>
            ))}
          </ul>
        )}
        {r?.dry_run && (
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">
              {t("Sandbox crawl: ", "沙箱试抓：")}
              {r.dry_run.status}
              {r.dry_run.items != null &&
                t(
                  `, ${count(r.dry_run.items, "item")} extracted`,
                  `，提取到 ${r.dry_run.items} 条`
                )}
              {r.dry_run.ms != null && t(", ", "，") + t.ms(r.dry_run.ms)}
            </span>
            {r.dry_run.error && (
              <span className="font-mono text-xs break-all text-muted-foreground">
                {r.dry_run.error}
              </span>
            )}
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-muted-foreground">
              {r.dry_run.sample?.slice(0, 5).map(([title, url], i) => (
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
        )}
        {r?.diff && (
          <details open={r.state === "awaiting_review"} className="group">
            <summary className="cursor-pointer font-medium">
              {t("Patch", "补丁")}
            </summary>
            <pre className="mt-2 max-h-[480px] w-0 min-w-full overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs leading-5">
              <span className="block w-max min-w-full">
                {r.diff.split("\n").map((line, i) => (
                  <span
                    key={i}
                    className={cn(
                      "block",
                      /^\+(?!\+\+)/.test(line) &&
                        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                      /^-(?!--)/.test(line) &&
                        "bg-destructive/10 text-destructive",
                      line.startsWith("@@") && "text-muted-foreground"
                    )}
                  >
                    {line || " "}
                  </span>
                ))}
              </span>
            </pre>
          </details>
        )}
        {!!r?.steps.length && (
          <details>
            <summary className="cursor-pointer text-muted-foreground">
              {t(`Steps (${r.steps.length})`, `过程（${r.steps.length} 步）`)}
            </summary>
            <ol className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
              {r.steps.map((st, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 font-mono">{st.tool}</span>
                  <span className="break-all">{st.note}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
        {ops.length > 0 && (
          <RepairButtons id={r?.id} source={source} ops={ops} />
        )}
        {older.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t pt-3">
            <span className="text-xs font-medium text-muted-foreground">
              {t("Earlier repairs", "之前的修复")}
            </span>
            {older.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs">
                <RepairBadge state={o.state} />
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {t.time(o.created_at)}
                </span>
                <span className="min-w-0 truncate">
                  {o.summary ?? o.log.at(-1)?.note}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** The run right after approval: the new code, the real write path, one try within verify.limit seconds. */
async function VerifyRun({
  verify: v,
}: {
  verify: NonNullable<Repair["verify"]>
}) {
  const t = await getT()
  const ok = v.status === "ok"
  // repair.py's timeout error says "超过 N 秒"
  const timedOut = !ok && /超过 \d+ 秒/.test(v.error ?? "")
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2",
        ok ? "bg-emerald-500/10" : "bg-destructive/5 text-destructive"
      )}
    >
      {ok ? (
        <RiCheckLine className="mt-0.5 size-4 shrink-0 text-emerald-600" />
      ) : (
        <RiCloseLine className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {t(
          `After approval at ${t.time(v.ts)} the new code ran once: ${
            ok
              ? `${count(v.items ?? 0, "item")}, ${t.ms(v.ms)}, written to the source table${v.cleaned ? " and cleaned" : `; cleaning failed: ${v.etl_error}`}.`
              : v.status === "empty"
                ? "empty response, nothing written."
                : `error, nothing written: ${v.error}.`
          }${timedOut ? ` Approval waits ${v.limit} s at most; the hourly round runs it again with the source's own timeout.` : ""}`,
          `${t.time(v.ts)} 批准后用新代码跑了一次：${
            ok
              ? `${v.items} 条，${t.ms(v.ms)}，已写入源表${v.cleaned ? "并清洗" : `，清洗出错：${v.etl_error}`}。`
              : v.status === "empty"
                ? "返回空数据，没写入。"
                : `出错，没写入：${v.error}。`
          }${timedOut ? ` 批准时最多等 ${v.limit} 秒，整点那轮按源自己的超时再跑。` : ""}`
        )}
        <span className="text-muted-foreground">
          {t(
            " The next two rounds tell whether it recovered.",
            " 是否恢复看之后的两轮。"
          )}
        </span>
      </span>
    </div>
  )
}
