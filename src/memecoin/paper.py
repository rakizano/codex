"""Journal de paper trading (JSONL). Aucune exécution réelle."""
from __future__ import annotations

import json
import time
from pathlib import Path

DEFAULT_LOG = Path("data/paper_trades.jsonl")
FEE_PCT = 1.0  # frais courbe/DEX estimés, appliqués à l'entrée et à la sortie


def log_paper_entry(mint: str, size_sol: float, price_usd: float | None,
                    slippage_pct: float | None, verdict: str, flags: list[str],
                    path: Path = DEFAULT_LOG) -> dict:
    entry = {
        "ts": int(time.time()),
        "mint": mint,
        "verdict": verdict,
        "flags": flags,
        "size_sol": size_sol,
        "ref_price_usd": price_usd,
        "assumed_fee_pct": FEE_PCT,
        "measured_slippage_pct": slippage_pct,
        "status": "OPEN" if verdict == "WATCHLIST_PAPER" else "SKIPPED",
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(entry, ensure_ascii=False) + "\n")
    return entry


def net_pnl_pct(entry_price: float, exit_price: float, slippage_pct: float = 0.0) -> float:
    """PnL net simulé après frais (entrée + sortie) et slippage mesuré."""
    gross = exit_price / entry_price
    cost = (1 - FEE_PCT / 100) ** 2 * (1 - slippage_pct / 100)
    return (gross * cost - 1) * 100
