"""copy.top (serveur MCP public, lecture seule, gratuit) appelé directement en JSON-RPC HTTP.

Fournit les signaux « smart money » de Pump.fun : alertes de confluence (plusieurs top
traders du classement PnL achètent le même jeton) et jetons chauds. Ce service ne passe
aucun ordre. Noms, symboles et textes sont écrits par des tiers : le bot n'en garde que le
mint (validé) et des nombres, jamais le texte.
"""
from __future__ import annotations

import itertools
import json
import logging

import httpx

from .base import ApiClient, TokenBucket

log = logging.getLogger(__name__)
URL = "https://copy.top/mcp"
ALLOWED_TOOLS = frozenset({"get_alerts", "get_hot_coins", "get_leaderboard", "get_token", "get_live_trades"})


class CopyTop:
    def __init__(self, client: httpx.AsyncClient | None = None, url: str = URL, **kw):
        self.api = ApiClient(url, TokenBucket(20, 60, burst=3), client,
                             headers={"Accept": "application/json, text/event-stream",
                                      "MCP-Protocol-Version": "2025-06-18"}, **kw)
        self.url = url
        self._ids = itertools.count(1)

    async def call(self, tool: str, arguments: dict) -> dict | None:
        """Appelle un outil en lecture ; None si indisponible ou réponse invalide (jamais d'exception)."""
        if tool not in ALLOWED_TOOLS:
            raise ValueError(f"outil copy.top non autorisé : {tool}")
        body = {"jsonrpc": "2.0", "id": next(self._ids), "method": "tools/call",
                "params": {"name": tool, "arguments": arguments}}
        try:
            data = await self.api.request("POST", self.url, json=body)
            result = data["result"]
            if result.get("isError"):
                log.warning("copy.top %s : erreur de l'outil", tool)
                return None
            text = next(c["text"] for c in result["content"] if c.get("type") == "text")
            out = json.loads(text)
            return out if isinstance(out, dict) else None
        except (KeyError, TypeError, StopIteration, ValueError, AttributeError, httpx.HTTPError):
            log.warning("copy.top %s : réponse indisponible ou invalide", tool)
            return None

    async def confluence_alerts(self, since: str | None, min_top_traders: int,
                                max_mcap_usd: float | None = None) -> tuple[list[dict], str | None]:
        """Événements « plusieurs top traders ont acheté ce jeton » depuis le curseur. -> (événements, curseur)."""
        args: dict = {"kinds": ["confluence"], "min_top_traders": min_top_traders, "limit": 40}
        if since:
            args["since"] = since
        if max_mcap_usd:
            args["max_mcap_usd"] = max_mcap_usd
        data = await self.call("get_alerts", args)
        if not data:
            return [], since
        events = [e for e in data.get("events") or [] if isinstance(e, dict)
                  and e.get("kind") == "confluence" and e.get("chain") == "solana"]
        cursor = data.get("cursor")
        return events, cursor if isinstance(cursor, str) else since

    async def live_sells(self, since: str | None, traders: list[str],
                         min_usd: float = 100.0) -> tuple[list[dict], str | None]:
        """Ventes significatives des seuls traders suivis (max. 25 handles), en lecture seule."""
        handles = list(dict.fromkeys(x for x in traders if isinstance(x, str) and 0 < len(x) <= 80))[:25]
        if not handles:
            return [], since
        args: dict = {"side": "sell", "limit": 30, "traders": handles, "min_usd": min_usd}
        if since:
            args["since"] = since
        data = await self.call("get_live_trades", args)
        if not data:
            return [], since
        rows = data.get("trades")
        if not isinstance(rows, list):
            return [], since
        trades = [x for x in rows if isinstance(x, dict)
                  and x.get("side") == "sell" and x.get("chain") == "solana"]
        cursor = data.get("cursor")
        return trades, cursor if isinstance(cursor, str) else since

    async def aclose(self) -> None:
        await self.api.aclose()
