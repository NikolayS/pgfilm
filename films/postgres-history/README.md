# Postgres history: 1970 → 2026

**Watch:** [on X](https://x.com/samokhvalov/status/2103920825581842567) · [on LinkedIn](https://www.linkedin.com/posts/samokhvalov_this-one-is-about-postgres-40-years-1986-ugcPost-7509685236369252353-XYly/) · [download (Releases)](https://github.com/NikolayS/pgfilm/releases/tag/postgres-history-2026-09-26)

A 2:42, 1080p30 motion-graphics film: from Codd's 1970 paper through Berkeley (Ingres, POSTGRES), Postgres95, the 1996 first commit, 30 years of releases, the people who built it, AI, and what is being debated next.

## How it's made
- **Picture** — `src/`: a Node renderer on [skia-canvas](https://github.com/samizdatco/skia-canvas). `scenes.mjs` holds 36 scenes, each a whole number of bars at its tempo; `render.mjs` adds the HUD (year, timeline, live commit counter), post-FX, beat pulse, and pipes raw frames to ffmpeg.
- **Music** — `audio/music.py`: an original score synthesized with numpy/scipy (D major → key change to E major; 120 → 132 → 150 BPM). It reads `build/timeline.json` written by the renderer, so scene cuts, word pops (bells), and typing (one click per revealed character) land on the same sample/frame grid.
- **Sync verification** — `tools/synccheck.py` (audio vs score cross-correlation, every scene cut on its frame, frame count) and `tools/avsync.py` (synth event log vs visual kick pulse).

## Build
Requirements: Node 20+, Python 3 with numpy + scipy, ffmpeg.
```bash
./build.sh            # → build/postgres_history.mp4 (+ _share.mp4), ~4–5 min on Apple silicon
node src/render.mjs --stills 12,60.5   # preview frames → build/stills/
```

## Facts
Every on-screen claim is in [`verify/claims.md`](verify/claims.md). Repo-verifiable claims are pinned in the pgBSdetector citation style (commit SHA + path + line range + exact quote, re-checked byte-for-byte with `git show`); external claims are quoted from primary pages. Feature credits come from the release notes of each major version (`verify/feature_credits.json`).

Data: commit counts from `upstream/master` of postgres.git (3c5d9d914fa, 2026-09-26): 65,484 commits; the people wall (`assets/people.json`, 1,532 names) is rebuilt with `python3 tools/people.py <postgres-repo> upstream/master`.

## Assets
- `assets/slonik.svg` — the PostgreSQL elephant logo (PostgreSQL Community Association trademark; used per its trademark policy).
- `assets/land.json` — Natural Earth 1:110m land (public domain).
- Fonts (fetched by `tools/fetch-fonts.sh`, SIL OFL): Cinzel, EB Garamond, JetBrains Mono.
