import requests
import json

def get_googlesearch_data():
    url = 'https://trends.google.com/trends/api/realtimetrends?hl=zh-CN&tz=-480&cat=all&fi=0&fs=0&geo=US&ri=300&rs=20&sort=0'
    res = requests.get(url)
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
    return data_list