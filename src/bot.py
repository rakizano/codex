"""Boucle principale : découverte -> sécurité -> momentum -> social -> (LLM) -> taille -> entrée,
puis suivi des positions (partielles, stop suiveur) et collecte de données pour l'optimiseur.

Usage :
  python3 scripts/run_bot.py run            # boucle continue (scan + suivi + collecte)
  python3 scripts/run_bot.py scan           # un seul cycle de découverte
  python3 scripts/run_bot.py audit <MINT>   # audit d'un jeton
  python3 scripts/run_bot.py monitor        # réévalue les positions ouvertes
  python3 scripts/run_bot.py track          # enregistre un instantané de prix des jetons suivis
  python3 scripts/run_bot.py report         # bilan
  python3 scripts/run_bot.py backtest       # rejoue les réglages actuels sur les données collectées
  python3 scripts/run_bot.py optimize       # cherche les meilleurs réglages (validation hors échantillon)
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
from social import SocialChecker, evaluate_social
from strategy.backtest import DataStore, backtest, optimize
from strategy.entry import FEATURES, evaluate_entry
from strategy.sizing import position_size

log = logging.getLogger("bot")
SEEN_TTL_S = 6 * 3600
LAMPORTS = 1_000_000_000


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
                                    settings.thresholds, settings.audit_size_sol, settings.max_slippage_bps)
        self.trader = PaperTrader(settings.db_path, settings.exit_rules, settings.daily_max_loss_sol,
                                  settings.max_open_positions,
                                  tip_sol=settings.jito_tip_lamports / LAMPORTS,
                                  ref_size_sol=settings.position_size_sol,
                                  reentry_cooldown_h=settings.reentry_cooldown_h,
                                  bankroll_sol=settings.paper_bankroll_sol)
        self.data = DataStore(settings.db_path)
        self.social = SocialChecker(settings, self.cache, self.client) if settings.social_enabled else None
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
        """Sources gratuites : profils et boosts DexScreener récents, top boosts, pools en tendance
        GeckoTerminal. Une source en panne est ignorée ; le mint est validé ensuite par l'audit."""
        results = await asyncio.gather(self.dex.latest_profiles(), self.dex.latest_boosts(),
                                       self.dex.top_boosts(), self.gecko.trending_mints(),
                                       return_exceptions=True)
        candidates: list[str] = []
        for res in results:
            if isinstance(res, BaseException):
                log.warning("source de découverte indisponible : %s", res)
                continue
            for item in res:
                mint = item.get("tokenAddress") if isinstance(item, dict) else item
                if isinstance(mint, str):
                    candidates.append(mint)
        mints: list[str] = []
        for mint in candidates:
            if mint not in mints and self.cache.get(f"seen:{mint}") is None:
                mints.append(mint)
        return mints

    # --- taille -------------------------------------------------------------------
    async def bankroll(self) -> float:
        if self.live:
            try:
                res = await self.rpc.call("getBalance", [self.executor.pubkey])
                return int(res["value"]) / LAMPORTS
            except Exception:
                return 0.0
        return self.trader.bankroll()

    async def size_for_entry(self):
        cap = self.s.max_position_sol
        if self.live:
            cap = min(cap, self.s.live_max_position_sol)
        return position_size(self.s.sizing_mode, self.s.position_size_sol, cap, await self.bankroll(),
                             self.trader.summary(), self.s.min_trades_for_sizing, self.s.kelly_multiplier)

    def _estimated_cost_pct(self, audit) -> float:
        """Coût aller-retour estimé à la taille de position : frais + pourboires + 2 x impact prix."""
        impact = audit.metrics.buy_price_impact_pct or 0.0
        scaled = impact * self.s.position_size_sol / self.s.audit_size_sol
        return self.trader.roundtrip_cost_pct(self.s.position_size_sol) + 2 * scaled

    # --- un jeton ---------------------------------------------------------------
    async def process(self, mint: str) -> dict:
        self.cache.set(f"seen:{mint}", 1, SEEN_TTL_S)
        audit = await self.detector.audit(mint)
        flags = list(audit.flags)
        final = "REJECT"

        if audit.verdict == "WATCHLIST_PAPER":
            # 1. Données pour l'optimiseur : tout jeton SAIN est suivi, qu'on y entre ou non.
            feats = {k: audit.observations.get(k) for k in FEATURES}
            feats.update({k: audit.observations.get(k) for k in ("price_change_m5", "price_change_h6",
                                                                 "volume_h24_usd", "fdv_usd")})
            self.data.record_observation(mint, audit.observations.get("price_usd"),
                                         self._estimated_cost_pct(audit), feats)
            # 2. Momentum (rentabilité)
            entry_ok, entry_flags = evaluate_entry(audit.observations, self.s.entry_rules)
            flags += entry_flags
            final = "PAPER_ENTRY" if entry_ok else "MOMENTUM_REJECT"

        # 3. Social (ne peut qu'empêcher ; seulement si le reste est bon, pour ménager les quotas)
        if final == "PAPER_ENTRY" and self.social is not None:
            sig = await self.social.check(mint, audit.symbol, audit.observations)
            social_ok, social_flags = evaluate_social(sig, self.s)
            flags += social_flags
            audit.observations.update(sig.to_metrics())  # nombres uniquement -> payload LLM
            if not social_ok:
                final = "SOCIAL_REJECT"

        # 4. LLM optionnel (ne peut qu'abaisser)
        llm = None
        if final == "PAPER_ENTRY" and self.analyzer is not None:
            llm = await self.analyzer.analyze(audit.to_llm_payload(), audit.untrusted_block)
            final = combine("WATCHLIST_PAPER", llm, self.require_llm)
        elif final == "PAPER_ENTRY":
            final = combine("WATCHLIST_PAPER", None, self.require_llm)

        self.trader.record_audit(mint, audit.verdict if final in ("PAPER_ENTRY", "REJECT") else final,
                                 flags, llm.get("verdict") if llm else None)

        opened, size_info = None, None
        if final == "PAPER_ENTRY":
            ok, why = self.trader.can_open(mint)
            sizing = await self.size_for_entry() if ok else None
            if ok and sizing.size_sol <= 0:
                ok, why = False, sizing.reason
            if ok:
                size_info = {"size_sol": round(sizing.size_sol, 4), "sizing": sizing.reason}
                if self.live:
                    opened, final = await self._live_entry(mint, sizing.size_sol, audit.buy_quote,
                                                           audit.observations.get("price_usd"))
                else:
                    pos = self.trader.open(mint, sizing.size_sol, audit.buy_quote, self.s.audit_size_sol,
                                           audit.observations.get("price_usd"))
                    opened = pos.id if pos else None
            else:
                final = f"PAPER_ENTRY_BLOCKED:{why}"
        log.info("%s -> %s (%s)%s", mint, final, ",".join(flags) or "aucun drapeau",
                 f" position #{opened} {size_info}" if opened else "")
        return {"mint": mint, "deterministic": audit.verdict, "final": final,
                "flags": flags, "position_id": opened, "size": size_info}

    async def _live_entry(self, mint: str, size: float, audit_quote: dict | None,
                          entry_price_usd: float | None = None) -> tuple[int | None, str]:
        try:
            res = await self.executor.buy(mint, size)
        except Exception as e:
            log.error("achat LIVE %s annulé : %s", mint, e)
            return None, f"LIVE_ENTRY_FAILED:{type(e).__name__}"
        impact = (audit_quote or {}).get("priceImpactPct")
        real_size = res.in_amount / LAMPORTS
        pos = self.trader.open(mint, real_size, {"outAmount": str(res.expected_out), "priceImpactPct": impact},
                               entry_price_usd=entry_price_usd)
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

    async def fast_watch_once(self) -> list[dict]:
        """Toutes les quelques secondes : un seul appel DexScreener pour toutes les positions ;
        seules celles proches d'un seuil sont réévaluées immédiatement par devis Jupiter."""
        positions = self.trader.open_positions()
        if not positions:
            return []
        prices = await self.dex.prices([p.mint for p in positions])
        urgent = {p.mint for p in positions if self.trader.near_exit(p, (prices.get(p.mint) or (None,))[0])}
        return await self.monitor_once(urgent) if urgent else []

    async def monitor_once(self, only_mints: set[str] | None = None) -> list[dict]:
        events = []
        for pos in self.trader.open_positions():
            if only_mints is not None and pos.mint not in only_mints:
                continue
            value = await self.jup.sell_value_sol(pos.mint, pos.token_amount, self.s.max_slippage_bps)
            decision = self.trader.evaluate(pos, value)
            if decision is None:
                continue
            event = {"id": pos.id, "mint": pos.mint, "action": decision.action, "reason": decision.reason}
            if self.live:
                try:
                    res = await (self.executor.sell_fraction(pos.mint, decision.fraction)
                                 if decision.action == "SELL_PARTIAL" else self.executor.sell_all(pos.mint))
                    event["signature"] = res.signature if res else None
                except Exception as e:  # vente échouée : la position reste ouverte, retentée au cycle suivant
                    log.error("vente LIVE %s échouée (%s), nouvel essai au prochain cycle", pos.mint, e)
                    continue
            if decision.action == "SELL_PARTIAL":
                event["proceeds_sol"] = self.trader.partial_close(pos, value, decision.fraction)
                log.info("vente partielle #%d %s : %s (%.0f %%), %.4f SOL encaissés", pos.id, pos.mint,
                         decision.reason, decision.fraction * 100, event["proceeds_sol"])
            else:
                event["pnl_sol"] = self.trader.close(pos, value, decision.reason)
                log.info("clôture #%d %s : %s, PnL %.4f SOL", pos.id, pos.mint, decision.reason, event["pnl_sol"])
            events.append(event)
        return events

    async def track_once(self) -> int:
        """Instantané prix/liquidité des jetons sains observés récemment (pour le backtest)."""
        mints = self.data.tracked_mints(self.s.track_window_h)
        if not mints:
            return 0
        prices = await self.dex.prices(mints)
        rows = [(m, *prices.get(m, (None, None))) for m in mints]
        self.data.record_snapshots(rows)
        return len(rows)

    async def run(self, max_cycles: int | None = None) -> None:
        log.info("démarrage en mode %s : %s", "LIVE" if self.live else "PAPER",
                 json.dumps(self.s.redacted(), default=str))
        next_scan = next_track = next_monitor = 0.0
        cycles = 0
        while max_cycles is None or cycles < max_cycles:
            now = time.monotonic()
            if now >= next_scan:
                await self.scan_once()
                next_scan = now + self.s.scan_interval_s
            if now >= next_monitor:
                await self.monitor_once()
                next_monitor = time.monotonic() + self.s.monitor_interval_s
            else:
                try:
                    await self.fast_watch_once()
                except Exception:
                    log.exception("surveillance rapide en échec (ignorée)")
            if now >= next_track:
                try:
                    await self.track_once()
                except Exception:
                    log.exception("collecte de prix en échec (ignorée)")
                next_track = now + self.s.track_interval_s
            cycles += 1
            await asyncio.sleep(self.s.fast_check_interval_s)

    def report(self) -> dict:
        out = self.trader.summary()
        out["data_collected"] = self.data.stats()
        return out

    async def report_with_open_positions(self) -> dict:
        """Bilan + valeur latente des positions ouvertes (devis de sortie Jupiter actuels)."""
        out = self.report()
        rows, unrealized = [], 0.0
        for pos in self.trader.open_positions():
            value = await self.jup.sell_value_sol(pos.mint, pos.token_amount, self.s.max_slippage_bps)
            pnl = self.trader.pnl_pct(pos, value)
            net_now = pos.realized_sol + (self.trader.net_exit_value(value) if value is not None else 0.0)
            unrealized += net_now - pos.size_sol
            rows.append({"id": pos.id, "mint": pos.mint, "size_sol": pos.size_sol,
                         "held_min": round((time.time() - pos.opened_at) / 60),
                         "pnl_remaining_pct": round(pnl, 1) if pnl is not None else None,
                         "peak_pct": round(pos.peak_pnl_pct, 1), "tp1_done": pos.tp1_done})
        out["open_positions"] = rows
        out["unrealized_pnl_sol"] = round(unrealized, 6)
        return out

    def run_backtest(self) -> dict:
        res, trades = backtest(self.data.load_paths(), self.s.entry_rules, self.s.exit_rules)
        res["exit_reasons"] = {}
        for t in trades:
            res["exit_reasons"][t.reason] = res["exit_reasons"].get(t.reason, 0) + 1
        return res

    def run_optimize(self, min_train_trades: int = 15) -> dict:
        res = optimize(self.data.load_paths(), self.s.entry_rules, self.s.exit_rules,
                       min_train_trades=min_train_trades)
        if min_train_trades < 15:
            res["warning"] = (f"Exploration sur petit échantillon (min {min_train_trades} trades en train) : "
                              "résultats très incertains, ne PAS s'en servir pour passer en réel.")
        return res

    async def aclose(self) -> None:
        if self.analyzer:
            await self.analyzer.aclose()
        if self.social:
            await self.social.aclose()
        await self.client.aclose()
        self.cache.close()
        self.trader.close_db()
        self.data.close()


def build_bot(require_llm: bool = False) -> Bot:
    s = Settings.from_env()
    analyzer = OllamaAnalyzer(s.ollama_url, s.ollama_model) if s.ollama_url else None
    return Bot(s, analyzer=analyzer, require_llm=require_llm)


async def _main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Bot d'audit & trading de meme coins Solana")
    ap.add_argument("-v", "--verbose", action="store_true")
    ap.add_argument("--require-llm", action="store_true",
                    default=os.environ.get("REQUIRE_LLM", "").lower() in ("1", "true"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("run", "scan", "monitor", "track", "report", "backtest"):
        sub.add_parser(name)
    op = sub.add_parser("optimize")
    op.add_argument("--min-train-trades", type=int, default=15)
    au = sub.add_parser("audit")
    au.add_argument("mint")
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
        elif a.cmd == "track":
            print(json.dumps({"snapshots_recorded": await bot.track_once()}))
        elif a.cmd == "report":
            print(json.dumps(await bot.report_with_open_positions(), indent=2, ensure_ascii=False))
        elif a.cmd == "backtest":
            print(json.dumps(bot.run_backtest(), indent=2, ensure_ascii=False))
        elif a.cmd == "optimize":
            print(json.dumps(bot.run_optimize(a.min_train_trades), indent=2, ensure_ascii=False))
    finally:
        await bot.aclose()
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return asyncio.run(_main(argv))
    except KeyboardInterrupt:
        return 130
