# -*- coding: utf-8 -*-
import requests
import pyquery

def get_ithome_needknow_data():
    url = "https://www.ithome.com/block/rank.html"

    res = requests.get(url)

    doc = pyquery.PyQuery(res.content.decode(res.encoding))
    data = []
    rank_day = doc("#d-1").find("a").items()
    for item in rank_day:
        title = item.attr("title")
        link = item.attr("href")
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data":data}

print(get_ithome_needknow_data())