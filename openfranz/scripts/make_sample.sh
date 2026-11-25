#!/usr/bin/env bash
# Generate a small sample Reel for testing the ingest pipeline.
# Requires macOS `say`, ffmpeg, and ffprobe.
set -euo pipefail

OUT="${1:-/tmp/openfranz-sample.mp4}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

FONT="/System/Library/Fonts/Supplemental/Arial.ttf"
if [ ! -f "$FONT" ]; then
  FONT="/System/Library/Fonts/Helvetica.ttc"
fi

say -o "$TMP/voice.aiff" \
  "Open on the result, then rewind to the failed attempt. That is the hook that keeps people watching."

ffmpeg -y -loglevel error -i "$TMP/voice.aiff" -af "apad=pad_dur=6" -t 12 "$TMP/voice.wav"

if [ -f "$FONT" ]; then
  FILTER="drawtext=fontfile=$FONT:text='RESULT':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,4)',drawtext=fontfile=$FONT:text='FAILED ATTEMPT':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,4,8)',drawtext=fontfile=$FONT:text='18 HOURS':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,12)'"
else
  FILTER="drawtext=text='RESULT':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,4)',drawtext=text='FAILED ATTEMPT':fontsize=56:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,4,8)',drawtext=text='18 HOURS':fontsize=72:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,8,12)'"
fi

ffmpeg -y -loglevel error \
  -f lavfi -i "color=c=0x111111:s=720x1280:d=12:r=30" \
  -i "$TMP/voice.wav" \
  -vf "$FILTER" \
  -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 128k \
  "$OUT"

echo "Wrote $OUT"
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$OUT"
