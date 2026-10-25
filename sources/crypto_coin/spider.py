import json
import re

from curl_cffi import requests

# Crypto.com 改版后价格表格的价格/市值列在服务端是 <template> 占位, 由客户端再填充,
# 但页面里内嵌了 react-query 的脱水数据 (window["__RQ_…"].push({...})),
# 里面就是 limit=100 的币种列表, 含名称、slug、美元价和 24h 涨跌幅。
SOURCE_URL = "https://crypto.com/us/price?asset_nav=crypto"

PUSH_HEAD_RE = re.compile(r'window\["__RQ_[^"]*"\]')


def _parse_pushes(html):
    """把页面里所有 window["__RQ_…"].push(JSON) 的 JSON 解出来。"""
    decoder = json.JSONDecoder()
    payloads = []
    for match in PUSH_HEAD_RE.finditer(html):
        push_at = html.find(".push(", match.end())
        if push_at == -1:
            continue
        start = push_at + len(".push(")
        if html[start:start + 1] != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(html, start)
        except ValueError:
            continue
        if isinstance(payload, dict):
            payloads.append(payload)
    return payloads


def _find_coins(payloads):
    """在这些脱水查询里找币种列表 (元素带 usd_price 的那个)。"""
    for payload in payloads:
        for query in payload.get("queries") or []:
            state = query.get("state") or {}
            data = state.get("data") or {}
            if not isinstance(data, dict):
                continue
            items = data.get("data")
            if not isinstance(items, list) or not items:
                continue
            first = items[0]
            if isinstance(first, dict) and "usd_price" in first and "slug" in first:
                return items
    return []


def _format_price(value):
    if value is None or value == "":
        return ""
    price = float(value)
    if price >= 1:
        return "${:,.2f}".format(price)
    if price >= 0.01:
        return "${:.4f}".format(price)
    if price >= 0.0001:
        return "${:.6f}".format(price)
    return "${:.8f}".format(price)


def _format_change(value):
    if value is None or value == "":
        return ""
    return "{:+.2f}%".format(float(value) * 100)


def get_crypto_price():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    response = requests.get(SOURCE_URL, headers=headers, timeout=30, impersonate="chrome")
    if response.status_code != 200:
        raise RuntimeError(
            "crypto.com price page returned HTTP {} for {}".format(response.status_code, SOURCE_URL)
        )

    coins = _find_coins(_parse_pushes(response.text))
    if not coins:
        raise RuntimeError("coin list not found in dehydrated react-query data of " + SOURCE_URL)

    result = []
    for coin in coins:
        name = (coin.get("name") or coin.get("symbol") or "").strip()
        slug = (coin.get("slug") or "").strip()
        if not name or not slug:
            continue
        price = _format_price(coin.get("usd_price"))
        result.append({
            "url": "https://crypto.com/us/price/" + slug,
            "title": (name + " " + price).strip(),
            "hotScore": _format_change(coin.get("usd_price_change_24h")),
        })

    if not result:
        raise RuntimeError("coin list parsed but no usable rows at " + SOURCE_URL)
    return {"data": result}
