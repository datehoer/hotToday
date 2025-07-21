from curl_cffi import requests
import pyquery
from urllib.parse import urljoin

def get_5ch_data():
    url = "https://itest.5ch.net/topics/live"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, verify=False, impersonate="chrome99")
    doc = pyquery.PyQuery(res.content)
    items = doc(".newslist>.news").items()
    data = []
    for item in items:
        title = item.find(".news_title").text()
        if title == "":
            continue
        link = item.find("a").attr("href")
        link = urljoin(url, link)
        hotScore = item.find(".highlight").text()
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
