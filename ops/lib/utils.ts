export { cn } from "cn"

// hotToday runs on Asia/Shanghai time; every time on the site is shown in it. Formatters with words
// (days, durations) are in lib/i18n.ts.
export const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Shanghai",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

export function fmtHour(epoch: number) {
  return clock.format(epoch * 1000).slice(0, 2)
}

export const daysSince = (epoch: number, now = Date.now() / 1000) =>
  Math.floor((now - epoch) / 86400)

export const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US")

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
