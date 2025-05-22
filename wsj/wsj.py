from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
def get_wsj_data():
    url = "https://www.wsj.com/news/latest-headlines?mod=nav_top_section"
    headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'priority': 'u=0, i',
        'referer': 'https://www.wsj.com/tech/personal-tech/meta-orion-smart-glasses-tested-2eec7bef?mod=latest_headlines',
        'sec-ch-device-memory': '8',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-arch': '"x86"',
        'sec-ch-ua-full-version-list': '"Google Chrome";v="131.0.6778.140", "Chromium";v="131.0.6778.140", "Not_A Brand";v="24.0.0.0"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-model': '""',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    }
    session = requests.Session()
    session.get(url, headers=headers, impersonate="chrome99")
    res = session.get(url, headers=headers, impersonate="chrome99")
    doc = pyquery.PyQuery(res.text)
    items = doc("h1~div h3>a").items()
    data = []

    for item in items:
        title = item.find("div").text()
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