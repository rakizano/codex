"""Agrégation et évaluation des signaux sociaux (ne peut qu'empêcher une entrée)."""
from __future__ import annotations

import asyncio
from dataclasses import asdict, dataclass, field

import httpx

from cache import TTLCache
from config import Settings

from .reddit_client import RedditClient, RedditStats
from .x_client import XClient, XStats

KNOWN_LINK_TYPES = {"twitter", "telegram", "discord", "website"}
CACHE_TTL_S = 15 * 60  # économise le quota X : un même jeton n'est réinterrogé qu'après 15 min


@dataclass
class SocialSignals:
    link_types: list[str] = field(default_factory=list)  # types déclarés (twitter, telegram, website…)
    x_link_is_post: bool = False                          # lien X vers un post et non vers un compte
    boosts_active: int = 0
    x: XStats | None = None
    reddit: RedditStats | None = None

    def to_metrics(self) -> dict:
        """Uniquement des nombres/booléens : utilisable sans risque dans le payload LLM."""
        return {
            "social_link_types": sorted(self.link_types),
            "x_link_is_post": self.x_link_is_post,
            "dexscreener_boosts_active": self.boosts_active,
            "x_mentions_6h": self.x.mentions if self.x else None,
            "x_unique_authors_6h": self.x.unique_authors if self.x else None,
            "x_engagement_6h": self.x.engagement if self.x else None,
            "reddit_posts_24h": self.reddit.posts if self.reddit else None,
            "reddit_unique_authors_24h": self.reddit.unique_authors if self.reddit else None,
        }


def evaluate_social(sig: SocialSignals, s: Settings) -> tuple[bool, list[str]]:
    """(entrée autorisée ?, drapeaux). Les drapeaux préfixés INFO_ n'empêchent rien."""
    flags: list[str] = []
    if s.require_social_link and not (set(sig.link_types) & KNOWN_LINK_TYPES):
        flags.append("NO_SOCIAL_LINKS")
    if sig.boosts_active > s.max_boosts_active:
        flags.append(f"PAID_HYPE(boosts={sig.boosts_active})")
    if sig.x is not None:
        if sig.x.mentions < s.min_x_mentions_6h:
            flags.append(f"LOW_X_MENTIONS({sig.x.mentions})")
        elif sig.x.mentions >= 10 and sig.x.unique_ratio < s.min_x_unique_authors_ratio:
            flags.append(f"X_SHILL_PATTERN({sig.x.unique_authors}/{sig.x.mentions})")
    if sig.reddit is not None and sig.reddit.posts >= 5 and sig.reddit.unique_ratio < 0.4:
        flags.append(f"REDDIT_SHILL_PATTERN({sig.reddit.unique_authors}/{sig.reddit.posts})")
    if sig.x_link_is_post:
        flags.append("INFO_X_LINK_IS_POST")
    blocking = [f for f in flags if not f.startswith("INFO_")]
    return (not blocking), flags


class SocialChecker:
    def __init__(self, settings: Settings, cache: TTLCache, client: httpx.AsyncClient | None = None, **kw):
        self.s, self.cache = settings, cache
        self.x = XClient(settings.x_bearer_token, client, **kw) if settings.x_bearer_token else None
        self.reddit = RedditClient(client, **kw)

    async def check(self, mint: str, symbol: str | None, observations: dict) -> SocialSignals:
        sig = SocialSignals(
            link_types=[t for t in observations.get("social_link_types") or [] if t in KNOWN_LINK_TYPES],
            x_link_is_post=bool(observations.get("x_link_is_post")),
            boosts_active=int(observations.get("dexscreener_boosts_active") or 0),
        )
        cached = self.cache.get(f"social:{mint}")
        if cached is not None:
            sig.x = XStats(**cached["x"]) if cached.get("x") else None
            sig.reddit = RedditStats(**cached["reddit"]) if cached.get("reddit") else None
            return sig

        async def none():
            return None

        x_task = self.x.mentions(mint, symbol) if self.x else none()
        sig.x, sig.reddit = await asyncio.gather(x_task, self.reddit.mentions(mint))
        self.cache.set(f"social:{mint}", {"x": asdict(sig.x) if sig.x else None,
                                          "reddit": asdict(sig.reddit) if sig.reddit else None}, CACHE_TTL_S)
        return sig

    async def aclose(self) -> None:
        if self.x:
            await self.x.aclose()
        await self.reddit.aclose()
