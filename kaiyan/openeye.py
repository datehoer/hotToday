import requests
def get_openeye_data():
    headers = {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
        "x-thefair-appid": "xfpa44crf2p70lk8",
        "x-thefair-auth": "",
        "x-thefair-cid": "",
        "x-thefair-forward-host": "https://api.eyepetizer.net",
        "x-thefair-ua": "EYEPETIZER_UNIAPP_H5/100000 (android;android;OS_VERSION_UNKNOWN;zh-Hans-CN;h5;2.0.0;cn-bj;SOURCE_UNKNOWN;PHPSESSID;2560*1440;NETWORK_UNKNOWN) cardsystem/2.0"
    }
    session = requests.session()

    session.get("https://m.eyepetizer.net/")
    session.post("https://proxy.eyepetizer.net/v1/card/page/get_nav", headers=headers, json={
        "tab_label": "mainpage",
        "version": "3.0.14"
    })
    res = session.post("https://proxy.eyepetizer.net/v1/card/page/get_page", headers=headers, json={
        "page_label": "recommend",
        "page_type": "card"
    })
    res_json = res.json()
    data = []
    items = res_json.get("result", [])
    for item in items.get("card_list", []):
        metro_list = item['card_data']['body'].get('metro_list', [])
        for metro in metro_list:
            title = metro['metro_data'].get('title', "")
            if title == "":
                continue
            link = metro['link']
            hotScore = metro['metro_data']['hot_value']
            data.append({
                "title": title,
                "url": link,
                "hotScore": hotScore
            })
    return data
