import requests

url = "https://www.acfun.cn/rest/pc-direct/rank/channel?channelId=&subChannelId=&rankLimit=30&rankPeriod=DAY"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)

res_json = res.json()
data = []
for i in res_json.get('rankList', []):
    title = i.get('title')
    link = i.get('shareUrl')
    hotScore = i.get('viewCount')
    data.append({
        'title': title,
        'url': link,
        'hotScore': hotScore
    })
print(data)