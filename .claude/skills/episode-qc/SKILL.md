---
name: episode-qc
description: Contrôle qualité d'un MP4 (format, durée > 60 s, loudness, écrêtage, écrans noirs, images figées) + inspection visuelle d'une planche-contact. Obligatoire avant de déclarer une vidéo prête.
---
# QC

1. `qc/check.sh episodes/<slug>/out/<slug>_tiktok.mp4` → doit finir sans FAIL.
2. Lire la planche-contact générée (Read sur le PNG) et vérifier : textes qui se chevauchent, éléments coupés, texte sous la zone d'interface TikTok (bas ~ 300 px, droite ~ 140 px), sous-titres lisibles, accents, noms d'artistes, scènes vides, répétitions.
3. Corriger, re-rendre, recommencer. Noter les défauts dans `episodes/<slug>/production-log.md`.
