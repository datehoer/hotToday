from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_nhk_data():
    # 页面已迁移到新版，旧选择器失效，改用新的新闻条目结构
    url = "https://www3.nhk.or.jp/news/catnew.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    items = doc("li a[href*='/newsweb/na/']").items()
    data = []
    for item in items:
        title = item.text().strip()
        if title == "":
            continue
        link = item.attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
