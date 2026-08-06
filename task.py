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
# from freebuf.freebuf import get_freebuf_data
from githubspider.github import get_github_data
# from googlesearch.googlesearch import get_googlesearch_data
from mcpspider.mcpmarket import get_mcpmarket_data
from hupu.hupu import get_hupu_data
from huxiu.huxiu import get_huxiu_data
from ithome.ithome import get_ithome_data
from kaiyan.openeye import get_openeye_data
from kanxue.kanxue import get_kanxue_data   
from kuandaishan.kuandaishan import get_kuandaishan_data
# from pmcaff.pmcaff import get_pmcaff_data
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
# from hostloc.hostloc import get_hostloc_data
from linuxdo.linuxdo import get_linuxdo_data
from nodeseek.nodeseek import get_nodeseek_data
from wsj.wsj import get_wsj_data
from nytimes.nytimes import get_nytimes_data
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
from config import PG_HOST, PG_DB, PG_PORT, PG_USER, PG_PASSWORD, PROXY
import os
import glob
import sys
from loguru import logger

HTTP_TIMEOUT = float(os.getenv("HOT_HTTP_TIMEOUT", "30"))
PG_CONNECT_TIMEOUT = int(os.getenv("HOT_PG_CONNECT_TIMEOUT", "10"))

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
                    logger.info(f"删除旧日志文件: {file_path}")
                except Exception as e:
                    logger.warning(f"删除日志文件失败 {file_path}: {e}")
                    
    except Exception as e:
        logger.warning(f"管理日志文件时出错: {e}")

current_time = time.strftime('%Y-%m-%d_%H-%M-%S', time.localtime())
log_filename = f'hot_log_{current_time}.log'
log_dir = os.getenv("HOT_LOG_DIR", "/opt/hotToday/logs")
try:
    os.makedirs(log_dir, exist_ok=True)
except Exception:
    log_dir = os.path.join(os.path.dirname(__file__), "logs")
    os.makedirs(log_dir, exist_ok=True)

log_path = os.path.join(log_dir, log_filename)

logger.remove()
logger.add(sys.stderr, level=os.getenv("HOT_LOG_LEVEL", "INFO"))
logger.add(
    log_path,
    level=os.getenv("HOT_LOG_LEVEL", "INFO"),
    format="{time:YYYY-MM-DD HH:mm:ss} {level} {message}",
    encoding="utf-8",
    enqueue=True,
)

# 管理日志文件数量
manage_log_files(log_dir, max_logs=10)

logger.info(f"日志路径: {log_path}")
logger.info(f"HTTP timeout: {HTTP_TIMEOUT}s, PG connect timeout: {PG_CONNECT_TIMEOUT}s")

logger.info("Connecting to PostgreSQL...")
conn = psycopg2.connect(
    host=PG_HOST,
    port=PG_PORT,
    user=PG_USER,
    password=PG_PASSWORD,
    database=PG_DB,
    connect_timeout=PG_CONNECT_TIMEOUT,
)
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"
}


def fetch(url, header):
    retry = 5
    while retry > 0:
        try:
            res = requests.get(url, headers=header, timeout=HTTP_TIMEOUT, impersonate="chrome")
            if res.status_code == 200:
                data = res.json()
                return data
            retry -= 1
            logger.warning(f"Fetch failed (status={res.status_code}) url={url} retries_left={retry}")
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)
        except Exception as err:
            retry -= 1
            logger.exception(f"Fetch exception url={url} retries_left={retry}: {err}")
            if retry == 0:
                return None
            time.sleep(random.choice([1, 2, 3, 4, 5])*retry)


def get_weibo_data():
    weibo_url = "https://weibo.com/ajax/side/hotSearch"
    table_name = "weibo_hot_search"
    weibo_headers = {
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'cache-control': 'no-cache',
        'client-version': '3.0.0',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': 'https://weibo.com/newlogin?tabtype=weibo&gid=102803&openLoginLayer=0&url=https://www.weibo.com/',
        'sec-ch-ua': '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'server-version': 'v2026.01.27.1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
        # 'Cookie': 'XSRF-TOKEN=wui8Mw11KzRrvrrUdJ7hdlP5',
    }
    data = requests.get(weibo_url, timeout=HTTP_TIMEOUT, headers=weibo_headers, impersonate="chrome").json()
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
    session.headers = headers.copy()
    session.headers['referer'] = "https://www.douyin.com"
    session.get("https://www.douyin.com/", timeout=HTTP_TIMEOUT, impersonate="chrome")
    res = session.get(
        "https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1&round_trip_time=50",
        timeout=HTTP_TIMEOUT,
        impersonate="chrome",
    )
    if res.status_code == 200:
        data = res.json()
        insert_data(table_name, data)
    else:
        logger.warning(f"douyin hot search status={res.status_code}")


def get_bilibili_hot_data():
    bilibili_hot_url = "https://api.bilibili.com/x/web-interface/ranking/v2"
    table_name = 'bilibili_hot'
    err = 5
    # 实测：bilibili 对 Referer 头触发风控(-352)，只带 UA + impersonate 指纹更好
    bili_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    }
    proxy_kwargs = {"proxies": {"http": PROXY, "https": PROXY}} if PROXY else {}
    while err > 0:
        # -352 是时间窗口式 IP 风控，直连与代理交替尝试，任一出口命中放行窗口即可
        kwargs = proxy_kwargs if err % 2 == 0 else {}
        try:
            res = requests.get(bilibili_hot_url, headers=bili_headers, timeout=HTTP_TIMEOUT, impersonate="chrome", **kwargs)
            data = res.json()
        except Exception as exc:
            err -= 1
            logger.warning(f"bilibili_hot fetch exception retries_left={err}: {exc}")
            time.sleep(3)
            continue
        data_code = data.get("code", 352)
        if data_code == 0:
            insert_data(table_name, data)
            break
        else:
            err -= 1
            logger.warning(f"bilibili_hot data get error code={data_code}, retries_left={err}")
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
        logger.error(f"{table_name} data fetch failed")
        return
    cursor = None
    try:
        start = time.monotonic()
        cursor = conn.cursor()
        if "data" in data:
            data = data["data"]
        # 空结果同样视为失败，避免把 {"data": []} 当作成功写入
        if data is None or (isinstance(data, (list, dict, str)) and len(data) == 0):
            logger.error(f"{table_name} data is empty, skip insert")
            return
        logger.info(f'Inserting "{table_name}"...')
        cursor.execute(
            f'INSERT INTO "{table_name}" (data, insert_time) VALUES (%s, %s)',
            (json.dumps(data), int(time.time()))
        )
        logger.info(f'"{table_name}" inserted in {time.monotonic() - start:.2f}s')
    except Exception as err:
        logger.exception(f"Error inserting into {table_name}: {err}")
    finally:
        if cursor:
            cursor.close()


if __name__ == "__main__":
    try:
        run_start = time.monotonic()
        logger.info("task.py start")
        try:
            get_toutiao_hot()
        except Exception as e:
            logger.exception(f"Error fetching toutiao_hot data: {e}")

        try:
            get_juejin_hot()
        except Exception as e:
            logger.exception(f"Error fetching juejin_hot data: {e}")

        try:
            get_tieba_topic()
        except Exception as e:
            logger.exception(f"Error fetching tieba_topic data: {e}")

        try:
            get_wx_read_rank()
        except Exception as e:
            logger.exception(f"Error fetching wx_read_rank data: {e}")

        # try:
        #     get_zhihu_hot_data()
        # except Exception as e:
        #     logging.error(f"Error fetching zhihu_hot data: {e}")

        try:
            get_weibo_data()
        except Exception as e:
            logger.exception(f"Error fetching weibo data: {e}")

        try:
            get_ssp_hot()
        except Exception as e:
            logger.exception(f"Error fetching shaoshupai_hot data: {e}")

        try:
            get_douyin_hot_data()
        except Exception as e:
            logger.exception(f"Error fetching douyin_hot data: {e}")

        try:
            get_bilibili_hot_data()
        except Exception as e:
            logger.exception(f"Error fetching bilibili_hot data: {e}")

        # 新的数据插入方式，增加每个插入的try-except
        def safe_insert(collection_name, data_func):
            start = time.monotonic()
            logger.info(f"[{collection_name}] fetch start")
            try:
                data = data_func()
            except Exception as err:
                logger.exception(f"[{collection_name}] fetch error: {err}")
                return
            logger.info(f"[{collection_name}] fetch ok ({time.monotonic() - start:.2f}s)")
            try:
                insert_data(collection_name, data)
            except Exception as err:
                logger.exception(f"[{collection_name}] insert error: {err}")

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
        # safe_insert("freebuf", get_freebuf_data)
        safe_insert("github", get_github_data)
        # safe_insert("google_search", get_googlesearch_data)
        safe_insert("hupu", get_hupu_data)
        safe_insert("huxiu", get_huxiu_data)
        safe_insert("ithome", get_ithome_data)
        safe_insert("openeye", get_openeye_data)
        safe_insert("kanxue", get_kanxue_data)
        safe_insert("kuandaishan", get_kuandaishan_data)
        # safe_insert("pmcaff", get_pmcaff_data)
        safe_insert("qichezhijia", get_qichezhijia_data)
        safe_insert("qidian", get_rank_list)
        safe_insert("shuimu", get_shuimu_data)
        safe_insert("sina", get_sina_data)
        # safe_insert("sina_sport", get_sina_sport_data)
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
        safe_insert("v2ex", get_v2ex_data)
        # safe_insert("hostloc", get_hostloc_data)
        safe_insert("linuxdo", get_linuxdo_data)
        safe_insert("nodeseek", get_nodeseek_data)
        # safe_insert("wsj", get_wsj_data)
        safe_insert("nytimes", get_nytimes_data)
        safe_insert("bloomberg", get_bloomberg_data)
        safe_insert("ft", get_ft_data)
        safe_insert("yna", get_yna_data)
        safe_insert("asahi", get_asahi_data)
        safe_insert("nhk", get_nhk_data)
        safe_insert("foxnews", get_foxnews_data)
        safe_insert("rt", get_rt_data)
        safe_insert("lemonde", get_lemonde_data)
        safe_insert("dailymail", get_dailymail_data)
        safe_insert("mumsnet", get_mumsnet_data)
        safe_insert("newsau", get_newsau_data)
        safe_insert("fivech", get_5ch_data)
        safe_insert("dzenru", get_dzenru_data)
        safe_insert("mcpmarket", get_mcpmarket_data)
    except Exception as error:
        logger.exception(f"some error happen: {error}")
    finally:
        try:
            logger.info("Committing transaction...")
            commit_start = time.monotonic()
            conn.commit()
            logger.info(f"Commit done in {time.monotonic() - commit_start:.2f}s")
        finally:
            conn.close()
        logger.info(f"task.py done in {time.monotonic() - run_start:.2f}s")
