# 雪球的 aliyunwaf 挑战用 Node + jsdom 跑（见 sources/xueqiu/waf/），比启动 Chrome 轻得多。
# 用 node 官方镜像做一次依赖安装，只把 node 运行时和 node_modules 搬进最终镜像。
FROM node:22-bookworm-slim AS wafnode
WORKDIR /wafnode
COPY sources/xueqiu/waf/package.json sources/xueqiu/waf/package-lock.json /wafnode/
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY sources/xueqiu/waf/patch-jsdom.js ./
# 给 jsdom 的 navigate 插钩子（Location 上的 href/assign 不可重定义，只能从这里拿目标 URL）
RUN node patch-jsdom.js

# Current Patchright releases require Python >= 3.10.
FROM python:3.12-slim

COPY --from=wafnode /usr/local/bin/node /usr/local/bin/node
COPY --from=wafnode /wafnode /opt/wafnode

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai \
    WAF_NODE_PATH=/opt/wafnode/node_modules

WORKDIR /app
COPY requirements.txt /app/

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tzdata \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2t64 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

# Pin the patched stable browser explicitly: the SDK's bundled Chromium can lag
# behind Chrome security releases even when the SDK itself is current.
ARG CHROME_VERSION=156.0.8078.47
ARG CHROME_SHA256=e6c94490f0b6b337225aeb2d2a5034858516b7017356980ba94f5176d8774a50
RUN CHROME_VERSION="$CHROME_VERSION" CHROME_SHA256="$CHROME_SHA256" python - <<'PY'
import hashlib, os, pathlib, urllib.request, zipfile
version = os.environ['CHROME_VERSION']
archive = pathlib.Path('/tmp/chrome.zip')
urllib.request.urlretrieve(f'https://storage.googleapis.com/chrome-for-testing-public/{version}/linux64/chrome-linux64.zip', archive)
digest = hashlib.sha256()
with archive.open('rb') as source:
    for chunk in iter(lambda: source.read(1048576), b''):
        digest.update(chunk)
assert digest.hexdigest() == os.environ['CHROME_SHA256']
target = pathlib.Path('/opt/google')
with zipfile.ZipFile(archive) as bundle:
    bundle.extractall(target)
    for info in bundle.infolist():
        mode = info.external_attr >> 16
        if mode:
            (target / info.filename).chmod(mode & 0o777)
(target / 'chrome-linux64').rename(target / 'chrome')
archive.unlink()
PY
ENV CHROME_PATH=/opt/google/chrome/chrome
RUN "$CHROME_PATH" --version

# 自检：node 和 jsdom 补丁都在
RUN node -e "require('/opt/wafnode/node_modules/jsdom'); console.log('jsdom ok')" \
    && grep -q __wafNav /opt/wafnode/node_modules/jsdom/lib/jsdom/living/window/navigation.js \
    && echo 'jsdom navigation hook ok'
COPY . /app/
# 源的 requires 和镜像对不上 (缺程序、Python 包或环境变量) 时构建直接失败，不用等到整点那一轮
RUN python task.py --check

CMD ["python", "task.py"]
