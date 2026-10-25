# hotToday ops console

**English** · [简体中文](README.zh-CN.md) · [Project README](../README.md)

The Next.js console for collection rounds, source health, AI repairs and conversations, service status and configuration. It lives in `ops/` and is deployed separately from the Python crawler image. [See the example screenshots](../README.md#ops-console).

## Local setup

Use Node.js 22 and pnpm. Install dependencies, then create an ignored `.env.local` in this directory:

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

Set your own database password and authentication values. The console uses node-postgres's `PGHOST`/`PGPASSWORD` names; the Python configuration template uses `PG_HOST`/`PG_PASSWORD` instead. The database role needs read access to `ops`, source tables and `hot_topic`, including tables created by later crawler runs.

Generate `AUTH_SECRET` locally:

```bash
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

For `AUTH_PASSWORD_HASH`, run the following in Bash. The password is read without echoing or putting it in the command arguments; copy the resulting `scrypt:…` value into `.env.local`:

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

The console reads `ops.round` and `ops.run` written by the crawler, source snapshot tables, `hot_topic`, and repair/chat records. Run the crawler against your database to populate them before using the dashboard.

## Runtime integration

- **Configuration:** `task.py --config` runs inside the `hottoday-spider` container. Source files are read from `HOTTODAY_DIR`, with embedded credentials masked in the source viewer.
- **Administrative actions:** approval, rejection, reverting, chat and repair settings invoke `repair.py` inside that container. The console's OS user needs the appropriate Docker access; the console does not use its read-only database role to apply those changes.
- **Provider keys:** model settings live in `ops.setting`. Saving a new key writes `HOT_REPAIR_KEY` into the crawler's local `.env`, not the database. Set your own API base and model before supplying a provider key.
- **Service status:** PostgreSQL, Redis INFO and the proxy pool's statistics endpoint are checked on request. Configure `REDIS_URL` and `SUBPOOL_STATS` for your deployment.
- **Proxy configuration:** `SUBPOOL_CONF` supplies the proxy pool's editable settings and subscriptions. Saving requires file permissions and permission to restart the configured `subpool` systemd service. Authenticated administrators can view complete subscription URLs, including their tokens.
- **Sandbox:** repair analysis uses an unprivileged account and OS-level network isolation. Configure the firewall and sandbox proxy described in `repair.py` before enabling browser/external-program tools; the worker checks whether the isolation is active.

## Authentication and reverse proxy

There is one account configured by `AUTH_USER`, `AUTH_PASSWORD_HASH` and `AUTH_SECRET`, with no registration flow. Middleware, console pages and database reads all check authentication. Changing the password hash or session secret invalidates existing sessions.

Login requires a five-character image code: case-insensitive, valid for five minutes and consumed on every attempt. The browser receives a PNG and an opaque HttpOnly cookie; the answer digest stays in server memory. Images use the bundled OFL-licensed font, `svg-captcha` and `sharp`. Issuance is limited to 30 images per IP per five minutes, and failed verification counts toward the login limit.

The current challenge store runs in one process; use shared storage before running multiple instances. A restart invalidates outstanding image codes.

Serve the console behind HTTPS, keeping Next.js on loopback. Rate limiting trusts `CF-Connecting-IP`: the reverse proxy must validate the visitor address and overwrite that header, for example with `proxy_set_header CF-Connecting-IP $remote_addr;`. Behind Cloudflare, configure trusted Cloudflare ranges and `real_ip_header CF-Connecting-IP` first; the real-IP module alone does not overwrite the forwarded header.

## Production and checks

```bash
pnpm build
pnpm start --hostname 127.0.0.1 --port 3210
```

Point your process manager or `hottoday-ops` systemd service at this directory and proxy your own hostname, such as `ops.example.com`, to the loopback listener. Rebuild before restarting the service after a code change. The crawler image excludes `ops/`.

```bash
pnpm test:auth
pnpm typecheck
pnpm lint
```

For documentation captures with fictional data, see [docs/examples](../docs/examples/README.md).
