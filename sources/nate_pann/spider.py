"""Nate Pann's realtime community ranking; heat is the displayed view count."""
import re
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://pann.nate.com/talk/ranking"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for row in doc.cssselect(".cntList li"):
        anchors = row.cssselect("h2 a")
        if not anchors:
            continue
        anchor = anchors[0]
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "pann.nate.com"
                or not re.fullmatch(r"/talk/\d+", parsed.path) or link in seen):
            continue
        counts = row.cssselect(".count")
        match = re.search(r"조회\s*([\d,]+)", counts[0].text_content()) if counts else None
        if not match:
            raise ValueError("Nate Pann: missing view count")
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": int(match[1].replace(",", ""))})
        if len(rows) == 30:
            break
    if not rows:
        raise ValueError("Nate Pann: no ranked posts found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
