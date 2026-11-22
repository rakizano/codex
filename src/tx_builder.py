"""Préparation d'exécution — INACTIF en mode PAPER.

Ce module ne fait que construire et valider un *plan* d'exécution (paramètres
anti-MEV et garde-fous). La signature et l'envoi ne sont volontairement PAS
implémentés dans ce dépôt : brancher un wallet réel exige une revue humaine,
un wallet dédié à faible solde et des tests sur devnet.
"""
from __future__ import annotations

from dataclasses import dataclass

from config import LIVE, Settings

B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
# Compte factice non signataire, lecture seule : le block engine Jito rejette les bundles
# où la transaction qui le référence n'est pas en tête (atténuation du sandwich).
JITO_DONT_FRONT = "jitodontfront111111111111111111111111111111"
HARD_MAX_SLIPPAGE_BPS = 300


class ExecutionDisabled(RuntimeError):
    pass


class GuardrailViolation(RuntimeError):
    pass


def b58decode(s: str) -> bytes:
    n = 0
    for c in s:
        n = n * 58 + B58.index(c)
    body = n.to_bytes((n.bit_length() + 7) // 8, "big") if n else b""
    return b"\0" * (len(s) - len(s.lstrip("1"))) + body


def is_pubkey(s: str) -> bool:
    try:
        return len(b58decode(s)) == 32
    except ValueError:
        return False


@dataclass(frozen=True)
class ExecutionPlan:
    input_mint: str
    output_mint: str
    amount: int
    slippage_bps: int
    jito_tip_lamports: int
    extra_readonly_accounts: tuple[str, ...]
    require_simulation: bool = True


class TransactionBuilder:
    def __init__(self, settings: Settings, circuit_breaker=lambda: False):
        self.settings = settings
        self.circuit_breaker = circuit_breaker

    def plan_swap(self, input_mint: str, output_mint: str, amount: int,
                  slippage_bps: int | None = None) -> ExecutionPlan:
        if self.settings.execution_mode != LIVE:
            raise ExecutionDisabled("EXECUTION_MODE=PAPER : aucune transaction n'est préparée")
        if self.circuit_breaker():
            raise GuardrailViolation("coupe-circuit de perte journalière déclenché")
        bps = self.settings.max_slippage_bps if slippage_bps is None else slippage_bps
        if not 0 < bps <= HARD_MAX_SLIPPAGE_BPS:
            raise GuardrailViolation(f"slippage {bps} bps hors bornes (max {HARD_MAX_SLIPPAGE_BPS})")
        if amount <= 0:
            raise GuardrailViolation("montant invalide")
        if not (is_pubkey(input_mint) and is_pubkey(output_mint)):
            raise GuardrailViolation("mint invalide")
        return ExecutionPlan(input_mint, output_mint, amount, bps,
                             self.settings.jito_tip_lamports, (JITO_DONT_FRONT,))

    @staticmethod
    def check_simulation(sim_result: dict | None) -> None:
        """À appeler avec le résultat de `simulateTransaction` : toute erreur bloque."""
        value = (sim_result or {}).get("value")
        if not value or value.get("err") is not None:
            raise GuardrailViolation(f"simulation échouée : {value.get('err') if value else 'aucun résultat'}")
