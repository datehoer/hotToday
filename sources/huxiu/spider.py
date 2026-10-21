import httpx
import pyquery
from urllib.parse import urljoin

def get_huxiu_data():
    url = "https://www.huxiu.com/"

    headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'cache-control': 'no-cache',
        'pragma': 'no-cache',
        'priority': 'u=0, i',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'same-origin',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
    }
    res = httpx.get(url, headers=headers, timeout=30, verify=False)
    doc = pyquery.PyQuery(res.content)
    data = []
    hot_tabs = doc(".hot-article-wrap .article-wrap__info").items()
    for tab in hot_tabs:
        url = urljoin(url, tab.find("a").attr("href"))
        title = tab.find("h3").text()
        data.append({
            "title": title,
            "url": url,
            "hotScore": 0
        })
    return {"data":data}