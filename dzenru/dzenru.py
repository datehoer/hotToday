import requests
import pyquery
import re
import json


def get_dzenru_data():
    url = "https://dzen.ru/news"
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Referer': 'https://sso.dzen.ru/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    }
    session = requests.Session()
    session.get(url, headers=headers)
    res = session.get(url, headers=headers)
    res.encoding = res.apparent_encoding
    doc = pyquery.PyQuery(res.text)
    items = doc("script[nonce]").items()
    data = []
    topList = []
    for item in items:
        text = item.text()
        if "window.Ya.Neo" in text:
            data_list = json.loads(re.findall("Neo=({.*})", text)[0])['dataSource']['news']['topList']
            for d in data_list[0]['stories']:
                title = d['title']
                link = d['url']
                hotScore = 0
                data.append({
                    "title": title,
                    "url": link,
                    "hotScore": hotScore
                })
            topList = data_list
    return {"data": data, "topList": topList}

print(get_dzenru_data())