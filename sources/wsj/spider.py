"""华尔街日报: 抓 Google News 用的新闻 sitemap (只有标题、链接、发布时间)。

页面本身 (news/latest-headlines、旧 xml/rss) 被 DataDome 挡着, 直连和 subpool
都是 401 + "Please enable JS and disable any ad blocker"; feeds.a.dj.com 的官方
RSS 停在 2025-01-27 不再更新。sitemap 还开着, 而且正好是标题 + 链接 + 发布时间,
不碰正文。
"""
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

from curl_cffi import requests

SITEMAPS = [
    "https://www.wsj.com/wsjsitemaps/wsj_google_news.xml",
    "https://www.wsj.com/live_news_sitemap.xml",
]
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "news": "http://www.google.com/schemas/sitemap-news/0.9"}
LIMIT = 50
# livecoverage 里的 /card/ 是直播间的碎碎念, 不是文章
SKIP_MARKERS = ("/card/",)
# 行业付费刊物 (Pro/Buyside 之类), 不是给热榜读者的
SKIP_SECTIONS = {"pro", "wsj-pro", "buyside", "cmo-today", "cio-journal", "cfo-journal",
                 "risk-compliance-journal", "logistics-report"}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "Accept": "application/xml,text/xml,*/*",
}


def _when(url):
    """发布时间, 解析不出来排到最后"""
    raw = (url.findtext("news:news/news:publication_date", namespaces=NS)
           or url.findtext("sm:lastmod", namespaces=NS) or "")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _entries(xml_text):
    root = ET.fromstring(xml_text)
    out = []
    for url in root.findall("sm:url", NS):
        title = (url.findtext("news:news/news:title", namespaces=NS) or "").strip()
        link = (url.findtext("sm:loc", namespaces=NS) or "").strip()
        if title and link:
            out.append((title, link, _when(url)))
    return out


def _wanted(link):
    tail = link.split("wsj.com", 1)[-1]
    parts = [p for p in tail.split("/") if p]
    if any(marker in tail for marker in SKIP_MARKERS):
        return False
    return not (parts and parts[0] in SKIP_SECTIONS)


def get_wsj_data(proxy=None):
    kwargs = {"proxies": {"http": proxy, "https": proxy}} if proxy else {}
    errors = []
    entries = []
    for sitemap in SITEMAPS:
        try:
            res = requests.get(sitemap, headers=HEADERS, timeout=30, impersonate="chrome", **kwargs)
            res.raise_for_status()
            entries = _entries(res.text)
        except Exception as err:
            errors.append(f"{sitemap.split('/')[-1]}: {err}")
            continue
        if entries:
            break
    if not entries:
        raise RuntimeError("; ".join(errors) or "sitemap 里没有条目")

    entries.sort(key=lambda e: e[2], reverse=True)
    data, seen_title, seen_url = [], set(), set()
    for title, link, _ in entries:
        if not _wanted(link):
            continue
        if title in seen_title or link in seen_url:
            continue
        seen_title.add(title)
        seen_url.add(link)
        data.append({"title": title, "url": link, "hotScore": 0})
        if len(data) >= LIMIT:
            break
    return {"data": data}
