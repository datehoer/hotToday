# -*- coding: utf-8 -*-
from threeDM.threeDM import get_3dm_data
from threesixKe.threesixKe import get_36kr_data
from five2pj.five2pj import fetch_52pj_data
from acfun.acFun import get_acfun_data
from anquanke.anquanke import get_anquanke_data
from baidu.baidu import get_baidu_data
from baijingchuhai.baijingchuhai import get_baijingchuhai_data
from csdn.csdn import get_csdn_data
from dianshangbao.dianshangbao import get_dianshangbao_data
from diyicaijing.diyicaijing import get_diyicaijing_data
from dongchedi.dongchedi import get_dongchedi_hot_search
from douban.douban import get_douban_movie_data
from freebuf.freebuf import get_freebuf_data
from github.github import get_github_data
from googlesearch.googlesearch import get_googlesearch_data
from hupu.hupu import get_hupu_data
from huxiu.huxiu import get_huxiu_data
from ithome.ithome import get_ithome_data
from kaiyan.openeye import get_openeye_data
from kanxue.kanxue import get_kanxue_data   
from kuandaishan.kuandaishan import get_kuandaishan_data
from pmcaff.pmcaff import get_pmcaff_data
from qichezhijia.qichezhijia import get_qichezhijia_data
from qidian.qidian import get_rank_list
from shuimu.shuimu import get_shuimu_data
from sina.sina import get_sina_data
from sina.sina_sport import get_sina_sport_data
from sina.sina_news import get_sina_news
from taipingyang.taipingyang import get_taipingyang_data
from taptap.taptap import get_taptap_data
from tencent.tencent import get_tencent_data
from woshipm.woshipm import get_woshipm_data  
from xueqiu.xueqiu import get_xueqiu_data
from yiche.yiche import get_yiche_data
from youshedubao.youshedubao import get_youshedubao_data
from youxiputao.youxiputao import get_youxiputao_data
from zhanku.zhanku import get_zhanku_data
from zongheng.zongheng import get_zongheng_data
from coolan.coolan import get_cool
from hacknews.hacknews import get_hacker_news
from historytoday.historyday import get_history_today
from wallstreetcn.wallstreetcn import get_wallstreetcn_data
from pengpai.pengpaihot import get_pengpai_hot
from crypto_coin.coin import get_crypto_price
from ithome.needknow import get_ithome_needknow_data
from readhub.readhub import get_readhub_data
from pymongo import MongoClient
import time
import httpx
from curl_cffi import requests
import random
from config import MONGO_URI, MONGO_DB
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}
def fetch(url, header):
    retry = 5
    while retry > 0:
        try:
            res = requests.get(url, headers=header)
            if res.status_code == 200:
                data = res.json()
                data['insert_time'] = time.time()
                return data
            retry -= 1
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)
        except Exception as e:
            retry -= 1
            print("now_time: {}, url: {}, error: {}".format(time.time(), url, str(e)))
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)

def get_weibo_data():
    weibo_url = "https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot"
    article = db["weibo_hot_search"]
    data = httpx.get(weibo_url).json()
    data['insert_time'] = time.time()
    article.insert_one(data)
    print("weibo Data inserted")


def get_zhihu_hot_data():
    zhihu_hot_list = db['zhihu_hot_list']
    zhihu_hot_list_url = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=100"
    data = fetch(zhihu_hot_list_url, headers)
    zhihu_hot_list.insert_one(data)
    print("zhihu data inserted")

def get_douyin_hot_data():
    douyin_hot = db['douyin_hot']
    session = requests.Session()
    session.headers = headers
    session.get("https://www.douyin.com/passport/general/login_guiding_strategy/?aid=6383")
    res = session.get("https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&round_trip_time=50")
    if res.status_code == 200:
        data = res.json()
        data['insert_time'] = time.time()
        douyin_hot.insert_one(data)
        print("douyin data inserted")
def get_bilibili_hot_data():
    bilibili_hot_url = "https://api.bilibili.com/x/web-interface/ranking/v2"
    bilibili_hot = db['bilibili_hot']
    err = 5
    while err > 0:
        bili_headers = {}
        res = requests.get(bilibili_hot_url, headers=bili_headers)
        data = res.json()
        data_code = data.get("code", 352)
        if data_code == 0:
            data['insert_time'] = time.time()
            bilibili_hot.insert_one(data)
            print("bilibili_hot data get success")
            break
        else:
            print(data)
            err -= 1
            print("bilibili_hot data get error")
            time.sleep(3)


def get_wx_read_rank():
    url = "https://weread.qq.com/web/bookListInCategory/rising?rank=1"
    wx_read = db['wx_read_rank']
    data = fetch(url, headers)
    wx_read.insert_one(data)
    print("wx_read_rank data inserted")


def get_tieba_topic():
    url = "https://tieba.baidu.com/hottopic/browse/topicList"
    tieba = db['tieba_topic']
    data = fetch(url, headers)
    tieba.insert_one(data)
    print("tieba topic data inserted")

def get_juejin_hot():
    url = "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot"
    juejin_hot = db['juejin_hot']
    data = fetch(url, headers)
    juejin_hot.insert_one(data)
    print("juejin_hot data inserted")


def get_toutiao_hot():
    url = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
    toutiao_hot = db['toutiao_hot']
    data = fetch(url, headers)
    toutiao_hot.insert_one(data)
    print("toutiao_hot data inserted")


def get_ssp_hot():
    url = "https://sspai.com/api/v1/article/tag/page/get?limit=50&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0"
    shaoshupai_hot = db['shaoshupai_hot']
    data = fetch(url, headers)
    shaoshupai_hot.insert_one(data)
    print("shaoshupai data inserted")

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
        # 现有的直接插入MongoDB的函数
        try:
            get_toutiao_hot()
        except Exception as e:
            print(f"Error fetching toutiao_hot data: {e}")

        try:
            get_juejin_hot()
        except Exception as e:
            print(f"Error fetching juejin_hot data: {e}")

        try:
            get_tieba_topic()
        except Exception as e:
            print(f"Error fetching tieba_topic data: {e}")

        try:
            get_wx_read_rank()
        except Exception as e:
            print(f"Error fetching wx_read_rank data: {e}")

        try:
            get_zhihu_hot_data()
        except Exception as e:
            print(f"Error fetching zhihu_hot data: {e}")

        try:
            get_weibo_data()
        except Exception as e:
            print(f"Error fetching weibo data: {e}")

        try:
            get_ssp_hot()
        except Exception as e:
            print(f"Error fetching shaoshupai_hot data: {e}")

        try:
            get_douyin_hot_data()
        except Exception as e:
            print(f"Error fetching douyin_hot data: {e}")

        try:
            get_bilibili_hot_data()
        except Exception as e:
            print(f"Error fetching bilibili_hot data: {e}")

        # 新的数据插入方式，增加每个插入的try-except
        def safe_insert(collection_name, data_func):
            try:
                insert_data(collection_name, data_func())
            except Exception as e:
                print(f"Error inserting {collection_name} data: {e}")

        # 通过 safe_insert 函数插入数据
        safe_insert("pengpai", get_pengpai_hot)
        safe_insert("crypto_coin", get_crypto_price)
        safe_insert("3dm", get_3dm_data)
        safe_insert("36kr", get_36kr_data)
        safe_insert("52pj", fetch_52pj_data)
        safe_insert("acfun", get_acfun_data)
        safe_insert("anquanke", get_anquanke_data)
        safe_insert("baidu_hot_search", get_baidu_data)
        safe_insert("baijingchuhai", get_baijingchuhai_data)
        safe_insert("csdn", get_csdn_data)
        safe_insert("dianshangbao", get_dianshangbao_data)
        safe_insert("diyicaijing", get_diyicaijing_data)
        safe_insert("dongchedi", get_dongchedi_hot_search)
        safe_insert("douban_movie", get_douban_movie_data)
        safe_insert("freebuf", get_freebuf_data)
        safe_insert("github", get_github_data)
        safe_insert("google_search", get_googlesearch_data)
        safe_insert("hupu", get_hupu_data)
        safe_insert("huxiu", get_huxiu_data)
        safe_insert("ithome", get_ithome_data)
        safe_insert("openeye", get_openeye_data)
        safe_insert("kanxue", get_kanxue_data)
        safe_insert("kuandaishan", get_kuandaishan_data)
        safe_insert("pmcaff", get_pmcaff_data)
        safe_insert("qichezhijia", get_qichezhijia_data)
        safe_insert("qidian", get_rank_list)
        safe_insert("shuimu", get_shuimu_data)
        safe_insert("sina", get_sina_data)
        safe_insert("sina_sport", get_sina_sport_data)
        safe_insert("sina_news", get_sina_news)
        safe_insert("taipingyang", get_taipingyang_data)
        safe_insert("taptap", get_taptap_data)
        safe_insert("tencent_news", get_tencent_data)
        safe_insert("woshipm", get_woshipm_data)
        # safe_insert("xueqiu", get_xueqiu_data)
        safe_insert("yiche", get_yiche_data)
        safe_insert("youshedubao", get_youshedubao_data)
        safe_insert("youxiputao", get_youxiputao_data)
        safe_insert("zhanku", get_zhanku_data)
        safe_insert("zongheng", get_zongheng_data)
        # safe_insert("coolan", get_cool)
        safe_insert("hacknews", get_hacker_news)
        safe_insert("historytoday", get_history_today)
        safe_insert("wallstreetcn", get_wallstreetcn_data)
        safe_insert("readhub", get_readhub_data)
        safe_insert("needknow", get_ithome_needknow_data)

    finally:
        client.close()