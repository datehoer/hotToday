import requests
import pyquery
from urllib.parse import urljoin
import time
def get_taptap_data():
    url = "https://www.taptap.cn/top/download"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)

    data = []

    items = doc(".tap-hot-search__wrapper>a").items()
    for item in items:
        title = item.find("div").next().text()
        link = urljoin(url, item.attr("href"))
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data":data}
