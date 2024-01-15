import requests
import pyquery
from urllib.parse import urljoin
url = "https://xueqiu.com"
today = "https://xueqiu.com/statuses/hot/listV2.json?since_id=-1&max_id=-1&size=15"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
session = requests.session()
session.get(url, headers=headers)
res = session.get(today, headers=headers)
res_json = res.json()
data = []
for i in res_json.get("items", []):
    original = i['original_status']
    title = original['description']
    doc = pyquery.PyQuery(title)
    title = doc.text()[0:60]
    link = urljoin(url, original['target'])
    hotScore = 0
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)