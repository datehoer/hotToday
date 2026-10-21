import requests
import pyquery
from urllib.parse import urljoin


def get_data(href, rank_type):
    url = "https://www.dongchedi.com/motor/pc/content/pgc_content_rank"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.dongchedi.com/",
    }
    params = {
        "aid": "1839",
        "app_name": "auto_web_pc",
        "rank_type": rank_type
    }
    res = requests.get(url, params=params, headers=headers, timeout=30)
    res_json = res.json()
    results = []
    if res_json['status'] == 0:
        data = res_json['data']['list']
        for result in data:
            title = result['title']
            link = href + result['group_id']
            hotScore = result['count']
            results.append({"title": title, "url": link, "hotScore": hotScore})
    return {"data": results}


def get_dongchedi_hot_search():
    # 原首页地址已重定向到登录页，改用内部排名 API
    return get_data("https://www.dongchedi.com/article/", "pgc_article_total_rank")


video_params = {
    "aid": "1839",
    "app_name": "auto_web_pc",
    "rank_type": "pgc_video_total_rank"
}
article_params = {
    "aid": "1839",
    "app_name": "auto_web_pc",
    "rank_type": "pgc_article_total_rank"
}
