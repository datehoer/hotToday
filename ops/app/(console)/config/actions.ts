"use server"

import { execFile } from "node:child_process"
import { readFile, rename, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"
import {
  failure,
  getProxyStats,
  HOTTODAY,
  maskSubscription,
  REPAIR_LIMITS,
  SUBPOOL_CONF,
  SUBPOOL_DEFAULTS,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  type SubpoolKey,
} from "@/lib/ops"

const run = promisify(execFile)
const lastLine = (e: unknown) => {
  const err = e as { stderr?: string; message?: string }
  return (err.stderr || err.message || "").trim().split("\n").at(-1)
}

// repair.py checks the values and writes ops.setting; this site only reads the database. A new key
// goes to hotToday/.env instead (the container's env_file), which repair.py reads on every model call.
export async function saveRepairSettings(_: string | null, form: FormData) {
  const user = await requireUser()
  const settings = {
    model: String(form.get("model") ?? "").trim(),
    api_base: String(form.get("api_base") ?? "").trim(),
    system: String(form.get("system") ?? ""),
    ...Object.fromEntries(
      REPAIR_LIMITS.map((key) => [key, Number(form.get(key) || NaN)])
    ),
  }
  const key = String(form.get("api_key") ?? "").trim()
  if (key && !/^[\w.~+/=:-]{8,256}$/.test(key))
    return "没保存：密钥只能有字母、数字和 . _ ~ + / = : -"
  try {
    const { stdout } = await run(
      "/usr/bin/docker",
      [
        "exec",
        "-u",
        "1000:1000",
        "hottoday-spider",
        "python",
        "-B",
        "/app/repair.py",
        "settings",
        JSON.stringify(settings),
        "--by",
        user,
      ],
      { timeout: 30_000 }
    )
    let reply = stdout.trim().split("\n").at(-1) || "完成"
    refresh()
    if (key && !reply.startsWith("没保存")) {
      // the settings above are saved by now, so a failure here only concerns the key
      try {
        const file = `${HOTTODAY}/.env`
        const lines = (await readFile(/*turbopackIgnore: true*/ file, "utf8"))
          .split("\n")
          .filter((l) => l.split("=")[0].trim() !== "HOT_REPAIR_KEY")
        lines.splice(
          lines.at(-1) === "" ? -1 : lines.length,
          0,
          `HOT_REPAIR_KEY=${key}`
        )
        await writeFile(`${file}.tmp`, lines.join("\n"), { mode: 0o600 })
        await rename(`${file}.tmp`, file)
        reply += "；密钥已写进 .env"
      } catch (e) {
        reply += `；密钥没写进 .env：${lastLine(e)}`
      }
    }
    return reply
  } catch (e) {
    return `没保存：${lastLine(e)}`
  }
}

// Writes subpool.conf and restarts subpool.service; systemd waits for its READY, so the pool is back
// when this returns. If it doesn't come up with the new file, the old one goes back and it restarts again.
async function restartSubpool(old: string, text: string) {
  const write = async (t: string) => {
    await writeFile(`${SUBPOOL_CONF}.tmp`, t, { mode: 0o600 })
    await rename(`${SUBPOOL_CONF}.tmp`, SUBPOOL_CONF)
  }
  const restart = () =>
    run(
      "/usr/bin/sudo",
      ["-n", "/usr/bin/systemctl", "restart", "subpool.service"],
      { timeout: 90_000 }
    )
  await write(text)
  try {
    await restart()
  } catch {
    await write(old)
    await restart().catch(() => null)
    refresh()
    return null
  }
  refresh()
  // Nodes count as available once their first health check passes, a few seconds after the start.
  let now = await getProxyStats()
  for (let i = 0; i < 20 && !now.stats?.pool.available_nodes; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    now = await getProxyStats()
  }
  return now
}

const poolNow = (now: Awaited<ReturnType<typeof getProxyStats>>) =>
  now.stats
    ? `${now.stats.pool.available_nodes} / ${now.stats.pool.total_nodes} 个节点可用`
    : `统计接口还连不上：${now.error}`

// Rewrites only the tuning keys in subpool.conf (every other line, including the subscriptions and
// the listener's password, stays as it is), then restarts subpool.service.
export async function saveSubpool(_: string | null, form: FormData) {
  await requireUser()
  const values = {} as Record<SubpoolKey, string>
  for (const key of Object.keys(SUBPOOL_DEFAULTS) as SubpoolKey[])
    values[key] = String(form.get(key) ?? "").trim()
  for (const { key, label, range } of SUBPOOL_FIELDS)
    if (
      !/^\d+$/.test(values[key]) ||
      +values[key] < range[0] ||
      +values[key] > range[1]
    )
      return `${label}要填 ${range[0]} 到 ${range[1]} 的整数`
  if (!(values.s in SUBPOOL_STRATEGIES)) return "调度策略不对"
  if (!/^https?:\/\/[^\s#]+(#[\w=&.-]+)?$/.test(values.c))
    return "检测地址要是 http(s) 地址，可以带 #expect=200"

  try {
    const text = await readFile(/*turbopackIgnore: true*/ SUBPOOL_CONF, "utf8")
    const lines = text.split("\n")
    const changed: string[] = []
    for (const [key, v] of Object.entries(values)) {
      const at = lines.findLastIndex((l) => l.split("=")[0].trim() === key)
      const old =
        at < 0
          ? SUBPOOL_DEFAULTS[key as SubpoolKey]
          : lines[at].slice(lines[at].indexOf("=") + 1).trim()
      if (old === v) continue
      changed.push(`${key}=${v}`)
      if (at < 0)
        lines.splice(lines.at(-1) === "" ? -1 : lines.length, 0, `${key}=${v}`)
      else lines[at] = `${key}=${v}`
    }
    if (!changed.length) return "没有改动"
    const now = await restartSubpool(text, lines.join("\n"))
    if (!now) return "subpool 用新设置起不来，已改回原来的设置并重启"
    return `已保存（${changed.join("、")}）并重启，${poolNow(now)}`
  } catch (e) {
    return `没做成：${lastLine(e)}`
  }
}

// subpool fetches its subscriptions one after another while it starts, so a URL that hangs keeps the
// proxy down until subpool gives up on it (45 s): open it here first, with subpool's User-Agent.
async function tryOpen(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ClashForWindows/0.20.39" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return `链接返回 HTTP ${res.status}`
    if (!(await res.text()).trim()) return "链接返回的内容是空的"
    return null
  } catch (e) {
    return (e as Error).name === "TimeoutError"
      ? "链接 15 秒没有响应"
      : `链接打不开：${failure(e)}`
  }
}

// Subscription URLs carry access tokens, so the page never has them: an edit names its line by
// position plus the masked label the page showed, and a list that changed since then is left alone.
export async function editSubscription(_: string | null, form: FormData) {
  await requireUser()
  const op = String(form.get("op") ?? "")
  const index = Number(form.get("index") ?? -1)
  const url = String(form.get("url") ?? "").trim()
  if (!["add", "replace", "delete"].includes(op)) return "参数不对"
  if (op !== "delete") {
    if (!/^https?:\/\/\S+$/.test(url) || !URL.canParse(url))
      return "要填 http(s) 开头的订阅链接"
    const problem = await tryOpen(url)
    if (problem) return `没保存：${problem}`
  }
  try {
    const text = await readFile(/*turbopackIgnore: true*/ SUBPOOL_CONF, "utf8")
    const lines = text.split("\n")
    const key = (l: string) => l.split("=")[0].trim()
    const at = lines.flatMap((l, i) => (key(l) === "u" ? [i] : []))
    if (op !== "add") {
      const line = lines[at[index]]
      if (
        line == null ||
        maskSubscription(line.slice(line.indexOf("=") + 1).trim()) !==
          form.get("label")
      )
        return "订阅列表变了，刷新页面再试"
    }
    if (
      op === "delete" &&
      at.length + lines.filter((l) => key(l) === "f").length < 2
    )
      return "至少要留一个订阅"
    if (op === "replace") lines[at[index]] = `u=${url}`
    else if (op === "delete") lines.splice(at[index], 1)
    else
      lines.splice(
        at.length ? at.at(-1)! + 1 : lines.at(-1) === "" ? -1 : lines.length,
        0,
        `u=${url}`
      )
    const now = await restartSubpool(text, lines.join("\n"))
    if (!now) return "subpool 用新的订阅起不来，已改回原来的订阅并重启"
    const done = { add: "已添加", replace: "已替换", delete: "已删除" }[op]
    // subpool reports subscriptions in the same order: u= lines, then f= lines
    const sub =
      op !== "delete" &&
      now.stats?.subscribe.sources?.[op === "add" ? at.length : index]
    if (!sub) return `${done}并重启，${poolNow(now)}`
    return sub.error
      ? `${done}并重启，但这个订阅拉取失败：${sub.error}`
      : `${done}并重启，这个订阅拉到 ${sub.nodes} 个节点，正在检测`
  } catch (e) {
    return `没做成：${lastLine(e)}`
  }
}
