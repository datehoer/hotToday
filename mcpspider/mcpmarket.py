from curl_cffi import requests
def get_mcpmarket_data():
    url = "https://mcpmarket.cn/api/servers?page=2&per_page=12&category=%E5%85%A8%E9%83%A8&sort_by=popular"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
    }
    res = requests.get(url, headers=headers, impersonate="chrome")
    data = res.json().get("servers")
    return {"data": data}
