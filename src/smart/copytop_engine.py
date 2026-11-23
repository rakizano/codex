"""Moteur copy.top : admissibilité des cohortes, file d'attente de migration Pump.fun, présence
des traders (still_in) et détection de distribution.

MigrationWatchlist : un signal copy.top rejeté UNIQUEMENT pour `UNKNOWN_LIQUIDITY` (jeton encore
sur la courbe Pump.fun) et porté par >= 2 traders admissibles (fair play clean, détention moyenne
>= 5 min) est mis en attente passive (45 min, 50 jetons max). Dès qu'un pool AMM migré
(pumpswap / raydium / meteora, >= 15 000 USD) apparaît sur DexScreener, la présence de la cohorte
est revérifiée puis le jeton repasse par l'audit COMPLET. Aucun achat n'est déclenché par la file
elle-même ; un jeton rejeté pour un autre motif de sécurité n'y entre jamais.
"""
from __future__ import annotations

import json
import math
import sqlite3
import time
from pathlib import Path

from fetchers.copytop import valid_handle
from strategy.entry import MIGRATED_DEXES

WATCHLIST_ONLY_FLAG = "UNKNOWN_LIQUIDITY"

SCHEMA = """
CREATE TABLE IF NOT EXISTS ct_watchlist (
  mint TEXT PRIMARY KEY, added_at REAL NOT NULL, expires_at REAL NOT NULL, cohort TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING', last_check REAL, note TEXT
);
"""


def watchlist_admissible(flags: list[str]) -> bool:
    """Seul motif de rejet toléré : liquidité AMM pas encore connue (aucun autre contrôle échoué)."""
    return list(flags) == [WATCHLIST_ONLY_FLAG]


def migrated_pair(pairs, mint: str, min_liquidity_usd: float = 15_000.0) -> dict | None:
    """Paire AMM post-migration valide (contrat DexScreener vérifié), la plus liquide ; sinon None."""
    best = None
    for p in pairs or []:
        if not isinstance(p, dict) or p.get("chainId") != "solana":
            continue
        if (p.get("baseToken") or {}).get("address") != mint:
            continue
        if str(p.get("dexId", "")).lower() not in MIGRATED_DEXES:
            continue
        try:
            liq = float((p.get("liquidity") or {}).get("usd"))
            price = float(p.get("priceUsd"))
            created = float(p.get("pairCreatedAt"))
        except (TypeError, ValueError):
            continue
        if not all(math.isfinite(x) for x in (liq, price, created)) or price <= 0 or created <= 0:
            continue
        if liq >= min_liquidity_usd and (best is None or liq > best[0]):
            best = (liq, p)
    return best[1] if best else None


async def eligible_cohort(copytop, handles, only_clean: bool, min_hold_min: float) -> list[str]:
    """Handles admissibles (profil vérifié). Profil indisponible = non admissible (fail-closed)."""
    out = []
    board = await copytop.leaderboard()
    for h in dict.fromkeys(x for x in handles or [] if valid_handle(x)):
        row = board.get(h)
        # Pré-filtre sans requête : hors classement (durée inconnue) ou inadmissible au classement.
        if row is None or row.get("hold_min") is None or row["hold_min"] < min_hold_min:
            continue
        if only_clean and row.get("fair_play") != "clean":
            continue
        prof = await copytop.trader_profile(h)     # confirmation : le profil fait référence
        if prof is not None and prof.eligible(only_clean, min_hold_min):
            out.append(h)
    return out


def still_in(holding: dict[str, bool] | None, cohort: list[str]) -> tuple[int | None, int]:
    """-> (nombre de membres de la cohorte encore en position, nombre de statuts inconnus).
    None si la donnée est indisponible."""
    if holding is None:
        return None, len(cohort)
    known = [holding[h] for h in cohort if h in holding]
    return sum(known), len(cohort) - len(known)


class MigrationWatchlist:
    def __init__(self, db_path: str | Path = ":memory:", ttl_min: float = 45.0, max_size: int = 50,
                 clock=time.time):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        self.ttl_s, self.max_size, self.clock = ttl_min * 60, max_size, clock

    def prune(self) -> int:
        cur = self.db.execute("UPDATE ct_watchlist SET status='EXPIRED' WHERE status='WAITING' AND expires_at<=?",
                              (self.clock(),))
        self.db.commit()
        return cur.rowcount

    def add(self, mint: str, cohort: list[str]) -> str:
        """-> ADDED | DUPLICATE | FULL."""
        self.prune()
        row = self.db.execute("SELECT status FROM ct_watchlist WHERE mint=?", (mint,)).fetchone()
        if row and row[0] == "WAITING":
            return "DUPLICATE"
        if self.size() >= self.max_size:
            return "FULL"
        now = self.clock()
        self.db.execute("INSERT OR REPLACE INTO ct_watchlist (mint, added_at, expires_at, cohort, status) "
                        "VALUES (?,?,?,?, 'WAITING')", (mint, now, now + self.ttl_s, json.dumps(cohort)))
        self.db.commit()
        return "ADDED"

    def size(self) -> int:
        return self.db.execute("SELECT COUNT(*) FROM ct_watchlist WHERE status='WAITING'").fetchone()[0]

    def waiting(self) -> list[tuple[str, list[str]]]:
        self.prune()
        rows = self.db.execute("SELECT mint, cohort FROM ct_watchlist WHERE status='WAITING' ORDER BY added_at")
        return [(m, [h for h in json.loads(c) if valid_handle(h)]) for m, c in rows]

    def mark(self, mint: str, status: str, note: str = "") -> None:
        self.db.execute("UPDATE ct_watchlist SET status=?, last_check=?, note=? WHERE mint=?",
                        (status, self.clock(), note[:200], mint))
        self.db.commit()

    def touch(self, mint: str) -> None:
        self.db.execute("UPDATE ct_watchlist SET last_check=? WHERE mint=?", (self.clock(), mint))
        self.db.commit()

    def stats(self) -> dict:
        return dict(self.db.execute("SELECT status, COUNT(*) FROM ct_watchlist GROUP BY status").fetchall())

    def close(self) -> None:
        self.db.close()
