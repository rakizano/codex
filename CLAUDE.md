# Instructions pour Claude

- Réponds en français.
- **Vidéos** : toute demande de vidéo, animation, film, explainer ou motion design se fait avec le skill `lemo-opuscar` (`.claude/skills/lemo-opuscar`). N'utilise `ai-video-generation` (inference.sh) que si l'utilisateur demande explicitement une vidéo générée par IA (Veo, Kling, Seedance…).
- **Code** : le skill `ponytail` s'applique aux tâches de code (changement le plus petit qui résout entièrement le problème).
- **Modèles gratuits** : la configuration FreeLLM API pour Claude Code est décrite dans `docs/freellmapi.md`. Elle tourne sur l'ordinateur de l'utilisateur, pas dans les sessions cloud.
- **Économie de tokens** : Headroom (`docs/headroom.md`) se lance sur l'ordinateur de l'utilisateur avec `headroom wrap claude`. Le skill `headroom` sert à l'intégrer dans du code Python/TypeScript.
