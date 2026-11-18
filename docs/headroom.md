# Headroom → Claude Code (sur ton ordinateur)

[Headroom](https://github.com/headroomlabs-ai/headroom) compresse ce que Claude Code envoie au modèle (sorties d'outils, logs, JSON, fichiers) pour consommer moins de tokens, en gardant les erreurs et les lignes importantes. Tout tourne en local.

```bash
# 1. Installer (une fois) — nécessite uv : https://docs.astral.sh/uv/
uv tool install --python 3.13 "headroom-ai[all]"

# 2. Lancer Claude Code à travers Headroom (à chaque fois, à la place de `claude`)
headroom wrap claude

# Annuler
headroom unwrap claude
```

`headroom wrap` démarre un proxy local qui s'arrête avec Claude Code. Pour un proxy permanent : `headroom deploy`.

Compatible avec FreeLLM API (`docs/freellmapi.md`), mais les deux modifient l'adresse utilisée par Claude Code : teste-les d'abord séparément.
