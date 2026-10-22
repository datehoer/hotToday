// Two languages, English by default: the "lang" cookie picks one (the switch is in the sidebar and on
// the login page). Text is written where it is used, as t("English", "中文"); the formatters that put
// words around numbers come with t. Times are Asia/Shanghai in both, like hotToday itself.
// No server-only imports: client components use this too (useT in ops-client.tsx).
import { clock } from "@/lib/utils"

export const LANGS = ["en", "zh"] as const
export type Lang = (typeof LANGS)[number]
export const LANG_COOKIE = "lang"
export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang)

/** "1 source", "3 sources" for the English text; Chinese counts with a measure word instead. */
export const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`

function translator(lang: Lang) {
  const zh = lang === "zh"
  // A generic rest parameter, so a pair picked from an "as const" table spreads in: t(...TABS[key]).
  const t = <P extends readonly [en: unknown, cn: unknown]>(
    ...[en, cn]: P
  ): P[0] | P[1] => (zh ? cn : en)
  const date = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-US", {
    timeZone: "Asia/Shanghai",
    month: zh ? "numeric" : "short",
    day: "numeric",
  })

  /** "Sep 5", "9月5日". */
  const day = (epoch: number) => {
    const d = date.format(epoch * 1000)
    return zh ? `${d.replace("/", "月")}日` : d
  }

  /** "08:00" today, "Sep 5 11:00" otherwise. */
  const time = (epoch: number, now = Date.now() / 1000) => {
    const c = clock.format(epoch * 1000)
    return day(epoch) === day(now) ? c : `${day(epoch)} ${c}`
  }

  /** "5 min 07 s", "43 s", "0.4 s". */
  const ms = (ms: number | null | undefined) => {
    if (ms == null) return "—"
    const s = ms / 1000
    if (s < 0.1) return t("< 0.1 s", "不到 0.1 秒")
    if (s < 10) return t(`${s.toFixed(1)} s`, `${s.toFixed(1)} 秒`)
    const r = Math.round(s)
    if (r < 60) return t(`${r} s`, `${r} 秒`)
    const [m, rest] = [Math.floor(r / 60), String(r % 60).padStart(2, "0")]
    return t(`${m} min ${rest} s`, `${m} 分 ${rest} 秒`)
  }

  /** "since Sep 5 · 46 days" for a source whose last write was long ago. */
  const since = (epoch: number | null, now = Date.now() / 1000) => {
    if (epoch == null) return t("never wrote data", "没有写入记录")
    const days = Math.floor((now - epoch) / 86400)
    if (days < 1)
      return t(`since ${time(epoch, now)}`, `${time(epoch, now)} 起`)
    return t(
      `since ${day(epoch)} · ${count(days, "day")}`,
      `${day(epoch)}起 · ${days} 天`
    )
  }

  /** "3 d 4 h", "5 h 12 min", "12 min", "40 s". */
  const uptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d) return t(`${d} d ${h} h`, `${d} 天 ${h} 小时`)
    if (h) return t(`${h} h ${m} min`, `${h} 小时 ${m} 分`)
    if (m) return t(`${m} min`, `${m} 分`)
    return t(`${Math.floor(seconds)} s`, `${Math.floor(seconds)} 秒`)
  }

  return Object.assign(t, { lang, day, time, ms, since, uptime })
}

export const T = { en: translator("en"), zh: translator("zh") }
export type Translate = (typeof T)[Lang]
