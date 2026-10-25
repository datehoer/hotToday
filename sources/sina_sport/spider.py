import pyquery
import requests

URL = "https://sports.sina.com.cn/"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36")


def get_sina_sport_data():
    """体育首页右栏的热搜榜 (div.hot-search-list 里的 div.hot-search-li)。

    2025-05 起原来的 div[node-type="tianYiList"] 天乙榜下线, 页面换成了这块热搜:
    排名、标题、链接、热度都是服务端渲染在 HTML 里的, 没有单独接口。
    链接是页面自己给的微博搜索地址。
    """
    res = requests.get(URL, timeout=30, headers={"User-Agent": UA})
    if res.status_code != 200:
        raise RuntimeError(f"体育首页 HTTP {res.status_code}")
    doc = pyquery.PyQuery(res.content.decode("utf-8"))
    data, seen_urls = [], set()
    for item in doc("div.hot-search-li").items():
        a = item("a.hot-search-title")
        title = (a.text() or "").strip()
        link = (a.attr("href") or "").strip()
        if not title or not link or link in seen_urls:
            continue
        seen_urls.add(link)
        hot = (item("div.hot-num").text() or "").strip().replace(",", "")
        data.append({"title": title, "url": link,
                     "hotScore": int(hot) if hot.isdigit() else 0})
    if not data:
        raise ValueError("体育首页里没找到热搜榜 (div.hot-search-li), 页面结构变了")
    return {"data": data}
