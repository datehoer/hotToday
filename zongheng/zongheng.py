import requests

def get_zongheng_data():
    url = "https://www.zongheng.com/api/rank/details"

    payload = {
        'cateFineId': '0',
        'cateType': '0',
        'pageNum': '1',
        'pageSize': '20',
        'period': '0',
        'rankNo':'',
        'rankType': '3',
    }

    res = requests.post(url, data=payload)
    res_json = res.json()
    return {"data": res_json['result']}