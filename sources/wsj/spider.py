"""华尔街日报: 先抓 news/latest-headlines 页面, 抓不到再退回新闻 sitemap。

DataDome 在 wsj.com 上是按出口 IP 判的, 不是看浏览器指纹: 本机和多数机场节点直接
401 + rt:'c' (要求过验证码), 真 Chrome 从这些 IP 过去也一样进 geo.captcha-delivery
的验证码 iframe; 但 subpool 里约四成节点能直接 200 拿到整页 (试过的 104.28.x.x 这种
Cloudflare WARP 段和个别普通 IP 都行)。subpool 的一条连接固定在一个节点上, 所以每次
换一个 Session 就是换一个出口 IP, 拿到 200 的那个 Session 就一直用。

不用浏览器: 200 的页面是服务端渲染的, 标题都在 a[data-testid='flexcard-headline']。
一条都没拿到 200 时退回 wsj_google_news.xml (只有标题、链接、发布时间), 免得整轮空着。
feeds.a.dj.com 的官方 RSS 停在 2025-01-27, 不用了。
"""
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import pyquery
from curl_cffi import requests
from loguru import logger

PAGE_URL = "https://www.wsj.com/news/latest-headlines"
ATTEMPTS = 4           # 每次换一个出口 IP; 挡多了会把干净的 IP 也烧掉, 所以少试几次就退回 sitemap
SITEMAPS = [
    "https://www.wsj.com/wsjsitemaps/wsj_google_news.xml",
    "https://www.wsj.com/live_news_sitemap.xml",
]
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9",
      "news": "http://www.google.com/schemas/sitemap-news/0.9"}
LIMIT = 50
# livecoverage 里的 /card/ 是直播间的碎碎念, 不是文章
SKIP_MARKERS = ("/card/",)
# 行业付费刊物 (Pro/Buyside 之类), 不是给热榜读者的; 只用在 sitemap 兜底上
SKIP_SECTIONS = {"pro", "wsj-pro", "buyside", "cmo-today", "cio-journal", "cfo-journal",
                 "risk-compliance-journal", "logistics-report"}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _proxy_kwargs(proxy):
    return {"proxies": {"http": proxy, "https": proxy}} if proxy else {}


def _headlines(html):
    """页面上的标题, 按页面顺序; 顺手去掉 livecoverage 的 /card/ 碎片"""
    doc = pyquery.PyQuery(html)
    doc("style,script,noscript").remove()
    out, seen = [], set()
    for item in doc("a[data-testid='flexcard-headline']").items():
        title = " ".join(item.text().split())
        link = item.attr("href") or ""
        if not title or not link or title in seen:
            continue
        if any(marker in link for marker in SKIP_MARKERS):
            continue
        seen.add(title)
        out.append({"title": title, "url": link, "hotScore": 0})
        if len(out) >= LIMIT:
            break
    return out


def _from_page(proxy):
    """换出口 IP 直到某一页真的是 Latest Headlines; 返回 (data, 失败原因列表)"""
    errors, blocked = [], 0
    for _ in range(ATTEMPTS):
        # 一个新 Session 就是一条新连接, subpool 会把它落到另一个节点上
        session = requests.Session()
        try:
            res = session.get(PAGE_URL, headers=HEADERS, timeout=30, impersonate="chrome",
                              **_proxy_kwargs(proxy))
        except Exception as err:
            errors.append(f"{type(err).__name__}: {err}")
            continue
        if res.status_code == 200 and "Latest Headlines" in res.text:
            data = _headlines(res.text)
            if data:
                return data, errors
            errors.append("页面 200 但没有标题")
        elif res.status_code == 401:
            blocked += 1
            errors.append("401 DataDome")
        else:
            errors.append(f"HTTP {res.status_code}")
    if blocked:
        errors.append(f"连续 {blocked} 个出口 IP 被 DataDome 挡, 没轮到一个干净的")
    return [], errors


def _when(url):
    """发布时间, 解析不出来排到最后"""
    raw = (url.findtext("news:news/news:publication_date", namespaces=NS)
           or url.findtext("sm:lastmod", namespaces=NS) or "")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _wanted(link):
    tail = link.split("wsj.com", 1)[-1]
    parts = [p for p in tail.split("/") if p]
    if any(marker in tail for marker in SKIP_MARKERS):
        return False
    return not (parts and parts[0] in SKIP_SECTIONS)


def _from_sitemap(proxy):
    errors, entries = [], []
    for sitemap in SITEMAPS:
        try:
            res = requests.get(sitemap, headers=HEADERS, timeout=30, impersonate="chrome",
                               **_proxy_kwargs(proxy))
            res.raise_for_status()
            root = ET.fromstring(res.text)
            for url in root.findall("sm:url", NS):
                title = (url.findtext("news:news/news:title", namespaces=NS) or "").strip()
                link = (url.findtext("sm:loc", namespaces=NS) or "").strip()
                if title and link:
                    entries.append((title, link, _when(url)))
        except Exception as err:
            errors.append(f"{sitemap.split('/')[-1]}: {type(err).__name__} {err}")
            continue
        if entries:
            break
    entries.sort(key=lambda entry: entry[2], reverse=True)
    data, seen_title, seen_url = [], set(), set()
    for title, link, _ in entries:
        if not _wanted(link) or title in seen_title or link in seen_url:
            continue
        seen_title.add(title)
        seen_url.add(link)
        data.append({"title": title, "url": link, "hotScore": 0})
        if len(data) >= LIMIT:
            break
    return data, errors


def get_wsj_data(proxy=None):
    page, page_errors = _from_page(proxy)
    if page:
        logger.info(f"wsj: latest-headlines 页面拿到 {len(page)} 条")
        return {"data": page}
    data, sitemap_errors = _from_sitemap(proxy)
    if data:
        logger.warning(f"wsj: 页面没过去 ({page_errors[-1] if page_errors else '?'}), "
                       f"退回 sitemap {len(data)} 条")
        return {"data": data}
    # 两条路都不行才抛: 只记 empty 会看不到原因
    raise RuntimeError("; ".join(page_errors[-3:] + sitemap_errors[-3:]) or "没有取到条目")
