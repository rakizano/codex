"""Stratégie : entrées (vélocité, âge), sorties (ATR, TP1 30 %, plancher, stagnation, priorités),
volatilité, backtest pessimiste, Walk-Forward, Shadow Ledger, régime macro, coûts."""
import asyncio
import math
import random
import sqlite3
from dataclasses import replace

import pytest

from fake_apis import CLEAN, SOL, FakeApis, candles, no_sleep
from fetchers import DexScreener, TokenBucket
from paper_trader import PaperTrader
from strategy.backtest import (BASE, PESSIMISTIC, PROFILE_GRID, STRESS, DataStore, TokenPath, WFConfig,
                               backtest, backtest_report, metrics, profiles, simulate, walk_forward)
from strategy.entry import PAPER_FAST, STRICT, EntryRules, evaluate_entry, is_selection_only_rejection
from strategy.exit import (LEGACY_EXIT_RULES, ExitContext, ExitRules, decide, decide_legacy, lock_trail,
                           stop_pct_for, trail_pct_for)
from strategy.risk import MacroRegime, quote_slippage_pct
from strategy.shadow import ShadowLedger
from strategy.sizing import position_size
from strategy.volatility import ATR_SOURCE, PROXY_SOURCE, Volatility, atr_pct, clean_candles, m5_proxy

R = ExitRules()


def run(coro):
    return asyncio.run(coro)


# --- entrées : vélocité et politique d'âge -------------------------------------------------

GOOD = {"pair_age_min": 180, "dex_id": "raydium", "liquidity_usd": 80_000, "mcap_usd": 400_000,
        "buys_m5": 30, "sells_m5": 15, "buys_h1": 200, "sells_h1": 150, "volume_m5_usd": 4_000,
        "volume_h1_usd": 25_000, "price_change_h1": 20.0, "price_usd": 0.001}


def test_good_token_passes():
    assert evaluate_entry(GOOD, EntryRules()) == (True, [])


@pytest.mark.parametrize("change,flag", [
    ({"pair_age_min": 10}, "PAIR_TOO_YOUNG"),
    ({"pair_age_min": None}, "UNKNOWN_PAIR_AGE"),
    ({"volume_m5_usd": None}, "UNKNOWN_VOLUME_M5_USD"),
    ({"liquidity_usd": 9_000, "mcap_usd": 60_000}, "LOW_LIQUIDITY"),
    ({"mcap_usd": 2_000_000}, "ABNORMAL_LIQ_MCAP_RATIO"),        # 4 % < 8 %
    ({"mcap_usd": 100_000}, "ABNORMAL_LIQ_MCAP_RATIO"),          # 80 % > 70 %
    ({"mcap_usd": 0}, "ABNORMAL_LIQ_MCAP_RATIO"),
    ({"buys_m5": 8, "sells_m5": 6}, "LOW_M5_ACTIVITY"),
    ({"volume_m5_usd": 2_000, "volume_h1_usd": 10_000}, "LOW_M5_VOLUME_USD"),
    ({"buys_m5": 20, "sells_m5": 19}, "WEAK_M5_BUY_PRESSURE"),
    ({"buys_m5": 70, "sells_m5": 10}, "SUSPECT_WASH_OR_BOT_RATIO"),
    ({"volume_h1_usd": 60_000}, "DECELERATING_VOLUME"),         # 4000*12/60000 = 0,8
    ({"volume_h1_usd": 0}, "DECELERATING_VOLUME"),              # pas de contournement
    ({"price_change_h1": -30}, "DUMPING_H1"),
    ({"price_change_h1": 400}, "PARABOLIC_H1"),
    ({"dex_id": "pumpfun"}, "STILL_ON_BONDING_CURVE"),
    ({"buys_h1": 10, "sells_h1": 5}, "LOW_H1_ACTIVITY"),
])
def test_entry_rejections(change, flag):
    ok, flags = evaluate_entry({**GOOD, **change}, EntryRules())
    assert not ok and any(f.startswith(flag) for f in flags), flags


def test_volume_acceleration_boundary():
    ok, _ = evaluate_entry({**GOOD, "volume_m5_usd": 2_600, "volume_h1_usd": 24_000}, EntryRules())  # 1,3
    assert ok
    ok, flags = evaluate_entry({**GOOD, "volume_m5_usd": 2_600, "volume_h1_usd": 24_100}, EntryRules())
    assert not ok and flags[0].startswith("DECELERATING_VOLUME")


def test_pair_age_policies_are_separate():
    young = {**GOOD, "pair_age_min": 5}
    assert not evaluate_entry(young, EntryRules(), "copytop")[0]                      # STRICT : 30 min
    fast = EntryRules(pair_age_policy=PAPER_FAST)
    assert evaluate_entry(young, fast, "copytop")[0]                                  # 3 min pour signaux
    assert not evaluate_entry(young, fast, "scan")[0]                                 # 10 min pour scan
    assert evaluate_entry({**young, "buys_h1": 1, "sells_h1": 1}, fast, "smart")[0]   # pas de règle H1 en FAST
    assert EntryRules().pair_age_policy == STRICT


def test_selection_only_rejection_classification():
    assert is_selection_only_rejection(["PAIR_TOO_YOUNG(5<30min)", "LOW_M5_ACTIVITY(3tx)"])
    assert not is_selection_only_rejection(["LOW_M5_ACTIVITY(3tx)", "TOP10_CONCENTRATION(40%)"])
    assert not is_selection_only_rejection(["STILL_ON_BONDING_CURVE"])
    assert not is_selection_only_rejection([])


# --- volatilité ---------------------------------------------------------------------------

def test_atr_on_valid_candles_and_rejections():
    v = atr_pct(candles(30, range_pct=4.0), 14)
    assert v.source == ATR_SOURCE and abs(v.pct - 4.0) < 0.01
    assert atr_pct(candles(10), 14) is None                                 # insuffisant
    bad = candles(30)
    bad[3] = [bad[3][0], 0.001, 0.0005, 0.002, 0.001, 1]                    # haut < bas
    assert atr_pct(bad, 14) is None
    assert clean_candles([[1, 1, 1, 1]]) is None                            # forme invalide
    assert atr_pct(candles(30, range_pct=500), 14) is None                  # bougie aberrante


def test_atr_sorts_and_dedups_candles():
    rows = candles(30)
    shuffled = rows[:]
    random.Random(1).shuffle(shuffled)
    assert atr_pct(shuffled, 14).pct == atr_pct(rows + rows[:5], 14).pct


def test_m5_proxy_is_labelled_and_optional():
    v = m5_proxy(-6.5)
    assert v.source == PROXY_SOURCE and v.pct == 6.5
    assert stop_pct_for(R, v) == R.stop_loss_pct                            # proxy refusé par défaut
    assert stop_pct_for(replace(R, allow_m5_proxy=True), v) == -18.0        # 2,2 x 6,5 = 14,3 -> 18
    assert m5_proxy(None) is None


# --- sorties --------------------------------------------------------------------------------

def test_atr_stop_and_trail_bounds():
    assert stop_pct_for(R, Volatility(5, ATR_SOURCE)) == -18.0     # 11 -> plancher 18
    assert stop_pct_for(R, Volatility(12, ATR_SOURCE)) == pytest.approx(-26.4)
    assert stop_pct_for(R, Volatility(30, ATR_SOURCE)) == -38.0     # plafond
    assert stop_pct_for(R, None) == -25.0                          # mode conservateur
    assert trail_pct_for(R, Volatility(5, ATR_SOURCE)) == 20.0
    assert trail_pct_for(R, Volatility(14, ATR_SOURCE)) == 28.0
    assert trail_pct_for(R, Volatility(40, ATR_SOURCE)) == 35.0
    assert lock_trail(25.0, 30.0) == 25.0 and lock_trail(25.0, 20.0) == 20.0 and lock_trail(None, 22) == 22


def ctx(pnl, peak=0.0, held=1.0, tp1=False, stop=-25.0, trail=25.0, **kw):
    return ExitContext(pnl, peak, held, tp1, stop, trail, **kw)


@pytest.mark.parametrize("c,expected", [
    (ctx(None), ("SELL_ALL", "NO_EXIT_ROUTE")),
    (ctx(10, emergency="LIQUIDITY"), ("SELL_ALL", "EMERGENCY_LIQUIDITY")),
    (ctx(-26), ("SELL_ALL", "STOP_LOSS")),
    (ctx(-20, stop=-18), ("SELL_ALL", "STOP_LOSS")),
    (ctx(-10), None),
    (ctx(41, 41), ("SELL_PARTIAL", "TP1", 0.30)),
    (ctx(310, 310), ("SELL_ALL", "TAKE_PROFIT")),
    (ctx(2, 60, 30, tp1=True), ("SELL_ALL", "POST_TP1_FLOOR")),
    (ctx(15, 60, 30, tp1=True), ("SELL_ALL", "TRAILING_STOP")),    # 1,15/1,60 = -28 % > 25 %
    (ctx(40, 60, 30, tp1=True), None),
    (ctx(2, 7, 21), ("SELL_ALL", "STAGNATION")),
    (ctx(2, 9, 21), None),                                         # a déjà touché +8 %
    (ctx(4, 7, 21), None),                                         # au-dessus de +3 %
    (ctx(2, 7, 19), None),                                         # moins de 20 min
    (ctx(20, 30, 121), ("SELL_ALL", "TIME_STOP")),
])
def test_exit_decisions(c, expected):
    d = decide(R, c)
    assert (None if d is None else (d.action, d.reason) + ((d.fraction,) if d.action == "SELL_PARTIAL" else ())) \
        == expected


def test_exit_priority_stop_beats_everything_but_emergency():
    d = decide(R, ctx(-30, 0, 200, copytop_exit=True))
    assert d.reason == "STOP_LOSS"
    assert decide(R, ctx(-30, emergency="RUG")).reason == "EMERGENCY_RUG"
    assert decide(R, ctx(5, 7, 200, copytop_exit=True)).reason == "COPYTOP_DISTRIBUTION"   # avant stagnation


def test_copytop_disengagement_rules():
    assert decide(R, ctx(5, 6, copytop_disengaged=True)).reason == "COPYTOP_DISENGAGEMENT"
    assert decide(R, ctx(30, 32, copytop_disengaged=True)) is None              # gain > 10 % : on garde
    assert decide(R, ctx(15, 30, copytop_disengaged=True)).reason == "COPYTOP_TIGHT_TRAIL"  # -11,5 % > 10 %


def test_legacy_decide_is_unchanged_for_live():
    assert decide_legacy(LEGACY_EXIT_RULES, -1, 60, 5, True).reason == "BREAKEVEN_STOP"
    assert decide_legacy(LEGACY_EXIT_RULES, 45, 45, 1, False).fraction == 0.5
    assert decide_legacy(LEGACY_EXIT_RULES, 5, 10, 241, False).reason == "TIME_STOP"


# --- registre PAPER -------------------------------------------------------------------------

def _trader(**kw):
    now = [1_000_000.0]
    tr = PaperTrader(exit_rules=kw.pop("rules", R), clock=lambda: now[0], tip_sol=0.0001, **kw)
    return tr, now


def test_partial_sale_fees_are_counted_per_execution():
    tr, now = _trader()
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000000"}, vol=Volatility(10, ATR_SOURCE))
    assert pos.stop_pct == -22.0 and pos.trail_pct == 20.0
    entry_fees = pos.fees_sol
    assert entry_fees == pytest.approx(0.05 * 0.01 + 0.0001)
    d = tr.evaluate(pos, 0.075)                    # +~46 % net
    assert d.reason == "TP1" and d.fraction == 0.30
    proceeds = tr.partial_close(pos, 0.075, d.fraction)
    assert proceeds == pytest.approx(0.0225 * 0.99 - 0.0001)
    assert pos.fees_sol == pytest.approx(entry_fees + 0.0225 * 0.01 + 0.0001)
    now[0] += 600
    pnl = tr.close(pos, 0.03, "TRAILING_STOP")
    assert pnl == pytest.approx(proceeds + 0.03 * 0.99 - 0.0001 - 0.05)
    row = tr.db.execute("SELECT fees_sol FROM positions").fetchone()[0]
    assert row == pytest.approx(entry_fees + 0.0225 * 0.01 + 0.0001 + 0.03 * 0.01 + 0.0001)


def test_trailing_never_loosens_when_volatility_rises():
    tr, _ = _trader()
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000000"}, vol=Volatility(10, ATR_SOURCE))
    tr.evaluate(pos, 0.05, vol=Volatility(16, ATR_SOURCE))     # suiveur 32 % refusé : on garde 20 %
    assert tr.open_positions()[0].trail_pct == 20.0


def test_legacy_trader_ignores_new_exit_signals():
    tr, _ = _trader(legacy=True)
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000000"}, vol=Volatility(10, ATR_SOURCE))
    assert pos.stop_pct == -25.0
    assert tr.evaluate(pos, 0.051, copytop_exit=True, copytop_disengaged=True) is None


def test_source_circuit_breaker_is_isolated_and_reactivable():
    tr, now = _trader(source_cb_max_losses=2, reentry_cooldown_h=0, daily_max_loss_sol=100)
    for i in range(2):
        pos = tr.open(f"M{i}" + CLEAN[2:], 0.05, {"outAmount": "1000"}, source="copytop")
        now[0] += 60
        tr.close(pos, 0.01, "STOP_LOSS")
    assert tr.source_paused("copytop") and not tr.source_paused("scan")
    assert tr.can_open(CLEAN, "copytop") == (False, "SOURCE_CIRCUIT_BREAKER(copytop)")
    assert tr.can_open(CLEAN, "scan")[0]
    now[0] += 60
    tr.reactivate_source("copytop", "revue manuelle")
    assert tr.can_open(CLEAN, "copytop")[0]
    stats = tr.by_source()["copytop"]
    assert stats["losses"] == 2 and stats["losses_since_reset"] == 0 and stats["profit_factor"] == 0.0


def test_macro_limit_on_open_positions():
    tr, _ = _trader()
    tr.open("A" + CLEAN[1:], 0.05, {"outAmount": "1"})
    tr.open("B" + CLEAN[1:], 0.05, {"outAmount": "1"})
    assert tr.can_open(CLEAN, "scan", max_open=2) == (False, "MAX_OPEN_POSITIONS_MACRO(2)")
    assert tr.can_open(CLEAN, "scan")[0]


def test_old_database_is_migrated(tmp_path):
    db = tmp_path / "old.sqlite3"
    con = sqlite3.connect(db)
    con.execute("CREATE TABLE positions (id INTEGER PRIMARY KEY AUTOINCREMENT, mint TEXT NOT NULL, "
                "opened_at REAL NOT NULL, size_sol REAL NOT NULL, token_amount INTEGER NOT NULL, "
                "entry_price_impact_pct REAL, status TEXT NOT NULL DEFAULT 'OPEN', closed_at REAL, "
                "exit_value_sol REAL, pnl_sol REAL, pnl_pct REAL, exit_reason TEXT)")
    con.execute("INSERT INTO positions (mint, opened_at, size_sol, token_amount) VALUES (?, 0, 0.05, 1000)", (CLEAN,))
    con.commit()
    con.close()
    pos = PaperTrader(db, exit_rules=R, clock=lambda: 60.0).open_positions()[0]
    assert pos.remaining_frac == 1.0 and pos.source == "scan" and pos.stop_pct is None and pos.fees_sol == 0.0


def test_copytop_sales_require_a_multi_wallet_quorum():
    tr, _ = _trader()
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000"}, source="copytop", signal_buyers=["a", "b", "c", "d"])
    tr.add_copytop_sales(pos, ["a", "intrus"])
    assert not tr.copytop_exit_ready(pos, 2, 0.5)
    tr.add_copytop_sales(pos, ["b"])
    assert tr.copytop_exit_ready(pos, 2, 0.5)
    assert tr.open_positions()[0].sold_signal_buyers == ("a", "b")


def test_cooldown_blocks_rebuying_a_loser():
    tr, now = _trader()
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000"})
    tr.close(pos, 0.03, "STOP_LOSS")
    assert tr.can_open(CLEAN) == (False, "COOLDOWN")
    now[0] += 25 * 3600
    assert tr.can_open(CLEAN)[0]


def test_kelly_and_negative_edge_pause():
    stats = {"closed_trades": 40, "win_rate_pct": 20, "avg_win_pct": 30, "avg_loss_pct": -25}
    assert position_size("kelly", 0.05, 0.05, 1.0, stats).reason == "NEGATIVE_EDGE"
    good = {"closed_trades": 40, "win_rate_pct": 50, "avg_win_pct": 60, "avg_loss_pct": -20}
    assert position_size("kelly", 0.05, 0.05, 10.0, good).size_sol <= 0.05


def test_near_exit_uses_position_stop():
    tr, _ = _trader()
    pos = tr.open(CLEAN, 0.05, {"outAmount": "1000"}, entry_price_usd=1.0, vol=Volatility(5, ATR_SOURCE))
    assert not tr.near_exit(pos, 1.05)
    assert tr.near_exit(pos, 0.84)          # ~-18 % : proche du stop ATR à -18 %
    assert tr.near_exit(pos, 1.40)
    assert tr.near_exit(pos, None)


# --- backtest pessimiste --------------------------------------------------------------------

def _path(mint, t0, prices, feats=None, liq=50_000, step=60, ohlc=None):
    feats = {**GOOD, **(feats or {})}
    snaps = ohlc if ohlc is not None else [(t0 + (i + 1) * step, p, liq) for i, p in enumerate(prices)]
    return TokenPath(mint, t0, 1.0, 3.0, feats, snaps)


def test_simulate_tp1_then_floor_and_rug():
    t = simulate(_path("A", 0, [1.5, 1.2, 1.0]), R)
    assert t.reason == "POST_TP1_FLOOR" and not t.censored
    assert simulate(_path("B", 0, [0.95, 0.9], liq=500), R).reason == "RUGGED"


def test_stop_checked_before_tp_in_same_candle():
    bar = [(60, 1.6, 0.5, 1.0, 50_000)]           # haut +60 % ET bas -50 % dans la même bougie
    t = simulate(_path("C", 0, [], ohlc=bar), R)
    assert t.reason == "STOP_LOSS" and t.pnl_pct < -40


def test_open_positions_are_censored_not_counted():
    t = simulate(_path("D", 0, [1.01, 1.02]), R)
    assert t.censored and t.reason == "OPEN_AT_END"
    m = metrics([t, simulate(_path("E", 0, [0.5]), R)])
    assert m["trades"] == 1 and m["censored"] == 1


def test_fees_and_slippage_scenarios():
    p = _path("F", 0, [0.5], feats={"impact_pct": 1.0})
    base, pess, stress = (simulate(p, R, sc) for sc in (BASE, PESSIMISTIC, STRESS))
    assert base.pnl_pct > pess.pnl_pct > stress.pnl_pct
    assert base.fees_pct == pytest.approx(100 * (0.0005 + 0.0001 + 0.0001 + base.fees_pct / 100 - 0.0007), rel=1)
    assert stress.slippage_pct > pess.slippage_pct     # +4 % uniquement sur la sortie de stop
    winner = _path("G", 0, [1.5, 3.5], feats={"impact_pct": 1.0})
    assert simulate(winner, R, STRESS).pnl_pct == pytest.approx(simulate(winner, R, PESSIMISTIC).pnl_pct)


def test_metrics_profit_factor_edge_cases():
    win = simulate(_path("H", 0, [4.5]), R)
    assert win.reason == "TAKE_PROFIT"
    assert metrics([win])["profit_factor"] == "inf"
    assert metrics([])["trades"] == 0
    m = metrics([win, simulate(_path("I", 0, [0.5]), R)])
    assert isinstance(m["profit_factor"], float) and m["distribution"]["p50"] is not None


def test_profile_grid_has_18_profiles():
    ps = profiles(R)
    assert len(ps) == 18 == math.prod(len(v) for v in PROFILE_GRID.values())
    assert {p.tp1_fraction for p in ps} == {0.25, 0.35}


def _market(n, seed=3, edge=True, start=0.0, spacing=1800.0):
    rnd = random.Random(seed)
    paths = []
    for i in range(n):
        up = rnd.random() < (0.45 if edge else 0.15)
        prices = [1.0 + 0.02 * k for k in range(1, 4)] + ([1.5, 2.2, 3.6, 2.0] if up else [0.85, 0.7, 0.6])
        paths.append(_path(f"T{i:03d}", start + i * spacing, prices, feats={"impact_pct": 0.5}))
    return paths


def test_walk_forward_insufficient_evidence_below_70_trades():
    res = walk_forward(_market(60), EntryRules(), R)
    assert res["status"].startswith("INSUFFICIENT_EVIDENCE")


def test_walk_forward_four_folds_with_purge_and_no_leakage():
    paths = _market(150)
    res = walk_forward(paths, EntryRules(), R, WFConfig(purge_hours=12))
    assert len(res["folds"]) == 4
    for f in res["folds"]:
        assert f["purged"] >= 1                     # purge temporelle réelle (horodatages)
        trained = [p for p in paths if p.t0 + 12 * 3600 <= f["test_start"]]
        assert f["train_paths"] <= len(trained)
        assert "chosen" in f and f["train"] is not f["test"]
    assert res["status"].startswith("RENTABLE_HORS_ECHANTILLON")
    assert res["profiles"] == 18


def test_walk_forward_refuses_when_no_edge():
    res = walk_forward(_market(150, edge=False), EntryRules(), R)
    assert res["status"] == "NOT_PROFITABLE_OUT_OF_SAMPLE"


def test_walk_forward_selection_ignores_test_data():
    paths = _market(150)
    base = walk_forward(paths, EntryRules(), R)
    # On sabote uniquement les données de test du 4e pli : les choix des plis 1-3 ne changent pas.
    cut = base["folds"][3]["test_start"]
    sabotaged = [p if p.t0 < cut else _path(p.mint, p.t0, [0.4]) for p in paths]
    other = walk_forward(sabotaged, EntryRules(), R)
    assert [f.get("chosen") for f in other["folds"][:3]] == [f.get("chosen") for f in base["folds"][:3]]


def test_backtest_report_separates_sources_and_scenarios():
    paths = _market(20)
    for p in paths[:10]:
        p.features["source"] = "copytop"
    rep = backtest_report(paths, EntryRules(), R)
    assert set(rep) == {"base", "pessimistic", "stress"}
    assert set(rep["base"]["by_source"]) == {"copytop", "scan"}


def test_datastore_roundtrip():
    store = DataStore(":memory:", clock=lambda: 1000.0)
    store.record_observation(CLEAN, 0.001, 3.0, {**GOOD, "source": "smart"})
    store.clock = lambda: 1060.0
    store.record_snapshots([(CLEAN, 0.0015, 50_000)])
    (p,) = store.load_paths()
    assert p.source == "smart" and p.impact_pct == 1.0     # impact inconnu : hypothèse prudente
    m, trades = backtest([p], EntryRules(), R)
    assert trades[0].reason == "TP1" or trades[0].censored


# --- Shadow Ledger -----------------------------------------------------------------------------

def test_shadow_ledger_records_selection_rejections_only_and_tracks_prices():
    now = [0.0]
    sl = ShadowLedger(clock=lambda: now[0])
    obs = {**GOOD}
    assert not sl.record(CLEAN, "scan", ["TOP10_CONCENTRATION(30%)"], obs)
    assert not sl.record(CLEAN, "scan", ["LOW_M5_ACTIVITY(3tx)", "RUGCHECK_DANGER"], obs)
    assert sl.record(CLEAN, "scan", ["LOW_M5_ACTIVITY(3tx)"], obs)
    assert not sl.record(CLEAN, "scan", ["LOW_M5_ACTIVITY(3tx)"], obs)       # dédoublonné
    api = FakeApis()

    async def go():
        dex = DexScreener(api.client())
        dex.pairs._sleep = no_sleep
        now[0] = 16 * 60
        n1 = await sl.update_prices(dex)
        now[0] = 61 * 60
        n2 = await sl.update_prices(dex)
        return n1, n2

    assert run(go()) == (1, 1)
    st = sl.stats()["LOW_M5_ACTIVITY"]
    assert st["n"] == 1 and st["avg_ret_15m_pct"] == 0.0 and st["samples_120m"] == 0


# --- régime macro et coûts ------------------------------------------------------------------------

def test_macro_regime_stress_on_drop_unknown_or_stale():
    api = FakeApis()
    now = [0.0]

    async def go(change):
        api.sol_change_h1 = change
        dex = DexScreener(api.client())
        m = MacroRegime(dex, -5.0, clock=lambda: now[0])
        before = m.state()
        await m.refresh()
        return before, m

    before, m = run(go(-6.0))
    assert before.stress and before.reason == "SOL_DATA_UNKNOWN"
    assert m.state().stress and m.state().reason.startswith("SOL_DROP_H1")
    _, m = run(go(1.0))
    assert not m.state().stress
    now[0] = 1000
    assert m.state().reason == "SOL_DATA_STALE"


def test_quote_slippage_measure():
    assert quote_slippage_pct(0.05, 0.048) == pytest.approx(4.0)
    assert quote_slippage_pct(None, 0.05) is None and quote_slippage_pct(0.05, None) is None


# --- bot : observations et surveillance rapide ------------------------------------------------

def _bot(api, **kw):
    from bot import Bot
    from config import Settings
    bot = Bot(replace(Settings(), db_path=":memory:", **kw), client=api.client())
    for cli in (bot.dex.profiles, bot.dex.pairs, bot.gecko.api, bot.rug.api, bot.jup.api,
                bot.social.reddit.api, bot.copytop.api):
        cli._sleep = no_sleep
        cli.bucket = TokenBucket(1e6, 1)
    return bot


def test_bot_records_observations_with_source_volatility_and_impact():
    api = FakeApis()

    async def go():
        bot = _bot(api)
        res = await bot.process(CLEAN)
        await bot.track_once()
        paths = bot.data.load_paths()
        await bot.aclose()
        return res, paths

    res, paths = run(go())
    assert res["final"] == "PAPER_ENTRY" and res["volatility"]["source"] == ATR_SOURCE
    (p,) = paths
    assert p.source == "scan" and p.features["vol_source"] == ATR_SOURCE and p.features["impact_pct"] >= 0


def test_bot_falls_back_to_conservative_exits_without_ohlcv():
    api = FakeApis()
    api.ohlcv = None      # 429 persistant : pas de fausse mesure ATR

    async def go():
        bot = _bot(api)
        res = await bot.process(CLEAN)
        pos = bot.trader.open_positions()[0]
        await bot.aclose()
        return res, pos

    res, pos = run(go())
    assert res["volatility"] is None and pos.stop_pct == -25.0 and pos.vol_source is None


def test_fast_watch_only_quotes_positions_near_a_threshold():
    api = FakeApis()

    async def go():
        bot = _bot(api)
        await bot.process(CLEAN)
        api.calls.clear()
        quiet = await bot.fast_watch_once()
        quotes_quiet = sum("/quote" in c for c in api.calls)
        api.price_multiplier = 0.7
        api.exit_multiplier = 0.7
        urgent = await bot.fast_watch_once()
        await bot.aclose()
        return quiet, quotes_quiet, urgent

    quiet, quotes_quiet, urgent = run(go())
    assert quiet == [] and quotes_quiet == 0
    assert [e["reason"] for e in urgent] == ["STOP_LOSS"]


def test_hard_position_cap_and_strict_live_switch(monkeypatch):
    from config import HARD_MAX_POSITION_SOL, PAPER, Settings
    monkeypatch.setenv("POSITION_SIZE_SOL", "2")
    monkeypatch.setenv("MAX_POSITION_SOL", "5")
    monkeypatch.setenv("LIVE_MAX_POSITION_SOL", "1")
    monkeypatch.setenv("MIN_LIQUIDITY_USD", "100")        # assouplissement refusé
    monkeypatch.setenv("MAX_TOP10_PCT", "90")
    for ambiguous in ("live", "Live", " LIVE", "LIVE ", "TRUE", "1"):
        monkeypatch.setenv("EXECUTION_MODE", ambiguous)
        assert Settings.from_env().execution_mode == PAPER
    s = Settings.from_env()
    assert s.position_size_sol == s.max_position_sol == s.live_max_position_sol == HARD_MAX_POSITION_SOL
    assert s.thresholds.min_liquidity_usd == 15_000 and s.thresholds.max_top10_pct == 25
    assert sorted(SOL) and s.backtest_min_trades_total >= 70
