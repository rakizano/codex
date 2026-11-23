"""Analyse anti-rug du rapport RugCheck : concentration réelle, réseaux d'insiders, créateur sériel.

Contrat RugCheck vérifié (rapport /v1/tokens/{mint}/report) :
  - topHolders[] : {address (compte de jetons), owner (wallet), pct (en %, 0-100), insider} ; 20 au plus ;
  - knownAccounts : {adresse: {name, type}} avec des types observés AMM, LOCKER, CREATOR ;
  - markets[] : {pubkey, liquidityA, liquidityB, liquidityAAccount{owner}, ...} ;
  - insiderNetworks : [{id, size, type (trade|transfer...), tokenAmount, currentHolding, activeAccounts}]
    ou null quand graphInsidersDetected == 0 ; token.supply en unités brutes ;
  - creator : adresse ; creatorTokens observé à null (inexploitable).

Principes : seuls les comptes techniques CONFIRMÉS sont exclus de la concentration ; toute
ambiguïté renvoie None (=> rejet fail-closed par le filtre de sécurité).
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass

# Types RugCheck considérés comme techniques (jamais CREATOR : le créateur est un vrai détenteur).
TECHNICAL_TYPES = frozenset({"AMM", "POOL", "LOCKER", "BURN", "PROGRAM", "CREATOR_VAULT"})
# Adresses de destruction connues (jetons brûlés : pas un détenteur).
BURN_ADDRESSES = frozenset({"1nc1nerator11111111111111111111111111111111"})
LISTED_TOP_HOLDERS = 20


def _f(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def technical_accounts(report: dict) -> set[str]:
    """Adresses (comptes ou propriétaires) dont la nature technique est confirmée par RugCheck."""
    out: set[str] = set(BURN_ADDRESSES)
    for addr, info in (report.get("knownAccounts") or {}).items():
        if isinstance(info, dict) and str(info.get("type", "")).upper() in TECHNICAL_TYPES:
            out.add(addr)
    for mk in report.get("markets") or []:
        if not isinstance(mk, dict):
            continue
        for key in ("pubkey", "liquidityA", "liquidityB"):
            if isinstance(mk.get(key), str):
                out.add(mk[key])          # pool et ses comptes de réserve
        for key in ("liquidityAAccount", "liquidityBAccount"):
            acc = mk.get(key)
            if isinstance(acc, dict) and isinstance(acc.get("owner"), str):
                out.add(acc["owner"])     # autorité du pool (propriétaire des réserves)
            elif isinstance(acc, str):
                out.add(acc)              # ancienne forme : adresse du compte de réserve
    return out


def compute_real_top10_pct(report: dict) -> tuple[float | None, dict]:
    """-> (concentration % des 10 premiers VRAIS détenteurs, détails) ; None si ambigu."""
    holders = report.get("topHolders")
    if not isinstance(holders, list):
        return None, {"reason": "TOP_HOLDERS_MISSING"}
    technical = technical_accounts(report)
    real, excluded = [], 0
    for h in holders:
        if not isinstance(h, dict):
            return None, {"reason": "TOP_HOLDER_MALFORMED"}
        pct = _f(h.get("pct"))
        if pct is None or not 0 <= pct <= 100:
            return None, {"reason": "TOP_HOLDER_PCT_INVALID"}
        if h.get("owner") in technical or h.get("address") in technical:
            excluded += 1
            continue
        real.append(pct)
    total_listed = sum(_f(h.get("pct")) or 0 for h in holders)
    if total_listed > 100.5:
        return None, {"reason": "PCT_UNITS_INCONSISTENT", "sum": total_listed}
    # Si la liste est tronquée et que trop de comptes ont été exclus, des vrais détenteurs
    # absents de la liste pourraient appartenir au Top 10 : donnée incomplète => None.
    if len(holders) >= LISTED_TOP_HOLDERS and len(real) < 10:
        return None, {"reason": "TOP10_INCOMPLETE_AFTER_EXCLUSION", "excluded": excluded}
    real.sort(reverse=True)
    return sum(real[:10]), {"excluded_technical": excluded, "real_listed": len(real)}


@dataclass(frozen=True)
class InsiderRules:
    enabled: bool = True
    suspicious_types: tuple[str, ...] = ("trade", "transfer")
    max_wallets: int = 20         # réseau suspect de 20 wallets ou plus : rejet
    max_holding_pct: float = 5.0  # réseau suspect détenant 5 % ou plus de l'offre : rejet


def insider_flags(report: dict, r: InsiderRules) -> list[str]:
    """Motifs traçables. Un réseau n'est retenu que s'il est de type trade/transfer ET grand
    (>= max_wallets) ou concentré (>= max_holding_pct) : une simple relation ne suffit pas."""
    if not r.enabled:
        return []
    graph = report.get("graphInsidersDetected")
    nets = report.get("insiderNetworks")
    if nets is None:
        if "insiderNetworks" in report and _f(graph) == 0:
            return []                       # aucun réseau détecté (contrat : null quand 0)
        return ["UNKNOWN_INSIDER_NETWORKS"]
    if not isinstance(nets, list):
        return ["UNKNOWN_INSIDER_NETWORKS"]
    supply = _f((report.get("token") or {}).get("supply"))
    flags = []
    for n in nets:
        if not isinstance(n, dict):
            return ["UNKNOWN_INSIDER_NETWORKS"]
        ntype = str(n.get("type") or n.get("activityType") or "").lower()
        size = _f(n.get("size"))
        holding = _f(n.get("currentHolding"))
        if size is None or not ntype:
            return ["UNKNOWN_INSIDER_NETWORKS"]
        if ntype not in r.suspicious_types:
            continue
        pct = 100 * holding / supply if holding is not None and supply else None
        if size >= r.max_wallets:
            flags.append(f"INSIDER_NETWORK_LARGE({ntype},{size:.0f}wallets)")
        if pct is None:
            flags.append(f"INSIDER_NETWORK_UNKNOWN_HOLDING({ntype})")
        elif pct >= r.max_holding_pct:
            flags.append(f"INSIDER_NETWORK_HOLDING({ntype},{pct:.1f}%)")
    return flags


# --- créateurs sériels (RPC Solana en lecture seule) ------------------------------------

PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"


def is_token_creation(tx: dict | None) -> bool | None:
    """Classe une transaction (getTransaction, jsonParsed). True = création de jeton confirmée,
    False = autre chose, None = indéterminable. Seuls des marqueurs explicites comptent."""
    if not isinstance(tx, dict):
        return None
    meta = tx.get("meta")
    if not isinstance(meta, dict):
        return None
    if meta.get("err") is not None:
        return False
    logs = meta.get("logMessages")
    if not isinstance(logs, list):
        return None
    text = "\n".join(str(x) for x in logs)
    if f"Program {PUMP_PROGRAM} invoke" in text and "Instruction: Create" in text:
        return True
    if "Instruction: InitializeMint" in text:
        return True
    return False


class CreatorHistory:
    """Compte les créations de jetons d'un créateur sur 7 jours via getSignaturesForAddress puis
    getTransaction (lecture seule). Résultat mis en cache ; inconnu si une étape échoue."""

    def __init__(self, rpc, cache, max_signatures: int = 40, ttl_s: float = 6 * 3600, clock=time.time):
        self.rpc, self.cache, self.max_signatures, self.ttl_s, self.clock = rpc, cache, max_signatures, ttl_s, clock

    async def launches_7d(self, creator: str) -> int | None:
        if self.rpc is None or not getattr(self.rpc, "configured", False) or not creator:
            return None
        key = f"creator7d:{creator}"
        hit = self.cache.get(key)
        if hit is not None:
            return int(hit)
        since = self.clock() - 7 * 86400
        try:
            sigs = await self.rpc.call("getSignaturesForAddress", [creator, {"limit": self.max_signatures}])
        except Exception:
            return None
        if not isinstance(sigs, list):
            return None
        recent = [s for s in sigs if isinstance(s, dict) and isinstance(s.get("blockTime"), (int, float))
                  and s["blockTime"] >= since and s.get("err") is None]
        if len(sigs) >= self.max_signatures and all(isinstance(s, dict) and (s.get("blockTime") or 0) >= since
                                                    for s in sigs):
            return None  # fenêtre de 7 j non couverte par la page lue : comptage incomplet
        count = 0
        for s in recent:
            try:
                tx = await self.rpc.call("getTransaction", [s.get("signature"), {
                    "encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}])
            except Exception:
                return None
            kind = is_token_creation(tx)
            if kind is None:
                return None
            count += kind
        self.cache.set(key, count, self.ttl_s)
        return count
