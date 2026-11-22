"""Boucle principale : découverte -> audit déterministe -> (LLM optionnel) -> paper trading.

Usage :
  python3 scripts/run_bot.py run            # boucle continue
  python3 scripts/run_bot.py scan           # un seul cycle de découverte
  python3 scripts/run_bot.py audit <MINT>   # audit d'un jeton
  python3 scripts/run_bot.py report         # bilan du paper trading
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time

import httpx

from analyzer import OllamaAnalyzer, combine
from cache import TTLCache
from config import PAPER, Settings
from fetchers import DexScreener, GeckoTerminal, Jupiter, RugCheck, SolanaRpc
from filters.rug_detector import RugDetector
from paper_trader import PaperTrader

log = logging.getLogger("bot")
SEEN_TTL_S = 6 * 3600


class Bot:
    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None,
                 analyzer: OllamaAnalyzer | None = None, require_llm: bool = False, executor=None):
        self.s = settings
        self.client = client or httpx.AsyncClient(timeout=15)
        self.cache = TTLCache(settings.db_path.replace(".sqlite3", "_cache.sqlite3")
                              if settings.db_path != ":memory:" else ":memory:")
        self.dex = DexScreener(self.client)
        self.gecko = GeckoTerminal(self.cache, self.client)
        self.rug = RugCheck(self.client)
        self.jup = Jupiter(self.client)
        self.rpc = SolanaRpc(settings.helius_rpc_url, settings.chainstack_rpc_url, self.client)
        self.detector = RugDetector(self.dex, self.rug, self.gecko, self.jup, self.rpc,
                                    settings.thresholds, settings.position_size_sol, settings.max_slippage_bps)
        self.trader = PaperTrader(settings.db_path, settings.stop_loss_pct, settings.take_profit_pct,
                                  settings.max_hold_minutes, settings.daily_max_loss_sol,
                                  settings.max_open_positions)
        self.analyzer = analyzer
        self.require_llm = require_llm

        # Exécution réelle : uniquement si toutes les conditions de live.executor sont réunies.
        self.executor = executor
        if settings.execution_mode != PAPER and executor is None:
            from live.executor import build_live_executor
            from tx_builder import ExecutionDisabled
            try:
                self.executor = build_live_executor(settings, self.rpc, self.jup, self.client,
                                                    self.trader.circuit_breaker_tripped)
            except (ExecutionDisabled, OSError, ValueError) as e:
                raise SystemExit(f"Mode LIVE refusé : {e}") from None
        if self.executor is not None:
            log.warning("MODE LIVE ACTIF — wallet %s, %.3f SOL max par position, fonds réels en jeu",
                         self.executor.pubkey, settings.live_max_position_sol)

    @property
    def live(self) -> bool:
        return self.executor is not None

    # --- découverte -------------------------------------------------------------
    async def discover(self) -> list[str]:
        profiles, boosts = await asyncio.gather(self.dex.latest_profiles(), self.dex.latest_boosts())
        mints: list[str] = []
        for item in [*profiles, *boosts]:
            mint = item.get("tokenAddress")
            if mint and mint not in mints and self.cache.get(f"seen:{mint}") is None:
                mints.append(mint)
        return mints

    # --- un jeton ---------------------------------------------------------------
    async def process(self, mint: str) -> dict:
        self.cache.set(f"seen:{mint}", 1, SEEN_TTL_S)
        audit = await self.detector.audit(mint)
        llm = None
        if audit.verdict == "WATCHLIST_PAPER" and self.analyzer is not None:
            llm = await self.analyzer.analyze(audit.to_llm_payload(), audit.untrusted_block)
        final = combine(audit.verdict, llm, self.require_llm)
        self.trader.record_audit(mint, audit.verdict, audit.flags, llm.get("verdict") if llm else None)

        opened = None
        if final == "PAPER_ENTRY":
            ok, why = self.trader.can_open(mint)
            if ok and self.live:
                opened, final = await self._live_entry(mint, audit.buy_quote)
            elif ok:
                pos = self.trader.open(mint, self.s.position_size_sol, audit.buy_quote)
                opened = pos.id if pos else None
            else:
                final = f"PAPER_ENTRY_BLOCKED:{why}"
        log.info("%s -> %s (%s)%s", mint, final, ",".join(audit.flags) or "aucun drapeau",
                 f" position #{opened}" if opened else "")
        return {"mint": mint, "deterministic": audit.verdict, "final": final,
                "flags": audit.flags, "position_id": opened}

    async def _live_entry(self, mint: str, audit_quote: dict | None) -> tuple[int | None, str]:
        size = min(self.s.position_size_sol, self.s.live_max_position_sol)
        try:
            res = await self.executor.buy(mint, size)
        except Exception as e:
            log.error("achat LIVE %s annulé : %s", mint, e)
            return None, f"LIVE_ENTRY_FAILED:{type(e).__name__}"
        impact = (audit_quote or {}).get("priceImpactPct")
        pos = self.trader.open(mint, size, {"outAmount": str(res.expected_out), "priceImpactPct": impact})
        return (pos.id if pos else None), ("LIVE_ENTRY" if res.confirmed else "LIVE_ENTRY_UNCONFIRMED")

    # --- cycles -----------------------------------------------------------------
    async def scan_once(self) -> list[dict]:
        if self.trader.circuit_breaker_tripped():
            log.warning("coupe-circuit actif : pas de nouvelle entrée pendant 24 h glissantes")
            return []
        results = []
        for mint in await self.discover():
            try:
                results.append(await self.process(mint))
            except Exception:
                log.exception("audit de %s en échec (ignoré)", mint)
        return results

    async def monitor_once(self) -> list[dict]:
        closed = []
        for pos in self.trader.open_positions():
            value = await self.jup.sell_value_sol(pos.mint, pos.token_amount, self.s.max_slippage_bps)
            reason = self.trader.evaluate_exit(pos, value)
            if not reason:
                continue
            entry = {"id": pos.id, "reason": reason}
            if self.live:
                try:
                    res = await self.executor.sell_all(pos.mint)
                    entry["signature"] = res.signature if res else None
                except Exception as e:  # vente échouée : la position reste ouverte, retentée au cycle suivant
                    log.error("vente LIVE %s échouée (%s), nouvel essai au prochain cycle", pos.mint, e)
                    continue
            pnl = self.trader.close(pos, value, reason)
            log.info("clôture #%d %s : %s, PnL %.4f SOL", pos.id, pos.mint, reason, pnl)
            entry["pnl_sol"] = pnl
            closed.append(entry)
        return closed

    async def run(self, max_cycles: int | None = None) -> None:
        log.info("démarrage en mode %s : %s", "LIVE" if self.live else "PAPER",
                 json.dumps(self.s.redacted(), default=str))
        next_scan = 0.0
        cycles = 0
        while max_cycles is None or cycles < max_cycles:
            now = time.monotonic()
            if now >= next_scan:
                await self.scan_once()
                next_scan = now + self.s.scan_interval_s
            await self.monitor_once()
            cycles += 1
            await asyncio.sleep(self.s.monitor_interval_s)

    async def aclose(self) -> None:
        if self.analyzer:
            await self.analyzer.aclose()
        await self.client.aclose()
        self.cache.close()
        self.trader.close_db()


def build_bot(require_llm: bool = False) -> Bot:
    s = Settings.from_env()
    analyzer = OllamaAnalyzer(s.ollama_url, s.ollama_model) if s.ollama_url else None
    return Bot(s, analyzer=analyzer, require_llm=require_llm)


async def _main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Bot d'audit & paper-trading meme coins Solana")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--require-llm", action="store_true",
                    default=os.environ.get("REQUIRE_LLM", "").lower() in ("1", "true"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("run")
    sub.add_parser("scan")
    au = sub.add_parser("audit")
    au.add_argument("mint")
    sub.add_parser("monitor")
    sub.add_parser("report")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if a.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if not a.verbose:
        logging.getLogger("httpx").setLevel(logging.WARNING)

    bot = build_bot(a.require_llm)
    try:
        if a.cmd == "run":
            await bot.run()
        elif a.cmd == "scan":
            print(json.dumps(await bot.scan_once(), indent=2, ensure_ascii=False))
        elif a.cmd == "audit":
            print(json.dumps(await bot.process(a.mint), indent=2, ensure_ascii=False))
        elif a.cmd == "monitor":
            print(json.dumps(await bot.monitor_once(), indent=2))
        elif a.cmd == "report":
            print(json.dumps(bot.trader.summary(), indent=2))
    finally:
        await bot.aclose()
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return asyncio.run(_main(argv))
    except KeyboardInterrupt:
        return 130
