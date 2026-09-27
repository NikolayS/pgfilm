#!/usr/bin/env bash
# Fonts are SIL OFL (Google Fonts); fetched at build time rather than committed.
set -euo pipefail
cd "$(dirname "$0")/../assets"; mkdir -p fonts; cd fonts
base=https://github.com/google/fonts/raw/main/ofl
[ -f ArchivoBlack.ttf ]          || curl -fsSL -o ArchivoBlack.ttf          "$base/archivoblack/ArchivoBlack-Regular.ttf"
[ -f InstrumentSerif-Italic.ttf ] || curl -fsSL -o InstrumentSerif-Italic.ttf "$base/instrumentserif/InstrumentSerif-Italic.ttf"
[ -f InstrumentSerif.ttf ]       || curl -fsSL -o InstrumentSerif.ttf       "$base/instrumentserif/InstrumentSerif-Regular.ttf"
[ -f JetBrainsMono.ttf ]         || curl -fsSL -o JetBrainsMono.ttf         "$base/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
ls -la
