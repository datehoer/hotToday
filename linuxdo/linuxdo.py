from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
import json
def get_linuxdo_data():
    url = "https://linux.do/top"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, impersonate="chrome")
    doc = pyquery.PyQuery(res.text)
    json_data = json.loads(json.loads(doc("discourse-assets-json>div").attr("data-preloaded"))['topic_list'])['topic_list']['topics']
    return {"data":json_data}
