---
name: voice-local
description: Génère la voix off gratuitement en local (Piper recommandé, espeak-ng/MBROLA en secours), les auditions, la timeline mot à mot et le SRT.
---
# Voix locale

- Installation (une fois) : `python3 -m venv ~/venv && ~/venv/bin/pip install piper-tts faster-whisper` ; voix : télécharger `fr_FR-tom-medium`, `fr_FR-upmc-medium`, `fr_FR-siwis-medium` (.onnx + .onnx.json) depuis huggingface.co/rhasspy/piper-voices dans `~/voices/`. Vérifier la licence de chaque voix (MODEL_CARD).
- Auditions : `~/venv/bin/python pipeline/tts.py episodes/<slug> --audition` → validation humaine → `config/voice.json`.
- Production : `~/venv/bin/python pipeline/tts.py episodes/<slug>` → `build/voice.wav`, `timeline.json`, `captions.srt`.
- Vérifier : durée affichée > 60 s ; écouter les noms propres ; corriger le champ `tts`.
- Interdit : cloner la voix d'une personne réelle.
