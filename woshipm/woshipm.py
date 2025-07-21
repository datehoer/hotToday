# 人人都是产品经理
from curl_cffi import requests
def get_woshipm_data():
    url = "https://www.woshipm.com/api2/app/article/popular/daily"
    res = requests.get(url, impersonate="chrome99")
    res_json = res.json()
    return {"data": res_json['RESULT']}
