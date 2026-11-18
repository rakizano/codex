# Journal de production — pilote Swimming Pools

| Étape | Outil | Durée machine | Coût |
|---|---|---|---|
| Recherche | WebSearch Claude Code | ~2 min | 0 € |
| Voix (8 segments) | espeak-ng + MBROLA fr1 (provisoire) | ~5 s | 0 € |
| Nappe + SFX | pipeline/sound.py (procédural) | ~20 s | 0 € |
| Mix | ffmpeg (ducking, -14 LUFS) | ~3 s | 0 € |
| Rendu 2060 frames | Remotion, 4 cœurs | ~70 s | 0 € |
| QC | qc/check.sh + planche-contact | ~15 s | 0 € |
| **Total** | | **< 5 min machine** | **0 €** |

Durée vidéo : 68,7 s (voix 65,7 s). QC technique : tout OK.

## Défauts connus
1. **Voix robotique** (MBROLA) : à remplacer par Piper (`fr_FR-tom-medium`) — Hugging Face était bloqué depuis le conteneur. Relancer `tts.py` après avoir mis `engine: piper` dans `config/voice.json`.
2. **Recherche non vérifiée** : aucune page n'a pu être ouverte (réseau du conteneur) ; toutes les lignes de research.md sont ☐. Ne pas publier avant vérification.
3. **Usage TikTok non relevé** : la scène « en soirée » est formulée comme hypothèse.
4. Visuel : le libellé « se laisser entraîner » touche la branche de la fourche ; la carte Complex reste ~6 s quasi statique ; plongeur petit. À polir.
5. Timings mot à mot estimés (proportionnels) ; faster-whisper donnera un alignement réel une fois le modèle téléchargeable.
