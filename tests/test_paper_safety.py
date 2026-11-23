"""Invariants de sécurité de la refonte : PAPER uniquement pour les nouveaux moteurs, aucun ordre réel,
aucune transaction signée, aucune clé privée, aucune activation LIVE ambiguë, garde-fous anti-rug intacts."""
import asyncio
import time
from dataclasses import replace

import pytest

from config import HARD_MAX_POSITION_SOL, LIVE, PAPER, Settings
from fake_apis import CLEAN, FakeApis, no_sleep
from fetchers import TokenBucket
from memecoin.filters import Thresholds

TX_MARKERS = ("/swap-instructions", "/swap/v1/swap", "sendTransaction", "sendBundle", "block-engine",
              "simulateTransaction")


def _bot(api, executor=None, **kw):
    from bot import Bot
    bot = Bot(replace(Settings(), db_path=":memory:", **kw), client=api.client(), executor=executor)
    for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api,
                bot.social.reddit.api, bot.copytop.api):
        cli._sleep = no_sleep
        cli.bucket = TokenBucket(1e6, 1)
    return bot


def _event():
    from datetime import datetime, timezone
    at = datetime.fromtimestamp(time.time() - 60, timezone.utc).isoformat().replace("+00:00", "Z")
    return {"kind": "confluence", "chain": "solana", "token": CLEAN, "topTraders": 4, "topStillIn": 3,
            "mcap": 900_000, "boughtUsd": 5000, "at": at, "buyers": ["pf_a", "pf_b", "pf_c"]}


def test_default_settings_are_paper_with_hard_cap():
    s = Settings()
    assert s.execution_mode == PAPER and s.live_confirm is None and s.keypair_path is None
    assert max(s.position_size_sol, s.max_position_sol, s.live_max_position_sol) <= HARD_MAX_POSITION_SOL == 0.05


def test_security_thresholds_are_the_mandatory_values():
    t = Thresholds()
    assert (t.min_liquidity_usd, t.min_lp_locked_pct, t.max_top10_pct, t.max_price_impact_pct,
            t.max_roundtrip_loss_pct) == (15_000, 90, 25, 5, 10)


@pytest.mark.parametrize("value", ["live", "Live", "LIVE ", " LIVE", "LIVE\n", "yes", "REAL"])
def test_no_ambiguous_live_activation(monkeypatch, value):
    monkeypatch.setenv("EXECUTION_MODE", value)
    monkeypatch.setenv("LIVE_TRADING_CONFIRM", "I_UNDERSTAND_REAL_FUNDS_AT_RISK")
    assert Settings.from_env().execution_mode == PAPER


def test_all_new_engines_never_touch_transaction_endpoints():
    """Scan, smart, copy.top, file de migration et nouvelles sorties : aucun appel de transaction."""
    api = FakeApis()
    api.pair_overrides = {}

    async def go():
        bot = _bot(api)
        assert bot.executor is None and not bot.live
        api.copytop_events = [_event()]
        await bot.copytop_once()
        await bot.watchlist_once()
        await bot.scan_once()
        api.exit_multiplier = 2.0                 # TP1
        await bot.monitor_once()
        api.exit_multiplier = 0.3                 # plancher / stop
        await bot.monitor_once()
        await bot.fast_watch_once()
        await bot.aclose()

    asyncio.run(go())
    assert not any(m in c for c in api.calls for m in TX_MARKERS), [c for c in api.calls if "jup" in c]
    assert not api.swap_requests and not api.sent


class _ExplodingExecutor:
    """Exécuteur LIVE factice : tout appel d'ordre fait échouer le test."""
    pubkey = "FakeLiveWallet1111111111111111111111111111"

    def __init__(self):
        self.calls = []

    async def buy(self, *a, **k):
        self.calls.append(("buy", a))
        raise AssertionError("un nouveau moteur a tenté un achat réel")

    async def sell_all(self, *a, **k):
        self.calls.append(("sell_all", a))
        raise AssertionError("vente réelle inattendue")

    async def sell_fraction(self, *a, **k):
        self.calls.append(("sell_fraction", a))
        raise AssertionError("vente réelle inattendue")


def test_new_engine_signals_are_blocked_in_live_mode():
    api = FakeApis()
    ex = _ExplodingExecutor()

    async def go():
        bot = _bot(api, executor=ex, execution_mode=LIVE)
        assert bot.trader.legacy                          # LIVE : ancienne logique de sortie seulement
        api.copytop_events = [_event()]
        ct = await bot.copytop_once()
        smart = await bot.process(CLEAN, smart={"n_wallets": 3, "min_wallets": 2, "entry_mcap_usd": 900_000,
                                                "buyers": ["pf_a", "pf_b"]}, engine="smart")
        exits = await bot.copytop_exit_once()            # surveillance copy.top inactive en LIVE
        await bot.aclose()
        return ct, smart, exits

    ct, smart, exits = asyncio.run(go())
    assert ct[0]["final"] == "PAPER_ONLY_ENGINE_BLOCKED_IN_LIVE"
    assert smart["final"] == "PAPER_ONLY_ENGINE_BLOCKED_IN_LIVE"
    assert exits == {} and ex.calls == []


def test_paper_trader_never_signs_or_loads_keys(monkeypatch):
    import builtins
    opened = []
    real_open = builtins.open

    def spy(path, *a, **k):
        opened.append(str(path))
        return real_open(path, *a, **k)

    monkeypatch.setattr(builtins, "open", spy)
    api = FakeApis()

    async def go():
        bot = _bot(api)
        await bot.process(CLEAN)
        await bot.monitor_once()
        await bot.aclose()

    asyncio.run(go())
    assert not any("keypair" in p or p.endswith("id.json") or ".env" in p for p in opened)


def test_position_size_never_exceeds_cap_even_with_kelly():
    api = FakeApis()

    async def go():
        bot = _bot(api, sizing_mode="kelly", position_size_sol=0.05, max_position_sol=0.05)
        d = await bot.size_for_entry("copytop")
        await bot.aclose()
        return d

    assert asyncio.run(go()).size_sol <= HARD_MAX_POSITION_SOL
