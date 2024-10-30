import httpx
import pyquery
from urllib.parse import urljoin

def get_huxiu_data():
    url = "https://www.huxiu.com/"

    headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "max-age=0",
        "if-none-match": "W/\"3f470-YusmHNGFRcy3na3dSTf4y7Qv1ek\"",
        "sec-ch-ua": "\"Chromium\";v=\"116\", \"Not)A;Brand\";v=\"24\", \"Google Chrome\";v=\"116\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"macOS\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "same-origin",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "cookie": "huxiu_analyzer_wcy_id=mpqtol4x3zvar5f1rea; Hm_lvt_502e601588875750790bbe57346e972b=1704977803; Hm_lpvt_502e601588875750790bbe57346e972b=1704977838",
        "Referer": "https://www.huxiu.com/article/",
        "Referrer-Policy": "strict-origin-when-cross-origin"
    }
    res = httpx.get(url, headers=headers, verify=False)
    doc = pyquery.PyQuery(res.text)
    data = []
    hot_tabs = doc(".hot-article-wrap>.article-wrap>div").items()
    for tab in hot_tabs:
        url = urljoin(url, tab.find("a").attr("href"))
        title = tab.find("h3").text()
        data.append({
            "title": title,
            "url": url,
            "hotScore": 0
        })
    return {"data":data}