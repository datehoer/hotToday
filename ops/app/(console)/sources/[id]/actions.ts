"use server"

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"

const run = promisify(execFile)
const REPAIR = ["hottoday-spider", "python", "/app/repair.py"]

// hotToday's repair.py runs inside the spider container. Approve, reject and revert run as uid 1000
// so the files it writes stay owned by openclaw; an analysis needs root (its sandbox switches to
// nobody) and runs detached, so the page shows its progress instead of waiting.
export async function repairAction(_: string | null, form: FormData) {
  const user = await requireUser()
  const op = String(form.get("op") ?? "")
  const id = String(form.get("id") ?? "")
  const key = String(form.get("key") ?? "")
  try {
    if (op === "run" && /^[a-z0-9_]+$/.test(key)) {
      await run("/usr/bin/docker", [
        "exec",
        "-d",
        ...REPAIR,
        "run",
        key,
        "--by",
        user,
      ])
      refresh()
      return "已开始分析，页面会自动刷新"
    }
    if (!["approve", "reject", "revert"].includes(op) || !/^\d+$/.test(id))
      return "参数不对"
    const { stdout } = await run(
      "/usr/bin/docker",
      ["exec", "-u", "1000:1000", ...REPAIR, op, id, "--by", user],
      { timeout: 60_000 }
    )
    refresh()
    return stdout.trim().split("\n").at(-1) || "完成"
  } catch (e) {
    const err = e as { stderr?: string; message?: string }
    return `没做成：${(err.stderr || err.message || "").trim().split("\n").at(-1)}`
  }
}
