"""Moteur 2 — Smart Money : repère les wallets rentables et ce qu'ils achètent.

Source gratuite, sans clé : les 300 derniers trades de chaque pool (GeckoTerminal), avec
l'adresse du wallet, le sens, le montant en USD et le prix. En interrogeant en boucle les
pools en tendance et ceux que le bot suit, on accumule un historique par wallet :

- PnL réalisé par jeton : ventes USD - coût USD de la part vendue (coût moyen).
- Un wallet est « smart » s'il a au moins N jetons clôturés, un taux de réussite et un PnL
  minimum ; les robots (MEV, volume) sont exclus : trop de trades sur un même jeton.
- Les wallets ajoutés à la main (SMART_WALLETS, ex. classement Pump.fun) comptent d'office.

Un achat smart ne déclenche JAMAIS une entrée à lui seul : le jeton passe ensuite par les
mêmes filtres de sécurité (fail-closed), le contrôle social et la gestion des positions.
Rien n'est inventé : un trade incomplet ou anormal est ignoré.
"""
from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from memecoin.filters import is_valid_mint

SOL = "So11111111111111111111111111111111111111112"
STABLES = {SOL, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
           "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"}  # USDT

SCHEMA = """
CREATE TABLE IF NOT EXISTS sm_trades (
  tx TEXT NOT NULL, wallet TEXT NOT NULL, mint TEXT NOT NULL, side TEXT NOT NULL,
  usd REAL NOT NULL, tokens REAL NOT NULL, price_usd REAL NOT NULL, ts REAL NOT NULL,
  PRIMARY KEY (tx, wallet, mint, side)
);
CREATE INDEX IF NOT EXISTS sm_trades_wallet ON sm_trades(wallet);
CREATE INDEX IF NOT EXISTS sm_trades_mint_ts ON sm_trades(mint, ts);
"""


@dataclass(frozen=True)
class SmartRules:
    min_closed_tokens: int = 3        # jetons revendus (≥ 50 %) pour juger un wallet
    min_win_rate: float = 0.35         # les meilleurs traders Pump.fun gagnent avec 23–56 % de réussite
    min_realized_pnl_usd: float = 500.0
    max_trades_per_token: int = 15    # au-delà : robot de volume / MEV
    min_buy_usd: float = 100.0        # achat significatif
    window_min: float = 30.0          # fenêtre de détection des achats
    min_wallets: int = 2              # wallets smart distincts sur le même jeton
    max_chase_pct: float = 50.0       # pas d'entrée si le prix a déjà monté de +50 % depuis leur achat
    manual_wallets: tuple[str, ...] = field(default_factory=tuple)


@dataclass
class WalletScore:
    wallet: str
    tokens_traded: int
    closed_tokens: int
    wins: int
    realized_pnl_usd: float
    max_trades_per_token: int
    manual: bool = False

    @property
    def win_rate(self) -> float:
        return self.wins / self.closed_tokens if self.closed_tokens else 0.0

    def is_smart(self, r: SmartRules) -> bool:
        if self.manual:
            return True
        return (self.max_trades_per_token <= r.max_trades_per_token
                and self.closed_tokens >= r.min_closed_tokens
                and self.win_rate >= r.min_win_rate
                and self.realized_pnl_usd >= r.min_realized_pnl_usd)

    def to_dict(self) -> dict:
        return {"wallet": self.wallet, "manual": self.manual, "tokens_traded": self.tokens_traded,
                "closed_tokens": self.closed_tokens, "win_rate_pct": round(100 * self.win_rate, 1),
                "realized_pnl_usd": round(self.realized_pnl_usd, 2)}


def _ts(raw) -> float | None:
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def parse_trade(t: dict, mint: str) -> tuple | None:
    """Trade GeckoTerminal -> (tx, wallet, mint, side, usd, tokens, price_usd, ts) ; None si incomplet."""
    try:
        if t.get("is_anomalous"):
            return None
        wallet, side, tx = t["tx_from_address"], t["kind"], t["tx_hash"]
        usd, ts = float(t["volume_in_usd"]), _ts(t["block_timestamp"])
        if side == "buy" and t["to_token_address"] == mint and t["from_token_address"] in STABLES:
            tokens, price = float(t["to_token_amount"]), float(t["price_to_in_usd"])
        elif side == "sell" and t["from_token_address"] == mint and t["to_token_address"] in STABLES:
            tokens, price = float(t["from_token_amount"]), float(t["price_from_in_usd"])
        else:
            return None
    except (KeyError, TypeError, ValueError):
        return None
    if not (is_valid_mint(wallet) and isinstance(tx, str) and ts and usd > 0 and tokens > 0 and price > 0):
        return None
    return tx, wallet, mint, side, usd, tokens, price, ts


class SmartMoneyBook:
    def __init__(self, db_path: str | Path = ":memory:", rules: SmartRules | None = None, clock=time.time):
        if str(db_path) != ":memory:":
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(str(db_path))
        self.db.executescript(SCHEMA)
        self.rules = rules or SmartRules()
        self.manual = {w for w in self.rules.manual_wallets if is_valid_mint(w)}
        self.clock = clock

    # --- collecte ---------------------------------------------------------------
    def ingest(self, mint: str, trades: list[dict]) -> int:
        rows = [r for r in (parse_trade(t, mint) for t in trades) if r]
        before = self.db.total_changes
        self.db.executemany("INSERT OR IGNORE INTO sm_trades VALUES (?,?,?,?,?,?,?,?)", rows)
        self.db.commit()
        return self.db.total_changes - before

    # --- classement des wallets ---------------------------------------------------
    def scores(self) -> dict[str, WalletScore]:
        out: dict[str, WalletScore] = {}
        q = ("SELECT wallet, mint, COUNT(*), "
             "SUM(CASE WHEN side='buy' THEN usd ELSE 0 END), SUM(CASE WHEN side='buy' THEN tokens ELSE 0 END), "
             "SUM(CASE WHEN side='sell' THEN usd ELSE 0 END), SUM(CASE WHEN side='sell' THEN tokens ELSE 0 END) "
             "FROM sm_trades GROUP BY wallet, mint")
        for wallet, _mint, n, buy_usd, buy_tok, sell_usd, sell_tok in self.db.execute(q):
            s = out.setdefault(wallet, WalletScore(wallet, 0, 0, 0, 0.0, 0, wallet in self.manual))
            s.tokens_traded += 1
            s.max_trades_per_token = max(s.max_trades_per_token, n)
            if buy_tok <= 0 or sell_tok < 0.5 * buy_tok:
                continue  # achat non observé ou position encore ouverte : pas de PnL réalisé fiable
            sold = min(sell_tok, buy_tok)
            pnl = sell_usd * (sold / sell_tok) - buy_usd * (sold / buy_tok)
            s.closed_tokens += 1
            s.wins += pnl > 0
            s.realized_pnl_usd += pnl
        for w in self.manual:
            out.setdefault(w, WalletScore(w, 0, 0, 0, 0.0, 0, True))
        return out

    def smart_wallets(self) -> set[str]:
        return {w for w, s in self.scores().items() if s.is_smart(self.rules)}

    def top_wallets(self, n: int = 20) -> list[dict]:
        ranked = sorted((s for s in self.scores().values() if s.is_smart(self.rules)),
                        key=lambda s: s.realized_pnl_usd, reverse=True)
        return [s.to_dict() for s in ranked[:n]]

    # --- achats smart ---------------------------------------------------------------
    def smart_buys(self, smart: set[str] | None = None, window_min: float | None = None) -> dict[str, dict]:
        """Par jeton : wallets smart ayant acheté (≥ min_buy_usd) dans la fenêtre, prix d'entrée moyen."""
        smart = self.smart_wallets() if smart is None else smart
        since = self.clock() - 60 * (window_min if window_min is not None else self.rules.window_min)
        out: dict[str, dict] = {}
        for wallet, mint, usd, tokens, price, ts in self.db.execute(
                "SELECT wallet, mint, usd, tokens, price_usd, ts FROM sm_trades "
                "WHERE side='buy' AND ts >= ? AND usd >= ? ORDER BY ts", (since, self.rules.min_buy_usd)):
            if wallet not in smart:
                continue
            m = out.setdefault(mint, {"wallets": set(), "usd": 0.0, "tokens": 0.0, "first_ts": ts, "last_ts": ts})
            m["wallets"].add(wallet)
            m["usd"] += usd
            m["tokens"] += tokens
            m["last_ts"] = ts
        for m in out.values():
            m["entry_price_usd"] = m["usd"] / m["tokens"]
        return out

    def candidates(self) -> list[tuple[str, dict]]:
        """Jetons achetés par au moins `min_wallets` wallets smart, les plus suivis d'abord."""
        buys = self.smart_buys()
        ok = [(mint, b) for mint, b in buys.items() if len(b["wallets"]) >= self.rules.min_wallets]
        return sorted(ok, key=lambda x: (len(x[1]["wallets"]), x[1]["usd"]), reverse=True)

    def peak_price_since(self, mint: str, since_ts: float) -> float | None:
        r = self.db.execute("SELECT MAX(price_usd) FROM sm_trades WHERE mint=? AND ts>=?", (mint, since_ts)).fetchone()
        return r[0] if r else None

    def tracker(self, current_prices: dict[str, float | None], window_h: float = 24.0) -> list[dict]:
        """Vue « TOKEN TRACKER » : wallets smart investis, multiple moyen et maximal, dernier achat."""
        buys = self.smart_buys(window_min=60 * window_h)
        now, rows = self.clock(), []
        for mint, b in buys.items():
            entry, cur = b["entry_price_usd"], current_prices.get(mint)
            peak = max(filter(None, [self.peak_price_since(mint, b["first_ts"]), cur]), default=None)
            rows.append({
                "mint": mint,
                "smart_wallets": len(b["wallets"]),
                "invested_usd": round(b["usd"], 2),
                "entry_price_usd": entry,
                "current_multiple": round(cur / entry, 2) if cur else None,   # None = prix indisponible
                "best_multiple": round(peak / entry, 2) if peak else None,
                "last_buy_min_ago": round((now - b["last_ts"]) / 60, 1),
            })
        return sorted(rows, key=lambda r: (r["smart_wallets"], r["invested_usd"]), reverse=True)

    def stats(self) -> dict:
        n, wallets, mints = self.db.execute(
            "SELECT COUNT(*), COUNT(DISTINCT wallet), COUNT(DISTINCT mint) FROM sm_trades").fetchone()
        return {"trades": n, "wallets": wallets, "tokens": mints, "smart_wallets": len(self.smart_wallets())}

    def prune(self, keep_days: float = 14.0) -> None:
        self.db.execute("DELETE FROM sm_trades WHERE ts < ?", (self.clock() - keep_days * 86400,))
        self.db.commit()
