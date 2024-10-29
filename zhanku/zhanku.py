from curl_cffi import requests

def get_zhanku_data():
    url = "https://www.zcool.com.cn/p1/ranking/list"
    params = {
        "p": 1,
        "ps": 20,
        "rank_id": 351,
        "type": 3
    }
    headers = {
        "accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "url": "",
        "Referer": "https://www.zcool.com.cn",
        "Referrer-Policy": "no-referrer-when-downgrade"
    }
    res = requests.get(url, params=params, headers=headers)
    res_json = res.json()
    return res_json

