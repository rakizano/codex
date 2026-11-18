#!/usr/bin/env bash
# Installe Kokoro (voix par défaut) + Piper et 3 voix françaises, tout depuis GitHub.
# Licences : siwis-medium CC-BY 4.0 (créditer), gilles-low CC BY 4.0, mls_1840-low CC0.
set -euo pipefail
V="${VOICES_DIR:-$HOME/voices}"; mkdir -p "$V"
[[ -x "$HOME/venv/bin/python" ]] || python3 -m venv "$HOME/venv"
"$HOME/venv/bin/pip" install -q piper-tts kokoro-onnx soundfile faster-whisper numpy speechmos librosa
for v in voice-fr-siwis-medium voice-fr-gilles-low voice-fr-mls_1840-low; do
  [[ -d "$V/$v" ]] || { mkdir -p "$V/$v"; curl -sSL "https://github.com/rhasspy/piper/releases/download/v0.0.2/$v.tar.gz" | tar -xz -C "$V/$v"; }
done
# Kokoro-82M (Apache-2.0) — voix par défaut, plus naturelle
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [[ -f "$V/$f" ]] || curl -sSL -o "$V/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done
echo "Voix installées dans $V"
