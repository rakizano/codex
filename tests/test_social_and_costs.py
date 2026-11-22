import asyncio
import json
import struct
from dataclasses import replace

import pytest

from cache import TTLCache
from config import Settings
from fake_apis import CLEAN, FakeApis, no_sleep
from fetchers import TokenBucket
from paper_trader import PaperTrader
from strategy.exit import ExitRules
from social import SocialChecker, SocialSignals, evaluate_social
from social.reddit_client import RedditStats
from social.x_client import XStats, build_query


def run(coro):
    return asyncio.run(coro)


S = Settings()


# --- évaluation ------------------------------------------------------------------

@pytest.mark.parametrize("sig,allowed,flag", [
    (SocialSignals(link_types=[]), False, "NO_SOCIAL_LINKS"),
    (SocialSignals(link_types=["twitter"]), True, None),
    (SocialSignals(link_types=["twitter"], boosts_active=9999), False, "PAID_HYPE"),
    (SocialSignals(link_types=["twitter"], x=XStats(2, 2, 5)), False, "LOW_X_MENTIONS"),
    (SocialSignals(link_types=["twitter"], x=XStats(50, 5, 900)), False, "X_SHILL_PATTERN"),
    (SocialSignals(link_types=["twitter"], x=XStats(50, 40, 900)), True, None),
    (SocialSignals(link_types=["twitter"], reddit=RedditStats(10, 2, 0)), False, "REDDIT_SHILL_PATTERN"),
    (SocialSignals(link_types=["twitter"], x_link_is_post=True), True, "INFO_X_LINK_IS_POST"),
])
def test_evaluate_social(sig, allowed, flag):
    ok, flags = evaluate_social(sig, S)
    assert ok is allowed
    if flag:
        assert any(f.startswith(flag) for f in flags)


def test_social_link_requirement_can_be_disabled():
    ok, _ = evaluate_social(SocialSignals(), replace(S, require_social_link=False))
    assert ok


def test_x_query_ignores_malicious_symbol():
    assert build_query(CLEAN, "PEPE") == f'({CLEAN} OR "$PEPE") -is:retweet'
    assert build_query(CLEAN, 'X" OR from:elonmusk') == f"({CLEAN}) -is:retweet"


# --- clients & cache ------------------------------------------------------------------

def _checker(api, client, **kw):
    s = replace(S, **kw)
    chk = SocialChecker(s, TTLCache(), client, sleep=no_sleep)
    for c in filter(None, (chk.reddit.api, chk.x.api if chk.x else None)):
        c.bucket = TokenBucket(1e6, 1)
    return chk


def test_checker_with_x_counts_only_numbers_and_caches():
    api = FakeApis()
    obs = {"social_link_types": ["twitter", "telegram"], "dexscreener_boosts_active": 10}

    async def go():
        async with api.client() as c:
            chk = _checker(api, c, x_bearer_token="test-token")
            first = await chk.check(CLEAN, "GOOD", obs)
            calls_after_first = len(api.calls)
            second = await chk.check(CLEAN, "GOOD", obs)
            return first, second, calls_after_first

    first, second, n = run(go())
    assert first.x == XStats(20, 15, 80) and first.reddit == RedditStats(3, 3, 6)
    assert second.x == first.x and len(api.calls) == n  # cache 15 min : aucun nouvel appel
    metrics = json.dumps(first.to_metrics())
    assert "ignore previous" not in metrics  # le texte des posts n'est jamais conservé
    assert api.x_auth_seen == ["Bearer test-token"]


def test_x_unavailable_degrades_gracefully():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            return await _checker(api, c, x_bearer_token="wrong").check(CLEAN, None, {"social_link_types": ["twitter"]})

    sig = run(go())
    assert sig.x is None and sig.reddit is not None
    assert evaluate_social(sig, S)[0]  # X indisponible n'est pas un motif de rejet


def test_bot_rejects_shilled_token():
    from bot import Bot
    api = FakeApis()
    api.x_posts = (60, 4)  # 60 posts, 4 comptes : campagne de shill

    async def go():
        bot = Bot(replace(Settings(), db_path=":memory:", x_bearer_token="test-token"), client=api.client())
        for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api,
                    bot.social.reddit.api, bot.social.x.api):
            cli._sleep = no_sleep
            cli.bucket = TokenBucket(1e6, 1)
        res = await bot.process(CLEAN)
        summary = bot.trader.summary()
        await bot.aclose()
        return res, summary

    res, summary = run(go())
    assert res["final"] == "SOCIAL_REJECT" and res["position_id"] is None
    assert any(f.startswith("X_SHILL_PATTERN") for f in res["flags"])
    assert summary["audits_by_verdict"] == {"SOCIAL_REJECT": 1}


# --- pourboire et coûts -----------------------------------------------------------------

def test_jito_tip_configurable_and_bounded(monkeypatch):
    assert Settings().jito_tip_lamports == 100_000
    monkeypatch.setenv("JITO_TIP_LAMPORTS", "5")
    assert Settings.from_env().jito_tip_lamports == 1_000  # minimum Jito
    monkeypatch.setenv("JITO_TIP_LAMPORTS", "999999999")
    assert Settings.from_env().jito_tip_lamports == 5_000_000


def test_lower_tip_reduces_roundtrip_cost():
    old = PaperTrader(tip_sol=0.001, ref_size_sol=0.05).roundtrip_cost_pct()
    new = PaperTrader(tip_sol=0.0001, ref_size_sol=0.05).roundtrip_cost_pct()
    assert old == pytest.approx(5.95, abs=0.01)
    assert new == pytest.approx(2.39, abs=0.01)


def test_paper_trade_pays_tip_on_both_sides():
    tr = PaperTrader(tip_sol=0.0001)
    pos = tr.open(CLEAN, 0.05, {"outAmount": "500000"}, quote_size_sol=0.5)
    assert pos.token_amount == int(500_000 * 0.1 * (1 - 0.0001 / 0.05) * 0.99)
    pnl = tr.close(pos, 0.05, "TIME_STOP")  # prix inchangé
    assert pnl == pytest.approx(0.05 * 0.99 - 0.0001 - 0.05)


def test_report_shows_breakeven_and_verdict():
    t = [0.0]
    rules = ExitRules(take_profit_pct=60.0, tp1_pct=None, trail_activation_pct=None, trailing_stop_pct=None)
    tr = PaperTrader(exit_rules=rules, clock=lambda: t[0], min_trades_for_verdict=3, daily_max_loss_sol=100,
                     reentry_cooldown_h=0)
    for value in (0.08, 0.035, 0.036):  # 1 gain, 2 pertes sur 0,05 SOL
        p = tr.open(CLEAN, 0.05, {"outAmount": "1"})
        tr.close(p, value, "X")
    s = tr.summary()
    assert s["breakeven_win_rate_theoretical_pct"] == pytest.approx(29.4, abs=0.1)
    assert s["win_rate_pct"] == pytest.approx(33.3, abs=0.1)
    assert s["avg_win_pct"] > 0 > s["avg_loss_pct"]
    assert s["breakeven_win_rate_observed_pct"] is not None
    assert s["verdict"] in ("RENTABLE_EN_SIMULATION", "PERDANT_EN_SIMULATION")
    assert PaperTrader().summary()["verdict"].startswith("PAS_ASSEZ_DE_DONNEES")


def test_live_tip_instruction_uses_configured_amount(tmp_path):
    from solders.keypair import Keypair

    from fetchers import Jupiter, SolanaRpc
    from live.executor import CONFIRM_PHRASE, LiveExecutor
    from config import LIVE

    async def go():
        api = FakeApis()
        async with api.client() as c:
            s = replace(Settings(), execution_mode=LIVE, live_confirm=CONFIRM_PHRASE, keypair_path="x",
                        helius_rpc_url="https://live.rpc.test", jito_tip_lamports=250_000)
            ex = LiveExecutor(s, SolanaRpc(s.helius_rpc_url, None, c), Jupiter(c), Keypair(), c)
            return ex._tip_instruction()

    ix = run(go())
    kind, lamports = struct.unpack("<IQ", bytes(ix.data))
    assert kind == 2 and lamports == 250_000  # SystemInstruction::Transfer
