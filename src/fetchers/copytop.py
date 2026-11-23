"""copy.top : API REST publique, lecture seule, sans clé (contrat OpenAPI vérifié le 23/11/2026,
https://copy.top/v1/openapi.json). Aucun appel ne peut passer un ordre.

Contrats utilisés (champs réellement renvoyés) :
  GET /v1/alerts?kinds=confluence&since=&min_top_traders=   -> {cursor, events[]}
      event : {kind, at, chain, token, topTraders, topStillIn, traders, mcap, boughtUsd,
               buyers[<=5 handles], buyerNames[]}
  GET /v1/trades?traders=h1,h2(<=25)&since=&side=&min_usd=    -> {cursor, trades[], note}
      trade : {at, handle, name, side, chain, token, symbol, usd}  (le flux ne garde que 30 trades)
  GET /v1/traders/{handle}                                    -> {trader{handle, fairPlay, holdMin, ...}}
      fairPlay ∈ clean | watch | flagged ; holdMin observé à null sur le profil (même « clean »)
  GET /v1/traders?window=&sort=&platform=pumpfun&chain=solana&limit=20 -> {traders[{handle, fairPlay, holdMin}]}
      le classement fournit holdMin (renseigné pour ~90 % des lignes observées)
  GET /v1/coins/solana/{mint}                                 -> {leaders{holdingNow, soldOut, rows[{handle, holding, top}]}}

Il n'existe PAS d'adresse de wallet dans ces réponses : les traders sont identifiés par leur handle
copy.top (validé par expression régulière). Noms, symboles et textes sont des données de tiers :
jamais utilisés, jamais journalisés.
"""
from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass
from datetime import datetime

import httpx

from .base import ApiClient, TokenBucket

log = logging.getLogger(__name__)
BASE = "https://copy.top/v1"
HANDLE_RE = re.compile(r"^[A-Za-z0-9_.\-]{1,40}$")
MAX_TRADERS_PER_CALL = 25


def valid_handle(h) -> bool:
    return isinstance(h, str) and bool(HANDLE_RE.match(h))


def parse_ts(raw) -> float | None:
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except (TypeError, ValueError):
        return None


def _num(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


@dataclass(frozen=True)
class TraderProfile:
    handle: str
    fair_play: str | None     # clean | watch | flagged | None (inconnu)
    hold_min: float | None    # durée moyenne de détention ; None = inconnue

    def eligible(self, only_clean: bool, min_hold_min: float) -> bool:
        if only_clean and self.fair_play != "clean":
            return False
        return self.hold_min is not None and self.hold_min >= min_hold_min


class CopyTop:
    def __init__(self, client: httpx.AsyncClient | None = None, cache=None, base: str = BASE, **kw):
        # Limites « basses » non chiffrées sans clé : 15 requêtes/min, cache 30 s côté serveur.
        # 429 observés au-delà de ~10 requêtes/min sans clé : 8/min, rafale de 3.
        self.api = ApiClient(base, TokenBucket(8, 60, burst=3), client,
                             headers={"Accept": "application/json"}, **kw)
        self.cache = cache

    async def _get(self, path: str, **params) -> dict | None:
        try:
            data = await self.api.get(path, **{k: v for k, v in params.items() if v is not None})
        except httpx.HTTPError:
            return None
        return data if isinstance(data, dict) else None

    # --- signaux d'entrée -----------------------------------------------------------
    async def confluence_alerts(self, since: str | None, min_top_traders: int,
                                max_mcap_usd: float | None = None) -> tuple[list[dict], str | None]:
        data = await self._get("/alerts", kinds="confluence", since=since, min_top_traders=min_top_traders,
                               max_mcap_usd=max_mcap_usd, limit=40)
        if not data:
            return [], since
        events = [e for e in data.get("events") or [] if isinstance(e, dict)
                  and e.get("kind") == "confluence" and e.get("chain") == "solana"]
        cursor = data.get("cursor")
        return events, cursor if isinstance(cursor, str) and parse_ts(cursor) else since

    # --- traders --------------------------------------------------------------------
    async def leaderboard(self, ttl_s: float = 6 * 3600) -> dict[str, dict]:
        """{handle: {fair_play, hold_min}} d'après le classement Pump.fun/Solana (8 requêtes, cache 6 h).
        Seule source de la durée de détention (le profil la renvoie à null)."""
        key = "ct:leaderboard"
        if self.cache is not None:
            hit = self.cache.get(key)
            if isinstance(hit, dict):
                return hit
        out: dict[str, dict] = {}
        complete = True
        for window in ("7d", "30d"):
            for sort in ("total", "realized", "roi", "winrate"):
                data = await self._get("/traders", window=window, sort=sort, platform="pumpfun",
                                       chain="solana", limit=20)
                rows = (data or {}).get("traders")
                if not isinstance(rows, list):
                    complete = False
                    continue
                for t in rows:
                    if not isinstance(t, dict) or not valid_handle(t.get("handle")):
                        continue
                    hold = _num(t.get("holdMin"))
                    fp = t.get("fairPlay") if t.get("fairPlay") in ("clean", "watch", "flagged") else None
                    out[t["handle"]] = {"fair_play": fp, "hold_min": hold if hold is not None and hold >= 0 else None}
        if self.cache is not None and complete:
            self.cache.set(key, out, ttl_s)
        return out

    async def trader_profile(self, handle: str, ttl_s: float = 6 * 3600) -> TraderProfile | None:
        """fairPlay : profil (référence du serveur). holdMin : profil s'il est renseigné, sinon classement ;
        absent des deux => inconnu (trader non admissible)."""
        if not valid_handle(handle):
            return None
        key = f"ct:trader:{handle}"
        if self.cache is not None:
            hit = self.cache.get(key)
            if isinstance(hit, dict):
                return TraderProfile(handle, hit.get("fair_play"), hit.get("hold_min"))
        data = await self._get(f"/traders/{handle}")
        t = (data or {}).get("trader")
        if not isinstance(t, dict) or t.get("handle") != handle:
            return None
        fp = t.get("fairPlay") if t.get("fairPlay") in ("clean", "watch", "flagged") else None
        hold = _num(t.get("holdMin"))
        if hold is None or hold < 0:
            hold = ((await self.leaderboard()).get(handle) or {}).get("hold_min")
        prof = TraderProfile(handle, fp, hold)
        if self.cache is not None:
            self.cache.set(key, {"fair_play": prof.fair_play, "hold_min": prof.hold_min}, ttl_s)
        return prof

    async def coin_holding(self, mint: str) -> dict[str, bool] | None:
        """{handle: détient encore ?} pour les traders suivis de ce jeton ; None si indisponible."""
        data = await self._get(f"/coins/solana/{mint}")
        leaders = (data or {}).get("leaders")
        rows = leaders.get("rows") if isinstance(leaders, dict) else None
        if not isinstance(rows, list) or data.get("address") != mint:
            return None
        out: dict[str, bool] = {}
        for r in rows:
            if isinstance(r, dict) and valid_handle(r.get("handle")) and isinstance(r.get("holding"), bool):
                out[r["handle"]] = r["holding"]
        return out

    # --- flux de trades (sorties) -------------------------------------------------------
    async def live_sells(self, since: str | None, traders: list[str],
                         min_usd: float = 100.0) -> tuple[list[dict], str | None]:
        """Ventes des traders suivis. Les cohortes > 25 handles sont découpées en lots ; le curseur
        renvoyé est le plus ancien des curseurs de lots (aucun événement sauté)."""
        handles = list(dict.fromkeys(h for h in traders if valid_handle(h)))
        if not handles:
            return [], since
        trades, cursors = [], []
        for i in range(0, len(handles), MAX_TRADERS_PER_CALL):
            chunk = handles[i:i + MAX_TRADERS_PER_CALL]
            data = await self._get("/trades", traders=",".join(chunk), since=since, side="sell", min_usd=min_usd)
            if not data or not isinstance(data.get("trades"), list):
                return [], since   # échec partiel : on ne fait pas avancer le curseur
            trades += [x for x in data["trades"] if isinstance(x, dict)
                       and x.get("side") == "sell" and x.get("chain") == "solana"]
            c = data.get("cursor")
            if isinstance(c, str) and parse_ts(c):
                cursors.append(c)
        cursor = min(cursors, key=parse_ts) if len(cursors) == -(-len(handles) // MAX_TRADERS_PER_CALL) else since
        return trades, cursor

    async def aclose(self) -> None:
        await self.api.aclose()
