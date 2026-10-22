# -*- coding: utf-8 -*-
"""源插件: 每个源是 sources/<key>/ 一个目录, 里面的 source.yaml 写明怎么抓、怎么提取。

key 就是目录名, 也是 hot-rank-web 读的源表名。fetch.type:
  json    GET 一个 JSON 接口, 原样存响应; url 和 headers 里可以用 vars 里的变量和 {ua.desktop} {ua.mobile}
  rss     RSS 频道, 只留链接在本站的前 20 条, 存成 {"data": [{title, url, hotScore}]}
  python  调用本目录里的函数, entry: <模块>:<函数>; proxy 不是 none 时函数要接受 proxy 参数
timeout 是一次尝试的上限 (json/rss 是一次请求, python 是一次函数调用), retries 是出错后再试几次,
proxy 是 config.PROXIES 里的名字。schedule 目前只能是 hourly。

extract 把存下的数据提成 (title, url, heat), 清洗 (etl/incremental.py) 用它:
  list    条目数组: $ 是根, $[*].x 把根数组里每个元素的 x 合并起来, 其他写法是从根开始的路径
  fields  title 必填。每个字段写成 `a.b ?? c[0].d ?? 'https://…' ?? template('https://…/{id}')`,
          从左到右取第一个非空值 (None 和空串算空); template 里 {路径|quote} 会做 URL 编码;
          后面可以接 | regex('…'), 取第一个分组 (没有分组取整个匹配)。引号里的内容原样使用
  generic_fallback  按配置提不出条目时, 是否在整份数据里找标题兜底, 默认 true

requires 写这个源在镜像里要有的东西, 构建镜像时装好; 改了 requires 要重建镜像, 只改目录里的代码不用:
  bin  要调用的程序, 比如 [node]
  pip  requirements.txt 以外、只有这个源要的 Python 包, 比如 [foo==1.2]
  env  镜像要设的环境变量, 只能是装好的东西在哪 (名字以 _PATH/_BIN/_HOME/_DIR 结尾): AI 修复的沙箱也拿到它们
缺了哪样, 这个源这一轮记成「缺少依赖 …, 要重建镜像」, 别的源照常跑。
出错就抛异常: except 之后返回空数据, 这一轮只能记成 empty, 看不到原因。
"""
import ast
import html
import importlib.util
import inspect
import os
import random
import re
import shutil
import sys
import threading
import time
from functools import lru_cache
from importlib import metadata
from pathlib import Path
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import yaml
from curl_cffi import requests
from loguru import logger

import config

SOURCES_DIR = Path(__file__).resolve().parent / "sources"
PROXIES = getattr(config, "PROXIES", {})
UA = {
    "desktop": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36"),
    "mobile": ("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
               "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"),
}
FIELDS = {"key", "name", "enabled", "disabled_reason", "schedule", "timeout", "retries", "proxy",
          "requires", "fetch", "extract"}
# requires 的每一项: (格式, 例子)
REQUIRES = {"bin": (r"[\w.+-]+", "[node]"), "pip": (r"[A-Za-z0-9][\w.-]*(==[\w.+!-]+)?", "[foo==1.2]"),
            "env": (r"[A-Z][A-Z0-9_]*_(PATH|BIN|HOME|DIR)", "[WAF_NODE_PATH], 名字以 _PATH/_BIN/_HOME/_DIR 结尾")}
FETCH_FIELDS = {
    "json": {"type", "url", "vars", "headers", "impersonate"},
    "rss": {"type", "url"},
    "python": {"type", "entry"},
}
PATH_RE = re.compile(r"\w+(\[\d+\])?(\.\w+(\[\d+\])?)*")
RSS_MAX_BYTES = 3_000_000
RSS_MAX_ITEMS = 20
TITLE_KEYS = ('title', 'name', 'word', 'hot_label', 'articleTitle', 'bookName',
              'topic_name', 'questionTitle', 'rankingTitle', 'Title')


class SpecError(ValueError):
    """source.yaml 写得不对"""


def redact(text, limit=500):
    """存库或交给模型前去掉代理账号密码和 URL 里的密钥"""
    text = re.sub(r'//[^/@\s]+@', '//***@', str(text))
    text = re.sub(r'(?i)\b(key|token|secret|sign|password)=[^&\s]+', r'\1=***', text)
    return text[:limit]


def load_sources(import_entries=True):
    """读全部 sources/*/source.yaml, 返回 (specs, errors), errors 是 {目录名: 错误说明}。
    import_entries=False 时不导入 python 源的模块 (清洗只要 extract)"""
    specs, errors = [], {}
    for folder in sorted(SOURCES_DIR.iterdir()):
        if not folder.is_dir() or folder.name.startswith((".", "_")):
            continue
        try:
            specs.append(_load(folder, import_entries))
        except Exception as err:
            errors[folder.name] = str(err) or type(err).__name__
    return specs, errors


def _load(folder, import_entries):
    path = folder / "source.yaml"
    if not path.is_file():
        raise SpecError("缺少 source.yaml")
    spec = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(spec, dict):
        raise SpecError("source.yaml 顶层要是键值对")
    _known(spec, FIELDS, "")
    if spec.get("key") != folder.name:
        raise SpecError(f"key 要和目录名一致, 现在是 {spec.get('key')!r}")
    if not re.fullmatch(r"[a-z0-9_]+", folder.name):
        raise SpecError("key 只能用小写字母、数字和下划线")
    if not isinstance(spec.get("name"), str) or not spec["name"].strip():
        raise SpecError("缺少 name")
    if not isinstance(spec.setdefault("enabled", True), bool):
        raise SpecError("enabled 要写 true 或 false")
    if not spec["enabled"] and not spec.get("disabled_reason"):
        raise SpecError("enabled: false 时要写 disabled_reason")
    if spec.setdefault("schedule", "hourly") != "hourly":
        raise SpecError(f"schedule 目前只支持 hourly (容器每个整点跑一轮), 不支持 {spec['schedule']!r}")
    spec["timeout_s"] = _seconds(spec.setdefault("timeout", "30s"))
    retries = spec.setdefault("retries", 0)
    if type(retries) is not int or not 0 <= retries <= 5:
        raise SpecError("retries 要是 0 到 5 的整数")
    proxy = spec.setdefault("proxy", "none")
    if proxy != "none" and proxy not in PROXIES:
        raise SpecError(f"proxy {proxy!r} 不在 config.PROXIES 里")
    spec["requires"] = _requires(spec.get("requires"))

    fetch = spec.get("fetch")
    kind = fetch.get("type") if isinstance(fetch, dict) else None
    if kind not in FETCH_FIELDS:
        raise SpecError("fetch.type 要是 json、rss 或 python")
    _known(fetch, FETCH_FIELDS[kind], "fetch.")
    if kind == "python":
        # 缺依赖时不导入 (模块顶上 import 缺的包会报错), 留给 fetch 报「缺少依赖」
        spec["func"] = _entry(folder, fetch.get("entry"), proxy) if import_entries and not missing(spec) else None
    else:
        if not isinstance(fetch.get("url"), str) or not fetch["url"].startswith("https://"):
            raise SpecError("fetch.url 要是 https 地址")
        if kind == "rss" and proxy != "none":
            raise SpecError("rss 源还不支持 proxy")
    if kind == "json":
        for name in ("vars", "headers"):
            if not isinstance(fetch.setdefault(name, {}), dict):
                raise SpecError(f"fetch.{name} 要是键值对")
        if not isinstance(fetch.setdefault("impersonate", None), (str, type(None))):
            raise SpecError("fetch.impersonate 要是浏览器名, 比如 chrome")
        for text in [fetch["url"], *map(str, fetch["headers"].values())]:
            _render(text, fetch["vars"])  # 占位符都要取得到值
    spec["extract"] = _compile_extract(spec.get("extract"))
    return spec


def _known(obj, allowed, prefix):
    unknown = sorted(str(k) for k in obj if k not in allowed)
    if unknown:
        raise SpecError("不认识的字段: " + ", ".join(prefix + k for k in unknown))


def _requires(req):
    """requires 规整成 {bin: [...], pip: [...], env: [...]}"""
    if req is None:
        req = {}
    if not isinstance(req, dict):
        raise SpecError("requires 要是键值对, 比如 requires: {bin: [node]}")
    _known(req, REQUIRES, "requires.")
    out = {}
    for name, (pattern, example) in REQUIRES.items():
        items = req.get(name, [])
        if not isinstance(items, list) or not all(isinstance(x, str) and re.fullmatch(pattern, x) for x in items):
            raise SpecError(f"requires.{name} 要是一个列表, 比如 {example}")
        out[name] = items
    return out


def missing(spec):
    """requires 里写了、镜像里没有的东西; 空列表就是齐了"""
    req = spec["requires"]
    lack = [f"程序 {name}" for name in req["bin"] if not shutil.which(name)]
    for package in req["pip"]:
        name, _, want = package.partition("==")
        try:
            have = metadata.version(name)
        except metadata.PackageNotFoundError:
            lack.append(f"Python 包 {package}")
            continue
        if want and have != want:
            lack.append(f"Python 包 {package} (镜像里是 {have})")
    return lack + [f"环境变量 {name}" for name in req["env"] if not os.environ.get(name)]


def hides_errors(code):
    """except 之后不再抛出、只返回空数据的行号。这样写, 出错时 task.py 只能记成 empty, 看不到原因"""
    def empty(node):
        if node is None or isinstance(node, ast.Constant) and node.value in (None, "", 0, False):
            return True
        if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
            return not node.elts
        if isinstance(node, ast.Dict):  # {} 和 {"data": []}
            return all(isinstance(v, (ast.List, ast.Dict)) and empty(v) for v in node.values)
        return isinstance(node, ast.Call) and getattr(node.func, "id", None) in ("list", "dict") and not node.args
    try:
        tree = ast.parse(code)
    except SyntaxError:
        return []
    lines = []
    for handler in ast.walk(tree):
        if isinstance(handler, ast.ExceptHandler) and not any(isinstance(n, ast.Raise) for n in ast.walk(handler)):
            returns = [n for n in ast.walk(handler) if isinstance(n, ast.Return)]
            if returns and all(empty(r.value) for r in returns):
                lines.append(handler.lineno)
    return lines


def _seconds(text):
    m = re.fullmatch(r"(\d+)(s|m)", str(text))
    if not m or m[1] == "0":
        raise SpecError(f"timeout 要写成 30s 或 5m, 现在是 {text!r}")
    return int(m[1]) * (60 if m[2] == "m" else 1)


def _entry(folder, entry, proxy):
    m = re.fullmatch(r"(\w+):(\w+)", str(entry or ""))
    if not m:
        raise SpecError("fetch.entry 要写成 <模块>:<函数>")
    path = folder / f"{m[1]}.py"
    if not path.is_file():
        raise SpecError(f"sources/{folder.name}/ 里没有 {m[1]}.py")
    name = f"source_{folder.name}_{m[1]}"
    module = sys.modules.get(name)
    if module is None:
        module_spec = importlib.util.spec_from_file_location(name, path)
        module = importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(module)
        sys.modules[name] = module
    func = getattr(module, m[2], None)
    if not callable(func):
        raise SpecError(f"{m[1]}.py 里没有函数 {m[2]}")
    if proxy != "none" and "proxy" not in inspect.signature(func).parameters:
        raise SpecError(f"设了 proxy, 但 {m[2]} 不接受 proxy 参数")
    return func


# ---------- 抓取 ----------

def fetch(spec):
    """按 spec 抓一次, 出错按 retries 重试; 全部失败时抛出最后一次的错误"""
    lack = missing(spec)
    if lack:
        raise RuntimeError(f"缺少依赖: {', '.join(lack)}; 要重建镜像")
    for left in range(spec["retries"], -1, -1):
        try:
            return _fetch_once(spec)
        except Exception as err:
            if not left:
                raise
            logger.warning(f"[{spec['key']}] {err}, 还会再试 {left} 次")
            time.sleep(random.choice([1, 2, 3, 4, 5]) * left)


def _fetch_once(spec):
    kind = spec["fetch"]["type"]
    proxy = PROXIES.get(spec["proxy"])
    if kind == "python":
        return _call(spec["func"], spec["timeout_s"], **({"proxy": proxy} if proxy else {}))
    if kind == "rss":
        return _fetch_rss(spec["fetch"]["url"], spec["timeout_s"])
    return _fetch_json(spec["fetch"], spec["timeout_s"], proxy)


def _call(func, seconds, **kwargs):
    """在后台线程里调用, 超时就不再等 (线程自己跑完, 进程退出时一起结束)"""
    box = {}

    def run():
        try:
            box["data"] = func(**kwargs)
        except BaseException as err:
            box["error"] = err

    worker = threading.Thread(target=run, daemon=True)
    worker.start()
    worker.join(seconds)
    if worker.is_alive():
        raise TimeoutError(f"超过 {seconds} 秒没有返回")
    if "error" in box:
        raise box["error"]
    return box.get("data")


def _render(text, variables):
    """{名字} 换成 vars 里的值, 或内置的 {ua.desktop} {ua.mobile}"""
    def sub(m):
        if m[1] in variables:
            return str(variables[m[1]])
        if m[1].startswith("ua.") and m[1][3:] in UA:
            return UA[m[1][3:]]
        raise SpecError(f"占位符 {{{m[1]}}} 取不到值")
    return re.sub(r"\{([^{}]+)\}", sub, text)


def _fetch_json(f, timeout, proxy):
    kwargs = {"headers": {k: _render(str(v), f["vars"]) for k, v in f["headers"].items()},
              "timeout": timeout}
    if f["impersonate"]:
        kwargs["impersonate"] = f["impersonate"]
    if proxy:
        kwargs["proxies"] = {"http": proxy, "https": proxy}
    res = requests.get(_render(f["url"], f["vars"]), **kwargs)
    if res.status_code != 200:
        raise RuntimeError(f"HTTP {res.status_code}")
    return res.json()


def _fetch_rss(url, timeout):
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 HotToday/1.0"})
    with urlopen(request, timeout=timeout) as response:
        body = response.read(RSS_MAX_BYTES + 1)
    if len(body) > RSS_MAX_BYTES:
        raise ValueError("RSS feed exceeds size limit")
    root = ElementTree.fromstring(body.lstrip())
    channel = root.find("channel")
    if root.tag != "rss" or channel is None:
        raise ValueError("Expected an RSS channel")
    domain = urlsplit(url).hostname.removeprefix("www.")
    items, seen_urls = [], set()
    for entry in channel.findall("item"):
        title_node = entry.find("title")
        title = "" if title_node is None else "".join(title_node.itertext())
        title = re.sub(r"\s+", " ", html.unescape(title)).strip()
        link = html.unescape((entry.findtext("link") or "").strip())
        parsed = urlsplit(link)
        if (not title or parsed.scheme not in ("http", "https")
                or parsed.hostname not in (domain, "www." + domain) or link in seen_urls):
            continue
        seen_urls.add(link)
        items.append({"title": title, "url": link, "hotScore": 0})
        if len(items) >= RSS_MAX_ITEMS:
            break
    if not items:
        raise ValueError("RSS feed contains no valid entries")
    return {"data": items}


# ---------- 提取 ----------

def _compile_extract(extract):
    if extract is None:
        return None
    if not isinstance(extract, dict):
        raise SpecError("extract 要是键值对")
    _known(extract, {"list", "fields", "generic_fallback"}, "extract.")
    path = extract.get("list")
    if not (path == "$" or (isinstance(path, str) and PATH_RE.fullmatch(path.removeprefix("$[*].")))):
        raise SpecError("extract.list 要写成 $、$[*].<路径> 或 <路径>")
    fields = extract.get("fields")
    if not isinstance(fields, dict) or "title" not in fields:
        raise SpecError("extract.fields 里要有 title")
    _known(fields, {"title", "url", "heat"}, "extract.fields.")
    fallback = extract.get("generic_fallback", True)
    if not isinstance(fallback, bool):
        raise SpecError("extract.generic_fallback 要写 true 或 false")
    return {"list": path, "generic_fallback": fallback,
            "fields": {k: _parse(str(v), f"extract.fields.{k}") for k, v in fields.items()}}


def _split(text, sep):
    """按 sep 切开, 引号里的不算"""
    parts, start, quoted, i = [], 0, False, 0
    while i < len(text):
        if text[i] == "'":
            quoted = not quoted
        elif not quoted and text.startswith(sep, i):
            parts.append(text[start:i].strip())
            i += len(sep)
            start = i
            continue
        i += 1
    if quoted:
        raise SpecError("引号没有成对")
    return parts + [text[start:].strip()]


def _parse(text, where):
    """字段表达式 -> [(取值方式, 参数, [正则…]), …], 按 ?? 的顺序"""
    terms = []
    for term in _split(text, "??"):
        atom, *pipes = _split(term, "|")
        regexes = []
        for pipe in pipes:
            m = re.fullmatch(r"regex\('(.*)'\)", pipe, re.S)
            if not m:
                raise SpecError(f"{where}: 只支持 | regex('…'), 不认识 {pipe!r}")
            try:
                regexes.append(re.compile(m[1]))
            except re.error as err:
                raise SpecError(f"{where}: 正则写错了: {err}")
        m = re.fullmatch(r"template\('(.*)'\)", atom, re.S)
        if m:
            for slot in re.findall(r"\{([^{}]*)\}", m[1]):
                path, _, flt = slot.partition("|")
                if not PATH_RE.fullmatch(path) or flt not in ("", "quote"):
                    raise SpecError(f"{where}: template 里的 {{{slot}}} 要写成 {{路径}} 或 {{路径|quote}}")
            terms.append(("template", m[1], regexes))
        elif len(atom) >= 2 and atom[0] == atom[-1] == "'":
            terms.append(("literal", atom[1:-1], regexes))
        elif PATH_RE.fullmatch(atom):
            terms.append(("path", atom, regexes))
        else:
            raise SpecError(f"{where}: 看不懂 {atom!r}")
    return terms


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


def _template(text, item):
    """{路径} 换成条目里的值; 有一个取不到就返回 None"""
    out, pos = [], 0
    for m in re.finditer(r"\{([^{}]*)\}", text):
        path, _, flt = m[1].partition("|")
        value = _resolve(item, path)
        if value is None or value == "":
            return None
        out += [text[pos:m.start()], quote(str(value)) if flt else str(value)]
        pos = m.end()
    return "".join(out) + text[pos:]


def _value(terms, item):
    """按 ?? 取第一个非空值; 都为空时返回最后一项的值"""
    value = None
    for kind, arg, regexes in terms:
        if kind == "path":
            value = _resolve(item, arg)
        elif kind == "literal":
            value = arg
        else:
            value = _template(arg, item)
        for rx in regexes:
            if value is None:
                break
            m = rx.search(str(value))
            value = (m.group(1) if rx.groups else m.group(0)) if m else None
        if value is not None and value != "":
            return value
    return value


def _items(data, path):
    if path == "$":
        return data if isinstance(data, list) else []
    if path.startswith("$[*]."):
        out = []
        for elem in data if isinstance(data, list) else []:
            value = _resolve(elem, path[5:])
            if isinstance(value, list):
                out.extend(value)
        return out
    value = _resolve(data, path)
    return value if isinstance(value, list) else []


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


@lru_cache(maxsize=None)
def _extracts():
    specs, _ = load_sources(import_entries=False)
    return {s["key"]: s["extract"] for s in specs if s["extract"]}


def extract_items(source, data):
    """把源表一行的 data 提成 [(title, url, heat), …]; 没有 extract 配置的表用通用兜底"""
    return extract_with(_extracts().get(source), data)


def extract_with(spec, data):
    """同上, 直接给编译好的 extract (修复时试改过的 source.yaml 用)"""
    items = []
    if spec:
        fields = spec["fields"]
        for item in _items(data, spec["list"]):
            title = _value(fields["title"], item)
            if not title:
                continue
            title = re.sub(r'\s+', ' ', html.unescape(str(title)).strip())
            if len(title) < 2 or len(title) > 500:
                continue
            items.append((title, _value(fields.get("url", []), item), _value(fields.get("heat", []), item)))
        if not items and spec["generic_fallback"]:
            items = _generic_extract(data)
    else:
        items = _generic_extract(data)

    # 去重保序 + 过滤空
    seen, out = set(), []
    for title, url, heat in items:
        if not title or title in seen:
            continue
        seen.add(title)
        out.append((title, url if isinstance(url, str) else None,
                    str(heat) if heat is not None else None))
    return out
