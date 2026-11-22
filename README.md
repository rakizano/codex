# Audit & paper-trading meme coins Solana (sans abonnement)

Bot modulaire de **filtrage défensif, simulation et aide à la décision** pour meme coins
Solana, reposant uniquement sur des APIs gratuites. Il fonctionne en **paper trading par
défaut** ; un mode d'exécution réelle existe mais exige une triple activation manuelle,
un wallet dédié et passe par des garde-fous non contournables (voir « Mode LIVE »).
Le plan détaillé des modules est dans [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

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
   └─> signaux sociaux : liens déclarés, boosts payés, Reddit, X (optionnel) ── SOCIAL_REJECT
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
| `src/tx_builder.py` | **Inactif en PAPER.** Garde-fous communs : coupe-circuit, slippage ≤ 300 bps, mints valides, contrôle du résultat de simulation |
| `src/live/executor.py` | **Mode LIVE uniquement.** Devis → instructions Jupiter → pourboire Jito + `jitodontfront…` → signature → `simulateTransaction` → envoi Jito → confirmation |
| `src/social/` | Signaux sociaux : liens X/Telegram/site déclarés, boosts DexScreener, mentions Reddit (gratuit) et X (clé API optionnelle). Compteurs uniquement, jamais le texte des posts |
| `src/analyzer.py` | Analyseur Ollama (Prompt 2) ; JSON invalide ou injection détectée = pas d'entrée |
| `src/bot.py`, `scripts/run_bot.py` | Boucle principale et CLI |
| `scripts/fetch_token_audit.py` | Audit ponctuel sans dépendance (stdlib), utilisé par la Skill |
| `.claude/skills/memecoin-scanner/` | Skill `/memecoin-scanner <mint>`, invocation manuelle uniquement |
| `.claude/settings.json`, `.claude/hooks/guard-trading.sh` | Hook `PreToolUse` déterministe : bloque secrets et toute signature/envoi, fail-closed |
| `prompts/` | Prompt 1 (architecture) et Prompt 2 (analyse CoT anti-injection) |

## Installation et utilisation

```bash
pip install -r requirements.txt            # httpx, solders (LIVE), pytest
# copiez env.example vers votre fichier d'environnement local, puis chargez-le dans le shell

python3 scripts/run_bot.py audit <MINT>    # audit + entrée simulée si tout passe
python3 scripts/run_bot.py scan            # un cycle de découverte sur les derniers profils/boosts
python3 scripts/run_bot.py monitor         # réévalue les positions ouvertes
python3 scripts/run_bot.py run             # boucle continue (scan + suivi + collecte de prix)
python3 scripts/run_bot.py report          # bilan : PnL net, taux de réussite, données collectées
python3 scripts/run_bot.py backtest        # rejoue vos réglages sur les prix collectés
python3 scripts/run_bot.py optimize        # meilleurs réglages, validés hors échantillon
python3 -m pytest -q                       # 119 tests, tous hors-ligne (APIs simulées)
```

Dans Claude Code : `/memecoin-scanner <MINT>`. Avec un autre agent (OpenCode, Cline, Aider…),
le corps du `SKILL.md` sert de procédure ; le hook est spécifique à Claude Code.

## Variables d'environnement

Toutes optionnelles ; gabarit commenté dans [`env.example`](env.example). Placez vos
valeurs dans votre environnement local, jamais dans le dépôt.

| Variable | Défaut | Effet |
|---|---|---|
| `EXECUTION_MODE` | `PAPER` | `LIVE` active l'exécution réelle si les deux variables suivantes sont aussi fournies |
| `LIVE_TRADING_CONFIRM` | — | Doit valoir exactement `I_UNDERSTAND_REAL_FUNDS_AT_RISK` |
| `SOLANA_KEYPAIR_PATH` | — | Keypair JSON (format `solana-keygen`) d'un wallet **dédié** |
| `LIVE_MAX_POSITION_SOL` | `0.05` | Taille maximale réelle par position (prime sur `POSITION_SIZE_SOL`) |
| `JITO_URL` | block engine mainnet | Point d'envoi des transactions |
| `HELIUS_RPC_URL`, `CHAINSTACK_RPC_URL` | — | Active la vérification on-chain des autorités (sinon RugCheck seul) |
| `BOT_DB_PATH` | `data/bot.sqlite3` | Journal SQLite (+ `_cache.sqlite3`) |
| `POSITION_SIZE_SOL` | `0.05` | Taille des positions simulées (identique au réel pour des frais réalistes) |
| `AUDIT_SIZE_SOL` | `0.5` | Taille du devis de test d'impact prix / honeypot |
| `JITO_TIP_LAMPORTS` | `100000` | Pourboire Jito par transaction (0,0001 SOL), borné 1 000 – 5 000 000 |
| Sorties : `STOP_LOSS_PCT`, `TP1_PCT`, `TP1_FRACTION`, `BREAKEVEN_AFTER_TP1`, `TRAIL_ACTIVATION_PCT`, `TRAILING_STOP_PCT`, `TAKE_PROFIT_PCT`, `MAX_HOLD_MINUTES` | −25, 40, 0,5, true, 40, 25, 300, 240 | Voir « Stratégie » ; `off` désactive TP1 ou le stop suiveur |
| Entrées : `MIN_PAIR_AGE_MIN`, `MAX_PAIR_AGE_MIN`, `MIN_PRICE_CHANGE_H1`, `MAX_PRICE_CHANGE_H1`, `MIN_BUY_SELL_RATIO_H1`, `MIN_TXNS_H1`, `MIN_VOLUME_LIQUIDITY_H1` | 30, 10080, −20, 300, 1,0, 30, 0 | Filtres de momentum après la sécurité |
| `SIZING_MODE`, `KELLY_MULTIPLIER`, `MAX_POSITION_SOL`, `PAPER_BANKROLL_SOL`, `MIN_TRADES_FOR_SIZING` | fixed, 0,25, 0,2, 1,0, 30 | Taille de position ; pause automatique si l'avantage mesuré est négatif |
| `REENTRY_COOLDOWN_H` | `24` | Délai avant de racheter un jeton clôturé en perte |
| `MONITOR_INTERVAL_S`, `TRACK_INTERVAL_S`, `TRACK_WINDOW_H` | 15, 60, 24 | Fréquence de suivi des positions et de collecte des prix |
| `DAILY_MAX_LOSS_SOL` | `1.0` | Coupe-circuit sur 24 h glissantes |
| `MAX_OPEN_POSITIONS` | `5` | Positions simultanées |
| `MIN_LIQUIDITY_USD`, `MIN_LP_LOCKED_PCT`, `MAX_TOP10_PCT`, `MAX_PRICE_IMPACT_PCT`, `MAX_ROUNDTRIP_LOSS_PCT` | 15000, 90, 25, 5, 10 | Seuils éliminatoires |
| `SOCIAL_ENABLED`, `REQUIRE_SOCIAL_LINK` | `true`, `true` | Active les signaux sociaux ; exige au moins un lien déclaré |
| `MAX_BOOSTS_ACTIVE` | `500` | Au-delà : hype achetée → rejet |
| `X_BEARER_TOKEN` | — | Active X (API officielle v2 ; la recherche exige en pratique un accès payant) |
| `MIN_X_MENTIONS_6H`, `MIN_X_UNIQUE_AUTHORS_RATIO` | `5`, `0.4` | Mentions minimales ; ratio comptes uniques / posts sous lequel on suspecte du shill |
| `OLLAMA_URL`, `OLLAMA_MODEL` | —, `qwen2.5:7b` | Active l'analyseur LLM local |
| `REQUIRE_LLM` | `false` | Si `true`, pas d'entrée sans avis LLM valide |

## Stratégie : maximiser le gain, mesurer au lieu de deviner

### Sorties (laisser courir les gagnants, couper vite les perdants)
Les rendements des meme coins sont extrêmes : la plupart chutent, quelques-uns font ×3, ×10.
Un take-profit fixe à +60 % coupait justement ces rares gros gagnants. Désormais :

1. **Stop-loss** à −25 % (net de frais).
2. **TP1** : à +40 %, on vend 50 % — le trade est quasi remboursé.
3. **Stop au prix d'entrée** sur le reste : un gagnant ne peut plus redevenir perdant.
4. **Stop suiveur** : on sort si la valeur recule de 25 % depuis son plus haut.
5. **Take-profit final** à +300 %, **sortie temporelle** à 4 h.

Un essai réel a montré un stop à −25 % exécuté à −29 % : sur ces jetons le prix saute.
D'où une **surveillance rapide** : toutes les 5 s, une seule requête DexScreener couvre toutes
les positions ; celles qui approchent d'un seuil (stop, TP1, stop suiveur, TP final, à 5 points
près) sont aussitôt réévaluées par devis Jupiter, les autres toutes les 15 s. En LIVE, la vente partielle
porte sur la fraction correspondante du solde réel lu on-chain.

### Entrées (après la sécurité)
Paire d'au moins 30 min (les premières minutes appartiennent aux snipers et bundlers),
pas de jeton déjà parabolique (> +300 %/h) ni en chute (< −20 %/h), plus d'achats que de
ventes sur 1 h, au moins 30 transactions/h. Pas de rachat d'un perdant pendant 24 h.

### Taille de position et arrêt automatique
`SIZING_MODE=kelly` ajuste la mise selon l'avantage mesuré (¼ de Kelly, plafonné). Quel que
soit le mode, après 30 trades, **un avantage négatif met les entrées en pause**
(`PAPER_ENTRY_BLOCKED:NEGATIVE_EDGE`) : le bot arrête de perdre de l'argent tout seul.

### Collecte, backtest, optimisation (le vrai levier)
Pendant `run`, le bot enregistre toutes les minutes le prix et la liquidité de **chaque jeton
sain** observé — y compris ceux qu'il n'a pas achetés. Ensuite :

```bash
python3 scripts/run_bot.py backtest   # vos réglages actuels rejoués sur ces trajectoires réelles
python3 scripts/run_bot.py optimize   # 6 561 combinaisons testées
```

`optimize` choisit les réglages sur les 70 % de jetons les plus anciens puis les **évalue
sur les 30 % les plus récents, jamais vus** — le seul chiffre honnête. Il affiche les lignes
à copier dans votre configuration (`env`) et un statut :
`RENTABLE_HORS_ECHANTILLON` ou `NON_RENTABLE_HORS_ECHANTILLON — ne passez pas en réel`.
Comptez au moins 2 à 3 jours de collecte (`PAS_ASSEZ_DE_DONNEES` avant) ; relancez
l'optimisation chaque semaine, le marché change.

Limites du backtest : prix DexScreener à la minute (pas un devis exécutable), MEV non
modélisé, coûts estimés (frais + pourboires + 2 × impact prix mesuré). Une liquidité sous
1 000 $ est comptée comme une perte totale.

### Méthode recommandée pour gagner le plus (ou perdre le moins)
1. `run` en PAPER 2 à 3 jours → `optimize`.
2. Statut rentable hors échantillon ? Appliquez les réglages proposés, continuez en PAPER
   1 semaine et vérifiez que `report` confirme (≥ 50 trades, PnL > 0).
3. Seulement alors : LIVE à 0,05 SOL. Après 30 trades réels positifs, `SIZING_MODE=kelly`.
4. Ré-optimisez chaque semaine ; si `report` passe en perte, retour en PAPER.

## Signaux sociaux (X, Reddit, liens)

Appliqués seulement aux jetons qui ont passé les filtres on-chain, ils peuvent **empêcher**
une entrée, jamais la déclencher — la hype sociale est l'outil n°1 des pump-and-dump.

| Signal | Source | Coût | Effet |
|---|---|---|---|
| Aucun lien X/Telegram/Discord/site déclaré | DexScreener | gratuit | `NO_SOCIAL_LINKS` → rejet |
| Boosts payés > `MAX_BOOSTS_ACTIVE` | DexScreener | gratuit | `PAID_HYPE` → rejet |
| Lien X vers un post et non un compte | DexScreener | gratuit | `INFO_X_LINK_IS_POST` (information) |
| Beaucoup de posts Reddit par peu d'auteurs (24 h) | Reddit | gratuit | `REDDIT_SHILL_PATTERN` → rejet |
| Moins de `MIN_X_MENTIONS_6H` mentions (6 h) | X | clé API | `LOW_X_MENTIONS` → rejet |
| Ratio auteurs uniques / posts < 0,4 | X | clé API | `X_SHILL_PATTERN` → rejet |

Le texte des posts n'est jamais conservé ni envoyé au LLM : seuls des compteurs le sont
(un post est le vecteur idéal d'injection de prompt). Une source indisponible (quota, réseau,
pas de clé) n'est pas un motif de rejet. Résultats mis en cache 15 min par jeton.

**Activer X** : créez une app sur developer.x.com, copiez son « Bearer Token » dans
`X_BEARER_TOKEN`. Vérifiez le plan : la recherche de posts n'est en pratique pas incluse
dans l'accès gratuit. Le bot se limite à 4 requêtes/min pour ménager le quota.

## Lire le bilan (`report`)

| Champ | Sens |
|---|---|
| `verdict` | `PAS_ASSEZ_DE_DONNEES` sous 30 trades clôturés, puis `RENTABLE_EN_SIMULATION` / `PERDANT_EN_SIMULATION` |
| `win_rate_pct` | Part de trades gagnants |
| `breakeven_win_rate_theoretical_pct` | Taux de réussite minimal avec vos SL/TP (29,4 % pour −25/+60) |
| `breakeven_win_rate_observed_pct` | Même calcul avec vos gains/pertes moyens réels (stops glissés compris) : **le chiffre à battre** |
| `roundtrip_cost_pct` | Coût d'un achat + revente à prix constant (frais + 2 pourboires) : 2,39 % à 0,05 SOL |
| `exit_reasons` | Répartition TAKE_PROFIT / STOP_LOSS / TIME_STOP / NO_EXIT_ROUTE |

Règle simple : passez en réel seulement si `win_rate_pct` dépasse nettement
`breakeven_win_rate_observed_pct` sur au moins 50 trades.

## Filtres éliminatoires

Autorité mint/freeze active (RugCheck **ou** on-chain) · liquidité insuffisante · LP verrouillée
insuffisante · concentration du top 10 hors réserves AMM · aucune route de revente Jupiter
(honeypot) · impact prix excessif · perte aller-retour > seuil (taxe cachée) · risque « danger »
RugCheck · divergence de prix DexScreener/GeckoTerminal > 20 % · injection détectée dans les
métadonnées · toute donnée manquante.

## Essai réel (22/11/2026)

`scan` sur les 40 derniers profils/boosts Solana de DexScreener : 34 `REJECT`
(liquidité faible ou inconnue — jetons encore sur la courbe pump.fun —, risque « danger »
RugCheck, concentration, honeypot/taxe cachée jusqu'à 92 % de perte aller-retour),
6 passent les filtres, 5 positions simulées ouvertes (plafond `MAX_OPEN_POSITIONS`).
BONK est rejeté (LP verrouillée à 22 % pondérée par la liquidité, top 10 à 36 %) :
les seuils visent les jeunes meme coins, pas les jetons établis.

Essai de 25 min de la stratégie v0.3 (`run`) : 47 jetons audités, 40 rejets de sécurité,
5 rejets de momentum (paires de 22 à 89 jours, pression vendeuse), 2 entrées simulées ;
1 stop-loss à −29 % (stop à −25 % glissé de 4 points malgré un suivi à 15 s), 1 position
ouverte à −6 %. 7 jetons sains suivis (146 instantanés) : `backtest` et `optimize`
fonctionnent mais répondent `PAS_ASSEZ_DE_DONNEES` — il faut plusieurs jours de collecte.

## Phase de test sans serveur (gratuit)

Pas besoin de louer un VPS pour la phase de test : le bot reste en PAPER (aucun wallet, aucune clé).

**Option 1 — votre ordinateur (recommandé, 0 €, continu)**
- Windows : double-cliquez `scripts\start_paper.bat` (installe tout au premier lancement, redémarre seul).
  Désactivez la mise en veille pendant le test.
- macOS / Linux : `bash scripts/start_paper.sh` (empêche la veille, redémarre seul ; Ctrl+C pour arrêter).
- Bilan à tout moment : `python3 scripts/run_bot.py report` puis `optimize` après 2–3 jours.

**Option 2 — GitHub Actions (0 €, rien à garder allumé)**
Le workflow `.github/workflows/paper-test.yml` lance le bot toutes les 6 h sur les machines de GitHub,
conserve la base de données entre les exécutions et affiche le bilan + l'optimiseur dans
*Actions → paper-test → (exécution) → Summary*. Premier lancement : *Actions → paper-test → Run workflow*.
- Dépôt **privé** : 2 000 min/mois offertes → 4 × 15 min par jour (échantillonnage, données plus lentes à venir).
- Dépôt **public** : minutes illimitées → 4 × 5 h 50 par jour, quasi continu. Le code ne contient aucun secret,
  mais il devient visible de tous.
- Durée forçable via la variable de dépôt `PAPER_RUN_MINUTES` (Settings → Secrets and variables → Actions → Variables).

Le VPS ne devient utile qu'en mode LIVE, quand le bot doit tourner 24 h/24 avec votre wallet.

## Mode LIVE (fonds réels)

À n'activer qu'après plusieurs jours de paper trading dont le bilan (`report`) vous convient.

1. Créez un wallet **dédié** (`solana-keygen new -o ~/wallets/memebot.json`) et
   approvisionnez-le avec une somme que vous acceptez de perdre entièrement.
2. Configurez un RPC (`HELIUS_RPC_URL`) : il est obligatoire en LIVE.
3. Exportez `EXECUTION_MODE=LIVE`, `LIVE_TRADING_CONFIRM=I_UNDERSTAND_REAL_FUNDS_AT_RISK`
   et `SOLANA_KEYPAIR_PATH`, puis lancez `python3 scripts/run_bot.py audit <MINT>` sur un
   jeton liquide pour un premier achat de `LIVE_MAX_POSITION_SOL`.

Garde-fous appliqués à **chaque** transaction : coupe-circuit journalier, slippage ≤ 300 bps,
taille ≤ `LIVE_MAX_POSITION_SOL`, devis de revente obligatoire, `simulateTransaction` sans
erreur avant envoi, pourboire Jito et compte `jitodontfront…` (atténuation du sandwich),
confirmation on-chain suivie. Une vente échouée laisse la position ouverte et est retentée.
La clé privée n'est ni journalisée ni transmise à un LLM ; dans Claude Code, le hook empêche
l'agent de lire le keypair et de fournir lui-même la phrase de confirmation.

## Limites connues

- Les devis Jupiter servent de prix de sortie : c'est réaliste pour la liquidité, mais
  n'inclut ni MEV ni latence d'exécution réelle. Les résultats simulés sont optimistes.
- Les noms de champs RugCheck/DexScreener peuvent évoluer ; un champ disparu provoque
  un rejet (fail-closed), pas une entrée.
- Le mode LIVE est testé de bout en bout contre des APIs simulées (transaction réellement
  signée et vérifiée), mais n'a jamais été exécuté sur mainnet par l'auteur du code :
  commencez avec la taille minimale et surveillez les premières transactions.
- La position comptable en LIVE est estimée à partir du devis Jupiter, pas du montant
  exact reçu ; la vente utilise en revanche le solde réel lu on-chain.
