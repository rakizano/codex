# Plan des modules (réponse au Prompt 1)

Le Prompt 1 demande de « proposer d'abord le plan détaillé des modules ». Ce document est
ce plan, tel qu'il a été implémenté. Chaque module est couvert par des tests hors-ligne.

**Statut : plan validé tel quel par l'utilisateur le 22/11/2026.** Décisions associées :
le premier trade LIVE est exécuté par l'utilisateur lui-même sur sa machine (wallet dédié,
0,05 SOL) ; le gabarit de configuration reste `env.example`.

## 0. Validation sur données réelles (22/11/2026)

- Skill : `scripts/fetch_token_audit.py` exécuté contre DexScreener, RugCheck, GeckoTerminal
  et Jupiter (BONK : `REJECT`, LP verrouillée 22 %, top 10 à 36 %).
- Bot PAPER : `scan` réel sur 40 jetons (34 rejets, 5 positions simulées), `monitor` et
  `report` fonctionnels ; deux défauts découverts et corrigés (format RugCheck, faux
  positifs d'injection sur les URIs IPFS/Arweave).
- Hook : actif pendant tout le développement, il a bloqué en conditions réelles plusieurs
  commandes de l'agent qui mentionnaient des fichiers d'environnement ou des endpoints
  d'envoi de transaction — le comportement attendu.
- LIVE : testé de bout en bout contre des APIs simulées avec une transaction réellement
  signée ; l'essai mainnet revient à l'utilisateur.

## 1. Principes

1. **Une seule autorité de rejet, déterministe** : `memecoin/filters.evaluate`. Un LLM ne
   peut qu'abaisser un verdict ; une donnée manquante ou un format inattendu donne `REJECT`.
2. **Les métadonnées externes ne sont jamais des instructions** : nom, symbole, URI et liens
   sont assainis, analysés comme indices d'injection, puis confinés dans
   `<UNTRUSTED_TOKEN_METADATA>`.
3. **Lecture seule par défaut** : le client RPC a une liste blanche de méthodes de lecture ;
   Jupiter n'est appelé qu'en `/quote` hors mode LIVE.
4. **Le réel exige une décision humaine explicite** : trois variables, un wallet dédié,
   et le hook Claude Code empêche l'agent de fournir lui-même la confirmation.

## 2. Modules

| Module | Responsabilité | Entrées → sorties | Tests |
|---|---|---|---|
| `config.py` | Réglages typés depuis l'environnement ; plafonne le slippage à 300 bps ; masque URLs RPC, chemin de clé et phrase de confirmation | env → `Settings` | `test_settings_*`, `test_keypair_loading_and_redaction` |
| `cache.py` | Cache SQLite à TTL | clé → JSON | `test_gecko_cache_avoids_second_call` |
| `fetchers/base.py` | `TokenBucket` asynchrone + `ApiClient` (backoff exponentiel, `Retry-After`, 4xx → `None`) | requête → JSON \| `None` | `test_token_bucket_*`, `test_api_client_*` |
| `fetchers/dexscreener.py` | Profils/boosts (60/min), paires (300/min) | mint → paires | e2e |
| `fetchers/geckoterminal.py` | Validation croisée prix/réserves (10/min, cache 60 s) | mint → attributs | cache |
| `fetchers/rugcheck.py` | Rapport complet (30/min par prudence) | mint → rapport | détecteur |
| `fetchers/jupiter.py` | Devis, aller-retour, valeur de sortie ; instructions de swap (LIVE) | mint, montant → devis | `test_jupiter_roundtrip_honeypot` |
| `fetchers/rpc.py` | JSON-RPC lecture seule, Helius (10 RPS) → Chainstack (25 RPS) | méthode → résultat | `test_rpc_whitelist_and_fallback` |
| `memecoin/sources.py` | Normalisation des réponses réelles (validée contre les APIs le 22/11/2026) | réponses brutes → `Metrics`, observations, métadonnées non fiables | `test_normalize_*`, `test_transfer_fee_*` |
| `memecoin/filters.py` | Seuils éliminatoires, détection d'injection, confinement | `Metrics` → verdict + drapeaux | `test_filters.py` |
| `filters/rug_detector.py` | Orchestration asynchrone, recoupement on-chain pessimiste, divergence de prix | mint → `AuditResult` | `test_rug_detector`, `test_onchain_*` |
| `analyzer.py` | Ollama + Prompt 2, JSON strict, combinaison « abaisser seulement » | audit → verdict final | `test_llm_*`, `test_ollama_*` |
| `paper_trader.py` | Positions SQLite, frais, SL/TP/temps, coupe-circuit 24 h, bilan | devis → positions, PnL | `test_paper_trade_*`, `test_circuit_breaker_*` |
| `tx_builder.py` | Garde-fous communs : mode, coupe-circuit, slippage, mints, `jitodontfront`, contrôle de simulation | paramètres → `ExecutionPlan` | `test_tx_builder_*` |
| `live/executor.py` | Swap réel : devis → instructions Jupiter → pourboire Jito + `jitodontfront` → tables d'adresses → signature → `simulateTransaction` → envoi Jito → confirmation | mint, taille → `SwapResult` | `test_live.py` |
| `bot.py` | Boucle découverte → audit → (LLM) → entrée simulée ou réelle → suivi/sortie ; CLI | — | `test_bot_*_end_to_end` |

## 3. Flux d'un jeton

```
DexScreener profils/boosts ──> déjà vu < 6 h ? ──oui──> ignoré
          │ non
          ▼
RugDetector : DexScreener ∥ RugCheck ∥ GeckoTerminal ∥ Jupiter aller-retour (+ RPC on-chain)
          ▼
normalize() ──exception──> REJECT(PARSE_ERROR)
          ▼
evaluate() ──drapeau──> REJECT (journalisé)
          ▼ WATCHLIST_PAPER
[Ollama + Prompt 2] ──HIGH_RISK_WATCH / REJECT / injection──> pas d'entrée
          ▼ PAPER_ENTRY
coupe-circuit / doublon / plafond de positions ──> PAPER_ENTRY_BLOCKED
          ▼
PAPER : position simulée            LIVE : LiveExecutor.buy() puis position miroir
          ▼
monitor : devis de sortie Jupiter → SL / TP / durée / route disparue → clôture (+ vente réelle en LIVE)
```

## 4. Mode LIVE : séquence d'un swap

1. `check_live_enabled` : `EXECUTION_MODE=LIVE`, `LIVE_TRADING_CONFIRM=I_UNDERSTAND_REAL_FUNDS_AT_RISK`,
   `SOLANA_KEYPAIR_PATH` ; RPC obligatoire.
2. `TransactionBuilder.plan_swap` : coupe-circuit, slippage ≤ 300 bps, mints valides.
3. Taille plafonnée à `LIVE_MAX_POSITION_SOL` (0,05 SOL par défaut).
4. Devis Jupiter puis instructions de swap pour le wallet.
5. Ajout d'un transfert de pourboire vers un compte Jito tiré au hasard, portant le compte
   `jitodontfront…` en lecture seule non signataire.
6. Chargement des tables d'adresses, blockhash récent, compilation `MessageV0`, signature.
7. `simulateTransaction` : toute erreur arrête tout, rien n'est envoyé.
8. Envoi au block engine Jito, puis suivi `getSignatureStatuses` (échec on-chain = exception).
9. Vente : solde réel lu on-chain (`getTokenAccountsByOwner`), même séquence en sens inverse.
   Une vente en échec laisse la position ouverte et sera retentée au cycle suivant.

## 5. Ce que le code ne peut pas garantir

- La rentabilité : aucune n'est démontrée ; la latence des APIs gratuites (~150 ms après
  le slot) exclut le sniping.
- L'immunité MEV : `jitodontfront` atténue le sandwich sans l'empêcher totalement.
- La stabilité des formats d'API tiers : un changement provoque des rejets, pas des achats.
