"use server"

import { execFile } from "node:child_process"
import { readFile, rename, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { refresh } from "next/cache"

import { requireUser } from "@/lib/auth"
import { count, type Translate } from "@/lib/i18n"
import {
  done,
  failed,
  failure,
  getProxyStats,
  getT,
  HOTTODAY,
  REPAIR_LIMITS,
  SUBPOOL_CONF,
  SUBPOOL_DEFAULTS,
  SUBPOOL_FIELDS,
  SUBPOOL_STRATEGIES,
  type Reply,
  type SubpoolKey,
} from "@/lib/ops"

const run = promisify(execFile)
const lastLine = (e: unknown) => {
  const err = e as { stderr?: string; message?: string }
  return (err.stderr || err.message || "").trim().split("\n").at(-1)
}
const KEY = /^[\w.~+/=:-]{8,256}$/

// repair.py checks the values and writes ops.setting; this site only reads the database. A new key
// goes to hotToday/.env instead (the container's env_file), which repair.py reads on every model call.
// repair.py answers in Chinese; in English the reply is the site's own, or keeps repair.py's reason.
export async function saveRepairSettings(form: FormData): Promise<Reply> {
  const user = await requireUser()
  const t = await getT()
  const settings = {
    model: String(form.get("model") ?? "").trim(),
    api_base: String(form.get("api_base") ?? "").trim(),
    system: String(form.get("system") ?? ""),
    ...Object.fromEntries(
      REPAIR_LIMITS.map((key) => [key, Number(form.get(key) || NaN)])
    ),
  }
  const key = String(form.get("api_key") ?? "").trim()
  if (key && !KEY.test(key))
    return failed(
      t(
        "Not saved: the key can only have letters, digits and . _ ~ + / = : -",
        "没保存：密钥只能有字母、数字和 . _ ~ + / = : -"
      )
    )
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
    const line = stdout.trim().split("\n").at(-1) || "完成"
    refresh()
    if (line.startsWith("没保存"))
      return failed(
        t(`Not saved: ${line.replace(/^没保存[:：]\s*/, "")}`, line)
      )
    let reply = t(
      "Saved. The next round and every task after it use the new settings",
      line
    )
    if (key) {
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
        reply += t("; the key is in .env now", "；密钥已写进 .env")
      } catch (e) {
        return failed(
          t(
            `${reply}, but the key didn't go into .env: ${lastLine(e)}`,
            `${reply}；密钥没写进 .env：${lastLine(e)}`
          )
        )
      }
    }
    return done(t(`${reply}.`, reply))
  } catch (e) {
    return failed(t(`Not saved: ${lastLine(e)}`, `没保存：${lastLine(e)}`))
  }
}

/** The key repair.py would use: HOT_REPAIR_KEY in hotToday/.env, else HOT_EMBED_KEY. */
async function repairKey() {
  const env = new Map(
    (await readFile(/*turbopackIgnore: true*/ `${HOTTODAY}/.env`, "utf8"))
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [
        l.slice(0, l.indexOf("=")).trim(),
        l
          .slice(l.indexOf("=") + 1)
          .trim()
          .replace(/^['"]+|['"]+$/g, ""),
      ])
  )
  return env.get("HOT_REPAIR_KEY") || env.get("HOT_EMBED_KEY") || ""
}

const TEST_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup",
      description: "Returns the code word for this test",
      parameters: { type: "object", properties: {} },
    },
  },
]

// AI repair needs a model that calls tools and then reads what they return (the relay's Claude
// channels failed at that second step), so the test is one tool round trip, about 400 tokens. It uses
// what the form holds, saved or not: a key typed there first, else the one repair.py would use.
export async function testModel(form: FormData): Promise<Reply> {
  await requireUser()
  const t = await getT()
  const model = String(form.get("model") ?? "").trim()
  const base = String(form.get("api_base") ?? "")
    .trim()
    .replace(/\/+$/, "")
  if (!model) return failed(t("Pick a model first", "先选一个模型"))
  // before anything is sent: a key must not go to a mistyped address
  if (!/^https?:\/\/[^\s/?#]+(\/\S*)?$/.test(base) || !URL.canParse(base))
    return failed(
      t("The API URL must be an http(s) address", "接口地址要是 http(s) 地址")
    )
  const typed = String(form.get("api_key") ?? "").trim()
  if (typed && !KEY.test(typed))
    return failed(
      t(
        "The key can only have letters, digits and . _ ~ + / = : -",
        "密钥只能有字母、数字和 . _ ~ + / = : -"
      )
    )
  const key = typed || (await repairKey().catch(() => ""))
  if (!key)
    return failed(
      t(
        "No API key: type one above, or set HOT_REPAIR_KEY in hotToday/.env",
        "没有密钥：在上面填一个，或者在 hotToday/.env 里配 HOT_REPAIR_KEY"
      )
    )

  const word = `ok-${Math.random().toString(36).slice(2, 8)}`
  const messages: object[] = [
    {
      role: "user",
      content:
        "This is a connection test. Call the lookup tool, then reply with only the code word it returns.",
    },
  ]
  const took: string[] = []
  type Message = { content?: string | null; tool_calls?: { id: string }[] }
  const ask = async (): Promise<Message> => {
    const start = performance.now()
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 8000, // repair.py's request, so a pass means what it says
        tools: TEST_TOOLS,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000), // two of them stay under nginx's 60 s
    })
    const body = await res.text()
    took.push(t.ms(performance.now() - start))
    let data
    try {
      data = JSON.parse(body)
    } catch {
      // a wrong path often gets the relay's web page back, with a 200
      throw new Error(
        t(
          `HTTP ${res.status}, and the reply isn't JSON; is the API URL right? It starts: ${body.trim().slice(0, 60)}`,
          `HTTP ${res.status}，回复不是 JSON，接口地址对吗？开头是：${body.trim().slice(0, 60)}`
        )
      )
    }
    if (!res.ok)
      throw new Error(
        `HTTP ${res.status}: ${String(data.error?.message ?? body).slice(0, 200)}`
      )
    const message = data.choices?.[0]?.message
    if (!message)
      throw new Error(t("no message in the reply", "回复里没有 message"))
    return message
  }
  const said = (m: Message) =>
    m.content?.trim().slice(0, 200) || t("(nothing)", "（空）")

  let step = 1
  try {
    const first = await ask()
    if (!first.tool_calls?.length)
      return failed(
        t(
          `${model} answered in ${took[0]} but didn't call the tool, and AI repair works through tools. It said: ${said(first)}`,
          `${model} 回复了（${took[0]}），但没调用工具，AI 修复要靠工具。它说：${said(first)}`
        )
      )
    messages.push(
      // as repair.py sends it back: no content key when there was none
      {
        role: "assistant",
        ...(first.content != null && { content: first.content }),
        tool_calls: first.tool_calls,
      },
      ...first.tool_calls.map((c) => ({
        role: "tool",
        tool_call_id: c.id,
        content: word,
      }))
    )
    step = 2
    const second = await ask()
    if (!second.content?.includes(word))
      return failed(
        t(
          `${model} called the tool but didn't answer with what it returned. It said: ${said(second)}`,
          `${model} 调用了工具，但没用上工具返回的内容。它说：${said(second)}`
        )
      )
    return done(
      t(
        `${model} works: it called the tool and answered with its result (${took.join(" + ")}).`,
        `${model} 能用：调用了工具，也用上了工具返回的内容（${took.join(" + ")}）。`
      )
    )
  } catch (e) {
    const why =
      (e as Error).name === "TimeoutError"
        ? t("no answer in 20 s", "20 秒没有回复")
        : failure(e)
    return failed(
      step === 1
        ? t(`${model} doesn't work: ${why}`, `${model} 不能用：${why}`)
        : t(
            `${model} called the tool, but sending it the result failed: ${why}`,
            `${model} 调用了工具，但把工具结果发给它时出错：${why}`
          )
    )
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

const poolNow = (
  t: Translate,
  now: Awaited<ReturnType<typeof getProxyStats>>
) =>
  now.stats
    ? t(
        `${now.stats.pool.available_nodes} / ${now.stats.pool.total_nodes} nodes available`,
        `${now.stats.pool.available_nodes} / ${now.stats.pool.total_nodes} 个节点可用`
      )
    : t(
        `the stats endpoint isn't answering yet: ${now.error}`,
        `统计接口还连不上：${now.error}`
      )

// Rewrites only the tuning keys in subpool.conf (every other line, including the subscriptions and
// the listener's password, stays as it is), then restarts subpool.service.
export async function saveSubpool(form: FormData): Promise<Reply> {
  await requireUser()
  const t = await getT()
  const values = {} as Record<SubpoolKey, string>
  for (const key of Object.keys(SUBPOOL_DEFAULTS) as SubpoolKey[])
    values[key] = String(form.get(key) ?? "").trim()
  for (const { key, label, range } of SUBPOOL_FIELDS)
    if (
      !/^\d+$/.test(values[key]) ||
      +values[key] < range[0] ||
      +values[key] > range[1]
    )
      return failed(
        t(
          `${label[0]} must be a whole number from ${range[0]} to ${range[1]}`,
          `${label[1]}要填 ${range[0]} 到 ${range[1]} 的整数`
        )
      )
  if (!(values.s in SUBPOOL_STRATEGIES))
    return failed(t("Unknown strategy", "调度策略不对"))
  if (!/^https?:\/\/[^\s#]+(#[\w=&.-]+)?$/.test(values.c))
    return failed(
      t(
        "The check URL must be an http(s) address, optionally with #expect=200",
        "检测地址要是 http(s) 地址，可以带 #expect=200"
      )
    )

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
    if (!changed.length)
      return done(t("Nothing changed, so no restart", "没有改动，没重启"))
    const now = await restartSubpool(text, lines.join("\n"))
    if (!now)
      return failed(
        t(
          "subpool didn't start with the new settings; the old ones are back and it restarted",
          "subpool 用新设置起不来，已改回原来的设置并重启"
        )
      )
    return done(
      t(
        `Saved (${changed.join(", ")}) and restarted; ${poolNow(t, now)}`,
        `已保存（${changed.join("、")}）并重启，${poolNow(t, now)}`
      )
    )
  } catch (e) {
    return failed(t(`Failed: ${lastLine(e)}`, `没做成：${lastLine(e)}`))
  }
}

// subpool fetches its subscriptions one after another while it starts, so a URL that hangs keeps the
// proxy down until subpool gives up on it (45 s): open it here first, with subpool's User-Agent.
async function tryOpen(t: Translate, url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ClashForWindows/0.20.39" },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok)
      return t(
        `the link returned HTTP ${res.status}`,
        `链接返回 HTTP ${res.status}`
      )
    if (!(await res.text()).trim())
      return t("the link returned nothing", "链接返回的内容是空的")
    return null
  } catch (e) {
    return (e as Error).name === "TimeoutError"
      ? t("the link didn't answer in 15 s", "链接 15 秒没有响应")
      : t(`the link doesn't open: ${failure(e)}`, `链接打不开：${failure(e)}`)
  }
}

// An edit names its line by position plus the URL the page showed; a list that changed since then is
// left alone.
export async function editSubscription(form: FormData): Promise<Reply> {
  await requireUser()
  const t = await getT()
  const op = String(form.get("op") ?? "")
  const index = Number(form.get("index") ?? -1)
  const url = String(form.get("url") ?? "").trim()
  if (!["add", "replace", "delete"].includes(op))
    return failed(t("Bad request", "参数不对"))
  if (op !== "delete") {
    if (!/^https?:\/\/\S+$/.test(url) || !URL.canParse(url))
      return failed(
        t(
          "Paste a subscription link that starts with http(s)",
          "要填 http(s) 开头的订阅链接"
        )
      )
    const problem = await tryOpen(t, url)
    if (problem) return failed(t(`Not saved: ${problem}`, `没保存：${problem}`))
  }
  try {
    const text = await readFile(/*turbopackIgnore: true*/ SUBPOOL_CONF, "utf8")
    const lines = text.split("\n")
    const key = (l: string) => l.split("=")[0].trim()
    const at = lines.flatMap((l, i) => (key(l) === "u" ? [i] : []))
    if (op !== "add") {
      const line = lines[at[index]]
      if (line?.slice(line.indexOf("=") + 1).trim() !== form.get("old"))
        return failed(
          t(
            "The subscription list changed; refresh the page and try again",
            "订阅列表变了，刷新页面再试"
          )
        )
    }
    if (
      op === "delete" &&
      at.length + lines.filter((l) => key(l) === "f").length < 2
    )
      return failed(
        t("At least one subscription has to stay", "至少要留一个订阅")
      )
    if (op === "replace") lines[at[index]] = `u=${url}`
    else if (op === "delete") lines.splice(at[index], 1)
    else
      lines.splice(
        at.length ? at.at(-1)! + 1 : lines.at(-1) === "" ? -1 : lines.length,
        0,
        `u=${url}`
      )
    const now = await restartSubpool(text, lines.join("\n"))
    if (!now)
      return failed(
        t(
          "subpool didn't start with the new subscriptions; the old ones are back and it restarted",
          "subpool 用新的订阅起不来，已改回原来的订阅并重启"
        )
      )
    const did = t(
      { add: "Added", replace: "Replaced", delete: "Deleted" },
      { add: "已添加", replace: "已替换", delete: "已删除" }
    )[op as "add" | "replace" | "delete"]
    // subpool reports subscriptions in the same order: u= lines, then f= lines
    const sub =
      op !== "delete" &&
      now.stats?.subscribe.sources?.[op === "add" ? at.length : index]
    if (!sub)
      return done(
        t(
          `${did} and restarted; ${poolNow(t, now)}`,
          `${did}并重启，${poolNow(t, now)}`
        )
      )
    return sub.error
      ? failed(
          t(
            `${did} and restarted, but this subscription failed to load: ${sub.error}`,
            `${did}并重启，但这个订阅拉取失败：${sub.error}`
          )
        )
      : done(
          t(
            `${did} and restarted; this subscription gave ${count(sub.nodes, "node")}, now being checked`,
            `${did}并重启，这个订阅拉到 ${sub.nodes} 个节点，正在检测`
          )
        )
  } catch (e) {
    return failed(t(`Failed: ${lastLine(e)}`, `没做成：${lastLine(e)}`))
  }
}
