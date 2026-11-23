"""Collecte de données, backtest et optimisation des réglages (walk-forward).

Le bot enregistre :
  - `observations` : chaque jeton qui a passé les filtres de SÉCURITÉ, avec ses
    caractéristiques d'entrée (âge, momentum, activité), son prix et son coût estimé ;
  - `snapshots` : le prix et la liquidité de ces jetons toutes les minutes pendant 24 h.

Le backtest rejoue les règles d'entrée/sortie sur ces trajectoires réelles. L'optimiseur
essaie des combinaisons sur les 70 % les plus anciens (train), puis mesure le meilleur
sur les 30 % les plus récents (test). Une zone de purge égale à la durée maximale de détention
retire du train les observations trop proches de la frontière temporelle. Il faut au moins
30 trades OOS et un profit factor >= 1,2 pour afficher un verdict positif ; ce n'est toujours
pas une preuve de rentabilité ni un feu vert LIVE.

Limites : prix DexScreener (pas un devis exécutable), pas de MEV ; coûts modélisés par
frais + pourboires + impact prix mesuré. Les stops sont exécutés au prix du snapshot
suivant, ce qui reproduit les glissements sur chute brutale à la minute près.
"""
from __future__ import annotations

import itertools
import json
import sqlite3
import time
from dataclasses import asdict, dataclass, replace
from pathlib import Path

from .entry import EntryRules, evaluate_entry
from .exit import ExitRules, decide

SCHEMA = """
CREATE TABLE IF NOT EXISTS observations (
  ts REAL NOT NULL, mint TEXT NOT NULL, price_usd REAL, cost_pct REAL, features TEXT
);
CREATE INDEX IF NOT EXISTS obs_mint ON observations(mint, ts);
CREATE TABLE IF NOT EXISTS snapshots (
  ts REAL NOT NULL, mint TEXT NOT NULL, price_usd REAL, liquidity_usd REAL
);
CREATE INDEX IF NOT EXISTS snap_mint ON snapshots(mint, ts);
"""
RUG_LIQUIDITY_USD = 1_000.0  # en dessous : sortie impossible, perte totale


class DataStore:
    def __init__(self, db_path: str | Path = ":memory:", clock=time.time):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        self.clock = clock

    def record_observation(self, mint: str, price_usd: float | None, cost_pct: float, features: dict) -> None:
        self.db.execute("INSERT INTO observations VALUES (?,?,?,?,?)",
                        (self.clock(), mint, price_usd, cost_pct, json.dumps(features)))
        self.db.commit()

    def record_snapshots(self, rows: list[tuple[str, float | None, float | None]]) -> None:
        now = self.clock()
        self.db.executemany("INSERT INTO snapshots VALUES (?,?,?,?)", [(now, m, p, l) for m, p, l in rows])
        self.db.commit()

    def tracked_mints(self, window_h: float = 24.0, limit: int = 300) -> list[str]:
        since = self.clock() - window_h * 3600
        rows = self.db.execute("SELECT mint FROM observations WHERE ts>=? GROUP BY mint ORDER BY MIN(ts) DESC LIMIT ?",
                               (since, limit)).fetchall()
        return [r[0] for r in rows]

    def stats(self) -> dict:
        n_obs = self.db.execute("SELECT COUNT(DISTINCT mint) FROM observations").fetchone()[0]
        n_snap = self.db.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        return {"tokens_observed": n_obs, "snapshots": n_snap}

    def load_paths(self) -> list["TokenPath"]:
        paths = []
        for mint, ts, price, cost, feats in self.db.execute(
                "SELECT mint, MIN(ts), price_usd, cost_pct, features FROM observations GROUP BY mint ORDER BY MIN(ts)"):
            if not price:
                continue
            snaps = self.db.execute("SELECT ts, price_usd, liquidity_usd FROM snapshots WHERE mint=? AND ts>? "
                                    "ORDER BY ts", (mint, ts)).fetchall()
            snaps = [s for s in snaps if s[1]]
            if snaps:
                paths.append(TokenPath(mint, ts, price, cost or 0.0, json.loads(feats or "{}"), snaps))
        return paths

    def close(self) -> None:
        self.db.close()


@dataclass
class TokenPath:
    mint: str
    t0: float
    p0: float
    cost_pct: float
    features: dict
    snaps: list[tuple[float, float, float | None]]


@dataclass
class TradeResult:
    mint: str
    pnl_pct: float
    reason: str


def simulate(path: TokenPath, r: ExitRules) -> TradeResult:
    remaining, realized, peak, tp1_done = 1.0, 0.0, 0.0, False
    haircut = 1 - path.cost_pct / 100
    pnl = 0.0
    for ts, price, liq in path.snaps:
        if liq is not None and liq < RUG_LIQUIDITY_USD:
            return TradeResult(path.mint, (realized - 1) * 100, "RUGGED")
        pnl = (price / path.p0 * haircut - 1) * 100
        peak = max(peak, pnl)
        d = decide(r, pnl, peak, (ts - path.t0) / 60, tp1_done)
        if d is None:
            continue
        if d.action == "SELL_PARTIAL":
            realized += remaining * d.fraction * (1 + pnl / 100)
            remaining *= 1 - d.fraction
            tp1_done = True
            continue
        return TradeResult(path.mint, (realized + remaining * (1 + pnl / 100) - 1) * 100, d.reason)
    return TradeResult(path.mint, (realized + remaining * (1 + pnl / 100) - 1) * 100, "OPEN_AT_END")


def metrics(results: list[TradeResult]) -> dict:
    n = len(results)
    if not n:
        return {"trades": 0, "total_return_pct": 0.0, "avg_pnl_pct": None, "win_rate_pct": None,
                "profit_factor": None, "max_drawdown_pct": 0.0}
    pnls = [t.pnl_pct for t in results]
    gains, losses = sum(p for p in pnls if p > 0), -sum(p for p in pnls if p <= 0)
    equity, peak, mdd = 0.0, 0.0, 0.0
    for p in pnls:  # équité en « mises » de taille égale
        equity += p
        peak = max(peak, equity)
        mdd = min(mdd, equity - peak)
    return {
        "trades": n,
        "total_return_pct": round(sum(pnls), 1),        # somme des % : gain en multiples de la mise / 100
        "avg_pnl_pct": round(sum(pnls) / n, 2),
        "win_rate_pct": round(100 * sum(p > 0 for p in pnls) / n, 1),
        "profit_factor": round(gains / losses, 2) if losses else None,
        "max_drawdown_pct": round(mdd, 1),
    }


def backtest(paths: list[TokenPath], entry: EntryRules, exit_: ExitRules) -> tuple[dict, list[TradeResult]]:
    trades = [simulate(p, exit_) for p in paths if evaluate_entry(p.features, entry)[0]]
    return metrics(trades), trades


# --- optimisation ---------------------------------------------------------------------

EXIT_GRID = {
    "stop_loss_pct": [-15.0, -25.0, -40.0],
    "tp1_pct": [None, 30.0, 60.0],
    "trailing_stop_pct": [None, 15.0, 30.0],
    "take_profit_pct": [100.0, 300.0, 1000.0],
    "max_hold_minutes": [60.0, 240.0, 720.0],
}
ENTRY_GRID = {
    "min_pair_age_min": [0.0, 30.0, 120.0],
    "max_price_change_h1": [100.0, 300.0, 1e9],
    "min_buy_sell_ratio_h1": [0.8, 1.0, 1.3],
}


def _exit_combos(base: ExitRules):
    keys = list(EXIT_GRID)
    for values in itertools.product(*EXIT_GRID.values()):
        kw = dict(zip(keys, values))
        # le stop suiveur s'active au TP1 s'il existe, sinon à +30 %
        kw["trail_activation_pct"] = kw["tp1_pct"] if kw["tp1_pct"] is not None else 30.0
        yield replace(base, **kw)


def _entry_combos(base: EntryRules):
    keys = list(ENTRY_GRID)
    for values in itertools.product(*ENTRY_GRID.values()):
        yield replace(base, **dict(zip(keys, values)))


def optimize(paths: list[TokenPath], base_entry: EntryRules, base_exit: ExitRules,
             train_frac: float = 0.7, min_train_trades: int = 30,
             min_test_trades: int = 30) -> dict:
    paths = sorted(paths, key=lambda p: p.t0)
    cut = int(len(paths) * train_frac)
    raw_train, test = paths[:cut], paths[cut:]

    # Purge : aucune trajectoire train ne doit pouvoir rester ouverte après le début du test.
    purge_seconds = max(EXIT_GRID["max_hold_minutes"]) * 60
    test_start = test[0].t0 if test else float("inf")
    train = [p for p in raw_train if p.t0 + purge_seconds <= test_start]
    purged = len(raw_train) - len(train)

    exits = list(_exit_combos(base_exit))
    entries = list(_entry_combos(base_entry))

    # Pré-calcul sur le train uniquement. Le test n'intervient jamais dans la sélection.
    train_results = [[simulate(p, rule) for p in train] for rule in exits]
    train_masks = [[evaluate_entry(p.features, rule)[0] for p in train] for rule in entries]

    best = None
    for ei, entry_mask in enumerate(train_masks):
        for xi, row in enumerate(train_results):
            selected = [result for result, accepted in zip(row, entry_mask) if accepted]
            if len(selected) < min_train_trades:
                continue
            m = metrics(selected)
            if m["avg_pnl_pct"] is None:
                continue
            # Espérance moyenne pénalisée par le drawdown, pour ne pas optimiser le seul PnL cumulé.
            score = m["avg_pnl_pct"] - abs(min(0.0, m["max_drawdown_pct"])) / (len(selected) ** 0.5)
            if best is None or score > best[0]:
                best = (score, ei, xi)

    baseline_train, _ = backtest(train, base_entry, base_exit)
    baseline_test, _ = backtest(test, base_entry, base_exit)
    out = {
        "tokens": len(paths),
        "raw_train_tokens": len(raw_train),
        "train_tokens": len(train),
        "purged_train_tokens": purged,
        "test_tokens": len(test),
        "purge_minutes": purge_seconds / 60,
        "min_train_trades": min_train_trades,
        "min_test_trades": min_test_trades,
        "combinations_tested": len(exits) * len(entries),
        "current_settings": {"train": baseline_train, "test": baseline_test},
    }
    if best is None:
        out["status"] = f"PAS_ASSEZ_DE_DONNEES_TRAIN ({min_train_trades} trades requis)"
        return out

    _, ei, xi = best
    b_entry, b_exit = entries[ei], exits[xi]
    tr, _ = backtest(train, b_entry, b_exit)
    te, _ = backtest(test, b_entry, b_exit)
    if te["trades"] < min_test_trades:
        status = f"PAS_ASSEZ_DE_DONNEES_TEST ({te['trades']}/{min_test_trades} trades)"
    else:
        pf = te["profit_factor"]
        pf_ok = pf is None or pf >= 1.2
        train_positive = (tr["avg_pnl_pct"] is not None and tr["avg_pnl_pct"] > 0)
        test_positive = (te["avg_pnl_pct"] is not None and te["avg_pnl_pct"] > 0)
        status = ("RENTABLE_HORS_ECHANTILLON" if train_positive and test_positive and pf_ok
                  else "NON_RENTABLE_HORS_ECHANTILLON — ne passez pas en réel avec ces réglages")
    out.update({
        "best": {"entry": asdict(b_entry), "exit": asdict(b_exit), "train": tr, "test": te},
        "status": status,
        "env": to_env(b_entry, b_exit),
    })
    return out


def to_env(entry: EntryRules, exit_: ExitRules) -> dict:
    def fmt(v):
        return "off" if v is None else (f"{v:g}" if isinstance(v, float) else str(v))
    return {
        "STOP_LOSS_PCT": fmt(exit_.stop_loss_pct), "TAKE_PROFIT_PCT": fmt(exit_.take_profit_pct),
        "TP1_PCT": fmt(exit_.tp1_pct), "TP1_FRACTION": fmt(exit_.tp1_fraction),
        "TRAIL_ACTIVATION_PCT": fmt(exit_.trail_activation_pct), "TRAILING_STOP_PCT": fmt(exit_.trailing_stop_pct),
        "MAX_HOLD_MINUTES": fmt(exit_.max_hold_minutes),
        "MIN_PAIR_AGE_MIN": fmt(entry.min_pair_age_min),
        "MAX_PRICE_CHANGE_H1": fmt(entry.max_price_change_h1 if entry.max_price_change_h1 < 1e8 else None),
        "MIN_BUY_SELL_RATIO_H1": fmt(entry.min_buy_sell_ratio_h1),
    }
