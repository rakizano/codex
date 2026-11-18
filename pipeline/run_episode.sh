#!/usr/bin/env bash
# Production complète d'un épisode APRÈS validation du script.
# Usage: pipeline/run_episode.sh <slug>   (exige episodes/<slug>/APPROVED sauf FORCE=1)
set -euo pipefail
cd "$(dirname "$0")/.."; S="$1"; E="episodes/$S"; PY="${PY:-$HOME/venv/bin/python}"; [[ -x $PY ]] || PY=python3
[[ -f "$E/APPROVED" || "${FORCE:-0}" == 1 ]] || { echo "Script non validé : crée $E/APPROVED"; exit 2; }
T0=$(date +%s)
$PY pipeline/tts.py "$E"
export VOICE_OFFSET="${VOICE_OFFSET:-0.6}"
$PY pipeline/sound.py "$E" "$VOICE_OFFSET"
pipeline/mix.sh "$E"
mkdir -p "video/public/$S" "$E/out"; cp "$E/script.json" "$E/build/timeline.json" "$E/build/beats.json" "$E/build/mix.wav" "video/public/$S/"
cp "$E/build/captions.srt" "$E/out/$S.srt"
P="{\"slug\":\"$S\",\"audio\":\"$S/mix.wav\"}"
(cd video && npx remotion render src/index.ts Episode "../$E/out/${S}_tiktok.mp4" --codec=h264 --audio-codec=aac --props="$P")
qc/check.sh "$E/out/${S}_tiktok.mp4"
# Variantes audio sans re-rendu (copie de la vidéo, piste audio remplacée)
ffmpeg -y -loglevel error -i "$E/out/${S}_tiktok.mp4" -i "$E/build/mix_voice_only.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$E/out/${S}_tiktok_voix-seule.mp4"
echo "Variante voix seule (pour le son officiel TikTok) : $E/out/${S}_tiktok_voix-seule.mp4"
if [[ -f "$E/build/mix_licensed.wav" ]]; then
  ffmpeg -y -loglevel error -i "$E/out/${S}_tiktok.mp4" -i "$E/build/mix_licensed.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "$E/out/${S}_licence.mp4"
  echo "Variante avec morceau sous licence : $E/out/${S}_licence.mp4"
fi
echo "Terminé en $(( $(date +%s) - T0 )) s — inspecter la planche-contact avant publication."
