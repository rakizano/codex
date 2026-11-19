---
name: clip-tiktok
description: Génère automatiquement un clip musical animé vertical (TikTok 1080x1920, MP4 H.264, sans audio) à partir du seul titre d'une chanson « Artiste – Titre » — recherche des paroles synchronisées, choix du meilleur passage, timestamps, direction artistique propre au morceau, scènes illustrées et animées (une par phrase), mots-clés en rouge, transitions, contrôle qualité et instructions de calage de la musique. À utiliser dès que l'utilisateur donne un titre de chanson pour un clip, un lyric video, une vidéo TikTok de paroles, ou invoque /clip-tiktok.
---

# Clip TikTok — un titre en entrée, un clip animé terminé en sortie

L'utilisateur donne uniquement `Artiste – Titre`. Tu réalises TOUT, sans lui demander de valider
quoi que ce soit (paroles, passage, timestamps, DA, scènes, montage). Tu ne l'interromps que si
une information indispensable est réellement inaccessible (ex. aucune parole synchronisée trouvée).

Chemins : `SK=.claude/skills/clip-tiktok` (ce skill), projet = `clips/<slug-artiste-titre>/`,
fichiers de travail = `clips/<slug>/work/`. Toujours lancer les commandes depuis la racine du dépôt.

## Règles absolues

1. **Ne jamais inventer ni modifier les paroles.** Seules les paroles issues des sources sont affichées
   (on peut seulement ajouter `/` pour les retours à la ligne). `storyboard.py check --lyrics` le vérifie.
2. **Ne jamais prétendre avoir vérifié un timestamp** qui n'est qu'estimé. La fiabilité (nombre de
   sources concordantes, écart, analyse audio ou non) est écrite dans `synchronisation.txt`.
3. **Une nouvelle phrase = une nouvelle composition visuelle.** Jamais la même image avec un autre texte.
4. **Un mot rouge par séquence de paroles**, choisi pour son sens (pas systématiquement le dernier).
   Le rouge `#e10600` (ou très proche) reste la signature ; tout le reste change selon la chanson.
5. **Une direction artistique différente pour chaque chanson** : palette, police, décors, personnages,
   textures, mouvements et transitions dérivés de l'analyse du morceau. Ne recopie jamais la DA
   d'un clip précédent (regarde `clips/*/direction_artistique.txt` pour t'en écarter volontairement).
6. **Vidéo sans audio**, 1080×1920, 30 fps, H.264 yuv420p, texte dans la zone de sécurité TikTok.
7. Ne pas recréer une pochette d'album ou un clip officiel existant : s'en inspirer librement seulement.

## Workflow (exécuter dans l'ordre, sans pause)

### 1. Identification
- Normaliser artiste / titre. `WebSearch` (mode standard) : version de référence (album studio),
  durée officielle (m:ss), année, genre, contexte. Si plusieurs versions existent (remaster plus long,
  edit radio), viser la version album la plus écoutée sur les plateformes ; noter sa durée en secondes.

### 2. Paroles synchronisées
```bash
python3 $SK/scripts/lyrics_fetch.py --artist "<Artiste>" --title "<Titre>" --out clips/<slug>/work [--duration <s>]
```
- Lit LRCLIB (gratuit, sans clé), regroupe les entrées par version (durée), garde le sous-groupe dont
  les timestamps concordent et prend la **médiane** par ligne. Regarder `n_sources`,
  `sync_spread_median_s`, `sync_confidence`, `other_versions`.
- Si la durée trouvée ne correspond pas à la version visée, relancer avec `--duration`.
- **Vérification croisée du texte** : comparer quelques lignes avec une 2e source web (`WebSearch`,
  ou l'agent `web-fetch` sur une page de paroles). En cas de divergence, ne garder que les passages concordants.
- Si aucune parole synchronisée n'existe : le dire à l'utilisateur et proposer qu'il fournisse le fichier
  audio (voir étape 5b) — ne jamais inventer de timestamps.

### 3. Analyse
Genre, époque, influences, tempo, intensité, émotions, structure (couplets/refrains/pont via les trous
dans le LRC), métaphores, références, histoire racontée. Utilise ta connaissance du morceau + le web.

### 4. Choix du passage
```bash
python3 $SK/scripts/passage_candidates.py clips/<slug>/work/lyrics.json [--audio clips/<slug>/work/audio.json]
```
Le script classe des fenêtres 15-45 s (entrées/sorties propres, densité, répétitions, énergie si audio).
**Tu décides** selon le sens : accroche forte dès la 1re seconde, mini-histoire cohérente, fin qui résonne.
Ne prends pas le refrain par défaut. Tu peux ajuster début/fin (début ≈ 0,2-0,5 s avant la 1re syllabe,
fin ≈ 0,5 s après la dernière note tenue). Écris en 2 phrases pourquoi ce passage.

### 5. Synchronisation
```bash
python3 $SK/scripts/storyboard.py init --lyrics clips/<slug>/work/lyrics.json --start <s> --end <s> \
        --out clips/<slug>/storyboard.json [--split-long 8]
```
Crée une scène par phrase (temps en secondes depuis le début du passage, `song_t` = temps dans la chanson).
`--split-long N` scinde les lignes de plus de N mots en deux scènes (timing intra-ligne marqué « estimé »).
Ajuste `end` d'une phrase si la note est tenue (ex. « death… ») — le texte doit rester tant que la voix chante.

#### 5b. (Optionnel) Audio fourni par l'utilisateur
S'il a déposé un fichier audio (upload ou dépôt) : 
`python3 $SK/scripts/audio_analyze.py <audio> --out clips/<slug>/work --lyrics clips/<slug>/work/lyrics.json`
→ durée réelle, énergie, tempo/pulsations, ruptures, et décalage global LRC↔voix. Appliquer un décalage
seulement si `|offset| > 0.15 s` et `peak_z > 3`. Copier `beats` (temps du passage = beat − start) dans
`storyboard.beats` pour l'emphase `pulse`. Ne jamais intégrer l'audio dans la vidéo.

### 6. Direction artistique
Lire `prompts/direction_artistique.md`. Remplir `storyboard.direction` (concept, univers, palette,
typographie, style graphique, principes d'animation, transitions) et `storyboard.style` :
`fonts` (Google Fonts, téléchargées automatiquement), `typo` (police, couleurs, tailles, animations par
défaut), `fx` (grain, vignette, étalonnage, scanlines, halftone, teinte), `outro` (fondu final).

### 7. Storyboard
Lire `prompts/storyboard.md`. Pour chaque scène : `visual` (composition), `camera`, `animation`,
`transition` d'entrée, et dans `lyrics[0]` : `red`, `enter`, `emphasis`, `pos`, `align`, retours `/`.
Varier positions du texte, cadrages, échelles (plan large / gros plan), rythme des transitions selon la musique.

### 8-9. Illustrations + animation
Écrire `clips/<slug>/scenes.js` : une fonction `CLIP.scene('<id>', S => {...})` par scène, avec la
bibliothèque du moteur (référence complète : `prompts/engine_api.md`). Illustrations vectorielles
dessinées par toi (SVG) : décors en couches de parallaxe, personnages riggés qui marchent/respirent/
se balancent, objets animés, particules, caméra. Personnalise avec du SVG sur mesure (`S.h`, `E.raw`).
Toute animation doit être une **fonction pure du temps local `t`** (pas d'état accumulé).

### 10. Revue visuelle (obligatoire avant le rendu complet)
```bash
python3 $SK/scripts/fonts.py --project clips/<slug> "<Police 1>" "<Police 2:700>"
python3 $SK/scripts/storyboard.py check clips/<slug>/storyboard.json --lyrics clips/<slug>/work/lyrics.json --scenes clips/<slug>/scenes.js
node $SK/scripts/render.mjs --project clips/<slug> --scene-stills     # 1 image par scène
cd clips/<slug>/stills && montage $(ls still_*.png|sort) -tile 5x -geometry 324x576+4+4 sheet.jpg
```
**Regarder `sheet.jpg` avec l'outil Read.** Corriger : texte illisible/masqué, éléments qui chevauchent
le texte, scènes trop vides ou trop sombres, personnage mal placé, miroirs, incohérences. Vérifier aussi
des images au milieu des transitions (`--stills 1.8,7.4,...`). Itérer jusqu'à ce que ce soit beau.

### 11-12. Rendu, contrôle qualité, export
```bash
bash $SK/scripts/produce.sh clips/<slug>
```
Polices → validation → rendu parallèle (≈ 6 s de calcul par seconde de clip) → zones de texte →
`qa.py` (format, absence d'audio, durée, changement visuel à chaque scène, mouvement dans chaque scène,
mots rouges, zone de sécurité, taille du texte, bandes noires) → `synchronisation.txt` +
`direction_artistique.txt`. Corriger et relancer tant que `qa.py` signale un échec. Regarder
`contact_sheet.jpg`.

### 13. Livraison
- Envoyer `video_finale.mp4` à l'utilisateur avec `SendUserFile` (il l'enregistre depuis l'app Claude
  sur iPad), et résumer : passage choisi (début/fin dans la chanson), pourquoi, DA en 3 lignes,
  fiabilité de la synchro, et ce qui reste estimé.
- Commit + push du dossier `clips/<slug>/` (sans `build/` ni `stills/`) sur la branche de travail.

## Fichiers produits (dans `clips/<slug>/`)
`video_finale.mp4` · `synchronisation.txt` · `storyboard.json` · `direction_artistique.txt` ·
`scenes.js` (source des illustrations, re-rendable) · `contact_sheet.jpg` · `qa_report.json` · `work/` (paroles, sources).

## Vidéo de référence
Si l'utilisateur fournit (ou re-fournit) la vidéo de référence :
`python3 $SK/scripts/analyze_reference.py <video> --out clips/_reference` puis regarder
`reference_sheet.jpg` et `timeline_*.jpg` ; consigner les observations dans `prompts/reference_notes.md`
(rythme de coupe, placement du texte, animations, transitions) et en tenir compte dans les clips suivants.
