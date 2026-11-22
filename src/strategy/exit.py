"""Règles de sortie, communes au bot et au backtest.

Logique (les meme coins ont des rendements à queue épaisse : on coupe vite les perdants
et on laisse courir une partie des gagnants) :
  1. stop-loss sur la position restante (remonté au prix d'entrée après TP1 si activé) ;
  2. stop suiveur : une fois le gain >= `trail_activation_pct`, on sort si la valeur recule
     de `trailing_stop_pct` % depuis son plus haut ;
  3. TP1 : vente partielle (`tp1_fraction`) à `tp1_pct` ;
  4. take-profit final à `take_profit_pct` ;
  5. sortie temporelle à `max_hold_minutes`.
Tous les pourcentages s'appliquent au PnL NET de frais de la part restante.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ExitRules:
    stop_loss_pct: float = -25.0
    take_profit_pct: float = 300.0
    tp1_pct: float | None = 40.0
    tp1_fraction: float = 0.5
    trail_activation_pct: float | None = 40.0
    trailing_stop_pct: float | None = 25.0
    breakeven_after_tp1: bool = True
    max_hold_minutes: float = 240.0


@dataclass(frozen=True)
class Decision:
    action: str          # "SELL_ALL" | "SELL_PARTIAL"
    reason: str
    fraction: float = 1.0


def decide(r: ExitRules, pnl_pct: float | None, peak_pnl_pct: float, held_minutes: float,
           tp1_done: bool) -> Decision | None:
    """pnl_pct = None : plus de route de sortie (on matérialise la perte)."""
    if pnl_pct is None:
        return Decision("SELL_ALL", "NO_EXIT_ROUTE")
    stop = max(r.stop_loss_pct, 0.0) if (tp1_done and r.breakeven_after_tp1) else r.stop_loss_pct
    if pnl_pct <= stop:
        return Decision("SELL_ALL", "BREAKEVEN_STOP" if stop >= 0 > r.stop_loss_pct else "STOP_LOSS")
    if (r.trailing_stop_pct and r.trail_activation_pct is not None
            and peak_pnl_pct >= r.trail_activation_pct):
        drawdown_from_peak = ((1 + pnl_pct / 100) / (1 + peak_pnl_pct / 100) - 1) * 100
        if drawdown_from_peak <= -r.trailing_stop_pct:
            return Decision("SELL_ALL", "TRAILING_STOP")
    if pnl_pct >= r.take_profit_pct:
        return Decision("SELL_ALL", "TAKE_PROFIT")
    if not tp1_done and r.tp1_pct is not None and 0 < r.tp1_fraction < 1 and pnl_pct >= r.tp1_pct:
        return Decision("SELL_PARTIAL", "TP1", r.tp1_fraction)
    if held_minutes >= r.max_hold_minutes:
        return Decision("SELL_ALL", "TIME_STOP")
    return None
