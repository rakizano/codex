# Plan de refonte PAPER isolee — GPT

> Branche : `gpt/refonte-paper-isolee`
> Base : `main`
> Statut : plan de travail uniquement — aucun code de trading modifie.
> Objectif : auditer puis corriger les blocages PAPER sans perturber le travail de Claude.

## 1. Regles d'isolation et de collaboration

- Ne jamais pousser de modification directement sur `main`.
- Ne pas modifier la branche de Claude `claude/meme-coin-trading-bot-yns7r5` ni ses branches.
- Travailler exclusivement sur `gpt/refonte-paper-isolee`.
- Avant toute modification de code, comparer l'etat de `main`, de cette branche et des branches actives de Claude.
- Eviter les fichiers modifies par Claude ; si un chevauchement est necessaire, documenter le conflit potentiel et attendre une coordination.
- Chaque changement doit etre petit, justifie, couvert par des tests et rattache a un commit explicite.
- Ne jamais fusionner automatiquement cette branche dans `main`.
- PAPER uniquement : aucun wallet, aucune cle privee, aucun ordre LIVE, aucune activation de LIVE.
- Ne jamais assouplir un garde-fou anti-rug simplement pour augmenter le nombre d'entrees.

## 2. Contexte technique connu a revalider

Le rapport PAPER du 25 novembre 2026 indique 479 decisions sur 29 h 10, 444 rejets d'audit, 35 rejets momentum et aucune entree. Ces chiffres sont des observations historiques et devront etre revalides sur les journaux les plus recents.

Le rapport `docs/REFONTE.md` signale notamment :
- la migration Pump.fun / PumpSwap et le classement de liquidite ;
- des filtres de velocite M5 et une politique d'age STRICT / PAPER_FAST ;
- une admissibilite copy.top restrictive (8 traders admissibles sur 55 dans l'observation documentee) ;
- le controle des createurs serie ls en attente d'un RPC configure ;
- un Walk-Forward avec verdict `INSUFFICIENT_EVIDENCE` faute de donnees suffisantes ;
- une rentabilite non demontree.

Les explications du diagnostic utilisateur (LP brulees interpretees comme non verrouillees, cache RugCheck, contradiction age/M5, timeouts copy.top, rente ATA et modele de couts) sont des hypotheses a verifier dans le code et les donnees. Elles ne sont pas considerees comme des causes etablies avant reproduction.

## 3. Phase A — Audit en lecture seule

1. Relever le HEAD et l'etat des branches `main`, `claude/*` et `gpt/*`.
2. Lire les modules d'entree, d'audit anti-rug, de migration, copy.top, RPC, PaperTrader, frais et backtest.
3. Rapprocher chaque motif de rejet des conditions exactes du code et des donnees brutes.
4. Reproduire les cas Pump.fun gradues / pools PumpSwap et les cas de pools directes PumpSwap.
5. Verifier les contrats API et les limites effectives sans exposer de secrets.
6. Produire une matrice : probleme confirme / hypothese / non confirme, preuve, fichier concerne, test de regression propose.

**Livrable :** rapport d'audit avant toute modification fonctionnelle.

## 4. Phase B — Corrections techniques candidates

Les changements suivants ne seront implementes qu'apres confirmation par l'audit :

### B1. Liquidite et LP PumpSwap
- Distinguer migration Pump.fun authentifiee et pool PumpSwap creee directement.
- Pour une migration authentifiee, verifier les comptes et soldes LP on-chain ; ne pas assimiler un locker tiers absent a une LP retiree.
- Pour une pool directe ou une liquidite ajoutee ensuite, exiger une preuve on-chain de destruction ou de verrouillage.
- Maintenir le rejet si la preuve est absente, ambigue ou incoherente.
- Ne neutraliser une alerte RugCheck que si l'origine de cette alerte est isolee et que les autres risques restent controles.

### B2. Top holders et insiders
- Verifier que les reserves AMM, comptes techniques et adresses de burn sont identifies avec certitude.
- Ne jamais exclure un compte simplement sur son nom ou une supposition.
- Conserver un plafond strict sur la concentration des portefeuilles prives.
- Conserver les controles d'autorites, de transferts coordonnes et de wash trading.

### B3. Age et velocite
- Examiner si les filtres STRICT et PAPER_FAST sont coherents avec les fenetres M5/H1.
- Si deux cohortes sont justifiees par les donnees, les separer explicitement (nouveaux lancements / post-migration consolides).
- Ne pas reduire l'age minimum ou les seuils de momentum sans tests et mesures de risque.

### B4. copy.top et Helius
- Reproduire les timeouts, 429 et 503 ; verifier les endpoints, quotas et fenetres de cache actuels.
- Ajouter ou corriger timeouts, backoff, respect de Retry-After, cadence et cache si necessaire.
- Placer le controle du createur en aval, avec cache par adresse, seulement si le budget RPC et la qualite des donnees le permettent.
- Une donnee indisponible sur un controle critique ne doit pas etre traitee comme une validation positive.

### B5. Simulation des couts
- Auditer les frais AMM, impact de prix, slippage, priorite, echec d'execution et couts de fermeture ATA.
- Utiliser des devis de sortie realistes ou des hypotheses de stress documentees.
- Distinguer rente ATA recuperable, immobilisee et potentiellement perdue ; ne pas comptabiliser une recuperation garantie.
- Ne pas changer la strategie de sortie avant d'avoir un modele de couts valide.

## 5. Phase C — Validation

- Ajouter des tests de regression pour chaque bug confirme.
- Executer toute la suite de tests et comparer les resultats a la base.
- Verifier explicitement qu'aucun endpoint d'ordre LIVE n'est appele.
- Lancer une campagne PAPER isolee de 48 a 72 heures si l'environnement Actions et les permissions le permettent.
- Suivre : volume de candidats, motifs de rejet, entrees, sorties, couts, erreurs HTTP, consommation RPC et faux positifs.
- Ne pas viser artificiellement 5 a 15 entrees par jour : ce chiffre est un indicateur a observer, pas un objectif qui justifie d'assouplir les filtres.
- Ne pas conclure a une rentabilite sur quelques trades ; exiger un echantillon hors echantillon suffisant et un Walk-Forward valide.

## 6. Critere de sortie et integration

Un changement est pret a etre propose seulement si :
- le probleme est reproduit et sa cause identifiee ;
- les tests de regression passent ;
- les protections anti-rug ne sont pas affaiblies ;
- le mode PAPER est confirme ;
- le diff est limite et explique ;
- les interactions avec les branches de Claude ont ete verifiees.

Les changements seront presentes dans une Pull Request vers `main`, sans fusion automatique. La decision de fusion reste a l'utilisateur.

## 7. Etat actuel

- [x] Branche isolee creee depuis `main`.
- [x] Plan de travail ajoute a cette branche.
- [ ] Audit detaille du code.
- [ ] Reproduction des faux rejets et des timeouts.
- [ ] Corrections confirmees.
- [ ] Tests et campagne PAPER.
- [ ] Pull Request soumise pour revue.

**A ce stade, seul ce document de plan a ete ajoute. Aucun fichier source, configuration, secret, workflow ou parametre de trading n'a ete modifie.**
