#!/usr/bin/env bash
# Production complète d'un clip à partir d'un dossier projet contenant storyboard.json + scenes.js
#   bash produce.sh <projet> [--workers N]
# Étapes : polices -> validation storyboard -> rendu vidéo -> positions du texte -> QA -> livrables
set -euo pipefail
P="$(cd "$1" && pwd)"; shift || true
S="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$P/work"

echo "== 1/6 Polices"
FONTS=$(python3 -c "import json,sys;print('\n'.join(json.load(open('$P/storyboard.json'))['style'].get('fonts',['Anton'])))")
mapfile -t FARR <<< "$FONTS"
python3 "$S/fonts.py" --project "$P" "${FARR[@]}"

echo "== 2/6 Validation du storyboard"
LYR=(); [ -f "$WORK/lyrics.json" ] && LYR=(--lyrics "$WORK/lyrics.json")
python3 "$S/storyboard.py" check "$P/storyboard.json" "${LYR[@]}" --scenes "$P/scenes.js"

echo "== 3/6 Rendu vidéo (Chromium -> H.264, sans audio)"
node "$S/render.mjs" --project "$P" "$@"

echo "== 4/6 Mesure des zones de texte"
node "$S/render.mjs" --project "$P" --rects >/dev/null

echo "== 5/6 Contrôle qualité"
set +e; python3 "$S/qa.py" "$P"; QA=$?; set -e

echo "== 6/6 Livrables"
AUD=(); [ -f "$WORK/audio.json" ] && AUD=(--audio-json "$WORK/audio.json")
python3 "$S/finalize.py" "$P" "${AUD[@]}"
ls -la "$P" | grep -E "video_finale|synchronisation|storyboard.json|direction_artistique|contact_sheet|qa_report"
exit $QA
