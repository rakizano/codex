---
name: music-hunter
description: Scanne les classements PUBLICS et gratuits (TikTok Creative Center, Kworb, Shazam, Spotify Charts, Tokchart public) pour FR/US/GB, enregistre un relevé daté, puis produit le rapport Music Hunter (top FR, top US, crossovers, 3 recommandations, à surveiller). À utiliser pour « scan », « quelles musiques montent », « trouve un sujet ».
---
# Music Hunter (gratuit)

Aucun service payant. Pas de scraping massif, pas d'API privée, pas de contournement.

1. Lire `config/watchlist.json` (artistes à surveiller, ce n'est pas une preuve de tendance).
2. Pour chaque marché FR, US, GB, collecter avec WebSearch/WebFetch :
   - TikTok Creative Center → Trends → Songs (pays, 7 jours) : titre, artiste, rang ;
   - Kworb (Spotify daily par pays), Shazam Top 200 pays, Tokchart pages publiques.
   Si une page n'est pas accessible, l'écrire dans le rapport et demander un relevé manuel à l'utilisateur (méthode : `episodes/_template/tiktok-usage.md`).
3. Écrire `music-hunter/data/inbox/AAAA-MM-JJ.csv` (colonnes de `hunter.py`), **uniquement avec des valeurs lues**. Colonne `source_url` obligatoire.
4. `python3 music-hunter/hunter.py ingest <csv>` puis `python3 music-hunter/hunter.py report`.
5. Story Hunter : pour 3–5 morceaux (watchlist + classements), évaluer le décalage usage/histoire et mettre à jour `config/stories.json` (narrative 0–25, sources 0–10, angle) — avec `song-research` si besoin.
6. Relancer `report`, présenter le rapport : données brutes, dates, pays, limites. Étiqueter « tendance émergente » ou « evergreen / décalage ».

Interdit : inventer un rang, un nombre de vidéos ou un usage. Le score n'est jamais une prédiction de vues.
