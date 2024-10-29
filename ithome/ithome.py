import requests
import pyquery

def get_ithome_data():
    url = "https://m.ithome.com/rankm/"

    res = requests.get(url)

    doc = pyquery.PyQuery(res.content)
    data = []
    rank_day = doc("div[data-rank-type='day-rank']").next().find("a").items()
    for item in rank_day:
        title = item.find("p.plc-title").text()
        link = item.attr("href")
        hotScore = 0
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data":data}