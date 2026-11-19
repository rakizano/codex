#!/usr/bin/env bash
# Épisode en style Bang Motion « carnet de croquis vintage » (HTML + GSAP -> MP4).
# Usage: pipeline/run_episode_html.sh <slug>   (exige episodes/<slug>/APPROVED sauf FORCE=1)
set -euo pipefail
cd "$(dirname "$0")/.."; S="$1"; E="episodes/$S"; PY="${PY:-$HOME/venv/bin/python}"; [[ -x $PY ]] || PY=python3
[[ -f "$E/APPROVED" || "${FORCE:-0}" == 1 ]] || { echo "Script non validé : crée $E/APPROVED"; exit 2; }
export VOICE_OFFSET="${VOICE_OFFSET:-0.6}"
# shellcheck disable=SC2086
$PY pipeline/tts.py "$E" ${TTS_ARGS:-}
$PY pipeline/sound.py "$E" "$VOICE_OFFSET"
LIC=$(ls "$E"/music/licence.* 2>/dev/null | head -1 || true)
if [[ -n "$LIC" ]]; then $PY pipeline/licensed_beats.py "$E" "$LIC"; pipeline/mix.sh "$E" "$LIC"; cp "$E/build/mix_licensed.wav" "$E/build/mix.wav"; else pipeline/mix.sh "$E"; fi
$PY pipeline/bang_sketch.py "$E"
mkdir -p "$E/out"; cp "$E/build/captions.srt" "$E/out/$S.srt"
node pipeline/render_html.cjs "$E/web/index.html" "$E/out/${S}_tiktok.mp4" 30
qc/check.sh "$E/out/${S}_tiktok.mp4"
ffmpeg -y -loglevel error -i "$E/out/${S}_tiktok.mp4" -i "$E/build/mix_voice_only.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$E/out/${S}_tiktok_voix-seule.mp4"
echo "OK : $E/out/${S}_tiktok.mp4 (+ _voix-seule pour le son officiel TikTok)"
