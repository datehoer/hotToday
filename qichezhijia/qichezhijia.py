import requests
from urllib.parse import urljoin
import pyquery

def get_qichezhijia_data():
    url = "https://club.autohome.com.cn/"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.content)
    data = []
    items = doc(".rank-list").eq(-1).find("li").items()
    for item in items:
        title = item.find("span.name a").text()
        href = item.find("span.name a").attr("href")
        hotScore = item.find("span.result").text()
        data.append({
            "title": title,
            "url": urljoin(url, href),
            "hotScore": hotScore
        })
    return {"data":data}