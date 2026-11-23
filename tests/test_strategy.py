import asyncio
import random
import sqlite3
from dataclasses import replace

import pytest

from fake_apis import CLEAN, HONEYPOT, FakeApis, no_sleep
from fetchers import DexScreener, TokenBucket
from paper_trader import PaperTrader
from strategy.backtest import DataStore, TokenPath, backtest, metrics, optimize, simulate, to_env
from strategy.entry import EntryRules, evaluate_entry
from strategy.exit import ExitRules, decide
from strategy.sizing import kelly_fraction, position_size

R = ExitRules()  # défauts : SL -25, TP1 +40 (50 %), stop suiveur 25 % dès +40, TP final +300, 240 min


# --- sorties ---------------------------------------------------------------------------

@pytest.mark.parametrize("pnl,peak,held,tp1,expected", [
    (None, 0, 1, False, ("SELL_ALL", "NO_EXIT_ROUTE")),
    (-26, 0, 1, False, ("SELL_ALL", "STOP_LOSS")),
    (-10, 0, 1, False, None),
    (45, 45, 1, False, ("SELL_PARTIAL", "TP1")),
    (45, 45, 1, True, None),                         # TP1 déjà pris : on laisse courir
    (-1, 60, 5, True, ("SELL_ALL", "BREAKEVEN_STOP")),  # stop remonté au prix d'entrée
    (100, 200, 5, True, ("SELL_ALL", "TRAILING_STOP")),  # -33 % depuis le plus haut
    (180, 200, 5, True, None),                       # -6,7 % depuis le plus haut : on garde
    (310, 310, 5, True, ("SELL_ALL", "TAKE_PROFIT")),
    (5, 10, 241, False, ("SELL_ALL", "TIME_STOP")),
])
def test_exit_decisions(pnl, peak, held, tp1, expected):
    d = decide(R, pnl, peak, held, tp1)
    assert (d.action, d.reason) == expected if expected else d is None


def test_partial_then_trailing_lets_winner_run():
    tr = PaperTrader(exit_rules=R, clock=lambda: 0.0)
    pos = tr.open(CLEAN, 1.0, {"outAmount": "1000"})
    assert tr.evaluate(pos, 1.5).reason == "TP1"          # +48,5 % net
    proceeds = tr.partial_close(pos, 1.5, 0.5)
    assert proceeds == pytest.approx(0.75 * 0.99)
    assert pos.remaining_frac == 0.5 and pos.token_amount == 495
    assert tr.evaluate(pos, 1.5) is None                  # la moitié restante vaut 0,75 (+48 %)
    assert tr.evaluate(pos, 2.0) is None                  # +98 % : nouveau plus haut
    assert tr.evaluate(pos, 1.4).reason == "TRAILING_STOP"  # -30 % depuis le plus haut
    pnl = tr.close(pos, 1.4, "TRAILING_STOP")
    assert pnl == pytest.approx(0.75 * 0.99 + 1.4 * 0.99 - 1.0)
    assert pnl > 0


def test_old_database_is_migrated(tmp_path):
    db = tmp_path / "old.sqlite3"
    con = sqlite3.connect(db)
    con.executescript("""CREATE TABLE positions (id INTEGER PRIMARY KEY AUTOINCREMENT, mint TEXT NOT NULL,
      opened_at REAL NOT NULL, size_sol REAL NOT NULL, token_amount INTEGER NOT NULL, entry_price_impact_pct REAL,
      status TEXT NOT NULL DEFAULT 'OPEN', closed_at REAL, exit_value_sol REAL, pnl_sol REAL, pnl_pct REAL,
      exit_reason TEXT);
      INSERT INTO positions (mint, opened_at, size_sol, token_amount) VALUES ('m', 0, 0.5, 10);""")
    con.commit()
    con.close()
    pos = PaperTrader(db).open_positions()[0]
    assert pos.remaining_frac == 1.0 and pos.tp1_done is False
    assert pos.source == "scan" and pos.signal_buyers == () and pos.sold_signal_buyers == ()


def test_copytop_sales_require_a_multi_wallet_quorum():
    tr = PaperTrader(clock=lambda: 0.0)
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000"}, source="copytop",
                  signal_buyers=("pf_a", "pf_b", "pf_c", "pf_d"))
    assert not tr.copytop_exit_ready(pos)
    assert tr.add_copytop_sales(pos, ["pf_a", "unrelated"]) == 1
    assert not tr.copytop_exit_ready(pos)  # 1/4 : une vente isolée ne suffit pas
    assert tr.add_copytop_sales(pos, ["pf_b"]) == 2
    assert tr.copytop_exit_ready(pos)      # 2/4 : quorum atteint
    restored = tr.open_positions()[0]
    assert restored.signal_buyers == ("pf_a", "pf_b", "pf_c", "pf_d")
    assert restored.sold_signal_buyers == ("pf_a", "pf_b")
    scan = tr.open(HONEYPOT, 0.05, {"outAmount": "1000"}, source="scan",
                   signal_buyers=("pf_a", "pf_b"))
    assert not tr.copytop_exit_ready(scan)


def test_cooldown_blocks_rebuying_a_loser():
    t = [0.0]
    tr = PaperTrader(clock=lambda: t[0], reentry_cooldown_h=24, daily_max_loss_sol=100)
    tr.close(tr.open(CLEAN, 0.5, {"outAmount": "1"}), 0.2, "STOP_LOSS")
    assert tr.can_open(CLEAN) == (False, "COOLDOWN")
    t[0] += 25 * 3600
    assert tr.can_open(CLEAN) == (True, "OK")


# --- entrées ----------------------------------------------------------------------------

GOOD = {"pair_age_min": 180, "price_change_h1": 12, "buys_h1": 120, "sells_h1": 90,
        "volume_h1_usd": 20_000, "liquidity_usd": 80_000}


@pytest.mark.parametrize("change,flag", [
    ({"pair_age_min": 5}, "PAIR_TOO_YOUNG"),
    ({"price_change_h1": 900}, "PARABOLIC"),
    ({"price_change_h1": -40}, "DUMPING"),
    ({"buys_h1": 50, "sells_h1": 100}, "SELL_PRESSURE"),
    ({"buys_h1": 5, "sells_h1": 5}, "LOW_ACTIVITY"),
    ({"pair_age_min": None}, "UNKNOWN_PAIR_AGE_MIN"),
])
def test_entry_rules(change, flag):
    assert evaluate_entry(GOOD, EntryRules()) == (True, [])
    ok, flags = evaluate_entry({**GOOD, **change}, EntryRules())
    assert not ok and any(f.startswith(flag) for f in flags)


# --- taille ------------------------------------------------------------------------------

def test_kelly_and_negative_edge_pause():
    assert kelly_fraction(0.5, 60, 25) == pytest.approx(0.5 / 0.25 - 0.5 / 0.6)
    warm = position_size("kelly", 0.05, 0.2, 2.0, {"closed_trades": 3})
    assert warm.size_sol == 0.05 and warm.reason.startswith("FIXED")
    good = {"closed_trades": 40, "win_rate_pct": 50, "avg_win_pct": 60, "avg_loss_pct": -25}
    k = position_size("kelly", 0.05, 0.2, 1.0, good)
    assert k.reason == "KELLY" and 0.05 < k.size_sol <= 0.2
    bad = {"closed_trades": 40, "win_rate_pct": 20, "avg_win_pct": 40, "avg_loss_pct": -30}
    assert position_size("fixed", 0.05, 0.2, 1.0, bad).size_sol == 0  # avantage négatif : pause


# --- backtest & optimiseur ------------------------------------------------------------------

def _path(mint, t0, prices, feats=None, cost=2.0, liq=50_000):
    snaps = [(t0 + 60 * (i + 1), p, liq) for i, p in enumerate(prices)]
    return TokenPath(mint, t0, 1.0, cost, feats or dict(GOOD), snaps)


def test_simulate_partial_trailing_and_rug():
    pump = _path("a", 0, [1.2, 1.5, 2.0, 3.0, 2.0])     # TP1 à 1,5 puis stop suiveur à 2,0 (-33 %)
    res = simulate(pump, R)
    assert res.reason == "TRAILING_STOP" and res.pnl_pct > 50
    rug = TokenPath("b", 0, 1.0, 2.0, GOOD, [(60, 1.1, 50_000), (120, 0.01, 200)])
    assert simulate(rug, R).reason == "RUGGED" and simulate(rug, R).pnl_pct == -100
    dump = _path("c", 0, [0.9, 0.7])
    assert simulate(dump, R).reason == "STOP_LOSS"


def _synthetic_market(n=120, seed=7):
    """Jetons à fort ratio achats/ventes : pompent puis retombent. Les autres : chutent."""
    rnd = random.Random(seed)
    paths = []
    for i in range(n):
        strong = i % 3 == 0
        feats = {**GOOD, "buys_h1": 200 if strong else 110, "sells_h1": 100}
        if strong:
            peak = rnd.uniform(1.8, 3.5)
            prices = [1 + (peak - 1) * k / 10 for k in range(1, 11)] + [peak * 0.6, peak * 0.4]
        else:
            prices = [1 - 0.05 * k for k in range(1, 12)]
        paths.append(_path(f"t{i}", i * 7200, prices, feats))
    return paths


def test_optimizer_finds_the_edge_out_of_sample():
    paths = _synthetic_market()
    base_entry = replace(EntryRules(), min_buy_sell_ratio_h1=0.8)  # réglage de départ médiocre
    res = optimize(paths, base_entry, ExitRules(), min_train_trades=10, min_test_trades=10)
    best = res["best"]
    assert best["entry"]["min_buy_sell_ratio_h1"] == 1.3            # ne garde que les jetons forts
    assert best["test"]["total_return_pct"] > 0 and best["test"]["win_rate_pct"] == 100
    assert res["status"] == "RENTABLE_HORS_ECHANTILLON"
    assert res["purged_train_tokens"] == 6 and res["train_tokens"] == 78
    assert res["current_settings"]["test"]["total_return_pct"] < best["test"]["total_return_pct"]
    assert res["env"]["MIN_BUY_SELL_RATIO_H1"] == "1.3"


def test_optimizer_refuses_when_no_edge():
    rnd = random.Random(1)
    noise = [_path(f"n{i}", i * 7200, [1 - 0.04 * k * rnd.random() for k in range(1, 12)]) for i in range(60)]
    res = optimize(noise, EntryRules(), ExitRules(), min_train_trades=10, min_test_trades=10)
    assert res["status"].startswith("NON_RENTABLE")


def test_optimizer_requires_a_real_oos_sample():
    paths = _synthetic_market()
    res = optimize(paths, EntryRules(), ExitRules(), min_train_trades=10, min_test_trades=30)
    assert res["status"].startswith("PAS_ASSEZ_DE_DONNEES_TEST")
    assert res["best"]["test"]["trades"] < 30


def test_optimizer_needs_data():
    assert optimize([], EntryRules(), ExitRules())["status"].startswith("PAS_ASSEZ")


def test_metrics_and_env_export():
    m = metrics([])
    assert m["trades"] == 0
    env = to_env(replace(EntryRules(), max_price_change_h1=1e9), replace(ExitRules(), tp1_pct=None))
    assert env["MAX_PRICE_CHANGE_H1"] == "off" and env["TP1_PCT"] == "off"


# --- collecte de données ------------------------------------------------------------------

def test_datastore_roundtrip_and_backtest():
    t = [1000.0]
    ds = DataStore(clock=lambda: t[0])
    ds.record_observation("m1", 1.0, 2.0, dict(GOOD))
    for p in (1.2, 1.5, 2.0, 3.0, 2.0):
        t[0] += 60
        ds.record_snapshots([("m1", p, 50_000)])
    paths = ds.load_paths()
    assert len(paths) == 1 and len(paths[0].snaps) == 5
    res, trades = backtest(paths, EntryRules(), ExitRules())
    assert res["trades"] == 1 and trades[0].reason == "TRAILING_STOP"
    assert ds.tracked_mints() == ["m1"] and ds.stats()["snapshots"] == 5


def test_dexscreener_batch_prices():
    api = FakeApis()

    async def go():
        async with api.client() as c:
            d = DexScreener(c, sleep=no_sleep)
            d.pairs.bucket = TokenBucket(1e6, 1)
            return await d.prices([CLEAN, HONEYPOT])

    out = asyncio.run(go())
    assert set(out) == {CLEAN, HONEYPOT} and out[CLEAN][1] == 80_000


def test_bot_records_observations_and_tracks():
    from bot import Bot
    from config import Settings
    api = FakeApis()

    async def go():
        bot = Bot(replace(Settings(), db_path=":memory:"), client=api.client())
        for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api, bot.social.reddit.api):
            cli._sleep = no_sleep
            cli.bucket = TokenBucket(1e6, 1)
        await bot.scan_once()
        n = await bot.track_once()
        live_rep = await bot.report_with_open_positions()
        assert len(live_rep["open_positions"]) == 1 and live_rep["unrealized_pnl_sol"] < 0  # frais payés
        rep = bot.report()
        bt = bot.run_backtest()
        await bot.aclose()
        return n, rep, bt

    n, rep, bt = asyncio.run(go())
    assert n == 1  # seul le jeton sain est suivi (le honeypot et le jeton piégé ne le sont pas)
    assert rep["data_collected"] == {"tokens_observed": 1, "snapshots": 1}
    assert bt["trades"] == 1


def test_copytop_sell_tape_closes_only_the_originating_smart_position():
    from bot import Bot
    from config import Settings
    from datetime import datetime, timezone, timedelta
    api = FakeApis()
    sale_at = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
    api.copytop_live_trades = [
        {"at": sale_at, "handle": "pf_a", "side": "sell",
         "chain": "solana", "token": CLEAN, "usd": 500},
        {"at": sale_at, "handle": "pf_b", "side": "sell",
         "chain": "solana", "token": CLEAN, "usd": 600},
        {"at": sale_at, "handle": "pf_c", "side": "sell",
         "chain": "solana", "token": CLEAN, "usd": 10},
        {"at": sale_at, "handle": "unrelated", "side": "sell",
         "chain": "solana", "token": CLEAN, "usd": 9000},
    ]

    async def go():
        bot = Bot(replace(Settings(), db_path=":memory:"), client=api.client())
        for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api,
                    bot.social.reddit.api, bot.copytop.api):
            cli._sleep = no_sleep
            cli.bucket = TokenBucket(1e6, 1)
        result = await bot.process(
            CLEAN,
            smart={"n_wallets": 3, "min_wallets": 2, "entry_mcap_usd": 1_000_000,
                   "buyers": ["pf_a", "pf_b", "pf_c"]},
            engine="copytop",
        )
        assert result["final"] == "PAPER_ENTRY"
        assert bot.trader.open_positions()[0].source == "copytop"
        closed = await bot.monitor_once()
        requests = list(api.copytop_requests)
        await bot.aclose()
        return closed, requests

    closed, requests = asyncio.run(go())
    assert [(x["reason"], x["action"]) for x in closed] == [("COPYTOP_DISTRIBUTION", "SELL_ALL")]
    sells = [x for x in requests if x["tool"] == "get_live_trades"]
    assert len(sells) == 1 and set(sells[0]["arguments"]["traders"]) == {"pf_a", "pf_b", "pf_c"}
    assert sells[0]["arguments"]["min_usd"] == 100.0


# --- surveillance rapide ---------------------------------------------------------------------

def test_near_exit_estimates():
    tr = PaperTrader(exit_rules=R, clock=lambda: 0.0)
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000"}, entry_price_usd=1.0)
    assert not tr.near_exit(pos, 1.05)      # +5 % : loin de tout seuil
    assert tr.near_exit(pos, 0.78)          # ~-24 % : proche du stop à -25 %
    assert tr.near_exit(pos, 1.40)          # ~+37 % : proche du TP1 à +40 %
    assert tr.near_exit(pos, None)          # prix inconnu : on vérifie
    assert tr.open_positions()[0].entry_price_usd == 1.0


def test_fast_watch_only_quotes_positions_near_a_threshold():
    from bot import Bot
    from config import Settings
    api = FakeApis()

    async def go():
        bot = Bot(replace(Settings(), db_path=":memory:"), client=api.client())
        for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api, bot.social.reddit.api):
            cli._sleep = no_sleep
            cli.bucket = TokenBucket(1e6, 1)
        await bot.process(CLEAN)
        quotes_before = sum("/quote" in c for c in api.calls)
        calm = await bot.fast_watch_once()                       # prix inchangé : aucun devis
        quotes_calm = sum("/quote" in c for c in api.calls)
        api.price_multiplier = api.exit_multiplier = 0.5         # chute brutale de 50 %
        crash = await bot.fast_watch_once()
        await bot.aclose()
        return quotes_before, quotes_calm, calm, crash

    before, calm_quotes, calm, crash = asyncio.run(go())
    assert calm == [] and calm_quotes == before
    assert crash and crash[0]["reason"] == "STOP_LOSS"
