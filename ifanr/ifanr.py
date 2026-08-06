from curl_cffi import requests
import pyquery


def get_ifanr_data():
    # 爱范儿首页文章 + digest 快讯
    url = "https://www.ifanr.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    data = []
    seen = set()
    for a in doc("h3 a, .title a").items():
        title = a.text().strip()
        href = a.attr("href")
        if not title or not href or href == "#" or href in seen:
            continue
        seen.add(href)
        data.append({
            "title": title,
            "url": href,
            "hotScore": 0,
        })
    return {"data": data}
