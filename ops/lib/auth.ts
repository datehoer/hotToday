// One admin account, defined in .env.local: AUTH_USER, AUTH_PASSWORD_HASH ("scrypt:<salt>:<hash>",
// base64url — no "$", which Next's env loader would expand) and AUTH_SECRET. There is no sign-up;
// the README has the one-liner that makes a new password.
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export const SESSION_COOKIE = "hto_session"
export const SESSION_DAYS = 30

export function checkLogin(user: string, password: string) {
  const [kind, salt, hash] = (process.env.AUTH_PASSWORD_HASH ?? "").split(":")
  if (kind !== "scrypt" || !salt || !hash) return false
  const want = Buffer.from(hash, "base64url")
  const got = scryptSync(password, Buffer.from(salt, "base64url"), want.length)
  return timingSafeEqual(got, want) && user === process.env.AUTH_USER
}

// The key includes the password hash, so a new password also ends every existing session.
function sign(data: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing")
  return createHmac("sha256", `${secret}:${process.env.AUTH_PASSWORD_HASH}`)
    .update(data)
    .digest("base64url")
}

export function makeSession(user: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  const data = Buffer.from(JSON.stringify({ u: user, exp })).toString(
    "base64url"
  )
  return `${data}.${sign(data)}`
}

/** The user name in a valid, unexpired session token, else null. */
export function readSession(token: string | undefined) {
  const [data, mac] = token?.split(".") ?? []
  if (!data || !mac) return null
  const want = Buffer.from(sign(data))
  const got = Buffer.from(mac)
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null
  const { u, exp } = JSON.parse(Buffer.from(data, "base64url").toString())
  return exp > Date.now() / 1000 && u === process.env.AUTH_USER
    ? (u as string)
    : null
}

export async function getUser() {
  return readSession((await cookies()).get(SESSION_COOKIE)?.value)
}

/** For pages and data reads: proxy.ts redirects too, but data must never depend on it alone. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect("/login")
  return user
}
