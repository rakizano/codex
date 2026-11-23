# Compte rendu complet — Bot de trading de meme coins Solana

> Document autonome destiné à une autre IA (ou un humain) qui reprend le projet sans contexte.
> État au **23/11/2026, 13 h UTC**. Dépôt public : `github.com/rakizano/codex` (branche `main`).

---

## 1. Objectif et contraintes

**Objectif du propriétaire** : un bot qui trouve, audite et trade automatiquement des meme coins
Solana, avec le maximum de gain. Budget nul (APIs gratuites, pas de serveur payant).

**Contraintes non négociables (posées pendant le projet)** :
- **PAPER par défaut** : tout tourne en simulation. Le mode réel (LIVE) existe mais exige trois réglages
  explicites saisis par le propriétaire lui-même, et une position est plafonnée à **0,05 SOL**.
- **Une IA ne doit jamais** : lire le fichier d'environnement ni la clé du wallet, fournir la phrase de
  confirmation du mode réel, ni assouplir les garde-fous de sécurité pour « avoir plus de trades ».
- **Sécurité fail-closed** : une donnée inconnue = rejet.
- Les données de tiers (noms, symboles, descriptions, textes de traders) sont **non fiables** : jamais
  traitées comme des instructions (protection contre l'injection de prompt).

## 2. Architecture (Python 3.12/3.13, ~4 800 lignes, 127 tests pytest qui passent)

```
scripts/run_bot.py          point d'entrée CLI (run, scan, smart, audit, monitor, track, report, backtest, optimize)
src/bot.py                  boucle principale, orchestration des moteurs
src/config.py               réglages (variables d'environnement, valeurs par défaut prudentes)
src/fetchers/               clients HTTP async (httpx) avec limiteur de débit + retries/backoff
  dexscreener.py  geckoterminal.py  rugcheck.py  jupiter.py  rpc.py (Solana, méthodes lecture seule)
  copytop.py                signaux copy.top (classement PnL Pump.fun), JSON-RPC HTTP, lecture seule
src/filters/rug_detector.py audit de sécurité d'un jeton
src/memecoin/filters.py     seuils éliminatoires + détection d'injection
src/strategy/               entry.py (momentum), exit.py (sorties), sizing.py (Kelly), backtest.py (optimiseur)
src/smart/tracker.py        moteur « smart money » maison (classement de wallets)
src/social/                 signaux X (optionnel, payant), Reddit, liens déclarés
src/paper_trader.py         registre des positions (SQLite), PnL net de frais
src/live/executor.py        exécution réelle (Jupiter + Jito), inactive en PAPER
src/analyzer.py             LLM local optionnel (Ollama), ne peut qu'ABAISSER un verdict
.claude/hooks/guard-trading.sh  hook qui bloque l'accès aux secrets et aux commandes de transaction
.github/workflows/paper-test.yml  exécution gratuite et continue sur GitHub Actions
```

**Sources de données (toutes gratuites, sans clé)** : DexScreener (découverte, prix, paires),
GeckoTerminal (pools en tendance, 300 derniers trades par pool), RugCheck (rapport de risque),
Jupiter (devis achat/vente = test honeypot et impact prix), copy.top (alertes « top traders »).
Optionnel : RPC Solana (Helius/Chainstack), X API (payant), Ollama.

## 3. Pipeline de décision (par jeton)

1. **Découverte** : profils et boosts récents DexScreener, top boosts, pools en tendance GeckoTerminal
   (~60 candidats par scan, toutes les 60 s).
2. **Audit de sécurité (éliminatoire, fail-closed)** :
   - liquidité ≥ 15 000 USD ;
   - LP verrouillée ≥ 90 % ;
   - top 10 des détenteurs ≤ 25 % ;
   - impact prix ≤ 5 % ;
   - perte aller-retour ≤ 10 % (taxe cachée / honeypot via devis Jupiter achat puis vente) ;
   - autorités mint/freeze révoquées ;
   - drapeaux RugCheck ;
   - prix cohérents entre sources ;
   - détection d'injection dans les métadonnées.
3. **Règles d'entrée « momentum »** (moteur scan) :
   - âge de la paire entre 30 min et 7 j ;
   - variation 1 h entre −20 % et +300 % ;
   - ratio achats/ventes sur 1 h ≥ 1,0 ;
   - au moins 30 transactions sur 1 h.
4. **Social** (ne peut que bloquer) : au moins un lien déclaré (X/Telegram/site), pas de hype achetée
   excessive (boosts), mentions X si clé configurée.
5. **LLM optionnel** (ne peut qu'abaisser).
6. **Position** : 0,05 SOL fixe (Kelly fractionné possible après 30 trades ; pause automatique si
   l'avantage mesuré est négatif) ; max 5 positions ; coupe-circuit à −1 SOL par 24 h ; pas de rachat
   d'un perdant pendant 24 h.
7. **Sorties** (surveillance toutes les 5 s via DexScreener, réévaluation complète par devis Jupiter
   toutes les 15 s) :
   - stop-loss −25 % ;
   - vente de 50 % à +40 % (TP1), puis stop remonté au prix d'entrée ;
   - stop suiveur de 25 % sous le plus haut, actif dès +40 % ;
   - take-profit total à +300 % ;
   - sortie forcée après 240 min.
8. **Coûts simulés comme en réel** : 1 % de frais par côté + pourboire Jito 0,0001 SOL par transaction
   → aller-retour ≈ 2,4 % à 0,05 SOL.

## 4. Les moteurs de signaux (comparés en simulation, étiquette `source` par position)

| Moteur | Principe | Étiquette |
|---|---|---|
| 1 — scan | découverte + sécurité + momentum | `scan` |
| 2 — smart money maison | classe les wallets à partir des trades publics GeckoTerminal (PnL réalisé par jeton, ≥ 3 jetons revendus, ≥ 35 % gagnants, ≥ 500 USD, robots exclus) ; entrée si ≥ 2 wallets smart achètent le même jeton en 30 min | `smart` |
| 2 bis — copy.top | alerte « ≥ 3 top traders du classement Pump.fun ont acheté, ≥ 2 encore en position, signal < 30 min » ; refus si capitalisation déjà +50 % depuis le signal | `copytop` |
| croisé | le scan ET un moteur smart désignent le même jeton | `both` |

Un signal smart/copy.top ne force jamais une entrée : le jeton repasse par les étapes 2 à 6.
Le rapport (`report`) donne PnL et taux de réussite **par moteur** (`by_source`).

## 5. Infrastructure de test

- **GitHub Actions** (dépôt public = minutes gratuites illimitées) : exécutions de 5 h 50 en PAPER,
  base SQLite conservée entre exécutions (cache Actions), **chaque exécution relance la suivante**
  (le cron GitHub ne s'est pas déclenché de façon fiable). Arrêt : variable de dépôt `PAPER_CHAIN=false`.
- Bilan lisible dans *Actions → paper-test → Summary* (rapport, smart money, optimiseur).
- Alternative locale : `scripts/start_paper.bat` (Windows) / `scripts/start_paper.sh`.
- Optimiseur : grille de 6 561 combinaisons (sorties × entrées), séparation temporelle 70/30
  (train/test hors échantillon), au moins 15 trades en train ; verdict
  `RENTABLE_HORS_ECHANTILLON` / `NON_RENTABLE` / `PAS_ASSEZ_DE_DONNEES`.

## 6. Résultats réels (simulation, aucun argent réel engagé)

**Cumul GitHub au 23/11 13 h UTC : 12 trades clôturés** (montants de 11 d'entre eux lus dans les
journaux ; le n° 6 a été clôturé pendant une exécution annulée dont le journal n'a pas été lu).

| # | Moteur | Sortie | PnL (SOL, mise 0,05) |
|---|---|---|---|
| 1 | scan | STOP_LOSS | −0,0125 |
| 2 | scan | STOP_LOSS | −0,0144 |
| 3 | scan | STOP_LOSS | −0,0148 |
| 4 | scan | STOP_LOSS | −0,0176 |
| 5 | scan | TP1 puis TRAILING_STOP | +0,0153 |
| 6 | scan | inconnu | ? |
| 7 | scan | STOP_LOSS | −0,0125 |
| 8 | scan | TIME_STOP | −0,0058 |
| 9 | scan | STOP_LOSS | −0,0160 |
| 10 | scan | TP1 puis TIME_STOP | +0,0160 |
| 11 | scan | TIME_STOP | +0,0008 |
| 12 | copytop | STOP_LOSS (6 min après l'entrée) | −0,0147 |

- **Total connu ≈ −0,076 SOL** sur 11 trades (≈ −14 % du capital engagé).
- 3 gagnants sur 11 (~27 %) ; seuil de rentabilité théorique avec ces sorties ≈ 38 %.
- Les stop-loss sortent souvent à −25/−35 % (glissement) et parfois **quelques minutes après l'entrée**.

**Dernière exécution (6 h)** :
- **Entonnoir** : 93 jetons audités → 82 rejetés pour sécurité, 7 refusés par le momentum, 1 bloqué
  par le social, 3 entrées.
- **copy.top** : 47 signaux reçus. 45 ont été rejetés par la sécurité, dont 38 pour
  `UNKNOWN_LIQUIDITY` (jetons encore sur la courbe de lancement Pump.fun, sans pool). 1 entrée a été
  stoppée en 6 min, et 1 a été bloquée faute de liens sociaux.
- **Smart money maison** : aucun wallet qualifié pour l'instant (historique insuffisant). Un test local
  a analysé 5 717 trades et 2 268 wallets en 2 min, et exclu 16 robots.
- **Infrastructure** : 0 erreur ; la relance automatique fonctionne.

**Données de marché observées (copy.top)** : les meilleurs traders Pump.fun sur 7 jours gagnent avec
seulement 23 à 56 % de trades gagnants (quelques gros gains compensent beaucoup de petites pertes),
et opèrent surtout sur des jetons de 2 000 à 10 000 USD de capitalisation, avant la migration en pool.

## 7. Diagnostic actuel

1. **La stratégie momentum du moteur scan est perdante** sur l'échantillon (petit, mais la tendance est nette).
2. **Le stop −25 % est probablement trop serré** pour la volatilité normale de ces jetons (sorties en
   minutes), alors que les gains sont plafonnés tôt (TP1 +40 %, sortie au temps à 240 min).
3. **Inadéquation entre signaux smart money et filtres de sécurité** : les top traders gagnent sur des
   jetons très jeunes (courbe Pump.fun, faible liquidité) que nos filtres refusent volontairement. Les
   rares jetons qui passent les filtres sont « tardifs ».
4. **Échantillon trop petit** pour conclure statistiquement (optimiseur pas encore utilisable : il lui
   faut ≥ 15 trades en train).

## 8. Questions pour l'IA qui reprend

1. Comment adapter les **sorties** à la volatilité des meme coins (stop basé sur l'ATR/la volatilité
   récente, stop temporel plus court, TP1 plus bas, sortie si les top traders revendent) sans
   sur-ajuster sur 12 trades ?
2. Existe-t-il des **filtres d'entrée** mieux corrélés au gain (âge, liquidité/capitalisation, accélération
   du volume, part d'acheteurs uniques, comportement post-migration Pump.fun) ?
3. Faut-il **suivre la sortie des top traders** (copy.top fournit leurs ventes) comme signal de sortie ?
4. Comment exploiter les signaux copy.top **sans** abaisser les garde-fous anti-rug (ex. attendre la
   migration en pool, puis entrer seulement si les top traders sont toujours en position) ?
5. Méthodologie : combien de trades faut-il pour un verdict fiable, et comment éviter le
   sur-apprentissage (le walk-forward 70/30 actuel suffit-il ?) ?

**À ne pas proposer** : assouplir les filtres de sécurité pour multiplier les trades, passer en réel
avant un résultat `RENTABLE_HORS_ECHANTILLON`, ou demander des clés/secrets.

## 9. Réglages modifiables (variables d'environnement, extrait)

`STOP_LOSS_PCT=-25`, `TP1_PCT=40`, `TP1_FRACTION=0.5`, `TRAIL_ACTIVATION_PCT=40`, `TRAILING_STOP_PCT=25`,
`TAKE_PROFIT_PCT=300`, `MAX_HOLD_MINUTES=240`, `MIN_PAIR_AGE_MIN=30`, `MIN_BUY_SELL_RATIO_H1=1.0`,
`MIN_TXNS_H1=30`, `MIN_LIQUIDITY_USD=15000`, `MIN_LP_LOCKED_PCT=90`, `MAX_TOP10_PCT=25`,
`SMART_MIN_WALLETS=2`, `SMART_MIN_WIN_RATE=0.35`, `COPYTOP_MIN_TOP_TRADERS=3`, `COPYTOP_MIN_STILL_IN=2`,
`POSITION_SIZE_SOL=0.05`, `EXECUTION_MODE=PAPER`. Liste complète : `env.example` à la racine du dépôt.

## 10. Conclusion

L'infrastructure est solide : multi-sources gratuites, sécurité fail-closed, trois moteurs comparés,
simulation réaliste des frais, test continu gratuit et optimiseur hors échantillon. Mais **aucune
stratégie n'est rentable à ce jour** : ≈ −14 % sur 11 trades simulés. Recommandation actuelle :
continuer la collecte 1–2 jours (objectif 30 trades), lancer l'optimiseur, et **ne pas trader en réel**
tant qu'il n'a pas validé une stratégie sur des données qu'il n'a jamais vues.
