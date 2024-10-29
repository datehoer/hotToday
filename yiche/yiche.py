import requests
import time
import hashlib
import random
cid = 508
headerEncryptKeys = [
    {
        "name": "pc",
        "value": "19DDD1FBDFF065D3A4DA777D2D7A81EC",
        "cid": "508"
    },
    {
        "name": "phone",
        "value": "DB2560A6EBC65F37A0484295CD4EDD25",
        "cid": "601"
    },
    {
        "name": "h5",
        "value": "745DFB2027E8418384A1F2EF1B54C9F5",
        "cid": "601"
    },
    {
        "name": "business_applet",
        "value": "64A1071F6C3C3CC68DABBF5A90669C0A",
        "cid": "601"
    },
    {
        "name": "wechat",
        "value": "AF23B0A6EBC65F37A0484395CE4EDD2K",
        "cid": "601"
    },
    {
        "name": "tencent",
        "value": "1615A9BDB0374D16AE9EBB3BBEE5353C",
        "cid": "750"
    }
]
timestamp = int(time.time()*1000)
article_url = "https://mapi.yiche.com/web_api/information_api/api/v1/news_article/articles_flow_ranking"
video_url = "https://mapi.yiche.com/web_api/player_api/api/v1/index/videos_flow_ranking"


def get_cidgcid():
    charss = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678'
    max_pos = len(charss)
    dd = ''.join(random.choice(charss) for _ in range(max_pos))
    return dd

def get_yiche_data():
    cidgcid = get_cidgcid()
    advertPage = get_cidgcid()+str(int(time.time()*1000))
    article_st = 'cid=' + str(cid) + '&param={"adTime":"2024-01-21","adCigdcid":"' + cidgcid + '"}'
    video_st = 'cid=' + str(cid) + '&param={"num":10,"adTime":"2024-01-21","advertPage":"' + advertPage + '","adCigdcid":"' + cidgcid + '"}'
    key = [i for i in headerEncryptKeys if i['cid'] == str(cid)][0]['value']
    article_sign = hashlib.md5((article_st+key+str(timestamp)).encode('utf-8')).hexdigest()
    video_sign = hashlib.md5((video_st+key+str(timestamp)).encode('utf-8')).hexdigest()
    article_params = {
        "cid": 508,
        "param": '{"adTime":"2024-01-21","adCigdcid":"' + cidgcid + '"}'
    }
    video_params = {
        "cid": 508,
        "param": '{"num":10,"adTime":"2024-01-21","advertPage":"' + advertPage + '","adCigdcid":"' + cidgcid + '"}'
    }
    article_headers = {
        "accept": "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "cid": "508",
        "content-type": "application/json;charset=UTF-8",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-city-id": "",
        "x-platform": "pc",
        "x-sign": article_sign,
        "x-timestamp": str(timestamp),
        "Referer": "https://www.yiche.com/",
        "Referrer-Policy": "no-referrer-when-downgrade"
    }
    video_headers = {
        "accept": "*/*",
        "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
        "cache-control": "no-cache",
        "cid": "508",
        "content-type": "application/json;charset=UTF-8",
        "pragma": "no-cache",
        "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": "\"Windows\"",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-site",
        "x-city-id": "",
        "x-platform": "pc",
        "x-sign": video_sign,
        "x-timestamp": str(timestamp),
        "Referer": "https://www.yiche.com/",
        "Referrer-Policy": "no-referrer-when-downgrade"
    }
    article_res = requests.get(article_url, params=article_params, headers=article_headers)
    article_res_json = article_res.json()
    return article_res_json
# video_res = requests.get(video_url, params=video_params, headers=video_headers)
# video_res_json = video_res.json()
# video_data = []
# if video_res_json['status'] == '1':
#     video_results = video_res_json['data']
#     for result in video_results:
#         title = result['shareData']['title']
#         link = result['shareData']['link']
#         hotScore = 0
#         video_data.append({
#             "title": title,
#             "url": link,
#             "hotScore": hotScore
#         })
# print(video_data)