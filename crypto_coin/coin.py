from curl_cffi import requests
import pyquery

def get_crypto_price():
    # Crypto.com 改版，表格改为 Mantine datatable，原 p.chakra-text 选择器失效
    url = "https://crypto.com/price"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=30, impersonate="chrome")
    doc = pyquery.PyQuery(response.text)
    rows = doc("tr[class*='mantine-datatable-row']").items()
    result = []
    for price in rows:
        name = price.find("td a[href*='/price/'] p[title]").eq(0).attr("title")
        if not name:
            continue
        link = price.find("td a[href*='/price/']").attr("href")
        tds = price("td")
        crypto_price = tds.eq(2).text().strip()
        change = tds.eq(3).text().strip()
        if link and link.startswith("/"):
            link = "https://crypto.com" + link
        result.append({
            "url": link,
            "title": name + " " + crypto_price,
            "hotScore": change
        })
    return {"data": result}
