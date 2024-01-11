import requests

url = "https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=50&desktop=true"

res = requests.get(url)

res_json = res.json()

hot_data = []
if "data" in res_json:
    data = res_json['data']
    for item in data:
        target = item['target']
        url = target['link']['url']
        title = target['title_area']['text']
        hotScore = target['metrics_area']['text']
        hot_data.append({
            "url": url,
            "title": title,
            "hotScore": hotScore
        })

print(hot_data)