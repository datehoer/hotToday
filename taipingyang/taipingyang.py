from curl_cffi import requests
import pyquery
from urllib.parse import urljoin

def get_taipingyang_data():
    # 首页改版后 .hot-news 模块已不存在，改用新闻频道最新列表
    url = "https://www.pcauto.com.cn/news/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    # 站点使用 GBK 编码
    try:
        html = res.content.decode("gbk")
    except Exception:
        html = res.content.decode("utf-8", errors="ignore")
    doc = pyquery.PyQuery(html)
    article_data = []
    # 取第一个 "最新资讯" 列表（ul.txts，最靠前 = 最新），其中的 a 指向新闻正文
    first_list = doc("ul.txts").eq(0)
    for item in first_list("a[href*='/news/']").items():
        title = item.text().strip()
        if not title:
            continue
        link = urljoin("https://www.pcauto.com.cn/", item.attr("href"))
        article_data.append({
            'title': title,
            'url': link,
            'hotScore': 0,
        })
    return {"data": article_data}
