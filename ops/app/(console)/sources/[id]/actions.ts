"use server"

import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"
import { done, failed, getT, type Reply } from "@/lib/ops"

const run = promisify(execFile)
const REPAIR = ["hottoday-spider", "python", "/app/repair.py"]

// hotToday's repair.py runs inside the spider container. Approve, reject, revert and applying a chat's
// change run as uid 1000 so the files it writes stay owned by openclaw; an analysis or a chat reply
// needs root (its sandbox switches to nobody) and runs detached, so the page shows its progress
// instead of waiting. repair.py exits non-zero when it can't do what was asked; its last output line
// is the reply either way. That line is Chinese: in English a success gets the site's own words (the
// page shows the details), a failure keeps repair.py's reason.
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
    if (
      !["approve", "reject", "revert", "apply-chat"].includes(op) ||
      !/^\d+$/.test(id)
    )
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
      "apply-chat":
        "Applied to sources/ and recorded as an AI repair task. The run with the new code is on the page now; the next two rounds decide whether it recovered.",
    }[op as "approve" | "reject" | "revert" | "apply-chat"]
    return done(t(ok, line))
  } catch (e) {
    refresh() // the task may have changed under the page
    return failed(why(e, t))
  }
}

// repair.py's reason for not doing it: the last line of its error output.
function why(e: unknown, t: Awaited<ReturnType<typeof getT>>) {
  const err = e as { stderr?: string; message?: string }
  const line = (err.stderr || err.message || "").trim().split("\n").at(-1)
  return t(`Failed: ${line}`, `没做成：${line}`)
}

/** A message on the AI agent page, in a chat (id) or a new one ("new"): repair.py records it, refusing
 * while the model is still on the last one, then the reply runs detached. Gives the chat's id. */
export async function chatAction(
  form: FormData
): Promise<Reply & { id?: number }> {
  const user = await requireUser()
  const t = await getT()
  const id = String(form.get("id") ?? "")
  const text = String(form.get("text") ?? "")
    .replaceAll("\0", "")
    .trim()
  if (!/^(\d+|new)$/.test(id) || !text || text.length > 4000)
    return failed(
      t("Write a message (up to 4,000 characters)", "消息要在 4000 字以内")
    )
  try {
    // --text=…: a message that starts with "-" still isn't an option
    const { stdout } = await run(
      "/usr/bin/docker",
      [
        "exec",
        "-u",
        "1000:1000",
        ...REPAIR,
        "say",
        id,
        "--by",
        user,
        `--text=${text}`,
      ],
      { timeout: 30_000 }
    )
    const chat = Number(/(\d+)\s*$/.exec(stdout)?.[1])
    await run("/usr/bin/docker", [
      "exec",
      "-d",
      ...REPAIR,
      "chat",
      String(chat),
    ])
    refresh()
    return { ...done(t("Sent", "已发送")), id: chat }
  } catch (e) {
    refresh()
    return failed(why(e, t))
  }
}
