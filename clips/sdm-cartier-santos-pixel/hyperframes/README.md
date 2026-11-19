# Finition HyperFrames du clip pixel art

Projet [HyperFrames](https://github.com/heygen-com/hyperframes) (Apache-2.0) qui reprend `../video_finale.mp4`
et ajoute deux blocs du catalogue HyperFrames :
- `yt-screen-warp` : la vidéo « lue sur un écran » (scanlines, grille de pixels, vignette, reflet, léger bombement) ;
- `grid-pixelate-wipe` : grille de pixels 9×16 qui révèle l'image au début et la recouvre à la fin.

Rendu (depuis ce dossier, Node ≥ 22 + FFmpeg) :
```bash
cp ../video_finale.mp4 assets/sdm_pixel.mp4
export DO_NOT_TRACK=1 HYPERFRAMES_NO_TELEMETRY=1 HYPERFRAMES_NO_UPDATE_CHECK=1
npx hyperframes check --json
npx hyperframes render -o renders/out.mp4 --quality delivery --max-bitrate 8M
```
GSAP est servi en local (`assets/gsap.min.js`) car le CDN est bloqué dans l'environnement cloud.
Résultat muet : `../video_finale_hyperframes.mp4`.
