from curl_cffi import requests
import pyquery

def get_kuandaishan_data():
    url = "https://club.kdslife.com/index.php?c=right/right&m=right_hot"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.post(url, json={"c": "right/right", "m": "right_hot"}, headers=headers, timeout=30, impersonate="chrome")
    res_json = res.json()
    data = []
    # day 偶尔为空，依次回退到 week / month
    for key in ("day", "week", "month"):
        day = res_json.get(key)
        if not day:
            continue
        doc = pyquery.PyQuery(day)
        a = doc("a").items()
        for i in a:
            link = i.attr("href")
            title = i.text()
            hotScore = 0
            data.append({
                "url": link,
                "title": title,
                "hotScore": hotScore
            })
        if data:
            break
    return {"data": data}
