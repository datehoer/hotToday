#coding=utf-8
import requests
url = "https://weibo.com/ajax/side/hotSearch"
res = requests.get(url)
res_json = res.json()
if res_json['ok'] == 1:
    data = res_json['data']
    if "realtime" in data:
        realtime = data['realtime']
        hot_data = []
        for item in realtime:
            if "raw_hot" not in item:
                continue
            title = item['word']
            url = "https://s.weibo.com/weibo?q=" + title
            hotScore = item['raw_hot']
            hot_data.append({
                "url": url,
                "title": title,
                "hotScore": hotScore
            })
        print(hot_data)