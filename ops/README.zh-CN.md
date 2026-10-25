# hotToday 运维后台

[English](README.md) · **简体中文** · [项目说明](../README.zh-CN.md)

基于 Next.js 的运维后台，包含运行概况、来源状态、AI 修复与对话、服务状态和配置。代码位于 `ops/`，独立于 Python 爬虫镜像部署。[查看后台示例截图](../README.zh-CN.md#后台示例)。

## 本地配置

使用 Node.js 22 和 pnpm。安装依赖后，在本目录创建被 Git 忽略的 `.env.local`：

```dotenv
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=hotday
PGUSER=hottoday_readonly
PGPASSWORD=''
AUTH_USER=admin
AUTH_PASSWORD_HASH=''
AUTH_SECRET=''
REDIS_URL=redis://127.0.0.1:6379
HOTTODAY_DIR=/absolute/path/to/hotToday
SUBPOOL_CONF=/absolute/path/to/subpool.conf
SUBPOOL_STATS=http://127.0.0.1:9090/stats
```

填写自己的数据库密码与认证配置。后台使用 node-postgres 的 `PGHOST`、`PGPASSWORD` 命名；Python 配置模板使用 `PG_HOST`、`PG_PASSWORD`，两者不同。数据库只读账号需要查询 `ops`、各来源表与 `hot_topic` 的权限，也要覆盖爬虫以后创建的新表。

在本地生成 `AUTH_SECRET`：

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

在 Bash 中运行下面的命令生成 `AUTH_PASSWORD_HASH`。密码不会回显或放进命令参数；将输出的 `scrypt:…` 值填入 `.env.local`：

```bash
read -r -s -p 'New admin password: ' OPS_PASSWORD
printf '\n'
printf '%s' "$OPS_PASSWORD" | node -e 'const c=require("node:crypto");let p="";process.stdin.on("data",d=>p+=d).on("end",()=>{const s=c.randomBytes(16);console.log("scrypt:"+s.toString("base64url")+":"+c.scryptSync(p,s,64).toString("base64url"))})'
unset OPS_PASSWORD
```

```bash
pnpm install --frozen-lockfile
pnpm dev --hostname 127.0.0.1
```

后台读取爬虫写入的 `ops.round`、`ops.run`，以及来源快照、`hot_topic`、修复和对话记录。使用看板前，先让爬虫连接自己的数据库运行并产生记录。

## 运行环境集成

- **配置读取**：在 `hottoday-spider` 容器中运行 `task.py --config`。源文件从 `HOTTODAY_DIR` 读取，源码查看器会遮盖嵌入的凭据。
- **管理操作**：批准、驳回、撤销、对话和修复设置通过容器里的 `repair.py` 执行。后台进程所属用户需要对应的 Docker 权限，不会通过数据库只读账号直接应用这些改动。
- **模型密钥**：模型设置保存在 `ops.setting`；保存密钥时写入爬虫本地 `.env` 的 `HOT_REPAIR_KEY`，不写入数据库。填写密钥前，先设置自己的接口地址和模型。
- **服务状态**：按需检查 PostgreSQL、Redis INFO 和代理池统计接口；根据部署填写 `REDIS_URL` 与 `SUBPOOL_STATS`。
- **代理配置**：从 `SUBPOOL_CONF` 读取可编辑设置与订阅。保存需要相应文件权限，以及重启 `subpool` systemd 服务的权限。登录后的管理员能看到完整订阅 URL，包括其中的 token。
- **沙箱**：AI 分析使用低权限账号和操作系统层面的网络隔离。启用浏览器或外部程序工具前，需要按 `repair.py` 的说明配置防火墙和沙箱代理，修复程序会检查隔离是否生效。

## 认证与反向代理

账号由 `AUTH_USER`、`AUTH_PASSWORD_HASH` 和 `AUTH_SECRET` 配置，没有注册入口。中间件、后台页面和数据库查询都会检查登录；修改密码摘要或会话密钥会使已有会话失效。

登录需要五位图片验证码，不区分大小写、五分钟有效，每次尝试后都会消耗。浏览器只收到 PNG 与不透明的 HttpOnly Cookie，答案摘要保存在服务端内存。图片由 `svg-captcha`、`sharp` 和仓库中 OFL 许可的字体绘制。每个 IP 五分钟最多换图 30 次，验证码失败也会计入登录失败次数。

当前验证码状态存储使用单进程；运行多个实例前需要迁到共享存储。服务重启后，尚未提交的验证码会失效。

使用 HTTPS 反向代理，Next.js 只监听本机。限流信任 `CF-Connecting-IP`，反向代理必须确认访客地址并覆盖该请求头，例如 `proxy_set_header CF-Connecting-IP $remote_addr;`。在 Cloudflare 后部署时，先配置可信 Cloudflare 网段与 `real_ip_header CF-Connecting-IP`；real-IP 模块本身不会覆盖转发头。

## 生产运行与检查

```bash
pnpm build
pnpm start --hostname 127.0.0.1 --port 3210
```

让进程管理器或 `hottoday-ops` systemd 服务在本目录运行，并将自己的域名（例如 `ops.example.com`）反代到本机监听端口。代码变化后先构建，再重启服务。爬虫镜像不包含 `ops/`。

```bash
pnpm test:auth
pnpm typecheck
pnpm lint
```

使用虚构数据生成文档截图的方法见 [docs/examples](../docs/examples/README.md)。
