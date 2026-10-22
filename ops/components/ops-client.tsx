"use client"

import {
  RiDashboardLine,
  RiDatabase2Line,
  RiFireFill,
  RiHistoryLine,
  RiLogoutBoxRLine,
  RiPulseLine,
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
import { Bar, BarChart, Cell, LabelList, XAxis } from "recharts"

import { saveRepairSettings, saveSubpool } from "@/app/(console)/config/actions"
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
import { Textarea } from "@/components/ui/textarea"
import type {
  RepairLimit,
  SpiderConfig,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  SubpoolKey,
} from "@/lib/ops"
import { cn, fmtTime } from "@/lib/utils"

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
}

const TONES = {
  bad: "var(--destructive)",
  low: "oklch(0.769 0.188 70.08)",
  muted: "var(--muted-foreground)",
}

/** Bar per round with the value on top; the tooltip shows the round's full time. */
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
  return (
    <ChartContainer
      config={{ value: { label, color } }}
      className="aspect-auto h-[200px] w-full lg:h-full lg:min-h-[200px]"
    >
      <BarChart
        data={data}
        margin={{ top: 18, left: 0, right: 0 }}
        accessibilityLayer
      >
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          interval={0}
          fontSize={11}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(_, p) => p[0]?.payload.title}
            />
          }
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} minPointSize={3}>
          {data.map((d) => (
            <Cell
              key={d.key}
              fill={d.tone ? TONES[d.tone] : "var(--color-value)"}
              fillOpacity={
                d.tone === "muted" ? 0.3 : fade && !d.tone ? 0.45 : 0.85
              }
            />
          ))}
          <LabelList
            dataKey="value"
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
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        const data = new FormData(e.currentTarget)
        startTransition(() => action(data))
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field
          id="model"
          label="模型"
          hint={`api.hotday.uk 上的模型名，默认 ${r.defaults.model}`}
          className="sm:col-span-2"
        >
          <Input
            id="model"
            name="model"
            defaultValue={r.model}
            autoCapitalize="none"
            spellCheck={false}
            className="h-11 font-mono md:h-9"
          />
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
