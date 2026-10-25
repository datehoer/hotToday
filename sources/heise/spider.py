"""heise's native Atom feed. Only headlines and original article links are kept."""
import html
from urllib.parse import urlsplit
from xml.etree import ElementTree

from curl_cffi import requests

URL = "https://www.heise.de/rss/heise-atom.xml"
ATOM = "{http://www.w3.org/2005/Atom}"


def parse_feed(body):
    root = ElementTree.fromstring(body)
    if root.tag != ATOM + "feed":
        raise ValueError("heise: expected an Atom feed")
    rows, seen = [], set()
    for entry in root.findall(ATOM + "entry"):
        title_node = entry.find(ATOM + "title")
        title = "" if title_node is None else "".join(title_node.itertext())
        title = " ".join(html.unescape(title).split())
        for node in entry.findall(ATOM + "link"):
            if node.get("rel", "alternate") != "alternate":
                continue
            link = node.get("href", "").strip()
            parsed = urlsplit(link)
            if (not title or parsed.scheme != "https"
                    or parsed.hostname not in ("heise.de", "www.heise.de") or link in seen):
                continue
            seen.add(link)
            rows.append({"title": title, "url": link, "hotScore": 0})
            break
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("heise: feed contains no valid articles")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_feed(response.content)
