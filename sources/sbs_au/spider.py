"""SBS Australia's own homepage headlines, not a most-read ranking."""
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.sbs.com.au/news"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for anchor in doc.cssselect('main a[class*="cardTitleLink"]'):
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.sbs.com.au"
                or not parsed.path.startswith("/news/article/") or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("SBS Australia: no news headlines found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
