#coding=utf-8
# 百度热搜
from curl_cffi import requests as curl_requests
import requests as plain_requests
import pyquery
import re
import json

URL = "https://top.baidu.com/board?tab=realtime"


def get_baidu_data(proxy=None):
    kwargs = {"proxies": {"http": proxy, "https": proxy}} if proxy else {}
    # 实测：本机/容器直连 top.baidu.com 超时(被限流)，经代理可稳定 200
    # 2026-10-22 19:00 起连续 8 轮 curl: (35) SSL_ERROR_SYSCALL / (28) 超时，代理池和别的源都正常：
    # 百度那边对代理出口间歇性拒握手，同一个代理改用普通 requests(TLS 栈不同) 又是 200，
    # 所以两条路都试一遍，都失败就把两个原因一起报出来
    try:
        response = curl_requests.get(URL, timeout=30, impersonate="chrome", **kwargs)
    except Exception as err:
        try:
            response = plain_requests.get(URL, timeout=30, **kwargs)
        except Exception as fallback_err:
            raise RuntimeError(f"curl_cffi: {err}; requests: {fallback_err}") from fallback_err

    doc = pyquery.PyQuery(response.content)

    search_tabs_data = doc("#sanRoot").html()
    search_tabs = re.findall("<!--s-data:(.*?)-->", search_tabs_data or "", re.S)
    if not search_tabs:
        raise ValueError("top.baidu.com 页面里没有 sanRoot 的 s-data, 结构变了")
    search_tabs = json.loads(search_tabs[0])
    datas = search_tabs['data']['cards'][0]['content']
    hot_data = []
    for data in datas:
        hot_data.append({
            "url": data['appUrl'],
            "title": data['word'],
            "hotScore": data['hotScore']
        })
    return {"data": hot_data}
