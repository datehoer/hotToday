"""Naver's per-publisher most-read lists, interleaved by rank for coverage."""
from urllib.parse import urlsplit, urlunsplit

from curl_cffi import requests
from lxml import html

URL = "https://news.naver.com/main/ranking/popularDay.naver"


def parse_page(text):
    doc = html.fromstring(text)
    publishers = [box.cssselect(".rankingnews_list a.list_title")
                  for box in doc.cssselect(".rankingnews_box")]
    rows, seen = [], set()
    # This page has no overall rank or public view counts. Take each publisher's
    # first story before their second, rather than filling the list from one outlet.
    for rank in range(max((len(links) for links in publishers), default=0)):
        for links in publishers:
            if rank >= len(links):
                continue
            anchor = links[rank]
            title = " ".join(anchor.text_content().split())
            parsed = urlsplit(anchor.get("href", ""))
            if (not title or parsed.scheme != "https" or parsed.hostname != "n.news.naver.com"
                    or not parsed.path.startswith("/article/")):
                continue
            link = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))
            if link in seen:
                continue
            seen.add(link)
            rows.append({"title": title, "url": link, "hotScore": 0})
            if len(rows) == 100:
                return rows
    if not rows:
        raise ValueError("Naver: no publisher ranking articles found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    # The ranking page is EUC-KR; the HTTP charset takes precedence over UTF-8.
    return parse_page(response.content.decode(response.encoding))
