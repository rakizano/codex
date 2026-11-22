# Prompt 1 — Génération de l'architecture du bot (OpenCode, Cline, Aider ou Claude Code)

Tu es un ingénieur Python/Solana senior spécialisé en sécurité DeFi.
Étends ce dépôt (base existante : `src/memecoin/`, `scripts/fetch_token_audit.py`, `tests/`)
en un bot modulaire d'audit et de paper-trading pour meme coins Solana reposant uniquement
sur des APIs gratuites, sans aucune clé privée exposée ni signature réelle par défaut.

Exigences techniques :
1. Clients API asynchrones (httpx) avec rate-limiting local (token bucket + backoff
   exponentiel sur HTTP 429) :
   - DexScreener : <= 60 req/min (profils/boosts), <= 300 req/min (paires).
   - GeckoTerminal : <= 10 req/min, cache SQLite local de 60 s.
   - RugCheck API publique : autorités et distribution des détenteurs.
   - Jupiter (lite-api.jup.ag, /swap/v1/quote UNIQUEMENT) : devis aller-retour
     0,5 SOL -> jeton -> SOL pour mesurer l'impact prix et détecter les honeypots.
   - RPC Solana : variable HELIUS_RPC_URL (10 RPS max), bascule sur CHAINSTACK_RPC_URL.
2. Sécurité & MEV (préparation d'architecture) :
   - Mode par défaut strict : EXECUTION_MODE=PAPER (journalisation SQLite uniquement).
   - Module constructeur de transaction INACTIF en mode PAPER, qui devra :
     a) plafonner le slippage à 300 bps ;
     b) ajouter un compte read-only non signataire préfixé `jitodontfront` ;
     c) imposer simulateTransaction avant soumission + coupe-circuit de perte journalière.
   - Interdire toute journalisation ou transmission de clé privée vers un LLM.
   - Réutiliser `src/memecoin/filters.py` comme unique autorité de rejet (fail-closed).
3. Arborescence : `src/config.py`, `src/fetchers/`, `src/filters/rug_detector.py`
   (ou réutilisation de filters.py), `src/paper_trader.py` (PnL net avec ~1 % de frais et
   slippage mesuré), `tests/` (mocks : honeypot, injection de prompt dans le nom du jeton).

Propose d'abord le plan détaillé des modules et attends ma validation avant de générer les fichiers.
