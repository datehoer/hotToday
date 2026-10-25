# hotToday 爬虫运维

ops.example.com：hotToday 每小时一轮抓取的运维看板（概况 / 源 / 运行 / AI 修复 / 状态 / 配置）。Next.js 16 + shadcn（preset b1aIuQ2XC）。它是 hotToday 仓库的 `ops/` 目录，爬虫在上一级。

- 数据：`ops.round` / `ops.run` 由上一级的 `task.py` 每轮写入；另读各源表和 `hot_topic`。连接参数在 `.env.local`（PG*，只读账号 hotrank_readonly）。
- 状态页现查三样：subpool 代理池的统计接口（`SUBPOOL_STATS`，默认 `http://127.0.0.1:9090/stats`）、PostgreSQL（同一个只读账号）、Redis 的 INFO（`.env.local` 里的 `REDIS_URL`）。
- 配置页在爬虫容器里跑 `python task.py --config`（约 1 秒）；源详情页的「配置」直接读 `HOTTODAY_DIR`（默认 `/srv/projects/hotToday`，即本仓库）下的 `sources/<key>/`，写死的 cookie 和 token 不显示，只读。这个站自己不写库：AI 修复的批准（批准后立即跑一次那个源）、驳回、撤销和「配置 → AI 修复」的保存都在容器里跑 `repair.py`；填了密钥时，它另写上一级 `.env` 的 `HOT_REPAIR_KEY` 一行。「配置 → 代理池」读 `SUBPOOL_CONF`（默认 `/srv/projects/subpool/subpool.conf`），保存时只改调度和检测那几项，再 `sudo -n systemctl restart subpool`；订阅能添加、替换、删除（新链接先试着打开，subpool 用新文件起不来就改回原文件再重启）。订阅链接完整显示（含 token，登录后才看得到）；监听账号不发到浏览器。
- 运行：`hottoday-ops.service`（`/etc/systemd/system/`，openclaw 用户在本目录跑 `next start -H 127.0.0.1 -p 3210`），nginx 反代，见 `/etc/nginx/conf.d/ops.example.com.conf`。
- 改完代码，在本目录：`pnpm build && sudo systemctl restart hottoday-ops`。爬虫镜像不含本目录（见上一级的 `.dockerignore`）。pnpm 通过 corepack 装在 `~/.local/bin`。
- 登录：只有一个账号，配置在 `.env.local`（`AUTH_USER`、`AUTH_PASSWORD_HASH`、`AUTH_SECRET`），没有注册入口。`proxy.ts` 把未登录的请求转到 `/login`，`(console)` 下的页面和每次查库前还会再检查一次。
- 登录前必须填写图片验证码：五位字符、不区分大小写、五分钟有效；每次提交（包括填错）后作废并自动换图，也可手动刷新。答案只保存在服务端内存的摘要里，浏览器只收到 PNG 和随机的 HttpOnly Cookie；服务器重启会使未提交的验证码失效，刷新即可。每个 IP 五分钟最多换图 30 次，验证码失败也计入原来的登录失败次数。当前单进程运行，扩成多个实例时需把验证码状态迁到共享存储。认证回归检查：`pnpm test:auth`。
- 验证码图片由 `svg-captcha` 将既有答案绘成字体路径，再用 `sharp` 输出 PNG；随机答案和服务端校验仍由 `lib/captcha.ts` 管理。绘制使用本地 `lib/fonts/Geist-Regular.ttf`（原 ImageResponse 所用字体，OFL 许可见同目录），不依赖外部字体或系统字体。保留旋转、随机字号、深色文字和干扰线；直接 SVG 绘制避免通用 JSX 布局产生的逐节点遮罩，PNG 使用无损压缩等级 3。
- 登录限流的 IP 由 nginx 确认：`cloudflare-real-ip.conf` 只信任 Cloudflare 网段，并用 `real_ip_header CF-Connecting-IP` 还原访客地址；本站 `location /` 必须设置 `proxy_set_header CF-Connecting-IP $remote_addr;`，覆盖客户端传入的同名头。只配置 real-ip 模块不会改写转发头，直连源站时仍可伪造限流 IP。Next.js 保持只监听 `127.0.0.1:3210`；迁移或重建 nginx 配置时也要保留这条覆盖规则。
- 换密码：下面这行打印新的 `AUTH_PASSWORD_HASH=…`，替换 `.env.local` 里那行后重启服务，已登录的会话随之失效。换 `AUTH_SECRET` 也会让所有人下线。

  ```sh
  node -e 'const c=require("crypto"),s=c.randomBytes(16);console.log("AUTH_PASSWORD_HASH=scrypt:"+s.toString("base64url")+":"+c.scryptSync(process.argv[1],s,64).toString("base64url"))' '新密码'
  ```
