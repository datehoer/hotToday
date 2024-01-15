#coding=utf-8
import requests
url = 'https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc'


res = requests.get(url)

res_json = res.json()

data = []

for i in res_json.get('data', []):
    title = i.get('Title', '')
    link = i.get('Url', '')
    hotScore = i.get('HotValue', '')
    data.append({
        'title': title,
        'link': link,
        'hotScore': hotScore
    })
print(data)