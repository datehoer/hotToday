import requests
import pyquery
from urllib.parse import urljoin
url = "https://sspai.com/"
res = requests.get(url)
doc = pyquery.PyQuery(res.content)

article_box = doc(".articleCard-box>div").items()
for article in article_box:
    title = article.find(".title").text()
    if title == "派早报":
        link = urljoin(url, article.find(".pai_title a").attr('href'))
        res = requests.get(link)
        doc = pyquery.PyQuery(res.content)
        h3s = doc(".content>h3").items()
        data_list = []
        for h3 in h3s:
            title = h3.text()
            next_element = h3.next()
            h3_url = ""
            # 循环检查紧跟在 h3 后的 p 标签
            while next_element.is_('p'):
                h3_url = next_element.find('a').attr("href")
                next_element = next_element.next()
            data_list.append({
                "url": h3_url,
                "title": title,
                "hotScore": 0
            })
        print(data_list)
        break