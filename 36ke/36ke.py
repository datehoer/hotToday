import requests
import time
import pyquery
urls = ['https://www.36kr.com/hot-list/renqi/', 'https://www.36kr.com/hot-list/zonghe/', 'https://www.36kr.com/hot-list/shoucang/']
# get now date
now = time.strftime("%Y-%m-%d", time.localtime())

for url in urls:
    link = url + now + "/1"
    res = requests.get(link)
