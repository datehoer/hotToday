from curl_cffi import requests
from pyquery import PyQuery as pq
from urllib.parse import urljoin
def get_rank_list():
    url = "https://www.qidian.com/rank/readindex/"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-User': '?1',
        'Sec-Fetch-Dest': 'document',
        'Referer': 'https://www.qidian.com/rank/readindex/',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        "Cookie": "w_tsfp=ltvgWVEE2utBvS0Q6aLhkkynFT07Z2R7xFw0D+M9Os09AaIpVZ2F1IN9udfldCyCt5Mxutrd9MVxYnGAV94ifhEdRsWTb5tH1VPHx8NlntdKRQJtA83YW1YXKrIh7TVFKT8LcBGy2D15IoFByeNmiA0EsSEg37ZlCa8hbMFbixsAqOPFm/97DxvSliPXAHGHM3wLc+6C6rgv8LlSgS3A9wqpcgQ2Xusewk+A1SgfDngj4RG7dOldNRytI86vWO0wrTPzwjn3apCs2RYx/UJk6EtuWZaxhCfAPX4VKFhsbVzg1Lkkfqf4PuFx6jcbVKQcGg8SoF4Yt+s66wk="
    }
    res = requests.get(url, headers=headers)
    doc = pq(res.content)
    rank_list = doc("#book-img-text ul>li").items()
    data = []
    for i in rank_list:
        title = i.find("h2>a").text()
        link = i.find("h2>a").attr("href")
        hotScore = 0
        data.append({
            "title": title,
            "url": urljoin(url, link),
            "hotScore": hotScore
        })
    return {"data":data}