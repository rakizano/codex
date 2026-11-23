"""Règles d'entrée, appliquées APRÈS les filtres de sécurité (qui restent l'unique autorité anti-rug).

Elles ne servent qu'à la sélection : n'entrer que si plusieurs signaux de marché indépendants
confirment une dynamique réelle (vélocité sur 5 min, accélération du volume, pression acheteuse
plausible, structure liquidité/capitalisation saine), jamais parce qu'un jeton est « populaire ».
Toute donnée indispensable manquante bloque l'entrée (fail-closed), avec un motif explicite.

Politique d'âge des paires (centralisée, deux profils documentés) :
  - STRICT (défaut) : âge minimum 30 min pour toutes les sources, et >= 30 transactions sur 1 h ;
  - PAPER_FAST (expérimental, à activer explicitement) : 3 min pour copy.top/smart, 10 min pour scan.
Les deux profils ne se mélangent jamais ; la comparaison se fait via le Shadow Ledger et les
statistiques par moteur.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

STRICT, PAPER_FAST = "STRICT", "PAPER_FAST"
# DEX AMM sur lesquels un jeton Pump.fun est considéré comme migré (contrat DexScreener vérifié).
MIGRATED_DEXES = frozenset({"pumpswap", "raydium", "meteora"})
BONDING_CURVE_DEXES = frozenset({"pumpfun"})


@dataclass(frozen=True)
class EntryRules:
    # Âge des paires
    pair_age_policy: str = STRICT
    min_pair_age_strict_min: float = 30.0
    min_pair_age_scan_min: float = 10.0      # PAPER_FAST uniquement
    min_pair_age_signal_min: float = 3.0     # PAPER_FAST uniquement (copytop / smart)
    max_pair_age_min: float = 7 * 24 * 60
    min_txns_h1: int = 30                    # STRICT uniquement
    # Vélocité (5 min) et structure
    min_txns_m5: int = 20
    min_vol_m5_usd: float = 2_500.0
    min_buy_sell_ratio_m5: float = 1.15
    max_buy_sell_ratio_m5: float = 6.5       # au-delà : activité probablement artificielle
    min_vol_accel_m5_h1: float = 1.3         # (volume_m5 * 12) / volume_h1
    min_liq_mcap_ratio: float = 0.08
    max_liq_mcap_ratio: float = 0.70
    min_price_change_h1: float = -15.0
    max_price_change_h1: float = 250.0
    min_liquidity_usd: float = 15_000.0      # rappel de la sécurité (jamais plus bas)


# Champs indispensables (enregistrés dans les observations pour le backtest)
FEATURES = ("pair_age_min", "dex_id", "liquidity_usd", "mcap_usd", "buys_m5", "sells_m5",
            "buys_h1", "sells_h1", "volume_m5_usd", "volume_h1_usd", "price_change_h1")

# Motifs de rejet « sélection » (jamais « sécurité ») : seuls ceux-ci alimentent le Shadow Ledger.
SELECTION_REJECT_PREFIXES = (
    "PAIR_TOO_YOUNG", "PAIR_TOO_OLD", "LOW_H1_ACTIVITY", "LOW_M5_ACTIVITY", "LOW_M5_VOLUME_USD",
    "WEAK_M5_BUY_PRESSURE", "SUSPECT_WASH_OR_BOT_RATIO", "DECELERATING_VOLUME", "DUMPING_H1",
    "PARABOLIC_H1", "ABNORMAL_LIQ_MCAP_RATIO",
)


def _num(v) -> float | None:
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return x if math.isfinite(x) else None


def min_pair_age(r: EntryRules, source: str) -> float:
    if r.pair_age_policy == PAPER_FAST:
        return r.min_pair_age_signal_min if source in ("copytop", "smart") else r.min_pair_age_scan_min
    return r.min_pair_age_strict_min


def evaluate_entry(f: dict, r: EntryRules, source: str = "scan") -> tuple[bool, list[str]]:
    """-> (ok, motifs). `f` : observations normalisées d'un jeton ayant passé la sécurité."""
    dex = f.get("dex_id")
    if isinstance(dex, str) and dex.lower() in BONDING_CURVE_DEXES:
        return False, ["STILL_ON_BONDING_CURVE"]

    v = {k: _num(f.get(k)) for k in FEATURES if k != "dex_id"}
    unknown = [f"UNKNOWN_{k.upper()}" for k, x in v.items() if x is None]
    if f.get("pair_age_min") is None:
        unknown = ["UNKNOWN_PAIR_AGE"] + [u for u in unknown if u != "UNKNOWN_PAIR_AGE_MIN"]
    if unknown:
        return False, unknown

    flags: list[str] = []
    age = v["pair_age_min"]
    need_age = min_pair_age(r, source)
    if age < need_age:
        flags.append(f"PAIR_TOO_YOUNG({age:.0f}<{need_age:.0f}min)")
    if age > r.max_pair_age_min:
        flags.append(f"PAIR_TOO_OLD({age / 1440:.1f}j)")

    if r.pair_age_policy != PAPER_FAST and v["buys_h1"] + v["sells_h1"] < r.min_txns_h1:
        flags.append(f"LOW_H1_ACTIVITY({v['buys_h1'] + v['sells_h1']:.0f}tx)")

    liq, mcap = v["liquidity_usd"], v["mcap_usd"]
    if liq < max(r.min_liquidity_usd, 15_000.0):
        flags.append("LOW_LIQUIDITY")  # la sécurité l'a déjà vérifié : défense en profondeur
    if mcap <= 0:
        flags.append("ABNORMAL_LIQ_MCAP_RATIO(mcap<=0)")
    else:
        ratio = liq / mcap
        if not r.min_liq_mcap_ratio <= ratio <= r.max_liq_mcap_ratio:
            flags.append(f"ABNORMAL_LIQ_MCAP_RATIO({ratio:.2f})")

    tx_m5 = v["buys_m5"] + v["sells_m5"]
    if tx_m5 < r.min_txns_m5:
        flags.append(f"LOW_M5_ACTIVITY({tx_m5:.0f}tx)")
    if v["volume_m5_usd"] < r.min_vol_m5_usd:
        flags.append(f"LOW_M5_VOLUME_USD({v['volume_m5_usd']:.0f})")

    bs = v["buys_m5"] / max(v["sells_m5"], 1.0)
    if bs < r.min_buy_sell_ratio_m5:
        flags.append(f"WEAK_M5_BUY_PRESSURE({bs:.2f})")
    elif bs > r.max_buy_sell_ratio_m5:
        flags.append(f"SUSPECT_WASH_OR_BOT_RATIO({bs:.2f})")

    vol_h1 = v["volume_h1_usd"]
    if vol_h1 <= 0:
        flags.append("DECELERATING_VOLUME(volume_h1<=0)")  # pas de contournement : refus
    else:
        accel = v["volume_m5_usd"] * 12 / vol_h1
        if accel < r.min_vol_accel_m5_h1:
            flags.append(f"DECELERATING_VOLUME({accel:.2f})")

    ch = v["price_change_h1"]
    if ch < r.min_price_change_h1:
        flags.append(f"DUMPING_H1({ch:+.0f}%)")
    if ch > r.max_price_change_h1:
        flags.append(f"PARABOLIC_H1({ch:+.0f}%)")
    return (not flags), flags


def is_selection_only_rejection(flags: list[str]) -> bool:
    """Vrai si TOUS les motifs sont des motifs de sélection (âge, activité, vélocité, momentum)."""
    return bool(flags) and all(f.startswith(SELECTION_REJECT_PREFIXES) for f in flags)
