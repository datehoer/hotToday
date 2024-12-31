from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_dailymail_data():
    url = "https://www.dailymail.co.uk/home/latest/index.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    items = doc("h3.linkro-darkred").items()
    data = []
    for item in items:
        title = item.find("a.title").text()
        if title == "":
            continue
        link = item.find("a.title").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
