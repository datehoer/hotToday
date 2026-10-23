"use client"

import {
  RiChatAiLine,
  RiCheckLine,
  RiDashboardLine,
  RiDatabase2Line,
  RiErrorWarningLine,
  RiFireFill,
  RiHistoryLine,
  RiLogoutBoxRLine,
  RiPulseLine,
  RiRobot2Line,
  RiSendPlane2Line,
  RiSettings3Line,
  RiTranslate2,
} from "@remixicon/react"
import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  createContext,
  startTransition,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Rectangle,
  XAxis,
  YAxis,
  type BarShapeProps,
} from "recharts"

import {
  editSubscription,
  saveRepairSettings,
  saveSubpool,
  testModel,
} from "@/app/(console)/config/actions"
import { chatAction, repairAction } from "@/app/(console)/sources/[id]/actions"
import { login, logout, setLang } from "@/app/login/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type {
  RepairLimit,
  Reply,
  SpiderConfig,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  SubpoolKey,
} from "@/lib/ops"
import { count, T, type Lang } from "@/lib/i18n"
import { cn } from "@/lib/utils"

const LangContext = createContext<Lang>("en")

/** The language the root layout read from the cookie, for client components. */
export function LangProvider({
  lang,
  children,
}: {
  lang: Lang
  children: React.ReactNode
}) {
  return <LangContext value={lang}>{children}</LangContext>
}

/** t("English", "中文") and the formatters (lib/i18n.ts) in the visitor's language. */
export const useT = () => T[useContext(LangContext)]

/** English ⇄ 中文: sets the cookie, and the page comes back in the other language. */
export function LangSwitch({ className }: { className?: string }) {
  const t = useT()
  const [pending, start] = useTransition()
  const other = t("zh", "en")
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      lang={t("zh-CN", "en")}
      disabled={pending}
      className={className}
      onClick={() => start(() => setLang(other))}
    >
      {pending ? (
        <Spinner data-icon="inline-start" aria-hidden />
      ) : (
        <RiTranslate2 data-icon="inline-start" />
      )}
      {t("中文", "English")}
    </Button>
  )
}

export type RoundBrief = {
  label: string
  state: string
  ok: number
  total: number
  next: string
}

const NAV = [
  { href: "/", label: ["Overview", "概况"], icon: RiDashboardLine },
  { href: "/sources", label: ["Sources", "源"], icon: RiDatabase2Line },
  { href: "/runs", label: ["Rounds", "运行"], icon: RiHistoryLine },
  { href: "/repairs", label: ["AI repair", "AI 修复"], icon: RiRobot2Line },
  { href: "/agent", label: ["AI agent", "AI 助手"], icon: RiChatAiLine },
  { href: "/status", label: ["Status", "状态"], icon: RiPulseLine },
  { href: "/config", label: ["Config", "配置"], icon: RiSettings3Line },
] as const

export function AppSidebar({
  user,
  round,
  failing,
}: {
  user: string
  round: RoundBrief | null
  failing: number
}) {
  const t = useT()
  const path = usePathname()
  const { setOpenMobile } = useSidebar()
  return (
    <Sidebar variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/" onClick={() => setOpenMobile(false)} />}
            >
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
                <RiFireFill className="size-4.5" />
              </span>
              <span className="grid leading-tight">
                <span className="font-semibold">hotToday</span>
                <span className="text-xs text-muted-foreground">
                  {t("Crawler ops", "爬虫运维")}
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("Navigation", "导航")}</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map(({ href, label, icon: Icon }) => (
              <SidebarMenuItem key={href}>
                <SidebarMenuButton
                  isActive={href === "/" ? path === "/" : path.startsWith(href)}
                  render={
                    <Link href={href} onClick={() => setOpenMobile(false)} />
                  }
                >
                  <Icon />
                  <span>{t(...label)}</span>
                </SidebarMenuButton>
                {href === "/sources" && failing > 0 && (
                  <SidebarMenuBadge className="bg-destructive/10 text-destructive">
                    {failing}
                  </SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {round && (
          <div className="flex flex-col gap-2 rounded-2xl border bg-background p-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                {round.label}
              </span>
              <span>{round.state}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{
                  width: `${(round.ok / Math.max(round.total, 1)) * 100}%`,
                }}
              />
            </div>
            <span className="tabular-nums">
              {t(
                `${round.ok} / ${round.total} wrote data · next ${round.next}`,
                `${round.ok} / ${round.total} 写入成功 · 下一轮 ${round.next}`
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 px-2 py-1">
          <span className="mr-1 flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
            {user[0]}
          </span>
          <span className="flex-1 truncate text-sm">{user}</span>
          <LangSwitch />
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              title={t("Sign out", "退出登录")}
            >
              <RiLogoutBoxRLine />
              <span className="sr-only">{t("Sign out", "退出登录")}</span>
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

export type BarDatum = {
  key: string
  hour: string
  title: string
  value: number
  tone?: "bad" | "low" | "muted"
  href?: string // where a click on this round's column goes
}

const TONES = {
  bad: "var(--destructive)",
  low: "oklch(0.769 0.188 70.08)",
  muted: "var(--muted-foreground)",
}

// Values are labelled selectively: the newest column, and the highest one when it is far enough
// from it not to collide; the axis and the tooltip carry the rest.
const pickLabels = <T,>(data: T[], value: (d: T) => number) => {
  const max = Math.max(...data.map(value))
  const top = data.findLastIndex((d) => value(d) === max)
  return (i: number) =>
    i === data.length - 1 || (i === top && max > 0 && data.length - 1 - top > 2)
}

// Axis ticks: 0 / 500 / 1K / 1.5K
const compact = (v: number) =>
  v >= 1000 ? `${+(v / 1000).toFixed(1)}K` : String(v)

/** A click anywhere in a column's band (not just on the bar) opens its href. */
function useColumnClick(data: { href?: string }[]) {
  const router = useRouter()
  return data.some((d) => d.href)
    ? (state: { activeIndex?: number | string | null }) => {
        const href = data[Number(state.activeIndex)]?.href
        if (state.activeIndex != null && href) router.push(href)
      }
    : undefined
}

/** Bar per round; the tooltip shows the round's full time. fade: every round but the newest faded. */
export function RoundBars({
  data,
  label,
  color = "var(--chart-3)",
  fade,
}: {
  data: BarDatum[]
  label: string
  color?: string
  fade?: boolean
}) {
  const onClick = useColumnClick(data)
  const shown = pickLabels(data, (d) => d.value)
  return (
    <ChartContainer
      config={{ value: { label, color } }}
      className={cn(
        "aspect-auto h-[200px] w-full lg:h-full lg:min-h-[200px]",
        onClick && "cursor-pointer"
      )}
    >
      <BarChart
        data={data.map((d, i) => ({
          ...d,
          label: shown(i) ? d.value.toLocaleString("en-US") : "",
        }))}
        margin={{ top: 18, left: 0, right: 14 }}
        accessibilityLayer
        onClick={onClick}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          interval={0}
          fontSize={11}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tickCount={4}
          fontSize={11}
          tickFormatter={compact}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => p[0]?.payload.title}
              formatter={(value) => (
                <TooltipRow
                  label={label}
                  value={Number(value).toLocaleString("en-US")}
                />
              )}
            />
          }
        />
        <Bar
          dataKey="value"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
          minPointSize={3}
        >
          {data.map((d, i) => (
            <Cell
              key={d.key}
              fill={d.tone ? TONES[d.tone] : "var(--color-value)"}
              fillOpacity={
                d.tone === "muted"
                  ? 0.3
                  : fade && !d.tone && i < data.length - 1
                    ? 0.45
                    : 0.85
              }
            />
          ))}
          <LabelList
            dataKey="label"
            position="top"
            offset={6}
            className="fill-muted-foreground tabular-nums"
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

function TooltipRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {color && (
        <i
          className="h-2.5 w-1 shrink-0 rounded-[2px]"
          style={{ background: color }}
        />
      )}
      <span className="flex-1 text-muted-foreground">{label}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  )
}

export type StackDatum = {
  key: string
  hour: string
  title: string
  href?: string
} & Record<string, string | number | undefined>

/** Stacked columns per round of how long each part took (milliseconds in, one colour per part,
 * with a legend; labels are [English, 中文]). */
export function StackBars({
  data: rows,
  parts,
}: {
  data: StackDatum[]
  parts: readonly {
    key: string
    label: readonly [string, string]
    light: string
    dark: string
  }[]
}) {
  const t = useT()
  // Durations are plotted in minutes, so the axis gets round ticks (0 / 2 / 4 min).
  const format = (min: number) => t.ms(min * 60_000)
  const short = (min: number) => `${+min.toFixed(1)}\u00a0${t("min", "分")}`
  const data = rows.map((d) => ({
    ...d,
    ...Object.fromEntries(
      parts.map((p) => [p.key, (Number(d[p.key]) || 0) / 60_000])
    ),
  }))
  const onClick = useColumnClick(data)
  const total = (d: StackDatum) =>
    parts.reduce((a, p) => a + (Number(d[p.key]) || 0), 0)
  const shown = pickLabels(data, total)
  const last = parts.at(-1)!.key
  return (
    <ChartContainer
      config={Object.fromEntries(
        parts.map((p) => [
          p.key,
          { label: t(...p.label), theme: { light: p.light, dark: p.dark } },
        ])
      )}
      className={cn(
        "aspect-auto h-[240px] w-full",
        onClick && "cursor-pointer"
      )}
    >
      <BarChart
        data={data.map((d, i) => ({
          ...d,
          label: shown(i) ? short(total(d)) : "",
        }))}
        margin={{ top: 18, left: 0, right: 14 }}
        accessibilityLayer
        onClick={onClick}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          interval={0}
          fontSize={11}
        />
        <YAxis
          width={44}
          tickLine={false}
          axisLine={false}
          tickCount={4}
          fontSize={11}
          tickFormatter={short}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) =>
                `${p[0]?.payload.title} · ${t("total", "共")} ${format(total(p[0]?.payload))}`
              }
              formatter={(value, name, item) => {
                const part = parts.find((p) => p.key === name)
                return (
                  <TooltipRow
                    label={part ? t(...part.label) : String(name)}
                    value={format(Number(value))}
                    color={item.color}
                  />
                )
              }}
            />
          }
        />
        {/* in the parts' own order; recharts sorts the legend by name otherwise */}
        <ChartLegend
          content={<ChartLegendContent />}
          itemSorter={(item) => parts.findIndex((p) => p.key === item.dataKey)}
        />
        {parts.map((p) => (
          <Bar
            key={p.key}
            dataKey={p.key}
            name={p.key}
            stackId="round"
            fill={`var(--color-${p.key})`}
            radius={p.key === last ? [4, 4, 0, 0] : 0}
            maxBarSize={24}
            // 2px of the card between stacked parts, taken off the top of each lower part
            shape={
              p.key === last
                ? undefined
                : (props: BarShapeProps) => (
                    <Rectangle
                      {...props}
                      y={props.y + 2}
                      height={Math.max(0, props.height - 2)}
                    />
                  )
            }
          >
            {p.key === last && (
              <LabelList
                dataKey="label"
                position="top"
                offset={6}
                className="fill-muted-foreground tabular-nums"
                fontSize={11}
              />
            )}
          </Bar>
        ))}
      </BarChart>
    </ChartContainer>
  )
}

/** Re-render the server page every `seconds` while a round is running. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}

/** "Load more": a link to the same page with a longer list (?n=…). It follows itself when it
 * scrolls into view, so the list keeps growing as you scroll; replace keeps one history entry. */
export function LoadMore({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const t = useT()
  const router = useRouter()
  const ref = useRef<HTMLAnchorElement>(null)
  const [pending, start] = useTransition()
  useEffect(() => {
    const seen = new IntersectionObserver(
      ([e]) =>
        e.isIntersecting &&
        start(() => router.replace(href, { scroll: false })),
      { rootMargin: "240px" }
    )
    seen.observe(ref.current!)
    return () => seen.disconnect()
  }, [href, router])
  return (
    <Link
      ref={ref}
      href={href}
      replace
      scroll={false}
      className="flex h-11 items-center justify-center text-sm text-muted-foreground hover:text-foreground md:h-9"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Spinner aria-hidden />
          {t("Loading…", "加载中…")}
        </span>
      ) : (
        children
      )}
    </Link>
  )
}

/** Inside a <Link> to a view of the same page (?tab=, ?f=): a spinner while it loads. Those
 * navigations keep the old view until the new one arrives, so loading.tsx doesn't show. */
export function LinkPending() {
  const t = useT()
  const { pending } = useLinkStatus()
  return pending ? (
    <Spinner aria-label={t("Loading", "加载中")} className="size-3.5" />
  ) : null
}

/** The bar that runs under the header of a loading page (PageSkeleton). */
export function LoadingBar() {
  const t = useT()
  return (
    <div
      role="progressbar"
      aria-label={t("Loading", "加载中")}
      className="relative -mt-px h-0.5 overflow-hidden"
    >
      <i className="absolute inset-y-0 w-1/3 animate-loading-bar rounded-full bg-primary motion-reduce:animate-none" />
    </div>
  )
}

/** No sign-up link: accounts only exist in the server's .env.local. */
export function LoginForm({ next }: { next: string }) {
  const t = useT()
  const [error, action, pending] = useActionState(login, null)
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center gap-3 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <RiFireFill className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">
            {t("hotToday crawler ops", "hotToday 爬虫运维")}
          </CardTitle>
          <CardDescription>
            {t(
              "Sign in to see how crawling and rounds are going",
              "登录后查看抓取和运行情况"
            )}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="user">{t("User name", "用户名")}</Label>
            <Input
              id="user"
              name="user"
              autoComplete="username"
              autoCapitalize="none"
              required
              autoFocus
              className="h-11 md:h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t("Password", "密码")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11 md:h-9"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="h-11 md:h-9">
            {pending && <Spinner data-icon="inline-start" aria-hidden />}
            {pending ? t("Signing in…", "登录中…") : t("Sign in", "登录")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export type RepairOp = {
  op: "approve" | "reject" | "revert" | "run" | "apply-chat"
  label: string
  /** The dialog's question before sending */
  confirm: { title: string; text: string }
  variant?: "default" | "outline" | "destructive"
}

// What the dialog says while each one runs: [English, 中文] for what it does and what it waits for
const REPAIR_BUSY: Record<
  RepairOp["op"],
  [[string, string], [string, string]?]
> = {
  approve: [
    ["Applying the patch", "正在应用补丁"],
    [
      "It goes into sources/, then the source runs once with the new code, at most 40 s",
      "写进 sources/ 后用新代码跑一次这个源，最多 40 秒",
    ],
  ],
  reject: [["Rejecting", "正在驳回"]],
  revert: [["Reverting the patch", "正在撤销补丁"]],
  run: [["Starting the analysis", "正在开始分析"]],
  "apply-chat": [
    ["Applying the change", "正在应用改动"],
    [
      "It goes into sources/, then the source runs once with the new code, at most 40 s",
      "写进 sources/ 后用新代码跑一次这个源，最多 40 秒",
    ],
  ],
}

/** Buttons for one repair task, or for starting one; the reply is repair.py's last output line. */
export function RepairButtons({
  id,
  source,
  ops,
}: {
  id?: number
  source: string
  ops: RepairOp[]
}) {
  const t = useT()
  const action = useAction()
  // asking stays set after closing, so the dialog keeps its text while it fades out
  const [asking, setAsking] = useState<RepairOp | null>(null)
  const [busy, wait] = REPAIR_BUSY[asking?.op ?? "run"]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ops.map((o) => (
        <Button
          key={o.op}
          variant={o.variant ?? "outline"}
          className="h-11 md:h-9"
          onClick={() => {
            setAsking(o)
            action.ask()
          }}
        >
          {o.label}
        </Button>
      ))}
      <ActionDialog
        action={action}
        title={asking?.confirm.title}
        description={asking?.confirm.text}
        confirm={asking?.label}
        destructive={asking?.variant === "destructive"}
        busy={t(...busy)}
        wait={wait && t(...wait)}
        onConfirm={() => {
          if (!asking) return
          const form = new FormData()
          form.set("id", String(id ?? ""))
          form.set("key", source)
          form.set("op", asking.op)
          action.run(() => repairAction(form))
        }}
      />
    </div>
  )
}

/** The message box of an AI agent chat, or of a new one (id null; the page moves to it once it exists).
 * Ctrl/⌘+Enter sends; the examples fill the box. */
export function ChatComposer({
  id,
  busy,
  examples = [],
}: {
  id: number | null
  busy: boolean // the model is still on the last message
  examples?: string[]
}) {
  const t = useT()
  const router = useRouter()
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const send = () => {
    if (!text.trim() || pending || busy) return
    setError(null)
    start(async () => {
      const form = new FormData()
      form.set("id", id ? String(id) : "new")
      form.set("text", text)
      const r = await chatAction(form).catch((e: Error): Reply => ({
        ok: false,
        text: e.message,
      }))
      if (!r.ok) return setError(r.text)
      setText("")
      if (!id && "id" in r) router.push(`/agent?c=${r.id}`)
    })
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="flex flex-col gap-2"
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            send()
          }
        }}
        maxLength={4000}
        aria-label={t("Message", "消息")}
        placeholder={
          id
            ? t(
                "Ask a follow-up, or ask for another change… (don't paste cookies or passwords)",
                "接着问，或者让它改别的……（别贴 cookie 和密码）"
              )
            : t(
                "Ask why a source fails, or describe a source to add… (don't paste cookies or passwords)",
                "问一个源为什么出错，或者说要加什么源……（别贴 cookie 和密码）"
              )
        }
        className="max-h-60 min-h-20"
      />
      {!text && examples.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {examples.map((x) => (
            <Button
              key={x}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setText(x)}
            >
              {x}
            </Button>
          ))}
        </div>
      )}
      {error && (
        <p className="text-sm [overflow-wrap:anywhere] text-destructive">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">
          {busy
            ? t("Wait for the reply before sending more", "等它回完再发下一条")
            : t(
                "Replies in the language you write in · Ctrl+Enter sends",
                "用你写的语言回复 · Ctrl+Enter 发送"
              )}
        </span>
        <Button
          type="submit"
          disabled={!text.trim() || pending || busy}
          className="h-11 md:h-9"
        >
          {pending ? (
            <Spinner data-icon="inline-start" aria-hidden />
          ) : (
            <RiSendPlane2Line data-icon="inline-start" />
          )}
          {t("Send", "发送")}
        </Button>
      </div>
    </form>
  )
}

/** A server action run from a dialog, so neither the wait nor the result is easy to miss. */
function useAction() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [reply, setReply] = useState<Reply | null>(null)
  return {
    open,
    pending,
    reply,
    /** Open the dialog on its question. */
    ask: () => {
      setReply(null)
      setOpen(true)
    },
    /** Run it; the dialog opens if it isn't open yet and stays open until the reply is in. */
    run: (send: () => Promise<Reply>) => {
      setReply(null)
      setOpen(true)
      start(async () => {
        const r = await send().catch((e: Error): Reply => ({
          ok: false,
          text: t(
            `The connection dropped while waiting for the reply (${e.message}). The server may have finished anyway; refresh the page in a moment to see.`,
            `等回复时连接断了（${e.message}）。操作可能已经在服务器上做完，过一会儿刷新页面看结果。`
          ),
        }))
        startTransition(() => setReply(r))
      })
    },
    onOpenChange: (next: boolean) => {
      if (!pending) setOpen(next)
    },
  }
}

// With an icon, shadcn's header splits its width in two; keep the text next to the icon instead.
const MEDIA_HEADER = "sm:grid-cols-[auto_1fr]"

/** The dialog of a useAction(): the question (children go under it, e.g. an input), then a spinner
 * and the seconds so far while the action runs, then its reply. */
function ActionDialog({
  action: a,
  title,
  description,
  confirm,
  destructive,
  busy,
  wait,
  onConfirm,
  children,
}: {
  action: ReturnType<typeof useAction>
  title?: React.ReactNode
  description?: React.ReactNode
  confirm?: string
  destructive?: boolean
  busy: string // what is happening while it runs
  wait?: string // what it waits for, and how long that usually takes
  onConfirm?: () => void
  children?: React.ReactNode
}) {
  const t = useT()
  return (
    <AlertDialog open={a.open} onOpenChange={a.onOpenChange}>
      <AlertDialogContent>
        {a.pending ? (
          <AlertDialogHeader className={MEDIA_HEADER}>
            <AlertDialogMedia>
              <Spinner aria-hidden className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>{busy}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                <>
                  {wait && `${wait}. `}
                  <Seconds /> s so far; this window stays open until it&apos;s
                  done.
                </>,
                <>
                  {wait && `${wait}。`}已经 <Seconds />{" "}
                  秒，做完之前这个窗口不会关。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
        ) : a.reply ? (
          <>
            <AlertDialogHeader className={MEDIA_HEADER}>
              <AlertDialogMedia
                className={
                  a.reply.ok
                    ? "bg-emerald-500/10 text-emerald-600"
                    : "bg-destructive/10 text-destructive"
                }
              >
                {a.reply.ok ? <RiCheckLine /> : <RiErrorWarningLine />}
              </AlertDialogMedia>
              <AlertDialogTitle>
                {a.reply.ok ? t("Done", "完成") : t("Didn't work", "没做成")}
              </AlertDialogTitle>
              <AlertDialogDescription className="[overflow-wrap:anywhere]">
                {a.reply.text}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel variant="default" autoFocus>
                {t("OK", "好")}
              </AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation() // portaled, but React still bubbles it to a form around the dialog
              onConfirm?.()
            }}
            className="contents"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            {children}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">
                {t("Cancel", "取消")}
              </AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant={destructive ? "destructive" : "default"}
              >
                {confirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Seconds since it appeared, counting up. */
function Seconds() {
  const [n, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="tabular-nums">{n}</span>
}

function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string
  label: string
  hint?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// repair.py names the limits in Chinese (settings().ranges, shown as they are in 中文); these are the
// English names, and what some of the numbers mean.
const LIMIT_NAMES: Record<RepairLimit, string> = {
  daily: "Max tasks per day",
  max_turns: "Max turns per task",
  max_tokens: "Max tokens per task",
  task_minutes: "Max minutes per task",
  max_patches: "Max patches per task",
  max_fetches: "Max URL fetches per task",
  dry_run_seconds: "Max seconds per sandbox crawl",
}
const LIMIT_HINTS: Partial<Record<RepairLimit, [string, string]>> = {
  daily: [
    "tasks that call the model, counted over 24 hours, manual ones too; 0 turns automatic analysis off",
    "调模型的任务，24 小时内算，手动的也算；填 0 不自动分析",
  ],
  dry_run_seconds: ["each test crawl", "每次试抓"],
}

/** AI repair settings, saved to ops.setting by repair.py inside the spider container. Sent by hand,
 * not as a form action: React resets a form after its action, which would drop edits a failed save
 * should keep. Test tries the model with what the form holds now, saved or not. */
export function RepairSettingsForm({
  settings: r,
}: {
  settings: SpiderConfig["repair"]
}) {
  const t = useT()
  const action = useAction()
  const test = useAction()
  const [tested, setTested] = useState("") // the model under test, for its dialog
  const form = useRef<HTMLFormElement>(null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  const key = useRef<HTMLInputElement>(null)
  const runTest = () => {
    const data = new FormData(form.current!)
    setTested(String(data.get("model") ?? ""))
    test.run(() => testModel(data))
  }
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        // The key is in data now; don't leave it in the page
        if (key.current) key.current.value = ""
        action.run(() => saveRepairSettings(data))
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          id="api_base"
          label={t("API URL", "接口地址")}
          hint={t(
            `OpenAI-compatible: /chat/completions calls the model, /models lists them; default ${r.defaults.api_base}`,
            `OpenAI 兼容接口：调模型用 /chat/completions，列模型用 /models；默认 ${r.defaults.api_base}`
          )}
          className="sm:col-span-2"
        >
          <Input
            id="api_base"
            name="api_base"
            defaultValue={r.api_base}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 font-mono md:h-9"
          />
        </Field>
        <Field
          id="api_key"
          label={t("API key", "密钥")}
          hint={
            r.key
              ? t(
                  `Using ${r.key} from hotToday/.env${r.key === "HOT_EMBED_KEY" ? " (shared with embedding)" : ""}. Leave empty to keep it; a key typed here goes into .env as HOT_REPAIR_KEY, never into the database`,
                  `现在用 hotToday/.env 里的 ${r.key}${r.key === "HOT_EMBED_KEY" ? "（和向量化共用）" : ""}；留空不改，填了就写进 .env 的 HOT_REPAIR_KEY，不进数据库`
                )
              : t(
                  "No key in .env, so the model can't be called; a key typed here goes into .env as HOT_REPAIR_KEY",
                  ".env 里没有密钥，调不了模型；填了就写进 .env 的 HOT_REPAIR_KEY"
                )
          }
          className="sm:col-span-2"
        >
          <Input
            ref={key}
            id="api_key"
            name="api_key"
            type="password"
            placeholder={
              r.key
                ? t("Set; leave empty to keep it", "已设置，留空不改")
                : t("No key", "没有密钥")
            }
            autoComplete="new-password"
            spellCheck={false}
            className="h-11 font-mono md:h-9"
          />
        </Field>
        <Field
          id="model"
          label={t("Model", "模型")}
          hint={
            r.models.length
              ? t(
                  `${count(r.models.length, "model")} from the API's /models; after changing the URL or key, save to list theirs. Default ${r.defaults.model}. Test tries the selected model with the URL and key above, saved or not.`,
                  `接口的 /models 列出 ${r.models.length} 个；换了接口地址或密钥，保存后这里按新的接口刷新。默认 ${r.defaults.model}。「测试」用上面的地址和密钥试选中的模型，不用先保存。`
                )
              : t(
                  `Couldn't list the models (${r.models_error ?? "the list is empty"}); type a name. Default ${r.defaults.model}`,
                  `读不到模型列表（${r.models_error ?? "列表是空的"}），先手填；默认 ${r.defaults.model}`
                )
          }
          className="sm:col-span-2"
        >
          <div className="flex gap-2">
            {r.models.length ? (
              <Select name="model" defaultValue={r.model}>
                <SelectTrigger
                  id="model"
                  className="h-11 min-w-0 flex-1 font-mono md:h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                {/* 30-odd models: a shorter list below the field instead of one covering the form */}
                <SelectContent
                  alignItemWithTrigger={false}
                  className="max-h-[min(18rem,var(--available-height))] font-mono"
                >
                  {!r.models.includes(r.model) && (
                    <SelectItem value={r.model}>
                      {t(
                        `${r.model} (not listed by the API)`,
                        `${r.model}（接口没列出它）`
                      )}
                    </SelectItem>
                  )}
                  {r.models.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model"
                name="model"
                defaultValue={r.model}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="h-11 min-w-0 flex-1 font-mono md:h-9"
              />
            )}
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              onClick={runTest}
            >
              {t("Test", "测试")}
            </Button>
          </div>
        </Field>
        {(Object.keys(r.ranges) as RepairLimit[]).map((key) => {
          const [min, max, name] = r.ranges[key]
          const hint = LIMIT_HINTS[key]
          return (
            <Field
              key={key}
              id={key}
              label={t(LIMIT_NAMES[key] ?? name, name)}
              hint={[
                hint && t(...hint),
                t(
                  `${min}–${max}, default ${r.defaults[key]}`,
                  `${min}–${max}，默认 ${r.defaults[key]}`
                ),
              ]
                .filter(Boolean)
                .join(t("; ", "；"))}
              className={key === "daily" ? "sm:col-span-2" : undefined}
            >
              <Input
                id={key}
                name={key}
                type="number"
                inputMode="numeric"
                defaultValue={r[key]}
                autoComplete="off"
                className="h-11 tabular-nums md:h-9"
              />
            </Field>
          )
        })}
      </div>
      <Field
        id="system"
        label={t("System prompt", "系统提示词")}
        hint={
          <>
            <span className="font-mono">
              {"{key} {patches} {fetches} {doc}"}
            </span>{" "}
            {t(
              "become the source's key, the limits on patches and URL fetches, and how to write source.yaml (the top of plugins.py). ",
              "会换成源的 key、补丁和抓网址的次数上限、source.yaml 的写法说明（plugins.py 开头那段）。"
            )}
            {r.custom_system
              ? t("This is an edited version.", "现在用的是改过的版本。")
              : t(
                  "This is the version built into repair.py.",
                  "现在用的是 repair.py 里的默认版本。"
                )}
          </>
        }
      >
        <Textarea
          ref={prompt}
          id="system"
          name="system"
          defaultValue={r.system}
          spellCheck={false}
          className="max-h-[560px] font-mono text-xs leading-5 md:text-xs"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-11 md:h-9">
          {t("Save", "保存")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            if (prompt.current) prompt.current.value = r.defaults.system
          }}
        >
          {t("Reset the prompt", "提示词恢复默认")}
        </Button>
        {r.updated_at && (
          <span className="text-sm text-muted-foreground">
            {t(
              `Changed by ${r.updated_by} at ${t.time(r.updated_at)}`,
              `${t.time(r.updated_at)} 由 ${r.updated_by} 改过`
            )}
          </span>
        )}
      </div>
      <ActionDialog
        action={action}
        busy={t("Saving the AI repair settings", "正在保存 AI 修复设置")}
      />
      <ActionDialog
        action={test}
        busy={t(`Testing ${tested}`, `正在测试 ${tested}`)}
        wait={t(
          "Two requests: the model has to call a tool, then answer with what the tool returned; usually a few seconds",
          "发两次请求：模型要先调用一个工具，再用工具返回的内容回答；通常几秒"
        )}
      />
    </form>
  )
}

/** subpool's tuning keys; saving rewrites them in subpool.conf and restarts subpool.service. */
export function SubpoolForm({
  values,
  fields,
  strategies,
}: {
  values: Record<SubpoolKey, string>
  fields: typeof SUBPOOL_FIELDS
  strategies: typeof SUBPOOL_STRATEGIES
}) {
  const t = useT()
  const action = useAction()
  const form = useRef<HTMLFormElement>(null)
  const items = Object.fromEntries(
    Object.entries(strategies).map(([v, label]) => [v, t(...label)])
  )
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        action.ask()
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          id="s"
          label={t("Strategy", "调度策略")}
          className="sm:col-span-2"
        >
          <Select name="s" defaultValue={values.s} items={items}>
            <SelectTrigger id="s" className="h-11 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(items).map(([v, label]) => (
                <SelectItem key={v} value={v}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {fields.map(({ key, label, hint }) => (
          <Field key={key} id={key} label={t(...label)} hint={t(...hint)}>
            <Input
              id={key}
              name={key}
              type="number"
              inputMode="numeric"
              defaultValue={values[key]}
              autoComplete="off"
              className="h-11 tabular-nums md:h-9"
            />
          </Field>
        ))}
      </div>
      <Field
        id="c"
        label={t("Check URL", "检测地址")}
        hint={t(
          "Node health checks and the watchdog both fetch it; #expect=200 is the status code it should return",
          "节点健康检测和看门狗都抓它；#expect=200 是期望的状态码"
        )}
      >
        <Input
          id="c"
          name="c"
          defaultValue={values.c}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className="h-11 font-mono md:h-9"
        />
      </Field>
      <div>
        <Button type="submit" className="h-11 md:h-9">
          {t("Save and restart", "保存并重启")}
        </Button>
      </div>
      <ActionDialog
        action={action}
        title={t("Save and restart subpool?", "保存并重启 subpool？")}
        description={t(
          "Only the settings in this card change; the subscriptions and the listener stay as they are. A restart reloads the subscriptions, so the proxy drops for a few to a dozen or so seconds, and sources using it may fail this once. Don't restart just after the hour.",
          "只改这一栏的设置，订阅和监听不动。重启要重新拉订阅，代理会断开几秒到十几秒，正在用代理的源这一次可能失败；整点刚过时别重启。"
        )}
        confirm={t("Save and restart", "保存并重启")}
        busy={t(
          "Writing subpool.conf and restarting",
          "正在写入 subpool.conf 并重启"
        )}
        wait={t(
          "Then it waits for nodes to pass their health checks, usually 10 to 30 s",
          "重启后等节点通过健康检测，通常 10 到 30 秒"
        )}
        onConfirm={() => {
          const data = new FormData(form.current!)
          action.run(() => saveSubpool(data))
        }}
      />
    </form>
  )
}

export type SubscriptionRow = {
  url: string // a file's path for f= lines
  file?: boolean // f= lines are only shown
  status: {
    nodes: number
    available: number
    ms: number
    error?: string
  } | null // null: subpool hasn't loaded this line (the file changed since it started)
}

type SubscriptionEdit = {
  op: "add" | "replace" | "delete"
  index: number
  url: string // the line as the page shows it; the server leaves a list that changed since alone
}

/** subpool.conf's subscriptions and what each gave at subpool's latest load. Adding, replacing or
 * deleting one rewrites subpool.conf and restarts subpool. */
export function Subscriptions({
  rows,
  checking,
}: {
  rows: SubscriptionRow[]
  checking: boolean // subpool just started: its first health checks are still running
}) {
  const t = useT()
  const action = useAction()
  // edit stays set after closing, so the dialog keeps its text while it fades out
  const [edit, setEdit] = useState<SubscriptionEdit | null>(null)
  const [bad, setBad] = useState(false) // the URL typed in the dialog isn't one
  const url = useRef<HTMLInputElement>(null)
  const ask = (e: SubscriptionEdit) => {
    setEdit(e)
    setBad(false)
    action.ask()
  }
  const send = () => {
    if (!edit) return
    const link = url.current?.value.trim() ?? ""
    if (edit.op !== "delete" && !/^https?:\/\/\S+$/.test(link))
      return setBad(true)
    const form = new FormData()
    form.set("op", edit.op)
    form.set("index", String(edit.index))
    form.set("old", edit.url)
    form.set("url", link)
    action.run(() => editSubscription(form))
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 sm:pl-6">
              {t("Subscription", "订阅")}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("Status", "状态")}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("Available / nodes", "可用 / 节点")}
            </TableHead>
            <TableHead className="hidden sm:table-cell">
              {t("Fetch time", "拉取用时")}
            </TableHead>
            <TableHead className="pr-4 sm:pr-6">
              <span className="sr-only">{t("Actions", "操作")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const s = r.status
            const badge = !s ? (
              <Badge variant="secondary">
                {t("Not loaded yet", "还没加载")}
              </Badge>
            ) : s.error ? (
              <Badge variant="destructive">
                {t("Fetch failed", "拉取失败")}
              </Badge>
            ) : s.available ? (
              <Badge variant="outline">{t("OK", "正常")}</Badge>
            ) : checking ? (
              <Badge variant="secondary">{t("Checking", "检测中")}</Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {t("No available node", "没有可用节点")}
              </Badge>
            )
            return (
              <TableRow key={`${i}-${r.url}`}>
                <TableCell className="w-full max-w-0 pl-4 sm:pl-6">
                  <span className="block font-mono text-xs [overflow-wrap:anywhere] whitespace-normal">
                    {r.file ? t(`File ${r.url}`, `文件 ${r.url}`) : r.url}
                  </span>
                  {s?.error && (
                    <span
                      title={s.error}
                      className="block truncate font-mono text-xs text-destructive"
                    >
                      {s.error}
                    </span>
                  )}
                  {/* phones have no room for the status column: the badge goes under the link */}
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground tabular-nums sm:hidden">
                    {badge}
                    {s &&
                      !s.error &&
                      t(
                        `${s.available} / ${s.nodes} available`,
                        `${s.available} / ${s.nodes} 可用`
                      )}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{badge}</TableCell>
                <TableCell className="hidden tabular-nums sm:table-cell">
                  {s ? (
                    <>
                      {s.available}{" "}
                      <span className="text-muted-foreground">/ {s.nodes}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                  {s ? t.ms(s.ms) : "—"}
                </TableCell>
                <TableCell className="pr-4 sm:pr-6">
                  {!r.file && (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          ask({ op: "replace", index: i, url: r.url })
                        }
                      >
                        {t("Replace", "替换")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={rows.length < 2}
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          ask({ op: "delete", index: i, url: r.url })
                        }
                      >
                        {t("Delete", "删除")}
                      </Button>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="px-4 pt-2 pb-2 sm:px-6">
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => ask({ op: "add", index: -1, url: "" })}
        >
          {t("Add a subscription", "添加订阅")}
        </Button>
      </div>
      <ActionDialog
        action={action}
        title={
          edit?.op === "add"
            ? t("Add a subscription", "添加订阅")
            : edit?.op === "replace"
              ? t(
                  `Replace subscription ${edit.index + 1}`,
                  `替换订阅 ${edit.index + 1}`
                )
              : t(
                  `Delete subscription ${(edit?.index ?? 0) + 1}?`,
                  `删除订阅 ${(edit?.index ?? 0) + 1}？`
                )
        }
        description={
          <>
            {edit?.op === "delete"
              ? t(
                  <>
                    The nodes of{" "}
                    <span className="font-mono [overflow-wrap:anywhere]">
                      {edit.url}
                    </span>{" "}
                    leave the pool.{" "}
                  </>,
                  <>
                    <span className="font-mono [overflow-wrap:anywhere]">
                      {edit.url}
                    </span>{" "}
                    的节点会从代理池里去掉。
                  </>
                )
              : edit?.op === "replace"
                ? t(
                    "Edit the link, then save. The new link is opened first; if it doesn't open, nothing is saved. ",
                    "改好链接再保存。保存前会先试着打开新链接，打不开就不保存。"
                  )
                : t(
                    "The link is opened first; if it doesn't open, nothing is saved. ",
                    "保存前会先试着打开这个链接，打不开就不保存。"
                  )}
            {t(
              "subpool restarts with the new subpool.conf, and the proxy drops for a few seconds; don't change it just after the hour.",
              "写入 subpool.conf 后重启 subpool，代理会断开几秒；整点刚过时别改。"
            )}
          </>
        }
        confirm={
          edit?.op === "delete"
            ? t("Delete and restart", "删除并重启")
            : t("Save and restart", "保存并重启")
        }
        destructive={edit?.op === "delete"}
        busy={
          edit?.op === "delete"
            ? t(
                "Deleting the subscription and restarting subpool",
                "正在删除订阅并重启 subpool"
              )
            : t(
                "Opening the link, then writing and restarting subpool",
                "正在试开链接，写入并重启 subpool"
              )
        }
        wait={
          edit?.op === "delete"
            ? t(
                "Then it waits for nodes to pass their health checks, usually 10 to 30 s",
                "重启后等节点通过健康检测，通常 10 到 30 秒"
              )
            : t(
                "It opens the link (up to 15 s), restarts and waits for nodes to pass their health checks; usually 20 to 50 s",
                "先试着打开链接（最多 15 秒），再重启、等节点通过健康检测，通常 20 到 50 秒"
              )
        }
        onConfirm={send}
      >
        {edit?.op !== "delete" && (
          <div className="flex flex-col gap-1.5">
            <Input
              ref={url}
              key={`${edit?.op}-${edit?.index}`}
              type="url"
              defaultValue={edit?.op === "replace" ? edit.url : ""}
              placeholder="https://…"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-label={t("Subscription link", "订阅链接")}
              aria-invalid={bad || undefined}
              onChange={() => setBad(false)}
              className="h-11 font-mono md:h-9"
            />
            {bad && (
              <p className="text-sm text-destructive">
                {t(
                  "Paste the full subscription link, starting with http(s)",
                  "要填 http(s) 开头的完整订阅链接"
                )}
              </p>
            )}
          </div>
        )}
      </ActionDialog>
    </>
  )
}
