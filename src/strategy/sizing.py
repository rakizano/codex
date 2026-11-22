"""Taille de position fondée sur l'avantage mesuré (Kelly fractionné).

Kelly pour des gains/pertes moyens W et L (en fraction de la mise) et un taux de réussite p :
    f* = p / L - (1 - p) / W
On n'en joue qu'une fraction (1/4 par défaut) car p, W et L sont estimés sur peu de trades.
Si f* <= 0 après `min_trades` trades, l'avantage est négatif : on NE TRADE PLUS.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SizingDecision:
    size_sol: float
    reason: str
    kelly_full: float | None = None


def kelly_fraction(win_rate: float, avg_win_pct: float, avg_loss_pct: float) -> float | None:
    w, l_ = avg_win_pct / 100, abs(avg_loss_pct) / 100
    if w <= 0 or l_ <= 0:
        return None
    return win_rate / l_ - (1 - win_rate) / w


def position_size(mode: str, base_size_sol: float, max_size_sol: float, bankroll_sol: float,
                  stats: dict, min_trades: int = 30, kelly_multiplier: float = 0.25,
                  min_size_sol: float = 0.01) -> SizingDecision:
    n = stats.get("closed_trades") or 0
    if n < min_trades or stats.get("avg_win_pct") is None or stats.get("avg_loss_pct") is None:
        return SizingDecision(min(base_size_sol, max_size_sol), f"FIXED(warmup {n}/{min_trades})")
    k = kelly_fraction((stats.get("win_rate_pct") or 0) / 100, stats["avg_win_pct"], stats["avg_loss_pct"])
    if k is None or k <= 0:
        return SizingDecision(0.0, "NEGATIVE_EDGE", k)
    if mode != "kelly":
        return SizingDecision(min(base_size_sol, max_size_sol), "FIXED", k)
    size = max(min_size_sol, min(max_size_sol, bankroll_sol * k * kelly_multiplier))
    return SizingDecision(size, "KELLY", k)
