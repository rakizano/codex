"""Filtres éliminatoires déterministes (fail-closed) et confinement des métadonnées.

Aucune décision de sécurité ne dépend d'un LLM : ce module tranche seul entre
REJECT et WATCHLIST_PAPER à partir de métriques numériques normalisées.
"""
from __future__ import annotations

import base64
import re
import unicodedata
from dataclasses import dataclass, field

BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


def is_valid_mint(mint: str) -> bool:
    return bool(BASE58_RE.fullmatch(mint or ""))


@dataclass(frozen=True)
class Thresholds:
    min_liquidity_usd: float = 15_000.0
    min_lp_locked_pct: float = 90.0
    max_top10_pct: float = 25.0
    max_price_impact_pct: float = 5.0
    max_roundtrip_loss_pct: float = 10.0  # perte aller-retour SOL->jeton->SOL tolérée


@dataclass
class Metrics:
    """Métriques normalisées. None = inconnu => rejet (fail-closed)."""
    mint_authority_revoked: bool | None = None
    freeze_authority_revoked: bool | None = None
    liquidity_usd: float | None = None
    lp_locked_pct: float | None = None
    top10_holders_pct: float | None = None
    buy_price_impact_pct: float | None = None
    sell_quote_ok: bool | None = None
    roundtrip_loss_pct: float | None = None
    extra_flags: list[str] = field(default_factory=list)


def evaluate(m: Metrics, t: Thresholds = Thresholds()) -> tuple[str, list[str]]:
    flags: list[str] = []

    def unknown(name: str) -> None:
        flags.append(f"UNKNOWN_{name}")

    if m.mint_authority_revoked is None:
        unknown("MINT_AUTHORITY")
    elif not m.mint_authority_revoked:
        flags.append("MINT_AUTHORITY_ACTIVE")

    if m.freeze_authority_revoked is None:
        unknown("FREEZE_AUTHORITY")
    elif not m.freeze_authority_revoked:
        flags.append("FREEZE_AUTHORITY_ACTIVE")

    if m.liquidity_usd is None:
        unknown("LIQUIDITY")
    elif m.liquidity_usd < t.min_liquidity_usd:
        flags.append(f"LOW_LIQUIDITY<{t.min_liquidity_usd:.0f}USD")

    if m.lp_locked_pct is None:
        unknown("LP_LOCK")
    elif m.lp_locked_pct < t.min_lp_locked_pct:
        flags.append(f"LP_NOT_LOCKED({m.lp_locked_pct:.1f}%)")

    if m.top10_holders_pct is None:
        unknown("TOP10_HOLDERS")
    elif m.top10_holders_pct > t.max_top10_pct:
        flags.append(f"TOP10_CONCENTRATION({m.top10_holders_pct:.1f}%)")

    if m.sell_quote_ok is not True:
        flags.append("NO_SELL_ROUTE_HONEYPOT")

    if m.buy_price_impact_pct is None:
        unknown("PRICE_IMPACT")
    elif m.buy_price_impact_pct > t.max_price_impact_pct:
        flags.append(f"HIGH_PRICE_IMPACT({m.buy_price_impact_pct:.2f}%)")

    if m.roundtrip_loss_pct is not None and m.roundtrip_loss_pct > t.max_roundtrip_loss_pct:
        flags.append(f"ROUNDTRIP_LOSS({m.roundtrip_loss_pct:.2f}%)_HIDDEN_TAX?")

    flags.extend(m.extra_flags)
    return ("REJECT" if flags else "WATCHLIST_PAPER"), flags


# --- Confinement des métadonnées non fiables ---------------------------------

_INJECTION_PATTERNS = [
    r"ignore (all |any |the )?(previous|prior|above) (instructions|prompts?)",
    r"\b(system|developer) prompt\b",
    r"\byou are now\b",
    r"\b(send|transfer|withdraw|approve)\b.{0,40}\b(sol|usdc|funds|tokens?|wallet)\b",
    r"\b(buy|ape)\b.{0,20}\b(now|immediately|all)\b",
    r"ignore (toutes? )?(les )?(instructions|consignes)",
    r"\b(envoie|transf[eè]re|ach[eè]te)\b",
    r"\bverdict\b|\bpaper_entry\b|\bwatchlist_paper\b",
    r"[1-9A-HJ-NP-Za-km-z]{32,44}",  # adresse de portefeuille glissée dans un texte
]
_INVISIBLE_CATEGORIES = {"Cf", "Co", "Cn"}
_MORSE_RE = re.compile(r"^[\s.\-/]{12,}$")
_B64_RE = re.compile(r"[A-Za-z0-9+/]{24,}={0,2}")


def detect_injection(text: str) -> list[str]:
    """Heuristiques ; un faux positif ne coûte qu'un drapeau, jamais un achat."""
    hits: list[str] = []
    if any(unicodedata.category(c) in _INVISIBLE_CATEGORIES for c in text):
        hits.append("INVISIBLE_UNICODE")
    norm = unicodedata.normalize("NFKC", text).lower()
    for p in _INJECTION_PATTERNS:
        if re.search(p, norm, flags=re.IGNORECASE):
            hits.append("INSTRUCTION_LIKE_TEXT")
            break
    if _MORSE_RE.match(text.strip() or "x"):
        hits.append("MORSE_LIKE")
    for blob in _B64_RE.findall(text):
        try:
            decoded = base64.b64decode(blob + "=" * (-len(blob) % 4), validate=True)
            if decoded.isascii() and decoded.decode().isprintable():
                hits.append("BASE64_PAYLOAD")
                break
        except Exception:
            pass
    return hits


def sanitize_untrusted(text: object, max_len: int = 200) -> str:
    """Retire les caractères de contrôle/invisibles et tronque. Ne rend PAS le texte sûr :
    il doit rester dans un bloc UNTRUSTED_TOKEN_METADATA."""
    s = "" if text is None else str(text)
    s = "".join(c for c in s if unicodedata.category(c)[0] != "C" or c == " ")
    s = s.replace("<", "‹").replace(">", "›")  # empêche de refermer la balise de confinement
    return s[:max_len]


def wrap_untrusted(fields: dict[str, object]) -> str:
    body = "\n".join(f"{k}: {sanitize_untrusted(v)}" for k, v in fields.items())
    return f"<UNTRUSTED_TOKEN_METADATA>\n{body}\n</UNTRUSTED_TOKEN_METADATA>"
