# Audit technique PAPER — rakizano/codex

> Réalisé le 25 novembre 2026 sur la branche `gpt/refonte-paper-isolee`.
> Base de lecture : `main` au commit `db2c879471cb8ba962845ada7f8c4a5bb944d2a5`.
> Périmètre : pipeline de découverte, anti-rug, Pump.fun/PumpSwap, momentum, copy.top, Helius, PAPER costs/exits.
> **Aucun fichier source ou workflow de trading n'a été modifié pendant cet audit.**

## 1. Résumé exécutif

Le dépôt contient déjà une refonte importante : migration watchlist, filtres de vélocité, ATR, top holders réels, réseaux d'insiders, surveillance copy.top, Shadow Ledger, Walk-Forward, limites de taille et séparation PAPER/LIVE.

Le diagnostic fourni par l'utilisateur est utile comme liste d'hypothèses, mais plusieurs formulations ne sont pas établies par le code ou les journaux. Les points les mieux étayés sont :

1. **Le contrôle LP est fail-closed et ne vérifie pas la destruction on-chain des LP PumpSwap.** Le moteur lit `lpLockedPct` depuis les marchés RugCheck et exige au moins 90 %. Il n'interroge pas encore le compte de pool ou le supply LP on-chain pour reconnaître une migration authentifiée.
2. **Le profil STRICT est exigeant.** Il impose simultanément un âge de paire de 30 minutes et au moins 30 transactions H1, en plus des filtres M5. Ce n'est pas une contradiction mathématique avec M5 : le momentum est mesuré au moment de l'audit. Le code offre déjà `PAPER_FAST`, mais il n'est pas activé par défaut.
3. **Le client copy.top dépasse la limite documentée des lectures lourdes lors d'un cache miss.** Son classement effectue huit requêtes `/traders` (2 fenêtres × 4 tris), tandis que la limite documentée sans clé est de six lectures lourdes par minute. L'implémentation ne prend pas encore en charge de clé API.
4. **La vérification des créateurs est déjà placée en aval**, après l'audit de sécurité primaire, mais elle est inactive dans l'environnement PAPER tant qu'aucun RPC n'est configuré. Le workflow PAPER ne transmet actuellement aucune variable RPC.
5. **Le modèle PAPER ne comptabilise pas la rente ATA comme capital immobilisé**, et n'émule pas le délai ni les échecs de règlement. En revanche, il utilise déjà des devis Jupiter à l'entrée/sortie, applique 1 % de frais par exécution et compte le tip à chaque exécution.

Aucune de ces observations ne démontre à elle seule que les 479 décisions de la session sont des occasions d'achat manquées ou que le bot deviendrait rentable après correction.

## 2. État Git et isolation avec Claude

- Branche principale lue : `main`, HEAD `db2c879471cb8ba962845ada7f8c4a5bb944d2a5`.
- Branche dédiée créée pour ce travail : `gpt/refonte-paper-isolee`.
- Branche de bot Claude `claude/meme-coin-trading-bot-yns7r5` : comparaison GitHub = 0 commit en avance et 1 en retard sur `main`. Le dernier état de cette branche est donc déjà intégré dans `main`, avec une petite avance de `main`.
- `strategy/copytop-distribution-exit` : 0 en avance et 6 en retard sur `main`.
- Les branches Claude liées aux skills vidéo / studio sont très divergentes, mais les différences relevées concernent des répertoires de skills et de média, pas les modules du bot.

**Conséquence de collaboration :** continuer exclusivement sur `gpt/refonte-paper-isolee`. Ne pas fusionner, rebaser ou pousser sur les branches Claude. Avant toute modification d'un fichier source, comparer à nouveau son état et les éventuels commits récents.

## 3. Tableau de validation du diagnostic

| Hypothèse du diagnostic | Conclusion de l'audit | Preuve dans le dépôt / limite |
|---|---|---|
| LP Pump.fun migrées et brûlées rejetées à tort | **Mécanisme confirmé ; faux rejets à mesurer** | Le programme Pump documente la migration vers PumpSwap et la destruction des LP. Le bot exige `lpLockedPct >= 90` depuis RugCheck et ne vérifie pas leur destruction on-chain. Mais les 84 drapeaux `LP_NOT_LOCKED` ne sont pas attribués individuellement à des pools PumpSwap dans les logs agrégés. |
| Les 213 `UNKNOWN_LIQUIDITY` viennent du cache RugCheck | **Non confirmé / attribution erronée** | `UNKNOWN_LIQUIDITY` vient de l'absence de liquidité DexScreener exploitable dans `src/memecoin/sources.py`. Le cache RugCheck peut causer des données de marché obsolètes, mais ne constitue pas la cause directe prouvée de ce drapeau. |
| Les 84 `RUGCHECK_DANGER` viennent de la pénalité LP | **Non démontré** | Le code rejette si au moins un élément `risks[]` porte `level=danger`. Il n'applique pas le seuil numérique `score_normalised > 40` cité dans le diagnostic. Sans détail `risks[].name` par mint, impossible de savoir quelle part est liée à la LP. |
| Le Top 10 inclut nécessairement la réserve AMM | **Risque partiellement couvert** | `holders.py` exclut les comptes techniques dont le type est confirmé dans `knownAccounts` et les comptes de pool / réserves présents dans `markets`. Les programmes PumpSwap/Pump.fun ne sont pas ajoutés comme exclusions générales par nom ; une vérification supplémentaire par propriétaire/compte est à envisager, mais seulement avec preuve. |
| Insiders : seuil actuel trop agressif | **À évaluer sur données brutes** | Règles actuelles : types `trade` et `transfer`, rejet si réseau >=20 wallets OU >=5 % de l'offre. Elles ne correspondent pas au seuil 100+ wallets / 0,5 % mentionné dans le diagnostic. Changer ces seuils sans étudier les clusters bruts risquerait d'ouvrir une faille anti-rug. |
| Contradiction entre âge 30 min et vélocité M5 | **Intersection restrictive confirmée ; contradiction non confirmée** | `STRICT` impose 30 min + 30 transactions H1, puis les seuils M5. `PAPER_FAST` existe déjà : 3 min pour copytop/smart et 10 min pour scan ; le profil FAST dispense aussi du minimum H1. Les 35 décisions `MOMENTUM_REJECT` ne sont pas ventilées en motifs suffisamment fins pour attribuer le blocage à l'âge. |
| copy.top trop lent / 24 ReadTimeout | **Limite de quota confirmée ; causalité exacte des timeouts à instrumenter** | `leaderboard()` appelle huit endpoints lourds sur cache miss. Limite officielle sans clé : 6 lectures lourdes/min ; avec clé gratuite : 30/min. Le client est à 8 requêtes globales/min, timeout 15 s et 4 tentatives. Un warning ReadTimeout est une tentative, pas nécessairement un appel final perdu. |
| 0 cohorte admissible signifie API cassée | **Pas nécessairement** | Le code exige fairPlay=clean, holdMin connu et >=5 min, puis revalide le profil ; les alertes exposent au plus 5 handles. L'observation documentée de 8 traders admissibles sur 55 et 9 signaux sans cohorte admissible indique aussi un filtre très restrictif. |
| Contrôle créateurs désactivé par peur du RPC gratuit | **Désactivation confirmée ; économie de quota à recalculer** | `CreatorHistory` n'est créé que si `HELIUS_RPC_URL` ou `CHAINSTACK_RPC_URL` est configuré. Le workflow n'injecte aucune de ces variables. Contrôle déjà en aval, seulement après `WATCHLIST_PAPER`. |
| 1,19 % du quota Helius pour tous les créateurs | **Sous-estimation du pire cas** | Le code fait une requête de signatures puis jusqu'à 39 requêtes `getTransaction` supplémentaires par créateur non caché, TTL actuel 6 h. Les méthodes RPC standards sont en général 1 crédit. Au débit indicatif de 479/29,17 h (~394 candidats/jour), plafond théorique simple : environ 15 800 crédits/jour (47 % d'un budget moyen de 33 333/j), avant déduplication/cache et selon le nombre de créateurs distincts. La consommation réelle sera probablement inférieure, mais doit être mesurée. |
| PAPER ignore les frais/impact Jupiter | **Partiellement faux** | Le bot appelle déjà Jupiter pour la cotation et valorise la position au devis de sortie. Il ajoute 1 % de frais par exécution, le tip, et mesure l'écart DexScreener/devis dans le rapport. Il ne modélise pas la latence entre devis et remplissage, les échecs d'atterrissage, ni une distribution empirique d'impact en période de stress. |
| PAPER ignore la rente ATA | **Confirmé** | Aucune ligne de coût / capital immobilisé ATA dans `PaperTrader`. Le montant varie avec la taille de compte et les extensions ; il ne faut pas le traiter comme une perte définitive si le compte peut être fermé et les lamports récupérés. |
| Freeze authority active rend la rente irrécupérable | **Contredit par la documentation Solana** | Un token account gelé dont le solde est nul peut encore être fermé. La fermeture dépend du solde, de l'autorité de fermeture et, selon extensions Token-2022, de conditions supplémentaires. |
| Le TP1 actuel vend 50 % | **Vrai pour le profil legacy LIVE, faux pour le profil PAPER refondu** | `LEGACY_EXIT_RULES` fixe TP1 à 50 %, tandis que `ExitRules` par défaut en PAPER vend 30 % à +40 %. Le workflow PAPER n'utilise pas la logique legacy. |
| Il suffit de passer au TP1 25 % / +50 % | **Non validé** | Aucun test hors échantillon net de frais ne prouve l'avantage. Le Walk-Forward courant attend au moins 70 trades et affiche `INSUFFICIENT_EVIDENCE` faute de données. |

## 4. Analyse par bloc

### 4.1 Pump.fun / PumpSwap / anti-rug

**Code actuel**
- `src/memecoin/sources.py` : la liquidité USD est prise sur la paire DexScreener la plus liquide.
- Le pourcentage LP est calculé à partir de `markets[].lp.lpLockedPct` de RugCheck, pondéré par `baseUSD + quoteUSD`.
- Si aucune ligne de marché n'a de montant USD et de pourcentage LP valide, la mesure reste `None`.
- `src/memecoin/filters.py` exige 90 % de LP verrouillée et rejette les valeurs inconnues.
- `src/filters/rug_detector.py` vérifie actuellement sur RPC les autorités mint/freeze, mais pas la position ni le supply du jeton LP.
- La watchlist de migration ne prend que les signaux copy.top dont le seul drapeau d'audit est `UNKNOWN_LIQUIDITY`. Elle cherche ensuite une paire DexScreener sur `pumpswap/raydium/meteora`, revérifie la cohorte et repasse par l'audit complet. Elle ne prouve pas l'instruction de migration on-chain.

**Ce que la documentation officielle confirme**
Les docs publiques Pump décrivent la migration de la bonding curve vers PumpSwap et indiquent que les LP reçues sont brûlées. Cela justifie un chemin d'audit distinct pour une migration Pump authentifiée. Cela ne justifie pas de considérer toutes les pools PumpSwap comme sûres : une pool directe ou une liquidité ajoutée ultérieurement peut avoir une liquidité retirable.

**Correction candidate**
- Décoder et authentifier l'événement / instruction de migration via les programmes officiels et comptes attendus.
- Lire les comptes LP et les soldes on-chain associés à la pool ; vérifier le burn ou un lock valide.
- Ne considérer la liquidité de migration comme sécurisée que si toute la chaîne de preuve est complète.
- Pour toute pool directe / liquidité ajoutée hors migration reconnue, continuer à exiger un burn/lock vérifiable.
- Garder les seuils de liquidité, autorités, concentration privée, impact Jupiter, roundtrip et autres signaux RugCheck inchangés.
- En cas de donnée inconnue, continuer à rejeter.

**Non autorisé par les preuves actuelles :** désactiver `LP_NOT_LOCKED`, accepter `lpLockedPct=0` sans vérification on-chain, ou neutraliser un `RUGCHECK_DANGER` simplement parce que le token est sur PumpSwap.

### 4.2 Top holders et insiders

Le calcul actuel est volontairement conservateur : comptes techniques confirmés exclus, créateur conservé dans les vrais détenteurs, données ambiguës rejetées. La prochaine étape doit être un jeu de fixtures réel (pool PumpSwap graduée, pool directe PumpSwap, ajout de liquidité, comptes de réserve, burn account, holders tronqués).

Pour les insiders, la distinction entre réseaux de transfert et de trading est pertinente, mais le seuil 100 wallets / 0,5 % du diagnostic n'est pas établi par les données actuelles du dépôt. Il faut récupérer des exemples de clusters avec leur type, leur taille, leur supply et leur currentHolding, puis mesurer les faux positifs/negatifs avant de changer les seuils.

### 4.3 Âge, momentum et flux

Le filtre d'entrée attend un âge, des données H1/M5, un ratio achats/ventes, une accélération, un ratio liquidité/capitalisation et un changement de prix H1. Toutes les valeurs indispensables doivent exister. Le profil STRICT n'est pas une fenêtre d'entrée précoce : c'est un choix prudent qui attend 30 minutes.

Le prochain test doit comparer, sans fusionner les politiques :
- STRICT (valeurs actuelles) ;
- PAPER_FAST (valeurs déjà prévues dans le code) ;
- résultats séparés par source (scan, smart, copytop) ;
- Shadow Ledger sur les prix à +15/+60/+120 min pour les rejets de sélection.

Ne pas activer `PAPER_FAST` globalement sans mesure ; une comparaison simultanée ou en replay est préférable. La cible « 5–15 trades/jour » reste une observation à mesurer, pas une contrainte d'entrée.

### 4.4 copy.top

**Défaut concret :** huit lectures lourdes sont lancées au cache miss du leaderboard, alors que la documentation publique limite les lectures lourdes sans clé à six/minute. Le TokenBucket actuel ne connaît pas la notion de « lecture lourde » et autorise huit appels/minute. Le client a un timeout de 15 s, quatre tentatives et un backoff exponentiel ; les 24 lignes ReadTimeout ne prouvent donc pas 24 requêtes finales perdues.

**Correction candidate :**
- ajouter un header Bearer facultatif `COPYTOP_API_KEY` ;
- injecter le secret dans le workflow PAPER seulement si l'utilisateur crée une clé gratuite et l'ajoute explicitement dans GitHub Secrets ;
- respecter les limites lourdes du plan sans clé si aucune clé n'est configurée ;
- conserver cursor, cache, cadence et gestion des échecs sans avancer le curseur quand l'appel a échoué ;
- instrumenter le nombre de requêtes, statuts HTTP, tentatives, appels lourds et taux d'erreur final par endpoint.
- envisager un webhook de confluence uniquement si un endpoint webhook persistant est disponible ; le workflow GitHub Actions n'est pas, à lui seul, un serveur webhook entrant.

Ne pas supprimer les exigences clean, holding et confluence. Les assouplir modifierait la qualité de la stratégie.

### 4.5 Helius / historique créateur

Le contrôle se déclenche seulement quand le jeton a déjà passé les principaux contrôles d'audit. Il utilise une lecture des signatures et des lectures détaillées des transactions, avec TTL 6 h. Ce n'est pas un appel RPC unique.

La configuration PAPER actuelle n'injecte ni `HELIUS_RPC_URL` ni `CHAINSTACK_RPC_URL`. Il faut donc une configuration de secret dans le workflow pour l'activer. La clé ne doit jamais être commitée dans `env.example`, le code ou les logs.

**Correction candidate :**
- prendre en charge le secret au niveau du workflow sans afficher sa valeur ;
- mesurer le nombre d'appels RPC et les crédits consommés avant d'augmenter le débit ;
- faire un test d'historique complet sur un petit échantillon de créateurs ;
- étudier un cache plus long (par exemple 24 h) seulement si la latence de détection d'un créateur répété reste acceptable.
- continuer à traiter l'historique inconnu comme inconnu, selon une politique explicite, sans l'assimiler à un historique propre.

### 4.6 Coûts, ATA et exécution

**PAPER aujourd'hui**
- taille par défaut : 0,05 SOL ;
- frais de modèle : 1 % par exécution ;
- tip : 100 000 lamports par exécution ;
- devis Jupiter sur la quantité exacte de jetons détenue pour la valeur de sortie ;
- mesure de l'écart de devis vs prix DexScreener.
- pas de coût ATA ni de temps de latence simulé.
- la version Jupiter est l'ancien endpoint Swap v1 `/quote`, pas Swap V2 `/order`.

**ATA**
Le minimum de solde dépend de la taille de compte et des paramètres du réseau. La documentation Solana (octobre 2026) indique 1 488 440 lamports pour un compte SPL de 165 octets et 1 513 840 lamports pour l'ATA Token-2022 de 170 octets, mais recommande de demander la valeur actuelle par RPC plutôt que de la coder en dur. À 0,05 SOL, 0,00148844 SOL représente environ 2,98 % du montant de position temporairement immobilisé.
La fermeture `CloseAccount` transfère les lamports vers une destination choisie et exige un solde token nul ; le payeur de la création ne reçoit pas automatiquement le remboursement. Un compte gelé vide peut encore être fermé. Les extensions Token-2022 peuvent ajouter des conditions de fermeture.

**Correction candidate PAPER**
Ajouter des métriques distinctes :
- dépôt ATA estimé / réel par taille de compte ;
- capital immobilisé par compte ouvert ;
- montant récupérable après clôture ;
- dépôt non récupéré seulement si une condition de fermeture réelle l'empêche ;
- frais et délais de transactions de fermeture.
Ne pas comptabiliser d'emblée le dépôt ATA comme une perte PnL permanente.

**Jupiter**
Une migration Swap V2 peut être étudiée dans un adaptateur séparé, mais pas nécessairement en premier correctif : le bot PAPER dispose déjà de devis Jupiter, et changer de version peut modifier les routes et résultats. Avant migration, comparer les réponses sur un échantillon et préserver un repli contrôlé. Ne pas modifier le chemin LIVE dans cette refonte.

### 4.7 Profil de sortie

Le code distingue correctement deux comportements :
- PAPER : TP1 +40 %, fraction 30 %, sorties ATR, plancher et stagnation ;
- LIVE legacy : TP1 50 %, paramètres historiques, fonction `decide_legacy`.

Le profil théorique « TP1 25 % à +50 %, runner 75 %, SL -25 % » peut être ajouté comme profil de comparaison dans le backtest, mais pas sélectionné comme nouveau défaut tant que le Walk-Forward n'a pas assez de trades hors échantillon et que les coûts n'ont pas été enrichis.

## 5. Plan de correction recommandé — ordre de priorité

| Priorité | Action | Pourquoi | Prérequis |
|---|---|---|---|
| P0 | Ajouter tests fixtures PumpSwap : migration brûlée vs pool directe vs LP additionnelle | Protéger l'anti-rug avant d'ajuster la logique LP | Fixtures on-chain / IDL officiel |
| P1 | Ajouter prise en charge facultative de `COPYTOP_API_KEY` et instrumentation par endpoint | Corriger le dépassement de lectures lourdes et rendre les échecs mesurables | Secret gratuit créé et ajouté par l'utilisateur pour bénéficier du quota relevé |
| P1 | Corriger l'injection des secrets RPC dans le workflow PAPER + métriques crédits | Activer CreatorHistory sans secret dans le code | Helius URL stockée comme GitHub Secret |
| P1 | Comparer STRICT et PAPER_FAST dans une expérience isolée / replay | Mesurer la sélectivité sans baisser les sécurités | Données M5 historiques complètes |
| P2 | Modéliser séparément le dépôt ATA immobilisé et son remboursement | Donner le coût de trésorerie exact à 0,05 SOL | Taille de compte, token program, résultat de clôture |
| P2 | Ajouter délais/échecs de remplissage et scénarios de stress au PAPER | Éviter d'assimiler un devis à un fill garanti | Mesures d'exécution / hypothèses explicites |
| P3 | Tester un profil de sortie convexe dans le Walk-Forward | Valider la convexité avant tout changement de défaut | Au moins 70 trades clôturés ; >100 préférables |
| P3 | Comparer Swap v1 quote / Swap V2 order | Évaluer l'impact des routes actuelles vs nouvel agrégateur | Fixtures et tests de non-régression |

## 6. Garde-fous maintenus

- `EXECUTION_MODE=PAPER` dans le workflow d'essai.
- Aucun ajout de wallet ou de clé privée.
- Aucun ordre LIVE, aucune modification du live executor, aucun changement au chemin de signature/envoi.
- Aucune baisse des seuils de liquidité, LP, concentration, impact, roundtrip, autorités, insiders ou honeypot sans preuve et tests.
- Aucune fusion automatique dans `main`.
- Toute modification future doit inclure tests de non-régression et note de migration.

## 7. Sources techniques externes consultées

- Pump public docs — migration bonding curve vers PumpSwap et burn des LP : https://github.com/pump-fun/pump-public-docs/blob/main/docs/PUMP_PROGRAM_README.md
- copy.top — quotas officiels, 6 lectures lourdes/min sans clé ; 30/min avec clé gratuite ; Bearer auth : https://copy.top/docs/keys-limits-pricing
- Solana — dépôt de stockage / minimum exempt de rent, tailles SPL et Token-2022, recommandation RPC : https://solana.com/developers/docs/core/rent
- Solana — CloseAccount, destination des lamports, compte vide gelé, extensions Token-2022 : https://solana.com/docs/tokens/basics/close-account
- Helius — quotas Free (1M crédits/mois, 10 RPS) et crédits RPC : https://www.helius.dev/fr/pricing ; https://www.helius.dev/solana-rpc-nodes
- Jupiter — documentation Swap API v2 : https://developers.jup.ag/docs/swap

## 8. Conclusion d'audit

Le plus gros levier immédiatement prouvé n'est pas de retirer des filtres anti-rug : c'est de corriger le respect des quotas copy.top, de rendre le diagnostic des rejets plus précis et de tester proprement les deux politiques d'âge déjà présentes. Le faux rejet LP PumpSwap est un candidat important, mais demande une preuve on-chain forte avant toute exception au seuil de 90 %.

Le prochain lot de code devrait commencer par les tests de migration/LP et l'authentification facultative copy.top. L'activation Helius dépend de la présence d'un secret utilisateur dans GitHub Actions. Les changements de sortie et le modèle ATA viennent ensuite. Tant que ces tests et données ne sont pas disponibles, la rentabilité reste **non démontrée**.
