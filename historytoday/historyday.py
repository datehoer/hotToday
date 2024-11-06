import requests
import pyquery
def get_history_today():
    url = "https://hao.360.com/histoday/"
    response = requests.get(url)
    doc = pyquery.PyQuery(response.text)
    things = doc(".tih-list>dl>dt").items()
    data = []
    for thing in things:
        data.append({
            "title": thing.text(),
            "url": "",
            "hotScore": 0
        })
    return {"data": data}
