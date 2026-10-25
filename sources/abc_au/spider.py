"""ABC Australia's editorial top stories. No readership counts are published."""
import re
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.abc.net.au/news/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for anchor in doc.cssselect('[class*="TopStoriesCardList_grid"] a[class*="FullBleedLink_root"]'):
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.abc.net.au"
                or not re.match(r"/news/\d{4}-\d{2}-\d{2}/", parsed.path) or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("ABC Australia: no top-story headlines found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
