"""Signaux sociaux (X, Reddit, liens déclarés sur DexScreener).

Règle de sécurité : seuls des COMPTEURS sont conservés. Le texte des posts n'est
jamais stocké, journalisé ni transmis à un LLM (vecteur d'injection de prompt).
Les signaux sociaux ne peuvent qu'empêcher une entrée, jamais la provoquer.
"""
from .signals import SocialChecker, SocialSignals, evaluate_social

__all__ = ["SocialChecker", "SocialSignals", "evaluate_social"]
