from curl_cffi import requests
import xml.etree.ElementTree as ET


def get_googlenews_data():
    # Google News 全球头条 RSS（中文）
    url = "https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    root = ET.fromstring(res.content)
    data = []
    for it in root.findall(".//item"):
        title = it.findtext("title")
        link = it.findtext("link")
        if not title:
            continue
        data.append({
            "title": title,
            "url": link,
            "hotScore": 0,
        })
    return {"data": data}
