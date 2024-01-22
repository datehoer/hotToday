import requests
import json
url = 'https://trends.google.com/trends/api/realtimetrends?hl=zh-CN&tz=-480&cat=all&fi=0&fs=0&geo=US&ri=300&rs=20&sort=0'
proxy = {'http': 'http://127.0.0.1:7890', 'https': 'http://127.0.0.1:7890'}
res = requests.get(url, proxies=proxy)
text = res.text.replace(")]}'", "")
data = json.loads(text)
data = data['storySummaries']['trendingStories']
data_list = []
for item in data:
    articles = item['articles']
    for article in articles:
        title = article['articleTitle'].replace("\n", "")
        link = article['url']
        hotScore = 0
        data_list.append({'title': title, 'url': link, 'hotScore': hotScore})
print(data_list)