#coding=utf-8
import requests
import pyquery
url = "https://weread.qq.com/web/bookListInCategory/rising?maxIndex=0&rank=1"

headers = {
    'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'sec-fetch-site': 'none',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-user': '?1',
    'sec-fetch-dest': 'document',
    'accept-encoding': 'gzip, deflate',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
}
data = []
res = requests.get(url, headers=headers)
res_json = res.json()
for book in res_json.get("books", []):
    title = book['bookinfo']['title']
    link = ""
    hotScore = book['newRating']
    data.append({"title": title, "url": link, "hotScore": hotScore})
print(data)
