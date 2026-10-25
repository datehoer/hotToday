"""DC Inside's realtime-best board; heat is the displayed view count."""
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit

from curl_cffi import requests
from lxml import html

URL = "https://gall.dcinside.com/board/lists/?id=dcbest"


def parse_page(text):
    doc = html.fromstring(text)
    rows, seen = [], set()
    for row in doc.cssselect(".gall_list tbody tr"):
        numbers = row.cssselect(".gall_num")
        # Pinned rules, surveys and advertisements are not best-board posts.
        if not numbers or not numbers[0].text_content().strip().isdigit():
            continue
        anchors = row.cssselect(".gall_tit a:not(.reply_numbox)")
        if not anchors:
            continue
        anchor = anchors[0]
        title = " ".join(anchor.text_content().split())
        parsed = urlsplit(urljoin(URL, anchor.get("href", "")))
        query = parse_qs(parsed.query)
        post_id = query.get("no", [""])[0]
        if (not title or parsed.scheme != "https" or parsed.hostname != "gall.dcinside.com" or parsed.path != "/board/view/"
                or query.get("id") != ["dcbest"] or not post_id.isdigit() or post_id in seen):
            continue
        counts = row.cssselect(".gall_count")
        count = counts[0].text_content().strip().replace(",", "") if counts else ""
        if not count.isdigit():
            raise ValueError("DC Inside: missing view count")
        seen.add(post_id)
        link = "https://gall.dcinside.com/board/view/?" + urlencode({"id": "dcbest", "no": post_id})
        rows.append({"title": title, "url": link, "hotScore": int(count)})
        if len(rows) == 30:
            break
    if not rows:
        raise ValueError("DC Inside: no realtime-best posts found")
    return rows


def get_data():
    response = requests.get(URL, timeout=25, headers={"User-Agent": "Mozilla/5.0 HotToday/1.0"})
    response.raise_for_status()
    return parse_page(response.content.decode("utf-8"))
