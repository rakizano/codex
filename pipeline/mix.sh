#!/usr/bin/env bash
# Mix voix + musique originale + sfx, ducking (sidechain) et normalisation -14 LUFS.
# Usage: mix.sh <episode_dir> [licensed_track.wav]
# - music_bed (beat original) : audible sous la voix (~ -14 dB), remonte dans les pauses et music_breaks.
# - 2e argument OPTIONNEL : morceau officiel dont tu détiens la licence -> mix_licensed.wav
#   (remplace le beat original ; ducking plus fort pour garder la voix intelligible).
set -euo pipefail
B="$1/build"; OFF="${VOICE_OFFSET:-0.6}"; D=$(awk "BEGIN{print int($OFF*1000)}")
VOICE="[0:a]loudnorm=I=-18:TP=-2,aformat=sample_rates=44100:channel_layouts=stereo,adelay=${D}|${D},asplit=2[v][sc]"
if [[ $# -ge 2 ]]; then
  ffmpeg -y -loglevel error -i "$B/voice.wav" -i "$2" -i "$B/sfx.wav" -filter_complex "\
$VOICE;[1:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.9[m];\
[m][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350:makeup=1[md];\
[2:a]volume=0.5[fx];\
[v][md][fx]amix=inputs=3:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 "$B/mix_licensed.wav"
  echo "[mix] mix_licensed.wav"
fi
ffmpeg -y -loglevel error -i "$B/voice.wav" -i "$B/music_bed.wav" -i "$B/sfx.wav" -filter_complex "\
$VOICE;\
[1:a]volume=0.33,equalizer=f=2500:t=q:w=1.5:g=-3[bed0];\
[bed0][sc]sidechaincompress=threshold=0.02:ratio=6:attack=25:release=450:makeup=1[bed];\
[2:a]volume=0.3[fx];\
[v][bed][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 "$B/mix.wav"
echo "[mix] mix.wav (beat original, sans musique commerciale)"
# Variante voix + bruitages SANS beat : pour ajouter le son officiel dans TikTok sans conflit musical.
ffmpeg -y -loglevel error -i "$B/voice.wav" -i "$B/sfx.wav" -filter_complex "\
[0:a]loudnorm=I=-18:TP=-2,aformat=sample_rates=44100:channel_layouts=stereo,adelay=${D}|${D}[v];[1:a]volume=0.3[fx];\
[v][fx]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 "$B/mix_voice_only.wav"
echo "[mix] mix_voice_only.wav (pour le son officiel TikTok)"
