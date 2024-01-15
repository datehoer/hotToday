import requests

url = "https://r.inews.qq.com/gw/event/pc_hot_ranking_list?ids_hash=&offset=0&page_size=50"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
res = requests.get(url, headers=headers)

res_json = res.json()

data = []
items = res_json.get("idlist", [])
for item in items:
    if "newslist" in item:
        for news in item["newslist"]:
            if "url" in news:
                title = news['title']
                link = news['url']
                hotScore = news['hotEvent']['hotScore']
                data.append({
                    "title": title,
                    "link": link,
                    "hotScore": hotScore
                })
        break
print(data)