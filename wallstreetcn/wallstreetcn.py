from curl_cffi import requests
import pyquery


def get_wallstreetcn_data():
    url = "https://api-one-wscn.awtmt.com/apiv1/content/articles/hot?period=all"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers)
    return res.json()