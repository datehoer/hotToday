import requests
import pyquery
from urllib.parse import urljoin
def get_baijingchuhai_data():
    url = "https://www.baijing.cn/newsflashes_txzq/"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.text)
    items = doc("#content_ul>li").items()
    data = []
    for item in items:
        title = item.find("h3>a").text()
        link = item.find("h3>a").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
    