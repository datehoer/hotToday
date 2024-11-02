import hashlib
import datetime
import base64
import re
import bcrypt
from curl_cffi import requests


def get_v2_token(app_devices):
    device_code = app_devices
    format_base64 = re.compile('\\r\\n|\\r|\\n|=')
    token_part1 = "token://com.coolapk.market/dcf01e569c1e3db93a3d0fcf191a622c?"
    device_code_md5 = hashlib.md5(device_code.encode('utf-8')).hexdigest()
    timestamp = int(datetime.datetime.now().timestamp())
    timestamp_md5 = hashlib.md5(str(timestamp).encode('utf-8')).hexdigest()
    timestamp_base64 = re.sub(format_base64, '', base64.b64encode(str(timestamp).encode('utf-8')).decode())
    token = f'{token_part1}{timestamp_md5}${device_code_md5}&com.coolapk.market'
    token_base64 = re.sub(format_base64, '', base64.b64encode(token.encode('utf-8')).decode())
    token_base64_md5 = hashlib.md5(token_base64.encode('utf-8')).hexdigest()
    token_md5 = hashlib.md5(token.encode('utf-8')).hexdigest()
    arg = f'$2y$10${timestamp_base64}/{token_md5}'
    salt = (arg[:28] + 'u').encode('utf-8')
    crypt = bcrypt.hashpw(token_base64_md5.encode('utf-8'), salt)
    crypt_base64 = base64.b64encode(crypt).decode()
    return f'v2{crypt_base64}'

def get_cool():
    # hot rank
    app_device = "wGb15GI7MXeltWLlNXYlxWZyBSO5IjN3IjLwMTMxcTMwIDIw4CMukDIyV2c11yc1NXQgsDRENDMwk0XTV1UBByOzV3cBByOzV3cBByO2YjO1UjO0QjOwAjOwAjOyADI7AyOgsjYmNWMhR2NjZWZxUTZ4ImZ"
    headers = {
        "X-Requested-With": "XMLHttpRequest",
        "X-Sdk-Int": "28",
        "X-Sdk-Locale": "zh-CN",
        "X-App-Id": "com.coolapk.market",
        "X-App-Version": "12.4.2",
        "X-App-Code": "2208241",
        "X-Api-Version": "12",
        "X-Dark-Mode": "0",
        "X-App-Channel": "coolapk",
        "X-App-Mode": "universal",
        "X-App-Supported": "2208241",
    }
    page = 1
    url = f"https://api.coolapk.com/v6/page/dataList?url=%2Ffeed%2FstatList%3FcacheExpires%3D300%26statType%3Dday%26sortField%3Drank_score%26filterRepeatQuestionAnswer%3Dtrue%26title%3D%E4%BB%8A%E6%97%A5%E7%83%AD%E9%97%A8&page={page}&title=%E4%BB%8A%E6%97%A5%E7%83%AD%E9%97%A8"
    app_token = get_v2_token(app_device)
    headers['X-App-Token'] = app_token
    headers['X-App-Device'] = app_device
    res = requests.get(url, headers=headers, impersonate="chrome99_android")
    return res.json()