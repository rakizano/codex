# Refonte quantitative et technique — rapport final

> 23/11/2026. Branche `claude/meme-coin-trading-bot-yns7r5` (PR #2 `strategy/copytop-distribution-exit`
> intégrée par fusion, puis corrigée). Mode **PAPER uniquement**, exposition plafonnée à 0,05 SOL.
> **230 tests, 230 réussis, 0 échec**, sans aucun appel réseau réel.

---

## A. État du bot avant la refonte

**Architecture initiale :**
- Boucle asynchrone séquentielle : découverte → audit de sécurité (fail-closed) → règles momentum H1
  → social → LLM optionnel → position PAPER.
- Moteurs `scan`, `smart` (wallets classés via les trades GeckoTerminal) et `copytop`.
- Base SQLite (positions, observations, snapshots).
- Backtest sur snapshots d'une minute, optimiseur 70/30.

**Problèmes réellement constatés dans le code :**

| # | Problème | État trouvé |
|---|---|---|
| 1 | Fuite hors échantillon dans l'optimiseur | déjà corrigée par la PR #2 (sélection sur le train, purge) |
| 2 | Trop de combinaisons | **présent** : 243 × 27 = 6 561 combinaisons pour quelques dizaines de trades |
| 3 | Pas de Walk-Forward | **présent** : un seul découpage 70/30 |
| 4 | Frais des ventes partielles | bot correct ; **backtest : pourboire de la vente partielle oublié**, frais appliqués en bloc |
| 5 | Positions ouvertes en fin de backtest | **présent** : `OPEN_AT_END` compté comme un trade clôturé |
| 6 | Sorties copy.top | PR #2 : **curseur global** (événements perdus si la cohorte change) et flux limité aux 30 derniers trades |
| 7 | Migrations Pump.fun | **absent** : 38 signaux copy.top sur 47 (6 h réelles) perdus pour `UNKNOWN_LIQUIDITY` |
| 8 | Vélocité | **absente** : filtres H1 seulement |
| 9 | ATR | **absent** |
| 10 | Statistiques mélangées | **présent** : taille Kelly et coupe-circuit calculés sur tous les moteurs confondus |
| — | Seuils de sécurité assouplissables par l'environnement | **présent** (ex. `MIN_LIQUIDITY_USD=100` accepté), y compris dans le script de skill |
| — | Activation LIVE insensible à la casse (`live`) | **présent** (la phrase de confirmation restait exigée) |
| — | Exposition | Kelly pouvait monter à 0,2 SOL en PAPER |
| — | Boucle principale | un scan de ~60 jetons bloquait les signaux copy.top pendant plusieurs minutes (constaté en réel) |

**Faiblesses de la stratégie initiale :**
- Stop fixe à −25 % déclenché par la volatilité normale (plusieurs sorties en quelques minutes).
- TP1 vendant 50 % trop tôt et durée maximale de 240 min.
- Entrées fondées sur un jeton « populaire » sans confirmation de vélocité.
- Résultat réel : environ −14 % sur 11 trades PAPER (`docs/COMPTE_RENDU.md`).

## B. Modifications par fichier

| Fichier | Avant | Après | Raison |
|---|---|---|---|
| `src/strategy/entry.py` | Filtres H1 (âge 30 min, ratio d'achats H1) | Vélocité M5 (≥ 20 tx, ≥ 2 500 $, achats/ventes 1,15–6,5), accélération du volume ≥ 1,3, ratio liquidité/capitalisation 8–70 %, H1 entre −15 et +250 %, détection de la courbe Pump.fun, politique d'âge centralisée STRICT / PAPER_FAST, motifs explicites | Entrer sur une dynamique confirmée, pas sur la popularité |
| `src/strategy/exit.py` | SL −25, TP1 50 % à +40, suiveur 25, 240 min | Stop ATR `-min(38, max(18, 2,2×ATR))`, suiveur ATR 20–35 % verrouillé, TP1 30 %, plancher +3 % net, stagnation, 120 min, sorties copy.top, priorités explicites. `decide_legacy` est conservé pour le LIVE | Laisser courir les gagnants, couper la stagnation, ne jamais ordonner un réel |
| `src/strategy/volatility.py` *(nouveau)* | — | ATR de Wilder sur bougies OHLCV validées (tri, dédoublonnage, cohérence, bougies aberrantes) ; proxy `DEX_M5_PROXY` désactivé par défaut et toujours étiqueté | Ne jamais présenter une variation 5 min comme un ATR |
| `src/strategy/backtest.py` | Points, frais en bloc, `OPEN_AT_END` compté, grille de 6 561, découpage 70/30 | Barres (stop au plus bas avant TP au plus haut), frais, pourboire et glissement à chaque exécution, positions censurées, 3 scénarios, mesures complètes, 18 profils, Walk-Forward ancré à 4 plis avec purge de 12 h sur horodatages réels, verdict strict | Validation honnête |
| `src/strategy/shadow.py` *(nouveau)* | — | Shadow Ledger SQLite (rejets de sélection uniquement, prix à +15/60/120 min) | Mesurer les opportunités manquées |
| `src/strategy/risk.py` *(nouveau)* | — | Régime macro SOL (H1 de SOL/USDC sur DexScreener, stress si baisse ≤ −5 % ou donnée inconnue ou périmée) ; mesure du glissement des devis | Risque transversal |
| `src/filters/holders.py` *(nouveau)* | Exclusion AMM/LOCKER dans `sources.py`, sans contrôle d'ambiguïté | `compute_real_top10_pct` (types techniques confirmés seulement, jamais CREATOR ; ambiguïté = None = rejet), réseaux d'insiders, `CreatorHistory` (RPC en lecture seule) | Concentration réelle, insiders, créateurs sériels |
| `src/filters/rug_detector.py` | Audit RugCheck, DexScreener, Jupiter | + insiders (fail-closed), + créateur sériel (si RPC configuré) | Anti-rug renforcé |
| `src/memecoin/sources.py` | Top 10 calculé sur place | Délégué à `holders.py` ; nouveaux champs `dex_id`, `pair_address`, `mcap_usd`, M5 | Contrat DexScreener vérifié |
| `src/fetchers/copytop.py` | MCP JSON-RPC | API REST documentée (OpenAPI), validation des handles, classement mis en cache, découpage par lots de 25 et curseur le plus ancien, échec = pas d'avancée | Contrat vérifié, aucun événement perdu |
| `src/smart/copytop_engine.py` *(nouveau)* | — | `MigrationWatchlist` (45 min, 50 jetons, dédoublonnage, expiration), `migrated_pair`, `eligible_cohort`, `still_in` | Récupérer les signaux pré-migration sans baisser la sécurité |
| `src/fetchers/geckoterminal.py` | Jetons, pools en tendance, trades | + `ohlcv` (cache de 90 s par pool, verrou anti-appels simultanés) | ATR |
| `src/fetchers/dexscreener.py` | `prices` | + `pairs_batch` (30 adresses par requête, échec = None, pas de résultat partiel) | Migrations, macro |
| `src/fetchers/rpc.py` | Liste blanche en lecture | + `getTransaction` (lecture seule) | Classification des créations de jetons |
| `src/paper_trader.py` | Frais et pourboire par vente | + stop, suiveur, pool et volatilité figés à l'entrée, frais cumulés, glissement de sortie, curseur copy.top par position, coupe-circuit par moteur réactivable, statistiques isolées, mode `legacy` en LIVE | Isolation des moteurs, coûts traçables |
| `src/bot.py` | Boucle séquentielle, signaux copy.top retardés | Ordre : macro → smart → copy.top/file → scan borné (20) → surveillance ; nouvelles commandes ; moteurs non-scan bloqués en LIVE | Réactivité, sécurité |
| `src/config.py` | Seuils assouplissables, `live` accepté | Plafond dur à 0,05 SOL, seuils durcissables uniquement, LIVE seulement sur la valeur exacte `LIVE`, nouvelles variables | Contraintes absolues |
| `scripts/fetch_token_audit.py` | `--min-liquidity` pouvait baisser le seuil | Seuils durcissables uniquement | Idem |
| `env.example` | — | Toutes les nouvelles variables documentées | — |
| `tests/*` | 131 tests | 230 tests, dont `test_paper_safety.py` et `test_antirug.py` (nouveaux) | — |

## C. Nouvelles fonctionnalités et état réel

**Légende :**
- **OPÉRATIONNEL** : contrat d'API vérifié en réel et testé.
- **SIMULÉ** : testé avec des fixtures fidèles au contrat, sans validation complète en réel.
- **EN ATTENTE** : dépend d'une API qui n'a pas pu être vérifiée.

| Fonction | État | Détail |
|---|---|---|
| Migration Watchlist | OPÉRATIONNEL (pipeline), SIMULÉ (migration) | Contrats DexScreener (`dexId` pumpfun/pumpswap/raydium/meteora) et copy.top vérifiés. Aucune migration observée pendant les essais réels |
| Filtrage copy.top (clean, détention ≥ 5 min, ≥ 2 traders) | OPÉRATIONNEL | **Constat réel** : le profil renvoie `holdMin: null` ; la durée vient du classement (`/v1/traders`). Sur 55 traders classés, 8 seulement sont admissibles ; les 9 signaux réels testés n'en contenaient aucun |
| Vélocité d'entrée | OPÉRATIONNEL | Champs DexScreener M5 vérifiés ; en réel, 9 jetons sains sur 58 rejetés par ces filtres |
| Sorties ATR | OPÉRATIONNEL | OHLCV GeckoTerminal vérifié ; si 429 ou données insuffisantes : mode fixe, jamais de fausse mesure |
| Stagnation, TP1 30 %, plancher, 120 min | OPÉRATIONNEL (logique testée) | Pas encore de trade réel avec ces règles |
| Surveillance des ventes copy.top | OPÉRATIONNEL (contrat), SIMULÉ (déclenchement) | `/v1/trades?traders=` et `/v1/coins/solana/{mint}` (`holding` par trader) vérifiés |
| `still_in` / désengagement | OPÉRATIONNEL | Fondé sur `leaders.rows[].holding` ; trader absent de la page = inconnu, jamais compté comme sorti |
| Réseaux d'insiders | OPÉRATIONNEL | `insiderNetworks` vérifié (8 rejets sur 58 jetons en 4 min réelles) |
| Concentration réelle du Top 10 | OPÉRATIONNEL | Contrat RugCheck vérifié |
| Créateurs sériels | **EN ATTENTE** | `creatorTokens` vaut null en réel ; nécessite un RPC (Helius/Chainstack) non configuré ici. Désactivé sans RPC ; `CREATOR_CHECK_REQUIRED=true` pour exiger la donnée |
| Shadow Ledger | OPÉRATIONNEL | 7 jetons enregistrés en 6 min réelles |
| Glissement dynamique | OPÉRATIONNEL (mesure) | Écart entre le devis Jupiter de sortie et le prix affiché, comparé au modèle fixe (2,39 %) dans `report.costs` |
| Walk-Forward | OPÉRATIONNEL | Données insuffisantes à ce jour : verdict `INSUFFICIENT_EVIDENCE` |
| Coupe-circuits par moteur | OPÉRATIONNEL | 25 trades perdants (`pnl_sol < 0`) depuis la dernière réactivation ; le coupe-circuit journalier global est conservé |
| Filtre macro SOL | OPÉRATIONNEL | Paire SOL/USDC DexScreener ; donnée inconnue ou de plus de 5 min = stress |

## D. Tests

- **230 exécutés, 230 réussis, 0 échec** (`python3 -m pytest -q`, environ 2 s, aucun appel réseau).

| Fichier | Tests | Ce qui est couvert |
|---|---|---|
| `test_strategy.py` | 72 | Entrées, ATR, sorties, priorités, frais des ventes partielles, backtest, Walk-Forward, Shadow Ledger, macro |
| `test_smart.py` | 24 | Cohorte, classement, `still_in`, file de migration (TTL, taille, doublon), migration réelle simulée, ventes, cohorte de plus de 25 handles, panne d'API |
| `test_antirug.py` | 31 | Top 10 réel, ambiguïtés, insiders, créateurs sériels, RPC en panne, RugCheck absent |
| `test_paper_safety.py` | 13 | Voir ci-dessous |
| `test_bot.py`, `test_filters.py`, `test_guard_hook.py`, `test_live.py`, `test_social_and_costs.py` | 90 | Existants, adaptés |

**Sécurité** (`test_paper_safety.py`, 13/13) :
- Défaut PAPER et plafond de 0,05 SOL.
- Seuils de sécurité obligatoires.
- Valeurs LIVE ambiguës refusées.
- Aucun appel aux endpoints de transaction par les nouveaux moteurs.
- Signaux des nouveaux moteurs bloqués en LIVE, avec un exécuteur factice qui fait échouer le test à toute tentative d'ordre.
- Aucune lecture de clé ou de fichier `.env`.
- Kelly plafonné.

**PAPER, essais réels** (10 min au total, API publiques) :
- 0 erreur.
- La sécurité rejette la majorité des jetons (49 sur 58, dont 8 pour réseaux d'insiders).
- Les filtres de vélocité rejettent 9 jetons sains.
- Les signaux copy.top sont traités dans la minute après la correction de la boucle.
- Aucune position ouverte pendant ces essais : aucune ne remplissait toutes les conditions.

## E. Paramètres de trading finaux

| Domaine | Valeur | Justification |
|---|---|---|
| Sécurité | liquidité ≥ 15 000 $, LP ≥ 90 %, Top 10 ≤ 25 %, impact ≤ 5 %, aller-retour ≤ 10 %, autorités révoquées | Imposé, non assouplissable |
| Âge | STRICT 30 min (+ 30 tx H1) | Défaut prudent ; PAPER_FAST seulement par choix explicite |
| Vélocité | ≥ 20 tx et ≥ 2 500 $ sur M5, achats/ventes 1,15–6,5, accélération ≥ 1,3 | Dynamique réelle, exclusion du wash trading |
| Structure | liquidité/capitalisation 8–70 %, H1 entre −15 et +250 % | Ni piège à liquidité ni sommet parabolique |
| Stop | ATR × 2,2 borné à 18–38 % (fixe à −25 % sans ATR) | S'adapte à la volatilité au lieu de sortir sur du bruit |
| Prise de gain | TP1 +40 % net (30 % vendus), plancher +3 % net, suiveur ATR × 2,0 borné à 20–35 %, TP final +300 % | Conserver 70 % pour les queues épaisses |
| Temps | Stagnation 20 min (pic < 8 %, < 3 %), maximum 120 min | Libérer le capital immobilisé |
| Taille | 0,05 SOL fixe (Kelly possible, statistiques par moteur, plafond dur) | — |
| Risque | 25 pertes par moteur, perte journalière de 1 SOL, 2 positions si SOL chute | — |

Ces valeurs viennent de la mission et des contraintes ; **aucune n'a été ajustée sur des résultats**.
Le Walk-Forward choisira parmi 18 profils quand il y aura au moins 70 trades clôturés.

## F. Points non résolus (transparence)

**API et données :**
- **Créateurs sériels** : non validés en réel (pas de RPC). La classification ne reconnaît que les marqueurs
  explicites (Pump.fun `Create`, `InitializeMint`) ; d'autres launchpads peuvent passer inaperçus.
- **copy.top sans clé** : limites « basses » non chiffrées. Des 429 ont été observés au-delà d'environ 10 requêtes/min,
  et le débit a été réglé à 8/min.
- Le flux `/v1/trades` ne garde que 30 trades. Une vente peut être manquée entre deux interrogations ;
  la page jeton (`holding`) compense pour les sorties complètes, pas pour les ventes partielles.
- **`buyers` limité à 5 handles par alerte** : la cohorte suivie est ce sous-ensemble, pas tous les top traders.
- **Admissibilité copy.top très restrictive en réel** (8 traders sur 55) : peu ou pas d'entrées de ce moteur.
  C'est le résultat des règles demandées, pas un défaut.

**Backtest :**
- Prix DexScreener échantillonnés à la minute : le vrai plus bas intra-minute peut être pire, d'où le scénario de stress.
- Sorties copy.top non simulées (pas d'historique des ventes de cohorte).
- Observations antérieures à la refonte sans champs M5 : elles sont exclues des entrées du backtest (UNKNOWN), jamais complétées.
- La volatilité des observations n'est disponible que depuis la refonte.

**Surapprentissage :** la grille est réduite à 18 profils et la sélection se fait sur l'entraînement purgé. Le risque
demeure tant que l'échantillon reste petit : 70 trades est un minimum, plus de 100 sur plusieurs jours est préférable.

**Rentabilité :** **non démontrée.** Aucune donnée ne permet aujourd'hui d'affirmer un avantage statistique.

## G. Commandes

```bash
python3 -m pytest -q                                  # tests (aucun appel réseau)
EXECUTION_MODE=PAPER python3 scripts/run_bot.py run   # bot en PAPER (défaut)
python3 scripts/run_bot.py backtest                   # réglages actuels : base / pessimiste / stress, par moteur
python3 scripts/run_bot.py walkforward                # Walk-Forward ancré 4 plis, 18 profils (alias : optimize)
python3 scripts/run_bot.py report                     # statistiques par moteur, coûts, macro, Shadow Ledger, file
python3 scripts/run_bot.py shadow                     # opportunités manquées (rendements +15/60/120 min)
python3 scripts/run_bot.py watchlist                  # file de migration Pump.fun
python3 scripts/run_bot.py reactivate-source copytop --note "revue manuelle"   # coupe-circuit d'un moteur
```
