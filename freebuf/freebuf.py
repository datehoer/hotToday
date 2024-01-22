import requests
import pyquery
from urllib.parse import urljoin
url = "https://www.freebuf.com/news"

res = requests.get(url)
doc = pyquery.PyQuery(res.text)
items = doc("div>.header-title~div").items()
data = []
for item in items:
    title = item("span.title").text()
    if title == "":
        continue
    hotScore = item("div>p.bottom-right").text().split("围观")[0]
    href = item("span.title").parent('a').attr("href")
    href = urljoin(url, href)
    data.append({
        "title": title,
        "hotScore": hotScore,
        "url": href
    })
print(data)
