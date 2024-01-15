import requests
from urllib.parse import urljoin
import re
import json
import time
url = "https://top.finance.sina.com.cn/ws/GetTopDataList.php"
now = time.strftime("%Y%m%d", time.localtime())
params = [{
    "top_type": "day",
    "top_cat": "finance_0_suda",
    "top_time": now,
    "top_show_num": "20",
    "top_order": "DESC",
    "js_var": "all_1_data",
    "get_new": "1"
}, {
    "top_type": "day",
    "top_cat": "finance_news_0_suda",
    "top_time": now,
    "top_show_num": "20",
    "top_order": "DESC",
    "js_var": "all_1_data",
    "get_new": "1"
}, {
    "top_not_url": "/ustock/",
    "top_type": "day",
    "top_cat": "finance_stock_conten_suda",
    "top_time": now,
    "top_show_num": "20",
    "top_order": "DESC",
    "js_var": "stock_1_data",
    "get_new": "1"
}, {
    "top_type": "day",
    "top_cat": "finance_money_suda",
    "top_time": now,
    "top_show_num": "20",
    "top_order": "DESC",
    "js_var": "money_1_data",
    "get_new": "1"
}]
headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
}
data = []

for param in params:
    res = requests.get(url, params=param, headers=headers)
    all_1_data = re.findall(r".*1_data = (.*?);", res.text)[0]
    all_1_data = json.loads(all_1_data)
    if "data" in all_1_data:
        for item in all_1_data['data']:
            title = item['title']
            link = item['url']
            hotScore = item['top_num'].replace(",", '')
            data.append({
                "title": title,
                "url": link,
                "hotScore": hotScore
            })
print(data)