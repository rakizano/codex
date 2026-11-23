"""Anti-rug renforcé : concentration réelle, réseaux d'insiders, créateurs sériels (fail-closed)."""
import asyncio

import pytest

from cache import TTLCache
from fake_apis import CLEAN, FakeApis, _report, no_sleep
from fetchers import DexScreener, GeckoTerminal, Jupiter, RugCheck, SolanaRpc, TokenBucket
from filters.holders import (CreatorHistory, InsiderRules, compute_real_top10_pct, insider_flags,
                             is_token_creation)
from filters.rug_detector import RugDetector


def H(addr, owner, pct, insider=False):
    return {"address": addr, "owner": owner, "pct": pct, "insider": insider}


def test_real_top10_excludes_only_confirmed_technical_accounts():
    rep = {"knownAccounts": {"LOCK": {"type": "LOCKER"}, "AMMX": {"type": "AMM"}, "DEV": {"type": "CREATOR"}},
           "markets": [{"pubkey": "POOL", "liquidityA": "RA", "liquidityAAccount": {"owner": "POOLAUTH"}}],
           "topHolders": [H("RA", "POOLAUTH", 30), H("L1", "LOCK", 20), H("A1", "AMMX", 10),
                          H("B1", "1nc1nerator11111111111111111111111111111111", 5),
                          H("D1", "DEV", 4)] + [H(f"W{i}", f"O{i}", 2.0) for i in range(12)]}
    pct, details = compute_real_top10_pct(rep)
    assert pct == pytest.approx(4 + 9 * 2.0)            # le créateur reste un vrai détenteur
    assert details["excluded_technical"] == 4


def test_unknown_or_unconfirmed_accounts_are_not_excluded():
    rep = {"knownAccounts": {"X": {"type": "MYSTERY"}}, "markets": [],
           "topHolders": [H("A", "X", 30)] + [H(f"W{i}", f"O{i}", 1) for i in range(5)]}
    assert compute_real_top10_pct(rep)[0] == 30 + 5


@pytest.mark.parametrize("holders,reason", [
    (None, "TOP_HOLDERS_MISSING"),
    ([H("A", "O", "abc")], "TOP_HOLDER_PCT_INVALID"),
    ([H("A", "O", 150)], "TOP_HOLDER_PCT_INVALID"),
    ([H(f"W{i}", f"O{i}", 9) for i in range(15)], "PCT_UNITS_INCONSISTENT"),
    ([H(f"R{i}", "POOLAUTH", 1) for i in range(12)] + [H(f"W{i}", f"O{i}", 1) for i in range(8)],
     "TOP10_INCOMPLETE_AFTER_EXCLUSION"),
])
def test_ambiguous_holder_data_is_rejected(holders, reason):
    rep = {"markets": [{"pubkey": "P", "liquidityAAccount": {"owner": "POOLAUTH"}}], "topHolders": holders}
    pct, details = compute_real_top10_pct(rep)
    assert pct is None and details["reason"] == reason


def net(ntype, size, holding):
    return {"id": "n", "type": ntype, "size": size, "tokenAmount": holding, "currentHolding": holding,
            "activeAccounts": size}


@pytest.mark.parametrize("report,expected", [
    ({"graphInsidersDetected": 0, "insiderNetworks": None}, []),
    ({"insiderNetworks": [net("transfer", 25, 1)], "token": {"supply": 1000}}, ["INSIDER_NETWORK_LARGE"]),
    ({"insiderNetworks": [net("trade", 5, 60)], "token": {"supply": 1000}}, ["INSIDER_NETWORK_HOLDING"]),
    ({"insiderNetworks": [net("transfer", 5, 10)], "token": {"supply": 1000}}, []),   # petit et < 5 %
    ({"insiderNetworks": [net("other", 50, 900)], "token": {"supply": 1000}}, []),     # type non suspect
    ({"graphInsidersDetected": 3, "insiderNetworks": None}, ["UNKNOWN_INSIDER_NETWORKS"]),
    ({}, ["UNKNOWN_INSIDER_NETWORKS"]),
    ({"insiderNetworks": [{"type": "trade"}]}, ["UNKNOWN_INSIDER_NETWORKS"]),
    ({"insiderNetworks": [net("trade", 5, 10)], "token": {}}, ["INSIDER_NETWORK_UNKNOWN_HOLDING"]),
])
def test_insider_network_rules(report, expected):
    flags = insider_flags(report, InsiderRules())
    assert [f.split("(")[0] for f in flags] == expected
    assert insider_flags(report, InsiderRules(enabled=False)) == []


def test_insider_endpoint_shape_is_supported():
    rep = {"insiderNetworks": [{"id": "x", "size": 30, "activityType": "transfer", "totalAmount": 1,
                                "currentHolding": 1, "numActiveAccounts": 30}], "token": {"supply": 1000}}
    assert insider_flags(rep, InsiderRules())[0].startswith("INSIDER_NETWORK_LARGE")


def _tx(logs, err=None):
    return {"meta": {"err": err, "logMessages": logs}}


def test_token_creation_classification():
    pump = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
    assert is_token_creation(_tx([f"Program {pump} invoke [1]", "Program log: Instruction: Create"])) is True
    assert is_token_creation(_tx(["Program log: Instruction: InitializeMint2"])) is True
    assert is_token_creation(_tx(["Program log: Instruction: Transfer"])) is False
    assert is_token_creation(_tx(["Program log: Instruction: Create"], err={"x": 1})) is False
    assert is_token_creation({"meta": {}}) is None and is_token_creation(None) is None


class FakeRpc:
    configured = True

    def __init__(self, sigs, txs, fail=False):
        self.sigs, self.txs, self.fail, self.calls = sigs, txs, fail, []

    async def call(self, method, params):
        self.calls.append(method)
        if self.fail:
            raise RuntimeError("rpc down")
        if method == "getSignaturesForAddress":
            return self.sigs
        return self.txs[params[0]]


def _hist(rpc, now=10_000_000.0):
    return CreatorHistory(rpc, TTLCache(":memory:"), max_signatures=40, clock=lambda: now)


def test_serial_creator_counting_and_cache():
    now = 10_000_000.0
    create = _tx(["Program log: Instruction: InitializeMint2"])
    other = _tx(["Program log: Instruction: Transfer"])
    sigs = [{"signature": f"s{i}", "blockTime": now - 3600 * i, "err": None} for i in range(6)]
    sigs.append({"signature": "old", "blockTime": now - 8 * 86400, "err": None})
    txs = {f"s{i}": (create if i < 4 else other) for i in range(6)}
    rpc = FakeRpc(sigs, txs)
    h = _hist(rpc, now)
    assert asyncio.run(h.launches_7d("CREATOR")) == 4      # les transferts ne sont pas des créations
    n_calls = len(rpc.calls)
    assert asyncio.run(h.launches_7d("CREATOR")) == 4 and len(rpc.calls) == n_calls   # cache


@pytest.mark.parametrize("case", ["rpc_down", "ambiguous_tx", "page_too_short", "no_rpc"])
def test_creator_history_unknown_cases(case):
    now = 10_000_000.0
    sigs = [{"signature": "s0", "blockTime": now - 60, "err": None}]
    if case == "rpc_down":
        rpc = FakeRpc(sigs, {}, fail=True)
    elif case == "ambiguous_tx":
        rpc = FakeRpc(sigs, {"s0": {"meta": {}}})
    elif case == "page_too_short":
        rpc = FakeRpc([{"signature": f"s{i}", "blockTime": now - i, "err": None} for i in range(40)], {})
    else:
        rpc = None
    assert asyncio.run(_hist(rpc, now).launches_7d("CREATOR")) is None


def _detector(api, client, creator=None, required=False):
    for cli in (DexScreener(client), ):
        pass
    dex, rug, jup = DexScreener(client), RugCheck(client), Jupiter(client)
    gecko = GeckoTerminal(TTLCache(":memory:"), client)
    for c in (dex.profiles, dex.pairs, rug.api, jup.api, gecko.api):
        c._sleep = no_sleep
        c.bucket = TokenBucket(1e6, 1)
    return RugDetector(dex, rug, gecko, jup, SolanaRpc(None), creator_history=creator,
                       creator_check_required=required)


class _Hist:
    def __init__(self, n):
        self.n = n

    async def launches_7d(self, creator):
        return self.n


@pytest.mark.parametrize("overrides,hist,required,flag", [
    ({}, None, False, None),
    ({"insiderNetworks": [net("transfer", 40, 1)], "graphInsidersDetected": 40}, None, False, "INSIDER_NETWORK_LARGE"),
    ({}, _Hist(5), False, "SERIAL_CREATOR"),
    ({}, _Hist(3), False, None),
    ({}, _Hist(None), True, "UNKNOWN_CREATOR_HISTORY"),
    ({}, _Hist(None), False, None),
    ({"topHolders": None}, None, False, "UNKNOWN_TOP10"),
])
def test_rug_detector_integration(overrides, hist, required, flag):
    api = FakeApis()
    api.report_overrides = overrides

    async def go():
        async with api.client() as c:
            return await _detector(api, c, hist, required).audit(CLEAN)

    res = asyncio.run(go())
    if flag is None:
        assert res.verdict == "WATCHLIST_PAPER", res.flags
    else:
        assert res.verdict == "REJECT" and any(f.startswith(flag) for f in res.flags), res.flags


def test_missing_rugcheck_report_rejects():
    api = FakeApis()
    api.report_overrides = None

    class NoReport(RugCheck):
        async def report(self, mint):
            return None

    async def go():
        async with api.client() as c:
            d = _detector(api, c)
            d.rugcheck = NoReport(c)
            return await d.audit(CLEAN)

    res = asyncio.run(go())
    assert res.verdict == "REJECT" and "UNKNOWN_INSIDER_NETWORKS" in res.flags
    assert _report()["insiderNetworks"] is None
