import os
import time

from curl_cffi import requests
from loguru import logger

HTTP_TIMEOUT = float(os.getenv("HOT_HTTP_TIMEOUT", "30"))


def get_bilibili_hot_data():
    # v2 接口被 IP 级时间窗口风控(-352)封锁（直连/代理出口都命中，实测放行率约 30%）。
    # v1 接口 + 移动端 UA 实测稳定 code=0（多次连测全部成功）。
    bilibili_hot_url = "https://api.bilibili.com/x/web-interface/ranking"
    err = 5
    bili_headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    }
    while err > 0:
        try:
            res = requests.get(bilibili_hot_url, headers=bili_headers, timeout=HTTP_TIMEOUT)
            data = res.json()
        except Exception as exc:
            err -= 1
            logger.warning(f"bilibili_hot fetch exception retries_left={err}: {exc}")
            time.sleep(3)
            continue
        data_code = data.get("code", 352)
        if data_code == 0:
            # v1 字段(play/video_review/coins)转成 parse_bilibili_hot 期望的 stat/short_link_v2 形态
            converted = []
            for it in data["data"]["list"]:
                converted.append({
                    "title": it["title"],
                    "short_link_v2": "https://www.bilibili.com/video/" + it["bvid"],
                    "stat": {
                        "view": it["play"],
                        "danmaku": 0,
                        "reply": it["video_review"],
                        "favorite": 0,
                        "coin": it["coins"],
                        "share": 0,
                        "like": 0,
                    },
                })
            return {"data": {"list": converted}}
        else:
            err -= 1
            logger.warning(f"bilibili_hot data get error code={data_code}, retries_left={err}")
            time.sleep(3)
