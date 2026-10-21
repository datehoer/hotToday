import os
import time

from curl_cffi import requests

HTTP_TIMEOUT = float(os.getenv("HOT_HTTP_TIMEOUT", "30"))


def get_weibo_data():
    weibo_url = "https://weibo.com/ajax/side/hotSearch"
    weibo_headers = {
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'cache-control': 'no-cache',
        'client-version': '3.0.0',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://weibo.com/newlogin?tabtype=weibo&gid=102803&openLoginLayer=0&url=https://www.weibo.com/',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'server-version': 'v2026.01.27.1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    }
    data = requests.get(weibo_url, timeout=HTTP_TIMEOUT, headers=weibo_headers, impersonate="chrome").json()
    data['insert_time'] = time.time()
    return data
