#coding=utf-8
# 百度热搜
from curl_cffi import requests
import pyquery
import re
import json
def get_baidu_data():
    url = "https://top.baidu.com/board?tab=realtime"
    response = requests.get(url)
    doc = pyquery.PyQuery(response.content)

    search_tabs_data = doc("#sanRoot").html()
    search_tabs = re.findall("<!--s-data:(.*?)-->", search_tabs_data, re.S)
    hot_data = []
    if len(search_tabs) > 0:
        search_tabs = json.loads(search_tabs[0])
        datas = search_tabs['data']['cards'][0]['content']
        for data in datas:
            url = data['appUrl']
            title = data['word']
            hotScore = data['hotScore']
            hot_data.append({
                "url": url,
                "title": title,
                "hotScore": hotScore
            })
    return hot_data
    
