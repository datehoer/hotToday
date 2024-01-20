# 人人都是产品经理
import requests

url = "https://www.woshipm.com/api2/app/article/popular/daily"
res = requests.get(url)
data = []
res_json = res.json()
if res_json.get("CODE", 0) == 200:
    results = res_json.get('RESULT', [])
    for result in results:
        result_data = result['data']
        title = result_data['articleTitle']
        link = "https://www.woshipm.com/{}/{}.html".format(result_data['type'], result_data['id'])
        hotScore = result['scores']
        data.append({
            "title": title,
            "link": link,
            "hotScore": hotScore
        })
print(data)
