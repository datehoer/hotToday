import requests
url = "https://api.juejin.cn/content_api/v1/content/article_rank"
params = {
    "category_id": 1,
    "type": "hot",
    "spider": 0
}
res = requests.get(url, params=params)
res_json = res.json()
data = []
if res_json['err_no'] == 0:
    results = res_json['data']
    for result in results:
        title = result['content']['title']
        link = "https://juejin.cn/post/" + result['content']['content_id']
        hotScore = result['content_counter']['hot_rank']
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
print(data)