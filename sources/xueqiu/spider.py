import html as html_lib
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from urllib.parse import urlsplit

from curl_cffi import requests as curl_requests

TODAY_URL = "https://xueqiu.com/today"
HOT_API = "https://xueqiu.com/statuses/hot/listV2.json?since_id=-1&max_id=-1&size=15"

# 直连时报给雪球的指纹。实测 chrome120 / chrome123 能过政策层, chrome124 / chrome131 会被拦。
IMPERSONATE = os.getenv("XUEQIU_IMPERSONATE", "chrome120")
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36"
)

WAF_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "waf")
SOLVER = os.path.join(WAF_DIR, "solver.js")
NODE_PATH = os.getenv("WAF_NODE_PATH") or os.path.join(WAF_DIR, "node_modules")

TAG_RE = re.compile(r"<[^>]+>")
STOCK_TAG_RE = re.compile(r"\$[^$\s]{1,30}\$")
NODE_BIN = os.getenv("WAF_NODE_BIN", "node")


def _log():
    import logging

    return logging.getLogger(__name__)


# ---------- 直连方案: 挑战页 -> Node 算签名 -> 过 WAF ----------


def _solve_challenge(page_html, ext_scripts, target_url):
    """把挑战页丢给 Node + jsdom, 让雪球自己的脚本算出带 md5__1038 的 URL"""
    if not os.path.isfile(SOLVER):
        raise RuntimeError("缺少 waf/solver.js")
    work = tempfile.mkdtemp(prefix="xqwaf-")
    try:
        with open(os.path.join(work, "page.html"), "w", encoding="utf-8") as fh:
            fh.write(page_html)
        for i, code in enumerate(ext_scripts):
            with open(os.path.join(work, "ext_%d.js" % i), "w", encoding="utf-8") as fh:
                fh.write(code)
        env = dict(
            os.environ,
            WAF_DIR=work,
            WAF_URL=target_url,
            WAF_UA=UA,
            NODE_PATH=NODE_PATH,
            WAF_WAIT_MS=os.getenv("WAF_WAIT_MS", "15000"),
        )
        proc = subprocess.run(
            [NODE_BIN, SOLVER], env=env, capture_output=True, text=True, timeout=90
        )
        lines = [ln for ln in (proc.stdout or "").strip().splitlines() if ln.strip()]
        if not lines:
            raise RuntimeError("solver 无输出: %s" % (proc.stderr or "")[:300])
        result = json.loads(lines[-1])
        if not result.get("ok"):
            raise RuntimeError("solver 失败: %s" % str(result.get("error"))[:300])
        return result["url"]
    finally:
        shutil.rmtree(work, ignore_errors=True)


def _get_past_waf(session, url, timeout=25):
    """请求 url; 撞到 aliyunwaf 挑战页就算签名重放, 返回最终响应"""
    resp = session.get(url, timeout=timeout)
    if "renderData" not in resp.text:
        return resp

    host = "{0.scheme}://{0.netloc}".format(urlsplit(url))
    scripts = []
    for src in re.findall(r'<script[^>]*\bsrc="([^"]+)"', resp.text):
        script_url = src if src.startswith("http") else host + src
        scripts.append(session.get(script_url, timeout=timeout).text)
    signed = _solve_challenge(resp.text, scripts, url)
    return session.get(signed, timeout=timeout)


def _clean_text(text, limit=120):
    """雪球正文是 HTML: 去标签、去 $股票代码$ 标记, 压空白"""
    text = html_lib.unescape(TAG_RE.sub(" ", text or ""))
    text = STOCK_TAG_RE.sub(" ", text)
    return " ".join(text.split())[:limit].strip()


def _posts_from_json(payload):
    data, seen = [], set()
    for item in payload.get("items") or []:
        status = item.get("original_status") or {}
        status_id = status.get("id") or item.get("id")
        user_id = status.get("user_id")
        if not status_id:
            continue
        url = (
            "https://xueqiu.com/%s/%s" % (user_id, status_id)
            if user_id
            else "https://xueqiu.com/statuses/%s" % status_id
        )
        if url in seen:
            continue
        title = _clean_text(status.get("title")) or _clean_text(status.get("description"))
        if not title:
            continue
        seen.add(url)
        created = status.get("created_at")
        data.append({
            "title": title,
            "url": url,
            "hotScore": 0,
            "author": (status.get("user") or {}).get("screen_name") or "",
            "replyCount": status.get("reply_count") or 0,
            "time": time.strftime("%Y-%m-%d %H:%M", time.localtime(created / 1000))
            if created else "",
        })
    return data


def _fetch_direct(proxy=None):
    """不启浏览器: 两次挑战+签名, 一次拿 token, 一次拉 JSON"""
    if curl_requests is None:
        raise RuntimeError("没有 curl_cffi")
    session = curl_requests.Session(impersonate=IMPERSONATE)
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}
    session.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Referer": "https://xueqiu.com/",
        "Upgrade-Insecure-Requests": "1",
    })

    # 第一步: 打开 /today 过挑战, 顺便让雪球把 xq_a_token 等 cookie 种下来
    _get_past_waf(session, TODAY_URL)

    # 第二步: 接口需要 token, 带同一套 cookie 再过一次挑战
    session.headers.update({
        "Accept": "application/json, text/plain, */*",
        "Referer": TODAY_URL,
        "Origin": "https://xueqiu.com",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    })
    resp = _get_past_waf(session, HOT_API)
    body = resp.text
    if "renderData" in body:
        raise RuntimeError("接口仍是挑战页 (solver 没过)")
    if "安全策略拦截" in body:
        raise RuntimeError("被雪球政策层拦截 (567)")
    if not body.lstrip().startswith("{"):
        raise RuntimeError("接口没返回 JSON: %s" % _clean_text(body, 80))
    payload = json.loads(body)
    if payload.get("error_description"):
        raise RuntimeError("接口报错: %s" % payload.get("error_code"))
    posts = _posts_from_json(payload)
    if not posts:
        raise RuntimeError("接口返回 0 条")
    return posts


# ---------- 入口 ----------


def get_xueqiu_data(proxy=None):
    """雪球今日热帖: 直连 (Node 算 WAF 签名 -> JSON 接口)。

    浏览器兜底方案已在 2026-10-22 移除, 需要时按 NOTES.md「兜底方案」一节恢复。
    这里出错就直接抛: 让 task.py 记成 error, 不要静默返回空数据。
    """
    posts = _fetch_direct(proxy=proxy)
    _log().info("xueqiu direct ok, %d posts", len(posts))
    return {"data": posts}
