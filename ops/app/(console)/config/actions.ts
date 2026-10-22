"use server"

import { execFile } from "node:child_process"
import { readFile, rename, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"
import {
  getProxyStats,
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

// repair.py checks the values and writes ops.setting; this site only reads the database.
export async function saveRepairSettings(_: string | null, form: FormData) {
  const user = await requireUser()
  const settings = {
    model: String(form.get("model") ?? "").trim(),
    system: String(form.get("system") ?? ""),
    ...Object.fromEntries(
      REPAIR_LIMITS.map((key) => [key, Number(form.get(key) || NaN)])
    ),
  }
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
    refresh()
    return stdout.trim().split("\n").at(-1) || "完成"
  } catch (e) {
    return `没保存：${lastLine(e)}`
  }
}

// Rewrites only the tuning keys in subpool.conf (every other line, including the subscriptions and
// the listener's password, stays as it is), then restarts subpool.service; systemd waits for its
// READY, so the pool is back when this returns.
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
    const tmp = `${SUBPOOL_CONF}.tmp`
    await writeFile(tmp, lines.join("\n"), { mode: 0o600 })
    await rename(tmp, SUBPOOL_CONF)
    await run(
      "/usr/bin/sudo",
      ["-n", "/usr/bin/systemctl", "restart", "subpool.service"],
      { timeout: 90_000 }
    )
    refresh()
    // Nodes count as available once their first health check passes, a few seconds after the start.
    let now = await getProxyStats()
    for (let i = 0; i < 20 && !now.stats?.pool.available_nodes; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      now = await getProxyStats()
    }
    return (
      `已保存（${changed.join("、")}）并重启，` +
      (now.stats
        ? `${now.stats.pool.available_nodes} / ${now.stats.pool.total_nodes} 个节点可用`
        : `统计接口还连不上：${now.error}`)
    )
  } catch (e) {
    return `没做成：${lastLine(e)}`
  }
}
