"""Paper trader SQLite : entrées simulées, mark-to-market via devis Jupiter, SL/TP/temps,
PnL net (frais ~1 % par côté) et coupe-circuit de perte journalière.

Les devis Jupiter intègrent déjà l'impact prix et les frais AMM ; on retire en plus
FEE_PCT à l'entrée et à la sortie (frais de courbe/priorité) et le pourboire Jito fixe
de chaque transaction (`tip_sol`), pour que la simulation coûte autant que le réel.
Les seuils SL/TP s'appliquent au PnL NET de tous les frais.
"""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

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


@dataclass
class Position:
    id: int
    mint: str
    opened_at: float
    size_sol: float
    token_amount: int
    entry_price_impact_pct: float | None


class PaperTrader:
    def __init__(self, db_path: str | Path = ":memory:", stop_loss_pct: float = -25.0,
                 take_profit_pct: float = 60.0, max_hold_minutes: float = 240.0,
                 daily_max_loss_sol: float = 1.0, max_open_positions: int = 5, clock=time.time,
                 tip_sol: float = 0.0, ref_size_sol: float = 0.05, min_trades_for_verdict: int = 30):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        self.sl, self.tp = stop_loss_pct, take_profit_pct
        self.max_hold_s = max_hold_minutes * 60
        self.daily_max_loss_sol = daily_max_loss_sol
        self.max_open = max_open_positions
        self.clock = clock
        self.tip_sol = tip_sol
        self.ref_size_sol = ref_size_sol
        self.min_trades = min_trades_for_verdict

    # --- état -----------------------------------------------------------------
    def open_positions(self) -> list[Position]:
        rows = self.db.execute("SELECT id, mint, opened_at, size_sol, token_amount, entry_price_impact_pct "
                               "FROM positions WHERE status='OPEN'").fetchall()
        return [Position(*r) for r in rows]

    def has_position(self, mint: str) -> bool:
        return self.db.execute("SELECT 1 FROM positions WHERE mint=? AND status='OPEN'", (mint,)).fetchone() is not None

    def realized_pnl_today(self) -> float:
        since = self.clock() - DAY_S
        row = self.db.execute("SELECT COALESCE(SUM(pnl_sol),0) FROM positions WHERE status='CLOSED' AND closed_at>=?",
                              (since,)).fetchone()
        return float(row[0])

    def circuit_breaker_tripped(self) -> bool:
        return self.realized_pnl_today() <= -abs(self.daily_max_loss_sol)

    def can_open(self, mint: str) -> tuple[bool, str]:
        if self.circuit_breaker_tripped():
            return False, "CIRCUIT_BREAKER"
        if self.has_position(mint):
            return False, "ALREADY_OPEN"
        if len(self.open_positions()) >= self.max_open:
            return False, "MAX_OPEN_POSITIONS"
        return True, "OK"

    def record_audit(self, mint: str, verdict: str, flags: list[str], llm_verdict: str | None = None) -> None:
        self.db.execute("INSERT INTO audits VALUES (?,?,?,?,?)",
                        (self.clock(), mint, verdict, ",".join(flags), llm_verdict))
        self.db.commit()

    # --- actions simulées -------------------------------------------------------
    def open(self, mint: str, size_sol: float, buy_quote: dict,
             quote_size_sol: float | None = None) -> Position | None:
        """`quote_size_sol` : taille pour laquelle le devis a été demandé (si différente de la
        position, on met à l'échelle linéairement — prudent : une petite taille obtient en
        réalité un meilleur prix)."""
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
        cur = self.db.execute("INSERT INTO positions (mint, opened_at, size_sol, token_amount, entry_price_impact_pct) "
                              "VALUES (?,?,?,?,?)", (mint, self.clock(), size_sol, tokens, impact))
        self.db.commit()
        return Position(cur.lastrowid, mint, self.clock(), size_sol, tokens, impact)

    def net_exit_value(self, quote_value_sol: float) -> float:
        return max(0.0, quote_value_sol * (1 - FEE_PCT / 100) - self.tip_sol)

    def roundtrip_cost_pct(self, size_sol: float | None = None) -> float:
        """Coût d'un aller-retour à prix constant, en % de la position."""
        size = size_sol or self.ref_size_sol
        keep = (1 - self.tip_sol / size) * (1 - FEE_PCT / 100) ** 2 - self.tip_sol / size
        return (1 - keep) * 100

    def evaluate_exit(self, pos: Position, quote_value_sol: float | None) -> str | None:
        """Renvoie le motif de sortie, ou None pour conserver la position."""
        if quote_value_sol is None:
            return "NO_EXIT_ROUTE"  # route de sortie disparue : on matérialise la perte
        pnl_pct = (self.net_exit_value(quote_value_sol) / pos.size_sol - 1) * 100
        if pnl_pct <= self.sl:
            return "STOP_LOSS"
        if pnl_pct >= self.tp:
            return "TAKE_PROFIT"
        if self.clock() - pos.opened_at >= self.max_hold_s:
            return "TIME_STOP"
        return None

    def close(self, pos: Position, quote_value_sol: float | None, reason: str) -> float:
        exit_value = self.net_exit_value(quote_value_sol) if quote_value_sol is not None else 0.0
        pnl = exit_value - pos.size_sol
        self.db.execute("UPDATE positions SET status='CLOSED', closed_at=?, exit_value_sol=?, pnl_sol=?, pnl_pct=?, "
                        "exit_reason=? WHERE id=?",
                        (self.clock(), exit_value, pnl, pnl / pos.size_sol * 100, reason, pos.id))
        self.db.commit()
        return pnl

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
        # Seuil de rentabilité : taux de réussite p tel que p*gain_moyen = (1-p)*perte_moyenne.
        theo = 100 * abs(self.sl) / (self.tp + abs(self.sl)) if self.tp + abs(self.sl) else None
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
        }

    def close_db(self) -> None:
        self.db.close()
