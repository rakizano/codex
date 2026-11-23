"""Collecte de données, backtest pessimiste et validation Walk-Forward.

Données (SQLite) :
  - `observations` : chaque jeton qui a passé les filtres de SÉCURITÉ, avec ses caractéristiques
    d'entrée (vélocité, âge, structure), son moteur d'origine, sa volatilité mesurée et l'impact prix ;
  - `snapshots` : prix et liquidité de ces jetons toutes les minutes pendant 24 h.

Simulation (aucune fuite du futur) :
  - barre par barre (un snapshot = une barre dont haut = bas = clôture ; de vraies bougies OHLC
    sont aussi acceptées) ; dans une barre, le STOP est évalué au plus bas AVANT que le plus haut
    ne puisse déclencher un TP ; les sorties temporelles sont évaluées à la clôture ;
  - frais (1 %) + pourboire à CHAQUE exécution, ventes partielles comprises ; glissement à chaque vente ;
  - trois scénarios de coûts : base (glissement = impact mesuré), pessimiste (2 x impact, >= 1 %),
    stress (pessimiste + 4 % supplémentaires UNIQUEMENT sur les sorties de stop, sans double comptage
    du multiplicateur) ;
  - une position encore ouverte à la fin des données est CENSURÉE : exclue des trades clôturés.

Validation : grille réduite à 18 profils (multiplicateur ATR x stagnation x fraction TP1), sélection
sur l'entraînement uniquement, Walk-Forward ancré à 4 plis avec purge temporelle de 12 h. Le verdict
RENTABLE_HORS_ECHANTILLON exige >= 70 trades clôturés, 4 plis exploitables, un PnL OOS agrégé positif
(y compris en scénario pessimiste), >= 3 plis positifs, un profit factor OOS >= 1,2 et un drawdown
compatible. Ce n'est jamais un feu vert pour le réel.

Limites : prix DexScreener échantillonnés à la minute (le vrai plus bas intra-minute peut être pire),
sorties copy.top non simulées (pas d'historique des ventes de cohorte), pas de MEV.
"""
from __future__ import annotations

import itertools
import json
import math
import sqlite3
import statistics
import time
from dataclasses import asdict, dataclass, field, replace
from pathlib import Path

from .entry import EntryRules, evaluate_entry
from .exit import ExitContext, ExitRules, decide, stop_pct_for, trail_pct_for
from .volatility import Volatility

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
RUG_LIQUIDITY_USD = 1_000.0      # en dessous : sortie impossible, perte quasi totale
FEE_PCT = 1.0
STOP_REASONS = {"STOP_LOSS", "POST_TP1_FLOOR", "TRAILING_STOP", "COPYTOP_TIGHT_TRAIL"}


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
    snaps: list            # [(ts, price, liq)] ou [(ts, high, low, close, liq)]

    @property
    def source(self) -> str:
        return str(self.features.get("source") or "scan")

    @property
    def impact_pct(self) -> float:
        v = self.features.get("impact_pct")
        try:
            return max(0.0, float(v))
        except (TypeError, ValueError):
            return 1.0          # impact inconnu : hypothèse prudente de 1 %, jamais 0

    @property
    def volatility(self) -> Volatility | None:
        try:
            pct = float(self.features.get("vol_pct"))
        except (TypeError, ValueError):
            return None
        src = self.features.get("vol_source")
        return Volatility(pct, src) if src and math.isfinite(pct) and pct > 0 else None

    def bars(self):
        for s in self.snaps:
            if len(s) == 3:
                ts, p, liq = s
                yield ts, p, p, p, liq
            else:
                yield s


@dataclass(frozen=True)
class CostScenario:
    name: str
    slip_mult: float = 1.0
    slip_floor_pct: float = 0.0
    stop_extra_slip_pct: float = 0.0     # stress : glissement additionnel sur les seules sorties de stop
    size_sol: float = 0.05
    tip_sol: float = 0.0001

    def slip(self, impact_pct: float, reason: str | None = None, base_impact: float | None = None) -> float:
        s = max(self.slip_floor_pct, impact_pct * self.slip_mult)
        if reason in STOP_REASONS and self.stop_extra_slip_pct:
            s = max(s, (base_impact if base_impact is not None else impact_pct) + self.stop_extra_slip_pct)
        return min(s, 99.0)


BASE = CostScenario("base")
PESSIMISTIC = CostScenario("pessimistic", slip_mult=2.0, slip_floor_pct=1.0)
STRESS = CostScenario("stress", slip_mult=2.0, slip_floor_pct=1.0, stop_extra_slip_pct=4.0)
SCENARIOS = (BASE, PESSIMISTIC, STRESS)


@dataclass
class TradeResult:
    mint: str
    source: str
    t_entry: float
    t_exit: float
    pnl_pct: float
    reason: str
    censored: bool = False
    fees_pct: float = 0.0
    slippage_pct: float = 0.0

    @property
    def hold_min(self) -> float:
        return (self.t_exit - self.t_entry) / 60


def simulate(path: TokenPath, r: ExitRules, cost: CostScenario = BASE) -> TradeResult:
    size, tip, fee = cost.size_sol, cost.tip_sol, FEE_PCT / 100
    impact = path.impact_pct
    entry_slip = cost.slip(impact) / 100
    invested = size - size * fee - tip
    tokens = invested / (path.p0 * (1 + entry_slip))
    fees_sol, slip_sol = size * fee + tip, invested * entry_slip / (1 + entry_slip)
    remaining, realized, tp1_done, peak = tokens, 0.0, False, 0.0
    basis = size
    vol = path.volatility
    stop = stop_pct_for(r, vol)
    trail = trail_pct_for(r, vol)

    def sell(qty: float, price: float, reason: str) -> float:
        nonlocal fees_sol, slip_sol
        s = cost.slip(impact, reason, impact) / 100
        gross = qty * price
        after_slip = gross * (1 - s)
        fees = after_slip * fee + tip
        fees_sol += min(fees, after_slip)
        slip_sol += gross - after_slip
        return max(0.0, after_slip - fees)

    def net_pnl(price: float, reason: str | None = None) -> float:
        s = cost.slip(impact, reason, impact) / 100
        v = max(0.0, remaining * price * (1 - s) * (1 - fee) - tip)
        return (v / basis - 1) * 100 if basis > 0 else -100.0

    def finish(t_exit: float, reason: str, censored: bool = False) -> TradeResult:
        return TradeResult(path.mint, path.source, path.t0, t_exit, (realized / size - 1) * 100, reason, censored,
                           100 * fees_sol / size, 100 * slip_sol / size)

    last_ts, last_close = path.t0, path.p0
    for ts, high, low, close, liq in path.bars():
        if ts <= path.t0:
            continue
        held = (ts - path.t0) / 60
        last_ts, last_close = ts, close
        if liq is not None and liq < RUG_LIQUIDITY_USD:
            realized += sell(remaining, low, "EMERGENCY")
            return finish(ts, "RUGGED")
        # 1) plus bas d'abord : stops (pessimiste)
        c_low = ExitContext(net_pnl(low, "STOP_LOSS"), peak, held, tp1_done, stop, trail)
        d = decide(r, c_low)
        if d and d.action == "SELL_ALL" and d.reason in STOP_REASONS | {"NO_EXIT_ROUTE"}:
            realized += sell(remaining, low, d.reason)
            return finish(ts, d.reason)
        # 2) plus haut : mise à jour du pic puis TP1 / TP final
        pnl_high = net_pnl(high)
        peak = max(peak, pnl_high)
        d = decide(r, ExitContext(pnl_high, peak, held, tp1_done, stop, trail))
        if d and d.reason == "TP1":
            realized += sell(remaining * d.fraction, high, "TP1")
            basis *= 1 - d.fraction
            remaining *= 1 - d.fraction
            tp1_done = True
        elif d and d.reason == "TAKE_PROFIT":
            realized += sell(remaining, high, d.reason)
            return finish(ts, d.reason)
        # 3) clôture : sorties temporelles (et stops éventuels à la clôture)
        d = decide(r, ExitContext(net_pnl(close), peak, held, tp1_done, stop, trail))
        if d and d.action == "SELL_ALL":
            realized += sell(remaining, close, d.reason)
            return finish(ts, d.reason)
    # Fin des données : position censurée (valorisée pour information, jamais comptée comme clôturée)
    mark = realized + max(0.0, remaining * last_close * (1 - cost.slip(impact) / 100) * (1 - fee) - tip)
    res = finish(last_ts, "OPEN_AT_END", censored=True)
    res.pnl_pct = (mark / size - 1) * 100
    return res


def _pct(xs: list[float], q: float) -> float:
    xs = sorted(xs)
    k = (len(xs) - 1) * q
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def metrics(results: list[TradeResult]) -> dict:
    closed = sorted((t for t in results if not t.censored), key=lambda t: t.t_exit)
    censored = sum(t.censored for t in results)
    n = len(closed)
    if not n:
        return {"trades": 0, "censored": censored, "status": "NO_CLOSED_TRADES"}
    pnls = [t.pnl_pct for t in closed]
    wins, losses = [p for p in pnls if p > 0], [p for p in pnls if p <= 0]
    gains, loss_sum = sum(wins), -sum(losses)
    if loss_sum > 0:
        pf = round(gains / loss_sum, 2)
    else:
        pf = "inf" if gains > 0 else None   # aucune perte : infini explicite, jamais 0 ni valeur arbitraire
    equity = peak = mdd = 0.0
    for p in pnls:                          # équité en « mises » de taille égale, ordre chronologique
        equity += p
        peak = max(peak, equity)
        mdd = min(mdd, equity - peak)
    sd = statistics.pstdev(pnls) if n > 1 else 0.0
    top = sorted(wins, reverse=True)[:3]
    return {
        "trades": n, "censored": censored,
        "win_rate_pct": round(100 * len(wins) / n, 1),
        "net_pnl_pct_of_stake": round(sum(pnls), 2),
        "avg_win_pct": round(sum(wins) / len(wins), 2) if wins else None,
        "avg_loss_pct": round(sum(losses) / len(losses), 2) if losses else None,
        "expectancy_pct": round(sum(pnls) / n, 2),
        "profit_factor": pf,
        "max_drawdown_pct": round(mdd, 2),
        "sharpe_per_trade": round(statistics.mean(pnls) / sd, 3) if n >= 30 and sd > 0 else None,
        "avg_hold_min": round(sum(t.hold_min for t in closed) / n, 1),
        "fees_pct_of_stake": round(sum(t.fees_pct for t in closed), 2),
        "slippage_pct_of_stake": round(sum(t.slippage_pct for t in closed), 2),
        "top3_share_of_gains_pct": round(100 * sum(top) / gains, 1) if gains > 0 else None,
        "distribution": {f"p{int(q * 100)}": round(_pct(pnls, q), 2) for q in (0.1, 0.25, 0.5, 0.75, 0.9)},
        "exit_reasons": {k: sum(t.reason == k for t in closed) for k in sorted({t.reason for t in closed})},
    }


def candidates(paths: list[TokenPath], entry: EntryRules) -> list[TokenPath]:
    return [p for p in paths if evaluate_entry(p.features, entry, p.source)[0]]


def backtest(paths: list[TokenPath], entry: EntryRules, exit_: ExitRules,
             cost: CostScenario = BASE) -> tuple[dict, list[TradeResult]]:
    trades = [simulate(p, exit_, cost) for p in candidates(paths, entry)]
    return metrics(trades), trades


def backtest_report(paths: list[TokenPath], entry: EntryRules, exit_: ExitRules) -> dict:
    """Mesures par scénario de coûts et par moteur, sans mélange."""
    out = {}
    for sc in SCENARIOS:
        m, trades = backtest(paths, entry, exit_, sc)
        out[sc.name] = {"all": m, "by_source": {
            src: metrics([t for t in trades if t.source == src]) for src in sorted({t.source for t in trades})}}
    return out


# --- profils et Walk-Forward -------------------------------------------------------------

PROFILE_GRID = {
    "atr_sl_mult": [1.8, 2.2, 2.6],
    "stagnation_min": [15.0, 20.0, 30.0],
    "tp1_fraction": [0.25, 0.35],
}


def profiles(base: ExitRules) -> list[ExitRules]:
    keys = list(PROFILE_GRID)
    return [replace(base, **dict(zip(keys, v))) for v in itertools.product(*PROFILE_GRID.values())]


def _score(m: dict) -> float | None:
    if not m.get("trades"):
        return None
    # Espérance pénalisée par le drawdown : ne pas sélectionner un profil sur un seul gros gain.
    return m["expectancy_pct"] - abs(m["max_drawdown_pct"]) / math.sqrt(m["trades"])


@dataclass
class WFConfig:
    folds: int = 4
    min_train_trades: int = 30
    min_trades_total: int = 70
    min_profit_factor: float = 1.2
    purge_hours: float = 12.0
    max_drawdown_bankroll_pct: float = -30.0   # drawdown OOS maximal en % de la bankroll simulée
    stake_fraction: float = 0.05               # taille de position / bankroll (0,05 SOL / 1 SOL)
    min_positive_folds: int = 3


def walk_forward(paths: list[TokenPath], entry: EntryRules, base_exit: ExitRules,
                 cfg: WFConfig = WFConfig(), cost: CostScenario = BASE) -> dict:
    """Walk-Forward ancré : l'entraînement grandit pli après pli ; chaque test est postérieur à
    son entraînement d'au moins `purge_hours` (horodatages réels, pas des index)."""
    cands = sorted(candidates(paths, entry), key=lambda p: p.t0)
    grid = profiles(base_exit)
    n = len(cands)
    total_closed = metrics([simulate(p, base_exit, cost) for p in cands]).get("trades", 0)
    out: dict = {"candidates": n, "closed_trades_total": total_closed, "profiles": len(grid), "folds": [],
                 "purge_hours": cfg.purge_hours, "cost_scenario": cost.name}
    if total_closed < cfg.min_trades_total:
        out["status"] = f"INSUFFICIENT_EVIDENCE ({total_closed}/{cfg.min_trades_total} trades clôturés)"
        return out
    purge_s = cfg.purge_hours * 3600
    # Début du premier test : assez tôt pour laisser 4 fenêtres, assez tard pour que l'entraînement
    # APRÈS PURGE contienne au moins max(min_train, 40 %) des entrées (horodatages réels).
    target = max(cfg.min_train_trades, int(0.4 * n))
    n0 = next((i for i in range(n) if sum(1 for p in cands[:i] if p.t0 + purge_s <= cands[i].t0) >= target), n)
    k = (n - n0) // cfg.folds
    if k < 1:
        out["status"] = "INSUFFICIENT_EVIDENCE (entraînement purgé trop court pour 4 fenêtres de test)"
        return out
    oos: list[TradeResult] = []
    oos_pess: list[TradeResult] = []
    usable = 0
    for i in range(cfg.folds):
        test = cands[n0 + i * k: n0 + (i + 1) * k if i < cfg.folds - 1 else n]
        start = test[0].t0
        train = [p for p in cands[:n0 + i * k] if p.t0 + purge_s <= start]
        fold = {"fold": i + 1, "train_paths": len(train), "test_paths": len(test),
                "test_start": start, "purged": n0 + i * k - len(train)}
        best = None
        for rule in grid:
            m = metrics([simulate(p, rule, cost) for p in train])
            if m.get("trades", 0) < cfg.min_train_trades:
                continue
            s = _score(m)
            if s is not None and (best is None or s > best[0]):
                best = (s, rule, m)
        if best is None:
            fold["status"] = "UNUSABLE (entraînement insuffisant)"
            out["folds"].append(fold)
            continue
        _, rule, train_m = best
        test_trades = [simulate(p, rule, cost) for p in test]   # le test ne sert JAMAIS à choisir
        test_m = metrics(test_trades)
        if not test_m.get("trades"):
            fold["status"] = "UNUSABLE (aucun trade clôturé en test)"
            out["folds"].append(fold)
            continue
        usable += 1
        oos += test_trades
        oos_pess += [simulate(p, rule, PESSIMISTIC) for p in test]
        fold.update({"chosen": {k_: getattr(rule, k_) for k_ in PROFILE_GRID}, "train": train_m, "test": test_m})
        out["folds"].append(fold)
    agg, agg_pess = metrics(oos), metrics(oos_pess)
    out["oos"], out["oos_pessimistic"] = agg, agg_pess
    dd_bankroll = agg.get("max_drawdown_pct", 0.0) * cfg.stake_fraction
    out["oos_max_drawdown_bankroll_pct"] = round(dd_bankroll, 2)
    positive = sum(1 for f in out["folds"] if f.get("test", {}).get("net_pnl_pct_of_stake", 0) > 0)
    closed = agg.get("trades", 0)
    pf = agg.get("profit_factor")
    pf_ok = pf == "inf" or (isinstance(pf, (int, float)) and pf >= cfg.min_profit_factor)
    if usable < cfg.folds or closed == 0:
        out["status"] = f"INSUFFICIENT_EVIDENCE ({usable}/{cfg.folds} plis exploitables, {closed} trades OOS)"
    elif (agg.get("net_pnl_pct_of_stake", 0) > 0 and agg_pess.get("net_pnl_pct_of_stake", 0) > 0
          and positive >= cfg.min_positive_folds and pf_ok
          and dd_bankroll >= cfg.max_drawdown_bankroll_pct):
        out["status"] = "RENTABLE_HORS_ECHANTILLON (simulation uniquement — pas un feu vert pour le réel)"
    else:
        out["status"] = "NOT_PROFITABLE_OUT_OF_SAMPLE"
    out["positive_folds"] = positive
    return out


def optimize(paths: list[TokenPath], base_entry: EntryRules, base_exit: ExitRules,
             cfg: WFConfig = WFConfig()) -> dict:
    """Point d'entrée de l'optimiseur : Walk-Forward en scénario de base + rappel des réglages actuels."""
    res = walk_forward(paths, base_entry, base_exit, cfg)
    res["current_settings"] = {k: getattr(base_exit, k) for k in PROFILE_GRID}
    res["current_settings_backtest"] = backtest_report(paths, base_entry, base_exit)
    return res


def to_env(exit_: ExitRules) -> dict:
    return {"ATR_SL_MULT": f"{exit_.atr_sl_mult:g}", "STAGNATION_MIN": f"{exit_.stagnation_min:g}",
            "TP1_FRACTION": f"{exit_.tp1_fraction:g}"}
