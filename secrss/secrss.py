from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_secrss_data():
    # 安全内参（奇安信旗下安全媒体）首页文章列表
    url = "https://www.secrss.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content.decode("utf-8", errors="replace"))
    data = []
    for a in doc(".title a").items():
        title = a.text().strip()
        href = a.attr("href")
        if not title or not href:
            continue
        data.append({
            "title": title,
            "url": urljoin(url, href),
            "hotScore": 0,
        })
    return {"data": data}
