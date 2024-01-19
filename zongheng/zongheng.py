import requests

url = "https://www.zongheng.com/api/rank/details"

payload = {
    'cateFineId': '0',
    'cateType': '0',
    'pageNum': '1',
    'pageSize': '20',
    'period': '0',
    'rankNo':'',
    'rankType': '3',
}

res = requests.post(url, data=payload)
res_json = res.json()
data = []
for item in res_json.get("result", {}).get("resultList", []):
    data.append({
        "title": item.get("bookName"),
        "url": "https://www.zongheng.com/detail/{}".format(item.get("bookId")),
        "hotScore": 0
    })
print(data)