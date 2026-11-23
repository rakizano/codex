"""Registre des positions (simulées, ou miroir des positions réelles en LIVE).

- Valorisation par devis Jupiter de la part restante, PnL NET de tous les frais :
  FEE_PCT à l'entrée et à chaque sortie, plus le pourboire Jito fixe de chaque
  transaction (`tip_sol`), pour que la simulation coûte autant que le réel.
- Sorties gérées par `strategy.exit.decide` : stop-loss, stop au prix d'entrée après TP1,
  vente partielle TP1, stop suiveur depuis le plus haut, take-profit final, durée maximale.
- Coupe-circuit de perte journalière et délai avant de racheter un jeton perdant.
"""
from __future__ import annotations

import json
import math
import sqlite3
import time
from dataclasses import dataclass, replace
from pathlib import Path

from strategy.exit import Decision, ExitRules, decide

FEE_PCT = 1.0
DAY_S = 86_400

SCHEMA = """
CREATE TABLE IF NOT EXISTS positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mint TEXT NOT NULL,
  opened_at REAL NOT NULL,
  size_sol REAL NOT NULL,
  token_amount INTEGER NOT NULL,
  entry_price_impact_pct REAL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  closed_at REAL,
  exit_value_sol REAL,
  pnl_sol REAL,
  pnl_pct REAL,
  exit_reason TEXT
);
CREATE TABLE IF NOT EXISTS audits (
  ts REAL NOT NULL, mint TEXT NOT NULL, verdict TEXT NOT NULL, flags TEXT, llm_verdict TEXT
);
"""
# Colonnes ajoutées après la v0.2 (migration automatique des bases existantes)
MIGRATIONS = {
    "remaining_frac": "REAL NOT NULL DEFAULT 1.0",
    "peak_pnl_pct": "REAL NOT NULL DEFAULT 0.0",
    "realized_sol": "REAL NOT NULL DEFAULT 0.0",
    "tp1_done": "INTEGER NOT NULL DEFAULT 0",
    "entry_price_usd": "REAL",
    "source": "TEXT NOT NULL DEFAULT 'scan'",   # moteur d'origine : scan | smart | both
    "signal_buyers": "TEXT NOT NULL DEFAULT '[]'",
    "sold_signal_buyers": "TEXT NOT NULL DEFAULT '[]'",
}
_COLS = ("id, mint, opened_at, size_sol, token_amount, entry_price_impact_pct, "
         "remaining_frac, peak_pnl_pct, realized_sol, tp1_done, entry_price_usd, "
         "source, signal_buyers, sold_signal_buyers")


@dataclass
class Position:
    id: int
    mint: str
    opened_at: float
    size_sol: float
    token_amount: int
    entry_price_impact_pct: float | None
    remaining_frac: float = 1.0
    peak_pnl_pct: float = 0.0
    realized_sol: float = 0.0
    tp1_done: bool = False
    entry_price_usd: float | None = None  # prix DexScreener à l'entrée (surveillance rapide)
    source: str = "scan"
    signal_buyers: tuple[str, ...] = ()
    sold_signal_buyers: tuple[str, ...] = ()


class PaperTrader:
    def __init__(self, db_path: str | Path = ":memory:", exit_rules: ExitRules | None = None,
                 daily_max_loss_sol: float = 1.0, max_open_positions: int = 5, clock=time.time,
                 tip_sol: float = 0.0, ref_size_sol: float = 0.05, min_trades_for_verdict: int = 30,
                 reentry_cooldown_h: float = 24.0, bankroll_sol: float = 1.0,
                 stop_loss_pct: float | None = None, take_profit_pct: float | None = None,
                 max_hold_minutes: float | None = None):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        existing = {r[1] for r in self.db.execute("PRAGMA table_info(positions)")}
        for col, ddl in MIGRATIONS.items():
            if col not in existing:
                self.db.execute(f"ALTER TABLE positions ADD COLUMN {col} {ddl}")
        self.db.commit()

        rules = exit_rules or ExitRules()
        overrides = {k: v for k, v in (("stop_loss_pct", stop_loss_pct), ("take_profit_pct", take_profit_pct),
                                       ("max_hold_minutes", max_hold_minutes)) if v is not None}
        self.rules = replace(rules, **overrides) if overrides else rules
        self.daily_max_loss_sol = daily_max_loss_sol
        self.max_open = max_open_positions
        self.clock = clock
        self.tip_sol = tip_sol
        self.ref_size_sol = ref_size_sol
        self.min_trades = min_trades_for_verdict
        self.cooldown_s = reentry_cooldown_h * 3600
        self.initial_bankroll = bankroll_sol

    # --- état -----------------------------------------------------------------
    def open_positions(self) -> list[Position]:
        rows = self.db.execute(f"SELECT {_COLS} FROM positions WHERE status='OPEN'").fetchall()
        out = []
        for r in rows:
            try:
                buyers = tuple(x for x in json.loads(r[12] or "[]") if isinstance(x, str))
                sold = tuple(x for x in json.loads(r[13] or "[]") if isinstance(x, str))
            except (TypeError, ValueError):
                buyers, sold = (), ()
            out.append(Position(*r[:9], bool(r[9]), r[10], r[11] or "scan", buyers, sold))
        return out

    def has_position(self, mint: str) -> bool:
        return self.db.execute("SELECT 1 FROM positions WHERE mint=? AND status='OPEN'", (mint,)).fetchone() is not None

    def in_cooldown(self, mint: str) -> bool:
        if self.cooldown_s <= 0:
            return False
        row = self.db.execute("SELECT 1 FROM positions WHERE mint=? AND status='CLOSED' AND pnl_sol<0 AND closed_at>=?",
                              (mint, self.clock() - self.cooldown_s)).fetchone()
        return row is not None

    def realized_pnl_today(self) -> float:
        since = self.clock() - DAY_S
        row = self.db.execute("SELECT COALESCE(SUM(pnl_sol),0) FROM positions WHERE status='CLOSED' AND closed_at>=?",
                              (since,)).fetchone()
        return float(row[0])

    def bankroll(self) -> float:
        """Capital simulé : capital initial + PnL réalisé total."""
        total = self.db.execute("SELECT COALESCE(SUM(pnl_sol),0) FROM positions WHERE status='CLOSED'").fetchone()[0]
        return self.initial_bankroll + float(total)

    def circuit_breaker_tripped(self) -> bool:
        return self.realized_pnl_today() <= -abs(self.daily_max_loss_sol)

    def can_open(self, mint: str) -> tuple[bool, str]:
        if self.circuit_breaker_tripped():
            return False, "CIRCUIT_BREAKER"
        if self.has_position(mint):
            return False, "ALREADY_OPEN"
        if self.in_cooldown(mint):
            return False, "COOLDOWN"
        if len(self.open_positions()) >= self.max_open:
            return False, "MAX_OPEN_POSITIONS"
        return True, "OK"

    def record_audit(self, mint: str, verdict: str, flags: list[str], llm_verdict: str | None = None) -> None:
        self.db.execute("INSERT INTO audits VALUES (?,?,?,?,?)",
                        (self.clock(), mint, verdict, ",".join(flags), llm_verdict))
        self.db.commit()

    # --- coûts ------------------------------------------------------------------
    def net_exit_value(self, quote_value_sol: float) -> float:
        return max(0.0, quote_value_sol * (1 - FEE_PCT / 100) - self.tip_sol)

    def roundtrip_cost_pct(self, size_sol: float | None = None) -> float:
        """Coût d'un aller-retour à prix constant, en % de la position."""
        size = size_sol or self.ref_size_sol
        keep = (1 - self.tip_sol / size) * (1 - FEE_PCT / 100) ** 2 - self.tip_sol / size
        return (1 - keep) * 100

    # --- actions ----------------------------------------------------------------
    def open(self, mint: str, size_sol: float, buy_quote: dict,
             quote_size_sol: float | None = None, entry_price_usd: float | None = None,
             source: str = "scan", signal_buyers: tuple[str, ...] | list[str] = ()) -> Position | None:
        """`quote_size_sol` : taille pour laquelle le devis a été demandé (si différente de la
        position, mise à l'échelle linéaire — prudent : une petite taille obtient un meilleur prix)."""
        ok, _ = self.can_open(mint)
        if not ok or not buy_quote or not buy_quote.get("outAmount") or size_sol <= self.tip_sol:
            return None
        scale = size_sol / quote_size_sol if quote_size_sol else 1.0
        invested_share = 1 - self.tip_sol / size_sol  # le pourboire n'achète pas de jetons
        tokens = int(int(buy_quote["outAmount"]) * scale * invested_share * (1 - FEE_PCT / 100))
        try:
            impact = float(buy_quote.get("priceImpactPct")) * 100
        except (TypeError, ValueError):
            impact = None
        buyers = tuple(dict.fromkeys(x for x in signal_buyers
                                     if isinstance(x, str) and 0 < len(x) <= 80))[:25]
        cur = self.db.execute("INSERT INTO positions (mint, opened_at, size_sol, token_amount, entry_price_impact_pct, "
                              "entry_price_usd, source, signal_buyers) VALUES (?,?,?,?,?,?,?,?)",
                              (mint, self.clock(), size_sol, tokens, impact, entry_price_usd, source,
                               json.dumps(buyers)))
        self.db.commit()
        return Position(cur.lastrowid, mint, self.clock(), size_sol, tokens, impact,
                        entry_price_usd=entry_price_usd, source=source, signal_buyers=buyers)

    def near_exit(self, pos: Position, price_usd: float | None, margin_pct: float = 5.0) -> bool:
        """Estimation rapide (prix DexScreener) : la position approche-t-elle d'un seuil de sortie ?
        Sert uniquement à déclencher plus tôt un devis Jupiter ; la décision reste fondée sur le devis."""
        if not pos.entry_price_usd or not price_usd:
            return True  # inconnu : on vérifie
        cost = self.roundtrip_cost_pct(pos.size_sol)
        est = (price_usd / pos.entry_price_usd * (1 - cost / 100) - 1) * 100
        r = self.rules
        stop = max(r.stop_loss_pct, 0.0) if (pos.tp1_done and r.breakeven_after_tp1) else r.stop_loss_pct
        if est <= stop + margin_pct:
            return True
        if not pos.tp1_done and r.tp1_pct is not None and est >= r.tp1_pct - margin_pct:
            return True
        if est >= r.take_profit_pct - margin_pct:
            return True
        if r.trailing_stop_pct and r.trail_activation_pct is not None and pos.peak_pnl_pct >= r.trail_activation_pct:
            dd = ((1 + est / 100) / (1 + pos.peak_pnl_pct / 100) - 1) * 100
            if dd <= -(r.trailing_stop_pct - margin_pct):
                return True
        return False

    def pnl_pct(self, pos: Position, quote_value_sol: float | None) -> float | None:
        """PnL net de la part restante (valeur de sortie nette / coût de la part restante)."""
        if quote_value_sol is None:
            return None
        basis = pos.size_sol * pos.remaining_frac
        return (self.net_exit_value(quote_value_sol) / basis - 1) * 100 if basis > 0 else None

    def evaluate(self, pos: Position, quote_value_sol: float | None) -> Decision | None:
        pnl = self.pnl_pct(pos, quote_value_sol)
        if pnl is not None and pnl > pos.peak_pnl_pct:
            pos.peak_pnl_pct = pnl
            self.db.execute("UPDATE positions SET peak_pnl_pct=? WHERE id=?", (pnl, pos.id))
            self.db.commit()
        held_min = (self.clock() - pos.opened_at) / 60
        return decide(self.rules, pnl, pos.peak_pnl_pct, held_min, pos.tp1_done)

    def evaluate_exit(self, pos: Position, quote_value_sol: float | None) -> str | None:
        d = self.evaluate(pos, quote_value_sol)
        return d.reason if d else None

    def partial_close(self, pos: Position, quote_value_sol: float, fraction: float) -> float:
        """Vend `fraction` de la part restante. Retourne le produit net en SOL."""
        proceeds = self.net_exit_value(quote_value_sol * fraction)
        pos.token_amount -= int(pos.token_amount * fraction)
        pos.remaining_frac *= 1 - fraction
        pos.realized_sol += proceeds
        pos.tp1_done = True
        pos.peak_pnl_pct = max(0.0, pos.peak_pnl_pct)
        self.db.execute("UPDATE positions SET token_amount=?, remaining_frac=?, realized_sol=?, tp1_done=1 WHERE id=?",
                        (pos.token_amount, pos.remaining_frac, pos.realized_sol, pos.id))
        self.db.commit()
        return proceeds

    def close(self, pos: Position, quote_value_sol: float | None, reason: str) -> float:
        remaining_value = self.net_exit_value(quote_value_sol) if quote_value_sol is not None else 0.0
        exit_value = pos.realized_sol + remaining_value
        pnl = exit_value - pos.size_sol
        self.db.execute("UPDATE positions SET status='CLOSED', closed_at=?, exit_value_sol=?, pnl_sol=?, pnl_pct=?, "
                        "exit_reason=? WHERE id=?",
                        (self.clock(), exit_value, pnl, pnl / pos.size_sol * 100, reason, pos.id))
        self.db.commit()
        return pnl

    def add_copytop_sales(self, pos: Position, sellers: list[str] | tuple[str, ...]) -> int:
        """Mémorise uniquement les ventes des handles présents dans le signal d'entrée."""
        allowed = set(pos.signal_buyers)
        merged = set(pos.sold_signal_buyers)
        merged.update(x for x in sellers if isinstance(x, str) and x in allowed)
        if merged == set(pos.sold_signal_buyers):
            return len(merged)
        pos.sold_signal_buyers = tuple(sorted(merged))
        self.db.execute("UPDATE positions SET sold_signal_buyers=? WHERE id=?",
                        (json.dumps(pos.sold_signal_buyers), pos.id))
        self.db.commit()
        return len(pos.sold_signal_buyers)

    @staticmethod
    def copytop_exit_ready(pos: Position, min_sellers: int = 2, sell_ratio: float = 0.5) -> bool:
        """Sortie seulement après distribution par plusieurs acheteurs du signal initial."""
        cohort = set(pos.signal_buyers)
        if pos.source != "copytop" or len(cohort) < min_sellers:
            return False
        ratio = min(1.0, max(0.5, sell_ratio))
        required = max(min_sellers, math.ceil(len(cohort) * ratio))
        return len(cohort.intersection(pos.sold_signal_buyers)) >= required

    # --- reporting --------------------------------------------------------------
    def summary(self) -> dict:
        r = self.db.execute("SELECT COUNT(*), COALESCE(SUM(pnl_sol),0), COALESCE(SUM(pnl_sol>0),0), "
                            "COALESCE(SUM(size_sol),0) FROM positions WHERE status='CLOSED'").fetchone()
        n, pnl, wins, invested = r
        avg_win = self.db.execute("SELECT AVG(pnl_pct) FROM positions WHERE status='CLOSED' AND pnl_sol>0").fetchone()[0]
        avg_loss = self.db.execute("SELECT AVG(pnl_pct) FROM positions WHERE status='CLOSED' AND pnl_sol<=0").fetchone()[0]
        exits = dict(self.db.execute("SELECT exit_reason, COUNT(*) FROM positions WHERE status='CLOSED' "
                                     "GROUP BY exit_reason").fetchall())
        audits = dict(self.db.execute("SELECT verdict, COUNT(*) FROM audits GROUP BY verdict").fetchall())

        win_rate = 100 * wins / n if n else None
        # Seuil de rentabilité : p tel que p*gain_moyen = (1-p)*perte_moyenne.
        target = self.rules.tp1_pct if self.rules.tp1_pct is not None else self.rules.take_profit_pct
        sl = abs(self.rules.stop_loss_pct)
        theo = 100 * sl / (target + sl) if target + sl else None
        observed = (100 * abs(avg_loss) / (avg_win + abs(avg_loss))
                    if avg_win is not None and avg_loss is not None and avg_win + abs(avg_loss) > 0 else None)
        if n < self.min_trades:
            verdict = f"PAS_ASSEZ_DE_DONNEES ({n}/{self.min_trades} trades clôturés)"
        elif pnl > 0:
            verdict = "RENTABLE_EN_SIMULATION"
        else:
            verdict = "PERDANT_EN_SIMULATION"
        return {
            "verdict": verdict,
            "closed_trades": n,
            "open_trades": len(self.open_positions()),
            "realized_pnl_sol": round(pnl, 6),
            "bankroll_sol": round(self.bankroll(), 6),
            "return_on_invested_pct": round(100 * pnl / invested, 2) if invested else None,
            "win_rate_pct": round(win_rate, 1) if win_rate is not None else None,
            "breakeven_win_rate_theoretical_pct": round(theo, 1) if theo is not None else None,
            "breakeven_win_rate_observed_pct": round(observed, 1) if observed is not None else None,
            "avg_win_pct": round(avg_win, 1) if avg_win is not None else None,
            "avg_loss_pct": round(avg_loss, 1) if avg_loss is not None else None,
            "roundtrip_cost_pct": round(self.roundtrip_cost_pct(), 2),
            "exit_reasons": exits,
            "realized_pnl_24h_sol": round(self.realized_pnl_today(), 6),
            "circuit_breaker": self.circuit_breaker_tripped(),
            "audits_by_verdict": audits,
            "by_source": self.by_source(),
        }

    def by_source(self) -> dict:
        """Comparaison des moteurs (scan classique / smart money / les deux) sur les trades clôturés."""
        out = {}
        for src, n, pnl, wins, invested in self.db.execute(
                "SELECT source, COUNT(*), SUM(pnl_sol), SUM(pnl_sol>0), SUM(size_sol) FROM positions "
                "WHERE status='CLOSED' GROUP BY source"):
            out[src] = {"closed_trades": n, "realized_pnl_sol": round(pnl, 6),
                        "win_rate_pct": round(100 * wins / n, 1),
                        "return_on_invested_pct": round(100 * pnl / invested, 2) if invested else None}
        for src, n in self.db.execute("SELECT source, COUNT(*) FROM positions WHERE status='OPEN' GROUP BY source"):
            out.setdefault(src, {"closed_trades": 0})["open_trades"] = n
        return out

    def close_db(self) -> None:
        self.db.close()
