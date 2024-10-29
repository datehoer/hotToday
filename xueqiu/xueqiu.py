import requests
import pyquery
from urllib.parse import urljoin
def get_xueqiu_data():
    url = "https://xueqiu.com"
    today = "https://xueqiu.com/statuses/hot/listV2.json?since_id=-1&max_id=-1&size=15"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    session = requests.session()
    session.get(url, headers=headers)
    res = session.get(today, headers=headers)
    res_json = res.json()
    return res_json
