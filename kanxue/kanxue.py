from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
def get_kanxue_data():
    url = "https://bbs.kanxue.com/"
    res = requests.get(url)
    doc = pyquery.PyQuery(res.content)
    items = doc(".bbs_home_page_three_col>div").eq(-1).find(".bbs_home_page_list_title").items()
    data = []
    for item in items:
        data.append({
            "title": item.text(),
            "url": urljoin(url, item.attr("href")),
            "hotScore": 0
        })
    return data
