"use server"

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"
import { done, failed, getT, type Reply } from "@/lib/ops"

const run = promisify(execFile)
const REPAIR = ["hottoday-spider", "python", "/app/repair.py"]

// hotToday's repair.py runs inside the spider container. Approve, reject and revert run as uid 1000
// so the files it writes stay owned by openclaw; an analysis needs root (its sandbox switches to
// nobody) and runs detached, so the page shows its progress instead of waiting. repair.py exits
// non-zero when it can't do what was asked; its last output line is the reply either way. That line
// is Chinese: in English a success gets the site's own words (the page shows the details), a failure
// keeps repair.py's reason.
export async function repairAction(form: FormData): Promise<Reply> {
  const user = await requireUser()
  const t = await getT()
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
      return done(
        t(
          "The analysis has started. Results come within a few minutes, and the page refreshes by itself.",
          "已开始分析，几分钟内出结果，页面会自动刷新"
        )
      )
    }
    if (!["approve", "reject", "revert"].includes(op) || !/^\d+$/.test(id))
      return failed(t("Bad request", "参数不对"))
    const { stdout } = await run(
      "/usr/bin/docker",
      ["exec", "-u", "1000:1000", ...REPAIR, op, id, "--by", user],
      { timeout: 60_000 }
    )
    refresh()
    const line = stdout.trim().split("\n").at(-1) || "完成"
    const ok = {
      approve:
        "Applied to sources/. The run with the new code is on the page now; the next two rounds decide whether it recovered.",
      reject: "Rejected. The files in sources/ stay as they were.",
      revert: "Reverted: sources/ is back to before the patch.",
    }[op as "approve" | "reject" | "revert"]
    return done(t(ok, line))
  } catch (e) {
    refresh() // the task may have changed under the page
    const err = e as { stderr?: string; message?: string }
    const why = (err.stderr || err.message || "").trim().split("\n").at(-1)
    return failed(t(`Failed: ${why}`, `没做成：${why}`))
  }
}
