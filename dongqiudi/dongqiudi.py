import requests
import pyquery
import re
import pprint
import time
url = "https://www.dongqiudi.com/"


res = requests.get(url)
doc = pyquery.PyQuery(res.text)
items = doc(".hot-news-list>p").items()
text = re.findall("finalHotNewsDataContents:(.*?),sociologyData", res.text)
urls = re.findall('share:"(.*?)",thumb', text[0])
urls = [url.replace('\\u002F', '/').replace("article", "articles") for url in urls]
detail_res = requests.get(urls[0])
detail_doc = pyquery.PyQuery(detail_res.text)
detail_title = detail_doc('h1.news-title').text()
data = []
start = False
num = 0
for index, item in enumerate(items):
    title = item.text()
    if index+1 > len(urls):
        break
    if detail_title == title or start:
        hotScore = 0
        data.append({
            "title": title,
            "url": urls[num],
            "hotScore": hotScore
        })
        num += 1
        start = True

pprint.pprint(data)

