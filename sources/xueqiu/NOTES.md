# 雪球 WAF / 认证机制实测笔记

2026-10-22 实测记录。起因：采集从 2026-09-22 起全部返回空。
结论：**已经是纯算法直连（完全不启浏览器）**，浏览器兜底已于同日移除，恢复方法见第八节。

## 结论速览

| 问题 | 结论 |
| --- | --- |
| `acw_sc__v2` 算法还有用吗 | **没有。雪球这一代 WAF 根本不发这个 cookie**，页面上没有 `arg1`、没有 `unsbox`/`hexXor`，网上那套算法完全对不上 |
| `xq_a_token` 需要登录吗 | **不需要**。匿名访客过完挑战就会拿到 `xq_a_token` / `xqat` / `xq_r_token` / `xq_id_token`(JWT) |
| 真正的闸门 | ① 阿里云新代 JS 挑战产出的 **URL 参数 `md5__1038`**；② 雪球政策层（按客户端指纹判，返回 HTTP 567「访问提示」） |
| 能纯直连吗 | **能**。Node + jsdom 跑挑战脚本自己算签名，实测稳定拿到 58KB JSON / 13 条 |

## 一、挑战页不是老版本

```
GET https://xueqiu.com/today   (curl_cffi, impersonate=chrome120)
→ 200, 110310 bytes

grep 标记：arg1: 0 处   acw_sc__v2: 0 处   unsbox/hexXor: 0 处
          aliyun_waf_aa: 1   renderData: 6   _waf_bd8ce2ce37: 4
```

结构：`<textarea id="renderData">{"_waf_bd8ce2ce37":"..."}</textarea>` + 内联混淆脚本
（字符串数组 + 控制流平坦化）+ 一个**路径每轮随机**的外链脚本（如 `/u21pn7x6/r8lw5pzu/psk8uqfi`）。

## 二、挑战怎么过（浏览器时序）

```
0  GET  /today                                ← 挑战页
1  GET  /u21pn7x6/r8lw5pzu/psk8uqfi           ← 挑战脚本
2  GET  /today?md5__1038=2790552d-<payload>   ← 带签名重载
3  GET  /today                                ← 通过
```

签名：`md5__1038=<8位hex>-<长串>`，前缀（`2790552d`）同一会话内固定。**是 URL 参数不是 cookie**。

## 三、匿名就有 token

过完 /today 后的 cookie：`xq_a_token`(40 hex) / `xqat` / `xq_r_token` / `xq_id_token`(JWT)
/ `device_id`(约 1 年) / `acw_tc`(0.5h)。全是 session cookie，**没有 `acw_sc__v2`**。
挑战页上「建议先登录」是误导。

## 四、算法方案（已落地）

关键洞察：**不需要逆混淆代码**，只要把雪球自己的挑战脚本放到无头环境里跑一遍，
它会自己算出签名。难点只有一个——jsdom 把跨文档跳转实现成 `Not implemented`，
而 `Location` 实例上的 `href`/`assign`/`replace` 全是不可重定义的。

解决办法：给 jsdom 的 `navigation.js` 里的 `navigate()` 插一个钩子，
`newURL` 就是目标 URL 记录，序列化即可拿到完整签名 URL。见 `waf/patch-jsdom.js`。

### 环境补齐

脚本用到的浏览器 API 很少：`document` / `navigator` / `localStorage` / `screen` /
`performance.now()` / `location`，**没有 WebGL、没有 AudioContext、没读 cookie**。
唯一缺的是 **2D canvas**（jsdom 不实现），`getContext('2d')` 返回 null 会直接抛错，
所以 `waf/solver.js` 里给了确定性桩（`measureText` / `getImageData` 等）。

### 完整链路（`spider.py::_fetch_direct`）

```
1. GET /today                                  → 挑战页
2. GET <外链脚本>                               → 挑战脚本
3. node waf/solver.js                          → 带 md5__1038 的 /today URL
4. GET <签名URL>                               → 真页面 + Set-Cookie: xq_a_token
5. GET listV2.json                            → 挑战页（接口也要单独过）
6. node waf/solver.js（针对接口 URL）           → 带签名的接口 URL
7. GET <签名URL>                               → 200 / 58724B JSON / 13 条
```

实测各步：挑战页 1.4s、外链 0.65s、solver 1.1s、重放 1.1s；整条 ~7s。

## 五、踩过的坑

| 现象 | 原因 |
| --- | --- |
| 直接把浏览器 cookie 塞进 curl 无效 | "是否通过挑战"不记在 cookie 上 |
| 用 /today 的签名去请求接口无效 | 签名绑定路径，必须按目标 URL 重新算 |
| 同一 proof 第二次用 → `400` | proof 一次性 |
| 几十次非浏览器请求后全部 567 | 政策层按指纹封，提示「几小时后自动解封」；同 IP 的浏览器不受影响 |
| `chrome124` / `chrome131` 被拦，`chrome120`/`chrome123` 通过 | 指纹档位差异，`XUEQIU_IMPERSONATE` 可调 |
| jsdom 里 `location.href` 拦截不到 | `href` 是实例自有且不可重定义的属性，只能 patch `navigate()` |
| `Cannot set properties of null (setting 'textBaseline')` | canvas 2d 未实现，需补桩 |

## 六、数据质量

JSON 比爬 DOM 好得多：`items[].original_status` 里有真标题、正文、作者、`created_at`、
`reply_count`。现在 `spider.py` 映射成：

- `title`：`title`，没有就用正文（去 HTML 标签、去 `$股票代码$`）
- `url`：`https://xueqiu.com/{user_id}/{id}`
- `author` / `time` / `replyCount`：额外字段，前端忽略但库里留着

## 七、运维

| 环境变量 | 作用 |
| --- | --- |
| `XUEQIU_IMPERSONATE` | curl_cffi 指纹档位，默认 `chrome120`（chrome124/131 会被 567 拦） |
| `WAF_NODE_PATH` | jsdom 的 node_modules，镜像里默认 `/opt/wafnode/node_modules` |
| `WAF_NODE_BIN` | node 可执行文件，默认 `node` |
| `WAF_WAIT_MS` | solver 等签名的上限，默认 15s |

**出错直接抛，不静默返回空数据**：任何环节失败都会让 `task.py` 记成 `error`，
运维页能看见。2026-09-22 那次之所以烂了一个月没人发现，就是因为老代码
`except` 之后 `return {"data": []}`。

## 八、浏览器兜底方案（2026-10-22 已移除）

当时为了先止血，`spider.py` 里有一条 patchright 真浏览器路径。直连跑通后删掉了，
因为直连并不慢（7s vs 6s）而且不用起 500MB 的 Chrome。

**如果哪天直连彻底坏掉、需要临时恢复抓取**，把下面这段加回 `spider.py`：

```python
try:
    from patchright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

CHROME_PATH = os.getenv("CHROME_PATH", "/opt/google/chrome/chrome")

# 关键：必须给真实 context。默认 headless context（没有 UA / viewport / locale）
# 会被雪球判成 AI 抓取工具，整站返回「请求异常已被安全策略拦截」。
# 这正是 2026-09-22 起连续一个月空数据的根因。
context = browser.new_context(
    user_agent=UA,
    viewport={"width": 1440, "height": 900},
    locale="zh-CN",
    timezone_id="Asia/Shanghai",
    extra_http_headers={"accept-language": "zh-CN,zh;q=0.9"},
)
page = context.new_page()
page.goto("https://xueqiu.com/today", timeout=30000, wait_until="domcontentloaded")

# DOM 结构（每条 .home__timeline__item）：
#   a[data-analytics-data] 的 href → 帖子详情页
#   h3                            → 文章标题（有的没有）
#   p                             → 正文（首行常是 $股票(代码)$ 标签，要丢掉）
#   .user-name / .timestamp       → 作者 / 时间
# 实测稳定 13 条 / 约 6s。
```

镜像里 Chrome 仍在（`/opt/google/chrome/chrome`，pin 在 Dockerfile），patchright 也仍在
`requirements.txt`，所以恢复时不用改镜像。

## 九、已知问题：AI 自动修复跑不动这个源

`repair.py` 的 `unsupported()` 靠 `patchright|playwright` 关键字判断「浏览器类源」。
直连版没有这两个词，于是 xueqiu **变成了可被 AI 自动修复的源**，但它的沙箱
（`dry_run`）只复制源目录**顶层的 .py/.yaml**，不复制子目录、也不传 `WAF_NODE_PATH`：

```
dry_run status: error
RuntimeError: 缺少 waf/solver.js
```

结果就是修复任务必然空跑、白烧 token（最多重试 RETRIES 次）。
根因和「运行时依赖表达不了」是同一件事：**框架假设「一个源 = 几个 Python 文件」**，
没有「源目录里还有别的资源」和「这个源需要什么运行时」的概念。
