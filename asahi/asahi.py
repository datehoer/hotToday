from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_asahi_data():
    url = "https://www.asahi.com/ajw/new/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    items = doc("#Last24hours_content li").items()
    data = []
    for item in items:
        title = item.find(".headline").text()
        if title == "":
            continue
        link = item.find("a").attr("href")
        link = urljoin(url, link)
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}