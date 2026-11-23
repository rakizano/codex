"""Configuration centralisée, lue depuis l'environnement. PAPER par défaut, toujours."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from memecoin.filters import Thresholds
from smart.tracker import SmartRules
from strategy.entry import PAPER_FAST, STRICT, EntryRules
from strategy.exit import ExitRules

PAPER = "PAPER"
LIVE = "LIVE"
HARD_MAX_POSITION_SOL = 0.05   # exposition maximale par position, quel que soit le réglage


def _bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() not in ("0", "false", "no", "off", "")


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


def _int_list(name: str, default: tuple[int, ...]) -> tuple[int, ...]:
    raw = os.environ.get(name)
    if not raw:
        return default
    try:
        vals = tuple(sorted({int(x) for x in raw.split(",") if x.strip()}))
    except ValueError:
        return default
    return vals if vals and all(v > 0 for v in vals) else default


def _opt_float(name: str, default: float | None) -> float | None:
    """Comme _float, mais « off »/« none » désactive le réglage (None)."""
    raw = os.environ.get(name)
    if raw is None:
        return default
    if raw.strip().lower() in ("off", "none", ""):
        return None
    try:
        return float(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    execution_mode: str = PAPER
    helius_rpc_url: str | None = None
    chainstack_rpc_url: str | None = None
    db_path: str = "data/bot.sqlite3"

    # Taille et gestion des positions simulées
    position_size_sol: float = 0.05   # taille des positions (simulées ET réelles : même coût relatif)
    audit_size_sol: float = 0.5       # taille du devis de test d'impact/honeypot
    max_open_positions: int = 5
    daily_max_loss_sol: float = 1.0  # coupe-circuit
    reentry_cooldown_h: float = 24.0  # pas de rachat d'un jeton clôturé en perte depuis moins de N h

    # Taille adaptative (Kelly fractionné) : coupe aussi le trading si l'avantage mesuré est négatif
    sizing_mode: str = "fixed"        # fixed | kelly
    kelly_multiplier: float = 0.25
    max_position_sol: float = HARD_MAX_POSITION_SOL
    paper_bankroll_sol: float = 1.0
    min_trades_for_sizing: int = 30

    # Collecte de données pour le backtest
    track_interval_s: float = 60.0
    track_window_h: float = 24.0

    # Garde-fous d'exécution (module tx_builder, inactif en PAPER)
    max_slippage_bps: int = 300
    jito_tip_lamports: int = 100_000  # 0,0001 SOL par transaction (borné 1 000 – 5 000 000)

    # Boucle
    scan_interval_s: float = 60.0
    scan_batch_max: int = 20               # jetons audités au plus par cycle de scan
    monitor_interval_s: float = 15.0
    fast_check_interval_s: float = 5.0   # surveillance rapide (1 requête DexScreener pour toutes les positions)

    # Exécution réelle (désactivée par défaut, double confirmation obligatoire)
    live_confirm: str | None = None
    live_max_position_sol: float = 0.05
    keypair_path: str | None = None
    jito_url: str = "https://mainnet.block-engine.jito.wtf/api/v1/transactions"

    # Analyseur LLM optionnel (Ollama local)
    ollama_url: str | None = None
    ollama_model: str = "qwen2.5:7b"

    # Signaux sociaux (X optionnel, Reddit et liens DexScreener gratuits)
    social_enabled: bool = True
    x_bearer_token: str | None = None
    require_social_link: bool = True     # au moins un lien X/Telegram/site déclaré
    min_x_mentions_6h: int = 5           # appliqué seulement si X est configuré
    min_x_unique_authors_ratio: float = 0.4  # < 0,4 auteur unique par post = suspicion de shill
    max_boosts_active: int = 500         # boosts DexScreener payés au-delà : hype achetée

    # Moteur 2 : Smart Money (wallets rentables observés via les trades publics des pools)
    smart_enabled: bool = True
    smart_interval_s: float = 60.0
    smart_pools_per_cycle: int = 3       # requêtes GeckoTerminal par cycle (quota 10/min partagé)
    smart_rules: SmartRules = field(default_factory=SmartRules)
    # Signaux copy.top (classement PnL Pump.fun) : confluence de top traders sur un jeton
    copytop_enabled: bool = True
    copytop_interval_s: float = 60.0
    copytop_min_top_traders: int = 3     # top traders ayant acheté
    copytop_min_still_in: int = 2        # ... et toujours en position (pas déjà revendu)
    copytop_max_signal_age_min: float = 30.0
    copytop_exit_min_sellers: int = 2
    copytop_exit_ratio: float = 0.5
    copytop_exit_min_usd: float = 100.0
    copytop_min_pool_age_min: float = 5.0

    # copy.top : filtrage des traders et file de migration
    copytop_only_clean_fairplay: bool = True
    copytop_min_avg_hold_min: float = 5.0
    copytop_min_eligible_traders: int = 2
    copytop_wait_migration_ttl_min: float = 45.0
    copytop_watchlist_max_size: int = 50
    copytop_exit_on_drop_below_min: bool = True
    # Anti-rug complémentaire
    insider_check_enabled: bool = True
    insider_max_wallets: int = 20
    insider_max_holding_pct: float = 5.0
    creator_max_tokens_7d: int = 3
    creator_check_required: bool = False   # True : historique créateur inconnu => rejet
    # Shadow Ledger, risque par moteur, régime macro
    shadow_ledger_enabled: bool = True
    shadow_price_check_minutes: tuple[int, ...] = (15, 60, 120)
    source_cb_max_losses: int = 25
    macro_filter_enabled: bool = True
    sol_drop_h1_limit_pct: float = -5.0
    risk_max_active_positions_stress: int = 2
    # Validation
    backtest_walk_forward_folds: int = 4
    backtest_min_train_trades: int = 30
    backtest_min_trades_total: int = 70
    backtest_min_profit_factor: float = 1.2
    backtest_purge_hours: float = 12.0
    backtest_max_drawdown_bankroll_pct: float = -30.0

    thresholds: Thresholds = field(default_factory=Thresholds)
    exit_rules: ExitRules = field(default_factory=ExitRules)
    entry_rules: EntryRules = field(default_factory=EntryRules)

    @classmethod
    def from_env(cls) -> "Settings":
        # Seule la valeur exacte « LIVE » active le mode réel (qui exige en plus la phrase de
        # confirmation et un keypair) ; toute autre valeur, même proche (« live », « LIVE  »), = PAPER.
        mode = LIVE if os.environ.get("EXECUTION_MODE") == LIVE else PAPER
        # Les garde-fous anti-rug ne peuvent qu'être durcis par l'environnement, jamais assouplis.
        base = Thresholds()
        th = Thresholds(
            min_liquidity_usd=max(base.min_liquidity_usd, _float("MIN_LIQUIDITY_USD", base.min_liquidity_usd)),
            min_lp_locked_pct=max(base.min_lp_locked_pct, _float("MIN_LP_LOCKED_PCT", base.min_lp_locked_pct)),
            max_top10_pct=min(base.max_top10_pct, _float("MAX_TOP10_PCT", base.max_top10_pct)),
            max_price_impact_pct=min(base.max_price_impact_pct, _float("MAX_PRICE_IMPACT_PCT", base.max_price_impact_pct)),
            max_roundtrip_loss_pct=min(base.max_roundtrip_loss_pct,
                                       _float("MAX_ROUNDTRIP_LOSS_PCT", base.max_roundtrip_loss_pct)),
        )
        exit_mode = os.environ.get("EXIT_MODE", ExitRules.exit_mode).strip().upper()
        ex = ExitRules(
            exit_mode=exit_mode if exit_mode in ("ATR", "FIXED") else "ATR",
            stop_loss_pct=-abs(_float("STOP_LOSS_PCT", ExitRules.stop_loss_pct)),
            take_profit_pct=_float("TAKE_PROFIT_PCT", ExitRules.take_profit_pct),
            max_hold_minutes=_float("MAX_HOLD_MINUTES", ExitRules.max_hold_minutes),
            tp1_pct=_opt_float("TP1_TRIGGER_PCT", _opt_float("TP1_PCT", ExitRules.tp1_pct)),
            tp1_fraction=min(0.95, max(0.05, _float("TP1_FRACTION", ExitRules.tp1_fraction))),
            trailing_stop_pct=_opt_float("TRAILING_STOP_PCT", ExitRules.trailing_stop_pct),
            breakeven_after_tp1=_bool("BREAKEVEN_AFTER_TP1", True),
            atr_sl_mult=_float("ATR_SL_MULT", ExitRules.atr_sl_mult),
            atr_trail_mult=_float("ATR_TRAIL_MULT", ExitRules.atr_trail_mult),
            sl_min_abs_pct=abs(_float("SL_MIN_ABS_PCT", ExitRules.sl_min_abs_pct)),
            sl_max_abs_pct=abs(_float("SL_MAX_ABS_PCT", ExitRules.sl_max_abs_pct)),
            trail_min_pct=_float("TRAIL_MIN_PCT", ExitRules.trail_min_pct),
            trail_max_pct=_float("TRAIL_MAX_PCT", ExitRules.trail_max_pct),
            allow_m5_proxy=_bool("ATR_ALLOW_M5_PROXY", False),
            atr_period=max(2, int(_float("ATR_PERIOD", ExitRules.atr_period))),
            post_tp1_floor_pct=_float("POST_TP1_FLOOR_PCT", ExitRules.post_tp1_floor_pct),
            stagnation_min=_float("STAGNATION_MIN", ExitRules.stagnation_min),
            stagnation_min_peak_pct=_float("STAGNATION_MIN_PEAK_PCT", ExitRules.stagnation_min_peak_pct),
            stagnation_current_max_pct=_float("STAGNATION_CURRENT_MAX_PCT", ExitRules.stagnation_current_max_pct),
        )
        policy = os.environ.get("PAIR_AGE_POLICY", STRICT).strip().upper()
        en = EntryRules(
            pair_age_policy=PAPER_FAST if policy == PAPER_FAST else STRICT,   # STRICT par défaut
            min_pair_age_strict_min=_float("MIN_PAIR_AGE_STRICT_MIN", EntryRules.min_pair_age_strict_min),
            min_pair_age_scan_min=_float("MIN_PAIR_AGE_SCAN_MIN", EntryRules.min_pair_age_scan_min),
            min_pair_age_signal_min=_float("MIN_PAIR_AGE_SIGNAL_MIN", EntryRules.min_pair_age_signal_min),
            max_pair_age_min=_float("MAX_PAIR_AGE_MIN", EntryRules.max_pair_age_min),
            min_txns_h1=int(_float("MIN_TXNS_H1", EntryRules.min_txns_h1)),
            min_txns_m5=int(_float("MIN_TXNS_M5", EntryRules.min_txns_m5)),
            min_vol_m5_usd=_float("MIN_VOL_M5_USD", EntryRules.min_vol_m5_usd),
            min_buy_sell_ratio_m5=_float("MIN_BUY_SELL_RATIO_M5", EntryRules.min_buy_sell_ratio_m5),
            max_buy_sell_ratio_m5=_float("MAX_BUY_SELL_RATIO_M5", EntryRules.max_buy_sell_ratio_m5),
            min_vol_accel_m5_h1=_float("MIN_VOL_ACCEL_M5_H1", EntryRules.min_vol_accel_m5_h1),
            min_liq_mcap_ratio=_float("MIN_LIQ_MCAP_RATIO", EntryRules.min_liq_mcap_ratio),
            max_liq_mcap_ratio=_float("MAX_LIQ_MCAP_RATIO", EntryRules.max_liq_mcap_ratio),
            min_price_change_h1=_float("MIN_PRICE_CHANGE_H1", EntryRules.min_price_change_h1),
            max_price_change_h1=_float("MAX_PRICE_CHANGE_H1", EntryRules.max_price_change_h1),
        )
        sm = SmartRules(
            min_closed_tokens=int(_float("SMART_MIN_CLOSED_TOKENS", SmartRules.min_closed_tokens)),
            min_win_rate=_float("SMART_MIN_WIN_RATE", SmartRules.min_win_rate),
            min_realized_pnl_usd=_float("SMART_MIN_PNL_USD", SmartRules.min_realized_pnl_usd),
            max_trades_per_token=int(_float("SMART_MAX_TRADES_PER_TOKEN", SmartRules.max_trades_per_token)),
            min_buy_usd=_float("SMART_MIN_BUY_USD", SmartRules.min_buy_usd),
            window_min=_float("SMART_WINDOW_MIN", SmartRules.window_min),
            min_wallets=max(1, int(_float("SMART_MIN_WALLETS", SmartRules.min_wallets))),
            max_chase_pct=_float("SMART_MAX_CHASE_PCT", SmartRules.max_chase_pct),
            manual_wallets=tuple(w.strip() for w in os.environ.get("SMART_WALLETS", "").split(",") if w.strip()),
        )
        sizing = os.environ.get("SIZING_MODE", cls.sizing_mode).strip().lower()
        return cls(
            exit_rules=ex,
            entry_rules=en,
            smart_rules=sm,
            copytop_only_clean_fairplay=_bool("COPYTOP_ONLY_CLEAN_FAIRPLAY", True),
            copytop_min_avg_hold_min=max(0.0, _float("COPYTOP_MIN_AVG_HOLD_MIN", cls.copytop_min_avg_hold_min)),
            copytop_min_eligible_traders=max(2, int(_float("COPYTOP_MIN_ELIGIBLE_TRADERS", cls.copytop_min_eligible_traders))),
            copytop_wait_migration_ttl_min=_float("COPYTOP_WAIT_MIGRATION_TTL_MIN", cls.copytop_wait_migration_ttl_min),
            copytop_watchlist_max_size=max(1, int(_float("COPYTOP_WATCHLIST_MAX_SIZE", cls.copytop_watchlist_max_size))),
            copytop_exit_on_drop_below_min=_bool("COPYTOP_EXIT_ON_DROP_BELOW_MIN", True),
            insider_check_enabled=_bool("INSIDER_CHECK_ENABLED", True),
            insider_max_wallets=int(_float("INSIDER_MAX_WALLETS", cls.insider_max_wallets)),
            insider_max_holding_pct=_float("INSIDER_MAX_HOLDING_PCT", cls.insider_max_holding_pct),
            creator_max_tokens_7d=int(_float("CREATOR_MAX_TOKENS_7D", cls.creator_max_tokens_7d)),
            creator_check_required=_bool("CREATOR_CHECK_REQUIRED", False),
            shadow_ledger_enabled=_bool("SHADOW_LEDGER_ENABLED", True),
            shadow_price_check_minutes=_int_list("SHADOW_PRICE_CHECK_MINUTES", cls.shadow_price_check_minutes),
            source_cb_max_losses=max(1, int(_float("SOURCE_CB_MAX_LOSSES", cls.source_cb_max_losses))),
            macro_filter_enabled=_bool("MACRO_FILTER_ENABLED", True),
            sol_drop_h1_limit_pct=-abs(_float("SOL_DROP_H1_LIMIT_PCT", cls.sol_drop_h1_limit_pct)),
            risk_max_active_positions_stress=max(0, int(_float("RISK_MAX_ACTIVE_POSITIONS_STRESS",
                                                               cls.risk_max_active_positions_stress))),
            backtest_walk_forward_folds=max(2, int(_float("BACKTEST_WALK_FORWARD_FOLDS", cls.backtest_walk_forward_folds))),
            backtest_min_train_trades=max(30, int(_float("BACKTEST_MIN_TRAIN_TRADES", cls.backtest_min_train_trades))),
            backtest_min_trades_total=max(70, int(_float("BACKTEST_MIN_TRADES_TOTAL", cls.backtest_min_trades_total))),
            backtest_min_profit_factor=max(1.2, _float("BACKTEST_MIN_PROFIT_FACTOR", cls.backtest_min_profit_factor)),
            backtest_purge_hours=max(2.0, _float("BACKTEST_PURGE_HOURS", cls.backtest_purge_hours)),
            backtest_max_drawdown_bankroll_pct=-abs(_float("BACKTEST_MAX_DRAWDOWN_BANKROLL_PCT",
                                                            cls.backtest_max_drawdown_bankroll_pct)),
            copytop_enabled=os.environ.get("COPYTOP_ENABLED", "true").lower() not in ("0", "false", "no"),
            copytop_interval_s=max(30.0, _float("COPYTOP_INTERVAL_S", cls.copytop_interval_s)),
            copytop_min_top_traders=max(1, int(_float("COPYTOP_MIN_TOP_TRADERS", cls.copytop_min_top_traders))),
            copytop_min_still_in=max(1, int(_float("COPYTOP_MIN_STILL_IN", cls.copytop_min_still_in))),
            copytop_max_signal_age_min=_float("COPYTOP_MAX_SIGNAL_AGE_MIN", cls.copytop_max_signal_age_min),
            copytop_exit_min_sellers=max(2, int(_float("COPYTOP_EXIT_MIN_SELLERS", cls.copytop_exit_min_sellers))),
            copytop_exit_ratio=min(1.0, max(0.5, _float("COPYTOP_EXIT_RATIO", cls.copytop_exit_ratio))),
            copytop_exit_min_usd=max(1.0, _float("COPYTOP_EXIT_MIN_USD", cls.copytop_exit_min_usd)),
            copytop_min_pool_age_min=max(1.0, _float("COPYTOP_MIN_POOL_AGE_MIN", cls.copytop_min_pool_age_min)),
            smart_enabled=os.environ.get("SMART_ENABLED", "true").lower() not in ("0", "false", "no"),
            smart_interval_s=max(20.0, _float("SMART_INTERVAL_S", cls.smart_interval_s)),
            smart_pools_per_cycle=max(1, min(6, int(_float("SMART_POOLS_PER_CYCLE", cls.smart_pools_per_cycle)))),
            sizing_mode=sizing if sizing in ("fixed", "kelly") else "fixed",
            kelly_multiplier=min(1.0, max(0.05, _float("KELLY_MULTIPLIER", cls.kelly_multiplier))),
            max_position_sol=min(HARD_MAX_POSITION_SOL, abs(_float("MAX_POSITION_SOL", cls.max_position_sol))),
            paper_bankroll_sol=_float("PAPER_BANKROLL_SOL", cls.paper_bankroll_sol),
            min_trades_for_sizing=int(_float("MIN_TRADES_FOR_SIZING", cls.min_trades_for_sizing)),
            reentry_cooldown_h=_float("REENTRY_COOLDOWN_H", cls.reentry_cooldown_h),
            track_interval_s=_float("TRACK_INTERVAL_S", cls.track_interval_s),
            fast_check_interval_s=max(2.0, _float("FAST_CHECK_INTERVAL_S", cls.fast_check_interval_s)),
            track_window_h=_float("TRACK_WINDOW_H", cls.track_window_h),
            execution_mode=mode,
            helius_rpc_url=os.environ.get("HELIUS_RPC_URL") or None,
            chainstack_rpc_url=os.environ.get("CHAINSTACK_RPC_URL") or None,
            db_path=os.environ.get("BOT_DB_PATH", cls.db_path),
            position_size_sol=min(HARD_MAX_POSITION_SOL, abs(_float("POSITION_SIZE_SOL", cls.position_size_sol))),
            audit_size_sol=_float("AUDIT_SIZE_SOL", cls.audit_size_sol),
            jito_tip_lamports=int(min(5_000_000, max(1_000, _float("JITO_TIP_LAMPORTS", cls.jito_tip_lamports)))),
            social_enabled=os.environ.get("SOCIAL_ENABLED", "true").lower() not in ("0", "false", "no"),
            x_bearer_token=os.environ.get("X_BEARER_TOKEN") or None,
            require_social_link=os.environ.get("REQUIRE_SOCIAL_LINK", "true").lower() not in ("0", "false", "no"),
            min_x_mentions_6h=int(_float("MIN_X_MENTIONS_6H", cls.min_x_mentions_6h)),
            min_x_unique_authors_ratio=_float("MIN_X_UNIQUE_AUTHORS_RATIO", cls.min_x_unique_authors_ratio),
            max_boosts_active=int(_float("MAX_BOOSTS_ACTIVE", cls.max_boosts_active)),
            max_open_positions=int(_float("MAX_OPEN_POSITIONS", cls.max_open_positions)),
            daily_max_loss_sol=_float("DAILY_MAX_LOSS_SOL", cls.daily_max_loss_sol),
            max_slippage_bps=min(300, int(_float("MAX_SLIPPAGE_BPS", cls.max_slippage_bps))),
            scan_interval_s=_float("SCAN_INTERVAL_S", cls.scan_interval_s),
            scan_batch_max=max(1, int(_float("SCAN_BATCH_MAX", cls.scan_batch_max))),
            monitor_interval_s=_float("MONITOR_INTERVAL_S", cls.monitor_interval_s),
            live_confirm=os.environ.get("LIVE_TRADING_CONFIRM") or None,
            live_max_position_sol=min(HARD_MAX_POSITION_SOL, abs(_float("LIVE_MAX_POSITION_SOL", cls.live_max_position_sol))),
            keypair_path=os.environ.get("SOLANA_KEYPAIR_PATH") or None,
            jito_url=os.environ.get("JITO_URL", cls.jito_url),
            ollama_url=os.environ.get("OLLAMA_URL") or None,
            ollama_model=os.environ.get("OLLAMA_MODEL", cls.ollama_model),
            thresholds=th,
        )

    def redacted(self) -> dict:
        """Vue journalisable : les URLs RPC (qui contiennent souvent une clé API) sont masquées."""
        d = {k: v for k, v in self.__dict__.items() if k != "thresholds"}
        for k in ("helius_rpc_url", "chainstack_rpc_url", "keypair_path", "live_confirm", "x_bearer_token"):
            d[k] = "***" if d[k] else None
        d["thresholds"] = vars(self.thresholds)
        return d
