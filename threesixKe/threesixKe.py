import requests
import time
import pyquery
from urllib.parse import urljoin
# urls = ['https://www.36kr.com/hot-list/renqi/', 'https://www.36kr.com/hot-list/zonghe/', 'https://www.36kr.com/hot-list/shoucang/']
urls = ['https://www.36kr.com/hot-list/renqi/']
# get now date
now = time.strftime("%Y-%m-%d", time.localtime())


def analysis_detail(doc):
    hot_list = []
    tabs = doc(".article-list>.article-wrapper").items()
    for tab in tabs:
        title = tab.find(".article-item-info>p>a").text()
        tab_url = urljoin('https://www.36kr.com', tab.find(".article-item-info>p>a").attr("href"))
        hotScore = tab.find("span>span").text()
        hot_list.append({
            "title": title,
            "url": tab_url,
            "hotScore": hotScore
        })
    return hot_list

def get_36kr_data():
    data = []
    for url in urls:
        link = url + now + "/1"
        res = requests.get(link)
        soup = pyquery.PyQuery(res.content)
        data.extend(analysis_detail(soup))
    numbers = soup(".pagination-wrapper>a").items()
    for num in numbers:
        page = num.text()
        if page == "1":
            continue
        link = url + now + "/" + num.text()
        res = requests.get(link)
        soup = pyquery.PyQuery(res.content)
        data.extend(analysis_detail(soup))
    return data
