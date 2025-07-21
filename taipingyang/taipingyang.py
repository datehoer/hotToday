import requests
import pyquery
from urllib.parse import urljoin
def get_taipingyang_data():
    url = "https://www.pcauto.com.cn/"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.content)
    article_data = []
    article_items = doc('.hot-news>a').items()
    for item in article_items:
        article_data.append({
            'title': item.find('div').text(),
            'url': urljoin(url, item.attr('href')),
            'hotScore': item.find('span.hot-num').text(),
        })


    return {"data":article_data}
