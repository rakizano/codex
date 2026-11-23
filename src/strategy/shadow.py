"""Shadow Ledger : mesure des opportunités manquées par les filtres de SÉLECTION.

N'enregistre que les jetons rejetés EXCLUSIVEMENT pour des motifs d'âge, d'activité, de vélocité
ou de momentum (jamais un rejet de sécurité : RugCheck, liquidité, LP, concentration, autorités,
insiders...). Les prix sont relevés à +15, +60 et +120 min. Purement analytique : aucune entrée
ne peut en découler.
"""
from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path

from .entry import is_selection_only_rejection

SCHEMA = """
CREATE TABLE IF NOT EXISTS shadow (
  id INTEGER PRIMARY KEY AUTOINCREMENT, mint TEXT NOT NULL, ts REAL NOT NULL, source TEXT NOT NULL,
  reasons TEXT NOT NULL, price_usd REAL NOT NULL, liquidity_usd REAL, features TEXT,
  prices TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS shadow_ts ON shadow(ts);
"""


class ShadowLedger:
    def __init__(self, db_path: str | Path = ":memory:", horizons_min: tuple[int, ...] = (15, 60, 120),
                 clock=time.time):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        self.horizons, self.clock = tuple(sorted(horizons_min)), clock

    def record(self, mint: str, source: str, flags: list[str], obs: dict) -> bool:
        if not is_selection_only_rejection(flags):
            return False
        price = obs.get("price_usd")
        if not isinstance(price, (int, float)) or price <= 0:
            return False
        recent = self.db.execute("SELECT 1 FROM shadow WHERE mint=? AND ts>=?",
                                 (mint, self.clock() - max(self.horizons) * 60)).fetchone()
        if recent:
            return False   # un seul suivi à la fois par jeton
        keys = ("pair_age_min", "liquidity_usd", "mcap_usd", "buys_m5", "sells_m5", "volume_m5_usd",
                "volume_h1_usd", "price_change_h1", "dex_id")
        self.db.execute("INSERT INTO shadow (mint, ts, source, reasons, price_usd, liquidity_usd, features) "
                        "VALUES (?,?,?,?,?,?,?)",
                        (mint, self.clock(), source, json.dumps(flags), float(price), obs.get("liquidity_usd"),
                         json.dumps({k: obs.get(k) for k in keys})))
        self.db.commit()
        return True

    def due(self) -> list[tuple[int, str, list[int]]]:
        """(id, mint, horizons dus et non relevés)."""
        now, out = self.clock(), []
        for rid, mint, ts, prices in self.db.execute(
                "SELECT id, mint, ts, prices FROM shadow WHERE ts>=?", (now - (max(self.horizons) + 60) * 60,)):
            done = json.loads(prices)
            todo = [h for h in self.horizons if str(h) not in done and now >= ts + h * 60]
            if todo:
                out.append((rid, mint, todo))
        return out

    async def update_prices(self, dex) -> int:
        """Relève les prix dus en une passe groupée (DexScreener batch). Retourne le nombre de relevés."""
        due = self.due()
        if not due:
            return 0
        prices = await dex.prices(sorted({m for _, m, _ in due}))
        n = 0
        for rid, mint, hs in due:
            price = (prices.get(mint) or (None, None))[0]
            if not price:
                continue   # prix indisponible : on réessaiera, rien n'est inventé
            row = self.db.execute("SELECT prices FROM shadow WHERE id=?", (rid,)).fetchone()
            done = json.loads(row[0])
            for h in hs:
                done[str(h)] = price
                n += 1
            self.db.execute("UPDATE shadow SET prices=? WHERE id=?", (json.dumps(done), rid))
        self.db.commit()
        return n

    def stats(self) -> dict:
        """Rendement moyen (prix brut, sans frais) aux différents horizons, par motif principal."""
        by: dict[str, dict] = {}
        for reasons, p0, prices in self.db.execute("SELECT reasons, price_usd, prices FROM shadow"):
            key = json.loads(reasons)[0].split("(")[0]
            d = by.setdefault(key, {"n": 0, **{f"ret_{h}m": [] for h in self.horizons}})
            d["n"] += 1
            for h, p in json.loads(prices).items():
                d[f"ret_{h}m"].append((p / p0 - 1) * 100)
        out = {}
        for k, d in by.items():
            out[k] = {"n": d["n"]}
            for h in self.horizons:
                xs = d[f"ret_{h}m"]
                out[k][f"avg_ret_{h}m_pct"] = round(sum(xs) / len(xs), 2) if xs else None
                out[k][f"samples_{h}m"] = len(xs)
        return out

    def close(self) -> None:
        self.db.close()
