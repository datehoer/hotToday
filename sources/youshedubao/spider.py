from curl_cffi import requests
import pyquery
import json
import re


def get_youshedubao_data():
    url = "https://www.uisdc.com/news"
    headers = {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        "upgrade-insecure-requests": "1",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    try:
        res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    except Exception:
        import requests as plain_requests
        res = plain_requests.get(url, headers=headers, timeout=30)
    doc = pyquery.PyQuery(res.content)
    items = doc(".news-main>script").text()
    matches = re.findall('var uisdc_news = "(.*?)";', items)
    if not matches:
        return {"data": []}
    raw = matches[0]
    # 页面里的 JSON 是 JS 字符串字面量，其中出现了 JS 的 \' 转义（如 It\'s），
    # 这不是合法 JSON 转义，先还原成单引号，再按 JSON 字符串字面量解码。
    raw = raw.replace("\\'", "'")
    try:
        text = json.loads('"' + raw + '"')
    except (json.JSONDecodeError, TypeError):
        text = raw
    uisdc_news = json.loads(text)
    return {"data": uisdc_news}
