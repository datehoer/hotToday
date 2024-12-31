import requests


def get_youxiputao_data():
    json_url = "https://youxiputao.com/api/article/index.html?page=1"
    res_json = requests.get(json_url).json()
    return res_json
