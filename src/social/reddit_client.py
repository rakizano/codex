"""Reddit — recherche publique JSON (gratuite, sans clé, ~10 requêtes/min)."""
from __future__ import annotations

from dataclasses import dataclass

import httpx

from fetchers.base import ApiClient, TokenBucket

BASE = "https://www.reddit.com"


@dataclass
class RedditStats:
    posts: int
    unique_authors: int
    comments: int

    @property
    def unique_ratio(self) -> float:
        return self.unique_authors / self.posts if self.posts else 0.0


class RedditClient:
    def __init__(self, client: httpx.AsyncClient | None = None, **kw):
        self.api = ApiClient(BASE, TokenBucket(8, 60, burst=2), client, retries=2, **kw)

    async def mentions(self, mint: str) -> RedditStats | None:
        """Posts des dernières 24 h citant l'adresse du mint (le symbole seul est trop ambigu)."""
        data = await self.api.get("/search.json", q=mint, sort="new", t="day", limit="100")
        if not isinstance(data, dict):
            return None
        posts = [c.get("data") or {} for c in (data.get("data") or {}).get("children") or [] if isinstance(c, dict)]
        authors = {p.get("author") for p in posts if p.get("author") and p.get("author") != "[deleted]"}
        comments = sum(int(p.get("num_comments") or 0) for p in posts)
        return RedditStats(len(posts), len(authors), comments)

    async def aclose(self) -> None:
        await self.api.aclose()
