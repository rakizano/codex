"""DexScreener (sans clé) : 60 req/min profils/boosts, 300 req/min paires."""
from __future__ import annotations

import httpx

from .base import ApiClient, TokenBucket

BASE = "https://api.dexscreener.com"


class DexScreener:
    def __init__(self, client: httpx.AsyncClient | None = None, **kw):
        self.profiles = ApiClient(BASE, TokenBucket(60, 60), client, **kw)
        self.pairs = ApiClient(BASE, TokenBucket(300, 60), client, **kw)

    async def latest_profiles(self) -> list[dict]:
        data = await self.profiles.get("/token-profiles/latest/v1")
        return [d for d in (data or []) if isinstance(d, dict) and d.get("chainId") == "solana"]

    async def latest_boosts(self) -> list[dict]:
        data = await self.profiles.get("/token-boosts/latest/v1")
        return [d for d in (data or []) if isinstance(d, dict) and d.get("chainId") == "solana"]

    async def token_pairs(self, mint: str) -> list[dict]:
        data = await self.pairs.get(f"/tokens/v1/solana/{mint}")
        if isinstance(data, dict):
            data = data.get("pairs")
        return [p for p in (data or []) if isinstance(p, dict)]

    async def aclose(self) -> None:
        await self.profiles.aclose()
        await self.pairs.aclose()
