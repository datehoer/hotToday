"""ChoiceCheapies' New Zealand front-page deals; heat is net votes."""
from urllib.parse import urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://www.cheapies.nz/"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for node in doc.cssselect(".node-ozbdeal"):
        anchors = node.cssselect("h2.title a")
        if not anchors:
            continue
        anchor = anchors[0]
        title = " ".join(anchor.text_content().split())
        link = urljoin(URL, anchor.get("href", ""))
        parsed = urlsplit(link)
        if (not title or parsed.scheme != "https" or parsed.hostname != "www.cheapies.nz"
                or not parsed.path.startswith("/node/") or link in seen):
            continue
        up, down = node.cssselect(".voteup span"), node.cssselect(".votedown span")
        if not up or not down:
            raise ValueError("ChoiceCheapies: missing vote counts")
        score = int(up[0].text_content().replace(",", "")) - int(down[0].text_content().replace(",", ""))
        seen.add(link)
        rows.append({"title": title, "url": link, "hotScore": score})
        if len(rows) == 30:
            break
    if not rows:
        raise ValueError("ChoiceCheapies: no front-page deals found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25)
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
