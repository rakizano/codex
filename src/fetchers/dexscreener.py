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

    async def top_boosts(self) -> list[dict]:
        data = await self.profiles.get("/token-boosts/top/v1")
        return [d for d in (data or []) if isinstance(d, dict) and d.get("chainId") == "solana"]

    async def token_pairs(self, mint: str) -> list[dict]:
        data = await self.pairs.get(f"/tokens/v1/solana/{mint}")
        if isinstance(data, dict):
            data = data.get("pairs")
        return [p for p in (data or []) if isinstance(p, dict)]

    async def prices(self, mints: list[str]) -> dict[str, tuple[float | None, float | None]]:
        """Prix USD et liquidité de la paire la plus liquide, par lots de 30 jetons (1 requête/lot)."""
        out: dict[str, tuple[float | None, float | None]] = {}
        for i in range(0, len(mints), 30):
            chunk = mints[i:i + 30]
            data = await self.pairs.get(f"/tokens/v1/solana/{','.join(chunk)}")
            best: dict[str, dict] = {}
            for p in data or []:
                if not isinstance(p, dict):
                    continue
                mint = (p.get("baseToken") or {}).get("address")
                liq = float((p.get("liquidity") or {}).get("usd") or 0)
                if mint in chunk and liq >= float(((best.get(mint) or {}).get("liquidity") or {}).get("usd") or -1):
                    best[mint] = p
            for mint, p in best.items():
                try:
                    price = float(p.get("priceUsd"))
                except (TypeError, ValueError):
                    price = None
                out[mint] = (price, float((p.get("liquidity") or {}).get("usd") or 0))
        return out

    async def aclose(self) -> None:
        await self.profiles.aclose()
        await self.pairs.aclose()
