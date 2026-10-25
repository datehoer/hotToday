// Fictional records for documentation screenshots. Never reads a live database.
const catalog = /* SOURCE_CATALOG */ []
const latestAt = Date.parse("2026-10-25T06:00:00Z") / 1000
const labels = {
  "36kr": "36Kr",
  "52pj": "52pojie",
  anquanke: "Anquanke",
  asahi: "Asahi Shimbun",
  baidu_hot_search: "Baidu Hot Search",
  baijingchuhai: "Baijing",
  bilibili_hot: "Bilibili",
  bloomberg: "Bloomberg",
  coolan: "Coolapk",
  crypto_coin: "Crypto Prices",
  dailymail: "Daily Mail",
  dianshangbao: "E-commerce News",
  diyicaijing: "Yicai",
  dongchedi: "Dongchedi",
  douban_movie: "Douban Movies",
  douyin_hot: "Douyin",
  ft: "Financial Times",
  gcores: "Gcores",
  google_search: "Google Trends",
  huxiu: "Huxiu",
  ithome: "IT Home",
  pengpai: "The Paper",
  sina_sport: "Sina Sports",
  wsj: "The Wall Street Journal",
  xueqiu: "Xueqiu",
  zhihu_hot_list: "Zhihu",
}
const failures = {
  google_search: ["error", "The response no longer contains trendingStories"],
  huxiu: ["error", "Upstream request timed out after 20 seconds"],
  wsj: ["empty", null],
}

const rounds = Array.from({ length: 24 }, (_, i) => ({
  started_at: latestAt - (23 - i) * 3600,
  finished_at: latestAt - (23 - i) * 3600 + 382,
  sources: catalog.filter((s) => s.enabled).length,
  crawl_ms: 351_800 + ((i * 821) % 18_000),
  etl_ms: 4_320 + i * 11,
  new_titles: 1_280 + ((i * 97) % 700),
  embed_ms: 21_640 + ((i * 173) % 4_000),
  embedded: 1_280 + ((i * 97) % 700),
  embed_failed: 0,
  error: null,
}))

const runs = rounds.flatMap((round, i) =>
  catalog.map((source, index) => {
    const usual = 20 + ((index * 7) % 31)
    const last = i === rounds.length - 1
    let status = source.enabled ? "ok" : "disabled"
    let error = null
    if (source.enabled && last && failures[source.key]) {
      ;[status, error] = failures[source.key]
    } else if (
      source.enabled &&
      !last &&
      ((index + i * 3) % 19 === 0 ||
        (source.key === "google_search" && i >= 20))
    ) {
      status = "error"
      error = "Example upstream response did not match the source schema"
    }
    return {
      round_at: round.started_at,
      source: source.key,
      name: labels[source.key] ?? source.name,
      status,
      items:
        status === "ok"
          ? last && source.key === "github"
            ? 8
            : usual + ((i + index) % 5)
          : status === "empty"
            ? 0
            : null,
      ms:
        status === "disabled"
          ? null
          : source.key === "huxiu" && last
            ? 60_000
            : 820 + ((index * 613 + i * 41) % 6_500),
      error,
      finished_at: round.started_at + 40 + (index % 40),
    }
  })
)

const checks = [
  { name: "Syntax", ok: true, note: "Python source compiles" },
  {
    name: "Source contract",
    ok: true,
    note: "Existing title, URL and heat fields preserved",
  },
  { name: "Sandbox fetch", ok: true, note: "20 usable items returned" },
]
const dryRun = {
  status: "ok",
  items: 20,
  ms: 846,
  error: null,
  sample: [
    ["Open-source software", "https://example.com/news/open-source", "12000"],
    ["Autumn travel ideas", "https://example.com/news/travel", "8500"],
    ["Space launch schedule", "https://example.com/news/space", "6200"],
  ],
}
const diff = [
  "--- a/sources/google_search/spider.py",
  "+++ b/sources/google_search/spider.py",
  "@@ -1,2 +1,2 @@",
  '-FEED_URL = "https://trends.google.com/trends/api/realtimetrends"',
  '+FEED_URL = "https://trends.google.com/trending/rss?geo=US"',
].join("\n")
const repairBase = {
  category: "structural",
  reason: "Source response format changed",
  evidence: [
    "The old response path is absent; the public RSS feed returns usable items.",
  ],
  model: "example-model",
  tokens: 8_420,
  attempts: 1,
  diff: null,
  dry_run: null,
  checks: null,
  verify: null,
  steps: [],
  log: [],
  created_at: latestAt + 400,
  updated_at: latestAt + 720,
  applied_at: null,
}
const repairs = [
  {
    ...repairBase,
    id: 24,
    source: "google_search",
    state: "awaiting_review",
    summary:
      "Switch Google Trends to its public RSS feed and keep the output fields.",
    diff,
    dry_run: dryRun,
    checks,
  },
  {
    ...repairBase,
    id: 23,
    source: "wsj",
    state: "analyzing",
    summary: "Checking the changed headlines response.",
  },
  {
    ...repairBase,
    id: 22,
    source: "huxiu",
    state: "handed_off",
    category: "ops",
    model: null,
    tokens: 0,
    reason: "Upstream request timed out",
    summary: "Check the network route before changing the parser.",
  },
]

const chats = [
  {
    id: 7,
    title: "Restore Google Trends",
    created_by: "demo",
    state: "idle",
    deadline: null,
    source: "google_search",
    model: "example-model",
    tokens: 8_420,
    created_at: latestAt + 420,
    updated_at: latestAt + 720,
    events: [
      {
        ts: latestAt + 420,
        kind: "user",
        by: "demo",
        text: "Google Trends stopped returning data. Can you fix it and keep the existing output fields?",
      },
      {
        ts: latestAt + 435,
        kind: "step",
        tool: "read_source",
        note: "Inspected the current parser and source manifest",
      },
      {
        ts: latestAt + 460,
        kind: "step",
        tool: "fetch_url",
        note: "Checked the public Google Trends RSS feed",
      },
      {
        ts: latestAt + 490,
        kind: "step",
        tool: "dry_run",
        note: "Validated 20 items in the isolated sandbox",
      },
      {
        ts: latestAt + 720,
        kind: "reply",
        text: "The old endpoint changed. The public RSS feed provides titles, article links and traffic counts. The proposed change passed all checks and returned 20 items in the sandbox. Review it below; the source files change only after you apply it.",
      },
    ],
    proposal: {
      key: "google_search",
      new: false,
      ts: latestAt + 720,
      note: "Use the RSS feed and preserve the existing output fields.",
      checks,
      dry_run: dryRun,
      diff,
    },
  },
  {
    id: 6,
    title: "Add a Hacker News source",
    created_by: "demo",
    state: "idle",
    deadline: null,
    source: "hacknews",
    model: "example-model",
    tokens: 6_180,
    created_at: latestAt - 3_200,
    updated_at: latestAt - 2_500,
    events: [],
    proposal: { key: "hacknews", new: true, ts: latestAt - 2_500, task: 18 },
  },
  {
    id: 5,
    title: "Why did FT stop updating?",
    created_by: "demo",
    state: "idle",
    deadline: null,
    source: "ft",
    model: "example-model",
    tokens: 3_740,
    created_at: latestAt - 7_200,
    updated_at: latestAt - 6_600,
    events: [],
    proposal: null,
  },
]

class Pool {
  async query(sql, args = []) {
    const text = sql.replace(/\s+/g, " ").trim().toLowerCase()
    let rows
    if (text.includes("from ops.round")) {
      rows = [...rounds].reverse().slice(0, args[0] ?? rounds.length)
    } else if (text.includes("from ops.run")) {
      rows = runs.filter((run) => args[0]?.includes(run.round_at))
    } else if (text.includes("from ops.repair")) {
      rows = repairs
    } else if (
      text.includes("from ops.chat") &&
      text.includes("where id = $1")
    ) {
      rows = chats.filter((chat) => chat.id === args[0])
    } else if (text.includes("from ops.chat")) {
      rows = chats.map((chat) => ({
        ...chat,
        events: undefined,
        proposal: chat.proposal
          ? chat.proposal.task
            ? "applied"
            : "pending"
          : null,
      }))
    } else {
      throw new Error(
        "Documentation fixtures do not support this database query"
      )
    }
    return { rows: structuredClone(rows) }
  }
}

export default { Pool, types: { builtins: { INT8: 20 }, setTypeParser() {} } }
