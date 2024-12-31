from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_yna_data():
    url = "https://en.yna.co.kr/news"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    items = doc(".smain-list-type01 li").items()
    data = []
    for item in items:
        title = item.find(".tit a").text()
        if title == "":
            continue
        link = item.find(".tit a").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
