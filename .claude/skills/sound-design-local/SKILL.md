---
name: sound-design-local
description: Crée la nappe musicale et les bruitages 100 % procéduraux (sans droits tiers) puis mixe voix + nappe + sfx avec ducking et normalisation -14 LUFS.
---
# Son local

1. `~/venv/bin/python pipeline/sound.py episodes/<slug>` → beat original arrangé selon le récit (`music_bed.wav`), bruitages par scène (`sfx.wav`), `beats.json` pour les animations. Régler `music` dans script.json (bpm, swing, root, progression) et `music_break` / `pause_before` par segment. Jamais imiter le morceau raconté ni un artiste.
2. `pipeline/mix.sh episodes/<slug>` → `mix.wav` (beat original) + `mix_voice_only.wav` (pour le son officiel TikTok).
3. Seulement si l'utilisateur fournit un fichier sous licence : `pipeline/mix.sh episodes/<slug> licence.wav` → `mix_licensed.wav` (ducking sidechain). Ne jamais télécharger un morceau depuis YouTube/Spotify.
