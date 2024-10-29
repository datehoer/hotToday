import requests
import pyquery
def get_3dm_data():
    url = "https://www.3dmgame.com/phb.html"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.content)
    items = doc(".Phbright>.phlist").items()
    data = []
    for item in items:
        title = item.find(".bt>a").text()
        link = item.find(".bt>a").attr("href")
        hotScore = item.find(".score_a>span").text()
        data.append({
            "title": title,
            "url": link,
            "hotScore": hotScore
        })
    return {"data":data}
