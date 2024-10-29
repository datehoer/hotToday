import requests
import pyquery


def get_douban_movie_data():
    url = "https://movie.douban.com/chart"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    data = []
    res = requests.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    ul = doc(".movie_top>.movie_top>ul").items()
    for i in ul:
        name = i.parent().find('h2').text()
        ww = {
            "name": name,
            "data": []
        }
        li = i("li").items()
        for j in li:
            title = j("div>a").text()
            url = j("div>a").attr("href")
            hotScore = 0
            ww['data'].append({
                "url": url,
                "title": title,
                "hotScore": hotScore
            })
        data.append(ww)
    return {"data": data}