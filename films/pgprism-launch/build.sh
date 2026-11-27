#!/usr/bin/env bash
# Build the film into build/. Usage: ./build.sh [draft|share|master|poster|all]
#   draft   1080x1080, no motion blur: a quick look at timing (about a minute)
#   share   1080x1080 with motion blur: the file to post
#   master  2160x2160 with motion blur (about 20 minutes on Apple silicon)
#   poster  frame 0 at 2160x2160, PNG
#   all     share + master + poster (default)
set -euo pipefail
cd "$(dirname "$0")"
tool=../../tools/html-film
[ -d node_modules ] || npm ci
[ -d "$tool/node_modules" ] || (cd "$tool" && npm ci)
node verify/check.mjs                      # on-screen numbers still match the plan and the bundle

size=(--page src/index.html --width 1080 --height 1080)
blur=(--subframes 8 --shutter 0.5 --chunk 30 --workers "${WORKERS:-6}")
draft()  { node "$tool/render.mjs" "${size[@]}" --out build/pgprism-launch-draft.mp4 --workers "${WORKERS:-6}" --crf 20; }
share()  { node "$tool/render.mjs" "${size[@]}" --out build/pgprism-launch-1080x1080.mp4 "${blur[@]}" --maxrate 16; }
master() { node "$tool/render.mjs" "${size[@]}" --scale 2 --out build/pgprism-launch-2160x2160.mp4 "${blur[@]}" --maxrate 28; }
poster() { node "$tool/still.mjs" "${size[@]}" --scale 2 --t 0 --out build/poster; }

case "${1:-all}" in
  draft) draft ;;
  share) share ;;
  master) master ;;
  poster) poster ;;
  all) share; master; poster ;;
  *) echo "usage: $0 [draft|share|master|poster|all]" >&2; exit 2 ;;
esac
ls -la build/*.mp4 build/poster/*.png 2>/dev/null || true
