import re
from urllib.parse import urljoin

import pyquery
from curl_cffi import requests


HOT_API = "https://www.v2ex.com/api/topics/hot.json"
HOT_PAGE = "https://www.v2ex.com/?tab=hot"
RECENT_PAGE = "https://www.v2ex.com/recent"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

MAX_ITEMS = 38


def _topic_id(url):
    m = re.search(r"/t/(\d+)", url or "")
    return m.group(1) if m else None


def _get(url):
    res = requests.get(url, headers=HEADERS, timeout=30)
    if res.status_code != 200:
        raise RuntimeError("GET %s 返回 %s" % (url, res.status_code))
    return res


def _from_api(payload):
    """Today Top 10: /api/topics/hot.json -> [{title, url, replies, ...}]"""
    items = []
    if not isinstance(payload, list):
        raise RuntimeError("hot.json 返回的不是列表")
    for topic in payload:
        if not isinstance(topic, dict):
            continue
        title = (topic.get("title") or "").strip()
        url = topic.get("url") or ""
        if not title or not url:
            continue
        replies = topic.get("replies")
        if isinstance(replies, int) and replies > 0:
            url = "%s#reply%d" % (url, replies)
        items.append({"title": title, "url": url, "hotScore": 0})
    return items


def _from_html(html, base_url):
    """主题列表页: <span class="item_title"><a href="/t/123#reply4">标题</a>"""
    doc = pyquery.PyQuery(html)
    items = []
    for item in doc(".item_title a").items():
        title = (item.text() or "").strip()
        href = item.attr("href")
        if not title or not href:
            continue
        items.append({"title": title, "url": urljoin(base_url, href), "hotScore": 0})
    return items


def get_v2ex_data():
    data = []
    errors = []

    # 1) 站内 最热(今日热议) 接口
    try:
        res = _get(HOT_API)
        data.extend(_from_api(res.json()))
    except Exception as e:
        errors.append("hot.json: %s" % e)

    # 2) 最热标签页的主题列表
    if len(data) < MAX_ITEMS:
        try:
            res = _get(HOT_PAGE)
            data.extend(_from_html(res.text, HOT_PAGE))
        except Exception as e:
            errors.append("tab=hot: %s" % e)

    # 3) 最热列表条数不够时用最新主题补齐
    if len(data) < MAX_ITEMS:
        try:
            res = _get(RECENT_PAGE)
            data.extend(_from_html(res.text, RECENT_PAGE))
        except Exception as e:
            errors.append("/recent: %s" % e)

    result = []
    seen = set()
    for item in data:
        key = _topic_id(item["url"]) or item["url"]
        if key in seen:
            continue
        seen.add(key)
        result.append(item)
        if len(result) >= MAX_ITEMS:
            break

    if not result:
        raise RuntimeError("V2EX 抓取失败: " + ("; ".join(errors) or "没有解析到条目"))
    return {"data": result}
