export { cn } from "cn"

// hotToday runs on Asia/Shanghai time; every time on the site is shown in it.
const TZ = "Asia/Shanghai"
const day = new Intl.DateTimeFormat("zh-CN", {
  timeZone: TZ,
  month: "numeric",
  day: "numeric",
})
const clock = new Intl.DateTimeFormat("zh-CN", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** "08:00" today, "9月5日 11:00" otherwise. */
export function fmtTime(epoch: number, now = Date.now() / 1000) {
  const t = clock.format(epoch * 1000)
  return day.format(epoch * 1000) === day.format(now * 1000)
    ? t
    : `${fmtDay(epoch)} ${t}`
}

export function fmtDay(epoch: number) {
  return day
    .format(epoch * 1000)
    .replace(/\//, "月")
    .replace(/$/, "日")
}

export function fmtHour(epoch: number) {
  return clock.format(epoch * 1000).slice(0, 2)
}

/** "5 分 07 秒", "43 秒", "0.4 秒". */
export function fmtMs(ms: number | null | undefined) {
  if (ms == null) return "—"
  const s = ms / 1000
  if (s < 0.1) return "不到 0.1 秒"
  if (s < 10) return `${s.toFixed(1)} 秒`
  const t = Math.round(s)
  if (t < 60) return `${t} 秒`
  return `${Math.floor(t / 60)} 分 ${String(t % 60).padStart(2, "0")} 秒`
}

export const daysSince = (epoch: number, now = Date.now() / 1000) =>
  Math.floor((now - epoch) / 86400)

/** "9月5日起 · 46 天" for a source whose last write was long ago. */
export function fmtSince(epoch: number | null, now = Date.now() / 1000) {
  if (epoch == null) return "没有写入记录"
  const days = daysSince(epoch, now)
  if (days < 1) return `${fmtTime(epoch, now)} 起`
  return `${fmtDay(epoch)}起 · ${days} 天`
}

export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US")

/** "3 天 4 小时", "5 小时 12 分", "12 分", "40 秒". */
export function fmtUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d) return `${d} 天 ${h} 小时`
  if (h) return `${h} 小时 ${m} 分`
  return m ? `${m} 分` : `${Math.floor(seconds)} 秒`
}

/** "14.2 GB", "530 MB". */
export function fmtBytes(n: number) {
  const units = ["B", "KB", "MB", "GB", "TB"]
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i ? 1 : 0)} ${units[i]}`
}

/** List length from a ?n= style param: `step` by default, at most `max`. */
export const listSize = (raw: string | undefined, step: number, max: number) =>
  Math.min(max, Math.max(step, Math.floor(Number(raw)) || step))
