import requests
import pyquery
from urllib.parse import urljoin
url = "https://www.pcauto.com.cn/"
res = requests.get(url)
doc = pyquery.PyQuery(res.content)
article_data = []
post_data = []
article_items = doc('.ranking-w1>ul>li').items()
post_items = doc('.ranking-w2>ul>li').items()
for item in article_items:
    article_data.append({
        'title': item.find('a').text(),
        'url': urljoin(url, item.find('a').attr('href')),
        'hotScore': 0,
    })
for item in post_items:
    post_data.append({
        'title': item.find('.title>a').text(),
        'url': urljoin(url, item.find('.titlea').attr('href')),
        'hotScore': 0,
    })

print(article_data)
print(post_data)