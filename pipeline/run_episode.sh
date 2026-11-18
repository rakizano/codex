#!/usr/bin/env bash
# Production complète d'un épisode APRÈS validation du script.
# Usage: pipeline/run_episode.sh <slug>   (exige episodes/<slug>/APPROVED sauf FORCE=1)
set -euo pipefail
cd "$(dirname "$0")/.."; S="$1"; E="episodes/$S"; PY="${PY:-$HOME/venv/bin/python}"; [[ -x $PY ]] || PY=python3
[[ -f "$E/APPROVED" || "${FORCE:-0}" == 1 ]] || { echo "Script non validé : crée $E/APPROVED"; exit 2; }
T0=$(date +%s)
$PY pipeline/tts.py "$E"
$PY pipeline/sound.py "$E"
pipeline/mix.sh "$E"
mkdir -p "video/public/$S" "$E/out"; cp "$E/script.json" "$E/build/timeline.json" "$E/build/mix.wav" "video/public/$S/"
cp "$E/build/captions.srt" "$E/out/$S.srt"
P="{\"slug\":\"$S\",\"audio\":\"$S/mix.wav\"}"
(cd video && npx remotion render src/index.ts Episode "../$E/out/${S}_tiktok.mp4" --codec=h264 --audio-codec=aac --props="$P")
qc/check.sh "$E/out/${S}_tiktok.mp4"
echo "Terminé en $(( $(date +%s) - T0 )) s — inspecter la planche-contact avant publication."
