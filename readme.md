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
- ~~雪球热门 (Xueqiu Hot Topics)~~
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

## 清洗链路 (ETL)

爬虫每小时整点运行 `task.py`，完成后自动执行增量清洗 + 向量化：

1. `etl/incremental.py` - 从 82 张源表按 checkpoint 水位线增量提取，upsert 到 `hot_topic` 汇总表
2. `etl/embedding_backfill.py` - 对 `hot_topic` 中 `embedding IS NULL` 的行调用 text-embedding-3-small 批量向量化（幂等断点续跑）
3. `etl/backfill.py` - 历史回填工具（手动运行）
4. `etl/extractors.py` - 各源表数据解析（title/url/hot_value）

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