#!/usr/bin/env bash
# Mix voix + nappe + sfx avec ducking (sidechain) et normalisation ~ -14 LUFS.
# Usage: mix.sh <episode_dir> [licensed_track.wav]
# Le 2e argument (morceau sous licence) est optionnel : sans lui, AUCUNE musique commerciale.
set -euo pipefail
B="$1/build"
if [[ $# -ge 2 ]]; then
  ffmpeg -y -loglevel error -i "$B/voice.wav" -i "$B/music_bed.wav" -i "$B/sfx.wav" -i "$2" -filter_complex "\
[0:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=600|600,asplit=2[v][sc];\
[3:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.6[m];\
[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[md];\
[1:a]volume=0.25[bed];[2:a]volume=0.5[fx];\
[v][md][bed][fx]amix=inputs=4:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 "$B/mix_licensed.wav"
  echo "[mix] mix_licensed.wav"
fi
ffmpeg -y -loglevel error -i "$B/voice.wav" -i "$B/music_bed.wav" -i "$B/sfx.wav" -filter_complex "\
[0:a]aformat=sample_rates=44100:channel_layouts=stereo,adelay=600|600,asplit=2[v][sc];\
[1:a]volume=0.55[bed0];[bed0][sc]sidechaincompress=threshold=0.03:ratio=6:attack=30:release=500[bed];\
[2:a]volume=0.5[fx];\
[v][bed][fx]amix=inputs=3:normalize=0:duration=longest,loudnorm=I=-14:TP=-1.5:LRA=11" -ar 44100 "$B/mix.wav"
echo "[mix] mix.wav (sans musique commerciale)"
