from curl_cffi import requests
import pyquery

def get_3dm_data():
    url = "https://www.3dmgame.com/phb.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    items = doc(".Phbright>.phlist").items()
    data = []
    for item in items:
        title = item.find(".bt>a").text()
        link = item.find(".bt>a").attr("href")
        hotScore = item.find(".score_a>span").text()
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
