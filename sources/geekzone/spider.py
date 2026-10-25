"""Geekzone's most recent discussions; this list is not a popularity ranking."""
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit
from urllib.request import Request, urlopen

from lxml import html

URL = "https://www.geekzone.co.nz/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for anchor in doc.cssselect('.boxGreen a[href*="topicid="]'):
        title = " ".join(anchor.text_content().split())
        parsed = urlsplit(urljoin(URL, anchor.get("href", "")))
        query = parse_qs(parsed.query)
        forum_id, topic_id = query.get("forumid", [""])[0], query.get("topicid", [""])[0]
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.geekzone.co.nz" or parsed.path != "/forums.asp"
                or not forum_id.isdigit() or not topic_id.isdigit() or "page_no" in query
                or topic_id in seen):
            continue
        seen.add(topic_id)
        link = URL + "forums.asp?" + urlencode({"forumid": forum_id, "topicid": topic_id})
        rows.append({"title": title, "url": link, "hotScore": 0})
        if len(rows) == 20:
            break
    if not rows:
        raise ValueError("Geekzone: no recent discussions found")
    return rows


def get_data():
    # The site rejects the curl transport even with a User-Agent; a normal
    # HTTP/1.1 request to the public homepage works without cookies or a proxy.
    request = Request(URL, headers={"User-Agent": "Mozilla/5.0 HotToday/1.0"})
    with urlopen(request, timeout=25) as response:
        body = response.read(3_000_001)
    if len(body) > 3_000_000:
        raise ValueError("Geekzone: response exceeds size limit")
    return parse_page(body.decode("utf-8"))
