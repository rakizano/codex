# Journal de production — pilote Swimming Pools

| Étape | Outil | Durée machine | Coût |
|---|---|---|---|
| Recherche | WebSearch Claude Code | ~2 min | 0 € |
| Voix (phrase par phrase) | Kokoro-82M ff_siwis + chaîne studio | ~40 s | 0 € |
| Beat original + 10 types de SFX | pipeline/sound.py (procédural) | ~30 s | 0 € |
| Mix | ffmpeg (ducking, -14 LUFS) | ~3 s | 0 € |
| Rendu ~2400 frames (animations enrichies) | Remotion, 4 cœurs | ~150 s | 0 € |
| QC | qc/check.sh + planche-contact | ~15 s | 0 € |
| **Total** | | **< 5 min machine** | **0 €** |

Durée vidéo : 76,8 s (voix Piper 73,7 s). QC technique : tout OK. Script aligné sur la citation Complex 2012.

## Défauts connus
1. ~~Voix robotique~~ → Piper `fr-siwis-medium` (voix féminine) via les publications GitHub. Auditions dans `out/auditions/` (siwis-medium, gilles-low masculine, mls_1840-low) : **choix humain à faire**. Vérifier à l'écoute la prononciation des orthographes phonétiques (corrigées par contrôle IPA espeak : « Souiminng Poules », « Ti-Maille-neuss », « Kène-drik »).
2. **Recherche non vérifiée** : aucune page n'a pu être ouverte (réseau du conteneur) ; toutes les lignes de research.md sont ☐. Ne pas publier avant vérification.
3. **Usage TikTok non relevé** : la scène « en soirée » est formulée comme hypothèse.
4. ~~Visuel~~ corrigé (fourche, carte Complex animée, plongeur agrandi et repositionné).
5. Timings mot à mot estimés (proportionnels) ; faster-whisper donnera un alignement réel une fois le modèle téléchargeable.

## Passe « son + animations » (v4)
- Voix Kokoro ff_siwis, synthèse phrase par phrase, pauses de ponctuation, chaîne studio (les anciennes voix Piper écrêtaient à 1,00).
- Beat hip-hop original 86 BPM (piano électrique, kick, snare, hats swing, basse) ; intro filtrée, drums sur la question du hook, coupure sur la révélation ; 3 moments « musique seule » ; ducking ≈13 dB sous la voix.
- Animations : fond vivant, particules, grain, tout pulse sur le beat réel, caméra (push-in, punch, shake), transitions en volet, sous-titres animés + mots-clés, scènes enrichies (voir docs/ameliorations.md).
- Sorties : `_tiktok.mp4` (beat original) et `_tiktok_voix-seule.mp4` (pour ajouter le son officiel dans TikTok).
- Durée 80,2 s ; QC OK.
