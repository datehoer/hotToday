from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_newsau_data():
    url = "https://www.news.com.au/national/breaking-news"
    headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'referer': 'https://www.news.com.au/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    }
    res = requests.get(url, headers=headers)
    res.encoding = res.apparent_encoding
    doc = pyquery.PyQuery(res.text)
    items = doc("h4.storyblock_title").items()
    data = []
    for item in items:
        title = item.find("a").text()
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
