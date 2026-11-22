"""GeckoTerminal (sans clé) : 10 req/min, cache SQLite 60 s."""
from __future__ import annotations

import httpx

from cache import TTLCache

from .base import ApiClient, TokenBucket

BASE = "https://api.geckoterminal.com/api/v2"


class GeckoTerminal:
    def __init__(self, cache: TTLCache, client: httpx.AsyncClient | None = None, ttl_s: float = 60.0, **kw):
        self.api = ApiClient(BASE, TokenBucket(10, 60, burst=2), client,
                             headers={"Accept": "application/json;version=20230302"}, **kw)
        self.cache, self.ttl_s = cache, ttl_s

    async def token(self, mint: str) -> dict | None:
        key = f"gt:token:{mint}"
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        data = await self.api.get(f"/networks/solana/tokens/{mint}")
        if data is not None:
            self.cache.set(key, data, self.ttl_s)
        return data

    async def trending_mints(self) -> list[str]:
        """Jetons des pools Solana en tendance (pools établis avec du volume, pas seulement les nouveautés)."""
        data = await self.api.get("/networks/solana/trending_pools", params={"page": 1})
        mints: list[str] = []
        for pool in (data or {}).get("data", []) if isinstance(data, dict) else []:
            try:
                tid = pool["relationships"]["base_token"]["data"]["id"]
            except (KeyError, TypeError):
                continue
            if isinstance(tid, str) and tid.startswith("solana_"):
                mints.append(tid[len("solana_"):])
        return mints

    async def aclose(self) -> None:
        await self.api.aclose()
