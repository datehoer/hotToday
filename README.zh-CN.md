# hotToday · 今日热榜

[English](README.md) · **简体中文**

按小时采集热榜、新闻和社区话题，支持来源插件、PostgreSQL 数据处理链路和运维后台。可以查看抓取失败的原因，让 AI 助手调查某个来源，并在审核通过沙箱测试的补丁后再应用。

[在线热榜](https://www.hotday.uk/) · [前端与 API](https://github.com/datehoer/hot-rank-web) · [后台部署](ops/README.zh-CN.md)

## 主要功能

- **84 个来源插件**：覆盖国内外新闻、社区、科技、财经、游戏与设计，每个来源独立维护 `sources/<key>/` 中的抓取和提取规则。
- **按小时采集**：每个来源可配置超时、重试、代理与依赖检查，原始快照和运行记录写入 PostgreSQL。
- **增量 ETL**：统一清洗标题、链接与热度，汇总到 `hot_topic`，支持向量化与断点续跑。
- **运维后台**：查看来源状态、最近 24 轮历史、条数偏低提醒、耗时、修复进度和服务状态，内置中英文切换。
- **AI 修复与对话**：诊断失败、提出改动、进行沙箱检查，等待人工批准；应用后立即跑一次来源，之后也能撤销。
- **登录保护**：管理员账号、签名会话、一次性图片验证码与登录限流。

面向用户的热榜网站和 API 位于 [hot-rank-web](https://github.com/datehoer/hot-rank-web)。本仓库包含爬虫、ETL、修复任务和运维后台。

## 后台示例

以下图片使用真实后台组件渲染，全部为**虚构的示例数据**。账号、运行记录、模型活动和文章样本均用于演示，不包含生产凭据或私有端点。

### 运行概况

查看哪些来源写入成功、哪些需要处理，以及最近 24 轮的采集、清洗和向量化情况。

![使用示例数据的后台概况：采集指标、来源异常和运行历史](docs/images/ops-overview.png)

### 来源状态

按状态筛选，对比本轮条数与通常条数，同时查看历史运行情况和 AI 修复进度。

![来源列表：示例错误、条数偏低提醒与 AI 修复状态](docs/images/ops-sources.png)

### AI 助手

调查已有来源，或提出新增来源的需求。检查分析过程、校验结果、沙箱样本和补丁，再决定是否应用。

![AI 助手示例：经过测试、等待人工批准的 Google Trends 补丁](docs/images/ops-ai-agent.png)

截图生成方式见 [docs/examples](docs/examples/README.md)。

## 快速开始

本地开发使用 Python 3.12；ETL 链路需要 PostgreSQL 16 和 pgvector。部分来源还依赖 Node.js 或 Chrome，[Dockerfile](Dockerfile) 会安装这些来源使用的浏览器和 Node 依赖。

```bash
git clone https://github.com/datehoer/hotToday.git
cd hotToday
python3.12 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp config.example.py config.py
cp .env.example .env
```

在 `.env` 中填写自己的连接配置，本地执行 Python 命令前先加载环境变量：

```bash
set -a
. ./.env
set +a
python task.py --check
```

`config.example.py` 从环境变量读取 PostgreSQL、Redis 和代理配置。复制后的 `config.py` 以及本地 `.env` 文件都被 Git 忽略，真实凭据只保存在这些本地文件中。

`--check` 会检查全部来源定义并报告缺失依赖。使用 `subpool` 代理的来源需要配置对应代理地址；有额外依赖的来源，需安装其 `requires` 中声明的包、程序或环境路径，也可以使用 Docker 镜像。

| 命令                                  | 用途                                 |
| ------------------------------------- | ------------------------------------ |
| `python task.py --check`              | 校验来源定义与依赖                   |
| `python task.py --only google_search` | 单独试抓，不写入数据库               |
| `python task.py --config`             | 查看生效的来源和修复配置             |
| `python task.py`                      | 执行完整采集、ETL 及已配置的后续任务 |

第一次完整运行前，使用自己的 PostgreSQL 连接初始化 ETL 表：

```bash
PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -f etl/schema.sql
python task.py
```

建表脚本需要 pgvector。各来源快照表和 `ops` 运行表由爬虫创建。将 `python task.py` 配置为每小时整点运行；Docker 入口每次启动同样只执行一轮。挂载仓库后，下一轮会使用更新的来源代码；改变镜像依赖时需要重新构建。

## 来源插件

每个来源对应 `sources/` 下的一个目录。`key` 同时也是前端和 ETL 使用的来源表名。

| 类别       | 示例                                                          |
| ---------- | ------------------------------------------------------------- |
| 热榜与社区 | 百度、微博、知乎、B站、抖音、Google Trends、V2EX、Hacker News |
| 新闻与财经 | 澎湃、第一财经、FT、WSJ、纽约时报、彭博、雪球                 |
| 科技与安全 | GitHub Trending、IT之家、CSDN、掘金、安全客、The Hacker News  |
| 设计与游戏 | Dezeen、designboom、优设、站酷、TapTap、Steam、机核           |
| 国际与综合 | Google News、NHK、朝日新闻、韩联社、Le Monde、Mumsnet         |

具体可用状态以 [来源定义](sources/) 为准。停用的插件仍保留在目录中，并填写 `enabled: false` 和 `disabled_reason`。

简单的 RSS 来源只需一个定义文件，使用时将示例地址替换为实际订阅地址：

```yaml
key: example_feed
name: Example Feed
enabled: true
schedule: hourly
timeout: 30s
retries: 1
proxy: none
fetch:
  type: rss
  url: https://example.com/feed.xml
extract:
  list: data
  fields:
    title: title
    url: url
    heat: hotScore
```

接口来源使用 `fetch.type: json`；需要自定义解析时，使用 `fetch.type: python`，例如 `entry: spider:get_data`。定义文件还控制重试、超时、代理和额外依赖。提取规则支持嵌套路径、回退值、URL 模板和正则，完整说明见 [plugins.py](plugins.py) 开头。

请求或解析失败时应抛出异常，让运行记录保留原因。新来源按目录自动发现，第一次成功写入时自动创建来源表。

## AI 修复

连续失败或条数持续偏低时，可以开启修复任务。网络、代理、限流和依赖问题会交给运维处理；支持的结构问题交给模型分析。默认每 24 小时最多开启四个自动分析任务。

修复任务会读取来源、收集证据，并在沙箱中测试补丁。检查通过后等待人工审核；批准才会写入来源目录，立即验证一次正式抓取，再观察后续运行。后台的 AI 助手还支持调查停用来源和新增来源。

填写自己的接口密钥前，先在**配置 → AI 修复**中设置接口地址、模型和限额。密钥保存在本地 `.env`：优先使用 `HOT_REPAIR_KEY`，未设置时使用 `HOT_EMBED_KEY`。浏览器与外部程序工具需要操作系统层面的沙箱网络隔离，详见 [repair.py](repair.py) 与 [后台部署说明](ops/README.zh-CN.md)。

```bash
python repair.py list
python repair.py run google_search
python repair.py approve <task-id> --by <operator>
python repair.py revert <task-id> --by <operator>
```

在爬虫运行环境中执行这些命令。分析任务需要创建低权限沙箱的权限；批准或撤销应以仓库文件的所属用户执行。

## ETL 与向量化

采集结束后，`etl/incremental.py` 按检查点读取新快照，将清洗后的记录写入 `hot_topic`。`etl/embedding_backfill.py` 处理还没有向量的记录，支持从未完成的位置继续。当前向量接口地址和模型写在该文件中，填写 `HOT_EMBED_KEY` 前请先改为自己的服务。

```bash
python etl/incremental.py
python etl/embedding_backfill.py --limit 8000
python etl/backfill.py --months 3
```

最后一条是可选的历史回填命令。ETL 的提取规则来自各来源定义，新增来源时无需另写一份清洗映射。

## 运行后台

后台是 `ops/` 下独立部署的 Next.js 应用，使用 React、shadcn/ui 和 Recharts。它用只读账号查询 PostgreSQL，管理操作通过调用爬虫的修复或配置命令执行，不打进爬虫镜像。

```bash
cd ops
pnpm install --frozen-lockfile
# 按 ops/README.zh-CN.md 配置 .env.local。
pnpm build
pnpm start --hostname 127.0.0.1 --port 3210
```

管理员账号、图片验证码、数据库权限、反向代理和服务部署说明见 [ops/README.zh-CN.md](ops/README.zh-CN.md)。

## 仓库结构

```text
sources/                 来源定义与自定义解析器
task.py                  采集轮次与运行记录
plugins.py               插件加载、抓取与提取
repair.py                AI 分析、沙箱与补丁生命周期
etl/                     表结构、增量清洗与向量回填
ops/                     中英文运维后台
docs/images/             后台示例截图
docs/examples/           隔离的截图数据与生成脚本
config.example.py        从环境变量读取配置的本地模板
```

欢迎提交 issue 或补充来源。新增来源时，请附上定义文件、需要的解析器以及预期输出说明。
