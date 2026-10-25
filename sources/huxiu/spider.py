import httpx
import pyquery
from urllib.parse import urljoin

PAGE_URL = "https://www.huxiu.com/"
ATTEMPTS = 3
READ_TIMEOUT = 20.0

HEADERS = {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
    'cache-control': 'no-cache',
    'pragma': 'no-cache',
    'priority': 'u=0, i',
    'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'connection': 'close',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
}


def _fetch_html():
    """抓虎嗅首页 HTML。源站偶发读超时 / 连接中途断开, 这里重试几次; 全部失败就抛异常。"""
    last_err = None
    for _ in range(ATTEMPTS):
        try:
            with httpx.Client(
                headers=HEADERS,
                timeout=httpx.Timeout(READ_TIMEOUT, connect=10.0),
                follow_redirects=True,
                verify=False,
            ) as client:
                res = client.get(PAGE_URL)
                res.raise_for_status()
                html = res.content or b""
            if not html:
                raise RuntimeError("虎嗅首页返回空响应")
            if b"hot-article-wrap" not in html:
                raise RuntimeError("虎嗅首页 HTML 里没有 hot-article-wrap 区块")
            return html
        except (httpx.HTTPError, OSError, ValueError, RuntimeError) as exc:
            last_err = exc
    raise RuntimeError("虎嗅首页抓取失败(已重试 %d 次): %r" % (ATTEMPTS, last_err))


def get_huxiu_data():
    html = _fetch_html()
    doc = pyquery.PyQuery(html)

    data = []
    seen = set()
    for tab in doc(".hot-article-wrap .article-wrap__info").items():
        href = tab.find("a[href]").attr("href") or tab.parents("a[href]").attr("href")
        title = tab.find("h3").text() or tab.find(".title-wrap__title").text()
        if not href or not title:
            continue
        url = urljoin(PAGE_URL, href.strip())
        title = " ".join(title.split())
        if not title or url in seen:
            continue
        seen.add(url)
        data.append({
            "title": title,
            "url": url,
            "hotScore": 0,
        })

    if not data:
        raise RuntimeError("虎嗅首页没有解析到热文条目, 页面结构可能变了")

    return {"data": data}
