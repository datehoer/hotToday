from curl_cffi import requests
import pyquery
def get_dianshangbao_data():
    url = "https://www.dsb.cn/news"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.text)
    items = doc("ol>li").items()
    data = []
    for item in items:
        title = item.find("a").text()
        link = item.find("a").attr("href")
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return data
