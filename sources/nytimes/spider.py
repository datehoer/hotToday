from curl_cffi import requests
import xml.etree.ElementTree as ET

RSS_URL = "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"


def get_nytimes_data():
    """Fetch NYT World RSS and return the same list shape the extractor expects."""
    headers = {
        "User-Agent": "Mozilla/5.0 HotToday/1.0",
        "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
    }
    res = requests.get(RSS_URL, headers=headers, timeout=30)
    res.raise_for_status()
    root = ET.fromstring(res.content)
    data = []
    for item in root.findall(".//item"):
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        data.append({"title": title, "url": link, "hotScore": 0})
    if not data:
        raise ValueError("RSS feed contains no valid entries")
    return data
