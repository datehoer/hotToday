# hotToday 爬虫运维

ops.example.com：hotToday 每小时一轮抓取的运维看板（概况 / 源 / 运行 / 状态 / 配置）。Next.js 16 + shadcn（preset b1aIuQ2XC）。它是 hotToday 仓库的 `ops/` 目录，爬虫在上一级。

- 数据：`ops.round` / `ops.run` 由上一级的 `task.py` 每轮写入；另读各源表和 `hot_topic`。连接参数在 `.env.local`（PG*，只读账号 hotrank_readonly）。
- 状态页现查三样：subpool 代理池的统计接口（`SUBPOOL_STATS`，默认 `http://127.0.0.1:9090/stats`）、PostgreSQL（同一个只读账号）、Redis 的 INFO（`.env.local` 里的 `REDIS_URL`）。
- 配置页在爬虫容器里跑 `python task.py --config`（约 1 秒）；源详情页的「配置」直接读 `HOTTODAY_DIR`（默认 `/srv/projects/hotToday`，即本仓库）下的 `sources/<key>/`，写死的 cookie 和 token 不显示。都是只读；AI 修复的批准、驳回和撤销也在容器里跑 `repair.py`，这个站自己不写库、不改文件。
- 运行：`hottoday-ops.service`（`/etc/systemd/system/`，openclaw 用户在本目录跑 `next start -H 127.0.0.1 -p 3210`），nginx 反代，见 `/etc/nginx/conf.d/ops.example.com.conf`。
- 改完代码，在本目录：`pnpm build && sudo systemctl restart hottoday-ops`。爬虫镜像不含本目录（见上一级的 `.dockerignore`）。pnpm 通过 corepack 装在 `~/.local/bin`。
- 登录：只有一个账号，配置在 `.env.local`（`AUTH_USER`、`AUTH_PASSWORD_HASH`、`AUTH_SECRET`），没有注册入口。`proxy.ts` 把未登录的请求转到 `/login`，`(console)` 下的页面和每次查库前还会再检查一次。
- 换密码：下面这行打印新的 `AUTH_PASSWORD_HASH=…`，替换 `.env.local` 里那行后重启服务，已登录的会话随之失效。换 `AUTH_SECRET` 也会让所有人下线。

  ```sh
  node -e 'const c=require("crypto"),s=c.randomBytes(16);console.log("AUTH_PASSWORD_HASH=scrypt:"+s.toString("base64url")+":"+c.scryptSync(process.argv[1],s,64).toString("base64url"))' '新密码'
  ```
