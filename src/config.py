"""Configuration centralisée, lue depuis l'environnement. PAPER par défaut, toujours."""
from __future__ import annotations

import os
from dataclasses import dataclass, field

from memecoin.filters import Thresholds

PAPER = "PAPER"
LIVE = "LIVE"


def _float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
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
    stop_loss_pct: float = -25.0
    take_profit_pct: float = 60.0
    max_hold_minutes: float = 240.0
    daily_max_loss_sol: float = 1.0  # coupe-circuit

    # Garde-fous d'exécution (module tx_builder, inactif en PAPER)
    max_slippage_bps: int = 300
    jito_tip_lamports: int = 100_000  # 0,0001 SOL par transaction (borné 1 000 – 5 000 000)

    # Boucle
    scan_interval_s: float = 60.0
    monitor_interval_s: float = 30.0

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
        return cls(
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
            stop_loss_pct=_float("STOP_LOSS_PCT", cls.stop_loss_pct),
            take_profit_pct=_float("TAKE_PROFIT_PCT", cls.take_profit_pct),
            max_hold_minutes=_float("MAX_HOLD_MINUTES", cls.max_hold_minutes),
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
