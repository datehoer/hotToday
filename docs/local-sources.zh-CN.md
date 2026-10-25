# 当地媒体和社区来源

[English](local-sources.md) · **简体中文**

本次新增加拿大、德国、韩国、澳大利亚和新西兰的 23 个独立来源，直接使用当地网站自己的订阅源或页面，每小时抓取，保留原标题和文章或讨论链接。英文、法文、德文和韩文标题保持原语言。

## 加拿大

| Key            | 网站与入口                                                                   | 内容选择       | 热度   |
| -------------- | ---------------------------------------------------------------------------- | -------------- | ------ |
| `cbc`          | [CBC Canada RSS](https://www.cbc.ca/webfeed/rss/rss-canada)                  | 加拿大最新新闻 | 未提供 |
| `globalnews`   | [Global News RSS](https://globalnews.ca/feed/)                               | 最新新闻       | 未提供 |
| `ctv`          | [CTV News RSS](https://www.ctvnews.ca/arc/outboundfeeds/rss/?outputType=xml) | 最新新闻       | 未提供 |
| `nationalpost` | [National Post RSS](https://nationalpost.com/feed/)                          | 最新新闻       | 未提供 |
| `radiocanada`  | [Radio-Canada RSS](https://ici.radio-canada.ca/info/rss/info/a-la-une)       | 法语要闻       | 未提供 |

## 德国

| Key            | 网站与入口                                                                | 内容选择       | 热度       |
| -------------- | ------------------------------------------------------------------------- | -------------- | ---------- |
| `spiegel`      | [SPIEGEL Topnews RSS](https://www.spiegel.de/schlagzeilen/tops/index.rss) | 编辑选出的头条 | 未提供     |
| `zeit`         | [ZEIT RSS](https://newsfeed.zeit.de/index)                                | 最新新闻       | 未提供     |
| `heise`        | [heise Atom](https://www.heise.de/rss/heise-atom.xml)                     | 最新科技新闻   | 未提供     |
| `sueddeutsche` | [Süddeutsche Topthemen RSS](https://rss.sueddeutsche.de/rss/Topthemen)    | 编辑选出的要闻 | 未提供     |
| `mydealz`      | [mydealz](https://www.mydealz.de/)                                        | 社区优惠精选   | 站内温度值 |

## 韩国

| Key          | 网站与入口                                                             | 内容选择           | 热度   |
| ------------ | ---------------------------------------------------------------------- | ------------------ | ------ |
| `naver_news` | [Naver 排行](https://news.naver.com/main/ranking/popularDay.naver)     | 各媒体自己的热读榜 | 未提供 |
| `newsis`     | [NEWSIS](https://www.newsis.com/realnews/)                             | 最多阅读侧栏       | 未提供 |
| `bizwatch`   | [Business Watch](https://news.bizwatch.co.kr/popular)                  | 财经热读           | 未提供 |
| `dcinside`   | [DC Inside 实时精选](https://gall.dcinside.com/board/lists/?id=dcbest) | 社区精选板块       | 浏览数 |
| `nate_pann`  | [Nate Pann](https://pann.nate.com/talk/ranking)                        | 社区实时排行       | 浏览数 |

Naver 这个页面没有韩国统一总榜，也没有公开阅读数。采集时先取各媒体的第一篇，再轮到第二篇，最多保留 100 篇去重文章。榜单序号不会当成阅读数。

## 澳大利亚

| Key         | 网站与入口                                 | 内容选择       | 热度           |
| ----------- | ------------------------------------------ | -------------- | -------------- |
| `abc_au`    | [ABC News](https://www.abc.net.au/news/)   | 编辑选出的头条 | 未提供         |
| `sbs_au`    | [SBS News](https://www.sbs.com.au/news)    | 首页头条       | 未提供         |
| `ozbargain` | [OzBargain](https://www.ozbargain.com.au/) | 社区首页优惠   | 赞同票减反对票 |

## 新西兰

| Key        | 网站与入口                                                                                   | 内容选择       | 热度           |
| ---------- | -------------------------------------------------------------------------------------------- | -------------- | -------------- |
| `stuff`    | [Stuff Atom](https://www.stuff.co.nz/rss)                                                    | 最新新闻       | 未提供         |
| `nzherald` | [NZ Herald RSS](https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/nz/?outputType=xml) | 新西兰最新新闻 | 未提供         |
| `tvnz`     | [TVNZ 1News](https://www.1news.co.nz/)                                                       | 首页头条       | 未提供         |
| `cheapies` | [ChoiceCheapies](https://www.cheapies.nz/)                                                   | 社区首页优惠   | 赞同票减反对票 |
| `geekzone` | [Geekzone](https://www.geekzone.co.nz/)                                                      | 最新讨论       | 未提供         |

## 抓取与验证

除 Naver 为覆盖多家媒体保留更多文章外，各源最多保留 20～30 条。不提供热度测量的来源沿用爬虫的 `hotScore: 0` 约定，这不代表实际热度。来源名称会区分最新新闻、编辑头条、热读榜和社区精选。不同站点的热度单位不同，不适合直接横向比较。

新增插件使用现有 Python 依赖，每个自定义解析器都放在自己的来源目录内，方便修复沙箱单独复制和验证。Atom、订阅域名与文章域名不同的情况也在各插件内处理。提取规则明确关闭通用兜底，页面改版或被拦截时会报错，不会把空数据记成成功。源码没有嵌入账号、个人 Cookie 或 API 密钥。

在项目根目录运行离线测试和只抓取验证：

```bash
python -m unittest discover -s tests -v
python task.py --check
python task.py --only cbc spiegel naver_news abc_au stuff
```

`--only` 不写快照、不调用向量化或 AI 修复。第一次正常采集成功时会自动创建新来源表，增量 ETL 随后自动发现它们。

## 前台发布

独立的 `hot-rank-web` API 从 Redis 的 `card_table` 读取展示卡片。新增爬虫目录不会自动注册到这个运行目录中。[local-source-cards.json](local-source-cards.json) 已按该 API 的格式准备 23 个 `{name, tablename}` 条目。首次快照产生后，按 `tablename` 合并到原列表，保留其他卡片和顺序，再清除 API 的 `rank` 缓存。现有 `parse_common` 已支持这些插件入库后的 `{title, url, hotScore}` 对象列表，不需要另写排行解析器。

Web Agent 的查询来源白名单另在 `hot-rank-web/hotrank/agent/` 管理，新增展示卡片不会自动开放 Agent 的来源筛选。本次准备了目录配置文件，没有修改线上 API 的 Redis 配置。

## 尚需可用公开入口的网站

2026 年 10 月 25 日，采集主机访问 RedFlagDeals、theqoo 和 Whirlpool 得到访问拒绝或验证挑战，La Presse RSS 也被拒绝，因此未启用这些插件。需要先验证可用的公开入口，再接入对应网站，不会用其他媒体的内容冒充它们的来源。
