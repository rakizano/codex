#!/usr/bin/env bash
# Installe Piper (pip) + voix françaises depuis les publications GitHub de Piper (v0.0.2).
# Licences : siwis-medium CC-BY 4.0 (créditer), gilles-low CC BY 4.0, mls_1840-low CC0.
set -euo pipefail
V="${VOICES_DIR:-$HOME/voices}"; mkdir -p "$V"
[[ -x "$HOME/venv/bin/python" ]] || python3 -m venv "$HOME/venv"
"$HOME/venv/bin/pip" install -q piper-tts faster-whisper numpy
for v in voice-fr-siwis-medium voice-fr-gilles-low voice-fr-mls_1840-low; do
  [[ -d "$V/$v" ]] || { mkdir -p "$V/$v"; curl -sSL "https://github.com/rhasspy/piper/releases/download/v0.0.2/$v.tar.gz" | tar -xz -C "$V/$v"; }
done
echo "Voix installées dans $V"
