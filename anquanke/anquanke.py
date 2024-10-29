import requests
import time
def get_anquanke_data():
    url = "https://www.anquanke.com/webapi/api/index/top/list"
    params = {
        "page": 1,
        "_": int(time.time()*1000)
    }
    res = requests.get(url, params=params)
    res_json = res.json()
    return res_json