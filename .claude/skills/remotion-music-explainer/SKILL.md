---
name: remotion-music-explainer
description: Construit et rend la vidéo Remotion 1080x1920 30 fps « Vinyl Motion Explainer » à partir de script.json + timeline.json + mix.wav.
---
# Remotion Music Explainer

- Projet : `video/`. Composants : `src/components/primitives.tsx` (KineticWord, VinylRecord, WaveformVisualizer, Person, Glass, Chip), scènes : `src/scenes/scenes.tsx`, montage : `src/Episode.tsx` (narration = horloge, sous-titres 3 mots, barre de progression).
- Préparer : `mkdir -p video/public/<slug> && cp episodes/<slug>/script.json episodes/<slug>/build/{timeline.json,mix.wav} video/public/<slug>/`.
- Nouvelles métaphores : créer des scènes spécifiques au morceau, ajoutées à `SCENES`. Illustrations SVG originales uniquement (pas de pochettes, photos, logos).
- Synchronisation : `wordTime(seg, 'mot')` donne l'instant où le mot est prononcé.
- Contrôle rapide : `npx remotion still src/index.ts Episode out/f.png --frame=N --props='{"slug":"<slug>","audio":"<slug>/mix.wav"}'`.
- Rendu : `npx remotion render src/index.ts Episode ../episodes/<slug>/out/<slug>_tiktok.mp4 --codec=h264 --audio-codec=aac --props=...`.
- Chrome : `REMOTION_CHROME=<chemin>` si le navigateur intégré ne se télécharge pas.
- Licence Remotion : gratuite pour particuliers et entreprises ≤ 3 personnes.
