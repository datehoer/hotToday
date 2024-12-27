from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
def get_hostloc_data():
    url = "https://hostloc.com/forum-45-1.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.text)
    items = doc("#threadlisttableid>tbody[id^='normalthread_'] .xst").items()
    data = []

    for item in items:
        title = item.text()
        if title == "":
            continue
        link = urljoin(url, item.attr("href"))
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
