"""Exécution LIVE testée de bout en bout contre des APIs simulées (aucun fonds réel)."""
import asyncio
import base64
import json
from dataclasses import replace

import pytest
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from solders.transaction import VersionedTransaction

from config import LIVE, PAPER, Settings
from fake_apis import CLEAN, HONEYPOT, SOL, FakeApis, no_sleep
from fetchers import Jupiter, SolanaRpc, TokenBucket
from live.executor import (CONFIRM_PHRASE, JITO_TIP_ACCOUNTS, LiveExecutor, check_live_enabled,
                           load_keypair)
from tx_builder import JITO_DONT_FRONT, ExecutionDisabled, GuardrailViolation, is_pubkey


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def keyfile(tmp_path):
    kp = Keypair()
    path = tmp_path / "dedicated-wallet.json"
    path.write_text(json.dumps(list(bytes(kp))))
    return kp, str(path)


def live_settings(keypath, **kw):
    return replace(Settings(), execution_mode=LIVE, live_confirm=CONFIRM_PHRASE, keypair_path=keypath,
                   helius_rpc_url="https://live.rpc.test", db_path=":memory:", **kw)


def make_executor(api, client, kp, settings, breaker=lambda: False):
    kw = {"sleep": no_sleep}
    rpc = SolanaRpc(settings.helius_rpc_url, None, client, **kw)
    jup = Jupiter(client, **kw)
    for c in (*rpc.endpoints, jup.api):
        c.bucket = TokenBucket(1e6, 1)
    return LiveExecutor(settings, rpc, jup, kp, client, breaker, sleep=no_sleep)


def decode(tx_b64):
    return VersionedTransaction.from_bytes(base64.b64decode(tx_b64))


# --- activation -------------------------------------------------------------------

def test_live_requires_all_confirmations(keyfile):
    _, path = keyfile
    with pytest.raises(ExecutionDisabled):
        check_live_enabled(replace(live_settings(path), execution_mode=PAPER))
    with pytest.raises(ExecutionDisabled):
        check_live_enabled(replace(live_settings(path), live_confirm="yes"))
    with pytest.raises(ExecutionDisabled):
        check_live_enabled(replace(live_settings(path), keypair_path=None))
    check_live_enabled(live_settings(path))


def test_bot_refuses_live_without_confirmation(keyfile):
    from bot import Bot
    _, path = keyfile
    with pytest.raises(SystemExit, match="LIVE_TRADING_CONFIRM"):
        Bot(replace(live_settings(path), live_confirm=None), client=FakeApis().client())


def test_live_requires_rpc(keyfile):
    kp, path = keyfile
    api = FakeApis()

    async def go():
        async with api.client() as c:
            s = replace(live_settings(path), helius_rpc_url=None)
            LiveExecutor(s, SolanaRpc(None, None, c), Jupiter(c), kp, c)

    with pytest.raises(ExecutionDisabled):
        run(go())


def test_keypair_loading_and_redaction(keyfile):
    kp, path = keyfile
    assert load_keypair(path).pubkey() == kp.pubkey()
    red = str(live_settings(path).redacted())
    assert path not in red and CONFIRM_PHRASE not in red


def test_tip_accounts_are_valid_pubkeys():
    assert all(is_pubkey(a) for a in JITO_TIP_ACCOUNTS)


# --- swap -------------------------------------------------------------------------

def test_buy_builds_signed_protected_transaction(keyfile):
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True

    async def go():
        async with api.client() as c:
            ex = make_executor(api, c, kp, live_settings(path))
            return await ex.buy(CLEAN, 1.0)  # demandé 1 SOL -> plafonné à 0,05

    res = run(go())
    assert res.signature == "SIG1" and res.confirmed
    assert res.in_amount == 50_000_000  # LIVE_MAX_POSITION_SOL
    assert api.rpc_methods.index("simulateTransaction") < api.rpc_methods.index("getSignatureStatuses")
    assert api.swap_requests[0]["userPublicKey"] == str(kp.pubkey())

    tx = decode(api.sent[0])
    keys = [str(k) for k in tx.message.account_keys]
    assert keys[0] == str(kp.pubkey())                 # payeur = wallet dédié
    assert JITO_DONT_FRONT in keys                     # protection anti-sandwich
    assert any(t in keys for t in JITO_TIP_ACCOUNTS)  # pourboire Jito
    idx = keys.index(JITO_DONT_FRONT)
    hdr = tx.message.header
    assert idx >= hdr.num_required_signatures          # non signataire
    assert idx >= len(keys) - hdr.num_readonly_unsigned_accounts  # lecture seule
    assert tx.verify_and_hash_message() is not None    # signature valide


def test_simulation_failure_blocks_send(keyfile):
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True
    api.simulation_error = {"InstructionError": [2, {"Custom": 6001}]}

    async def go():
        async with api.client() as c:
            await make_executor(api, c, kp, live_settings(path)).buy(CLEAN, 0.01)

    with pytest.raises(GuardrailViolation, match="simulation"):
        run(go())
    assert api.sent == []


def test_guardrails_block_before_any_network_call(keyfile):
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True

    async def go(settings, breaker, amount):
        async with api.client() as c:
            await make_executor(api, c, kp, settings, breaker).swap(SOL, CLEAN, amount)

    with pytest.raises(GuardrailViolation, match="coupe-circuit"):
        run(go(live_settings(path), lambda: True, 1_000_000))
    with pytest.raises(GuardrailViolation, match="LIVE_MAX_POSITION_SOL"):
        run(go(live_settings(path), lambda: False, 2 * 10**9))
    assert api.sent == [] and api.swap_requests == []


def test_sell_all_uses_onchain_balance(keyfile):
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True

    async def go():
        async with api.client() as c:
            return await make_executor(api, c, kp, live_settings(path)).sell_all(CLEAN)

    res = run(go())
    assert res.in_amount == 123_456 and len(api.sent) == 1


def test_honeypot_cannot_be_bought_live(keyfile):
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True

    async def go():
        async with api.client() as c:
            return await make_executor(api, c, kp, live_settings(path)).sell_all(HONEYPOT)

    with pytest.raises(GuardrailViolation, match="devis"):
        run(go())
    assert api.sent == []


# --- bot complet en LIVE ---------------------------------------------------------

def test_bot_live_end_to_end(keyfile):
    from bot import Bot
    kp, path = keyfile
    api = FakeApis()
    api.live_allowed = True

    async def go():
        bot = Bot(live_settings(path), client=api.client())
        for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api, *bot.rpc.endpoints,
                    bot.social.reddit.api):
            cli._sleep = no_sleep
            cli.bucket = TokenBucket(1e6, 1)
        bot.executor._sleep = no_sleep
        results = await bot.scan_once()
        api.exit_multiplier = 2.0
        closed = await bot.monitor_once()
        await bot.aclose()
        return results, closed

    results, closed = run(go())
    by_mint = {r["mint"]: r for r in results}
    assert by_mint[CLEAN]["final"] == "LIVE_ENTRY"
    assert by_mint[HONEYPOT]["final"] == "REJECT"
    assert closed and closed[0]["reason"] == "TAKE_PROFIT" and closed[0]["signature"] == "SIG2"
    assert len(api.sent) == 2  # un achat, une vente — rien pour les jetons rejetés
    buy_keys = [str(k) for k in decode(api.sent[0]).message.account_keys]
    assert JITO_DONT_FRONT in buy_keys and Pubkey.from_string(buy_keys[0]) == kp.pubkey()
