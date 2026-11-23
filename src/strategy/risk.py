"""Risque transversal : régime macro de SOL et coûts d'exécution dynamiques (PAPER).

Régime macro : variation de SOL sur 1 h lue sur la paire SOL/USDC (ou USDT) la plus liquide de
DexScreener (contrat vérifié : priceChange.h1). Si SOL baisse de plus de 5 % sur 1 h, le nombre de
positions simultanées est ramené à 2. Donnée inconnue ou périmée : régime « stress » (jamais
supposé favorable).
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass

SOL_MINT = "So11111111111111111111111111111111111111112"
STABLES = {"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"}


@dataclass
class MacroState:
    sol_change_h1_pct: float | None
    as_of: float | None
    stress: bool
    reason: str


class MacroRegime:
    def __init__(self, dex, drop_limit_pct: float = -5.0, max_age_s: float = 300.0, clock=time.time):
        self.dex, self.drop_limit, self.max_age_s, self.clock = dex, drop_limit_pct, max_age_s, clock
        self._last: tuple[float, float] | None = None   # (as_of, change_h1)

    async def refresh(self) -> None:
        data = await self.dex.pairs_batch([SOL_MINT])
        pairs = (data or {}).get(SOL_MINT) or []
        best = None
        for p in pairs:
            if (p.get("quoteToken") or {}).get("address") not in STABLES:
                continue
            try:
                liq = float((p.get("liquidity") or {}).get("usd"))
                ch = float((p.get("priceChange") or {}).get("h1"))
            except (TypeError, ValueError):
                continue
            if math.isfinite(liq) and math.isfinite(ch) and (best is None or liq > best[0]):
                best = (liq, ch)
        if best:
            self._last = (self.clock(), best[1])

    def state(self) -> MacroState:
        if self._last is None:
            return MacroState(None, None, True, "SOL_DATA_UNKNOWN")
        as_of, ch = self._last
        if self.clock() - as_of > self.max_age_s:
            return MacroState(ch, as_of, True, "SOL_DATA_STALE")
        if ch <= self.drop_limit:
            return MacroState(ch, as_of, True, f"SOL_DROP_H1({ch:+.1f}%)")
        return MacroState(ch, as_of, False, "OK")


def quote_slippage_pct(mark_value_sol: float | None, quote_value_sol: float | None) -> float | None:
    """Coût implicite d'une vente : écart entre la valeur « au prix affiché » (DexScreener, part restante)
    et le devis Jupiter pour la même quantité. Un devis n'est pas une garantie d'exécution : la mesure
    sert à comparer le modèle de coût fixe au coût réellement coté, jamais à promettre un prix."""
    if not mark_value_sol or mark_value_sol <= 0 or quote_value_sol is None or not math.isfinite(quote_value_sol):
        return None
    return max(0.0, (1 - quote_value_sol / mark_value_sol) * 100)
