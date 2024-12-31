from curl_cffi import requests
import pyquery
import re
import json


def get_dzenru_data():
    url = "https://dzen.ru/news"
    headers = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Pragma': 'no-cache',
        'Cookie': 'nc=opertopTooltipWasShown=true; news_lang=ru; zencookie=121284701735611374; zen_sso_checked=1; yandex_login=; yandexuid=5247530481730171102; zen_vk_sso_checked=1; news-fullscreen-showings-period-start-date=2024-12-31T02:16:47.362Z; news-fullscreen-current-position=1; is-news-fullscreen-waterfall-ended=false; is_auth_through_phone=true; Zen-User-Data={%22zen-theme%22:%22light%22%2C%22zen-theme-setting%22:%22light%22}; rec-tech=true; tmr_lvid=ef95123a25af4fc35e739d29271f7852; tmr_lvidTS=1735611418614; _ym_uid=1735611422892700771; _ym_d=1735611422; vid=d06f9ea8cd2e2ca3; _ym_isad=1; skip_dzen_pro=true; front_fpid=OE63EJW8WyZYeeJrG3THK; Session_id=noauth:1735611482; sessar=1.1197.CiDNxQhE8Wg1m3oELrzxL6WnY02oTvOR90q2xB2VOg2Wlg.yWE2rOsvOpsL6FUhOYtRk8dz1qzusYaTkkYmF3k-kos; ys=c_chck.780999284; mda2_beacon=1735611482890; _yasc=QcmDJjt5r2jYbmqeUqIic9wnQc/SVTGFOjWHD7i+qOH3OixUOaka/ROqLArduwsk; story-session-count=2; story-last-date-count=2024-12-31T05:02:09.793Z; story-view-count=1; Zen-User-Data={%22zen-theme%22:%22light%22}; is_online_stat=false; tmr_detect=0%7C1735621332321; domain_sid=OE63EJW8WyZYeeJrG3THK%3A1735621332666; is_online_cached=false',
        'Referer': 'https://sso.dzen.ru/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
    }
    session = requests.Session()
    session.get(url, headers=headers)
    res = session.get(url, headers=headers)
    doc = pyquery.PyQuery(res.content)
    items = doc("script[nonce]").items()
    data = []
    topList = []
    for item in items:
        text = item.text()
        if "window.Ya.Neo" in text:
            data_list = json.loads(re.findall("Neo=({.*})", text)[0])['dataSource']['news']['topList']
            for d in data_list[0]['stories']:
                title = d['title']
                link = d['url']
                hotScore = 0
                data.append({
                    "title": title,
                    "url": link,
                    "hotScore": hotScore
                })
            topList = data_list
    return {"data": data, "topList": topList}
