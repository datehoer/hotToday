from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_foxnews_data():
    # DOM 结构已变，改用当前 article 容器
    url = "https://www.foxnews.com/world"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    items = doc("article").items()
    data = []
    for item in items:
        title = item.find(".title a").text().strip()
        if title == "":
            continue
        link = item.find(".title a").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
