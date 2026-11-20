# Moteur de motion design multi-univers

Ce moteur produit des clips TikTok musicaux : 1080×1920, 30 i/s, H.264.
Il choisit un univers graphique pour chaque phrase en fonction de son sens.
Tout tourne en local, avec des outils gratuits et sans aucune API payante.

## Architecture : le moteur existant, étendu

Le dépôt avait déjà un moteur qui fonctionne : SVG et HTML rendus image par image dans Chromium headless (Playwright), puis encodés avec FFmpeg. La consigne est de conserver l'existant et de s'adapter à son architecture.

Ce moteur a donc été **étendu** plutôt que remplacé par Remotion. Remotion aurait demandé de réécrire tous les clips déjà produits, et sa licence est payante pour les entreprises de plus de 3 personnes. La 3D utilise **Three.js** (licence MIT), embarqué dans le dépôt (`vendor/three.min.js`, r149). Aucun téléchargement n'est nécessaire au rendu.

Le tableau ci-dessous fait correspondre chaque module demandé au fichier réel.

| Module demandé | Fichier réel |
|---|---|
| `/scenes/CinematicScene` (A) | `engine/scenes/CinematicScene.js` : `cinematic.spotlight_crowd`, `cinematic.duo_night` |
| `/scenes/EditorialScene` (B) | `engine/scenes/EditorialScene.js` : `editorial.chart` |
| `/scenes/CartoonScene` (C) | `engine/scenes/CartoonScene.js` : `cartoon.dig` |
| `/scenes/NeonScene` (D) | `engine/scenes/NeonScene.js` : `neon.live`, `neon.reject` |
| `/scenes/LowPolyScene` (E) | `engine/scenes/LowPolyScene.js` : `lowpoly.night_drive` |
| `/scenes/RetroScene` (F) | `engine/scenes/RetroScene.js` : `retro.toy` |
| `/scenes/PastelScene` (G) | `engine/scenes/PastelScene.js` : `pastel.storm` |
| `/scenes/VoxelScene` (H) | `engine/scenes/VoxelScene.js` : `voxel.red_carpet` |
| `Character` | 2D : `E.flat`, `E.person`, `E.figure` (`engine.js`). 3D : `K3.human`, `K3.voxelHuman` (`components/three3d.js`). Ils marchent, courent, regardent autour d'eux, se retournent et font des gestes. |
| `KineticText` | `engine.js` (typographie cinétique). Apparitions : pop, rise, drop, slide, blur, stamp, type, split, mask, drift, line, **bounce, zoomin, swing, warp, flip, build**. Mises en valeur : grow, late, shake, pulse, slidein, drop, reveal, glow, scramble, breathe, shrink, **colorshift, outline, wave, jelly, highlight**. Le bloc peut être mis en perspective (`typo.perspective`). |
| `CameraMotion` | 2D : `S.camera` (dolly, zoom, travelling, rotation, tremblement, caméra portée, parallaxe par profondeur de calque). 3D : `X.camMove` (dolly, truck, pan, tilt, orbit, crane, follow, static, zoom cinématique par la focale). |
| `ParticleSystem` | `E.particles`, `E.dust`, `E.rain`, `E.snow`, `E.fireflies`, `E.bokeh`, `E.splashes`. En 3D : `THREE.Points` (poussière dans la lumière, confettis). |
| `LightEffects` | `E.spotlight`, `E.blindsLight`, `E.flare`, `E.lightLeak`, `E.rays`, liseré `rim`. En 3D : `K3.volumetric` (cône volumétrique et SpotLight avec ombres), `K3.backdrop` (contre-jour). |
| `Transitions` | `engine.js` : cut, fade, dip, flash, wipe, diagonal, iris, ink, shape, blinds, push, slide, zoom, spin, whip, glitch, bar, radial, tear, slices, dots. Elles fonctionnent aussi sur les scènes 3D. |
| `SceneDirector`, `VisualStyleSelector`, `Timeline` | `scripts/director.py` |
| `AudioSync` | `scripts/audio_analyze.py` (pulsations et tempo), `scripts/tiktok_sound_match.py` (mots horodatés dans le son, Whisper local), `S.beat(t)` |
| `video.config` / `styles.config` | `config/defaults.json`, `config/styles.json` (8 univers : lexique, couleurs, typographies, transitions) |
| Zones de sécurité | `SAFE` (x 70 → 900, y 230 → 1440), recalage automatique du texte, et `scripts/framing.py` (sujets coupés, cachés par le texte ou sous l'interface TikTok) |

### Intégration de la 3D

`CLIP.three(S, opts)` crée une scène Three.js. Un seul `WebGLRenderer` est partagé. Chaque scène 3D recopie son image dans un `<canvas>` placé dans un `<foreignObject>` du SVG. Les scènes 3D restent ainsi compatibles avec tout le reste : masques des transitions, flous, calques 2D par-dessus, grain et contrôle du cadrage.

Dans le conteneur, Chromium est lancé avec SwiftShader, une implémentation WebGL logicielle : aucune carte graphique n'est nécessaire.

## Installation (une fois)

```bash
# Python : reconnaissance vocale locale (calage sur un son TikTok) et analyse audio
pip install faster-whisper numpy pillow
# Node : Playwright et son Chromium (déjà présents dans l'environnement cloud)
npm i -g playwright && npx playwright install chromium
# FFmpeg (déjà présent dans l'environnement cloud)
sudo apt-get install -y ffmpeg
```

Three.js n'a pas besoin d'être installé : il est déjà dans le dépôt (`vendor/three.min.js`).

## Production d'un clip, de bout en bout

```bash
S=.claude/skills/clip-tiktok/scripts; P=clips/mon-clip; mkdir -p $P/work
cp <son_tiktok.mp4> $P/work/tiktok_sound_source.mp4
python3 $S/lyrics_fetch.py --artist "PNL" --title "Différents" --out $P/work            # paroles synchronisées (LRCLIB)
python3 $S/tiktok_sound_match.py $P/work/tiktok_sound_source.mp4 --lyrics $P/work/lyrics.json --out $P/work --model medium
python3 $S/audio_analyze.py $P/work/tiktok_sound_source.mp4 --out $P/work               # pulsations / tempo
python3 $S/director.py --lyrics $P/work/lyrics_sound.json --audio $P/work/audio.json \
        --duration 23.9 --out $P/storyboard.json --lyrics-out $P/work/lyrics_sound_scenes.json   # direction artistique automatique
node $S/render.mjs --project $P --scene-stills        # une image par scène, pour vérifier
bash $S/produce.sh $P                                  # polices → validation → rendu MP4 → cadrage → QA → livrables
```

- **Export MP4 seul** : `node $S/render.mjs --project $P`. Le fichier produit est `video_finale.mp4` (H.264, CRF 20, 30 i/s, sans audio).
- **Aperçu rapide** : `node $S/render.mjs --project $P --preview`.
- **Aperçu avec le son** (fichier local, jamais commité) :

  ```bash
  ffmpeg -i $P/video_finale.mp4 -i $P/work/tiktok_sound_source.mp4 -map 0:v -map 1:a -c:v copy -c:a aac -shortest $P/apercu_avec_son_tiktok.mp4
  ```

Le storyboard généré reste éditable : univers, gabarit, paramètres, typographie et transitions de chaque scène. Un `scenes.js` peut toujours remplacer une scène par une mise en scène écrite à la main, avec le même identifiant.

## Tests

```bash
bash .claude/skills/clip-tiktok/tests/selftest.sh
```

Ce test vérifie :
- le rendu des 10 gabarits et des transitions, y compris la 3D ;
- l'absence d'image vide ;
- le contrôle du cadrage ;
- que le directeur choisit au moins 4 univers sur des paroles d'exemple ;
- que le storyboard produit par le directeur est valide.

## Limites connues

- **Directeur** : il sélectionne les univers par **lexique pondéré**, pas par un modèle de langue. Il repère bien les thèmes explicites (argent, voiture, réseaux, amour, solitude, douleur, réussite, humour), mais pas l'ironie ni les métaphores subtiles. Il faut relire le storyboard (5 minutes) et le corriger si besoin.
- **Gabarits** : il y a 10 gabarits pour 8 univers. Une même catégorie revient donc avec la même mise en scène, paramétrée différemment. Pour un clip long, il faut ajouter des gabarits (chacun fait environ 100 lignes).
- **Durée** : la durée d'un clip est celle du son fourni. Pour la démo PNL, le son contient 23,9 s de musique (le reste de la vidéo est le générique TikTok, sans musique). La démo dure donc 23,9 s et non 30 à 40 s.
- **Vitesse de rendu** : la 3D logicielle (SwiftShader) est lente, environ 0,3 à 1 s par image selon la scène et le nombre de processus de rendu. Sur un PC avec carte graphique, le même code est beaucoup plus rapide.
- **Emojis** : ils sont dessinés en vectoriel (aucune police emoji n'est disponible dans le conteneur).
- **Interface sociale** : les bulles de commentaires ne contiennent que des icônes et des barres, jamais de texte inventé.
