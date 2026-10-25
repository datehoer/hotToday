"""Business Watch's native most-read business and finance stories."""
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://news.bizwatch.co.kr/popular"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for anchor in doc.cssselect(".news_list dt a"):
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "news.bizwatch.co.kr"
                or not parsed.path.startswith("/article/") or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("Business Watch: no most-read articles found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
