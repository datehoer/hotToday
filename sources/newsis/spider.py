"""Newsis's own most-read sidebar; rank labels are not article text or heat."""
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.newsis.com/realnews/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for anchor in doc.cssselect(".rankBox .txtCont a"):
        # The numeric rank is a child element of the title paragraph.
        for rank in anchor.cssselect(".rank"):
            rank.drop_tree()
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.newsis.com"
                or not parsed.path.startswith("/view/") or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("Newsis: no most-read articles found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25, headers={"User-Agent": "Mozilla/5.0 HotToday/1.0"})
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
