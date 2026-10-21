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
import Link from "next/link"
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
      {pending ? "加载中…" : children}
    </Link>
  )
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
      {(pending || message) && (
        <span role="status" className="text-sm text-muted-foreground">
          {pending ? "处理中…" : message}
        </span>
      )}
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
