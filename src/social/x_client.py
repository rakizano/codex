"""X (Twitter) — API officielle v2, recherche récente. Optionnel : nécessite X_BEARER_TOKEN
(compte développeur ; la recherche exige en pratique un accès payant, voir developer.x.com).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx

from fetchers.base import ApiClient, TokenBucket

BASE = "https://api.x.com/2"
_SYMBOL_RE = re.compile(r"[A-Za-z0-9]{2,10}")


@dataclass
class XStats:
    mentions: int
    unique_authors: int
    engagement: int  # likes + reposts + réponses + citations

    @property
    def unique_ratio(self) -> float:
        return self.unique_authors / self.mentions if self.mentions else 0.0


def build_query(mint: str, symbol: str | None) -> str:
    """Le symbole vient des métadonnées (non fiable) : il n'est utilisé que s'il est alphanumérique court."""
    terms = [mint]
    if symbol and _SYMBOL_RE.fullmatch(symbol):
        terms.append(f'"${symbol.upper()}"')
    return f"({' OR '.join(terms)}) -is:retweet"


class XClient:
    def __init__(self, bearer_token: str, client: httpx.AsyncClient | None = None, **kw):
        # Plafond prudent : 4 requêtes/min (le quota de recherche est faible sur les petits plans).
        self.api = ApiClient(BASE, TokenBucket(4, 60, burst=1), client,
                             headers={"Authorization": f"Bearer {bearer_token}"}, retries=2, **kw)

    async def mentions(self, mint: str, symbol: str | None, hours: int = 6,
                       now: datetime | None = None) -> XStats | None:
        now = now or datetime.now(timezone.utc)
        start = (now - timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
        data = await self.api.get("/tweets/search/recent", query=build_query(mint, symbol), max_results="100",
                                  start_time=start, **{"tweet.fields": "author_id,public_metrics"})
        if not isinstance(data, dict):
            return None  # 401/403 (pas d'accès), quota épuisé, réseau : signal indisponible
        tweets = [t for t in data.get("data") or [] if isinstance(t, dict)]
        authors = {t.get("author_id") for t in tweets if t.get("author_id")}
        engagement = 0
        for t in tweets:
            m = t.get("public_metrics") or {}
            engagement += sum(int(m.get(k) or 0) for k in ("like_count", "retweet_count", "reply_count", "quote_count"))
        return XStats(len(tweets), len(authors), engagement)

    async def aclose(self) -> None:
        await self.api.aclose()
