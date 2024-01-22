import requests
json_url = "https://youxiputao.com/api/article/index.html?page=1"
data = []
res_json = requests.get(json_url).json()
for item in res_json["data"]['data']:
    title = item["title"]
    link = "https://youxiputao.com/article/" + str(item['id'])
    hotScore = 0
    data.append({
        "title": title,
        "link": link,
        "hotScore": hotScore
    })
print(data)
