# Audit & paper-trading meme coins Solana (sans abonnement)

Bot modulaire de **filtrage défensif, simulation et aide à la décision** pour meme coins
Solana, reposant uniquement sur des APIs gratuites. Aucun code de signature ni d'envoi de
transaction n'existe dans ce dépôt : le bot refuse de démarrer hors `EXECUTION_MODE=PAPER`.

> Avertissement : la grande majorité des meme coins finissent en rug pull ou pump-and-dump,
> et une latence REST/WebSocket gratuite ne permet pas de rivaliser avec les bots
> professionnels. Rien ici n'est un conseil financier ; aucune rentabilité n'est démontrée.

## Architecture

```
découverte DexScreener (profils + boosts Solana)
   └─> RugDetector (asyncio.gather)
         ├─ DexScreener   liquidité, volume, achats/ventes        300 req/min
         ├─ RugCheck      autorités, LP, détenteurs, risques       30 req/min (prudence)
         ├─ GeckoTerminal validation croisée du prix, cache 60 s   10 req/min
         ├─ Jupiter       devis aller-retour SOL->jeton->SOL       /quote uniquement
         └─ RPC Solana    autorités mint/freeze on-chain           Helius 10 RPS -> Chainstack 25 RPS
   └─> filtres déterministes fail-closed (memecoin/filters.py) ── REJECT
   └─> [optionnel] LLM local Ollama + Prompt 2 : ne peut qu'abaisser le verdict
   └─> PaperTrader SQLite : entrée simulée, suivi via devis de sortie, SL/TP/temps, coupe-circuit
```

| Chemin | Rôle |
|---|---|
| `src/config.py` | Réglages depuis l'environnement ; PAPER par défaut, slippage plafonné à 300 bps, URLs RPC masquées dans les logs |
| `src/fetchers/` | Clients `httpx` asynchrones : token bucket + backoff exponentiel (429/5xx, `Retry-After`) |
| `src/fetchers/rpc.py` | JSON-RPC en liste blanche de méthodes de lecture ; bascule automatique Helius → Chainstack |
| `src/filters/rug_detector.py` | Audit multi-sources ; lecture on-chain la plus pessimiste des autorités ; divergence de prix > 20 % signalée |
| `src/memecoin/filters.py` | Unique autorité de rejet (donnée inconnue = REJECT) + détection/confinement d'injection |
| `src/paper_trader.py` | Positions SQLite, ~1 % de frais par côté en plus des devis Jupiter, SL/TP/time-stop, coupe-circuit 24 h |
| `src/tx_builder.py` | **Inactif en PAPER.** Plan d'exécution : slippage ≤ 300 bps, compte `jitodontfront…` read-only, pourboire Jito, `simulateTransaction` obligatoire, coupe-circuit. Pas de signature |
| `src/analyzer.py` | Analyseur Ollama (Prompt 2) ; JSON invalide ou injection détectée = pas d'entrée |
| `src/bot.py`, `scripts/run_bot.py` | Boucle principale et CLI |
| `scripts/fetch_token_audit.py` | Audit ponctuel sans dépendance (stdlib), utilisé par la Skill |
| `.claude/skills/memecoin-scanner/` | Skill `/memecoin-scanner <mint>`, invocation manuelle uniquement |
| `.claude/settings.json`, `.claude/hooks/guard-trading.sh` | Hook `PreToolUse` déterministe : bloque secrets et toute signature/envoi, fail-closed |
| `prompts/` | Prompt 1 (architecture) et Prompt 2 (analyse CoT anti-injection) |

## Installation et utilisation

```bash
pip install -r requirements.txt            # httpx + pytest

python3 scripts/run_bot.py audit <MINT>    # audit + entrée simulée si tout passe
python3 scripts/run_bot.py scan            # un cycle de découverte sur les derniers profils/boosts
python3 scripts/run_bot.py monitor         # réévalue les positions ouvertes
python3 scripts/run_bot.py run             # boucle continue (scan + monitor)
python3 scripts/run_bot.py report          # bilan : PnL net, taux de réussite, verdicts
python3 -m pytest -q                       # 53 tests, tous hors-ligne (APIs simulées)
```

Dans Claude Code : `/memecoin-scanner <MINT>`. Avec un autre agent (OpenCode, Cline, Aider…),
le corps du `SKILL.md` sert de procédure ; le hook est spécifique à Claude Code.

## Variables d'environnement

Toutes optionnelles. Placez-les dans votre environnement local (jamais dans le dépôt).

| Variable | Défaut | Effet |
|---|---|---|
| `EXECUTION_MODE` | `PAPER` | Toute autre valeur que `PAPER` fait refuser le démarrage |
| `HELIUS_RPC_URL`, `CHAINSTACK_RPC_URL` | — | Active la vérification on-chain des autorités (sinon RugCheck seul) |
| `BOT_DB_PATH` | `data/bot.sqlite3` | Journal SQLite (+ `_cache.sqlite3`) |
| `POSITION_SIZE_SOL` | `0.5` | Taille simulée et taille du devis d'impact |
| `STOP_LOSS_PCT` / `TAKE_PROFIT_PCT` | `-25` / `60` | Sorties simulées (PnL net de frais) |
| `MAX_HOLD_MINUTES` | `240` | Sortie temporelle |
| `DAILY_MAX_LOSS_SOL` | `1.0` | Coupe-circuit sur 24 h glissantes |
| `MAX_OPEN_POSITIONS` | `5` | Positions simultanées |
| `MIN_LIQUIDITY_USD`, `MIN_LP_LOCKED_PCT`, `MAX_TOP10_PCT`, `MAX_PRICE_IMPACT_PCT`, `MAX_ROUNDTRIP_LOSS_PCT` | 15000, 90, 25, 5, 10 | Seuils éliminatoires |
| `OLLAMA_URL`, `OLLAMA_MODEL` | —, `qwen2.5:7b` | Active l'analyseur LLM local |
| `REQUIRE_LLM` | `false` | Si `true`, pas d'entrée sans avis LLM valide |

## Filtres éliminatoires

Autorité mint/freeze active (RugCheck **ou** on-chain) · liquidité insuffisante · LP verrouillée
insuffisante · concentration du top 10 hors réserves AMM · aucune route de revente Jupiter
(honeypot) · impact prix excessif · perte aller-retour > seuil (taxe cachée) · risque « danger »
RugCheck · divergence de prix DexScreener/GeckoTerminal > 20 % · injection détectée dans les
métadonnées · toute donnée manquante.

## Limites connues

- Les devis Jupiter servent de prix de sortie : c'est réaliste pour la liquidité, mais
  n'inclut ni MEV ni latence d'exécution réelle. Les résultats simulés sont optimistes.
- Les noms de champs RugCheck/DexScreener peuvent évoluer ; un champ disparu provoque
  un rejet (fail-closed), pas une entrée.
- Le passage en réel exigerait d'écrire la signature, un wallet dédié à faible solde,
  des tests devnet et une revue humaine — volontairement hors du périmètre de ce dépôt.
