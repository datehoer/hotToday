from curl_cffi import requests
def get_pmcaff_data():
    url = "https://coffee.pmcaff.com/list"

    payload = {
        'page': 1,
        'feed_sum': 15,
        'type': 2,
        'times': 0,
    }

    res = requests.post(url, data=payload)
    data = []
    res_json = res.json()
    if res_json['status'] == 200:
        results = res_json['data']
        for result in results:
            title = result['title']
            link = result['shareUrl']
            hotScore = result['viewNum']
            data.append({
                'title': title,
                'url': link,
                'hotScore': hotScore,
            })
    return data