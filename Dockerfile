FROM python:3.9-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=Asia/Shanghai

WORKDIR /app
COPY requirements.txt /app/

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    tzdata \
    libglib2.0-0 libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -r requirements.txt

# 预下载 chromium 供 patchright/xueqiu spider 使用（容器重建时避免运行时下载）
RUN python -m playwright install chromium

COPY . /app/

CMD ["python", "task.py"]
