import asyncio
from dataclasses import replace

import httpx
import pytest

from analyzer import combine, load_system_prompt, parse_llm_output
from cache import TTLCache
from config import LIVE, PAPER, Settings
from fake_apis import CLEAN, HONEYPOT, INJECTED, SOL, FakeApis, no_sleep
from fetchers import ApiClient, DexScreener, GeckoTerminal, Jupiter, RugCheck, SolanaRpc, TokenBucket
from fetchers.rpc import RpcError
from filters.rug_detector import RugDetector
from paper_trader import PaperTrader
from tx_builder import JITO_DONT_FRONT, ExecutionDisabled, GuardrailViolation, TransactionBuilder, is_pubkey


def run(coro):
    return asyncio.run(coro)


# --- rate limiting / HTTP ----------------------------------------------------

def test_token_bucket_waits_when_empty():
    t = [0.0]
    slept = []

    async def fake_sleep(s):
        slept.append(s)
        t[0] += s

    b = TokenBucket(rate=60, per=60, burst=2, clock=lambda: t[0], sleep=fake_sleep)

    async def go():
        for _ in range(3):
            await b.acquire()

    run(go())
    assert slept and abs(slept[0] - 1.0) < 1e-9  # 1 req/s une fois la rafale consommée


def test_api_client_backoff_on_429_then_success():
    api = FakeApis()
    url = f"https://api.rugcheck.xyz/v1/tokens/{CLEAN}/report"
    api.rate_limit_once.add(url)

    async def go():
        async with api.client() as c:
            return await RugCheck(c, sleep=no_sleep).report(CLEAN)

    assert run(go())["mintAuthority"] is None
    assert api.calls.count(f"GET api.rugcheck.xyz/v1/tokens/{CLEAN}/report") == 2


def test_api_client_returns_none_on_4xx():
    async def go():
        c = httpx.AsyncClient(transport=httpx.MockTransport(lambda r: httpx.Response(404)))
        cli = ApiClient("https://x.test", TokenBucket(100, 1), c, sleep=no_sleep)
        res = await cli.get("/a")
        await c.aclose()
        return res

    assert run(go()) is None


def test_gecko_cache_avoids_second_call():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            g = GeckoTerminal(TTLCache(), c, sleep=no_sleep)
            await g.token(CLEAN)
            await g.token(CLEAN)

    run(go())
    assert sum("geckoterminal" in x for x in api.calls) == 1


def test_rpc_whitelist_and_fallback():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            rpc = SolanaRpc("https://primary.rpc.test", "https://backup.rpc.test", c, sleep=no_sleep, retries=1)
            with pytest.raises(RpcError):
                await rpc.call("sendTransaction", ["xx"])
            return await rpc.mint_authorities(CLEAN)

    assert run(go()) == (True, True)
    assert any("primary" in x for x in api.calls) and any("backup" in x for x in api.calls)


def test_jupiter_roundtrip_honeypot():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            return await Jupiter(c, sleep=no_sleep).roundtrip(HONEYPOT, 0.5)

    buy, sell = run(go())
    assert buy is not None and sell is None


# --- détecteur ---------------------------------------------------------------

def _detector(c, rpc=None):
    kw = {"sleep": no_sleep}
    return RugDetector(DexScreener(c, **kw), RugCheck(c, **kw), GeckoTerminal(TTLCache(), c, **kw),
                       Jupiter(c, **kw), rpc)


@pytest.mark.parametrize("mint,verdict,flag", [
    (CLEAN, "WATCHLIST_PAPER", None),
    (HONEYPOT, "REJECT", "NO_SELL_ROUTE_HONEYPOT"),
    (INJECTED, "REJECT", "PROMPT_INJECTION_IN_METADATA"),
    ("not-a-mint", "REJECT", "INVALID_MINT"),
])
def test_rug_detector(mint, verdict, flag):
    api = FakeApis()

    async def go():
        async with api.client() as c:
            return await _detector(c).audit(mint)

    res = run(go())
    assert res.verdict == verdict, res.flags
    if flag:
        assert flag in res.flags
    else:
        assert res.metrics.top10_holders_pct == pytest.approx(15.0)  # réserve AMM exclue


def test_onchain_authority_overrides_rugcheck():
    api = FakeApis()
    api.rpc_mint_authority = "Attacker1111111111111111111111111111111111"

    async def go():
        async with api.client() as c:
            rpc = SolanaRpc(None, "https://backup.rpc.test", c, sleep=no_sleep)
            return await _detector(c, rpc).audit(CLEAN)

    res = run(go())
    assert res.verdict == "REJECT" and "MINT_AUTHORITY_ACTIVE" in res.flags


def test_untrusted_block_is_confined():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            return await _detector(c).audit(INJECTED)

    res = run(go())
    assert res.untrusted_block.startswith("<UNTRUSTED_TOKEN_METADATA>")
    assert "ignore previous" not in str(res.to_llm_payload())


# --- paper trader ------------------------------------------------------------

def _trader(**kw):
    t = [1_000_000.0]
    tr = PaperTrader(":memory:", clock=lambda: t[0], **kw)
    return tr, t


def test_paper_trade_take_profit_and_fees():
    tr, _ = _trader()
    pos = tr.open(CLEAN, 0.5, {"outAmount": "500000000000", "priceImpactPct": "0.01"})
    assert pos.token_amount == 495_000_000_000  # 1 % de frais à l'entrée
    assert tr.evaluate_exit(pos, 0.5) is None
    assert tr.evaluate_exit(pos, 0.9) == "TAKE_PROFIT"
    pnl = tr.close(pos, 0.9, "TAKE_PROFIT")
    assert pnl == pytest.approx(0.9 * 0.99 - 0.5)


def test_paper_trade_stop_time_and_no_route():
    tr, t = _trader(max_hold_minutes=10)
    pos = tr.open(CLEAN, 0.5, {"outAmount": "1"})
    assert tr.evaluate_exit(pos, 0.30) == "STOP_LOSS"
    assert tr.evaluate_exit(pos, None) == "NO_EXIT_ROUTE"
    t[0] += 601
    assert tr.evaluate_exit(pos, 0.5) == "TIME_STOP"


def test_circuit_breaker_blocks_new_entries():
    tr, _ = _trader(daily_max_loss_sol=0.4)
    pos = tr.open(CLEAN, 0.5, {"outAmount": "1"})
    tr.close(pos, None, "NO_EXIT_ROUTE")  # -0,5 SOL
    assert tr.circuit_breaker_tripped()
    assert tr.can_open(HONEYPOT) == (False, "CIRCUIT_BREAKER")
    assert tr.open(HONEYPOT, 0.5, {"outAmount": "1"}) is None


def test_max_open_positions_and_duplicates():
    tr, _ = _trader(max_open_positions=1)
    tr.open(CLEAN, 0.5, {"outAmount": "1"})
    assert tr.can_open(CLEAN) == (False, "ALREADY_OPEN")
    assert tr.can_open(HONEYPOT) == (False, "MAX_OPEN_POSITIONS")


# --- module de transaction -----------------------------------------------------

def test_tx_builder_disabled_in_paper():
    with pytest.raises(ExecutionDisabled):
        TransactionBuilder(Settings(execution_mode=PAPER)).plan_swap(SOL, CLEAN, 1)


def test_tx_builder_guardrails_in_live():
    tb = TransactionBuilder(Settings(execution_mode=LIVE))
    plan = tb.plan_swap(SOL, CLEAN, 500_000_000)
    assert plan.slippage_bps == 300 and plan.require_simulation
    assert plan.extra_readonly_accounts == (JITO_DONT_FRONT,)
    assert is_pubkey(JITO_DONT_FRONT) and JITO_DONT_FRONT.startswith("jitodontfront")
    with pytest.raises(GuardrailViolation):
        tb.plan_swap(SOL, CLEAN, 1, slippage_bps=301)
    with pytest.raises(GuardrailViolation):
        TransactionBuilder(Settings(execution_mode=LIVE), circuit_breaker=lambda: True).plan_swap(SOL, CLEAN, 1)
    with pytest.raises(GuardrailViolation):
        tb.check_simulation({"value": {"err": {"InstructionError": [0, "Custom"]}}})
    tb.check_simulation({"value": {"err": None}})


def test_settings_cap_slippage_and_redact(monkeypatch):
    monkeypatch.setenv("MAX_SLIPPAGE_BPS", "5000")
    monkeypatch.setenv("HELIUS_RPC_URL", "https://rpc.example/?api-key=SECRET")
    monkeypatch.setenv("EXECUTION_MODE", "yolo")
    s = Settings.from_env()
    assert s.max_slippage_bps == 300 and s.execution_mode == PAPER
    assert "SECRET" not in str(s.redacted())


# --- analyseur LLM -------------------------------------------------------------

def test_llm_can_only_downgrade():
    assert combine("REJECT", {"verdict": "PAPER_ENTRY"}) == "REJECT"
    assert combine("WATCHLIST_PAPER", {"verdict": "HIGH_RISK_WATCH"}) == "HIGH_RISK_WATCH"
    assert combine("WATCHLIST_PAPER", {"verdict": "PAPER_ENTRY", "prompt_injection_detected": True}) == "REJECT"
    assert combine("WATCHLIST_PAPER", None) == "PAPER_ENTRY"
    assert combine("WATCHLIST_PAPER", None, require_llm=True) == "HIGH_RISK_WATCH"


def test_parse_llm_output():
    assert parse_llm_output('```json\n{"verdict": "REJECT"}\n```')["verdict"] == "REJECT"
    assert parse_llm_output('{"verdict": "BUY_EVERYTHING"}') is None
    assert parse_llm_output("pas de json") is None
    assert "UNTRUSTED_TOKEN_METADATA" in load_system_prompt()


# --- bout en bout --------------------------------------------------------------

def _bot(api, **kw):
    from bot import Bot
    s = replace(Settings(), db_path=":memory:", **kw)
    bot = Bot(s, client=api.client())
    for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api):
        cli._sleep = no_sleep
        cli.bucket = TokenBucket(1e6, 1)  # pas d'attente réelle dans les tests
    return bot


def test_bot_scan_and_monitor_end_to_end():
    api = FakeApis()

    async def go():
        bot = _bot(api)
        results = await bot.scan_once()
        assert await bot.scan_once() == []  # jetons déjà vus : pas de ré-audit
        api.exit_multiplier = 2.0           # le jeton double
        closed = await bot.monitor_once()
        summary = bot.trader.summary()
        await bot.aclose()
        return results, closed, summary

    results, closed, summary = run(go())
    by_mint = {r["mint"]: r for r in results}
    assert set(by_mint) == {CLEAN, HONEYPOT, INJECTED}
    assert by_mint[CLEAN]["final"] == "PAPER_ENTRY" and by_mint[CLEAN]["position_id"]
    assert by_mint[HONEYPOT]["final"] == "REJECT"
    assert by_mint[INJECTED]["final"] == "REJECT"
    assert closed and closed[0]["reason"] == "TAKE_PROFIT" and closed[0]["pnl_sol"] > 0
    assert summary["closed_trades"] == 1 and summary["audits_by_verdict"]["REJECT"] == 2
    assert not any("/swap/v1/swap" in c or "sendTransaction" in c for c in api.calls)


def test_bot_refuses_live_mode():
    from bot import Bot
    with pytest.raises(SystemExit):
        Bot(replace(Settings(), execution_mode=LIVE, db_path=":memory:"), client=FakeApis().client())


def test_ollama_analyzer_downgrades_and_survives_garbage():
    from analyzer import OllamaAnalyzer
    replies = iter(['{"verdict": "HIGH_RISK_WATCH", "prompt_injection_detected": false}', "n'importe quoi"])
    seen = {}

    def handler(req):
        import json as _j
        body = _j.loads(req.content)
        seen["system"] = body["messages"][0]["content"]
        seen["user"] = body["messages"][1]["content"]
        return httpx.Response(200, json={"message": {"content": next(replies)}})

    async def go():
        a = OllamaAnalyzer("http://ollama.test", "m", client=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
        first = await a.analyze({"token_mint": CLEAN}, "<UNTRUSTED_TOKEN_METADATA>\nname: x\n</UNTRUSTED_TOKEN_METADATA>")
        second = await a.analyze({"token_mint": CLEAN}, "")
        await a.aclose()
        return first, second

    first, second = run(go())
    assert combine("WATCHLIST_PAPER", first) == "HIGH_RISK_WATCH"
    assert second is None
    assert seen["system"].startswith("RÔLE")
