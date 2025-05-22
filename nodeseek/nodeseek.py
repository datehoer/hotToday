from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
def get_nodeseek_data():
    url = "https://www.nodeseek.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, impersonate="chrome")
    doc = pyquery.PyQuery(res.text)
    items = doc(".post-list>.post-list-item").items()
    data = []

    for item in items:
        title = item.find(".post-title a").text()
        if title == "" or "论坛内容限制与违规处罚" in title or "论坛运行机制" in title:
            continue
        link = urljoin(url, item.find(".post-title a").attr("href"))
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
