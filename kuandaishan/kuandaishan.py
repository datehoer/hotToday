import requests
import pyquery

url = "https://club.kdslife.com/index.php?c=right/right&m=right_hot"
res = requests.post(url, json={"c": "right/right", "m": "right_hot"})
res_json = res.json()
data = []
day = res_json['day']
doc = pyquery.PyQuery(day)
a = doc("a").items()
for i in a:
    link = i.attr("href")
    title = i.text()
    hotScore = 0
    data.append({
        "url": link,
        "title": title,
        "hotScore": hotScore
    })
print(data)