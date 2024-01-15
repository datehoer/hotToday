import pyquery
import requests

url = "https://tieba.baidu.com/hottopic/browse/topicList?res_type=1"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)

doc = pyquery.PyQuery(res.content)

items = doc("li.topic-top-item").items()
data = []
for item in items:
    title = item("p").text()
    link = item("a").attr("href")
    hotScore = item("span.topic-num").text()
    hotScore = hotScore.split("实时讨论")[0]
    if hotScore.endswith("W"):
        hotScore = hotScore.split("W")[0]
        hotScore = int(hotScore) * 10000
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)