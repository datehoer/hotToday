from curl_cffi import requests


def get_mumsnet_data():
    url = "https://www.mumsnet.com/api/v3/trending"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    items = res.json()["data"]
    data = []
    for item in items:
        title = item.get("subject")
        if title == "":
            continue
        link = item.get('link')
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data": data}
