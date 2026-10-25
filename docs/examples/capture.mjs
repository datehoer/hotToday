import assert from "node:assert/strict"
import { createHmac, randomBytes, scryptSync } from "node:crypto"
import { execFileSync, spawn } from "node:child_process"
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../..")
const ops = join(repo, "ops")
const output = join(repo, "docs/images")
const playwrightModule = process.env.PLAYWRIGHT_MODULE || "playwright-core"
const { chromium } = await import(
  playwrightModule.startsWith("/")
    ? pathToFileURL(playwrightModule).href
    : playwrightModule
)
const chrome = process.env.CHROME_PATH
assert(chrome, "Set CHROME_PATH to a Chrome/Chromium executable")
await access(chrome)
await access(join(ops, "node_modules/next/dist/bin/next"))

const catalog = execFileSync(
  "git",
  ["ls-files", "-z", "--", "sources/*/source.yaml"],
  { cwd: repo }
)
  .toString()
  .split("\0")
  .filter(Boolean)
const sourceCatalog = await Promise.all(
  catalog.map(async (name) => {
    const text = await readFile(join(repo, name), "utf8")
    return {
      key: name.split("/")[1],
      name: text.match(/^name:\s*(.+)$/m)[1].replace(/^["']|["']$/g, ""),
      enabled: !/^enabled:\s*false\b/m.test(text),
    }
  })
)
const stage = await mkdtemp(join(tmpdir(), "hottoday-examples-"))
let browser
let server
let serverLog = ""

try {
  // The allowlist comes from Git. Ignored .env files, node_modules and live data are never copied.
  const files = execFileSync("git", ["ls-files", "-z", "--", "ops"], {
    cwd: repo,
  })
    .toString()
    .split("\0")
    .filter(Boolean)
  for (const name of files) {
    assert(!name.split("/").some((part) => part.startsWith(".env")))
    const target = join(stage, name.slice(4))
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(repo, name), target)
  }
  await symlink(join(ops, "node_modules"), join(stage, "node_modules"), "dir")
  await mkdir(join(stage, "fixtures"))
  const fixture = (await readFile(join(here, "fixtures.mjs"), "utf8")).replace(
    "/* SOURCE_CATALOG */ []",
    JSON.stringify(sourceCatalog)
  )
  await writeFile(join(stage, "fixtures/example-db.mjs"), fixture)
  const dataFile = join(stage, "lib/ops.ts")
  let data = await readFile(dataFile, "utf8")
  assert(data.includes('import pg from "pg"'))
  assert(data.includes("const run = promisify(execFile)"))
  data = data
    .replace(
      'import pg from "pg"',
      'import pg from "@/fixtures/example-db.mjs"'
    )
    .replace(
      "const run = promisify(execFile)",
      'const run = async (..._args: unknown[]): Promise<{ stdout: string; stderr: string }> => { throw new Error("External commands are disabled in documentation previews") }'
    )
  await writeFile(dataFile, data)
  const nextConfig = join(stage, "next.config.ts")
  await writeFile(
    nextConfig,
    (await readFile(nextConfig, "utf8")).replace(
      "const nextConfig: NextConfig = {",
      "const nextConfig: NextConfig = {\n  devIndicators: false,"
    )
  )

  const listener = createServer()
  await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve))
  const port = listener.address().port
  await new Promise((resolve) => listener.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const secret = randomBytes(32).toString("base64url")
  const salt = randomBytes(16)
  const passwordHash = `scrypt:${salt.toString("base64url")}:${scryptSync(randomBytes(32), salt, 64).toString("base64url")}`
  const env = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "LANG"]
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]])
  )
  Object.assign(env, {
    NODE_ENV: "development",
    NEXT_TELEMETRY_DISABLED: "1",
    AUTH_USER: "demo",
    AUTH_PASSWORD_HASH: passwordHash,
    AUTH_SECRET: secret,
    HOTTODAY_DIR: join(stage, "fixtures"),
    SUBPOOL_CONF: join(stage, "fixtures/subpool.conf"),
  })
  // Invoke the installed CLI directly: node_modules is shared through a symlink.
  server = spawn(
    process.execPath,
    [
      join(ops, "node_modules/next/dist/bin/next"),
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    { cwd: stage, env, stdio: ["ignore", "pipe", "pipe"] }
  )
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      serverLog = (serverLog + chunk).slice(-20_000)
    })
  }
  const deadline = Date.now() + 90_000
  let ready = false
  while (Date.now() < deadline) {
    if (server.exitCode !== null)
      throw new Error("Documentation preview server exited")
    try {
      const response = await fetch(`${origin}/favicon.ico`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (response.ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  assert(ready, "Documentation preview server did not become ready")

  browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
  })
  const payload = Buffer.from(
    JSON.stringify({ u: "demo", exp: Math.floor(Date.now() / 1000) + 3600 })
  ).toString("base64url")
  const mac = createHmac("sha256", `${secret}:${passwordHash}`)
    .update(payload)
    .digest("base64url")
  await context.addCookies([
    {
      name: "hto_session",
      value: `${payload}.${mac}`,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
    },
  ])
  const allowed = new Set(["/", "/sources", "/agent"])
  await context.route("**/*", (route) => {
    const request = route.request()
    const url = new URL(request.url())
    // Block mutations, remote requests and prefetches of pages outside the three examples.
    return url.origin === origin &&
      request.method() === "GET" &&
      (allowed.has(url.pathname) ||
        url.pathname.startsWith("/_next/") ||
        url.pathname === "/favicon.ico")
      ? route.continue()
      : route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  await mkdir(output, { recursive: true })
  for (const [path, name, heading] of [
    ["/", "ops-overview", "Overview"],
    ["/sources", "ops-sources", "Sources"],
    ["/agent?c=7", "ops-ai-agent", "AI agent"],
  ]) {
    const response = await page.goto(origin + path, {
      waitUntil: "networkidle",
      timeout: 120_000,
    })
    assert.equal(response.status(), 200)
    await page.getByRole("heading", { name: heading, exact: true }).waitFor()
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(1_000)
    assert.equal(await page.locator("html").getAttribute("lang"), "en")
    assert(await page.getByText("demo", { exact: true }).count())
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth
      ),
      false
    )
    await page.screenshot({
      path: join(output, `${name}.png`),
      fullPage: path === "/",
      animations: "disabled",
    })
    console.log(`Captured ${name}.png`)
  }
  assert.deepEqual(errors, [], "Browser runtime errors")
  console.log(
    "Captured three English screenshots with fictional data; no live services were queried."
  )
} catch (error) {
  console.error(error.message)
  console.error(serverLog.slice(-5_000))
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve))
    server.kill("SIGTERM")
    await Promise.race([
      exited,
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ])
    if (server.exitCode === null) server.kill("SIGKILL")
  }
  await rm(stage, { recursive: true, force: true })
}
