from curl_cffi import requests
def get_csdn_data():
    url = "https://blog.csdn.net/phoenix/web/blog/hot-rank?page=0&pageSize=25&type="
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
        "Referer": "https://blog.csdn.net/rank/list",
        "Referrer-Policy": "unsafe-url"
    }
    res = requests.get(url, headers=headers)
    res_json = res.json()
    return res_json