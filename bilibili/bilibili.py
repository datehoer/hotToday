import re
import requests

url = "https://api.bilibili.com/x/web-interface/popular"


params = {
    "ps": 20,
    "pn": 1
}
headers = {
    'Content-Type': 'application/json, text/plain, */*',
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.54 Safari/537.36",
}
home = 'https://www.bilibili.com/'
res = requests.get(home, headers=headers)
set_cookie = res.headers['Set-Cookie']
buvid3 = re.findall(r'buvid3=(.*?);', set_cookie)[0]
cookie = "buvid3={}".format(buvid3)
headers['cookie'] = cookie
response = requests.get(url, params=params, headers=headers)
res_json = response.json()
data = []
for j in res_json['data']['list']:
    title = j['title']
    link = j["short_link_v2"]
    hotScore = 0
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)