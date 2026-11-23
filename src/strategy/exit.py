"""Règles de sortie, communes au bot (PAPER) et au backtest.

Ordre de priorité explicite (une seule décision cohérente par cycle) :
  1. sécurité / arrêt d'urgence (plus de route de sortie, alerte de sécurité) ;
  2. stop-loss (avant TP1) — adaptatif à la volatilité : SL = -min(38, max(18, 2,2 x ATR%)) ;
  3. sortie copy.top validée (distribution par la cohorte, ou désengagement sans gain) ;
  4. après TP1 : plancher de sortie (+3 % NET), stop suiveur depuis le plus haut, take-profit final ;
     avant TP1 : take-profit final puis vente partielle TP1 (+40 %, 30 % de la position) ;
  5. stagnation (>= 20 min sans jamais atteindre +8 %, et sous +3 %) ;
  6. durée maximale (120 min).

Tous les pourcentages s'appliquent au PnL NET de frais et de glissement de la part restante :
le plancher post-TP1 de +3 % est donc plus exigeant qu'un +3 % de prix brut (il ne garantit pas
pour autant un gain à l'exécution : le prix peut glisser entre la décision et la vente).

Volatilité inconnue (pas d'ATR fiable) : mode conservateur à seuils fixes (`stop_loss_pct`,
`trailing_stop_pct`), jamais une fausse mesure. Le stop suiveur ne se desserre jamais : l'appelant
conserve le plus petit pourcentage déjà appliqué (`lock_trail`).

`decide_legacy` est la logique antérieure, inchangée : elle reste la seule utilisée en mode LIVE,
pour que les nouveaux développements ne puissent pas déclencher d'ordre réel.
"""
from __future__ import annotations

from dataclasses import dataclass

from .volatility import ATR_SOURCE, Volatility


@dataclass(frozen=True)
class ExitRules:
    exit_mode: str = "ATR"               # ATR | FIXED
    stop_loss_pct: float = -25.0         # stop fixe (mode FIXED ou volatilité inconnue)
    take_profit_pct: float = 300.0
    tp1_pct: float | None = 40.0
    tp1_fraction: float = 0.30
    trail_activation_pct: float | None = 40.0   # utilisé par decide_legacy uniquement
    trailing_stop_pct: float | None = 25.0      # suiveur fixe (volatilité inconnue)
    breakeven_after_tp1: bool = True
    max_hold_minutes: float = 120.0
    # Sorties adaptatives
    atr_sl_mult: float = 2.2
    atr_trail_mult: float = 2.0
    sl_min_abs_pct: float = 18.0
    sl_max_abs_pct: float = 38.0
    trail_min_pct: float = 20.0
    trail_max_pct: float = 35.0
    atr_period: int = 14
    allow_m5_proxy: bool = False         # |variation 5 min| comme repli : désactivé par défaut
    post_tp1_floor_pct: float = 3.0
    stagnation_min: float = 20.0
    stagnation_min_peak_pct: float = 8.0
    stagnation_current_max_pct: float = 3.0
    # copy.top : désengagement de la cohorte
    copytop_profit_guard_pct: float = 10.0
    copytop_tight_trail_pct: float = 10.0


# Réglages historiques, utilisés tels quels par le mode LIVE existant (protections préservées).
LEGACY_EXIT_RULES = ExitRules(exit_mode="FIXED", stop_loss_pct=-25.0, take_profit_pct=300.0, tp1_pct=40.0,
                              tp1_fraction=0.5, trail_activation_pct=40.0, trailing_stop_pct=25.0,
                              breakeven_after_tp1=True, max_hold_minutes=240.0)


@dataclass(frozen=True)
class Decision:
    action: str          # "SELL_ALL" | "SELL_PARTIAL"
    reason: str
    fraction: float = 1.0


def usable_vol(r: ExitRules, vol: Volatility | None) -> Volatility | None:
    if r.exit_mode != "ATR" or vol is None:
        return None
    if vol.source == ATR_SOURCE or (r.allow_m5_proxy and vol.source != ATR_SOURCE):
        return vol
    return None


def stop_pct_for(r: ExitRules, vol: Volatility | None) -> float:
    """Stop initial (négatif), figé à l'entrée."""
    v = usable_vol(r, vol)
    if v is None:
        return r.stop_loss_pct
    return -min(r.sl_max_abs_pct, max(r.sl_min_abs_pct, r.atr_sl_mult * v.pct))


def trail_pct_for(r: ExitRules, vol: Volatility | None) -> float | None:
    v = usable_vol(r, vol)
    if v is None:
        return r.trailing_stop_pct
    return min(r.trail_max_pct, max(r.trail_min_pct, r.atr_trail_mult * v.pct))


def lock_trail(previous: float | None, new: float | None) -> float | None:
    """Le stop suiveur ne se desserre jamais : on garde le plus petit pourcentage observé."""
    if previous is None:
        return new
    if new is None:
        return previous
    return min(previous, new)


@dataclass
class ExitContext:
    pnl_pct: float | None            # PnL net de la part restante ; None = plus de route de sortie
    peak_pnl_pct: float
    held_minutes: float
    tp1_done: bool
    stop_pct: float                  # négatif, figé à l'entrée
    trail_pct: float | None          # verrouillé (jamais desserré)
    emergency: str | None = None     # motif de sécurité (ex. liquidité effondrée)
    copytop_exit: bool = False       # distribution validée par la cohorte
    copytop_disengaged: bool = False  # still_in sous le minimum (donnée vérifiée)


def _drawdown_from_peak(pnl: float, peak: float) -> float:
    return ((1 + pnl / 100) / (1 + peak / 100) - 1) * 100


def decide(r: ExitRules, c: ExitContext) -> Decision | None:
    if c.pnl_pct is None:
        return Decision("SELL_ALL", "NO_EXIT_ROUTE")
    if c.emergency:
        return Decision("SELL_ALL", f"EMERGENCY_{c.emergency}")
    pnl, peak = c.pnl_pct, max(c.peak_pnl_pct, c.pnl_pct)

    # 2. stop-loss (avant TP1 ; après TP1, le plancher prend le relais)
    if not c.tp1_done and pnl <= c.stop_pct:
        return Decision("SELL_ALL", "STOP_LOSS")

    # 3. copy.top
    trail = c.trail_pct
    if c.copytop_exit:
        return Decision("SELL_ALL", "COPYTOP_DISTRIBUTION")
    if c.copytop_disengaged:
        if pnl < r.copytop_profit_guard_pct:
            return Decision("SELL_ALL", "COPYTOP_DISENGAGEMENT")
        trail = lock_trail(trail, r.copytop_tight_trail_pct)
        if _drawdown_from_peak(pnl, peak) <= -trail:
            return Decision("SELL_ALL", "COPYTOP_TIGHT_TRAIL")

    # 4. take-profit / TP1 / suiveur
    if c.tp1_done:
        floor = r.post_tp1_floor_pct if r.breakeven_after_tp1 else c.stop_pct
        if pnl <= floor:
            return Decision("SELL_ALL", "POST_TP1_FLOOR")
        if trail and _drawdown_from_peak(pnl, peak) <= -trail:
            return Decision("SELL_ALL", "TRAILING_STOP")
        if pnl >= r.take_profit_pct:
            return Decision("SELL_ALL", "TAKE_PROFIT")
    else:
        if pnl >= r.take_profit_pct:
            return Decision("SELL_ALL", "TAKE_PROFIT")
        if r.tp1_pct is not None and 0 < r.tp1_fraction < 1 and pnl >= r.tp1_pct:
            return Decision("SELL_PARTIAL", "TP1", r.tp1_fraction)

    # 5. stagnation
    if (not c.tp1_done and c.held_minutes >= r.stagnation_min
            and peak < r.stagnation_min_peak_pct and pnl < r.stagnation_current_max_pct):
        return Decision("SELL_ALL", "STAGNATION")

    # 6. durée maximale
    if c.held_minutes >= r.max_hold_minutes:
        return Decision("SELL_ALL", "TIME_STOP")
    return None


def decide_legacy(r: ExitRules, pnl_pct: float | None, peak_pnl_pct: float, held_minutes: float,
                  tp1_done: bool) -> Decision | None:
    """Logique antérieure (inchangée), réservée au mode LIVE existant."""
    if pnl_pct is None:
        return Decision("SELL_ALL", "NO_EXIT_ROUTE")
    stop = max(r.stop_loss_pct, 0.0) if (tp1_done and r.breakeven_after_tp1) else r.stop_loss_pct
    if pnl_pct <= stop:
        return Decision("SELL_ALL", "BREAKEVEN_STOP" if stop >= 0 > r.stop_loss_pct else "STOP_LOSS")
    if (r.trailing_stop_pct and r.trail_activation_pct is not None
            and peak_pnl_pct >= r.trail_activation_pct):
        if _drawdown_from_peak(pnl_pct, peak_pnl_pct) <= -r.trailing_stop_pct:
            return Decision("SELL_ALL", "TRAILING_STOP")
    if pnl_pct >= r.take_profit_pct:
        return Decision("SELL_ALL", "TAKE_PROFIT")
    if not tp1_done and r.tp1_pct is not None and 0 < r.tp1_fraction < 1 and pnl_pct >= r.tp1_pct:
        return Decision("SELL_PARTIAL", "TP1", r.tp1_fraction)
    if held_minutes >= r.max_hold_minutes:
        return Decision("SELL_ALL", "TIME_STOP")
    return None
