"""Règles d'entrée « momentum », appliquées APRÈS les filtres de sécurité.

Elles ne servent pas à la sécurité (déjà assurée) mais à la rentabilité : éviter les
paires trop jeunes (zone des snipers/bundlers), les jetons déjà paraboliques (on achète
le sommet), ceux que tout le monde vend, et ceux sans activité réelle.
Une métrique inconnue bloque l'entrée (fail-closed).
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class EntryRules:
    min_pair_age_min: float = 30.0
    max_pair_age_min: float = 7 * 24 * 60
    min_price_change_h1: float = -20.0
    max_price_change_h1: float = 300.0
    min_buy_sell_ratio_h1: float = 1.0
    min_txns_h1: int = 30
    min_volume_liquidity_ratio_h1: float = 0.0


FEATURES = ("pair_age_min", "price_change_h1", "buys_h1", "sells_h1", "volume_h1_usd", "liquidity_usd")


def evaluate_entry(f: dict, r: EntryRules) -> tuple[bool, list[str]]:
    flags: list[str] = []
    missing = [k for k in FEATURES if f.get(k) is None]
    if missing:
        return False, [f"UNKNOWN_{k.upper()}" for k in missing]

    age, ch = f["pair_age_min"], f["price_change_h1"]
    buys, sells = f["buys_h1"], f["sells_h1"]
    if age < r.min_pair_age_min:
        flags.append(f"PAIR_TOO_YOUNG({age:.0f}min)")
    if age > r.max_pair_age_min:
        flags.append(f"PAIR_TOO_OLD({age / 1440:.1f}j)")
    if ch < r.min_price_change_h1:
        flags.append(f"DUMPING({ch:+.0f}%/h)")
    if ch > r.max_price_change_h1:
        flags.append(f"PARABOLIC({ch:+.0f}%/h)")
    if buys + sells < r.min_txns_h1:
        flags.append(f"LOW_ACTIVITY({buys + sells}tx/h)")
    ratio = buys / sells if sells else float("inf") if buys else 0.0
    if ratio < r.min_buy_sell_ratio_h1:
        flags.append(f"SELL_PRESSURE({ratio:.2f})")
    liq = f["liquidity_usd"] or 0
    vol_ratio = f["volume_h1_usd"] / liq if liq else 0.0
    if vol_ratio < r.min_volume_liquidity_ratio_h1:
        flags.append(f"LOW_VOLUME({vol_ratio:.2f})")
    return (not flags), flags
