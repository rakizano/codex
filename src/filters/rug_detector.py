"""Audit asynchrone multi-sources -> verdict déterministe (fail-closed).

Réutilise `memecoin.filters.evaluate` comme unique autorité de rejet. Les
autorités mint/freeze sont recoupées on-chain quand un RPC est configuré : la
lecture la plus pessimiste l'emporte.
"""
from __future__ import annotations

import asyncio
import re
import time
from dataclasses import dataclass, field

from memecoin.filters import Metrics, Thresholds, detect_injection, evaluate, is_valid_mint, wrap_untrusted
from memecoin.sources import normalize


@dataclass
class AuditResult:
    mint: str
    verdict: str
    flags: list[str]
    metrics: Metrics
    observations: dict = field(default_factory=dict)
    untrusted_block: str = ""
    injection_signals: list[str] = field(default_factory=list)
    buy_quote: dict | None = None
    symbol: str | None = None  # symbole assaini (alphanumérique court) ou None

    @staticmethod
    def safe_symbol(raw) -> str | None:
        s = str(raw or "")
        return s if re.fullmatch(r"[A-Za-z0-9]{2,10}", s) else None

    def to_llm_payload(self) -> dict:
        """Uniquement des données numériques/structurelles + le bloc confiné."""
        return {
            "token_mint": self.mint,
            "deterministic_verdict": self.verdict,
            "flags": self.flags,
            "metrics": {k: v for k, v in vars(self.metrics).items() if k != "extra_flags"},
            "observations": self.observations,
        }


def _pessimistic(a: bool | None, b: bool | None) -> bool | None:
    """revoked = True seulement si aucune source ne dit 'actif' et au moins une dit 'révoqué'."""
    if a is False or b is False:
        return False
    if a is True or b is True:
        return True
    return None


class RugDetector:
    def __init__(self, dex, rugcheck, gecko, jupiter, rpc=None,
                 thresholds: Thresholds = Thresholds(), size_sol: float = 0.5, slippage_bps: int = 300):
        self.dex, self.rugcheck, self.gecko, self.jupiter, self.rpc = dex, rugcheck, gecko, jupiter, rpc
        self.thresholds, self.size_sol, self.slippage_bps = thresholds, size_sol, slippage_bps

    async def audit(self, mint: str) -> AuditResult:
        if not is_valid_mint(mint):
            return AuditResult(mint, "REJECT", ["INVALID_MINT"], Metrics())

        pairs, report, gk, (buy, sell) = await asyncio.gather(
            self.dex.token_pairs(mint),
            self.rugcheck.report(mint),
            self.gecko.token(mint),
            self.jupiter.roundtrip(mint, self.size_sol, self.slippage_bps),
        )
        raw = {"dexscreener": pairs, "rugcheck": report, "geckoterminal": gk,
               "jupiter_buy": buy, "jupiter_sell": sell,
               "size_lamports": int(self.size_sol * 1_000_000_000)}
        try:
            metrics, obs, untrusted = normalize(raw)
        except Exception as e:  # format d'API inattendu : on rejette plutôt que planter
            return AuditResult(mint, "REJECT", [f"PARSE_ERROR({type(e).__name__})"], Metrics())

        if self.rpc is not None and getattr(self.rpc, "configured", False):
            try:
                m_rev, f_rev = await self.rpc.mint_authorities(mint)
                metrics.mint_authority_revoked = _pessimistic(metrics.mint_authority_revoked, m_rev)
                metrics.freeze_authority_revoked = _pessimistic(metrics.freeze_authority_revoked, f_rev)
                obs["onchain_authorities_checked"] = True
            except Exception:  # RPC indisponible : on garde RugCheck seul
                obs["onchain_authorities_checked"] = False

        created_ms = obs.get("pair_created_at_ms")
        if isinstance(created_ms, (int, float)) and created_ms > 0:
            obs["pair_age_min"] = max(0.0, (time.time() * 1000 - created_ms) / 60_000)

        # Validation croisée DexScreener / GeckoTerminal : écart de prix > 20 % = suspect
        p1, p2 = obs.get("price_usd"), obs.get("gecko_price_usd")
        if p1 and p2 and abs(p1 - p2) / max(p1, p2) > 0.20:
            metrics.extra_flags.append("PRICE_SOURCES_DIVERGE")

        signals: list[str] = []
        for v in untrusted.values():
            if v:
                signals += detect_injection(str(v))
        if signals:
            metrics.extra_flags.append("PROMPT_INJECTION_IN_METADATA")

        verdict, flags = evaluate(metrics, self.thresholds)
        return AuditResult(mint, verdict, flags, metrics, obs, wrap_untrusted(untrusted),
                           sorted(set(signals)), buy, AuditResult.safe_symbol(untrusted.get("symbol")))
