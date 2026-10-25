# Console example screenshots

The screenshots in `../images/` use the real Next.js console with fictional database records. The capture script stages a temporary copy of the tracked `ops/` files, replaces its PostgreSQL adapter with fixtures, and creates a short-lived `demo` session using the existing authentication code. Production environment files are never copied.

The preview listens on loopback. External commands are disabled in its data-access module, and the browser blocks POST requests, remote URLs and navigation outside the three example pages. The production app and its authentication remain unchanged.

## Regenerate

Install the console dependencies in `ops/` first. You also need a Chrome/Chromium executable and a Playwright module. For a separate temporary Playwright installation:

```bash
npm install --prefix /tmp/hottoday-browser --no-save playwright-core
PLAYWRIGHT_MODULE=/tmp/hottoday-browser/node_modules/playwright-core/index.mjs \
CHROME_PATH=/path/to/chrome \
node docs/examples/capture.mjs
```

Run the command from the repository root. If `playwright-core` is already resolvable by Node, omit `PLAYWRIGHT_MODULE`. The script writes `ops-overview.png`, `ops-sources.png` and `ops-ai-agent.png` into `docs/images/`, checks English rendering and browser errors, then closes the preview and removes its temporary files.

`fixtures.mjs` supplies example runs, repair tasks and chats. The capture script inserts the current source catalog from tracked manifests; no production records or provider requests are used. Example timestamps and metrics are illustrative, not operational measurements.
