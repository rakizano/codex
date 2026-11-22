"""RugCheck API publique (rate-limit non documenté : on reste prudent à 30 req/min)."""
from __future__ import annotations

import httpx

from .base import ApiClient, TokenBucket

BASE = "https://api.rugcheck.xyz/v1"


class RugCheck:
    def __init__(self, client: httpx.AsyncClient | None = None, **kw):
        self.api = ApiClient(BASE, TokenBucket(30, 60, burst=3), client, **kw)

    async def report(self, mint: str) -> dict | None:
        data = await self.api.get(f"/tokens/{mint}/report")
        return data if isinstance(data, dict) else None

    async def aclose(self) -> None:
        await self.api.aclose()
