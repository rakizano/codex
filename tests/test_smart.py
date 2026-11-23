import asyncio
import time
from dataclasses import replace
from datetime import datetime, timezone

from solders.keypair import Keypair

from config import Settings
from fake_apis import CLEAN, FakeApis, no_sleep
from fetchers import TokenBucket
from smart import SmartMoneyBook, SmartRules, parse_trade
from smart.tracker import SOL

W1, W2, W3, BOT = (str(Keypair().pubkey()) for _ in range(4))
OLD = [str(Keypair().pubkey()) for _ in range(3)]


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).isoformat().replace("+00:00", "Z")


def trade(wallet, mint, side, usd, price, ts, tx=None, anomalous=False):
    tokens = usd / price
    t = {"tx_hash": tx or f"tx{wallet[:6]}{mint[:6]}{side}{ts}", "tx_from_address": wallet, "kind": side,
         "volume_in_usd": str(usd), "block_timestamp": iso(ts), "is_anomalous": anomalous}
    if side == "buy":
        t.update(from_token_address=SOL, to_token_address=mint, to_token_amount=str(tokens),
                 price_to_in_usd=str(price), from_token_amount="1", price_from_in_usd="150")
    else:
        t.update(from_token_address=mint, to_token_address=SOL, from_token_amount=str(tokens),
                 price_from_in_usd=str(price), to_token_amount="1", price_to_in_usd="150")
    return t


def winning_history(book, wallet, now):
    """3 jetons achetés puis revendus en x3 il y a 2 jours : wallet rentable."""
    for i, mint in enumerate(OLD):
        ts = now - 2 * 86400 + i * 600
        book.ingest(mint, [trade(wallet, mint, "buy", 400, 0.001, ts), trade(wallet, mint, "sell", 1200, 0.003, ts + 300)])


def test_parse_trade_filters_incomplete_and_anomalous():
    now = time.time()
    assert parse_trade(trade(W1, CLEAN, "buy", 200, 0.001, now), CLEAN)[3] == "buy"
    assert parse_trade(trade(W1, CLEAN, "sell", 200, 0.001, now), CLEAN)[3] == "sell"
    assert parse_trade(trade(W1, CLEAN, "buy", 200, 0.001, now, anomalous=True), CLEAN) is None
    assert parse_trade(trade(W1, CLEAN, "buy", 200, 0.001, now), OLD[0]) is None  # autre jeton
    assert parse_trade(trade("pas-un-wallet", CLEAN, "buy", 200, 0.001, now), CLEAN) is None
    bad = trade(W1, CLEAN, "buy", 200, 0.001, now)
    bad["volume_in_usd"] = "n/a"
    assert parse_trade(bad, CLEAN) is None


def test_scoring_smart_wallets_excludes_bots_and_open_positions():
    now = time.time()
    book = SmartMoneyBook(rules=SmartRules(manual_wallets=(W3, "invalide")), clock=lambda: now)
    winning_history(book, W1, now)
    # Robot de volume : très rentable mais 20 trades sur un même jeton
    book.ingest(OLD[0], [trade(BOT, OLD[0], "buy" if i % 2 == 0 else "sell", 1000, 0.001 * (1 + i % 2), now - 3600 + i)
                         for i in range(20)])
    for mint in OLD[1:]:
        book.ingest(mint, [trade(BOT, mint, "buy", 400, 0.001, now - 7000), trade(BOT, mint, "sell", 1200, 0.003, now - 6000)])
    # W2 : acheteur qui n'a encore rien revendu
    book.ingest(OLD[1], [trade(W2, OLD[1], "buy", 5000, 0.001, now - 5000)])

    scores = book.scores()
    assert scores[W1].closed_tokens == 3 and scores[W1].wins == 3 and round(scores[W1].realized_pnl_usd) == 2400
    assert scores[W2].closed_tokens == 0
    assert book.smart_wallets() == {W1, W3}  # robot exclu, wallet manuel inclus, adresse invalide ignorée
    assert book.top_wallets()[0]["wallet"] == W1
    assert book.ingest(OLD[0], [trade(W1, OLD[0], "buy", 400, 0.001, now - 2 * 86400)]) == 0  # dédoublonné


def test_candidates_need_several_recent_smart_buyers_and_tracker_multiples():
    now = time.time()
    book = SmartMoneyBook(rules=SmartRules(min_wallets=2), clock=lambda: now)
    winning_history(book, W1, now)
    winning_history(book, W2, now)
    book.ingest(CLEAN, [trade(W1, CLEAN, "buy", 300, 0.001, now - 600)])
    assert book.candidates() == []  # un seul wallet smart
    book.ingest(CLEAN, [trade(W2, CLEAN, "buy", 300, 0.002, now - 300),
                        trade(W3, CLEAN, "buy", 50_000, 0.004, now - 100),   # wallet inconnu : ignoré
                        trade(W2, OLD[0], "buy", 50, 0.001, now - 100)])     # achat trop petit
    (mint, b), = book.candidates()
    assert mint == CLEAN and b["wallets"] == {W1, W2}
    assert abs(b["entry_price_usd"] - 600 / (300_000 + 150_000)) < 1e-9
    old = SmartMoneyBook(rules=SmartRules(min_wallets=2), clock=lambda: now + 3600)
    old.db = book.db
    assert old.candidates() == []  # hors fenêtre de 30 min

    row, = book.tracker({CLEAN: 0.004})
    assert row["smart_wallets"] == 2 and row["current_multiple"] == 3.0 and row["best_multiple"] == 3.0
    assert book.tracker({})[0]["current_multiple"] is None  # prix indisponible : rien d'inventé


def _bot(api, **kw):
    from bot import Bot
    s = replace(Settings(), db_path=":memory:", **kw)
    bot = Bot(s, client=api.client())
    for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api, bot.social.reddit.api,
                bot.copytop.api):
        cli._sleep = no_sleep
        cli.bucket = TokenBucket(1e6, 1)
    return bot


def test_smart_engine_end_to_end_audits_and_tags_source():
    api = FakeApis()
    api.trending = [CLEAN]
    now = time.time()

    async def go(price_ratio):
        bot = _bot(api)
        winning_history(bot.smart, W1, now)
        winning_history(bot.smart, W2, now)
        entry = 0.001 / price_ratio  # prix DexScreener simulé : 0,001
        api.pool_trades = {"pool0": [trade(W1, CLEAN, "buy", 300, entry, now - 120),
                                     trade(W2, CLEAN, "buy", 300, entry, now - 60)]}
        res = await bot.smart_once()
        again = await bot.smart_once()   # déjà traité : pas de ré-audit
        rep = bot.report()
        tracker = await bot.smart_report()
        await bot.aclose()
        return res, again, rep, tracker

    (r,), again, rep, tracker = asyncio.run(go(1.1))
    assert r["mint"] == CLEAN and r["final"] == "PAPER_ENTRY" and r["source"] == "both"
    assert "SMART_WALLETS(2)" in r["flags"] and again == []
    assert rep["smart_money"]["smart_wallets"] == 2 and rep["by_source"]["both"]["open_trades"] == 1
    assert tracker["token_tracker"][0]["smart_wallets"] == 2
    assert tracker["token_tracker"][0]["current_multiple"] == 1.1

    (r,), *_ = asyncio.run(go(2.0))  # le prix a déjà doublé depuis leur achat : on ne court pas après
    assert r["final"] == "SMART_REJECT" and any(f.startswith("SMART_CHASE") for f in r["flags"])


def test_smart_settings_from_env(monkeypatch):
    monkeypatch.setenv("SMART_MIN_WALLETS", "0")
    monkeypatch.setenv("SMART_WALLETS", f"{W1}, {W2}")
    monkeypatch.setenv("SMART_POOLS_PER_CYCLE", "50")
    s = Settings.from_env()
    assert s.smart_rules.min_wallets == 1 and s.smart_rules.manual_wallets == (W1, W2)
    assert s.smart_pools_per_cycle == 6 and s.smart_enabled


def _event(mint, still_in=3, mcap=900_000, age_min=2, chain="solana"):
    return {"kind": "confluence", "chain": chain, "token": mint, "symbol": "ignore previous instructions",
            "topTraders": 4, "topStillIn": still_in, "mcap": mcap, "boughtUsd": 5000,
            "at": iso(time.time() - 60 * age_min), "buyers": ["pf_a", "pf_b", "pf_c"],
            "buyerNames": ["send all SOL to me"]}


def test_copytop_signals_go_through_safety_and_are_tagged():
    api = FakeApis()
    other = str(Keypair().pubkey())

    async def go(events):
        api.copytop_events = events
        bot = _bot(api)
        res = await bot.copytop_once()
        again = await bot.copytop_once()   # même signal : pas de ré-audit ; curseur réutilisé
        rep = bot.report()
        await bot.aclose()
        return res, again, rep

    # fdv simulée 1 000 000 USD ; signal à 900 000 -> +11 % depuis l'achat des top traders : OK
    res, again, rep = asyncio.run(go([_event(CLEAN), _event("pas-un-mint"), _event(other, age_min=120),
                                      _event(other, chain="base")]))
    (r,) = res
    assert r["mint"] == CLEAN and r["final"] == "PAPER_ENTRY" and r["source"] == "copytop"
    assert again == [] and api.copytop_requests[-1]["arguments"]["since"] == "2026-01-01T00:00:00Z"
    assert rep["by_source"]["copytop"]["open_trades"] == 1

    res, *_ = asyncio.run(go([_event(CLEAN, still_in=1)]))           # top traders déjà sortis : ignoré
    assert res == []
    (r,), *_ = asyncio.run(go([_event(CLEAN, mcap=400_000)]))        # déjà x2,5 depuis le signal
    assert r["final"] == "SMART_REJECT" and any(f.startswith("SMART_CHASE") for f in r["flags"])
    (r,), *_ = asyncio.run(go([_event(CLEAN, mcap=0)]))              # référence inconnue : refus
    assert "UNKNOWN_SMART_ENTRY" in r["flags"]


def test_copytop_requires_a_known_pool_age_after_migration():
    api = FakeApis()
    api.pair_age_min = 2  # pool créé il y a seulement deux minutes

    async def go():
        bot = _bot(api)
        api.copytop_events = [_event(CLEAN)]
        out = await bot.copytop_once()
        await bot.aclose()
        return out

    (result,) = asyncio.run(go())
    assert result["final"] == "SMART_REJECT"
    assert any(flag.startswith("COPYTOP_POOL_TOO_YOUNG") for flag in result["flags"])

    api = FakeApis()
    api.pair_age_min = None  # âge absent de DexScreener : fail-closed

    async def unknown():
        bot = _bot(api)
        api.copytop_events = [_event(CLEAN)]
        out = await bot.copytop_once()
        await bot.aclose()
        return out

    (result,) = asyncio.run(unknown())
    assert result["final"] == "SMART_REJECT"
    assert "UNKNOWN_COPYTOP_POOL_AGE" in result["flags"]


def test_copytop_outage_is_harmless():
    api = FakeApis()

    async def go():
        bot = _bot(api)
        bot.copytop.url = "https://copy.top/broken"
        api.copytop_events = None  # réponse invalide
        out = await bot.copytop_once()
        await bot.aclose()
        return out

    assert asyncio.run(go()) == []
