import requests
import pyquery
from urllib.parse import urljoin
url = "https://www.newsmth.net/nForum/mainpage"
headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)
doc = pyquery.PyQuery(res.content)
items = doc("#top10 ul>li").items()
data = []
for item in items:
    title = item.find("a").next("a").text()
    link = item.find("a").next("a").attr("href")
    hotScore = 0
    data.append({
        "title": title,
        "url": urljoin(url, link),
        "hotScore": hotScore
    })
print(data)