# Studio de motion design musical, construit sur HyperFrames

**HyperFrames** (v0.9.72, Apache-2.0) est le moteur central de ce studio : il gère la composition, la timeline, la prévisualisation, les contrôles et le rendu MP4. Le studio y ajoute :
- une typographie cinétique physique ;
- des personnages 2D et 3D animés ;
- des caméras et des transitions ;
- un Visual Director, qui transforme paroles et musique en storyboard ;
- un compilateur, qui transforme le storyboard en compositions HyperFrames ;
- une interface de pilotage.

Tout fonctionne en local et gratuitement : GSAP 3.14 (plugins libres), Three.js r149, SVG, Canvas, FFmpeg, Python et numpy. Aucune API payante n'est nécessaire.

## Architecture, adaptée aux conventions HyperFrames

| Demandé | Réel (conventions HyperFrames) |
|---|---|
| `/compositions/MainComposition.html` | `index.html` (composition racine générée) + `compositions/sNN.html` (une sous-composition par scène, dans `<template>`) |
| `engine/VisualDirector`, `SceneDirector`, `Timeline` | `tools/visual_director.py` (sens, émotions, objets, actions, intensité, impacts → storyboard, découpage, timeline calée sur les temps) |
| `engine/AudioAnalyzer`, `AudioSync` | `tools/audio_analyzer.py` (BPM, temps, kicks, impacts forts, snares, transitoires, basse, silences, montées + analyse officielle `hyperframes audio`) ; `HFS.audio.pulse()` côté scènes |
| `engine/AnimationEngine` | `assets/lib/hfs/core.js` : chaque scène = UNE timeline GSAP en pause, un tween « horloge » appelle des fonctions de rendu pures de t (déterministe, recherche d'image dans n'importe quel ordre) |
| `engine/TransitionEngine`, `transitions/*` | `assets/lib/hfs/stage.js` (`HFS.transitions`) + `config/transition-presets.json` (15 transitions out + in) + chevauchement des hôtes dans `tools/build.py` |
| `typography/KineticText`, `FallingText`, `ImpactText`, `MorphingText`, `TextPresets` | `assets/lib/hfs/kinetic.js` : 33 entrées, 10 mises en valeur, 11 sorties, combinables ; `config/animation-presets.json` (35 préréglages nommés) |
| `typography/Typography3D` | CSS 3D (`materialize3D`, relief `extrude`) + vraies lettres extrudées Three.js (`HFS.K3.text3D`, police embarquée) |
| `characters/*` | `assets/lib/hfs/characters.js` (2D articulé : marche, course, saut, danse, salut, attraper, tenir, demi-tour, assis ; styles flat / silhouette / cartoon / sketch ; vêtement qui flotte, ombre) + `HFS.K3.human` / `voxelHuman` (3D) |
| `camera/*` | `HFS.camera` 2D (15 préréglages, parallaxe par profondeur, flou de mise au point, suivi, caméra portée) + `X.camMove` 3D (dolly, truck, crane, pan, tilt, orbit, follow, fpv, focale) |
| `effects/*` | `HFS.fx` (particules : poussière, étincelles, confettis, pluie, neige, bokeh, billets ; rayons ; trait « vivant » 12 i/s) + lumière volumétrique 3D |
| `scenes/SceneLibrary`, `SceneTemplates` | `config/visual-presets.json` (sens que chaque scène sait raconter) + `templates/*.html` (10 scènes : city3d, cartoon_dig, editorial, ink_storm, room_phone, phone_ui, stage3d_name, night_drive, social_reject, duo_walk) |
| `config/project.json`, `animation-presets.json`, `visual-presets.json` | `config/` (même noms) + `transition-presets.json`, `audio.json` |
| Interface | `tools/studio_server.mjs` + `ui/index.html` |

## Commandes

Prérequis : Node.js ≥ 22, FFmpeg, Python 3 avec numpy. La première commande `npx` télécharge HyperFrames.

```bash
cd studio
export DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1   # pas de télémétrie
python3 tools/audio_analyzer.py assets/audio/sound.m4a --out config/audio.json --hf   # analyse musicale
python3 tools/visual_director.py --duration 23.9          # paroles (input/lyrics_sound.json) → storyboard.json
python3 tools/build.py                                   # storyboard.json → index.html + compositions/
npx --yes hyperframes@0.9.72 check                      # lint + exécution + mise en page + contraste
npx --yes hyperframes@0.9.72 snapshot --at 1,5,12       # images exactes à ces instants
npx --yes hyperframes@0.9.72 preview                    # Studio HyperFrames (navigateur)
npx --yes hyperframes@0.9.72 render --quality delivery -o renders/clip.mp4   # export MP4 H.264
node tools/studio_server.mjs --port 4321                # interface de pilotage → http://localhost:4321
```

Les paroles calées mot à mot viennent de `.claude/skills/clip-tiktok/scripts/tiktok_sound_match.py`. Cet outil prend les paroles LRCLIB et les cale sur les mots réellement entendus dans le son, grâce à Whisper en local.

## Limites connues

- **Visual Director** : il comprend le sens par lexique pondéré, pas par un modèle de langue. Il choisit l'interprétation symbolique quand deux idées sont proches. Il ne comprend ni l'ironie ni les métaphores non listées. Le storyboard reste modifiable dans l'interface ou dans le JSON.
- **Gabarits de scène** : il y en a 10. Une autre musique réutilisera ces 10 mondes, paramétrés différemment, tant que de nouveaux gabarits ne sont pas écrits (un fichier HTML chacun).
- **Personnages** : ils sont procéduraux (2D articulés, 3D en capsules ou en voxels). Il n'y a pas de modèles riggés importés.
- **Rendu** : la 3D se calcule en logiciel dans le conteneur (SwiftShader), c'est donc plus lent que sur une machine avec carte graphique.
- **Musique** : le son fourni ne contient que 23,9 s de musique. La démo dure donc 23,9 s et non 30 à 40 s.
