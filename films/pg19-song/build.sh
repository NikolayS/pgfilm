#!/usr/bin/env bash
# Full build: fonts → frames (parallel) → mux with the remixed take → share copy. Output in build/.
# The audio is not in git: set TAKES to the folder holding final/must-be-reliable.wav (see audio/README.md).
set -euo pipefail
cd "$(dirname "$0")"
TAKES=${TAKES:-$HOME/Desktop/pg19-song/takes}
tools/fetch-fonts.sh >/dev/null
[ -d node_modules ] || npm ci
node src/render.mjs --out build/video.mp4 --jobs ${JOBS:-6}          # also writes build/timeline.json and build/rec.json
ffmpeg -v error -y -i build/video.mp4 -i "$TAKES/final/must-be-reliable.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k build/pg19-must-be-reliable_master.mp4
python3 tools/qa.py build/pg19-must-be-reliable_master.mp4
ffmpeg -v error -y -i build/pg19-must-be-reliable_master.mp4 -c:v libx264 -preset slow -crf 20 -maxrate 3M -bufsize 6M -pix_fmt yuv420p -c:a aac -b:a 256k \
  -movflags +faststart build/pg19-must-be-reliable.mp4
ls -la build/*.mp4
