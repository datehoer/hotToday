import { RiArrowRightSLine, RiErrorWarningLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

import { Facts, PageHeader, PageTitle, PillNav } from "@/components/ops"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
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
import { getConfig, type SourceConfig, type SpiderConfig } from "@/lib/ops"
import { fmtNum } from "@/lib/utils"

export const metadata: Metadata = { title: "配置" }

const TABS = { sources: "源", repair: "AI 修复" } as const
type Tab = keyof typeof TABS

// Broken source.yaml first, then enabled, then disabled.
const rank = (s: SourceConfig) => (s.error ? 0 : s.enabled ? 1 : 2)

export default async function Config({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const tab: Tab = (await searchParams).tab === "repair" ? "repair" : "sources"
  let config: SpiderConfig | null = null
  let error = ""
  try {
    config = await getConfig()
  } catch (e) {
    const err = e as { stderr?: string; message?: string }
    error = (err.stderr || err.message || "").trim().split("\n").at(-1) ?? ""
  }

  return (
    <>
      <PageHeader crumbs={[["运维", "/"], ["配置"]]} />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title="配置">
          爬虫容器里 task.py --config 读到的设置，只读。要改就改 hotToday
          仓库里的文件，下一轮生效。
        </PageTitle>
        <PillNav
          items={(Object.keys(TABS) as Tab[]).map((key) => ({
            href: key === "sources" ? "/config" : `/config?tab=${key}`,
            label: TABS[key],
            count: key === "sources" ? config?.sources.length : undefined,
            active: tab === key,
          }))}
        />
        {!config ? (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            <RiErrorWarningLine />
            <AlertTitle>读不到配置</AlertTitle>
            <AlertDescription>
              <span className="font-mono break-all">{error}</span>
              <br />
              配置是在 hottoday-spider 容器里跑 task.py --config
              读出来的，容器没在运行时这里就是空的。
            </AlertDescription>
          </Alert>
        ) : tab === "sources" ? (
          <Sources config={config} />
        ) : (
          <Repair repair={config.repair} />
        )}
      </div>
    </>
  )
}

function Sources({ config }: { config: SpiderConfig }) {
  const { sources, proxies } = config
  const rows = sources.toSorted(
    (a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key)
  )
  const count = (f: (s: SourceConfig) => boolean) => sources.filter(f).length
  const types = Map.groupBy(
    sources.filter((s) => s.type),
    (s) => s.type!
  )

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {sources.length} 个源：{count((s) => !!s.enabled)} 个启用，
        {count((s) => s.enabled === false)} 个停用
        {count((s) => !!s.error) > 0 &&
          `，${count((s) => !!s.error)} 个 source.yaml 有错`}
        。抓取方式{" "}
        {[...types]
          .map(([type, list]) => `${type} ${list.length} 个`)
          .join("、")}
        ；运行记录保留 {config.keep_days} 天。点源名看它的文件。
      </p>

      <Card>
        <CardHeader>
          <CardTitle>代理</CardTitle>
          <CardDescription>
            hotToday config.py 里的 PROXIES，source.yaml 的 proxy
            字段填这里的名字；账号密码已隐藏
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {Object.entries(proxies).map(([name, url]) => {
            const users = sources.filter((s) => s.proxy === name)
            return (
              <div key={name} className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {url}
                  </span>
                  <Link
                    href="/status"
                    className="ml-auto inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                  >
                    实时状态
                    <RiArrowRightSLine className="size-4" />
                  </Link>
                </div>
                <span className="text-muted-foreground">
                  {users.length} 个源用它：
                  {users.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 && "、"}
                      <Link
                        href={`/sources/${s.key}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                      {!s.enabled && "（停用）"}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
          {!Object.keys(proxies).length && (
            <span className="text-muted-foreground">没有配置代理</span>
          )}
        </CardContent>
      </Card>

      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">源</TableHead>
              <TableHead>方式</TableHead>
              <TableHead className="hidden lg:table-cell">抓取</TableHead>
              <TableHead className="hidden sm:table-cell">代理</TableHead>
              <TableHead className="hidden text-right md:table-cell">
                超时
              </TableHead>
              <TableHead className="hidden text-right md:table-cell">
                重试
              </TableHead>
              <TableHead className="pr-4 sm:pr-6">状态</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.key} className="relative">
                <TableCell className="pl-4 sm:pl-6">
                  <Link
                    href={`/sources/${s.key}#config`}
                    className="flex flex-col after:absolute after:inset-0"
                  >
                    <span className="font-medium">{s.name ?? s.key}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {s.key}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  {s.type && <Badge variant="outline">{s.type}</Badge>}
                </TableCell>
                <TableCell className="hidden w-full max-w-0 lg:table-cell">
                  <span
                    title={s.target}
                    className="block truncate font-mono text-xs text-muted-foreground"
                  >
                    {s.target}
                  </span>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {s.proxy === "none" ? "—" : s.proxy}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                  {s.timeout}
                </TableCell>
                <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                  {s.retries}
                </TableCell>
                <TableCell className="pr-4 sm:pr-6">
                  {s.error ? (
                    <span className="flex flex-col items-start gap-1">
                      <Badge variant="destructive">source.yaml 有错</Badge>
                      <span className="text-xs break-all text-destructive">
                        {s.error}
                      </span>
                    </span>
                  ) : s.enabled ? (
                    <Badge variant="outline">每小时</Badge>
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      <Badge variant="secondary">已停用</Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.disabled_reason}
                      </span>
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  )
}

function Repair({ repair: r }: { repair: SpiderConfig["repair"] }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>模型</CardTitle>
            <CardDescription>
              在 hotToday/.env 里设
              HOT_REPAIR_MODEL、HOT_REPAIR_KEY、HOT_REPAIR_DAILY，重建爬虫容器后生效
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                [
                  "模型",
                  <span key="v" className="font-mono">
                    {r.model}
                  </span>,
                ],
                [
                  "接口",
                  <span key="v" className="font-mono break-all">
                    {r.api_url}
                  </span>,
                ],
                [
                  "密钥",
                  r.key === "HOT_EMBED_KEY"
                    ? "环境变量 HOT_EMBED_KEY，和向量化共用"
                    : r.key
                      ? `环境变量 ${r.key}`
                      : "没设置，调不了模型",
                ],
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>限额</CardTitle>
            <CardDescription>写在 repair.py 里</CardDescription>
          </CardHeader>
          <CardContent>
            <Facts
              rows={[
                [
                  "每天",
                  `最多 ${r.daily} 个调模型的任务（24 小时内，手动的也算）`,
                ],
                [
                  "每个任务",
                  `最多 ${r.max_turns} 个回合、${fmtNum(r.max_tokens)} tokens、${r.task_seconds / 60} 分钟`,
                ],
                [
                  "补丁",
                  `最多提交 ${r.max_patches} 次，抓 ${r.max_fetches} 个网址`,
                ],
                ["沙箱试抓", `每次最多 ${r.dry_run_seconds} 秒`],
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>分流规则</CardTitle>
          <CardDescription>
            按顺序匹配最近一次的错误，命中就归为运维处理，不调模型。用代理或浏览器的源交给人；其余（返回空、解析出错、条数偏低）交给模型。
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">错误文本匹配</TableHead>
              <TableHead>原因码</TableHead>
              <TableHead className="pr-4 sm:pr-6">归类</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.ops_rules.map((rule) => (
              <TableRow key={rule.reason}>
                <TableCell className="max-w-0 pl-4 sm:pl-6">
                  <span
                    className="block truncate font-mono text-xs"
                    title={rule.pattern}
                  >
                    {rule.pattern}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {rule.reason}
                </TableCell>
                <TableCell className="pr-4 sm:pr-6">{rule.label}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>提示词</CardTitle>
          <CardDescription>
            第一条用户消息由程序拼出：源的信息和最近 8
            轮结果、源目录里的文件、最后一次成功存下的数据结构、用现在的代码在沙箱里试抓的结果
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <details open>
            <summary className="cursor-pointer font-medium">系统提示词</summary>
            <pre className="mt-2 max-h-[560px] overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
              {r.system}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">
              最后一个回合
            </summary>
            <pre className="mt-2 overflow-auto rounded-xl bg-muted/50 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
              {r.final}
            </pre>
          </details>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">工具</span>
            {r.tools.map((t) => (
              <div key={t.name} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-xs leading-5">{t.name}</span>
                <span className="text-muted-foreground">{t.description}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">补丁里新加的 import 只能是这些</span>
            <div className="flex flex-wrap gap-1.5">
              {r.safe_imports.map((m) => (
                <Badge key={m} variant="secondary" className="font-mono">
                  {m}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
