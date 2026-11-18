---
name: sound-design-local
description: Crée la nappe musicale et les bruitages 100 % procéduraux (sans droits tiers) puis mixe voix + nappe + sfx avec ducking et normalisation -14 LUFS.
---
# Son local

1. `~/venv/bin/python pipeline/sound.py episodes/<slug>` → `music_bed.wav`, `sfx.wav` (whoosh aux changements de scène, impact sur FactReveal/PoolDive). Adapter `chords` dans sound.py à l'humeur du morceau (jamais imiter le morceau ou un artiste).
2. `pipeline/mix.sh episodes/<slug>` → `mix.wav` sans musique commerciale.
3. Seulement si l'utilisateur fournit un fichier sous licence : `pipeline/mix.sh episodes/<slug> licence.wav` → `mix_licensed.wav` (ducking sidechain). Ne jamais télécharger un morceau depuis YouTube/Spotify.
