import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { afterEach, mock, test } from "node:test"
import vm from "node:vm"
import ts from "typescript"

import * as captcha from "../lib/captcha.ts"

let sequence = 0
const nextIp = () => `review-client-${++sequence}`
afterEach(() => mock.restoreAll())

test("a code is case-insensitive, opaque to the client, and can only be used once", () => {
  const ip = nextIp()
  const challenge = captcha.createCaptcha(ip)
  assert.match(challenge.token, /^[\w-]{43}$/)
  assert.match(challenge.answer, /^[A-HJKMNP-Z2-9]{5}$/)
  assert.equal(
    captcha.consumeCaptcha(
      challenge.token,
      ` ${challenge.answer.toLowerCase()} `,
      ip
    ),
    true
  )
  assert.equal(
    captcha.consumeCaptcha(challenge.token, challenge.answer, ip),
    false
  )
})

test("a wrong answer consumes the code and prevents subsequent guessing", () => {
  const ip = nextIp()
  const challenge = captcha.createCaptcha(ip)
  assert.equal(captcha.consumeCaptcha(challenge.token, "00000", ip), false)
  assert.equal(
    captcha.consumeCaptcha(challenge.token, challenge.answer, ip),
    false
  )
})

test("a code expires after five minutes", () => {
  const now = Date.now()
  mock.method(Date, "now", () => now)
  const ip = nextIp()
  const challenge = captcha.createCaptcha(ip)
  mock.method(Date, "now", () => now + captcha.CAPTCHA_SECONDS * 1000)
  assert.equal(
    captcha.consumeCaptcha(challenge.token, challenge.answer, ip),
    false
  )
})

test("a code is bound to its originating IP and cannot be moved to another client", () => {
  const ip = nextIp()
  const challenge = captcha.createCaptcha(ip)
  assert.equal(
    captcha.consumeCaptcha(challenge.token, challenge.answer, nextIp()),
    false
  )
  assert.equal(
    captcha.consumeCaptcha(challenge.token, challenge.answer, ip),
    false
  )
})

test("refresh invalidates the previous image's code", () => {
  const ip = nextIp()
  const old = captcha.createCaptcha(ip)
  const fresh = captcha.createCaptcha(ip, old.token)
  assert.equal(captcha.consumeCaptcha(old.token, old.answer, ip), false)
  assert.equal(captcha.consumeCaptcha(fresh.token, fresh.answer, ip), true)
})

test("image issuance is limited even when each previous code has been consumed", () => {
  const ip = nextIp()
  for (let i = 0; i < 30; i++) {
    const challenge = captcha.createCaptcha(ip)
    assert.ok(challenge)
    captcha.consumeCaptcha(challenge.token, challenge.answer, ip)
  }
  assert.equal(captcha.createCaptcha(ip), null)
})

const actionCode = ts.transpileModule(
  readFileSync(new URL("../app/login/actions.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }
).outputText

function loginFixture(passwordAccepted = false) {
  const ip = nextIp()
  const jar = new Map()
  let passwordChecks = 0
  const context = {
    exports: {},
    Date,
    Map,
    String,
    require(name) {
      if (name === "next/headers")
        return {
          headers: async () => new Headers({ "cf-connecting-ip": ip }),
          cookies: async () => ({
            get: (key) => (jar.has(key) ? { value: jar.get(key) } : undefined),
            set: (key, value, options) =>
              options?.maxAge === 0 ? jar.delete(key) : jar.set(key, value),
          }),
        }
      if (name === "next/navigation")
        return {
          redirect: (path) => {
            throw new Error(`redirect:${path}`)
          },
        }
      if (name === "@/lib/auth")
        return {
          checkLogin: () => {
            passwordChecks++
            return passwordAccepted
          },
          makeSession: () => "test-session",
          SESSION_COOKIE: "hto_session",
          SESSION_DAYS: 30,
        }
      if (name === "@/lib/captcha") return captcha
      if (name === "@/lib/i18n") return {}
      if (name === "@/lib/ops") return { getT: async () => (en) => en }
      throw new Error(`Unexpected import: ${name}`)
    },
  }
  vm.runInNewContext(actionCode, context)
  return {
    jar,
    checks: () => passwordChecks,
    challenge() {
      const challenge = captcha.createCaptcha(ip)
      jar.set(captcha.CAPTCHA_COOKIE, challenge.token)
      return challenge.answer
    },
    login(answer, state = { error: null, attempt: 0 }) {
      const form = new FormData()
      form.set("user", "test-user")
      form.set("password", "test-password")
      form.set("captcha", answer)
      form.set("next", "/")
      return context.exports.login(state, form)
    },
  }
}

test("missing, tampered or replayed challenges never reach password verification", async () => {
  const f = loginFixture(true)
  assert.match((await f.login("ABCDE")).error, /verification code/)
  f.jar.set(captcha.CAPTCHA_COOKIE, "tampered")
  assert.match((await f.login("ABCDE")).error, /verification code/)
  assert.equal(f.checks(), 0)
  assert.equal(f.jar.has("hto_session"), false)
})

test("valid captcha plus incorrect credentials fails, consumes the code, and advances the refresh", async () => {
  const f = loginFixture()
  const answer = f.challenge()
  const first = await f.login(answer)
  assert.equal(first.error, "Wrong user name or password")
  assert.equal(first.attempt, 1)
  const second = await f.login(answer, first)
  assert.match(second.error, /verification code/)
  assert.equal(second.attempt, 2)
  assert.equal(f.checks(), 1)
  assert.equal(f.jar.has("hto_session"), false)
})

test("correct credentials still require a valid captcha before creating a session", async () => {
  const f = loginFixture(true)
  f.challenge()
  assert.match((await f.login("00000")).error, /verification code/)
  assert.equal(f.checks(), 0)
  await assert.rejects(f.login(f.challenge()), /redirect:\//)
  assert.equal(f.checks(), 1)
  assert.equal(f.jar.get("hto_session"), "test-session")
  assert.equal(f.jar.has(captcha.CAPTCHA_COOKIE), false)
})

test("captcha failures also respect the existing five-attempt login limit", async () => {
  const f = loginFixture(true)
  for (let i = 0; i < 5; i++)
    assert.match((await f.login("")).error, /verification code/)
  assert.match((await f.login(f.challenge())).error, /Too many attempts/)
  assert.equal(f.checks(), 0)
})
