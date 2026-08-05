from curl_cffi import requests
import pyquery
from urllib.parse import urljoin
import os

try:
    from config import PROXY
except ImportError:
    PROXY = None
if not PROXY:
    PROXY = os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY") or None


def get_hostloc_data():
    # Discuz 对访客 IP 有限流（"休息下，一会见"）。本机代理与本机出口 IP 相同，
    # 无法绕开；在部署服务器或使用不同出口 IP 时可带上代理再试。
    url = "https://hostloc.com/forum-45-1.html"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    }
    kwargs = {"proxies": {"http": PROXY, "https": PROXY}} if PROXY else {}
    try:
        session = requests.Session()
        session.headers.update(headers)
        session.get("https://hostloc.com/", timeout=30, impersonate="chrome120", **kwargs)
        res = session.get(url, headers={"Referer": "https://hostloc.com/"}, timeout=30, impersonate="chrome120", **kwargs)
        doc = pyquery.PyQuery(res.text)
        items = doc("#threadlisttableid>tbody[id^='normalthread_'] .xst").items()
        data = []
        for item in items:
            title = item.text()
            if title == "":
                continue
            link = urljoin(url, item.attr("href"))
            hotScore = 0
            data.append({
                "title": title,
                "url": link,
                "hotScore": hotScore
            })
        if not data and ("休息下" in res.text or "请 登录" in res.text):
            print("hostloc: 访问被限流，返回空列表")
        return {"data": data}
    except Exception as e:
        print(f"hostloc: 获取失败 {type(e).__name__}: {e}")
        return {"data": []}
