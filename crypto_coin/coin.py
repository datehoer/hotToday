import requests
import pyquery
def get_crypto_price():
    url = "https://crypto.com/price"
    response = requests.get(url)
    doc = pyquery.PyQuery(response.text)
    prices = doc("div>table>tbody>tr").items()
    result = []
    for price in prices:
        name = price("p.chakra-text").eq(0).text()
        crypto_price = price("p.chakra-text").eq(1).text()
        aoi = price("p.chakra-text").eq(-1).text()
        result.append({
            "url": "https://crypto.com/price/" + name.lower(),
            "title": name + " " + crypto_price,
            "hotScore": aoi
        })
    return {"data": result}