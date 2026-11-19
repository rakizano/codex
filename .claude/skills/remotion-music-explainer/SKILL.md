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

## Règles Bang Motion appliquées (skill `.claude/skills/bang-motion`, MIT) — obligatoires pour chaque nouvelle vidéo
Lire `bang-motion/references/anti-ppt.md` et `techniques.md` §3b/§4c avant de concevoir les scènes. Traduction Remotion :
- **Transitions** : menu `TRANSITIONS` dans `src/Episode.tsx` (push-through, carte rotateY 3D, rack focus, whip flouté, light leak, vinyle épais qui traverse l'objectif). ≥ 2 types, ≥ 1 avec profondeur, objet-wipe ≤ 2, jamais deux fois de suite, **jamais de bloc de couleur plat qui balaie**. Changer l'ordre d'un épisode à l'autre.
- **Entrée/sortie asymétriques** : `SceneShell` — entrée 0,8 s power4.out, sortie 0,45 s power2.in, qui se chevauchent.
- **Plans de caméra** : `<Camera shots={[{at, s, x, y, dur}]}>` — gros plan / plan moyen / large vers l'élément qui raconte ; le texte apparaît après l'arrivée de la caméra ; jamais de texte coupé au bord ni sous les sous-titres (vérifier la planche-contact).
- **Typographie** : casse de phrase (pas de MAJUSCULES forcées), poids fort sur les mots, tailles et positions variées, pas de point final automatique.
- **Coupes calées sur le beat** : `beats.json/cuts` (beat original) ou `pipeline/licensed_beats.py` (morceau sous licence, analyse locale video-gif-studio).
- Test final « anti-PPT » : une image peut-elle devenir une slide corporate sans modification ? → refaire.
