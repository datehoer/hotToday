"""RSS-backed editorial sources for the HotToday source list."""

import html
import re
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree


FEEDS = {
    "dezeen": ("https://www.dezeen.com/feed/", "dezeen.com"),
    "gcores": ("https://www.gcores.com/rss", "gcores.com"),
    "designboom": ("https://www.designboom.com/feed/", "designboom.com"),
}
MAX_FEED_BYTES = 3_000_000
MAX_ITEMS = 20


def parse_rss(body, expected_domain):
    """Keep feed order and return items in the existing rank-card format."""
    root = ElementTree.fromstring(body.lstrip())
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Expected an RSS channel")

    items = []
    seen_urls = set()
    for entry in channel.findall("item"):
        title_node = entry.find("title")
        title = "" if title_node is None else "".join(title_node.itertext())
        title = re.sub(r"\s+", " ", html.unescape(title)).strip()
        url = html.unescape((entry.findtext("link") or "").strip())
        parsed = urlsplit(url)
        if (
            not title
            or parsed.scheme not in ("http", "https")
            or parsed.hostname not in (expected_domain, "www." + expected_domain)
            or url in seen_urls
        ):
            continue
        seen_urls.add(url)
        items.append({"title": title, "url": url, "hotScore": 0})
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        raise ValueError("RSS feed contains no valid entries")
    return {"data": items}


def get_editorial_rss_data(source):
    feed_url, expected_domain = FEEDS[source]
    request = Request(feed_url, headers={"User-Agent": "Mozilla/5.0 HotToday/1.0"})
    with urlopen(request, timeout=25) as response:
        body = response.read(MAX_FEED_BYTES + 1)
    if len(body) > MAX_FEED_BYTES:
        raise ValueError("RSS feed exceeds size limit")
    return parse_rss(body, expected_domain)
