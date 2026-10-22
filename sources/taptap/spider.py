import json
import re

import requests


def get_taptap_data():
    url = "https://www.taptap.cn/top/download"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, timeout=30)
    res.raise_for_status()
    text = res.text

    data = []
    for script in re.findall(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>',
        text,
        re.S,
    ):
        try:
            obj = json.loads(script.strip())
        except (TypeError, ValueError):
            continue
        if obj.get("@type") != "ItemList":
            continue
        for item in obj.get("itemListElement", []):
            title = (item.get("name") or "").strip()
            link = (item.get("url") or "").strip()
            if not title or not link:
                continue
            data.append({
                "title": title,
                "url": link,
                "hotScore": 0,
            })
        break

    return data
