#!/usr/bin/env bash
# Fonts are SIL OFL (Google Fonts); fetched at build time rather than committed.
set -euo pipefail
cd "$(dirname "$0")/../assets"; mkdir -p fonts; cd fonts
base=https://github.com/google/fonts/raw/main/ofl
[ -f Cinzel.ttf ]             || curl -fsSL -o Cinzel.ttf             "$base/cinzel/Cinzel%5Bwght%5D.ttf"
[ -f EBGaramond.ttf ]         || curl -fsSL -o EBGaramond.ttf         "$base/ebgaramond/EBGaramond%5Bwght%5D.ttf"
[ -f EBGaramond-Italic.ttf ]  || curl -fsSL -o EBGaramond-Italic.ttf  "$base/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf"
[ -f JetBrainsMono.ttf ]      || curl -fsSL -o JetBrainsMono.ttf      "$base/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf"
ls -la
