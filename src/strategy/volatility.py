"""Volatilité pour les sorties adaptatives : ATR véritable (True Range sur bougies OHLCV).

Source prioritaire : bougies GeckoTerminal (contrat vérifié : `ohlcv_list` = [ts, o, h, l, c, v],
du plus récent au plus ancien). Les bougies sont triées, dédoublonnées et validées ; un jeu
insuffisant ou aberrant ne produit AUCUNE valeur (jamais une fausse mesure).

Le proxy `DEX_M5_PROXY` (|variation de prix sur 5 min|) n'est PAS un ATR : il n'est utilisé que
s'il est explicitement autorisé, et il est toujours étiqueté comme tel.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

ATR_SOURCE = "OHLCV_ATR"
PROXY_SOURCE = "DEX_M5_PROXY"
MAX_BAR_RANGE_PCT = 300.0   # une bougie dont le range dépasse 300 % du prix est jugée aberrante


@dataclass(frozen=True)
class Volatility:
    pct: float          # en % du prix
    source: str         # OHLCV_ATR | DEX_M5_PROXY
    bars: int = 0


def clean_candles(raw) -> list[tuple[float, float, float, float, float]] | None:
    """-> [(ts, o, h, l, c)] croissant et valide, ou None si le jeu est inexploitable."""
    if not isinstance(raw, list):
        return None
    out: dict[float, tuple] = {}
    for row in raw:
        if not isinstance(row, (list, tuple)) or len(row) < 5:
            return None
        try:
            ts, o, h, low, c = (float(x) for x in row[:5])
        except (TypeError, ValueError):
            return None
        if not all(math.isfinite(x) for x in (ts, o, h, low, c)):
            return None
        if min(o, h, low, c) <= 0 or h < max(o, c) or low > min(o, c):
            return None   # OHLC incohérent : tout le jeu est rejeté (pas de tri sélectif)
        if (h - low) / c * 100 > MAX_BAR_RANGE_PCT:
            return None
        out[ts] = (ts, o, h, low, c)
    return [out[k] for k in sorted(out)]


def atr_pct(candles, period: int = 14) -> Volatility | None:
    """ATR de Wilder normalisé par le dernier prix de clôture. None si moins de period+1 bougies."""
    bars = clean_candles(candles)
    if bars is None or period < 1 or len(bars) < period + 1:
        return None
    trs = []
    for prev, cur in zip(bars, bars[1:]):
        _, _, h, low, _ = cur
        pc = prev[4]
        trs.append(max(h - low, abs(h - pc), abs(low - pc)))
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period
    last_close = bars[-1][4]
    pct = atr / last_close * 100
    return Volatility(pct, ATR_SOURCE, len(bars)) if math.isfinite(pct) and pct > 0 else None


def m5_proxy(price_change_m5) -> Volatility | None:
    try:
        x = abs(float(price_change_m5))
    except (TypeError, ValueError):
        return None
    return Volatility(x, PROXY_SOURCE) if math.isfinite(x) and x > 0 else None


def candles_from_points(points: list[tuple[float, float]], bar_s: float = 300.0):
    """Bougies OHLC reconstruites à partir de prix échantillonnés (backtest). Approximation :
    le vrai plus haut/bas intra-bougie peut être manqué ; étiquetée comme telle par l'appelant."""
    bars: dict[int, list[float]] = {}
    order: list[int] = []
    for ts, p in points:
        if not p or p <= 0:
            continue
        k = int(ts // bar_s)
        if k not in bars:
            bars[k] = [k * bar_s, p, p, p, p]
            order.append(k)
        else:
            b = bars[k]
            b[2], b[3], b[4] = max(b[2], p), min(b[3], p), p
    return [bars[k] for k in order]
