---
name: episode-pipeline
description: Agent chef d'orchestre de L'Envers du Son. Enchaîne music-hunter → song-research → music-story-script → [validation humaine] → voice-local → sound-design-local → remotion-music-explainer → episode-qc → package publication. Usage : /episode-pipeline <titre - artiste> ou /episode-pipeline auto.
---
# Pipeline d'épisode

Coût cible : 0 € (aucun appel payant ; `ALLOW_PAID=false`).

1. Sujet : argument donné, ou `auto` → skill `music-hunter`, prendre la recommandation n°1.
2. `song-research` → research.md / sources.md.
3. `music-story-script` → script.json + hooks.md.
4. **STOP** : présenter script + affirmations↔sources ; attendre la validation (fichier `episodes/<slug>/APPROVED` ou accord explicite). En exécution planifiée : s'arrêter ici et pousser sur la branche.
5. `voice-local`, `sound-design-local`, `remotion-music-explainer`.
6. `episode-qc` jusqu'à zéro défaut.
7. Package `episodes/<slug>/out/` : MP4 sans musique commerciale, SRT, `publish.md` (titre, description avec sources, 3–5 hashtags, rappel : ajouter le son officiel dans l'appli TikTok).
8. `production-log.md` : temps par étape, défauts, coût (0 €).
Jamais de publication automatique.

## Styles d'animation disponibles (choisir selon le sujet, ne pas répéter le même style d'un épisode à l'autre)
- **Remotion « Vinyl Motion »** (`pipeline/run_episode.sh`) : scènes flat colorées, transitions Bang Motion en profondeur — sujets pop/rap/fête.
- **Bang Motion « carnet de croquis vintage »** (`pipeline/run_episode_html.sh`, `pipeline/bang_sketch.py`) : papier sépia, gravures SVG, caméra kolase, push-through — histoire, biographie, morceaux anciens (pilote : « Time », Pink Floyd).
- Autres styles Bang Motion à adapter : jurnalisme (fond noir, photos libres de droits), katalog (fond blanc, découpes), kartun panggung, aksi kontinu — voir `.claude/skills/bang-motion/references/explainer.md`.

## Le vrai morceau derrière la vidéo
Jamais extrait de YouTube/Spotify. Deux voies légales : (1) publier `*_voix-seule.mp4` et ajouter le son officiel dans l'appli TikTok ; (2) fichier sous licence dans `episodes/<slug>/music/licence.*` → calage automatique des coupes sur ses temps (`pipeline/licensed_beats.py`, analyse locale video-gif-studio) + ducking.
