#!/usr/bin/env bash
# Full build: fonts → frames → score → mux → sync verification → share copy.  Output in build/.
set -euo pipefail
cd "$(dirname "$0")"
tools/fetch-fonts.sh >/dev/null
[ -d node_modules ] || npm ci
node src/render.mjs --out build/video.mp4          # also writes build/timeline.json (bar grid, word pops, typing)
python3 audio/music.py                             # score from the same timeline → build/score.wav
ffmpeg -v error -y -i build/video.mp4 -i build/score.wav -c:v copy -c:a aac -b:a 256k build/postgres_history.mp4
python3 tools/synccheck.py build/postgres_history.mp4
ffmpeg -v error -y -i build/postgres_history.mp4 -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -c:a copy \
  -movflags +faststart build/postgres_history_share.mp4
ls -la build/*.mp4
