import requests
import pyquery
def get_hacker_news():
    url = "https://news.ycombinator.com"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.text)
    detail_list = doc(".athing").items()
    data = []
    for detail in detail_list:
        title = detail.find(".titleline a").text()
        link = detail.find(".titleline a").attr("href")
        data.append({
            "url": link,
            "title": title,
            "hotScore": 0
        })
    return {"data": data}
