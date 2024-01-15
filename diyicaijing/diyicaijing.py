import requests
from urllib.parse import urljoin
url = "https://www.yicai.com/api/ajax/getranklistbykeys?keys=newsRank%2CvideoRank%2CimageRank%2CliveRank"

res = requests.get(url)

res_json = res.json()

hot_data = []
newsRank = res_json.get('newsRank', [])
for news in newsRank.get('week', []):
    title = news['NewsTitle']
    link = urljoin(url, news['url'])
    hotScore = 0
    hot_data.append({
        'title': title,
        'url': link,
        'hotScore': hotScore
    })
print(hot_data)