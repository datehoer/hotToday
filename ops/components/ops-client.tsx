"use client"

import {
  RiDashboardLine,
  RiDatabase2Line,
  RiFireFill,
  RiHistoryLine,
  RiLogoutBoxRLine,
  RiPulseLine,
  RiRobot2Line,
  RiSettings3Line,
} from "@remixicon/react"
import Link, { useLinkStatus } from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  startTransition,
  useActionState,
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
} from "@/app/(console)/config/actions"
import { repairAction } from "@/app/(console)/sources/[id]/actions"
import { login, logout } from "@/app/login/actions"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
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
  SpiderConfig,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  SubpoolKey,
} from "@/lib/ops"
import { cn, fmtMs, fmtTime } from "@/lib/utils"

export type RoundBrief = {
  label: string
  state: string
  ok: number
  total: number
  next: string
}

const NAV = [
  { href: "/", label: "概况", icon: RiDashboardLine },
  { href: "/sources", label: "源", icon: RiDatabase2Line },
  { href: "/runs", label: "运行", icon: RiHistoryLine },
  { href: "/repairs", label: "AI 修复", icon: RiRobot2Line },
  { href: "/status", label: "状态", icon: RiPulseLine },
  { href: "/config", label: "配置", icon: RiSettings3Line },
]

export function AppSidebar({
  user,
  round,
  failing,
}: {
  user: string
  round: RoundBrief | null
  failing: number
}) {
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
                <span className="text-xs text-muted-foreground">爬虫运维</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
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
                  <span>{label}</span>
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
              {round.ok} / {round.total} 写入成功 · 下一轮 {round.next}
            </span>
          </div>
        )}
        <form action={logout} className="flex items-center gap-2 px-2 py-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium uppercase">
            {user[0]}
          </span>
          <span className="flex-1 truncate text-sm">{user}</span>
          <Button type="submit" variant="ghost" size="icon-sm" title="退出登录">
            <RiLogoutBoxRLine />
            <span className="sr-only">退出登录</span>
          </Button>
        </form>
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

// Durations are plotted in minutes, so the axis gets round ticks (0 / 2 / 4 分).
const format = (min: number) => fmtMs(min * 60_000)
const short = (min: number) => `${+min.toFixed(1)}\u00a0分`

/** Stacked columns per round of how long each part took (milliseconds in, one colour per part,
 * with a legend). */
export function StackBars({
  data: rows,
  parts,
}: {
  data: StackDatum[]
  parts: readonly { key: string; label: string; light: string; dark: string }[]
}) {
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
          { label: p.label, theme: { light: p.light, dark: p.dark } },
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
                `${p[0]?.payload.title} · 共 ${format(total(p[0]?.payload))}`
              }
              formatter={(value, name, item) => (
                <TooltipRow
                  label={
                    parts.find((p) => p.key === name)?.label ?? String(name)
                  }
                  value={format(Number(value))}
                  color={item.color}
                />
              )}
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
          加载中…
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
  const { pending } = useLinkStatus()
  return pending ? <Spinner aria-label="加载中" className="size-3.5" /> : null
}

/** No sign-up link: accounts only exist in the server's .env.local. */
export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null)
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center gap-3 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <RiFireFill className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-lg">hotToday 爬虫运维</CardTitle>
          <CardDescription>登录后查看抓取和运行情况</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="user">用户名</Label>
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
            <Label htmlFor="password">密码</Label>
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
            {pending ? "登录中…" : "登录"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export type RepairOp = {
  op: "approve" | "reject" | "revert" | "run"
  label: string
  /** Ask in a dialog before sending */
  confirm?: { title: string; text: string }
  variant?: "default" | "outline" | "destructive"
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
  const [message, action, pending] = useActionState(repairAction, null)
  // asking stays set after closing, so the dialog keeps its text while it fades out
  const [asking, setAsking] = useState<RepairOp | null>(null)
  const [open, setOpen] = useState(false)
  const send = (op: RepairOp["op"]) => {
    const form = new FormData()
    form.set("id", String(id ?? ""))
    form.set("key", source)
    form.set("op", op)
    startTransition(() => action(form))
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ops.map((o) => (
        <Button
          key={o.op}
          variant={o.variant ?? "outline"}
          disabled={pending}
          className="h-11 md:h-9"
          onClick={() => {
            if (!o.confirm) return send(o.op)
            setAsking(o)
            setOpen(true)
          }}
        >
          {o.label}
        </Button>
      ))}
      <Pending pending={pending} message={message}>
        {asking?.op === "approve" ? "应用补丁并用新代码跑一次…" : "处理中…"}
      </Pending>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{asking?.confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {asking?.confirm?.text}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              variant={
                asking?.variant === "destructive" ? "destructive" : "default"
              }
              onClick={() => {
                setOpen(false)
                if (asking) send(asking.op)
              }}
            >
              {asking?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/** What a form or button is doing: a spinner and `children` while pending, then the reply. */
function Pending({
  pending,
  message,
  children,
}: {
  pending: boolean
  message: string | null
  children: React.ReactNode
}) {
  if (!pending && !message) return null
  return (
    <span
      role="status"
      className="inline-flex items-center gap-2 text-sm text-muted-foreground"
    >
      {pending ? (
        <>
          <Spinner aria-hidden />
          {children}
        </>
      ) : (
        message
      )}
    </span>
  )
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

// Labels and ranges come from repair.py (settings().ranges); these add what a number means.
const LIMIT_HINTS: Partial<Record<RepairLimit, string>> = {
  daily: "调模型的任务，24 小时内算，手动的也算；填 0 不自动分析",
  dry_run_seconds: "每次试抓",
}

/** AI repair settings, saved to ops.setting by repair.py inside the spider container. Sent by hand,
 * not as a form action: React resets a form after its action, which would drop edits a failed save
 * should keep. */
export function RepairSettingsForm({
  settings: r,
}: {
  settings: SpiderConfig["repair"]
}) {
  const [message, action, pending] = useActionState(saveRepairSettings, null)
  const prompt = useRef<HTMLTextAreaElement>(null)
  const key = useRef<HTMLInputElement>(null)
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        // The key is in data now; don't leave it in the page
        if (key.current) key.current.value = ""
        startTransition(() => action(data))
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          id="api_base"
          label="接口地址"
          hint={`OpenAI 兼容接口：调模型用 /chat/completions，列模型用 /models；默认 ${r.defaults.api_base}`}
          className="sm:col-span-2"
        >
          <Input
            id="api_base"
            name="api_base"
            defaultValue={r.api_base}
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 font-mono md:h-9"
          />
        </Field>
        <Field
          id="api_key"
          label="密钥"
          hint={
            r.key
              ? `现在用 hotToday/.env 里的 ${r.key}${r.key === "HOT_EMBED_KEY" ? "（和向量化共用）" : ""}；留空不改，填了就写进 .env 的 HOT_REPAIR_KEY，不进数据库`
              : ".env 里没有密钥，调不了模型；填了就写进 .env 的 HOT_REPAIR_KEY"
          }
          className="sm:col-span-2"
        >
          <Input
            ref={key}
            id="api_key"
            name="api_key"
            type="password"
            placeholder={r.key ? "已设置，留空不改" : "没有密钥"}
            autoComplete="new-password"
            spellCheck={false}
            className="h-11 font-mono md:h-9"
          />
        </Field>
        <Field
          id="model"
          label="模型"
          hint={
            r.models.length
              ? `接口的 /models 列出 ${r.models.length} 个；换了接口地址或密钥，保存后这里按新的接口刷新。默认 ${r.defaults.model}`
              : `读不到模型列表（${r.models_error ?? "列表是空的"}），先手填；默认 ${r.defaults.model}`
          }
          className="sm:col-span-2"
        >
          {r.models.length ? (
            <NativeSelect
              id="model"
              name="model"
              defaultValue={r.model}
              className="w-full font-mono"
            >
              {!r.models.includes(r.model) && (
                <NativeSelectOption value={r.model}>
                  {r.model}（接口没列出它）
                </NativeSelectOption>
              )}
              {r.models.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {m}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          ) : (
            <Input
              id="model"
              name="model"
              defaultValue={r.model}
              autoCapitalize="none"
              spellCheck={false}
              className="h-11 font-mono md:h-9"
            />
          )}
        </Field>
        {(Object.keys(r.ranges) as RepairLimit[]).map((key) => (
          <Field
            key={key}
            id={key}
            label={r.ranges[key][2]}
            hint={[
              LIMIT_HINTS[key],
              `${r.ranges[key][0]}–${r.ranges[key][1]}，默认 ${r.defaults[key]}`,
            ]
              .filter(Boolean)
              .join("；")}
            className={key === "daily" ? "sm:col-span-2" : undefined}
          >
            <Input
              id={key}
              name={key}
              type="number"
              inputMode="numeric"
              defaultValue={r[key]}
              className="h-11 tabular-nums md:h-9"
            />
          </Field>
        ))}
      </div>
      <Field
        id="system"
        label="系统提示词"
        hint={
          <>
            <span className="font-mono">
              {"{key} {patches} {fetches} {doc}"}
            </span>{" "}
            会换成源的 key、补丁和抓网址的次数上限、source.yaml
            的写法说明（plugins.py 开头那段）。
            {r.custom_system
              ? "现在用的是改过的版本。"
              : "现在用的是 repair.py 里的默认版本。"}
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
        <Button type="submit" disabled={pending} className="h-11 md:h-9">
          {pending && <Spinner data-icon="inline-start" aria-hidden />}
          保存
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          className="h-11 md:h-9"
          onClick={() => {
            if (prompt.current) prompt.current.value = r.defaults.system
          }}
        >
          提示词恢复默认
        </Button>
        <Pending pending={pending} message={message}>
          保存中…
        </Pending>
        {!pending && !message && r.updated_at && (
          <span className="text-sm text-muted-foreground">
            {fmtTime(r.updated_at)} 由 {r.updated_by} 改过
          </span>
        )}
      </div>
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
  const [message, action, pending] = useActionState(saveSubpool, null)
  const form = useRef<HTMLFormElement>(null)
  const [open, setOpen] = useState(false)
  return (
    <form
      ref={form}
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setOpen(true)
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field id="s" label="调度策略" className="sm:col-span-2">
          <NativeSelect
            id="s"
            name="s"
            defaultValue={values.s}
            className="w-full"
          >
            {Object.entries(strategies).map(([v, label]) => (
              <NativeSelectOption key={v} value={v}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {fields.map(({ key, label, hint }) => (
          <Field key={key} id={key} label={label} hint={hint}>
            <Input
              id={key}
              name={key}
              type="number"
              inputMode="numeric"
              defaultValue={values[key]}
              className="h-11 tabular-nums md:h-9"
            />
          </Field>
        ))}
      </div>
      <Field
        id="c"
        label="检测地址"
        hint="节点健康检测和看门狗都抓它；#expect=200 是期望的状态码"
      >
        <Input
          id="c"
          name="c"
          defaultValue={values.c}
          autoCapitalize="none"
          spellCheck={false}
          className="h-11 font-mono md:h-9"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="h-11 md:h-9">
          {pending && <Spinner data-icon="inline-start" aria-hidden />}
          保存并重启
        </Button>
        <Pending pending={pending} message={message}>
          写入 subpool.conf，重启中…
        </Pending>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>保存并重启 subpool？</AlertDialogTitle>
            <AlertDialogDescription>
              只改这一栏的设置，订阅和监听不动。重启要重新拉订阅，代理会断开几秒到十几秒，正在用代理的源这一次可能失败；整点刚过时别重启。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setOpen(false)
                if (form.current) {
                  const data = new FormData(form.current)
                  startTransition(() => action(data))
                }
              }}
            >
              保存并重启
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  )
}

export type SubscriptionRow = {
  label: string // the origin only: the rest of a subscription URL is its access token
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
  label: string
}

/** subpool.conf's subscriptions and what each gave at subpool's latest load. Adding, replacing or
 * deleting one rewrites subpool.conf and restarts subpool; a full URL only ever goes to the server. */
export function Subscriptions({
  rows,
  checking,
}: {
  rows: SubscriptionRow[]
  checking: boolean // subpool just started: its first health checks are still running
}) {
  const [message, action, pending] = useActionState(editSubscription, null)
  // edit stays set after closing, so the dialog keeps its text while it fades out
  const [edit, setEdit] = useState<SubscriptionEdit | null>(null)
  const [open, setOpen] = useState(false)
  const url = useRef<HTMLInputElement>(null)
  const ask = (e: SubscriptionEdit) => {
    setEdit(e)
    setOpen(true)
  }
  const send = () => {
    if (!edit) return
    const form = new FormData()
    form.set("op", edit.op)
    form.set("index", String(edit.index))
    form.set("label", edit.label)
    form.set("url", url.current?.value ?? "")
    setOpen(false)
    startTransition(() => action(form))
  }
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4 sm:pl-6">订阅</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="hidden sm:table-cell">可用 / 节点</TableHead>
            <TableHead className="hidden sm:table-cell">拉取用时</TableHead>
            <TableHead className="pr-4 sm:pr-6">
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => {
            const s = r.status
            return (
              <TableRow key={`${i}-${r.label}`}>
                <TableCell className="w-full max-w-0 pl-4 sm:pl-6">
                  <span className="block truncate font-mono text-xs">
                    {r.file
                      ? `文件 ${r.label}`
                      : r.label.replace(/^https:\/\//, "")}
                  </span>
                  {s?.error && (
                    <span
                      title={s.error}
                      className="block truncate font-mono text-xs text-destructive"
                    >
                      {s.error}
                    </span>
                  )}
                  {s && !s.error && (
                    <span className="block truncate text-xs text-muted-foreground tabular-nums sm:hidden">
                      {s.available} / {s.nodes} 可用
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {!s ? (
                    <Badge variant="secondary">还没加载</Badge>
                  ) : s.error ? (
                    <Badge variant="destructive">拉取失败</Badge>
                  ) : s.available ? (
                    <Badge variant="outline">正常</Badge>
                  ) : checking ? (
                    <Badge variant="secondary">检测中</Badge>
                  ) : (
                    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      没有可用节点
                    </Badge>
                  )}
                </TableCell>
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
                  {s ? fmtMs(s.ms) : "—"}
                </TableCell>
                <TableCell className="pr-4 sm:pr-6">
                  {!r.file && (
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          ask({ op: "replace", index: i, label: r.label })
                        }
                      >
                        替换
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending || rows.length < 2}
                        className="text-destructive hover:text-destructive"
                        onClick={() =>
                          ask({ op: "delete", index: i, label: r.label })
                        }
                      >
                        删除
                      </Button>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-2 pb-2 sm:px-6">
        <Button
          variant="outline"
          disabled={pending}
          className="h-11 md:h-9"
          onClick={() => ask({ op: "add", index: -1, label: "" })}
        >
          添加订阅
        </Button>
        <Pending pending={pending} message={message}>
          {edit?.op === "delete"
            ? "写入 subpool.conf，重启中…"
            : "先试着打开链接，再写入并重启…"}
        </Pending>
      </div>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="contents"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>
                {edit?.op === "add"
                  ? "添加订阅"
                  : edit?.op === "replace"
                    ? `替换订阅 ${edit.index + 1}`
                    : `删除订阅 ${(edit?.index ?? 0) + 1}？`}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {edit?.op === "delete"
                  ? `${edit.label} 的节点会从代理池里去掉。`
                  : edit?.op === "replace"
                    ? `换掉 ${edit.label}。保存前会先试着打开新链接，打不开就不保存。`
                    : "保存前会先试着打开这个链接，打不开就不保存。"}
                写入 subpool.conf 后重启
                subpool，代理会断开几秒；整点刚过时别改。
              </AlertDialogDescription>
            </AlertDialogHeader>
            {edit?.op !== "delete" && (
              <Input
                ref={url}
                key={`${edit?.op}-${edit?.index}`}
                type="url"
                required
                placeholder="https://…"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-label="订阅链接"
                className="h-11 font-mono md:h-9"
              />
            )}
            <AlertDialogFooter>
              <AlertDialogCancel type="button">取消</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                variant={edit?.op === "delete" ? "destructive" : "default"}
              >
                {edit?.op === "delete" ? "删除并重启" : "保存并重启"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
