from curl_cffi import requests
import pyquery


def get_steam_data():
    # Steam 热销榜（按销售额排名）
    url = "https://store.steampowered.com/search/?filter=topsellers"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    data = []
    for row in doc("a.search_result_row").items():
        title = row("span.title").text().strip()
        href = row.attr("href")
        if not title or not href:
            continue
        data.append({
            "title": title,
            "url": href,
            "hotScore": 0,
        })
    return {"data": data}
