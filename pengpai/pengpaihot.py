import requests
def get_pengpai_hot():
    url = "https://cache.thepaper.cn/contentapi/wwwIndex/rightSidebar"
    res = requests.get(url, timeout=30)
    return res.json()
