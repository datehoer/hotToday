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
from githubspider.github import get_github_data
# from googlesearch.googlesearch import get_googlesearch_data
from mcpspider.mcpmarket import get_mcpmarket_data
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
# from sina.sina_sport import get_sina_sport_data
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
from v2ex.v2ex import get_v2ex_data
from hostloc.hostloc import get_hostloc_data
from linuxdo.linuxdo import get_linuxdo_data
from nodeseek.nodeseek import get_nodeseek_data
from wsj.wsj import get_wsj_data
# from nytimes.nytimes import get_nytimes_data
from bloomberg.bloomberg import get_bloomberg_data
from ft.ft import get_ft_data
from yna.yna import get_yna_data
from tagesschau.tagesschau import get_lemonde_data
from rt.rt import get_rt_data
from nhk.nhk import get_nhk_data
from newsau.newsau import get_newsau_data
from mumsnet.mumsnet import get_mumsnet_data
from foxnews.foxnews import get_foxnews_data
from fivech.fivech import get_5ch_data
from dailymail.dailymail import get_dailymail_data
from asahi.asahi import get_asahi_data
from dzenru.dzenru import get_dzenru_data
import psycopg2
import time
import httpx
from curl_cffi import requests
import random
import json
from config import PG_HOST, PG_DB, PG_PORT, PG_USER, PG_PASSWORD
import logging
import os
import glob

def manage_log_files(log_dir, max_logs=10):
    """管理日志文件数量，保留最新的max_logs个文件"""
    try:
        # 获取所有日志文件
        log_pattern = os.path.join(log_dir, 'hot_log_*.log')
        log_files = glob.glob(log_pattern)
        
        if len(log_files) > max_logs:
            # 按修改时间排序，最新的在前
            log_files.sort(key=lambda x: os.path.getmtime(x), reverse=True)
            
            # 删除超出数量的旧文件
            files_to_delete = log_files[max_logs:]
            for file_path in files_to_delete:
                try:
                    os.remove(file_path)
                    print(f"删除旧日志文件: {file_path}")
                except Exception as e:
                    print(f"删除日志文件失败 {file_path}: {e}")
                    
    except Exception as e:
        print(f"管理日志文件时出错: {e}")

current_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime())
log_filename = f'hot_log_{current_time}.log'
log_dir = '/opt/hotToday/logs'
os.makedirs(log_dir, exist_ok=True)
log_path = os.path.join(log_dir, log_filename)

# 配置日志
logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s'
)

# 管理日志文件数量
manage_log_files(log_dir, max_logs=10)

conn = psycopg2.connect(
    host=PG_HOST,
    port=PG_PORT,
    user=PG_USER,
    password=PG_PASSWORD,
    database=PG_DB
)
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}


def fetch(url, header):
    retry = 5
    while retry > 0:
        try:
            res = requests.get(url, headers=header, timeout=30, impersonate="chrome")
            if res.status_code == 200:
                data = res.json()
                return data
            retry -= 1
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)
        except Exception as err:
            retry -= 1
            logging.error(f"now_time: {time.time()}, url: {url}, error: {err}")
            if retry == 0:
                return None
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)


def get_weibo_data():
    weibo_url = "https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot"
    table_name = "weibo_hot_search"
    data = httpx.get(weibo_url, timeout=30).json()
    data['insert_time'] = time.time()
    insert_data(table_name, data)


def get_zhihu_hot_data():
    table_name = 'zhihu_hot_list'
    zhihu_hot_list_url = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=50&desktop=true"
    data = fetch(zhihu_hot_list_url, headers)
    insert_data(table_name, data)


def get_douyin_hot_data():
    table_name = 'douyin_hot'
    session = requests.Session()
    session.headers = headers
    session.get("https://www.douyin.com/passport/general/login_guiding_strategy/?aid=6383", impersonate="chrome")
    res = session.get("https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&round_trip_time=50", impersonate="chrome")
    if res.status_code == 200:
        data = res.json()
        insert_data(table_name, data)


def get_bilibili_hot_data():
    bilibili_hot_url = "https://api.bilibili.com/x/web-interface/ranking/v2"
    table_name = 'bilibili_hot'
    err = 5
    while err > 0:
        bili_headers = {}
        res = requests.get(bilibili_hot_url, headers=bili_headers, timeout=30, impersonate="chrome")
        data = res.json()
        data_code = data.get("code", 352)
        if data_code == 0:
            insert_data(table_name, data)
            break
        else:
            err -= 1
            logging.error("bilibili_hot data get error")
            time.sleep(3)


def get_wx_read_rank():
    url = "https://weread.qq.com/web/bookListInCategory/rising?rank=1"
    table_name = 'wx_read_rank'
    data = fetch(url, headers)
    insert_data(table_name, data)


def get_tieba_topic():
    url = "https://tieba.baidu.com/hottopic/browse/topicList"
    table_name = 'tieba_topic'
    data = fetch(url, headers)
    insert_data(table_name, data)


def get_juejin_hot():
    url = "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot"
    table_name = 'juejin_hot'
    data = fetch(url, headers)
    insert_data(table_name, data)


def get_toutiao_hot():
    url = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
    table_name = 'toutiao_hot'
    data = fetch(url, headers)
    insert_data(table_name, data)


def get_ssp_hot():
    url = "https://sspai.com/api/v1/article/tag/page/get?limit=50&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0"
    table_name = 'shaoshupai_hot'
    data = fetch(url, headers)
    insert_data(table_name, data)


def insert_data(table_name, data):
    """通用数据插入函数"""
    if not data:
        logging.error(f"{table_name} data fetch failed")
        return
    cursor = None
    try:
        cursor = conn.cursor()
        if "data" in data:
            data = data["data"]
        cursor.execute(
            f'INSERT INTO "{table_name}" (data, insert_time) VALUES (%s, %s)',
            (json.dumps(data), int(time.time()))
        )
        logging.info(f"{table_name} data inserted")
    except Exception as err:
        logging.error(f"Error inserting into {table_name}: {err}")
    finally:
        if cursor:
            cursor.close()


if __name__ == "__main__":
    try:
        def safe_insert(collection_name, data_func):
            try:
                insert_data(collection_name, data_func())
            except Exception as err:
                logging.error(f"Error inserting {collection_name} data: {err}")
        safe_insert("huxiu", get_huxiu_data)
    except Exception as error:
        logging.error(f"some error happen: {error}")
    finally:
        conn.commit()
        conn.close()
        logging.info("All data inserted")
