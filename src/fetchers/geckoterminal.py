"""GeckoTerminal (sans clé). En production (GitHub Actions, 23/11/2026), plus de 300 réponses 429
ont été observées à 10 requêtes/min : débit ramené à 6/min, pools en tendance mis en cache 5 min,
bougies 3 min."""
from __future__ import annotations

import asyncio

import httpx

from cache import TTLCache

from .base import ApiClient, TokenBucket

BASE = "https://api.geckoterminal.com/api/v2"


class GeckoTerminal:
    def __init__(self, cache: TTLCache, client: httpx.AsyncClient | None = None, ttl_s: float = 60.0, **kw):
        self.api = ApiClient(BASE, TokenBucket(6, 60, burst=2), client,
                             headers={"Accept": "application/json;version=20230302"}, **kw)
        self.cache, self.ttl_s = cache, ttl_s
        self._locks: dict[str, asyncio.Lock] = {}

    async def token(self, mint: str) -> dict | None:
        key = f"gt:token:{mint}"
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        data = await self.api.get(f"/networks/solana/tokens/{mint}")
        if data is not None:
            self.cache.set(key, data, self.ttl_s)
        return data

    async def ohlcv(self, pool: str, aggregate_min: int = 5, limit: int = 40,
                    ttl_s: float = 180.0) -> list | None:
        """Bougies [ts, o, h, l, c, v] d'un pool (contrat vérifié). Cache 90 s par pool et
        verrou par clé : des appels simultanés ne déclenchent qu'une seule requête (quota 10/min)."""
        if not isinstance(pool, str) or not pool:
            return None
        key = f"gt:ohlcv:{pool}:{aggregate_min}:{limit}"
        hit = self.cache.get(key)
        if hit is not None:
            return hit
        lock = self._locks.setdefault(key, asyncio.Lock())
        async with lock:
            hit = self.cache.get(key)
            if hit is not None:
                return hit
            data = await self.api.get(f"/networks/solana/pools/{pool}/ohlcv/minute",
                                      aggregate=aggregate_min, limit=limit)
            try:
                rows = data["data"]["attributes"]["ohlcv_list"]
            except (KeyError, TypeError):
                return None   # 429 épuisé / réponse incomplète : pas de valeur inventée
            if isinstance(rows, list):
                self.cache.set(key, rows, ttl_s)
                return rows
            return None

    async def trending_pools(self) -> list[tuple[str, str]]:
        """(adresse du pool, mint) des pools Solana en tendance (établis, avec du volume)."""
        key = "gt:trending"
        hit = self.cache.get(key)
        if isinstance(hit, list):
            return [tuple(x) for x in hit]
        data = await self.api.get("/networks/solana/trending_pools", page=1)
        out: list[tuple[str, str]] = []
        for pool in (data or {}).get("data", []) if isinstance(data, dict) else []:
            try:
                tid = pool["relationships"]["base_token"]["data"]["id"]
                addr = pool.get("attributes", {}).get("address") or pool.get("id", "").removeprefix("solana_")
            except (KeyError, TypeError, AttributeError):
                continue
            if isinstance(tid, str) and tid.startswith("solana_"):
                out.append((addr if isinstance(addr, str) else "", tid[len("solana_"):]))
        if out:
            self.cache.set(key, out, 300)
        return out

    async def trending_mints(self) -> list[str]:
        return [mint for _, mint in await self.trending_pools()]

    async def pool_trades(self, pool: str) -> list[dict]:
        """300 derniers trades d'un pool : wallet, sens, montants, prix (données publiques on-chain)."""
        data = await self.api.get(f"/networks/solana/pools/{pool}/trades")
        rows = (data or {}).get("data") if isinstance(data, dict) else None
        return [r.get("attributes") for r in rows or [] if isinstance(r, dict) and isinstance(r.get("attributes"), dict)]

    async def aclose(self) -> None:
        await self.api.aclose()
