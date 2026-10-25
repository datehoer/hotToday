"""TVNZ's 1News homepage headlines, preserving the publisher's original URLs."""
import re
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.1news.co.nz/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for heading in doc.cssselect("h3.storyHeadline"):
        anchors = heading.xpath("ancestor::a[1]")
        if not anchors:
            continue
        title = " ".join(heading.text_content().split())
        link = urljoin(URL, anchors[0].get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.1news.co.nz"
                or not re.match(r"/\d{4}/\d{2}/\d{2}/", parsed.path) or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("1News: no homepage headlines found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
