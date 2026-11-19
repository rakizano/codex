# Améliorer la vidéo — toutes les solutions gratuites

État après cette passe : ✅ = en place dans le pipeline, ☐ = option à activer.

## 1. Voix (« désagréable à entendre »)

| Solution | Coût | Statut | Notes |
|---|---|---|---|
| **Kokoro-82M** (`ff_siwis`), synthèse phrase par phrase | 0 € (Apache-2.0) | ✅ par défaut | plus naturel que Piper ; modèles via `pipeline/setup_voices.sh` (GitHub) |
| Traitement **validé par mesure** : passe-haut + dé-esseur uniquement | 0 € | ✅ | DNSMOS : EQ, compression et réverbe faisaient BAISSER la note ; seule cette variante l'améliore. Les anciennes voix Piper saturaient (pics à 1,00) : corrigé |
| **Mesure objective de qualité vocale** (DNSMOS, `pipeline/voice_mos.py`) | 0 € | ✅ | note 1–5 prédite ; aveugle au-dessus de 8 kHz → compléter par l'écoute |
| Pauses selon ponctuation + `pause_before` (respiration avant une révélation) | 0 € | ✅ | réglable par segment dans `script.json` |
| Vitesse 1,05 (énergie TikTok) | 0 € | ✅ | `config/voice.json` → `speed` |
| Voix masculine Kokoro par **mélange de styles** | 0 € | ✗ écarté | DNSMOS 3,25 (< Kokoro siwis 3,43, < Gilles 3,57) + risque d'accent |
| **Voix masculine Piper « gilles »** + exciter (recrée les aigus d'un modèle 16 kHz) | 0 € | ✅ version alternative | meilleure note DNSMOS sur la narration complète (3,40 vs 3,24 Kokoro), plus expressive (±3,1 vs ±2,2 demi-tons) ; `out/swimming-pools_gilles_tiktok.mp4` |
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

## Mesures (DNSMOS, note globale prédite 1–5, extrait du hook)

| Voix | Brut | Traitement minimal |
|---|---|---|
| Piper gilles-low (masc.) | 3,55 | 3,57 (3,46 avec exciter) |
| Kokoro ff_siwis (fém.) | 3,43 | 3,44 |
| Kokoro mélanges masculins | 3,38–3,43 | 3,15–3,25 avec l'ancienne chaîne |
| Piper siwis-medium (ancienne voix) | 3,32 | 3,14 avec l'ancienne chaîne |
| espeak/MBROLA (première voix) | — | 2,80–3,01 |

## Passe 3 — voix plus naturelle, plus de mouvement, musique raccordée

### Voix
- Aucun skill de voix disponible sur le compte (recherche faite). Modèles plus naturels (Chatterbox, F5-TTS, XTTS, OuteTTS, CosyVoice) : uniquement sur Hugging Face/ModelScope, **bloqués** depuis ce conteneur (testé) — à essayer sur ta machine si besoin, attention aux licences non commerciales.
- Nouvelles voix FR via les publications GitHub de sherpa-onnx : **Pierre** (UPMC medium, masc., 22 kHz, CC BY-SA 4.0), Jessica, Tom.
- Prosodie Piper réglée (noise 0,5 / largeur 1,2) et comparée sur 4 essais (DNSMOS moyen) : Gilles 3,51 · Pierre 3,39 · (Jessica 3,08, Tom 3,20).
- **Choix : Pierre par défaut** — note proche de Gilles mais bande audio complète (Gilles = 16 kHz, son étouffé que DNSMOS ne voit pas). Gilles reste en version alternative (`_gilles`).

### Musique « bien raccordée »
- Grille du beat décalée pour que la batterie entre **pile sur la question du hook** (1er temps de mesure).
- Chaque coupe de scène est **calée sur un temps du beat** (écart mesuré : 0,000 s), précédée d'un roulement de caisse claire qui monte, et marquée d'une cymbale + basse.
- Les transitions visuelles utilisent ces mêmes temps (`beats.json` → `cuts`).

### Plus de mouvement
- Zoom de tout le cadre sur chaque temps (plus fort sur le 1er temps de mesure).
- Mots-clés géants en contour qui traversent le fond (typographie cinétique d'arrière-plan).
- Anneaux qui s'ouvrent à chaque coupe, calés sur la cymbale.
- Tous les titres animés flottent et oscillent en permanence après leur apparition (plus aucun texte figé).
- Testé aussi : Coqui VITS « CSS10 » (fém., GitHub sherpa-onnx) → DNSMOS 3,01–3,19 sur 4 essais, inférieur à Pierre/Gilles : écarté. Toutes les voix françaises téléchargeables depuis ce conteneur ont été évaluées.

## Passe 4 — skills Bang Motion + Video GIF Studio
- Installés dans `.claude/skills/` après lecture (licences MIT, aucun appel réseau suspect) — provenance : `.claude/skills/THIRD_PARTY_SKILLS.md`.
- **Bang Motion** appliqué à Remotion : menu de transitions (fini le bloc diagonal répété), entrées lentes / sorties rapides qui se chevauchent, plans de caméra serrés ↔ larges sur l'élément qui raconte, typographie en casse de phrase. Règles ajoutées au skill `remotion-music-explainer` pour toutes les nouvelles vidéos.
- **Video GIF Studio** : seule la partie locale et gratuite est utilisée (`music_sync.py`, analyse de tempo). `pipeline/licensed_beats.py` cale les coupes sur les vrais temps d'un morceau **sous licence** déposé dans `episodes/<slug>/music/licence.*` (testé : 86 BPM détectés sur un signal à 86 BPM). Routes payantes (Grok, fal.ai, Suno) non utilisées.
