import {
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto"

export const CAPTCHA_COOKIE = "hto_captcha"
export const CAPTCHA_SECONDS = 5 * 60
export const CAPTCHA_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict" as const,
  path: "/login",
}

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
const MAX_CHALLENGES = 2048
const MAX_IMAGES_PER_IP = 30
type Challenge = { hash: Buffer; ip: string; expires: number }
type State = {
  challenges: Map<string, Challenge>
  requests: Map<string, { count: number; expires: number }>
}

// Route Handlers and Server Actions have separate bundles. Share state across both in this
// single-process deployment; a restart safely invalidates outstanding challenges.
const shared = globalThis as typeof globalThis & { hotTodayCaptcha?: State }
const state = (shared.hotTodayCaptcha ??= {
  challenges: new Map(),
  requests: new Map(),
})

export function createCaptcha(ip: string, previous?: string) {
  const now = Date.now()
  for (const [token, challenge] of state.challenges)
    if (challenge.expires <= now) state.challenges.delete(token)
  for (const [key, request] of state.requests)
    if (request.expires <= now) state.requests.delete(key)

  const request = state.requests.get(ip)
  if (
    (request?.count ?? 0) >= MAX_IMAGES_PER_IP ||
    state.challenges.size >= MAX_CHALLENGES
  )
    return null

  if (previous && state.challenges.get(previous)?.ip === ip)
    state.challenges.delete(previous)
  state.requests.set(ip, {
    count: (request?.count ?? 0) + 1,
    expires: request?.expires ?? now + CAPTCHA_SECONDS * 1000,
  })
  const token = randomBytes(32).toString("base64url")
  const answer = Array.from(
    { length: 5 },
    () => ALPHABET[randomInt(ALPHABET.length)]
  ).join("")
  state.challenges.set(token, {
    hash: createHash("sha256").update(answer).digest(),
    ip,
    expires: now + CAPTCHA_SECONDS * 1000,
  })
  return { token, answer }
}

/** Every attempt consumes the challenge, including a wrong answer. Never trust a client-side check. */
export function consumeCaptcha(
  token: string | undefined,
  answer: string,
  ip: string
) {
  if (!token) return false
  const challenge = state.challenges.get(token)
  state.challenges.delete(token)
  if (!challenge || challenge.expires <= Date.now() || challenge.ip !== ip)
    return false
  const normalized = answer.trim().toUpperCase()
  if (!/^[A-Z2-9]{5}$/.test(normalized)) return false
  return timingSafeEqual(
    challenge.hash,
    createHash("sha256").update(normalized).digest()
  )
}
