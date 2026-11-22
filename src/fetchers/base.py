"""Token bucket asynchrone + client GET/POST avec backoff exponentiel sur 429/5xx."""
from __future__ import annotations

import asyncio
import logging
import time

import httpx

log = logging.getLogger(__name__)
USER_AGENT = "memecoin-paper-bot/0.2"


class TokenBucket:
    """`rate` jetons par `per` secondes, capacité `burst` (par défaut = rate)."""

    def __init__(self, rate: float, per: float = 60.0, burst: float | None = None,
                 clock=time.monotonic, sleep=asyncio.sleep):
        self.capacity = float(burst if burst is not None else rate)
        self.tokens = self.capacity
        self.fill_rate = rate / per
        self._clock, self._sleep = clock, sleep
        self._last = clock()
        self._lock = asyncio.Lock()

    def _refill(self) -> None:
        now = self._clock()
        self.tokens = min(self.capacity, self.tokens + (now - self._last) * self.fill_rate)
        self._last = now

    async def acquire(self, n: float = 1.0) -> None:
        async with self._lock:
            while True:
                self._refill()
                if self.tokens >= n:
                    self.tokens -= n
                    return
                await self._sleep((n - self.tokens) / self.fill_rate)


class ApiClient:
    def __init__(self, base_url: str, bucket: TokenBucket, client: httpx.AsyncClient | None = None,
                 retries: int = 4, backoff_s: float = 1.0, timeout_s: float = 15.0,
                 headers: dict | None = None, sleep=asyncio.sleep):
        self.base_url = base_url.rstrip("/")
        self.bucket = bucket
        self.retries, self.backoff_s = retries, backoff_s
        self._sleep = sleep
        self._own = client is None
        self.client = client or httpx.AsyncClient(timeout=timeout_s)
        self.headers = {"User-Agent": USER_AGENT, "Accept": "application/json", **(headers or {})}

    async def request(self, method: str, path: str, *, params=None, json=None):
        """Renvoie le JSON décodé, ou None après épuisement des tentatives / 4xx."""
        url = path if path.startswith("http") else f"{self.base_url}/{path.lstrip('/')}"
        delay = self.backoff_s
        for attempt in range(self.retries):
            await self.bucket.acquire()
            try:
                r = await self.client.request(method, url, params=params, json=json, headers=self.headers)
            except httpx.HTTPError as e:
                log.warning("%s %s: %s (tentative %d)", method, url, type(e).__name__, attempt + 1)
                await self._sleep(delay)
                delay *= 2
                continue
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else delay
                log.info("%s %s -> %d, attente %.1fs", method, url, r.status_code, wait)
                await self._sleep(wait)
                delay *= 2
                continue
            if r.status_code >= 400:
                log.info("%s %s -> %d", method, url, r.status_code)
                return None
            try:
                return r.json()
            except ValueError:
                return None
        return None

    async def get(self, path: str, **params):
        return await self.request("GET", path, params=params or None)

    async def aclose(self) -> None:
        if self._own:
            await self.client.aclose()
