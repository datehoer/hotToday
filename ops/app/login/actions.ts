"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  checkLogin,
  makeSession,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/auth"
import { isLang, LANG_COOKIE } from "@/lib/i18n"
import { getT } from "@/lib/ops"
import {
  CAPTCHA_COOKIE,
  CAPTCHA_COOKIE_OPTIONS,
  consumeCaptcha,
} from "@/lib/captcha"

export type LoginState = { error: string | null; attempt: number }

// Failed logins in the last 15 minutes, per client IP ("*" counts everyone).
// Cloudflare sits in front, so the client IP is in cf-connecting-ip.
const WINDOW = 15 * 60 * 1000
const failures = new Map<string, number[]>()

export async function login(
  previous: LoginState,
  form: FormData
): Promise<LoginState> {
  const t = await getT()
  const h = await headers()
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    "?"
  const now = Date.now()
  const recent = (key: string) =>
    (failures.get(key) ?? []).filter((at) => now - at < WINDOW)
  const reply = (error: string): LoginState => ({
    error,
    attempt: previous.attempt + 1,
  })
  if (recent(ip).length >= 5 || recent("*").length >= 50)
    return reply(
      t(
        "Too many attempts. Try again in 15 minutes.",
        "尝试次数太多，请 15 分钟后再试"
      )
    )

  const fail = (error: string) => {
    if (failures.size > 1000)
      for (const key of failures.keys())
        if (!recent(key).length) failures.delete(key)
    for (const key of [ip, "*"]) failures.set(key, [...recent(key), now])
    return reply(error)
  }
  const jar = await cookies()
  const validCaptcha = consumeCaptcha(
    jar.get(CAPTCHA_COOKIE)?.value,
    String(form.get("captcha") ?? ""),
    ip
  )
  jar.set(CAPTCHA_COOKIE, "", { ...CAPTCHA_COOKIE_OPTIONS, maxAge: 0 })
  if (!validCaptcha)
    return fail(
      t(
        "The verification code is wrong or expired. Enter the new code below.",
        "验证码错误或已过期，请输入下面的新验证码。"
      )
    )

  const user = String(form.get("user") ?? "").trim()
  if (!checkLogin(user, String(form.get("password") ?? ""))) {
    return fail(t("Wrong user name or password", "用户名或密码不对"))
  }

  failures.delete(ip)
  ;(await cookies()).set(SESSION_COOKIE, makeSession(user), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  })
  // Only same-site paths: "//host" and "/\host" would leave the site.
  const next = String(form.get("next") ?? "")
  redirect(/^\/(?![/\\])[^\\\s]*$/.test(next) ? next : "/")
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect("/login")
}

/** The language switch: a cookie for a year; the page re-renders in that language. */
export async function setLang(lang: string) {
  if (!isLang(lang)) return
  ;(await cookies()).set(LANG_COOKIE, lang, {
    path: "/",
    maxAge: 365 * 86400,
    sameSite: "lax",
  })
}
