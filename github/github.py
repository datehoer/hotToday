import requests
import pyquery
from urllib.parse import urljoin
url = "https://github.com/trending"
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
    "sec-fetch-site": "same-origin",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
  }
proxy = {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
response = requests.get(url, headers=headers, proxies=proxy)
doc = pyquery.PyQuery(response.text)
data = []

items = doc("div>article").items()
for item in items:
    title = item.find("h2 a").text().split("/")[-1].strip()
    link = urljoin(url, item.find("h2 a").attr("href"))
    hotScore = item.find("h2~div>a").text().split(" ")[0].replace(',', '')
    data.append({
        "title": title,
        "url": link,
        "hotScore": hotScore
    })
print(data)