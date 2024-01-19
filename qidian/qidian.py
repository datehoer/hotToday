import requests
from pyquery import PyQuery as pq
from urllib.parse import urljoin
url = "https://www.qidian.com/rank/readindex/"

res = requests.get(url)
doc = pq(res.content)
rank_list = doc(".rank-body div>ul>li").items()
data = []
for i in rank_list:
    title = i.find("h2>a").text()
    link = i.find("h2>a").attr("href")
    hotScore = 0
    data.append({
        "title": title,
        "url": urljoin(url, link),
        "hotScore": hotScore
    })
print(data)