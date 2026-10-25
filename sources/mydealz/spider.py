"""mydealz community deals, with the site's own temperature as heat."""
import json
import math
from urllib.parse import urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.mydealz.de/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for article in doc.cssselect("article.thread"):
        anchors = article.cssselect("a.js-thread-title")
        if not anchors:
            continue
        anchor = anchors[0]
        title = " ".join(anchor.text_content().split())
        link = anchor.get("href", "")
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.mydealz.de"
                or not parsed.path.startswith("/deals/") or link in seen):
            continue
        thread = None
        for node in article.xpath(".//*[@data-vue3]"):
            thread = json.loads(node.get("data-vue3")).get("props", {}).get("thread")
            if thread is not None:
                break
        if thread is None:
            raise ValueError("mydealz: missing thread metadata")
        temperature = thread.get("temperature")
        if type(temperature) not in (int, float) or not math.isfinite(temperature):
            raise ValueError("mydealz: missing numeric temperature")
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": temperature})
        if len(rows) == 30:
            break
    if not rows:
        raise ValueError("mydealz: no community deals found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25, impersonate="chrome")
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
