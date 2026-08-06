import hashlib
import base64
import time
import gzip
import json
import random
import string
import re
import urllib.request
import ssl
import uuid

# 酷安 API 逆向方案（2026-08 验证）
# 关键突破：通过 redroid 模拟器 MITM 抓包还原了完整请求链。
# 老版本 App(9.2.2) 的 X-App-Token 算法为 v1（非 v2/v3）：
#   token = md5(base64("token://com.coolapk.market/c67ef5943784d09750dcfbb31020f0ab?{md5(ts)}${uuid}&com.coolapk.market"))
#           + uuid + hex(ts)
# EdgeOne WAF 校验核心是 Dalvik UA + 合法 token/device 组合，与 TLS 指纹无关
# （标准 urllib HTTP/1.1 也能通过，无需 curl_cffi）。

_USER_AGENT = (
    "Dalvik/2.1.0 (Linux; U; Android 11; redroid11_x86_64 Build/RD2A.211001.002) "
    "(#Build; redroid; redroid11_x86_64; redroid_x86_64-userdebug 11 RD2A.211001.002 "
    "eng.frank.20240527.144006 test-keys; 11) +CoolMarket/9.2.2-1905301"
)

_TOKEN_CONST = "c67ef5943784d09750dcfbb31020f0ab"

# 今日热门接口（从 App 抓包得到）
_STATLIST_URL = (
    "https://api.coolapk.com/v6/page/dataList"
    "?url=%23%2Ffeed%2FstatList%3FcacheExpires%3D300%26statType%3Dday"
    "%26sortField%3Drank_score%26filterRepeatQuestionAnswer%3Dtrue"
    "%26replyRowsLimit%3D1&title=%E4%BB%8A%E6%97%A5%E7%83%AD%E9%97%A8&page=1"
)


def _rand_hex(n):
    return "".join(random.choice(string.hexdigits) for _ in range(n))


def _gen_device_code():
    """生成设备码：{szlm}; ; ; {mac}; {manu}; {brand}; {model}; {build} -> base64 反转去= """
    info = "{}; ; ; 02:00:00:00:00:00; Xiaomi; Xiaomi; MI 8 SE; {}".format(
        _rand_hex(16), _rand_hex(16)
    )
    b64 = base64.b64encode(info.encode()).decode()
    return b64[::-1].replace("=", "")


def _gen_token(device_id, timestamp):
    md5_t = hashlib.md5(str(timestamp).encode()).hexdigest()
    a = "token://com.coolapk.market/{}?{}${}&com.coolapk.market".format(
        _TOKEN_CONST, md5_t, device_id
    )
    md5_a = hashlib.md5(base64.b64encode(a.encode())).hexdigest()
    return md5_a + device_id + hex(timestamp)


def _headers(device_id, device_code):
    return {
        "User-Agent": _USER_AGENT,
        "X-Requested-With": "XMLHttpRequest",
        "X-Sdk-Int": "30",
        "X-Sdk-Locale": "en-US",
        "X-App-Id": "com.coolapk.market",
        "X-App-Token": _gen_token(device_id, int(time.time())),
        "X-App-Version": "9.2.2",
        "X-App-Code": "1905301",
        "X-Api-Version": "9",
        "X-App-Device": device_code,
        "X-Dark-Mode": "0",
        "Host": "api.coolapk.com",
        "Connection": "Keep-Alive",
        "Accept-Encoding": "gzip",
    }


def _fetch_json(url):
    device_id = str(uuid.uuid4())
    device_code = _gen_device_code()
    req = urllib.request.Request(url, headers=_headers(device_id, device_code))
    ctx = ssl.create_default_context()
    resp = urllib.request.urlopen(req, timeout=30, context=ctx)
    body = resp.read()
    if body[:2] == b"\x1f\x8b":
        body = gzip.decompress(body)
    return json.loads(body)


def _strip_html(text):
    return re.sub(r"<[^>]+>", "", text or "").strip()


def get_cool():
    """酷安今日热门：rank_score 排序的热门动态"""
    d = _fetch_json(_STATLIST_URL)
    data = d.get("data", [])
    result = []
    seen = set()
    for item in data:
        if item.get("entityTemplate") != "feed":
            continue
        feed = item.get("feed", item)
        fid = feed.get("id")
        if not fid or fid in seen:
            continue
        seen.add(fid)
        # 标题：优先 message_title，否则取正文前段
        title = feed.get("message_title") or _strip_html(feed.get("message"))[:60]
        if not title:
            continue
        result.append({
            "title": title,
            "url": "https://www.coolapk.com/feed/{}".format(fid),
            "hotScore": feed.get("rank_score", 0),
        })
    return {"data": result}
