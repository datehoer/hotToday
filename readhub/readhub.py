from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
def get_readhub_data():
    url = "https://readhub.cn/hot"

    res = requests.get(url)

    doc = pyquery.PyQuery(res.content.decode("utf-8"))
    data = []
    rank_day = doc("ol>li div div a").items()
    for item in rank_day:
        title = item.text()
        link = item.attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data":data}