import { RiArrowRightSLine, RiErrorWarningLine } from "@remixicon/react"
import type { Metadata } from "next"
import Link from "next/link"

import {
  RepairSettingsForm,
  SubpoolForm,
  Subscriptions,
  type SubscriptionRow,
} from "@/components/ops-client"
import { PageHeader, PageTitle, PillNav } from "@/components/ops"
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
import {
  getConfig,
  getProxyStats,
  getSubpoolConf,
  getT,
  statsName,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  type SourceConfig,
  type SpiderConfig,
} from "@/lib/ops"
import { count, type Translate } from "@/lib/i18n"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT()
  return { title: t("Config", "配置") }
}

const TABS = {
  sources: ["Sources", "源"],
  repair: ["AI repair", "AI 修复"],
  subpool: ["Proxy pool", "代理池"],
} as const
type Tab = keyof typeof TABS

// repair.py names its rules in Chinese; the English names go by reason code.
const RULE_NAMES: Record<string, string> = {
  missing_dep: "Image lacks a dependency; rebuild it",
  proxy_error: "Proxy unreachable",
  fetch_timeout: "Timed out",
  http_5xx: "Server error (5xx)",
  captcha: "Blocked or rate-limited",
  fetch_error: "Can't connect",
}

// Broken source.yaml first, then enabled, then disabled.
const rank = (s: SourceConfig) => (s.error ? 0 : s.enabled ? 1 : 2)

export default async function Config({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const asked = (await searchParams).tab ?? ""
  const t = await getT()
  const tab: Tab = asked in TABS ? (asked as Tab) : "sources"
  let config: SpiderConfig | null = null
  let error = ""
  // The subpool tab reads its own file; the other two need the spider container.
  if (tab !== "subpool")
    try {
      config = await getConfig()
    } catch (e) {
      const err = e as { stderr?: string; message?: string }
      error = (err.stderr || err.message || "").trim().split("\n").at(-1) ?? ""
    }

  return (
    <>
      <PageHeader crumbs={[[t("Ops", "运维"), "/"], [t("Config", "配置")]]} />
      <div className="flex flex-col gap-5 p-4 md:p-6">
        <PageTitle title={t("Config", "配置")} />
        <PillNav
          items={(Object.keys(TABS) as Tab[]).map((key) => ({
            href: key === "sources" ? "/config" : `/config?tab=${key}`,
            label: t(...TABS[key]),
            count: key === "sources" ? config?.sources.length : undefined,
            active: tab === key,
          }))}
        />
        {tab === "subpool" ? (
          <Subpool t={t} />
        ) : !config ? (
          <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
            <RiErrorWarningLine />
            <AlertTitle>{t("Can't read the config", "读不到配置")}</AlertTitle>
            <AlertDescription>
              <span className="font-mono break-all">{error}</span>
              <br />
              {t(
                "It is read by running task.py --config in the hottoday-spider container, so it stays empty while the container isn't running.",
                "配置是在 hottoday-spider 容器里跑 task.py --config 读出来的，容器没在运行时这里就是空的。"
              )}
            </AlertDescription>
          </Alert>
        ) : tab === "sources" ? (
          <Sources t={t} config={config} />
        ) : (
          <Repair t={t} repair={config.repair} />
        )}
      </div>
    </>
  )
}

function Sources({ t, config }: { t: Translate; config: SpiderConfig }) {
  const { sources, proxies } = config
  const rows = sources.toSorted(
    (a, b) => rank(a) - rank(b) || a.key.localeCompare(b.key)
  )

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("Proxies", "代理")}</CardTitle>
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
                    {t("Live status", "实时状态")}
                    <RiArrowRightSLine className="size-4" />
                  </Link>
                </div>
                <span className="text-muted-foreground">
                  {t(
                    `Used by ${count(users.length, "source")}: `,
                    `${users.length} 个源用它：`
                  )}
                  {users.map((s, i) => (
                    <span key={s.key}>
                      {i > 0 && t(", ", "、")}
                      <Link
                        href={`/sources/${s.key}`}
                        className="hover:underline"
                      >
                        {s.name}
                      </Link>
                      {!s.enabled && t(" (disabled)", "（停用）")}
                    </span>
                  ))}
                </span>
              </div>
            )
          })}
          {!Object.keys(proxies).length && (
            <span className="text-muted-foreground">
              {t("No proxies configured", "没有配置代理")}
            </span>
          )}
        </CardContent>
      </Card>

      <Card className="py-2">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">
                {t("Source", "源")}
              </TableHead>
              <TableHead>{t("Type", "方式")}</TableHead>
              <TableHead className="hidden lg:table-cell">
                {t("Fetches", "抓取")}
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("Proxy", "代理")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("Timeout", "超时")}
              </TableHead>
              <TableHead className="hidden md:table-cell">
                {t("Retries", "重试")}
              </TableHead>
              <TableHead className="pr-4 sm:pr-6">
                {t("Status", "状态")}
              </TableHead>
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
                <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                  {s.timeout}
                </TableCell>
                <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
                  {s.retries}
                </TableCell>
                <TableCell className="pr-4 sm:pr-6">
                  {s.error ? (
                    <span className="flex flex-col items-start gap-1">
                      <Badge variant="destructive">
                        {t("Broken source.yaml", "source.yaml 有错")}
                      </Badge>
                      <span className="text-xs break-all text-destructive">
                        {s.error}
                      </span>
                    </span>
                  ) : s.enabled ? (
                    <Badge variant="outline">{t("Hourly", "每小时")}</Badge>
                  ) : (
                    <span className="flex flex-col items-start gap-1">
                      <Badge variant="secondary">
                        {t("Disabled", "已停用")}
                      </Badge>
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

function Repair({
  t,
  repair: r,
}: {
  t: Translate
  repair: SpiderConfig["repair"]
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            {t(
              "Endpoint, model, limits and prompt",
              "接口、模型、限额和提示词"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RepairSettingsForm settings={r} />
        </CardContent>
      </Card>

      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>{t("Triage rules", "分流规则")}</CardTitle>
          <CardDescription>
            {t(
              "Matched in order; a match skips the model",
              "按顺序匹配，命中就不调模型"
            )}
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 sm:pl-6">
                {t("Error text pattern", "错误文本匹配")}
              </TableHead>
              <TableHead>{t("Reason code", "原因码")}</TableHead>
              <TableHead className="pr-4 sm:pr-6">
                {t("Filed as", "归类")}
              </TableHead>
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
                <TableCell className="pr-4 sm:pr-6">
                  {t(RULE_NAMES[rule.reason] ?? rule.label, rule.label)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {t("Fixed in repair.py", "写在 repair.py 里的部分")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <details>
            <summary className="cursor-pointer font-medium">
              {t("What {doc} in the prompt holds", "提示词里 {doc} 的内容")}
            </summary>
            <pre className="mt-2 max-h-[560px] overflow-auto rounded-in-card bg-muted/50 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
              {r.doc}
            </pre>
          </details>
          <details>
            <summary className="cursor-pointer font-medium">
              {t("The last-turn message", "最后一个回合")}
            </summary>
            <pre className="mt-2 overflow-auto rounded-in-card bg-muted/50 p-3 font-mono text-xs leading-5 whitespace-pre-wrap">
              {r.final}
            </pre>
          </details>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">{t("Tools", "工具")}</span>
            {r.tools.map((tool) => (
              <div key={tool.name} className="flex flex-wrap gap-x-2">
                <span className="font-mono text-xs leading-5">{tool.name}</span>
                <span className="text-muted-foreground">
                  {tool.description}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium">
              {t(
                "The only imports a patch may add",
                "补丁里新加的 import 只能是这些"
              )}
            </span>
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

async function Subpool({ t }: { t: Translate }) {
  const [conf, proxy] = await Promise.all([getSubpoolConf(), getProxyStats()])
  if ("error" in conf)
    return (
      <Alert className="border-destructive/15 bg-destructive/5 text-destructive">
        <RiErrorWarningLine />
        <AlertTitle>
          {t("Can't read subpool.conf", "读不到 subpool.conf")}
        </AlertTitle>
        <AlertDescription>
          <span className="font-mono break-all">{conf.error}</span>
        </AlertDescription>
      </Alert>
    )
  const p = "stats" in proxy ? proxy.stats : null
  // subpool lists its subscriptions in the file's order; a line it hasn't loaded has no result.
  const loaded = p?.subscribe.sources ?? []
  const rows: SubscriptionRow[] = [
    ...conf.urls.map((url) => ({ url, file: false })),
    ...conf.files.map((url) => ({ url, file: true })),
  ].map((r, i) => ({
    ...r,
    status:
      loaded[i]?.name === (r.file ? r.url : statsName(r.url))
        ? loaded[i]
        : null,
  }))
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t("Scheduling and checks", "调度和检测")}</CardTitle>
        </CardHeader>
        <CardContent>
          <SubpoolForm
            values={conf.values}
            fields={SUBPOOL_FIELDS}
            strategies={SUBPOOL_STRATEGIES}
          />
        </CardContent>
      </Card>
      <Card className="py-2">
        <CardHeader className="pt-4">
          <CardTitle>{t("Subscriptions", "订阅")}</CardTitle>
          <CardDescription>
            {p
              ? t(
                  `Loaded at ${t.time(Date.parse(p.subscribe.at) / 1000)}`,
                  `${t.time(Date.parse(p.subscribe.at) / 1000)} 拉取`
                )
              : t(
                  `subpool isn't running, so there are no load results: ${"error" in proxy ? proxy.error : ""}.`,
                  `subpool 没在运行，看不到拉取结果：${"error" in proxy ? proxy.error : ""}。`
                )}
          </CardDescription>
        </CardHeader>
        <Subscriptions rows={rows} checking={!!p && p.pool.uptime_sec < 30} />
      </Card>
    </>
  )
}
