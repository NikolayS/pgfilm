#!/usr/bin/env bash
# Contact sheet from stills or from a rendered video (tiles in time order, left→right, top→bottom).
#   tools/contact.sh stills <out.jpg> <t1,t2,...>     render those stills with the renderer, tile 4 across
#   tools/contact.sh video  <out.jpg> <video> [every_s] frame every N s (default 3) from a video, tile 6 across
set -euo pipefail
cd "$(dirname "$0")/.."
FONT=assets/fonts/JetBrainsMono.ttf
tmp=$(mktemp -d)
if [ "$1" = stills ]; then
  node src/render.mjs --stills "$3" --dir "$tmp/raw" >/dev/null
  i=0; for f in $(ls "$tmp/raw" | sort -t_ -k2 -g); do ts=${f#s_}; ts=${ts%.jpg}; ts=$(echo $ts | sed 's/^0*//; s/^\./0./')
    ffmpeg -v error -y -i "$tmp/raw/$f" -vf "scale=640:360" "$tmp/$(printf %04d $i).png"; i=$((i+1)); done
  cols=4
else
  every=${4:-3}
  ffmpeg -v error -y -i "$3" -vf "fps=1/$every,scale=480:270" "$tmp/%04d.png"
  cols=6
fi
n=$(ls "$tmp"/*.png | wc -l | tr -d ' '); rows=$(( (n + cols - 1) / cols ))
ffmpeg -v error -y -framerate 1 -i "$tmp/%04d.png" -vf "tile=${cols}x${rows}:padding=4:color=0x333333" -frames:v 1 -q:v 3 "$2"
rm -rf "$tmp"; echo "$2 ($n frames)"
