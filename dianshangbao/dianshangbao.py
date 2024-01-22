import requests
import pyquery
url = "https://www.dsb.cn/news"
res = requests.get(url)
doc = pyquery.PyQuery(res.text)
items = doc(".timeline-container>div").items()
data = []
for item in items:
    title = item.find("a.news-title").text()
    link = item.find("a.news-title").attr("href")
    hotScore = 0
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)