from curl_cffi import requests
import re
import time


def get_jin10_data():
    # 金十数据财经快讯流（flash API）
    url = "https://flash-api.jin10.com/get_flash_list?max_time=&channel=-8200&vip=1&_=" + str(int(time.time()))
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "x-app-id": "bVBF4FyRTn5NJF5n",
        "x-version": "1.0.0",
    }
    res = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    d = res.json()
    data = []
    for it in d.get("data", []):
        content = re.sub(r"<[^>]+>", "", it.get("data", {}).get("content", "")).strip()
        if not content:
            continue
        data.append({
            "title": content,
            "url": "https://www.jin10.com/",
            "hotScore": 0,
        })
    return {"data": data}
