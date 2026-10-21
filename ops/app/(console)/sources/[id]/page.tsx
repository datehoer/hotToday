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
  PageHeader,
  PageTitle,
  STATUS,
  Stat,
  StatusBadge,
} from "@/components/ops"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import {
  cause,
  getRepairs,
  getSource,
  getSourceFiles,
  getSourceItems,
  getSourceRuns,
  isLow,
  REPAIR_STATE,
  type Repair,
  type RepairState,
  type Run,
} from "@/lib/ops"
import {
  cn,
  daysSince,
  fmtHour,
  fmtMs,
  fmtNum,
  fmtTime,
  listSize,
} from "@/lib/utils"

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
  return { title: data?.source.name ?? "源" }
}

const failed = (r: Run | null) => r?.status === "empty" || r?.status === "error"

export default async function SourceDetail({ params, searchParams }: Props) {
  const data = await getSource((await params).id)
  if (!data) notFound()
  const { board, source: s } = data
  const query = await searchParams
  const nRuns = listSize(query.runs, RUNS, 30 * 24)
  const nItems = listSize(query.items, ITEMS, 200)
  const [runPage, itemPage, repairs, files] = await Promise.all([
    getSourceRuns(s.id, nRuns + 1),
    getSourceItems(s.id, nItems + 1),
    getRepairs(s.id),
    getSourceFiles(s.id),
  ])
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
  const streak =
    s.history.length - 1 - s.history.findLastIndex((h) => !failed(h))

  return (
    <>
      <PageHeader
        crumbs={[["运维", "/"], ["源", "/sources"], [s.name]]}
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
                打开 {host.replace(/^www\./, "")}
                <RiArrowRightUpLine data-icon="inline-end" />
              </Button>
            )
          }
        >
          <span className="font-mono">
            {s.id}
            {host && ` · ${host}`} ·{" "}
            {s.run.status === "disabled" ? "已停用" : "每小时一轮"}
          </span>
        </PageTitle>

        {failed(s.run) && (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            {s.run.status === "empty" ? (
              <RiInbox2Line />
            ) : (
              <RiErrorWarningLine />
            )}
            <AlertTitle>这一轮{cause(s.run)}，没写入</AlertTitle>
            <AlertDescription>
              {s.run.status === "empty" ? (
                "请求成功了，但没解析出条目。"
              ) : (
                <span className="font-mono break-all">{s.run.error}</span>
              )}
              <br />
              {lastOkRun
                ? `上一次写入是 ${fmtTime(lastOkRun.finished_at)}，${lastOkRun.items} 条。`
                : s.lastOk
                  ? `上一次写入是 ${fmtTime(s.lastOk)}（${daysSince(s.lastOk)} 天前）。`
                  : "没有写入记录。"}
              {streak >= s.history.length
                ? `最近 ${s.history.length} 轮都没写入。`
                : streak > 1
                  ? `已经连续 ${streak} 轮没写入。`
                  : seen.length > 1 &&
                    `之前 ${seen.length - 1} 轮里 ${seen.filter((h) => h.status === "ok").length} 轮正常。`}
            </AlertDescription>
          </Alert>
        )}
        {s.low && (
          <Alert className="border-amber-600/15 bg-amber-500/5 text-amber-700 dark:text-amber-400">
            <RiInbox2Line />
            <AlertTitle>
              这一轮只有 {s.run.items} 条，平时 {s.usual} 条
            </AlertTitle>
            <AlertDescription>
              写入了，但条数不到平时的一半，可能只解析到了一部分页面。
            </AlertDescription>
          </Alert>
        )}
        {s.run.status === "disabled" && (
          <Alert className="bg-muted/50">
            <RiPauseCircleLine />
            <AlertTitle>已停用</AlertTitle>
            <AlertDescription>
              {s.run.error ?? "task.py 里没有启用这个源。"}
            </AlertDescription>
          </Alert>
        )}

        {(repairs.length > 0 || failed(s.run) || s.low) && (
          <RepairCard
            source={s.id}
            repairs={repairs}
            broken={failed(s.run) || s.low}
          />
        )}

        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <Stat
            label="最近写入"
            value={s.lastOk ? fmtTime(s.lastOk) : "—"}
            note={
              lastOkRun
                ? `${lastOkRun.items} 条`
                : s.lastOk
                  ? "早于运行记录"
                  : "没有写入记录"
            }
          />
          <Stat
            label="平时条数"
            value={fmtNum(s.usual)}
            note={
              s.usual == null
                ? "成功不到 5 次，算不出"
                : `最近 ${Math.min(20, seen.filter((h) => h.status === "ok").length)} 次成功的中位数`
            }
          />
          <Stat
            label="成功"
            value={seen.filter((h) => h.status === "ok").length}
            unit={`/ ${seen.length}`}
            note={`最近 ${seen.length} 轮`}
          />
          <Stat
            label="平均耗时"
            value={fmtMs(avg)}
            note={times.length ? `最近 ${times.length} 轮` : "没有耗时记录"}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] 2xl:grid-cols-[minmax(0,1fr)_452px]">
          <Card>
            <CardHeader>
              <CardTitle>每轮条数</CardTitle>
              <CardDescription>
                最近 {board.rounds.length}{" "}
                轮，红色是没写入的轮次，橙色是条数偏低
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <RoundBars
                label="条数"
                data={board.rounds.map((r, i) => {
                  const h = s.history[i]
                  return {
                    key: String(r.started_at),
                    hour: fmtHour(r.started_at),
                    title: `${fmtTime(r.started_at)} · ${h ? STATUS[h.status] : "没有记录"}`,
                    value: h?.items ?? 0,
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
              <CardTitle>最近写入的条目</CardTitle>
              <CardDescription>
                {items.length
                  ? `清洗后的标题，${fmtTime(items[0].last_seen)} 最后出现`
                  : "清洗后的表里还没有这个源的标题"}
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
                  再看 20 条
                </LoadMore>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="py-2">
          <CardHeader className="pt-4">
            <CardTitle>运行记录</CardTitle>
            <CardDescription>最近 {runs.length} 轮，新的在前</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-6">时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">条数</TableHead>
                <TableHead className="hidden text-right sm:table-cell">
                  耗时
                </TableHead>
                <TableHead className="hidden pr-4 sm:pr-6 md:table-cell">
                  说明
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
                      {fmtTime(r.round_at)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge run={r} low={isLow(r, s.usual)} />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmtNum(r.items)}
                  </TableCell>
                  <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">
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
          {runPage.length > nRuns && (
            <LoadMore href={more("runs", nRuns + RUNS)}>
              再看 {RUNS} 轮（已显示 {nRuns} 轮）
            </LoadMore>
          )}
        </Card>

        {files.length > 0 && (
          <Card id="config">
            <CardHeader>
              <CardTitle>配置</CardTitle>
              <CardDescription>
                hotToday 仓库 sources/{s.id}/ 里的文件，只读；写死的 cookie 和
                token 已隐藏。
                <Link
                  href="/config"
                  className="ml-1 underline-offset-4 hover:underline"
                >
                  所有源的配置
                </Link>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {files.map((f, i) => (
                <details key={f.name} open={i === 0}>
                  <summary className="cursor-pointer font-mono text-sm font-medium">
                    {f.name}
                    <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
                      {f.text.split("\n").length} 行
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

function RepairBadge({ state }: { state: RepairState }) {
  const tone: Partial<Record<RepairState, string>> = {
    awaiting_review: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  }
  const variant =
    state === "analyzing"
      ? "default"
      : state === "needs_human" || state === "failed"
        ? "destructive"
        : state === "observing" || state === "superseded"
          ? "outline"
          : "secondary"
  return (
    <Badge variant={variant} className={tone[state]}>
      {REPAIR_STATE[state]}
    </Badge>
  )
}

/** The latest AI repair task for this source: diagnosis, checks, the sandbox run, the diff and what to do next. */
function RepairCard({
  source,
  repairs,
  broken,
}: {
  source: string
  repairs: Repair[]
  broken: boolean
}) {
  const [r, ...older] = repairs
  const ops: RepairOp[] = []
  if (r?.state === "awaiting_review")
    ops.push(
      {
        op: "approve",
        label: "批准并应用",
        variant: "default",
        confirm: {
          title: "批准并应用这个补丁？",
          text: `补丁会写进 sources/${source}/，下一轮开始用新代码。之后可以撤销。`,
        },
      },
      {
        op: "reject",
        label: "驳回",
        confirm: {
          title: "驳回这个补丁？",
          text: "任务会关闭，sources/ 里的文件不变。",
        },
      }
    )
  if (
    r?.applied_at &&
    ["observing", "resolved", "needs_human"].includes(r.state)
  )
    ops.push({
      op: "revert",
      label: "撤销补丁",
      variant: "destructive",
      confirm: {
        title: "撤销这个补丁？",
        text: `sources/${source}/ 里的文件会改回应用补丁之前的样子。`,
      },
    })
  if (broken && !(r && OPEN.includes(r.state)))
    ops.push({ op: "run", label: r ? "再让 AI 分析" : "让 AI 分析" })
  const by = r?.log[0]?.by
  const link = (u: string | null) => (u && /^https?:\/\//.test(u) ? u : null)

  return (
    <Card>
      {r?.state === "analyzing" && <AutoRefresh seconds={10} />}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          AI 修复
          {r && <RepairBadge state={r.state} />}
        </CardTitle>
        <CardDescription>
          {r
            ? [
                `#${r.id}`,
                `${fmtTime(r.created_at)} ${by === "system" ? "自动开始" : `${by} 手动开始`}`,
                r.model &&
                  `${r.model} · ${fmtNum(r.tokens)} tokens · 补丁 ${r.attempts} 次`,
              ]
                .filter(Boolean)
                .join(" · ")
            : "连续两轮失败时，每轮结束会自动分析；也可以现在手动开始。补丁要人批准才会写进去。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {r && (
          <p className="leading-relaxed">
            {r.state === "analyzing"
              ? `正在分析：${r.steps.at(-1)?.note ?? "试抓中"}`
              : (r.summary ?? r.log.at(-1)?.note)}
          </p>
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
              沙箱试抓：{r.dry_run.status}
              {r.dry_run.items != null && `，提取到 ${r.dry_run.items} 条`}
              {r.dry_run.ms != null && `，${fmtMs(r.dry_run.ms)}`}
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
            <summary className="cursor-pointer font-medium">补丁</summary>
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
              过程（{r.steps.length} 步）
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
              之前的修复
            </span>
            {older.slice(0, 5).map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs">
                <RepairBadge state={o.state} />
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {fmtTime(o.created_at)}
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
