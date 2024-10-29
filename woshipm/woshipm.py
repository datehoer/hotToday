# 人人都是产品经理
import requests
def get_woshipm_data():
    url = "https://www.woshipm.com/api2/app/article/popular/daily"
    res = requests.get(url)
    res_json = res.json()
    return res_json
