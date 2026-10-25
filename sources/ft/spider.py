import html
import re
from urllib.parse import urljoin

from curl_cffi import requests

# 网页版 https://www.ft.com/world 现在会被 Cloudflare 安全校验拦截(403)，
# 改用 FT 官方 RSS：/world?format=rss 为主，首页国际版 RSS 兜底。
FEEDS = [
    "https://www.ft.com/world?format=rss",
    "https://www.ft.com/rss/home/international",
]

ITEM_RE = re.compile(r"<item[^>]*>(.*?)</item>", re.S | re.I)
TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)
LINK_RE = re.compile(r"<link[^>]*>(.*?)</link>", re.S | re.I)
CDATA_RE = re.compile(r"<!\[CDATA\[(.*?)\]\]>", re.S)
TAG_RE = re.compile(r"<[^>]+>")

MIN_ITEMS = 13


def _clean(raw):
    if not raw:
        return ""
    text = raw.strip()
    m = CDATA_RE.search(text)
    if m:
        text = m.group(1)
    else:
        text = html.unescape(TAG_RE.sub("", text))
    return " ".join(text.split())


def _parse_feed(text):
    rows = []
    for m in ITEM_RE.finditer(text or ""):
        body = m.group(1)
        tm = TITLE_RE.search(body)
        lm = LINK_RE.search(body)
        title = _clean(tm.group(1)) if tm else ""
        link = _clean(lm.group(1)) if lm else ""
        if not title or not link:
            continue
        if not link.startswith("http"):
            link = urljoin("https://www.ft.com", link)
        rows.append({"title": title, "url": link, "hotScore": 0})
    return rows


def get_ft_data(proxy=None):
    headers = {
        "accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.7",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        ),
    }
    kwargs = {"proxies": {"http": proxy, "https": proxy}} if proxy else {}
    session = requests.Session()

    data = []
    seen = set()
    errors = []
    for feed in FEEDS:
        try:
            res = session.get(
                feed,
                headers=headers,
                timeout=30,
                impersonate="chrome",
                allow_redirects=True,
                **kwargs,
            )
        except Exception as exc:  # 网络错误留到最后统一抛出
            errors.append("%s: %s" % (feed, exc))
            continue
        if res.status_code != 200:
            errors.append("%s: HTTP %s" % (feed, res.status_code))
            continue
        for row in _parse_feed(res.text):
            if row["url"] in seen:
                continue
            seen.add(row["url"])
            data.append(row)
        if len(data) >= MIN_ITEMS:
            break

    if not data:
        raise RuntimeError("ft: 所有 RSS 源都抓取失败 -> " + "; ".join(errors))
    return {"data": data}
