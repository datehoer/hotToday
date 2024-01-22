import requests
import time
from urllib.parse import urljoin
url = "https://www.anquanke.com/webapi/api/index/top/list"
params = {
    "page": 1,
    "_": int(time.time()*1000)
}
res = requests.get(url, params=params)
res_json = res.json()
data = []
if res_json["errno"] == 0:
    results = res_json["data"]['list']
    for result in results:
        title = result['title']
        url = result['url']
        url = urljoin("https://www.anquanke.com", url)
        data.append({
            "title": title,
            "url": url,
            "hotScore": 0
        })
print(data)