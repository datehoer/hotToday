"use server"

import { cookies, headers } from "next/headers"
import { redirect } from "next/navigation"

import {
  checkLogin,
  makeSession,
  SESSION_COOKIE,
  SESSION_DAYS,
} from "@/lib/auth"

// Failed logins in the last 15 minutes, per client IP ("*" counts everyone).
// Cloudflare sits in front, so the client IP is in cf-connecting-ip.
const WINDOW = 15 * 60 * 1000
const failures = new Map<string, number[]>()

export async function login(_: string | null, form: FormData) {
  const h = await headers()
  const ip =
    h.get("cf-connecting-ip") ??
    h.get("x-forwarded-for")?.split(",")[0].trim() ??
    "?"
  const now = Date.now()
  const recent = (key: string) =>
    (failures.get(key) ?? []).filter((t) => now - t < WINDOW)
  if (recent(ip).length >= 5 || recent("*").length >= 50)
    return "尝试次数太多，请 15 分钟后再试"

  const user = String(form.get("user") ?? "").trim()
  if (!checkLogin(user, String(form.get("password") ?? ""))) {
    if (failures.size > 1000)
      for (const key of failures.keys())
        if (!recent(key).length) failures.delete(key)
    for (const key of [ip, "*"]) failures.set(key, [...recent(key), now])
    return "用户名或密码不对"
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
