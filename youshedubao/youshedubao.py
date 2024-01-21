import requests
import pyquery
import json
import re
url = "https://www.uisdc.com/news"
headers = {
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Windows\"",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}
proxy = {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
res = requests.get(url, headers=headers, proxies=proxy)
doc = pyquery.PyQuery(res.content)
data = []

items = doc(".news-main>script").text()
uisdc_news = re.findall('var uisdc_news="(.*?)";', items)[0]
uisdc_news = json.loads(uisdc_news.replace('\\"', '"').replace("\\\\", "\\"))[0]['dubao']
for news in uisdc_news:
    title = news['title']
    data.append({
        "title": title,
        "url": "https://www.uisdc.com/news",
        "hotScore": 0
    })
print(data)
