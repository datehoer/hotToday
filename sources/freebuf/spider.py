from curl_cffi import requests
import xml.etree.ElementTree as ET

def get_freebuf_data():
    # 新闻列表页已改为前端渲染，原选择器失效，改用官方 RSS
    url = "https://www.freebuf.com/feed"
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
