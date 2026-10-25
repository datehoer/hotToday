"""Süddeutsche Zeitung's editorial Topthemen feed, not a readership ranking."""
import html
from urllib.parse import urlsplit
from xml.etree import ElementTree

from curl_cffi import requests

URL = "https://rss.sueddeutsche.de/rss/Topthemen"


def parse_feed(body):
    root = ElementTree.fromstring(body)
    if root.tag != "rss" or root.find("channel") is None:
        raise ValueError("Süddeutsche: expected an RSS channel")
    rows, seen = [], set()
    for item in root.findall("channel/item"):
        title = " ".join(html.unescape(item.findtext("title") or "").split())
        link = (item.findtext("link") or "").strip()
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https"
                or parsed.hostname not in ("sueddeutsche.de", "www.sueddeutsche.de") or link in seen):
            continue
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("Süddeutsche: feed contains no valid articles")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_feed(response.content)
