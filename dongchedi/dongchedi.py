import requests
import pyquery
from urllib.parse import urljoin


def get_data(href, rank_type):
    url = "https://www.dongchedi.com/motor/pc/content/pgc_content_rank"
    params = {
        "aid": "1839",
        "app_name": "auto_web_pc",
        "rank_type": rank_type
    }
    res = requests.get(url, params=params)
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
    hot_search_url = "https://www.dongchedi.com/news/dynamic_motor_car"
    res = requests.get(hot_search_url)
    doc = pyquery.PyQuery(res.content)
    data = []
    items = doc("ol>li").items()
    for item in items:
        title = item("a p").text()
        link = urljoin(hot_search_url, item("a").attr("href"))
        hotScore = 0
        data.append({"title": title, "url": link, "hotScore": hotScore})
    return {"data": data}


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
# video_list = get_data("https://www.dongchedi.com/video/", "pgc_video_total_rank")
# article_list = get_data("https://www.dongchedi.com/article/", "pgc_article_total_rank")
# print(article_list)
# print(get_hot_search())