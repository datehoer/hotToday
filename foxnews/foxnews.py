import requests
import pyquery
from urllib.parse import urljoin


def get_foxnews_data():
    url = "https://www.foxnews.com/world"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    items = doc(".collection-article-list .content.article-list>article").items()
    data = []
    for item in items:
        title = item.find("h4>a").text()
        if title == "":
            continue
        link = item.find("h4>a").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
