import requests
import pyquery
from urllib.parse import urljoin
def get_hupu_data():
    url = "https://bbs.hupu.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.text)
    items = doc(".text-list-model>div").items()
    data = []

    for item in items:
        wrap = item.find(".list-wrap")
        if wrap is not None:
            title = wrap.find("a>span").text()
            if title == "":
                continue
            link = urljoin(url, wrap.find("a").attr("href"))
            hotScore = 0
            data.append({
                "title": title,
                "url": link,
                "hotScore": hotScore
            })
    return {"data": data}