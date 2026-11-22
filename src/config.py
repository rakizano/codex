"""Configuration centralisée, lue depuis l'environnement. PAPER par défaut, toujours."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from memecoin.filters import Thresholds
from strategy.entry import EntryRules
from strategy.exit import ExitRules

PAPER = "PAPER"
LIVE = "LIVE"


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        return default


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
    max_position_sol: float = 0.2
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

    thresholds: Thresholds = field(default_factory=Thresholds)
    exit_rules: ExitRules = field(default_factory=ExitRules)
    entry_rules: EntryRules = field(default_factory=EntryRules)

    @classmethod
    def from_env(cls) -> "Settings":
        mode = os.environ.get("EXECUTION_MODE", PAPER).strip().upper()
        if mode not in (PAPER, LIVE):
            mode = PAPER
        th = Thresholds(
            min_liquidity_usd=_float("MIN_LIQUIDITY_USD", Thresholds.min_liquidity_usd),
            min_lp_locked_pct=_float("MIN_LP_LOCKED_PCT", Thresholds.min_lp_locked_pct),
            max_top10_pct=_float("MAX_TOP10_PCT", Thresholds.max_top10_pct),
            max_price_impact_pct=_float("MAX_PRICE_IMPACT_PCT", Thresholds.max_price_impact_pct),
            max_roundtrip_loss_pct=_float("MAX_ROUNDTRIP_LOSS_PCT", Thresholds.max_roundtrip_loss_pct),
        )
        ex = ExitRules(
            stop_loss_pct=_float("STOP_LOSS_PCT", ExitRules.stop_loss_pct),
            take_profit_pct=_float("TAKE_PROFIT_PCT", ExitRules.take_profit_pct),
            max_hold_minutes=_float("MAX_HOLD_MINUTES", ExitRules.max_hold_minutes),
            tp1_pct=_opt_float("TP1_PCT", ExitRules.tp1_pct),
            tp1_fraction=min(0.95, max(0.05, _float("TP1_FRACTION", ExitRules.tp1_fraction))),
            trail_activation_pct=_opt_float("TRAIL_ACTIVATION_PCT", ExitRules.trail_activation_pct),
            trailing_stop_pct=_opt_float("TRAILING_STOP_PCT", ExitRules.trailing_stop_pct),
            breakeven_after_tp1=os.environ.get("BREAKEVEN_AFTER_TP1", "true").lower() not in ("0", "false", "no"),
        )
        max_h1 = _opt_float("MAX_PRICE_CHANGE_H1", EntryRules.max_price_change_h1)
        en = EntryRules(
            min_pair_age_min=_float("MIN_PAIR_AGE_MIN", EntryRules.min_pair_age_min),
            max_pair_age_min=_float("MAX_PAIR_AGE_MIN", EntryRules.max_pair_age_min),
            min_price_change_h1=_float("MIN_PRICE_CHANGE_H1", EntryRules.min_price_change_h1),
            max_price_change_h1=float("inf") if max_h1 is None else max_h1,
            min_buy_sell_ratio_h1=_float("MIN_BUY_SELL_RATIO_H1", EntryRules.min_buy_sell_ratio_h1),
            min_txns_h1=int(_float("MIN_TXNS_H1", EntryRules.min_txns_h1)),
            min_volume_liquidity_ratio_h1=_float("MIN_VOLUME_LIQUIDITY_H1", EntryRules.min_volume_liquidity_ratio_h1),
        )
        sizing = os.environ.get("SIZING_MODE", cls.sizing_mode).strip().lower()
        return cls(
            exit_rules=ex,
            entry_rules=en,
            sizing_mode=sizing if sizing in ("fixed", "kelly") else "fixed",
            kelly_multiplier=min(1.0, max(0.05, _float("KELLY_MULTIPLIER", cls.kelly_multiplier))),
            max_position_sol=_float("MAX_POSITION_SOL", cls.max_position_sol),
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
            position_size_sol=_float("POSITION_SIZE_SOL", cls.position_size_sol),
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
            monitor_interval_s=_float("MONITOR_INTERVAL_S", cls.monitor_interval_s),
            live_confirm=os.environ.get("LIVE_TRADING_CONFIRM") or None,
            live_max_position_sol=_float("LIVE_MAX_POSITION_SOL", cls.live_max_position_sol),
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
