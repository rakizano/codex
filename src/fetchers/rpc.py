"""RPC Solana JSON-RPC en lecture seule : Helius (10 RPS) puis bascule Chainstack (25 RPS).

Seules des méthodes de lecture sont autorisées (liste blanche) : aucune méthode
d'envoi n'est appelable depuis ce client. L'envoi, réservé au mode LIVE confirmé,
passe exclusivement par `live.executor` (block engine Jito).
"""
from __future__ import annotations

import itertools
import logging

import httpx

from .base import ApiClient, TokenBucket

log = logging.getLogger(__name__)

READ_ONLY_METHODS = frozenset({
    "getAccountInfo", "getBalance", "getTokenSupply", "getTokenLargestAccounts",
    "getSignaturesForAddress", "getSlot", "getHealth", "getLatestBlockhash",
    "getMultipleAccounts", "getTokenAccountBalance", "simulateTransaction",
    "getTokenAccountsByOwner", "getSignatureStatuses",
})


class RpcError(RuntimeError):
    pass


class SolanaRpc:
    def __init__(self, primary_url: str | None, fallback_url: str | None = None,
                 client: httpx.AsyncClient | None = None, **kw):
        self.endpoints: list[ApiClient] = []
        if primary_url:
            self.endpoints.append(ApiClient(primary_url, TokenBucket(10, 1), client, **kw))
        if fallback_url:
            self.endpoints.append(ApiClient(fallback_url, TokenBucket(25, 1), client, **kw))
        self._ids = itertools.count(1)

    @property
    def configured(self) -> bool:
        return bool(self.endpoints)

    async def call(self, method: str, params: list | None = None):
        if method not in READ_ONLY_METHODS:
            raise RpcError(f"méthode RPC non autorisée : {method}")
        if not self.endpoints:
            raise RpcError("aucun endpoint RPC configuré (HELIUS_RPC_URL / CHAINSTACK_RPC_URL)")
        body = {"jsonrpc": "2.0", "id": next(self._ids), "method": method, "params": params or []}
        for i, ep in enumerate(self.endpoints):
            data = await ep.request("POST", ep.base_url, json=body)
            if isinstance(data, dict) and "result" in data:
                return data["result"]
            log.warning("RPC endpoint #%d en échec pour %s, bascule", i, method)
        raise RpcError(f"tous les endpoints RPC ont échoué pour {method}")

    async def mint_authorities(self, mint: str) -> tuple[bool | None, bool | None]:
        """(mint_authority_revoked, freeze_authority_revoked) lus on-chain — validation croisée de RugCheck."""
        res = await self.call("getAccountInfo", [mint, {"encoding": "jsonParsed"}])
        try:
            info = res["value"]["data"]["parsed"]["info"]
        except (TypeError, KeyError):
            return None, None
        return info.get("mintAuthority") is None, info.get("freezeAuthority") is None

    async def aclose(self) -> None:
        for ep in self.endpoints:
            await ep.aclose()
