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
    res_json = res.json()
    return res_json