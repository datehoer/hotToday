from coolan.coolan import get_cool
from pymongo import MongoClient
import time
from config import MONGO_URI, MONGO_DB
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}
def insert_data(collection_name, data):
    """通用数据插入函数"""
    if not data:
        print(f"{collection_name} data fetch failed")
        return
    
    collection = db[collection_name]
    data['insert_time'] = time.time()
    collection.insert_one(data)
    print(f"{collection_name} data inserted")

if __name__ == "__main__":
    try:
        def safe_insert(collection_name, data_func):
            try:
                insert_data(collection_name, data_func())
            except Exception as e:
                print(f"Error inserting {collection_name} data: {e}")

        safe_insert("coolan", get_cool)

    finally:
        client.close()