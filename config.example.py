"""Copy to config.py; load your local .env into the shell before running Python.

Docker can supply the same variables with --env-file. This file contains examples
only; keep actual connection details in the ignored config.py or .env files.
"""
import os

PG_HOST = os.getenv("PG_HOST", "127.0.0.1")
PG_PORT = int(os.getenv("PG_PORT", "5432"))
PG_USER = os.getenv("PG_USER", "hottoday")
PG_PASSWORD = os.getenv("PG_PASSWORD", "")
PG_DB = os.getenv("PG_DB", "hotday")

REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")

# Keep this name in sync with source.yaml files that select proxy: subpool.
PROXIES = {"subpool": os.getenv("HOT_PROXY_URL", "http://127.0.0.1:6666")}
