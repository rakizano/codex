# Journal de production — pilote Swimming Pools

| Étape | Outil | Durée machine | Coût |
|---|---|---|---|
| Recherche | WebSearch Claude Code | ~2 min | 0 € |
| Voix (8 segments) | Piper fr-siwis-medium (CC-BY 4.0) | ~10 s | 0 € |
| Nappe + SFX | pipeline/sound.py (procédural) | ~20 s | 0 € |
| Mix | ffmpeg (ducking, -14 LUFS) | ~3 s | 0 € |
| Rendu 2060 frames | Remotion, 4 cœurs | ~70 s | 0 € |
| QC | qc/check.sh + planche-contact | ~15 s | 0 € |
| **Total** | | **< 5 min machine** | **0 €** |

Durée vidéo : 76,8 s (voix Piper 73,7 s). QC technique : tout OK. Script aligné sur la citation Complex 2012.

## Défauts connus
1. ~~Voix robotique~~ → Piper `fr-siwis-medium` (voix féminine) via les publications GitHub. Auditions dans `out/auditions/` (siwis-medium, gilles-low masculine, mls_1840-low) : **choix humain à faire**. Vérifier à l'écoute la prononciation des orthographes phonétiques (« Souimmingue Poules », « Ti-Maïneusse »).
2. **Recherche non vérifiée** : aucune page n'a pu être ouverte (réseau du conteneur) ; toutes les lignes de research.md sont ☐. Ne pas publier avant vérification.
3. **Usage TikTok non relevé** : la scène « en soirée » est formulée comme hypothèse.
4. ~~Visuel~~ corrigé (fourche, carte Complex animée, plongeur agrandi et repositionné).
5. Timings mot à mot estimés (proportionnels) ; faster-whisper donnera un alignement réel une fois le modèle téléchargeable.
