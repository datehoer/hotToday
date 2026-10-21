import os
import time

try:
    from patchright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

# 复用 playwright 已下载的 chromium（容器内固定路径）；可被环境变量覆盖
CHROME_PATH = os.getenv(
    "CHROME_PATH",
    "/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome",
)


def _find_chrome_path():
    if os.path.exists(CHROME_PATH):
        return CHROME_PATH
    # 尝试按目录扫描 playwright 缓存
    base = "/root/.cache/ms-playwright"
    if os.path.isdir(base):
        for name in sorted(os.listdir(base), reverse=True):
            if not name.startswith("chromium"):
                continue
            for sub in ["chrome-linux64/chrome", "chrome-linux/chrome"]:
                p = os.path.join(base, name, sub)
                if os.path.exists(p):
                    return p
    return None


def get_xueqiu_data():
    """雪球热帖：patchright 反检测浏览器抓取 /today（绕过阿里云 WAF 滑块/JS 挑战）"""
    if sync_playwright is None:
        return {"data": []}
    chrome = _find_chrome_path()
    if not chrome:
        return {"data": []}

    data = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path=chrome,
                args=["--no-sandbox", "--disable-dev-shm-usage"],
            )
            page = browser.new_page()
            page.goto(
                "https://xueqiu.com/today",
                timeout=30000,
                wait_until="domcontentloaded",
            )
            # 等待 WAF 挑战通过 + 页面渲染
            for _ in range(6):
                time.sleep(1)
                count = page.evaluate(
                    "document.querySelectorAll('.home__timeline__item').length"
                )
                if count > 0:
                    break

            posts = page.evaluate(
                """() => {
                    const items = document.querySelectorAll('.home__timeline__item');
                    return Array.from(items).map(it => {
                        const a = it.querySelector('a');
                        const text = (it.textContent || '').trim();
                        return {text: text, href: a ? a.href : null};
                    }).filter(p => p.text.length > 5 && p.href);
                }"""
            )
            for post in posts:
                # 热帖无标题，取正文开头作展示标题
                title = post["text"][:60].replace("\n", " ").strip()
                if not title:
                    continue
                data.append({
                    "title": title,
                    "url": post["href"],
                    "hotScore": 0,
                })
            browser.close()
    except Exception as exc:
        import logging

        logging.getLogger(__name__).warning(f"xueqiu fetch error: {exc}")
    return {"data": data}
