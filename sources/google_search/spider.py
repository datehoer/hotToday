import re
from urllib.parse import quote
from xml.etree import ElementTree

import requests

# 旧的 trends/api/dailytrends 接口已 404，改用 trending RSS（geo 只支持有热搜的地区，CN 不存在）
FEED_URL = "https://trends.google.com/trending/rss?geo=US"
HT_NS = "{https://trends.google.com/trending/rss}"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/rss+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_traffic(text):
    if not text:
        return 0
    m = re.search(r"\d[\d,\.]*", text)
    if not m:
        return 0
    digits = re.sub(r"[^0-9]", "", m.group())
    if not digits:
        return 0
    return int(digits)


def get_googlesearch_data(proxy=None):
    proxies = None
    if proxy:
        proxies = {"http": proxy, "https": proxy}

    resp = requests.get(FEED_URL, headers=HEADERS, timeout=20, proxies=proxies)
    if resp.status_code != 200:
        raise RuntimeError("Google Trends RSS 返回 %s" % resp.status_code)

    root = ElementTree.fromstring(resp.content)

    rows = []
    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        if not title:
            continue
        heat = _parse_traffic(item.findtext(HT_NS + "approx_traffic"))
        news_url = ""
        news = item.find(HT_NS + "news_item")
        if news is not None:
            news_url = (news.findtext(HT_NS + "news_item_url") or "").strip()
        url = news_url or "https://www.google.com/search?q=" + quote(title)
        rows.append({"title": title, "url": url, "hotScore": heat})

    if not rows:
        raise RuntimeError("Google Trends RSS 没有返回条目")

    rows.sort(key=lambda r: r["hotScore"], reverse=True)
    total = len(rows)
    for idx, row in enumerate(rows):
        if row["hotScore"] <= 0:
            row["hotScore"] = total - idx
    return rows
