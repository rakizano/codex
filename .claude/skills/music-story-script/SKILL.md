---
name: music-story-script
description: Écrit le script français (> 60 s réelles, cible 65–85 s) d'un épisode L'Envers du Son sous forme episodes/<slug>/script.json (segments + scène Remotion + mots-clés + version phonétique tts).
---
# Music Story Script

Entrée : `research.md` validé. Sortie : `script.json` (voir `episodes/swimming-pools/script.json`).

- Ton : complice, curieux, crédible. Tutoiement. Pas de ton publicitaire.
- Déroulé : hook (0–3 s) → titre/artiste/contexte → histoire documentée → détail surprenant → ce que l'usage TikTok masque → question finale.
- Une phrase = une idée = une scène. Champ `scene` parmi : HookTitle, ArtistTitleCard, FamilyRoom, FactReveal, TwoVoices, PoolDive, TikTokUsageContrast, EndQuestion, ou une nouvelle scène à créer dans `video/src/scenes/` (métaphore propre au morceau ; ne pas réutiliser les mêmes scènes à chaque épisode).
- `tts` : orthographe phonétique pour noms anglais (ex. « Souimmingue Poules »).
- Chaque affirmation factuelle doit pointer vers une ligne ✅ de research.md. Pas de statistique TikTok sans relevé.
- Fournir aussi 3 hooks alternatifs dans `episodes/<slug>/hooks.md`.
- Pas de remplissage : si < 60 s après TTS, chercher un vrai fait supplémentaire ou changer de sujet.
