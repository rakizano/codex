"""Clients HTTP en lecture seule (stdlib) vers des APIs gratuites + normalisation.

Aucun endpoint de signature ou d'envoi n'est appelé : Jupiter n'est interrogé
que sur /quote. Les champs absents restent None (=> rejet fail-closed).
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

from .filters import Metrics

SOL_MINT = "So11111111111111111111111111111111111111112"
LAMPORTS = 1_000_000_000
UA = "memecoin-audit/0.1 (paper-trading)"

DEXSCREENER = "https://api.dexscreener.com/tokens/v1/solana/{mint}"
RUGCHECK = "https://api.rugcheck.xyz/v1/tokens/{mint}/report"
GECKO = "https://api.geckoterminal.com/api/v2/networks/solana/tokens/{mint}"
JUP_QUOTE = "https://lite-api.jup.ag/swap/v1/quote"


def get_json(url: str, retries: int = 3, timeout: float = 15.0):
    """GET avec backoff exponentiel sur 429/5xx. Retourne None en cas d'échec."""
    delay = 1.0
    for _ in range(retries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 or e.code >= 500:
                time.sleep(delay)
                delay *= 2
                continue
            return None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            time.sleep(delay)
            delay *= 2
    return None


def jup_quote(input_mint: str, output_mint: str, amount: int, slippage_bps: int = 300):
    q = urllib.parse.urlencode({
        "inputMint": input_mint, "outputMint": output_mint,
        "amount": str(amount), "slippageBps": str(slippage_bps),
    })
    return get_json(f"{JUP_QUOTE}?{q}")


def _f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def fetch_all(mint: str, size_sol: float = 0.5) -> dict:
    raw = {
        "dexscreener": get_json(DEXSCREENER.format(mint=mint)),
        "rugcheck": get_json(RUGCHECK.format(mint=mint)),
        "geckoterminal": get_json(GECKO.format(mint=mint)),
    }
    lamports = int(size_sol * LAMPORTS)
    buy = jup_quote(SOL_MINT, mint, lamports)
    sell = None
    if buy and buy.get("outAmount"):
        sell = jup_quote(mint, SOL_MINT, int(buy["outAmount"]))
    raw["jupiter_buy"], raw["jupiter_sell"] = buy, sell
    raw["size_lamports"] = lamports
    return raw


def normalize(raw: dict) -> tuple[Metrics, dict, dict]:
    """-> (metrics, observations numériques, métadonnées NON FIABLES)."""
    m = Metrics()
    obs: dict = {}
    untrusted: dict = {}

    pairs = raw.get("dexscreener") or []
    if isinstance(pairs, dict):
        pairs = pairs.get("pairs") or []
    if pairs:
        best = max(pairs, key=lambda p: _f((p.get("liquidity") or {}).get("usd")) or 0)
        m.liquidity_usd = _f((best.get("liquidity") or {}).get("usd"))
        tx = (best.get("txns") or {}).get("h24") or {}
        obs.update({
            "dex": best.get("dexId"),
            "pair_created_at_ms": best.get("pairCreatedAt"),
            "volume_h24_usd": _f((best.get("volume") or {}).get("h24")),
            "buys_h24": tx.get("buys"), "sells_h24": tx.get("sells"),
            "price_usd": _f(best.get("priceUsd")),
            "fdv_usd": _f(best.get("fdv")),
        })
        # Caractéristiques de momentum (règles d'entrée + backtest)
        tx_h1 = (best.get("txns") or {}).get("h1") or {}
        tx_m5 = (best.get("txns") or {}).get("m5") or {}
        changes = best.get("priceChange") or {}
        mcap = _f(best.get("marketCap"))
        obs.update({
            "dex_id": best.get("dexId") if isinstance(best.get("dexId"), str) else None,
            "pair_address": best.get("pairAddress") if isinstance(best.get("pairAddress"), str) else None,
            # marketCap peut être null (contrat vérifié) : repli explicite sur la FDV, tracé.
            "mcap_usd": mcap if mcap is not None else _f(best.get("fdv")),
            "mcap_source": "marketCap" if mcap is not None else ("fdv" if _f(best.get("fdv")) is not None else None),
            "buys_m5": tx_m5.get("buys"), "sells_m5": tx_m5.get("sells"),
            "volume_m5_usd": _f((best.get("volume") or {}).get("m5")),
            "liquidity_usd": m.liquidity_usd,
            "price_change_m5": _f(changes.get("m5")),
            "price_change_h1": _f(changes.get("h1")),
            "price_change_h6": _f(changes.get("h6")),
            "buys_h1": tx_h1.get("buys"), "sells_h1": tx_h1.get("sells"),
            "volume_h1_usd": _f((best.get("volume") or {}).get("h1")),
        })
        base = best.get("baseToken") or {}
        untrusted.update({"name": base.get("name"), "symbol": base.get("symbol")})
        info = best.get("info") or {}
        # Métadonnées structurelles (types de liens, compteur de boosts) : utilisables comme signaux.
        link_types = {str(s.get("type", "")).lower() for s in info.get("socials") or [] if isinstance(s, dict)}
        if info.get("websites"):
            link_types.add("website")
        obs["social_link_types"] = sorted(t for t in link_types if t)
        obs["x_link_is_post"] = any("/status/" in str(s.get("url", "")) for s in info.get("socials") or []
                                    if isinstance(s, dict) and str(s.get("type", "")).lower() == "twitter")
        obs["dexscreener_boosts_active"] = int(_f((best.get("boosts") or {}).get("active")) or 0)
        untrusted["websites"] = " ".join(str(w.get("url")) for w in info.get("websites") or [])
        untrusted["socials"] = " ".join(str(s.get("url")) for s in info.get("socials") or [])

    rc = raw.get("rugcheck")
    if isinstance(rc, dict) and rc:
        if "mintAuthority" in rc:
            m.mint_authority_revoked = rc.get("mintAuthority") in (None, "")
        if "freezeAuthority" in rc:
            m.freeze_authority_revoked = rc.get("freezeAuthority") in (None, "")
        markets = [mk for mk in rc.get("markets") or [] if isinstance(mk, dict)]
        # Concentration réelle : seuls les comptes techniques CONFIRMÉS sont exclus ; ambiguïté => None.
        from filters.holders import compute_real_top10_pct
        top10, details = compute_real_top10_pct(rc)
        m.top10_holders_pct = top10
        obs["top10_details"] = details
        if isinstance(rc.get("topHolders"), list):
            obs["insider_holders_in_top10"] = sum(1 for h in rc["topHolders"][:10]
                                                  if isinstance(h, dict) and h.get("insider"))
        obs["creator"] = rc.get("creator") if isinstance(rc.get("creator"), str) else None

        # Verrouillage LP pondéré par la liquidité USD de chaque pool (les pools à
        # liquidité concentrée — Orca, DLMM — comptent comme non verrouillés).
        total_usd = locked_usd = 0.0
        for mk in markets:
            lp = mk.get("lp") or {}
            usd = (_f(lp.get("baseUSD")) or 0) + (_f(lp.get("quoteUSD")) or 0)
            pct = _f(lp.get("lpLockedPct"))
            if usd <= 0 or pct is None:
                continue
            total_usd += usd
            locked_usd += usd * min(max(pct, 0), 100) / 100
        if total_usd > 0:
            m.lp_locked_pct = 100 * locked_usd / total_usd
        obs["rugcheck_total_liquidity_usd"] = _f(rc.get("totalMarketLiquidity"))
        obs["rugcheck_markets"] = len(markets)

        if rc.get("rugged") is True:
            m.extra_flags.append("RUGCHECK_RUGGED")
        fee = rc.get("transferFee")
        if isinstance(fee, dict) and (_f(fee.get("pct")) or 0) > 0:
            m.extra_flags.append(f"TRANSFER_FEE({_f(fee.get('pct'))}%)")
        if (_f(rc.get("graphInsidersDetected")) or 0) > 0:
            obs["insider_network_size"] = rc.get("graphInsidersDetected")

        risks = [r for r in rc.get("risks") or [] if isinstance(r, dict)]
        obs["rugcheck_score_normalised"] = rc.get("score_normalised")
        obs["rugcheck_risks"] = [f"{r.get('level')}:{r.get('name')}" for r in risks][:10]
        for r in risks:
            if str(r.get("level", "")).lower() == "danger":
                m.extra_flags.append("RUGCHECK_DANGER")
                break
        meta = rc.get("tokenMeta") or {}
        untrusted.setdefault("name", meta.get("name"))
        untrusted.setdefault("symbol", meta.get("symbol"))
        untrusted["uri"] = meta.get("uri")

    gk = raw.get("geckoterminal")
    if isinstance(gk, dict):
        attrs = (gk.get("data") or {}).get("attributes") or {}
        obs["gecko_total_reserve_usd"] = _f(attrs.get("total_reserve_in_usd"))
        obs["gecko_price_usd"] = _f(attrs.get("price_usd"))

    buy, sell = raw.get("jupiter_buy"), raw.get("jupiter_sell")
    if isinstance(buy, dict) and buy.get("outAmount"):
        pi = _f(buy.get("priceImpactPct"))
        m.buy_price_impact_pct = None if pi is None else pi * 100  # Jupiter renvoie une fraction
    if isinstance(sell, dict) and sell.get("outAmount"):
        m.sell_quote_ok = True
        back = _f(sell["outAmount"]) or 0
        size = raw.get("size_lamports") or 1
        m.roundtrip_loss_pct = max(0.0, (1 - back / size) * 100)
        obs["roundtrip_sol_back"] = back / LAMPORTS
    else:
        m.sell_quote_ok = False

    return m, obs, untrusted
