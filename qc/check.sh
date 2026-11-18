#!/usr/bin/env bash
# Contrôle qualité d'un MP4 d'épisode. Usage: qc/check.sh video.mp4 [contact.png]
# Échoue (code 1) si un critère n'est pas respecté.
set -uo pipefail
V="$1"; C="${2:-${V%.mp4}_contact.png}"; FAIL=0
probe() { ffprobe -v error -select_streams "$1" -show_entries "$2" -of default=nw=1:nk=1 "$V" | head -1; }
W=$(probe v:0 stream=width); H=$(probe v:0 stream=height); FPS=$(probe v:0 stream=r_frame_rate)
VC=$(probe v:0 stream=codec_name); AC=$(probe a:0 stream=codec_name)
D=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$V")
ok() { echo "  OK   $1"; }; ko() { echo "  FAIL $1"; FAIL=1; }
echo "QC $V"
[[ "$W" == 1080 && "$H" == 1920 ]] && ok "résolution ${W}x${H}" || ko "résolution ${W}x${H}"
[[ "$FPS" == "30/1" ]] && ok "fps $FPS" || ko "fps $FPS"
[[ "$VC" == h264 ]] && ok "vidéo $VC" || ko "vidéo $VC"
[[ "$AC" == aac ]] && ok "audio $AC" || ko "audio $AC"
awk "BEGIN{exit !($D>60)}" && ok "durée ${D}s > 60" || ko "durée ${D}s <= 60"
L=$(ffmpeg -nostats -i "$V" -af ebur128=peak=true -f null - 2>&1 | awk '/I:/{i=$2} /Peak:/{p=$2} END{print i, p}')
read -r LUFS PEAK <<<"$L"
awk "BEGIN{exit !($LUFS>-17 && $LUFS<-11)}" && ok "loudness $LUFS LUFS" || ko "loudness $LUFS LUFS (cible -14)"
awk "BEGIN{exit !($PEAK<-0.5)}" && ok "true peak $PEAK dBFS" || ko "true peak $PEAK dBFS (écrêtage ?)"
BL=$(ffmpeg -nostats -i "$V" -vf blackdetect=d=0.5:pic_th=0.95 -an -f null - 2>&1 | grep -c black_start)
[[ "$BL" == 0 ]] && ok "aucun écran noir > 0.5s" || ko "$BL écran(s) noir(s)"
FR=$(ffmpeg -nostats -i "$V" -vf freezedetect=n=0.001:d=4 -an -f null - 2>&1 | grep -c freeze_start)
[[ "$FR" == 0 ]] && ok "aucune image figée > 4s" || ko "$FR image(s) figée(s) > 4s"
ffmpeg -y -loglevel error -i "$V" -vf "fps=1/3,scale=216:384,tile=8x3" -frames:v 1 "$C" && echo "  planche-contact : $C (à inspecter)"
exit $FAIL
