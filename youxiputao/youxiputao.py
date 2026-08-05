from curl_cffi import requests
import pyquery
from urllib.parse import urljoin


def get_youxiputao_data():
    # 迁移说明：原数据源 youxiputao.com（游戏葡萄）已迁移到 Sxl.cn 纯落地页，
    # 不提供任何文章接口（旧 /api/article/index.html 已 301 到首页）。
    # 栏目迁移到同类游戏产业资讯源「游戏陀螺」(youxituoluo.com)。
    # DB 表名保留 youxiputao 以兼容现有数据，如需可在前端改栏目显示名。
    url = "https://www.youxituoluo.com/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(res.content)
    data = []
    for item in doc("div.item.cf").items():
        a = item.find("a.title")
        href = a.attr("href")
        if not href:
            continue
        # 去掉分类前缀 <span class="status">游戏资讯</span>
        a.remove("span.status")
        title = a.text().strip()
        if not title:
            continue
        data.append({
            "title": title,
            "url": urljoin(url, href),
            "hotScore": 0,
        })
    return {"data": data}
