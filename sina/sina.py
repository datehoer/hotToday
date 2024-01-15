import pyquery
import requests
import re
import json

url = "https://sinanews.sina.cn/h5/top_news_list.d.html"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)
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
                for item in items:
                    title = item['info']['title']
                    url = "https://so.sina.cn/search/list.d.html?keyword=" + title
                    hotScore = item['info']['hotValue']
                    data.append({
                        "title": title,
                        "url": url,
                        "hotScore": hotScore
                    })
        break
print(data)
