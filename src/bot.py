"""Boucle principale : découverte -> sécurité -> momentum -> social -> (LLM) -> taille -> entrée,
puis suivi des positions (partielles, stop suiveur) et collecte de données pour l'optimiseur.

Usage :
  python3 scripts/run_bot.py run            # boucle continue (scan + suivi + collecte)
  python3 scripts/run_bot.py scan           # un seul cycle de découverte
  python3 scripts/run_bot.py smart          # moteur smart money : meilleurs wallets et leurs achats
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
import math
import os
import time
from collections import deque
from datetime import datetime, timezone

import httpx

from analyzer import OllamaAnalyzer, combine
from cache import TTLCache
from config import PAPER, Settings
from memecoin.filters import is_valid_mint
from fetchers import CopyTop, DexScreener, GeckoTerminal, Jupiter, RugCheck, SolanaRpc
from filters.rug_detector import RugDetector
from paper_trader import PaperTrader
from smart import SmartMoneyBook
from social import SocialChecker, evaluate_social
from filters.holders import CreatorHistory, InsiderRules
from smart.copytop_engine import (MigrationWatchlist, eligible_cohort, migrated_pair, still_in,
                                  watchlist_admissible)
from fetchers.copytop import parse_ts, valid_handle
from strategy.backtest import DataStore, WFConfig, backtest_report, optimize
from strategy.entry import FEATURES, evaluate_entry, is_selection_only_rejection
from strategy.risk import MacroRegime, quote_slippage_pct
from strategy.shadow import ShadowLedger
from strategy.sizing import position_size
from strategy.volatility import atr_pct, m5_proxy
from config import HARD_MAX_POSITION_SOL

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
        self.detector = RugDetector(
            self.dex, self.rug, self.gecko, self.jup, self.rpc, settings.thresholds, settings.audit_size_sol,
            settings.max_slippage_bps,
            insider_rules=InsiderRules(settings.insider_check_enabled, max_wallets=settings.insider_max_wallets,
                                       max_holding_pct=settings.insider_max_holding_pct),
            creator_history=CreatorHistory(self.rpc, self.cache) if self.rpc.configured else None,
            creator_max_tokens_7d=settings.creator_max_tokens_7d,
            creator_check_required=settings.creator_check_required)
        self.trader = PaperTrader(settings.db_path, settings.exit_rules, settings.daily_max_loss_sol,
                                  settings.max_open_positions,
                                  tip_sol=settings.jito_tip_lamports / LAMPORTS,
                                  ref_size_sol=settings.position_size_sol,
                                  reentry_cooldown_h=settings.reentry_cooldown_h,
                                  bankroll_sol=settings.paper_bankroll_sol,
                                  # En LIVE, uniquement l'ancienne logique de sortie (aucune nouvelle
                                  # condition ne peut déclencher un ordre réel).
                                  legacy=settings.execution_mode != PAPER,
                                  source_cb_max_losses=settings.source_cb_max_losses)
        self.data = DataStore(settings.db_path)
        self.social = SocialChecker(settings, self.cache, self.client) if settings.social_enabled else None
        self.analyzer = analyzer
        self.require_llm = require_llm
        # Moteur 2 : Smart Money
        self.smart = SmartMoneyBook(settings.db_path, settings.smart_rules) if settings.smart_enabled else None
        self._pools: deque[tuple[str, str]] = deque()   # (pool, mint) interrogés à tour de rôle
        self._smart_buys: dict[str, dict] = {}          # dernier état des achats smart, par jeton
        self._smart_cycles = 0
        self.copytop = CopyTop(self.client, self.cache) if settings.copytop_enabled else None
        self.watchlist = MigrationWatchlist(settings.db_path, settings.copytop_wait_migration_ttl_min,
                                            settings.copytop_watchlist_max_size)
        self.shadow = ShadowLedger(settings.db_path, settings.shadow_price_check_minutes) \
            if settings.shadow_ledger_enabled else None
        self.macro = MacroRegime(self.dex, settings.sol_drop_h1_limit_pct) if settings.macro_filter_enabled else None
        self._ct_signals: dict[int, tuple[bool, bool]] = {}   # position -> (distribution, désengagement)

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
                                       self.dex.top_boosts(), self.gecko.trending_pools(),
                                       return_exceptions=True)
        if not isinstance(results[3], BaseException):
            self._remember_pools(results[3])
            results[3] = [mint for _, mint in results[3]]
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
        # Analyse croisée : les jetons déjà achetés par des wallets smart passent en premier.
        return sorted(mints, key=lambda m: -len(self._smart_buys.get(m, {}).get("wallets", ())))

    async def _cohort_in(self, mint: str, cohort: list[str]) -> list[str] | None:
        """Membres de la cohorte encore en position (page jeton copy.top) ; None si inconnu."""
        holding = await self.copytop.coin_holding(mint)
        n, unknown = still_in(holding, cohort)
        if n is None:
            return None
        return [h for h in cohort if holding.get(h) is True]

    async def copytop_once(self) -> list[dict]:
        """Alertes de confluence copy.top. Chaque signal doit être porté par >= 2 traders ADMISSIBLES
        (fair play clean, détention moyenne >= 5 min) toujours en position ; le jeton passe ensuite
        par l'audit de sécurité complet. Un rejet dû UNIQUEMENT à l'absence de pool AMM
        (UNKNOWN_LIQUIDITY : jeton encore sur la courbe Pump.fun) place le jeton en file de migration."""
        if self.copytop is None or self.trader.circuit_breaker_tripped():
            return []
        cursor = self.cache.get("copytop:cursor")
        events, cursor = await self.copytop.confluence_alerts(cursor, self.s.copytop_min_top_traders)
        if cursor:
            self.cache.set("copytop:cursor", cursor, 7 * 86400)
        results, now = [], time.time()
        for e in events:
            mint, at = e.get("token"), parse_ts(e.get("at"))
            try:
                top_still_in, mcap = int(e.get("topStillIn") or 0), float(e.get("mcap") or 0)
            except (TypeError, ValueError):
                continue
            if not is_valid_mint(mint) or at is None or (now - at) / 60 > self.s.copytop_max_signal_age_min:
                continue  # signal invalide ou trop ancien : on ne court pas après
            if self.cache.get(f"ct_seen:{mint}") is not None or top_still_in < self.s.copytop_min_still_in:
                continue
            self.cache.set(f"ct_seen:{mint}", 1, 2 * 3600)
            buyers = [h for h in e.get("buyers") or [] if valid_handle(h)] if isinstance(e.get("buyers"), list) else []
            cohort = await eligible_cohort(self.copytop, buyers, self.s.copytop_only_clean_fairplay,
                                           self.s.copytop_min_avg_hold_min)
            if len(cohort) < self.s.copytop_min_eligible_traders:
                self.trader.record_audit(mint, "COPYTOP_REJECT", [f"COHORT_INELIGIBLE({len(cohort)})"])
                continue
            cohort_in = await self._cohort_in(mint, cohort)
            if cohort_in is None or len(cohort_in) < self.s.copytop_min_still_in:
                self.trader.record_audit(mint, "COPYTOP_REJECT",
                                         ["STILL_IN_UNKNOWN" if cohort_in is None else f"STILL_IN_LOW({len(cohort_in)})"])
                continue
            buys = {"n_wallets": len(cohort_in), "min_wallets": self.s.copytop_min_still_in,
                    "usd": float(e.get("boughtUsd") or 0), "entry_mcap_usd": mcap or None, "buyers": cohort_in}
            log.info("%s : signal copy.top, %d traders admissibles encore en position", mint, len(cohort_in))
            try:
                res = await self.process(mint, smart=buys, engine="copytop")
            except Exception:
                log.exception("audit de %s en échec (ignoré)", mint)
                continue
            if res["deterministic"] == "REJECT" and watchlist_admissible(res["flags"]):
                res["watchlist"] = self.watchlist.add(mint, cohort_in)
                log.info("%s : en attente de migration (%s)", mint, res["watchlist"])
            results.append(res)
        return results

    async def watchlist_once(self) -> list[dict]:
        """Surveillance passive des jetons en attente de migration (DexScreener batch). Aucun achat
        avant pool AMM migré confirmé, cohorte encore présente et audit COMPLET réussi."""
        if self.copytop is None:
            return []
        waiting = self.watchlist.waiting()
        if not waiting:
            return []
        pairs = await self.dex.pairs_batch([m for m, _ in waiting])
        if pairs is None:
            return []     # erreur réseau : la file est conservée
        results = []
        for mint, cohort in waiting:
            pair = migrated_pair(pairs.get(mint), mint, self.s.thresholds.min_liquidity_usd)
            if pair is None:
                self.watchlist.touch(mint)
                continue
            cohort_in = await self._cohort_in(mint, cohort)
            if cohort_in is None:
                self.watchlist.touch(mint)        # donnée inconnue : pas d'achat, on garde le jeton
                continue
            if len(cohort_in) < self.s.copytop_min_still_in:
                self.watchlist.mark(mint, "DONE", f"COHORT_EXITED({len(cohort_in)})")
                continue
            buys = {"n_wallets": len(cohort_in), "min_wallets": self.s.copytop_min_still_in, "usd": 0.0,
                    "entry_mcap_usd": None, "entry_price_usd": None, "buyers": cohort_in,
                    "post_migration": True, "migration_dex": pair.get("dexId")}
            res = await self.process(mint, smart=buys, engine="copytop")
            extra = [f for f in res["flags"] if f not in res.get("audit_flags", [])]
            if res["final"] == "SMART_REJECT" and any(f.startswith(("PAIR_TOO_YOUNG", "COPYTOP_POOL_TOO_YOUNG"))
                                                      for f in extra) and \
                    all(f.startswith(("PAIR_TOO_YOUNG", "COPYTOP_POOL_TOO_YOUNG", "SMART_WALLETS", "CHASE_REF"))
                        for f in extra):
                self.watchlist.touch(mint)        # pool trop jeune : on réessaiera avant expiration
            else:
                self.watchlist.mark(mint, "DONE", res["final"])
            res["migration_dex"] = pair.get("dexId")
            results.append(res)
        return results

    async def copytop_exit_once(self) -> dict[int, tuple[bool, bool]]:
        """Pour les positions copy.top uniquement : ventes de la cohorte (flux de trades, curseur PROPRE
        à chaque position) et présence (page jeton). -> {position: (distribution, désengagement)}."""
        out: dict[int, tuple[bool, bool]] = {}
        if self.copytop is None or self.live:
            return out
        now = time.time()
        for pos in self.trader.open_positions():
            if pos.source != "copytop" or len(pos.signal_buyers) < self.s.copytop_exit_min_sellers:
                continue
            key = f"ct_exit_poll:{pos.id}"
            if self.cache.get(key) is not None:
                out[pos.id] = self._ct_signals.get(pos.id, (False, False))
                continue
            self.cache.set(key, now, 55)       # au plus une interrogation par minute et par position
            cohort = list(pos.signal_buyers)
            since = pos.copytop_cursor or datetime.fromtimestamp(pos.opened_at, timezone.utc).isoformat().replace("+00:00", "Z")
            trades, cursor = await self.copytop.live_sells(since, cohort, self.s.copytop_exit_min_usd)
            sellers = set()
            for t in trades:
                at, usd = parse_ts(t.get("at")), t.get("usd")
                if (t.get("token") == pos.mint and t.get("handle") in cohort and at is not None
                        and at >= pos.opened_at and isinstance(usd, (int, float)) and math.isfinite(usd)
                        and usd >= self.s.copytop_exit_min_usd):
                    sellers.add(t["handle"])
            if cursor and cursor != pos.copytop_cursor:
                self.trader.set_copytop_cursor(pos, cursor)
            holding = await self.copytop.coin_holding(pos.mint)
            n_in, unknown = still_in(holding, cohort)
            if holding is not None:
                # Seule une sortie CONFIRMÉE (holding == false) compte ; un trader absent de la page = inconnu.
                sellers |= {h for h in cohort if holding.get(h) is False}
            if sellers:
                n = self.trader.add_copytop_sales(pos, sorted(sellers))
                log.info("%s : %d/%d traders de la cohorte ont vendu", pos.mint, n, len(cohort))
            distribution = self.trader.copytop_exit_ready(pos, self.s.copytop_exit_min_sellers,
                                                          self.s.copytop_exit_ratio)
            # Désengagement seulement si la présence de TOUTE la cohorte est connue (donnée fiable).
            disengaged = (self.s.copytop_exit_on_drop_below_min and n_in is not None and unknown == 0
                          and n_in < self.s.copytop_min_still_in)
            out[pos.id] = self._ct_signals[pos.id] = (distribution, disengaged)
        return out

    def _remember_pools(self, pools: list[tuple[str, str]]) -> None:
        known = {p for p, _ in self._pools}
        for pool, mint in pools:
            if pool and pool not in known:
                self._pools.append((pool, mint))
                known.add(pool)
        while len(self._pools) > 60:
            self._pools.popleft()

    # --- moteur 2 : smart money --------------------------------------------------
    async def smart_once(self) -> list[dict]:
        """Lit les trades de quelques pools, met à jour le classement des wallets et audite
        les jetons achetés par plusieurs wallets smart. Retourne les décisions prises."""
        if self.smart is None:
            return []
        if not self._pools:
            try:
                self._remember_pools(await self.gecko.trending_pools())
            except Exception:
                log.exception("pools en tendance indisponibles")
        for _ in range(min(self.s.smart_pools_per_cycle, len(self._pools))):
            pool, mint = self._pools.popleft()
            self._pools.append((pool, mint))
            try:
                self.smart.ingest(mint, await self.gecko.pool_trades(pool))
            except Exception:
                log.exception("trades du pool %s indisponibles (ignoré)", pool)
        self._smart_cycles += 1
        if self._smart_cycles % 1000 == 0:
            self.smart.prune()
        self._smart_buys = self.smart.smart_buys()
        results = []
        if self.trader.circuit_breaker_tripped():
            return results
        for mint, buys in self.smart.candidates():
            if self.cache.get(f"smart_seen:{mint}") is not None:
                continue
            self.cache.set(f"smart_seen:{mint}", 1, 2 * 3600)
            log.info("%s : %d wallets smart ont acheté (%.0f USD)", mint, len(buys["wallets"]), buys["usd"])
            try:
                results.append(await self.process(mint, smart=buys))
            except Exception:
                log.exception("audit de %s en échec (ignoré)", mint)
        return results

    # --- taille -------------------------------------------------------------------
    async def bankroll(self) -> float:
        if self.live:
            try:
                res = await self.rpc.call("getBalance", [self.executor.pubkey])
                return int(res["value"]) / LAMPORTS
            except Exception:
                return 0.0
        return self.trader.bankroll()

    async def size_for_entry(self, source: str = "scan"):
        cap = min(self.s.max_position_sol, HARD_MAX_POSITION_SOL)
        if self.live:
            cap = min(cap, self.s.live_max_position_sol)
        # Statistiques du SEUL moteur concerné : les moteurs ne se pénalisent pas entre eux.
        return position_size(self.s.sizing_mode, min(self.s.position_size_sol, cap), cap, await self.bankroll(),
                             self.trader.source_summary(source), self.s.min_trades_for_sizing,
                             self.s.kelly_multiplier)

    def _estimated_cost_pct(self, audit) -> float:
        """Coût aller-retour estimé à la taille de position : frais + pourboires + 2 x impact prix."""
        impact = audit.metrics.buy_price_impact_pct or 0.0
        scaled = impact * self.s.position_size_sol / self.s.audit_size_sol
        return self.trader.roundtrip_cost_pct(self.s.position_size_sol) + 2 * scaled

    # --- un jeton ---------------------------------------------------------------
    async def process(self, mint: str, smart: dict | None = None, engine: str = "smart") -> dict:
        """`smart` : achats smart détectés (moteur 2, `engine` = smart ou copytop).
        Sans lui, c'est le scan classique (moteur 1)."""
        self.cache.set(f"seen:{mint}", 1, SEEN_TTL_S)
        audit = await self.detector.audit(mint)
        flags = list(audit.flags)
        final = "REJECT"
        source = engine if smart else "scan"

        vol = None
        audit_flags = list(flags)
        if audit.verdict == "WATCHLIST_PAPER":
            obs = audit.observations
            vol = await self.volatility(obs.get("pair_address"), obs.get("price_change_m5"))
            # 1. Données pour le backtest : tout jeton SAIN est suivi, qu'on y entre ou non.
            feats = {k: obs.get(k) for k in FEATURES}
            feats.update({k: obs.get(k) for k in ("price_change_m5", "price_change_h6", "volume_h24_usd",
                                                  "fdv_usd", "mcap_source")})
            impact = (audit.metrics.buy_price_impact_pct or 0.0) * self.s.position_size_sol / self.s.audit_size_sol
            feats.update({"source": source, "impact_pct": impact,
                          "vol_pct": vol.pct if vol else None, "vol_source": vol.source if vol else None})
            self.data.record_observation(mint, obs.get("price_usd"), self._estimated_cost_pct(audit), feats)
            # 2. Sélection : vélocité, structure, âge (politique centralisée) — pour TOUS les moteurs
            entry_ok, entry_flags = evaluate_entry(obs, self.s.entry_rules, source)
            if smart is None:
                flags += entry_flags
                final = "PAPER_ENTRY" if entry_ok else "MOMENTUM_REJECT"
                if entry_ok and self._smart_buys.get(mint):
                    source = "both"  # le scan classique ET des wallets smart désignent ce jeton
                if not entry_ok and self.shadow is not None:
                    self.shadow.record(mint, source, entry_flags, obs)
            else:
                if engine == "copytop":
                    try:
                        pool_age = float(audit.observations.get("pair_age_min"))
                    except (TypeError, ValueError):
                        pool_age = float("nan")
                    if not math.isfinite(pool_age):
                        ok, smart_flags = False, ["UNKNOWN_COPYTOP_POOL_AGE"]
                    elif pool_age < self.s.copytop_min_pool_age_min:
                        ok, smart_flags = False, [f"COPYTOP_POOL_TOO_YOUNG({pool_age:.1f}min)"]
                    else:
                        ok, smart_flags = self._smart_entry(audit.observations, smart)
                else:
                    ok, smart_flags = self._smart_entry(audit.observations, smart)
                flags += smart_flags
                if ok and not entry_ok:
                    flags += entry_flags     # le signal smart ne dispense JAMAIS des filtres de marché
                    if self.shadow is not None:
                        self.shadow.record(mint, source, entry_flags, obs)
                final = "PAPER_ENTRY" if ok and entry_ok else "SMART_REJECT"

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

        raw_signal_buyers = smart.get("buyers", []) if engine == "copytop" and isinstance(smart, dict) else []
        signal_buyers = tuple(x for x in raw_signal_buyers
                              if isinstance(x, str) and 0 < len(x) <= 80)[:25] \
                         if isinstance(raw_signal_buyers, list) else ()
        opened, size_info = None, None
        if final == "PAPER_ENTRY" and self.live and source != "scan":
            # Les nouveaux moteurs sont strictement PAPER : aucun ordre réel ne peut en découler.
            final = "PAPER_ONLY_ENGINE_BLOCKED_IN_LIVE"
        if final == "PAPER_ENTRY":
            max_open = None
            if self.macro is not None:
                st = self.macro.state()
                if st.stress:
                    max_open = self.s.risk_max_active_positions_stress
                    flags.append(f"MACRO_STRESS({st.reason})")
            ok, why = self.trader.can_open(mint, source, max_open)
            sizing = await self.size_for_entry(source) if ok else None
            if ok and sizing.size_sol <= 0:
                ok, why = False, sizing.reason
            if ok:
                size_info = {"size_sol": round(sizing.size_sol, 4), "sizing": sizing.reason}
                if self.live:
                    opened, final = await self._live_entry(mint, sizing.size_sol, audit.buy_quote,
                                                           audit.observations.get("price_usd"), source,
                                                           signal_buyers)
                else:
                    pos = self.trader.open(mint, sizing.size_sol, audit.buy_quote, self.s.audit_size_sol,
                                           audit.observations.get("price_usd"), source=source,
                                           signal_buyers=signal_buyers,
                                           pool_address=audit.observations.get("pair_address"), vol=vol,
                                           cohort_initial=len(signal_buyers) or None, max_open=max_open)
                    opened = pos.id if pos else None
            else:
                final = f"PAPER_ENTRY_BLOCKED:{why}"
        log.info("%s -> %s (%s)%s", mint, final, ",".join(flags) or "aucun drapeau",
                 f" position #{opened} {size_info}" if opened else "")
        return {"mint": mint, "deterministic": audit.verdict, "final": final, "source": source,
                "flags": flags, "audit_flags": audit_flags, "position_id": opened, "size": size_info,
                "volatility": {"pct": round(vol.pct, 2), "source": vol.source} if vol else None}

    async def volatility(self, pool: str | None, price_change_m5=None):
        """ATR véritable (bougies GeckoTerminal 5 min, période 14) ; proxy m5 seulement si autorisé ;
        sinon None (=> sorties en mode conservateur fixe)."""
        r = self.s.exit_rules
        if r.exit_mode != "ATR":
            return None
        vol = None
        if pool:
            try:
                vol = atr_pct(await self.gecko.ohlcv(pool, limit=max(40, 3 * r.atr_period)), r.atr_period)
            except Exception:
                vol = None
        if vol is None and r.allow_m5_proxy:
            vol = m5_proxy(price_change_m5)
        return vol

    def _smart_entry(self, obs: dict, buys: dict) -> tuple[bool, list[str]]:
        """Entrée smart : assez de wallets distincts, et pas de course après un prix déjà envolé.
        Le prix d'entrée des wallets est connu (moteur 2) ou déduit de la capitalisation au moment
        du signal (copy.top). Sans référence fiable : refus (fail-closed)."""
        r = self.s.smart_rules
        n = buys.get("n_wallets", len(buys.get("wallets", ())))
        flags = [f"SMART_WALLETS({n})"]
        if n < buys.get("min_wallets", r.min_wallets):
            return False, flags + ["SMART_TOO_FEW_WALLETS"]
        if buys.get("post_migration"):
            # Référence = la migration : l'achat de la cohorte sur la courbe Pump.fun est forcément
            # bien plus bas. Les filtres de vélocité (dont PARABOLIC_H1) prennent le relais.
            return True, flags + ["CHASE_REF_MIGRATION"]
        price, fdv = obs.get("price_usd"), obs.get("fdv_usd")
        if buys.get("entry_price_usd") and price:
            ratio = price / buys["entry_price_usd"]
        elif buys.get("entry_mcap_usd") and fdv:
            ratio = fdv / buys["entry_mcap_usd"]
        else:
            return False, flags + ["UNKNOWN_SMART_ENTRY"]
        chase = 100 * (ratio - 1)
        if chase > r.max_chase_pct:
            return False, flags + [f"SMART_CHASE(+{chase:.0f}%)"]
        return True, flags

    async def _live_entry(self, mint: str, size: float, audit_quote: dict | None,
                          entry_price_usd: float | None = None, source: str = "scan",
                          signal_buyers: tuple[str, ...] = ()) -> tuple[int | None, str]:
        try:
            res = await self.executor.buy(mint, size)
        except Exception as e:
            log.error("achat LIVE %s annulé : %s", mint, e)
            return None, f"LIVE_ENTRY_FAILED:{type(e).__name__}"
        impact = (audit_quote or {}).get("priceImpactPct")
        real_size = res.in_amount / LAMPORTS
        pos = self.trader.open(mint, real_size, {"outAmount": str(res.expected_out), "priceImpactPct": impact},
                               entry_price_usd=entry_price_usd, source=source, signal_buyers=signal_buyers)
        return (pos.id if pos else None), ("LIVE_ENTRY" if res.confirmed else "LIVE_ENTRY_UNCONFIRMED")

    # --- cycles -----------------------------------------------------------------
    async def scan_once(self) -> list[dict]:
        if self.trader.circuit_breaker_tripped():
            log.warning("coupe-circuit actif : pas de nouvelle entrée pendant 24 h glissantes")
            return []
        results = []
        # Lot borné : un scan ne doit pas bloquer la boucle (signaux copy.top, surveillance) pendant
        # des minutes ; les jetons non traités restent candidats au cycle suivant.
        for mint in (await self.discover())[:self.s.scan_batch_max]:
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
        positions = self.trader.open_positions()
        if not positions:
            return []
        ct = await self.copytop_exit_once()
        try:
            prices = await self.dex.prices([p.mint for p in positions])
        except Exception:
            prices = {}
        events = []
        for pos in positions:
            if only_mints is not None and pos.mint not in only_mints:
                continue
            value = await self.jup.sell_value_sol(pos.mint, pos.token_amount, self.s.max_slippage_bps)
            vol = None if self.live else await self.volatility(pos.pool_address)
            distribution, disengaged = ct.get(pos.id, (False, False))
            decision = self.trader.evaluate(pos, value, vol=vol, copytop_exit=distribution,
                                            copytop_disengaged=disengaged)
            if decision is None:
                continue
            event = {"id": pos.id, "mint": pos.mint, "source": pos.source, "action": decision.action,
                     "reason": decision.reason}
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
                price_now = (prices.get(pos.mint) or (None, None))[0]
                mark = (pos.size_sol * pos.remaining_frac * price_now / pos.entry_price_usd
                        if price_now and pos.entry_price_usd else None)
                slip = quote_slippage_pct(mark, value)
                event["pnl_sol"] = self.trader.close(pos, value, decision.reason, slip)
                event["exit_slippage_pct"] = slip
                log.info("clôture #%d %s (%s) : %s, PnL %.4f SOL", pos.id, pos.mint, pos.source,
                         decision.reason, event["pnl_sol"])
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
        if self.shadow is not None:
            try:
                await self.shadow.update_prices(self.dex)
            except Exception:
                log.exception("relevé du Shadow Ledger en échec (ignoré)")
        return len(rows)

    async def run(self, max_cycles: int | None = None) -> None:
        log.info("démarrage en mode %s : %s", "LIVE" if self.live else "PAPER",
                 json.dumps(self.s.redacted(), default=str))
        next_scan = next_track = next_monitor = next_smart = next_copytop = next_macro = 0.0
        cycles = 0
        while max_cycles is None or cycles < max_cycles:
            now = time.monotonic()
            if self.macro is not None and now >= next_macro:
                try:
                    await self.macro.refresh()
                    st = self.macro.state()
                    if st.stress:
                        log.warning("régime macro : %s -> %d positions simultanées max", st.reason,
                                    self.s.risk_max_active_positions_stress)
                except Exception:
                    log.exception("régime macro indisponible (stress supposé)")
                next_macro = now + 60
            if self.smart is not None and now >= next_smart:
                try:
                    await self.smart_once()
                except Exception:
                    log.exception("moteur smart money en échec (ignoré)")
                next_smart = now + self.s.smart_interval_s
            if self.copytop is not None and now >= next_copytop:
                try:
                    await self.copytop_once()
                    await self.watchlist_once()
                except Exception:
                    log.exception("signaux copy.top en échec (ignorés)")
                next_copytop = now + self.s.copytop_interval_s
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
        if self.smart is not None:
            out["smart_money"] = self.smart.stats()
        out["migration_watchlist"] = self.watchlist.stats()
        if self.shadow is not None:
            out["shadow_ledger"] = self.shadow.stats()
        if self.macro is not None:
            st = self.macro.state()
            out["macro"] = {"stress": st.stress, "reason": st.reason, "sol_change_h1_pct": st.sol_change_h1_pct}
        # Coût fixe modélisé vs glissement réellement coté (devis de sortie)
        slips = [v.get("avg_exit_slippage_pct") for v in out.get("by_source", {}).values()
                 if isinstance(v, dict) and v.get("avg_exit_slippage_pct") is not None]
        out["costs"] = {"fixed_roundtrip_model_pct": out.get("roundtrip_cost_pct"),
                        "observed_avg_exit_slippage_pct": round(sum(slips) / len(slips), 2) if slips else None,
                        "note": "glissement = écart devis Jupiter / prix affiché ; un devis n'est pas une exécution"}
        return out

    async def smart_report(self) -> dict:
        """Vue « Top Trader & Callout Tracker » : meilleurs wallets et jetons qu'ils achètent."""
        if self.smart is None:
            return {"smart_money": "désactivé (SMART_ENABLED=false)"}
        buys = self.smart.smart_buys(window_min=24 * 60)
        prices = await self.dex.prices(list(buys)) if buys else {}
        return {"stats": self.smart.stats(), "top_wallets": self.smart.top_wallets(),
                "token_tracker": self.smart.tracker({m: p for m, (p, _) in prices.items()})}

    async def report_with_open_positions(self) -> dict:
        """Bilan + valeur latente des positions ouvertes (devis de sortie Jupiter actuels)."""
        if self.macro is not None:
            try:
                await self.macro.refresh()
            except Exception:
                pass
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
        """Réglages actuels rejoués sur les données : scénarios base / pessimiste / stress, par moteur."""
        return backtest_report(self.data.load_paths(), self.s.entry_rules, self.s.exit_rules)

    def wf_config(self) -> WFConfig:
        s = self.s
        return WFConfig(folds=s.backtest_walk_forward_folds, min_train_trades=s.backtest_min_train_trades,
                        min_trades_total=s.backtest_min_trades_total, min_profit_factor=s.backtest_min_profit_factor,
                        purge_hours=s.backtest_purge_hours,
                        max_drawdown_bankroll_pct=s.backtest_max_drawdown_bankroll_pct,
                        stake_fraction=s.position_size_sol / max(s.paper_bankroll_sol, 1e-9))

    def run_optimize(self) -> dict:
        """Walk-Forward ancré à 4 plis sur 18 profils (sélection sur l'entraînement uniquement)."""
        return optimize(self.data.load_paths(), self.s.entry_rules, self.s.exit_rules, self.wf_config())

    async def aclose(self) -> None:
        if self.analyzer:
            await self.analyzer.aclose()
        if self.social:
            await self.social.aclose()
        self.watchlist.close()
        if self.shadow is not None:
            self.shadow.close()
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
    for name in ("run", "scan", "smart", "monitor", "track", "report", "backtest", "optimize", "walkforward",
                 "shadow", "watchlist"):
        sub.add_parser(name)
    ra = sub.add_parser("reactivate-source", help="réactive un moteur mis en pause par son coupe-circuit")
    ra.add_argument("source", choices=["scan", "smart", "copytop"])
    ra.add_argument("--note", default="")
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
        elif a.cmd == "smart":
            await bot.smart_once()
            await bot.copytop_once()
            print(json.dumps(await bot.smart_report(), indent=2, ensure_ascii=False))
        elif a.cmd == "monitor":
            print(json.dumps(await bot.monitor_once(), indent=2))
        elif a.cmd == "track":
            print(json.dumps({"snapshots_recorded": await bot.track_once()}))
        elif a.cmd == "report":
            print(json.dumps(await bot.report_with_open_positions(), indent=2, ensure_ascii=False))
        elif a.cmd == "backtest":
            print(json.dumps(bot.run_backtest(), indent=2, ensure_ascii=False))
        elif a.cmd in ("optimize", "walkforward"):
            print(json.dumps(bot.run_optimize(), indent=2, ensure_ascii=False, default=str))
        elif a.cmd == "shadow":
            print(json.dumps(bot.shadow.stats() if bot.shadow else {}, indent=2, ensure_ascii=False))
        elif a.cmd == "watchlist":
            await bot.watchlist_once()
            print(json.dumps({"stats": bot.watchlist.stats(), "waiting": bot.watchlist.waiting()}, indent=2))
        elif a.cmd == "reactivate-source":
            before = bot.trader.source_losses(a.source)
            bot.trader.reactivate_source(a.source, a.note)
            print(json.dumps({"source": a.source, "losses_before_reset": before, "paused": False}))
    finally:
        await bot.aclose()
    return 0


def main(argv: list[str] | None = None) -> int:
    try:
        return asyncio.run(_main(argv))
    except KeyboardInterrupt:
        return 130
