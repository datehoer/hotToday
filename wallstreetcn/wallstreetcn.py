import requests
import pyquery


def get_wallstreetcn_data():
    url = "https://wallstreetcn.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    data = []
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    ul = doc(".list.main .item").items()
    for i in ul:
        title = i.find("a").text()
        link = i.find('a').attr('href')
        data.append({
            "url": link,
            "title": title,
            "hotScore": 0
        })
    return {"data": data}

