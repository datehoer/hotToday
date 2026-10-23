import {
  RiAddLine,
  RiArrowLeftSLine,
  RiCheckLine,
  RiErrorWarningLine,
} from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  AutoRefresh,
  ChatComposer,
  RepairButtons,
} from "@/components/ops-client"
import {
  Checks,
  DryRun,
  PageHeader,
  PageTitle,
  PatchDiff,
} from "@/components/ops"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import {
  getChat,
  getChats,
  getT,
  isThinking,
  type Chat,
  type ChatBrief,
  type ChatEvent,
} from "@/lib/ops"
import { cn, fmtNum } from "@/lib/utils"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("AI agent", "AI 助手") }
}

// A chat with the site's AI (repair.py's Chat): the list of chats, and one chat's thread with its
// steps, its latest passing change and the message box; ?c= picks the chat, none starts a new one.
// Replies, steps and checks come from the model and repair.py, mostly in Chinese.
export default async function Agent({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams
  const t = await getT()
  const id = /^\d+$/.test(c ?? "") ? Number(c) : null
  const [chats, chat] = await Promise.all([
    getChats(50),
    id ? getChat(id) : null,
  ])
  // A chat fills the window at every width, the new-chat view from lg up, and each pane scrolls
  // inside; on phones the new-chat card and the list stack at their own height.
  const fill = id ? "min-h-0 grow basis-0" : "lg:min-h-0 lg:grow lg:basis-0"

  return (
    <>
      <PageHeader
        crumbs={[[t("Ops", "运维"), "/"], [t("AI agent", "AI 助手")]]}
      />
      {chat && isThinking(chat) && <AutoRefresh seconds={4} />}
      <div className={cn("flex flex-col gap-5 p-4 md:p-6", fill)}>
        {/* On a phone an open chat needs the height; the heading stays for screen readers */}
        <div className={cn(id && "max-lg:sr-only")}>
          <PageTitle title={t("AI agent", "AI 助手")} />
        </div>
        <div className={cn("flex gap-4 max-lg:flex-col", fill)}>
          <ChatList
            chats={chats}
            current={id}
            className={cn(
              "lg:w-72 lg:shrink-0",
              id ? "max-lg:hidden" : "max-lg:order-2"
            )}
          />
          {chat ? (
            <Thread chat={chat} className={cn("min-w-0", fill)} />
          ) : (
            <Card className={cn("min-w-0", fill)}>
              <CardContent className="flex flex-1 flex-col items-center justify-center">
                {id ? (
                  <p className="text-sm text-muted-foreground">
                    {t("No such chat", "没有这个对话")}
                  </p>
                ) : (
                  <div className="flex w-full max-w-2xl flex-col gap-4">
                    <CardTitle className="text-center text-lg">
                      {t("New chat", "新对话")}
                    </CardTitle>
                    <ChatComposer
                      id={null}
                      busy={false}
                      examples={[
                        t(
                          "google_search is disabled. Can it be fixed?",
                          "google_search 停用了，看看能不能修好"
                        ),
                        t(
                          "Add a source for the front page of lobste.rs",
                          "加一个 lobste.rs 首页最热的源"
                        ),
                        t(
                          "Can freebuf be crawled again?",
                          "freebuf 还能抓吗？"
                        ),
                      ]}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

/** Where a chat stands: the model working on it, stopped past its deadline, a change waiting, applied, or answered. */
async function ChatBadge({
  chat: c,
}: {
  chat: Pick<Chat, "state" | "deadline"> & {
    proposal: ChatBrief["proposal"] | Chat["proposal"]
  }
}) {
  const t = await getT()
  const proposal =
    typeof c.proposal === "string"
      ? c.proposal
      : c.proposal && (c.proposal.task ? "applied" : "pending")
  if (isThinking(c)) return <Badge>{t("Thinking", "思考中")}</Badge>
  if (c.state === "thinking")
    return <Badge variant="destructive">{t("Interrupted", "中断了")}</Badge>
  if (proposal === "pending")
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
        {t("Change to apply", "有改动待应用")}
      </Badge>
    )
  if (proposal === "applied")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
        {t("Applied", "已应用")}
      </Badge>
    )
  return <Badge variant="secondary">{t("Replied", "已回复")}</Badge>
}

async function ChatList({
  chats,
  current,
  className,
}: {
  chats: ChatBrief[]
  current: number | null
  className?: string
}) {
  const t = await getT()
  return (
    <Card size="sm" className={className}>
      <CardHeader>
        <CardTitle>{t("Chats", "对话")}</CardTitle>
        {current && (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/agent" />}
            >
              <RiAddLine data-icon="inline-start" />
              {t("New chat", "新对话")}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2">
        {chats.map((c) => (
          <Link
            key={c.id}
            href={`/agent?c=${c.id}`}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl px-2 py-2 hover:bg-muted",
              c.id === current && "bg-muted"
            )}
          >
            <span className="truncate text-sm font-medium">{c.title}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <ChatBadge chat={c} />
              {t.time(c.updated_at)} · {fmtNum(c.tokens)} tokens
            </span>
          </Link>
        ))}
        {!chats.length && (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            {t("No chats yet", "还没有对话")}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

async function Thread({
  chat: c,
  className,
}: {
  chat: Chat
  className?: string
}) {
  const t = await getT()
  const busy = isThinking(c)
  const p = c.proposal
  // A run of steps shows as one collapsible "Steps" row; the open one is the run still going
  const groups: (ChatEvent | ChatEvent[])[] = []
  for (const e of c.events) {
    const last = groups.at(-1)
    if (e.kind === "step" && Array.isArray(last)) last.push(e)
    else groups.push(e.kind === "step" ? [e] : e)
  }

  return (
    <Card className={className}>
      <CardHeader>
        <Link
          href="/agent"
          className="-ml-1 flex w-fit items-center text-xs text-muted-foreground hover:text-foreground lg:hidden"
        >
          <RiArrowLeftSLine className="size-4" />
          {t("All chats", "全部对话")}
        </Link>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 [overflow-wrap:anywhere]">{c.title}</span>
          <ChatBadge chat={c} />
        </CardTitle>
        <CardDescription className="tabular-nums">
          {[
            c.created_by,
            t.time(c.created_at),
            c.model,
            `${fmtNum(c.tokens)} tokens`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      {/* column-reverse: a long thread opens at its newest message; mb-auto keeps a short one at the top */}
      <CardContent className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto text-sm">
        <div className="mb-auto flex flex-col gap-4">
          {groups.map((g, i) =>
            Array.isArray(g) ? (
              <details
                key={i}
                open={busy && i === groups.length - 1}
                className="text-xs text-muted-foreground"
              >
                <summary className="cursor-pointer">
                  {t(`Steps · ${g.length}`, `过程 · ${g.length} 步`)}
                </summary>
                <ol className="mt-2 flex flex-col gap-1">
                  {g.map((s, j) => (
                    <li key={j} className="flex gap-2">
                      <span className="shrink-0 font-mono">{s.tool}</span>
                      <span className="break-all">{s.note}</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : (
              <Message key={i} event={g} source={p?.new ? null : p?.key} />
            )
          )}
          {busy && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner aria-hidden />
              {t("Working on it", "正在处理")}
              {c.events.at(-1)?.kind === "step" &&
                t(`: ${c.events.at(-1)?.note}`, `：${c.events.at(-1)?.note}`)}
            </p>
          )}
          {!busy && c.state === "thinking" && (
            <p className="flex items-start gap-2 text-destructive">
              <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
              {t(
                "The reply was interrupted (the spider container may have restarted). Send the message again.",
                "回复中断了（可能是爬虫容器重启了），再发一次就行。"
              )}
            </p>
          )}
          {p && (
            <div className="flex flex-col gap-3 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-medium">sources/{p.key}/</span>
                {p.new && (
                  <Badge variant="secondary">{t("New source", "新源")}</Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {t.time(p.ts)}
                </span>
              </div>
              {p.note && <p className="leading-relaxed">{p.note}</p>}
              {p.checks && <Checks checks={p.checks} />}
              {p.dry_run && <DryRun run={p.dry_run} />}
              {/* closed: the thread opens at its end, where an open diff would hide the reply */}
              {p.diff && <PatchDiff diff={p.diff} />}
              {p.task ? (
                <p className="flex items-start gap-2 rounded-in-card bg-emerald-500/10 px-3 py-2">
                  <RiCheckLine className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <span>
                    {t(
                      `Applied by ${p.applied_by} ${t.time(p.applied_at ?? p.ts)} · AI repair task `,
                      `${p.applied_by} ${t.time(p.applied_at ?? p.ts)} 应用 · AI 修复任务 `
                    )}
                    <Link
                      href={p.new ? "/repairs" : `/sources/${p.key}`}
                      className="font-medium hover:underline"
                    >
                      #{p.task}
                    </Link>
                  </span>
                </p>
              ) : (
                <RepairButtons
                  id={c.id}
                  source={p.key}
                  ops={[
                    {
                      op: "apply-chat",
                      label: t("Apply", "应用改动"),
                      variant: "default",
                      confirm: {
                        title: t("Apply this change?", "应用这个改动？"),
                        text: t(
                          `It goes into sources/${p.key}/ and the source runs once with the new code right away; if that works it writes to the source table, like the hourly round. It's recorded as an AI repair task, so you can revert it from the source's page.`,
                          `改动会写进 sources/${p.key}/，并立即用新代码跑一次：成功就写进源表，和整点那轮一样。它会记成一个 AI 修复任务，之后可以在源的页面撤销。`
                        ),
                      },
                    },
                  ]}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex-col items-stretch border-t">
        <ChatComposer id={c.id} busy={busy} />
      </CardFooter>
    </Card>
  )
}

/** One message in the thread: yours on the right, the AI's on the left, errors and applied changes as notes. */
async function Message({
  event: e,
  source,
}: {
  event: ChatEvent
  source?: string | null // where an applied change's task shows; null for a source that is new
}) {
  const t = await getT()
  if (e.kind === "user")
    return (
      <p
        title={`${e.by} · ${t.time(e.ts)}`}
        className="ml-auto max-w-[85%] rounded-in-card bg-muted px-3.5 py-2 leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap"
      >
        {e.text}
      </p>
    )
  if (e.kind === "reply")
    return (
      <p
        title={t.time(e.ts)}
        className="leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap"
      >
        {e.text}
      </p>
    )
  if (e.kind === "applied")
    return (
      <p className="flex items-start gap-2 text-emerald-700 dark:text-emerald-400">
        <RiCheckLine className="mt-0.5 size-4 shrink-0" />
        <span className="[overflow-wrap:anywhere]">
          {t(
            `${e.by} applied the change (repair task `,
            `${e.by} 应用了改动（修复任务 `
          )}
          <Link
            href={source ? `/sources/${source}` : "/repairs"}
            className="font-medium hover:underline"
          >
            #{e.task}
          </Link>
          {t(`): ${e.text}`, `）：${e.text}`)}
        </span>
      </p>
    )
  return (
    <p className="flex items-start gap-2 text-destructive">
      <RiErrorWarningLine className="mt-0.5 size-4 shrink-0" />
      <span className="[overflow-wrap:anywhere]">
        {t(
          `It stopped on an error: ${e.text}. Send the message again to retry.`,
          `出错停下了：${e.text}。再发一次就会重试。`
        )}
      </span>
    </p>
  )
}
