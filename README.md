# Audit & paper-trading meme coins Solana (sans abonnement)

Mise en œuvre du guide « Bot de trading meme coin avec Claude Code » : **filtrage défensif,
simulation et aide à la décision uniquement**. Aucun code de signature ni d'envoi de
transaction n'existe dans ce dépôt.

> Avertissement : la grande majorité des meme coins finissent en rug pull ou pump-and-dump.
> Rien ici n'est un conseil financier ; aucune rentabilité n'est démontrée.

## Contenu

| Chemin | Rôle |
|---|---|
| `.claude/skills/memecoin-scanner/SKILL.md` | Skill `/memecoin-scanner <mint> [--mode=paper\|quote]`, invocation manuelle uniquement |
| `.claude/settings.json` | Règles `deny` + hook `PreToolUse` sur Bash/Read/Edit/Write/Grep/Glob/WebFetch |
| `.claude/hooks/guard-trading.sh` | Hook déterministe (exit 2) : bloque secrets (.env, keypairs, mnémoniques) et toute signature/envoi ; fail-closed si l'entrée est illisible |
| `src/memecoin/filters.py` | Filtres éliminatoires (fail-closed : donnée inconnue = REJECT) + détection/confinement d'injection |
| `src/memecoin/sources.py` | Clients lecture seule : DexScreener, RugCheck, GeckoTerminal, Jupiter `/quote` |
| `src/memecoin/paper.py` | Journal `data/paper_trades.jsonl`, PnL net avec ~1 % de frais par côté |
| `scripts/fetch_token_audit.py` | Point d'entrée appelé par la Skill |
| `prompts/` | Prompt 1 (architecture du bot complet) et Prompt 2 (analyse CoT anti-injection) |

## Utilisation

```bash
python3 scripts/fetch_token_audit.py <MINT> --mode=quote      # audit seul
python3 scripts/fetch_token_audit.py <MINT> --mode=paper      # audit + journal de simulation
python3 -m pytest -q                                          # 29 tests (honeypot, injection, hook)
```

Dans Claude Code : `/memecoin-scanner <MINT>`. Avec un autre agent (OpenCode, Cline, Aider…),
le corps du `SKILL.md` sert de procédure ; le hook est spécifique à Claude Code, donc
lancez le script vous-même sans exposer de secrets à l'agent.

Prérequis : Python ≥ 3.10, `jq` (pour le hook), `pytest` (tests). Aucune dépendance Python externe.

## Filtres par défaut

Autorité mint/freeze active · liquidité < 15 000 $ · LP verrouillée < 90 % ·
top 10 hors AMM > 25 % · pas de devis de revente Jupiter · impact prix > 5 % pour 0,5 SOL ·
perte aller-retour > 10 % · drapeau « danger » RugCheck · injection détectée dans les métadonnées.
Seuils ajustables via `--min-liquidity` et `--max-top10`.
