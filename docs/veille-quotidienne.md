# Veille quotidienne (automatisation niveau 2)

Tâche planifiée Claude Code — à créer en une phrase dans une session : « crée la tâche planifiée décrite dans docs/veille-quotidienne.md ».

- Nom : Veille Music Hunter
- Horaire : tous les jours 7 h 40 (Europe/Paris) — `CRON_TZ=Europe/Paris 40 7 * * *`
- Mode : nouvelle session à chaque exécution, notification push
- Coût : inclus dans l'abonnement Claude, aucun service payant

## Prompt
Projet L'Envers du Son, dépôt rakizano/codex, branche claude/envers-du-son-system-thh2zz (git fetch + checkout). Exécute le skill .claude/skills/music-hunter/SKILL.md : collecte via WebSearch les classements TikTok PUBLICS du jour (FR en priorité, US, GB, monde : TikTok Creative Center, Tokchart, Soundcharts, Kworb, Shazam). Écris music-hunter/data/inbox/<date>.csv avec UNIQUEMENT des valeurs lues (source_url obligatoire, champs avec virgules entre guillemets), puis `python3 music-hunter/hunter.py ingest` sur chaque CSV de data/inbox et `python3 music-hunter/hunter.py report`. Ajoute une section « Notes » (sources inaccessibles, limites). N'invente aucune donnée, aucun service payant, ne publie rien. Commit (reports/ et data/inbox/) et push sur la même branche. Résume en 5 lignes.
