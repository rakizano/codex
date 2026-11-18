# L'Envers du Son

Chaîne de production de vidéos TikTok « l'histoire cachée d'un morceau », **à coût nul** : skills Claude Code et outils open source à la place des services payants (voir `PROMPT_MAITRE_v2.md`).

## Structure
- `.claude/skills/` — 8 skills : `episode-pipeline` (chef d'orchestre), `music-hunter`, `song-research`, `music-story-script`, `voice-local`, `sound-design-local`, `remotion-music-explainer`, `episode-qc`.
- `music-hunter/hunter.py` — relevés → croissance → score /100 → rapport (`reports/`).
- `pipeline/` — `tts.py` (Piper / espeak), `sound.py` (nappe + SFX procéduraux), `mix.sh` (ducking, -14 LUFS), `run_episode.sh` (tout en une commande).
- `video/` — projet Remotion (composants + scènes « Vinyl Motion Explainer »).
- `qc/check.sh` — contrôle qualité bloquant + planche-contact.
- `episodes/swimming-pools/` — pilote : recherche, sources, script, MP4, SRT, publication, journal.

## Installation (ta machine)
```bash
sudo apt install ffmpeg espeak-ng mbrola-fr1     # macOS : brew install ffmpeg espeak-ng
python3 -m venv ~/venv && ~/venv/bin/pip install piper-tts faster-whisper numpy
mkdir -p ~/voices   # + télécharger fr_FR-tom-medium.onnx(.json) depuis huggingface.co/rhasspy/piper-voices
cd video && npm install
```
Puis dans `config/voice.json` : `"engine": "piper", "voice": "~/voices/fr_FR-tom-medium.onnx"`.

## Utilisation
Dans Claude Code : `/episode-pipeline Swimming Pools - Kendrick Lamar` ou `/episode-pipeline auto`.
Après validation du script : `touch episodes/<slug>/APPROVED && pipeline/run_episode.sh <slug>`.

## Automatisation (par niveaux)
1. manuel assisté ✅ · 2. veille quotidienne (tâche planifiée Claude Code → `music-hunter`) · 3. préproduction auto jusqu'au script · 4. production auto après `APPROVED` · 5. publication : toujours manuelle.
