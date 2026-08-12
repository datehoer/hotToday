# -*- coding: utf-8 -*-
"""
热榜数据清洗提取器
把各源表 (82 张) 的原始 JSON 快照提取成统一的 (title, url, hot_value) 条目列表。
配置驱动: 每张表一行配置 (list_path, title_path, url_path, hot_path)。
- list_path 定位条目列表, 支持 'a.b' 嵌套 与 '[0]' 表示"遍历顶层 list 每个元素"
  例: '[0].newslist' -> 顶层 list 每个元素的 newslist 字段合并成一个列表
- title_path / url_path / hot_path 为条目内的相对路径, 支持嵌套 'a.b'
"""
import html
import re
from urllib.parse import quote

TITLE_KEYS = ('title', 'name', 'word', 'hot_label', 'articleTitle', 'bookName',
              'topic_name', 'questionTitle', 'rankingTitle', 'Title')
URL_KEYS = ('url', 'link', 'uri', 'short_link_v2', 'topic_url', 'articleLink',
            'article_link', 'articleDetailUrl', 'pageUrl', 'pcLinkUrl', 'Url',
            'href', 'shareUrl', 'deepLink', 'target.url')
HOT_KEYS = ('hot_value', 'hotScore', 'HotValue', 'viewCount', 'viewsNum',
            'pageviews', 'idx_num', 'rank', 'view', 'stars', 'hot')

# 这些源结构已知, hotNews 为空时应返回空列表, 不启用通用兜底
# (否则会从 editorHandpicked 等其他栏目误提取频道名/非热榜条目)
NO_GENERIC_FALLBACK = {'pengpai'}

# 特殊表: 价格/序号等需要清洗 title
PRICE_RE = re.compile(r'\s+\$[\d,]+(?:\.\d+)?%?\s*$')
ORD_RE = re.compile(r'^\d+\.\s*')
WS_RE = re.compile(r'\s+')


def _clean_title(title, source):
    t = html.unescape(str(title)).strip()
    t = WS_RE.sub(' ', t)
    if source == 'crypto_coin':
        t = PRICE_RE.sub('', t).strip()
    if source == 'historytoday':
        t = ORD_RE.sub('', t).strip()
    return t


def _resolve(obj, path):
    """按 'a.b.c' 或 'a[0].b' 取路径值, 不存在返回 None"""
    if path is None or obj is None:
        return None
    cur = obj
    for seg in path.split('.'):
        m = re.match(r'^(\w+)?(\[\d+\])?$', seg)
        if not m:
            return None
        key, idx = m.group(1), m.group(2)
        if key:
            if not isinstance(cur, dict) or key not in cur:
                return None
            cur = cur[key]
        if idx:
            n = int(idx[1:-1])
            if not isinstance(cur, (list, tuple)) or n >= len(cur):
                return None
            cur = cur[n]
    return cur


def _list_from(data, list_path):
    """解析条目列表。'[0]' 表示遍历顶层 list; '[0].x' 表示每个顶层元素的 x 合并"""
    if list_path == '[0]':
        return data if isinstance(data, list) else []
    if list_path.startswith('[0].'):
        if not isinstance(data, list):
            return []
        rest = list_path[4:]
        out = []
        for elem in data:
            v = _resolve(elem, rest)
            if isinstance(v, list):
                out.extend(v)
        return out
    v = _resolve(data, list_path)
    return v if isinstance(v, list) else []


def _pick(item, *paths):
    for p in paths:
        if not p:
            continue
        v = _resolve(item, p)
        if v is not None:
            return v
    return None


# source -> (list_path, title_path, url_path, hot_path)
EXTRACTORS = {
    '36kr':            ('[0]', 'title', 'url', None),
    '3dm':             ('[0]', 'title', 'url', None),
    '52pj':            ('[0]', 'title', 'url', None),
    'acfun':           ('[0]', 'title', 'shareUrl', None),
    'anquanke':        ('list', 'title', 'url', None),
    'asahi':           ('[0]', 'title', 'url', None),
    'baidu_hot_search':('[0]', 'title', 'url', None),
    'baijingchuhai':   ('[0]', 'title', 'url', None),
    'bilibili_hot':    ('list', 'title', 'short_link_v2', None),
    'bloomberg':       ('[0]', 'title', 'url', None),
    'coolan':          ('[0]', 'title', 'url', None),
    'crypto_coin':     ('[0]', 'title', 'url', 'hotScore'),
    'csdn':            ('[0]', 'articleTitle', 'articleDetailUrl', 'hotRankScore'),
    'dailymail':       ('[0]', 'title', 'url', None),
    'dianshangbao':    ('[0]', 'title', 'url', None),
    'diyicaijing':     ('[0]', 'title', 'url', None),
    'dongchedi':       ('[0]', 'title', 'url', None),
    'douyin_hot':      ('word_list', 'word', None, 'hot_value'),
    'dzenru':          ('[0]', 'title', 'url', None),
    'fivech':          ('[0]', 'title', 'url', None),
    'foxnews':         ('[0]', 'title', 'url', None),
    'ft':              ('[0]', 'title', 'url', None),
    'github':          ('[0]', 'title', 'url', 'hotScore'),
    'googlenews':      ('[0]', 'title', 'url', None),
    'hacknews':        ('[0]', 'title', 'url', None),
    'historytoday':    ('[0]', 'title', None, None),
    'hupu':            ('[0]', 'title', 'url', None),
    'huxiu':           ('[0]', 'title', 'url', None),
    'ifanr':           ('[0]', 'title', 'url', None),
    'ithome':          ('[0]', 'title', 'url', None),
    'jin10':           ('[0]', 'title', 'url', None),
    'juejin_hot':      ('[0]', 'content.title', None, None),
    'kanxue':          ('[0]', 'title', 'url', None),
    'kuandaishan':     ('[0]', 'title', 'url', None),
    'lemonde':         ('[0]', 'title', 'url', None),
    'linuxdo':         ('[0]', 'title', 'url', None),
    'mcpmarket':       ('[0]', 'name', 'url', 'stars'),
    'mumsnet':         ('[0]', 'title', 'url', None),
    'needknow':        ('[0]', 'title', 'url', None),
    'newsau':          ('[0]', 'title', 'url', None),
    'nhk':             ('[0]', 'title', 'url', None),
    'nodeseed':        ('[0]', 'title', 'url', None),
    'nodeseek':        ('[0]', 'title', 'url', None),
    'nytimes':         ('[0]', 'title', 'url', None),
    'pengpai':         ('hotNews', 'name', 'link', None),
    'pmcaff':          ('[0]', 'title', 'pageUrl', None),
    'qichezhijia':     ('[0]', 'title', 'url', None),
    'qidian':          ('[0]', 'title', 'url', None),
    'readhub':         ('[0]', 'title', 'url', None),
    'rt':              ('[0]', 'title', 'url', None),
    'secrss':          ('[0]', 'title', 'url', None),
    'shaoshupai_hot':  ('[0]', 'title', None, None),
    'shuimu':          ('[0]', 'title', 'url', None),
    'sina':            ('[0]', 'title', 'url', None),
    'sina_news':       ('[0]', 'title', 'url', None),
    'steam':           ('[0]', 'title', 'url', None),
    'taipingyang':     ('[0]', 'title', 'url', None),
    'taptap':          ('[0]', 'title', 'url', None),
    'tencent_news':    ('[0].newslist', 'title', 'url', None),
    'thehackernews':   ('[0]', 'title', 'url', None),
    'tieba_topic':     ('bang_topic.topic_list', 'topic_name', 'topic_url', 'idx_num'),
    'toutiao_hot':     ('[0]', 'Title', 'Url', 'HotValue'),
    'v2ex':            ('[0]', 'title', 'url', None),
    'wallstreetcn':    ('day_items', 'title', 'uri', None),
    'weibo_hot_search':('realtime', 'word', 'url', None),
    'woshipm':         ('[0]', 'data.articleTitle', None, None),
    'wx_read_rank':    ('books', 'bookInfo.title', 'bookInfo.deepLink', None),
    'xueqiu':          ('[0]', 'title', 'url', None),
    'yiche':           ('[0]', 'title', 'pcLinkUrl', None),
    'yna':             ('[0]', 'title', 'url', None),
    'youshedubao':     ('[0].dubao', 'title', 'url', None),
    'youxiputao':      ('[0]', 'title', 'url', 'hotScore'),
    'zhanku':          ('[0]', 'rankingTitle', 'pageUrl', None),
    'zhihu_hot_list':  ('[0]', 'target.title', 'target.url', None),
    'zongheng':        ('resultList', 'bookName', None, None),
    # 以下表当前抓取为空或结构特殊, 用通用兜底
    'douban_movie':    ('[0].data', 'title', 'url', 'hotScore'),
    'freebuf':         ('[0]', 'title', 'url', None),
    'google_search':   ('[0]', 'title', 'url', None),
    'hostloc':         ('[0]', 'title', 'url', None),
    'openeye':         ('[0]', 'title', 'url', None),
    'sina_sport':      ('[0]', 'title', 'url', None),
    'wsj':             ('[0]', 'title', 'url', None),
}


def _generic_extract(data):
    """通用兜底: 递归找 title/name/word 类字段 + 同对象里的 url"""
    items = []

    def walk(obj, cur_url=None):
        if isinstance(obj, dict):
            u = cur_url
            for k in ('url', 'link', 'uri', 'href'):
                if k in obj and isinstance(obj[k], str):
                    u = obj[k]
            for k, v in obj.items():
                if k in TITLE_KEYS and isinstance(v, str) and v.strip():
                    items.append((v.strip(), u, None))
                elif isinstance(v, (dict, list)):
                    walk(v, u)
        elif isinstance(obj, list):
            for x in obj:
                walk(x, cur_url)
    walk(data)
    return items


# 源站条目没有可直接取到的 url 字段时, 按各自规则拼接 (it: 条目 dict, t: 清洗后的 title)
URL_BUILDERS = {
    'weibo_hot_search': lambda it, t: 'https://s.weibo.com/weibo?q=' + quote(t),
    'douyin_hot': lambda it, t: ('https://www.douyin.com/hot/' + str(it['group_id'])
                                 if isinstance(it, dict) and it.get('group_id') else None),
    'pengpai': lambda it, t: ('https://www.thepaper.cn/newsDetail_forward_' + str(it['contId'])
                              if isinstance(it, dict) and it.get('contId') else None),
    'woshipm': lambda it, t: ('https://www.woshipm.com/{}/{}.html'.format(
                                  it.get('data', {}).get('type'), it.get('data', {}).get('id'))
                              if isinstance(it.get('data'), dict) and it.get('data', {}).get('id')
                              else None),
    'juejin_hot': lambda it, t: ('https://juejin.cn/post/' + str(it.get('content', {}).get('content_id'))
                                 if isinstance(it.get('content'), dict)
                                 and it.get('content', {}).get('content_id') else None),
    'shaoshupai_hot': lambda it, t: ('https://sspai.com/post/' + str(it.get('id'))
                                     if isinstance(it, dict) and it.get('id') else None),
    'zongheng': lambda it, t: ('https://www.zongheng.com/detail/' + str(it.get('bookId'))
                               if isinstance(it, dict) and it.get('bookId') else None),
    'youshedubao': lambda it, t: 'https://www.uisdc.com/news',
}


def _build_url(source, item, title):
    """源站条目取不到 url 字段时, 按来源规则拼接链接; 无规则返回 None"""
    builder = URL_BUILDERS.get(source)
    if not builder:
        return None
    try:
        return builder(item, title)
    except Exception:
        return None


def extract_items(source, data):
    """返回 [(title, url, hot_value), ...]"""
    cfg = EXTRACTORS.get(source)
    items = []
    if cfg:
        list_path, title_path, url_path, hot_path = cfg
        lst = _list_from(data, list_path)
        for item in lst:
            t = _pick(item, title_path)
            if not t:
                continue
            t = _clean_title(t, source)
            if len(t) < 2 or len(t) > 500:
                continue
            u = _pick(item, url_path)
            h = _pick(item, hot_path)
            if not u:
                u = _build_url(source, item, t)
            items.append((t, u, h))
        # 兜底: 配置没提取到但结构里有 title (pengpai 等已知结构源除外)
        if not items and source not in NO_GENERIC_FALLBACK:
            items = _generic_extract(data)
    else:
        items = _generic_extract(data)

    # 去重保序 + 过滤空
    seen = set()
    out = []
    for t, u, h in items:
        if not t or t in seen:
            continue
        seen.add(t)
        out.append((t, u if isinstance(u, str) else None,
                    str(h) if h is not None else None))
    return out
