### 今日热榜 (Today's Hot Rankings)
前后端项目 (Frontend and Backend Project)：

- 前端 (Frontend): vue2 + element-ui + [iconpark图标库](https://iconpark.oceanengine.com/official)
- 后端 (Backend): python + fastapi
- Github: https://github.com/datehoer/hot-rank-web

爬虫项目 (Web Scraping Project)：主要利用requests进行请求，少数数据通过逆向参数获取。
mongodb -> postgresql

2025.3.3 修改：
- 将mongo改为了postgresql

2026.8.7 修改：
- 新增热榜数据清洗链路: 增量 ETL + embedding 向量化 (见下方「清洗链路 (ETL)」)

如果有什么问题/需求，欢迎提issue。
(Using requests for data collection, with some data obtained through parameter reverse engineering.
If you have any questions/requirements, please feel free to create an issue.)

demo: [~~原网站~~](https://hotrank.datehoer.com/) => https://www.hotday.uk/

目前采集平台有 (Current Collection Platforms):
- B站热榜 (Bilibili Hot Rankings)
- 抖音热搜 (Douyin Hot Search)
- 澎湃新闻 (The Paper News)
- 掘金热榜 (Juejin Hot Rankings)
- 少数派热榜 (Sspai Hot Rankings)
- 加密货币 (Cryptocurrency)
- 贴吧热议 (Tieba Hot Topics)
- 头条热榜 (Toutiao Hot Rankings)
- 微博热搜 (Weibo Hot Search)
- 知乎热榜 (Zhihu Hot Rankings)
- 虎扑社区热帖 (Hupu Community Hot Posts)
- 历史上的今天 (Today in History)
- 华尔街见闻 (Wall Street News)
- 微信阅读排行榜 (WeChat Reading Rankings)
- 36氪 (36Kr)
- 52破解热榜 (52pojie Hot Rankings)
- AcFun热榜 (AcFun Hot Rankings)
- 安全客安全快讯 (Anquanke Security News)
- 百度热搜 (Baidu Hot Search)
- 白鲸出海 (White Whale Overseas)
- CSDN热榜 (CSDN Hot Rankings)
- 电商报最新消息 (E-commerce News Latest)
- 第一财经热榜 (Yicai Hot Rankings)
- 懂车帝热搜榜 (Dongchedi Hot Search)
- 豆瓣电影排行 (Douban Movie Rankings)
- FreeBuf咨询 (FreeBuf News)
- GitHub Trending
- Google 热搜 (Google Hot Search)
- 虎嗅热文 (Huxiu Hot Articles)
- 3DM
- IT之家热榜 (IT Home Hot Rankings)
- 开眼 (Kaiyan)
- 看雪热门 (Kanxue Hot Topics)
- 宽带山热榜 (KDS Hot Rankings)
- PMCAFF精选 (PMCAFF Featured)
- 汽车之家热帖榜 (Autohome Hot Posts)
- 起点榜单 (Qidian Rankings)
- 水木社区热门话题 (SMTH Hot Topics)
- 新浪热门 (Sina Hot Topics)
- 新浪体育热门 (Sina Sports Hot Topics)
- 新浪新闻热门 (Sina News Hot Topics)
- 太平洋汽车热门 (PCauto Hot Topics)
- TapTap热门 (TapTap Hot Topics)
- 腾讯新闻热点榜 (Tencent News Hot Rankings)
- 人人都是产品经理热门 (Woshipm Hot Topics)
- 雪球热帖 (Xueqiu Hot Topics)
- 易车热门 (Yiche Hot Topics)
- 优设读报 (Uisdc News)
- 游戏陀螺文章推荐 (Youxituoluo Game News，原游戏葡萄 youxiputao 官网已停更迁移)
- 站酷榜单 (Zcool Rankings)
- 纵横24小时畅销榜 (Zongheng 24h Bestseller Rankings)
- hacknews
- 要知
- [我的博客](https://www.datehoer.com/)
- Linuxdo
- v2ex
- nodeseek
- hostloc
- wsl
- ft
- nytimes
- bloomberg
- yna
- tagesschau
- rt
- nhk
- newsau
- mumsnet
- foxnews
- 5ch
- dailymail
- asahi
- dzen

todo:
- https://lobste.rs/
- https://arstechnica.com/
- https://www.macrumors.com/
- https://thenextweb.com/
- https://www.theguardian.com/

---

## 源插件 (sources/)

每个源是 `sources/<key>/` 一个目录，`key` 就是 hot-rank-web 读的源表名。目录里的 `source.yaml` 写名称、是否启用、超时、重试、代理、怎么抓（`fetch`）和怎么提取（`extract`），字段说明在 `plugins.py` 开头。

- 接口和 RSS 源只要一个 `source.yaml`（`fetch.type: json` 或 `rss`）；要写代码的源用 `fetch.type: python`，`entry: spider:<函数>` 指向同目录的 `spider.py`
- 停用一个源：`enabled: false`，并写 `disabled_reason`
- 新源第一次写入时自动建表，清洗也按 `extract` 提取，不用再改 `task.py` 或别的文件
- 校验：`python task.py --check`；只抓不写库：`python task.py --only <key> …`；当前生效的源、代理和 AI 修复设置（JSON，运维页的「配置」读它）：`python task.py --config`
- 改源目录里的代码或 `source.yaml` 不用重建镜像：容器把仓库挂在 `/app`，每个整点重新启动 `task.py`，下一轮就用新代码
- 源要镜像里另装的东西（比如雪球要 node 和 jsdom）写在 `source.yaml` 的 `requires`（`bin` 程序、`pip` Python 包、`env` 环境变量，见 `plugins.py` 开头），并在 `Dockerfile` 里装好；改了 `requires` 或这些依赖要重建镜像。镜像里缺了，这个源记成「缺少依赖 …，要重建镜像」，别的源照常跑，`--check` 也会列出来
- 出错要抛异常，不要 `except` 之后返回空数据：那样只会记成 empty，看不到原因，AI 修复也会当成结构问题去改；`--check` 会列出这种写法
- `proxy: subpool` 走 `config.PROXIES` 里的 subpool 代理池（`/srv/projects/subpool`，systemd 服务 `subpool`，自带看门狗），运维页「状态」能看到它的节点和探测结果

## AI 修复 (repair.py)

每轮结束后，连续两轮失败的源自动开一个修复任务：代理、超时、连不上、镜像缺依赖这类记为运维处理；用代理、浏览器或 node 这类外部程序的源交给人；其余交给模型（默认 `deepseek-v4-pro`，24 小时内最多 4 个）。模型的补丁先在沙箱里试抓，检查全部通过后在运维页（ops.example.com）等人批准，批准后才写进 `sources/<key>/`，并立即用新代码跑一次（成功就写进源表），也能撤销。模型、接口地址、限额和系统提示词存在 `ops.setting`，在运维页「配置 → AI 修复」改；密钥不进库，在 `.env`（`HOT_REPAIR_KEY`，没有就用 `HOT_EMBED_KEY`），运维页也能改，`repair.py` 每次调模型都重新读这个文件。命令见 `repair.py` 开头。

## 运维中台 (ops/)

仓库分两部分：根目录是爬虫（`task.py`、`plugins.py`、`repair.py`、`sources/`、`etl/`），打进 Docker 镜像；`ops/` 是运维看板 ops.example.com（Next.js 16 + shadcn），不进镜像，单独以 systemd 服务 `hottoday-ops` 运行。看板用只读账号读 `task.py` 每轮写的 `ops` 表和各源表，显示代理池、PostgreSQL、Redis 的状态和当前配置；批准或撤销 AI 修复的补丁时，它在爬虫容器里调用 `repair.py`。构建、部署和登录见 [ops/README.md](ops/README.md)。

## 清洗链路 (ETL)

爬虫每小时整点运行 `task.py`，完成后自动执行增量清洗 + 向量化：

1. `etl/incremental.py` - 从 82 张源表按 checkpoint 水位线增量提取，upsert 到 `hot_topic` 汇总表
2. `etl/embedding_backfill.py` - 对 `hot_topic` 中 `embedding IS NULL` 的行调用 text-embedding-3-small 批量向量化（幂等断点续跑）
3. `etl/backfill.py` - 历史回填工具（手动运行）
4. `plugins.py` - 按各源 `source.yaml` 里的 `extract` 解析（title/url/hot_value）

### 新环境部署

```bash
# 1. 建表（幂等，可重复执行；需要 postgresql-16-pgvector 已安装）
psql -h <PG_HOST> -U admin -d hotday -f etl/schema.sql

# 2. 回填历史（可选，近 N 个月）
python etl/backfill.py --months 3

# 3. 增量+向量化由每小时 task.py 自动触发；也可手动跑一次
python etl/incremental.py
python etl/embedding_backfill.py --limit 8000
```

依赖：`psycopg2`、`httpx`、PostgreSQL 16 + pgvector 扩展。