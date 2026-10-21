import os

from curl_cffi import requests

HTTP_TIMEOUT = float(os.getenv("HOT_HTTP_TIMEOUT", "30"))
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}


def get_douyin_hot_data():
    session = requests.Session()
    session.headers = headers.copy()
    session.headers['referer'] = "https://www.douyin.com"
    session.get("https://www.douyin.com/", timeout=HTTP_TIMEOUT, impersonate="chrome")
    res = session.get(
        "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&round_trip_time=50",
        timeout=HTTP_TIMEOUT,
        impersonate="chrome",
    )
    if res.status_code != 200:
        raise RuntimeError(f"douyin hot search status={res.status_code}")
    return res.json()
