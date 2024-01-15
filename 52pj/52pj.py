import requests
import pyquery
from urllib.parse import urljoin

url = "https://www.52pojie.cn/forum.php?mod=guide&view=hot"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)

doc = pyquery.PyQuery(res.content)

items = doc("#threadlist table>tbody").items()

data = []
for item in items:
    title = item.find("th>a").text()
    link = item.find("th>a").attr("href")
    link = urljoin(url, link)
    hotScore = 0
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)