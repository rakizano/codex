# codex — Générateur de clips musicaux animés pour TikTok

Skill Claude Code : `.claude/skills/clip-tiktok/` — **un titre en entrée, un clip animé terminé en sortie.**

```
/clip-tiktok Pink Floyd – Time
```

Claude recherche les paroles synchronisées (LRCLIB, recoupées entre plusieurs sources), choisit le
meilleur passage, détermine les timestamps, invente une direction artistique propre au morceau,
dessine et anime une scène par phrase (mots-clés en rouge, typographie animée, transitions),
contrôle la qualité et exporte une vidéo 1080×1920 H.264 **sans musique**, avec l'instant exact
de la chanson où caler le son dans TikTok / CapCut.

| Dossier | Contenu |
|---|---|
| `.claude/skills/clip-tiktok/SKILL.md` | workflow complet suivi par Claude |
| `.claude/skills/clip-tiktok/engine/` | moteur d'animation (SVG + typographie cinétique, transitions, personnages riggés) |
| `.claude/skills/clip-tiktok/scripts/` | paroles synchronisées, choix du passage, analyse audio, storyboard, rendu, QA, livrables |
| `.claude/skills/clip-tiktok/prompts/` | guides de direction artistique, storyboard, référence du moteur |
| `clips/<artiste-titre>/` | un dossier par clip : `video_finale.mp4`, `synchronisation.txt`, `storyboard.json`, `direction_artistique.txt` |

100 % gratuit : FFmpeg, Chromium/Playwright, Python + numpy, Google Fonts, LRCLIB. Aucune API payante.
