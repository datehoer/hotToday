import html
import re
from urllib.parse import urlsplit
from xml.etree import ElementTree

from curl_cffi import requests

FEED_URL = "https://www.dezeen.com/feed/"
USER_AGENT = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36")
MAX_ITEMS = 20


def fetch(proxy=None):
    kwargs = {"timeout": 25, "headers": {"User-Agent": USER_AGENT}}
    if proxy:
        kwargs["proxies"] = {"http": proxy, "https": proxy}
    res = requests.get(FEED_URL, **kwargs)
    if res.status_code != 200:
        raise RuntimeError(f"HTTP {res.status_code}")

    body = res.content
    root = ElementTree.fromstring(body.lstrip())
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Expected an RSS channel")

    domain = urlsplit(FEED_URL).hostname.removeprefix("www.")
    items = []
    seen_urls = set()
    for entry in channel.findall("item"):
        title_node = entry.find("title")
        title = "" if title_node is None else "".join(title_node.itertext())
        title = re.sub(r"\s+", " ", html.unescape(title)).strip()
        link = html.unescape((entry.findtext("link") or "").strip())
        parsed = urlsplit(link)
        if (not title or parsed.scheme not in ("http", "https")
                or parsed.hostname not in (domain, "www." + domain)
                or link in seen_urls):
            continue
        seen_urls.add(link)
        items.append({"title": title, "url": link, "hotScore": 0})
        if len(items) >= MAX_ITEMS:
            break

    if not items:
        raise ValueError("RSS feed contains no valid entries")
    return items
