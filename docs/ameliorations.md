# Améliorer la vidéo — toutes les solutions gratuites

État après cette passe : ✅ = en place dans le pipeline, ☐ = option à activer.

## 1. Voix (« désagréable à entendre »)

| Solution | Coût | Statut | Notes |
|---|---|---|---|
| **Kokoro-82M** (`ff_siwis`), synthèse phrase par phrase | 0 € (Apache-2.0) | ✅ par défaut | plus naturel que Piper ; modèles via `pipeline/setup_voices.sh` (GitHub) |
| Chaîne « studio » : passe-haut, chaleur 180 Hz, -350 Hz, présence 3,2 kHz, dé-esseur, compression douce, petite pièce | 0 € | ✅ | les anciennes voix Piper saturaient (pics à 1,00) : corrigé |
| Pauses selon ponctuation + `pause_before` (respiration avant une révélation) | 0 € | ✅ | réglable par segment dans `script.json` |
| Vitesse 1,05 (énergie TikTok) | 0 € | ✅ | `config/voice.json` → `speed` |
| Voix masculine Kokoro par **mélange de styles** (`im_nicola:0.5,em_alex:0.3,ff_siwis:0.2`) | 0 € | ☐ à écouter | timbre grave (≈120 Hz) ; risque de léger accent → écoute obligatoire (`out/auditions/`) |
| **Ta propre voix** (micro de téléphone) + débruitage + chaîne studio | 0 € | ✅ prêt (moteur `record`) | la solution la plus humaine ; texte à lire dans `episodes/<slug>/record/LIRE.md` |
| F5-TTS / XTTS-v2 (clonage d'une voix **à toi ou consentie**) | 0 € (GPU conseillé) | ☐ sur ta machine | modèles hébergés sur Hugging Face (bloqué ici) ; XTTS = licence non commerciale (CPML), F5-TTS : poids CC-BY-NC → inadaptés à une chaîne monétisée. Le moteur `record` est meilleur et sans risque |
| Voix Azure/Edge « neural » via outils non officiels | 0 € | ✗ écarté | conditions d'utilisation floues pour un usage public |
| Contrôle de prononciation (IPA) des noms propres | 0 € | ✅ | `pipeline/check_pron.py` |

## 2. « On n'entend pas la musique »

| Solution | Coût | Statut | Notes |
|---|---|---|---|
| **Beat original** hip-hop (piano électrique, kick, snare, hats swing, basse) arrangé selon le récit | 0 € | ✅ | `pipeline/sound.py` ; intro filtrée, drums à la question, coupure sur la révélation |
| Ducking : musique ≈13 dB sous la voix, remonte entre les phrases | 0 € | ✅ | `pipeline/mix.sh` |
| **Moments « musique seule »** (`music_break`) + carte « ♪ écoute le son ♪ » | 0 € | ✅ | 3 moments dans le pilote |
| **Son officiel dans TikTok** à la publication (bibliothèque TikTok) | 0 € | ☐ à la publication | volume du son ~25–35 % ; les `music_break` laissent le refrain s'entendre seul ; ou utiliser la variante voix seule |
| Export **voix + bruitages sans beat** pour laisser toute la place au son officiel | 0 € | ✅ | `out/<slug>_tiktok_voix-seule.mp4`, généré automatiquement |
| Morceau officiel **sous licence** intégré + ducking | selon licence | ☐ | `pipeline/mix.sh <episode> licence.wav` |
| Musiques CC0 / libres (Pixabay Music, Free Music Archive CC0, YouTube Audio Library) | 0 € | ☐ | vérifier la licence de chaque piste, la noter dans `sources.md` |
| Bruitages synchronisés : scratch, aiguille, versement, verre, page, montée, plongeon, impacts | 0 € | ✅ | tous synthétisés (aucun droit tiers) |
| Imiter le morceau raconté / le style d'un artiste vivant | — | ✗ interdit | droits d'auteur + brief |

## 3. Animations (« pas assez »)

| Solution | Statut |
|---|---|
| Fond vivant (taches de couleur qui dérivent), particules, grain de pellicule, vignette | ✅ |
| **Tout bat au rythme** : pulsation calculée sur les temps réels du beat (`beats.json`) — foule qui saute, projecteurs, barre de progression, vinyle, barres audio | ✅ |
| Caméra : push-in permanent, « punch » zoom et tremblement sur les impacts | ✅ |
| Transitions en volet diagonal bicolore à chaque changement de scène | ✅ |
| Sous-titres : mots qui « sautent », mot courant + mots-clés colorés | ✅ |
| Hook : projecteurs, foule au beat, éclats de trinquage, **arrêt sur image + PAUSE** à la question | ✅ |
| Titre : bras de platine qui se pose, lettres qui tombent une à une, sillons lumineux | ✅ |
| Famille : travelling avant, lumière qui vacille, rideaux, bouteilles qui apparaissent, verre qui se remplit | ✅ |
| Révélation : page de magazine qui s'ouvre en 3D, citation tapée à la machine, surligneur, fourche qui se dessine, personnage qui hésite | ✅ |
| Deux voix : têtes de profil, bulles qui jaillissent, conscience qui s'allume au beat | ✅ |
| Piscine : plongeon en arc, ondes, gerbe de particules, bulles, liquide qui engloutit l'écran | ✅ |
| Contraste : téléphone avec fil TikTok qui défile, cœurs, liste animée avec icônes | ✅ |
| Fin : vinyle qui accélère, réactions qui surgissent | ✅ |
| Animations Lottie gratuites (LottieFiles) via `@remotion/lottie` | ☐ option — non nécessaire : toutes les animations sont déjà codées en SVG original (pas de dépendance de licence) ; LottieFiles inaccessible depuis ce conteneur |
| Illustrations vectorielles libres (unDraw, Open Peeps — CC0/MIT) | ☐ option, vérifier licence |
| Images d'archives réelles (Wikimedia Commons, licence libre) | ☐ seulement si licence compatible, créditer |
