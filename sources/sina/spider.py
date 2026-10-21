import pyquery
import requests
import re
import json


def get_sina_data(proxy=None):
    url = "https://sinanews.sina.cn/h5/top_news_list.d.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    # 实测：直连 sinanews.sina.cn 读超时，经代理 200
    kwargs = {"proxies": {"http": proxy, "https": proxy}} if proxy else {}
    res = requests.get(url, headers=headers, timeout=30, **kwargs)
    doc = pyquery.PyQuery(res.content)
    scripts = doc("script").items()
    data = []
    for script in scripts:
        if "callUpConfig" in script.text():
            d = re.findall(r"SM = (.*?);", script.text())
            if len(d) > 0:
                d = d[0]
                d = json.loads(d)
                if "data" in d:
                    items = d['data']['data']['hotList']
                    seen_urls = set()
                    for item in items:
                        title = item['info']['title']
                        url = "https://so.sina.cn/search/list.d.html?keyword=" + title
                        if url in seen_urls:
                            continue
                        seen_urls.add(url)
                        hotScore = item['info']['hotValue']
                        data.append({
                            "title": title,
                            "url": url,
                            "hotScore": hotScore
                        })
    return {"data": data}
