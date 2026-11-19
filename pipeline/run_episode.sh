#!/usr/bin/env bash
# Production complète d'un épisode APRÈS validation du script.
# Usage: pipeline/run_episode.sh <slug>   (exige episodes/<slug>/APPROVED sauf FORCE=1)
# Options (variables d'environnement) :
#   TTS_ARGS="--engine piper --voice ~/voices/voice-fr-gilles-low/fr-gilles-low.onnx"  autre voix
#   SUFFIX="_gilles"   suffixe des fichiers de sortie (pour comparer plusieurs versions)
set -euo pipefail
cd "$(dirname "$0")/.."; S="$1"; E="episodes/$S"; PY="${PY:-$HOME/venv/bin/python}"; [[ -x $PY ]] || PY=python3
[[ -f "$E/APPROVED" || "${FORCE:-0}" == 1 ]] || { echo "Script non validé : crée $E/APPROVED"; exit 2; }
SUF="${SUFFIX:-}"; T0=$(date +%s)
# shellcheck disable=SC2086
$PY pipeline/tts.py "$E" ${TTS_ARGS:-}
export VOICE_OFFSET="${VOICE_OFFSET:-0.6}"
$PY pipeline/sound.py "$E" "$VOICE_OFFSET"
# Morceau officiel SOUS LICENCE (optionnel) : episodes/<slug>/music/licence.(wav|mp3|m4a)
LIC=$(ls "$E"/music/licence.* 2>/dev/null | head -1 || true)
if [[ -n "$LIC" ]]; then
  $PY pipeline/licensed_beats.py "$E" "$LIC" ${LIC_ARGS:-}      # coupes calées sur les vrais temps du morceau
  pipeline/mix.sh "$E" "$LIC"
  MIXFILE="$E/build/mix_licensed.wav"
else
  pipeline/mix.sh "$E"
  MIXFILE="$E/build/mix.wav"
fi
mkdir -p "video/public/$S" "$E/out"; cp "$E/script.json" "$E/build/timeline.json" "$E/build/beats.json" "video/public/$S/"; cp "$MIXFILE" "video/public/$S/mix.wav"
cp "$E/build/captions.srt" "$E/out/$S$SUF.srt"
P="{\"slug\":\"$S\",\"audio\":\"$S/mix.wav\"}"
OUT="$E/out/${S}${SUF}_tiktok.mp4"
(cd video && npx remotion render src/index.ts Episode "../$OUT" --codec=h264 --audio-codec=aac --props="$P")
qc/check.sh "$OUT"
# Variantes audio sans re-rendu (copie de la vidéo, piste audio remplacée)
ffmpeg -y -loglevel error -i "$OUT" -i "$E/build/mix_voice_only.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${OUT%.mp4}_voix-seule.mp4"
echo "Variante voix seule (pour le son officiel TikTok) : ${OUT%.mp4}_voix-seule.mp4"
if [[ -f "$E/build/mix_licensed.wav" ]]; then
  ffmpeg -y -loglevel error -i "$OUT" -i "$E/build/mix_licensed.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest "${OUT%_tiktok.mp4}_licence.mp4"
  echo "Variante avec morceau sous licence : ${OUT%_tiktok.mp4}_licence.mp4"
fi
echo "Terminé en $(( $(date +%s) - T0 )) s — inspecter la planche-contact avant publication."
