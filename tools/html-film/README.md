# html-film

Render a web page to an MP4, frame by frame. The page is the film: it draws the state for any second `t` on
request, headless Chromium screenshots every frame time, ffmpeg encodes. Because nothing depends on wall-clock
time, the same page gives the same pixels on every run, at any resolution, with any number of parallel browsers.

Use it for films built from real UI (product demos, launch clips, explainers). For films drawn on a canvas with
a synthesized score, see [`films/postgres-history`](../../films/postgres-history).

## Setup

```bash
cd tools/html-film && npm ci      # playwright-core
```

- **Node 20+** and **ffmpeg** with libx264 on `PATH` (or `FFMPEG=/path/to/ffmpeg`).
- **A Chromium build.** The scripts use, in this order: `CHROME_PATH`, the newest Playwright headless shell in
  the Playwright cache, an installed Chrome/Chromium. To download one:
  `npx playwright-core install chromium-headless-shell`. The browser version is printed at the start of each run;
  pixels are only guaranteed identical for the same browser build.
- `npm test` renders the starter page to `build/template.mp4` (8 s, with motion blur) as a smoke test; it takes
  about a minute.

## The page contract

```js
window.__film = {
  fps: 60,
  duration: 37.32,        // seconds; may be set late, it is read after `ready`
  ready: promise,         // resolves when fonts, data and layout are in place
  seek(t) { ... },        // put everything on screen in the state for second t (may return a promise)
};
```

Rules for the page:

- Everything visible is a pure function of `t`. No CSS transitions, no timers, no `Date.now()`, no unseeded
  `Math.random()`. `seek()` is called in any order, from several browser processes at once.
- With GSAP: build one paused timeline and call `tl.time(t)` in `seek`; set `gsap.config({ force3D: false })`.
- Stray CSS animations are pinned to the same clock by the renderer (`--no-sync-css-animations` turns that off),
  but do not design with them.
- Bundle the fonts (`font-display: block`) and wait for them in `ready`; a fallback font is a different film.
- Load everything by relative URL. The film's folder (the nearest folder above the page that has a
  `package.json`) is served as a static site on 127.0.0.1 for the length of the run, so `../node_modules/...`
  works from `src/index.html`; `--root <dir>` serves another folder.
- `console.error`, uncaught exceptions, failed requests and HTTP errors stop the run: immediately while the page
  loads, and with the frame number during capture.

[`template/index.html`](template/index.html) is a dependency-free starter with the whole contract, a fixed
1080x1080 stage, captions per beat, a camera, a highlight ring, an end card and a preview scrubber.
[`films/pgprism-launch`](../../films/pgprism-launch) is a full film built this way.

## Commands

Paths below assume you run them from the film's folder (`films/<name>/`), after `npm ci` there if the film has
dependencies (fonts, GSAP). Output paths are relative to the current directory.

```bash
T=../../tools/html-film

# live preview with a scrubber (pages show it when they are not being captured)
node $T/serve.mjs --page src/index.html --query "t=12.5"

# stills and a contact sheet: the review tool. One frame per second, half size, labelled with the time.
# 4 columns x 8 rows per sheet (--cols changes that); more frames give sheet-1.jpg, sheet-2.jpg, ...
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --scale 0.5 --every 1 --sheet --out build/review
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --t 0.5,3,7.25 --out build/stills   # t0000.500.png ...
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --t 12.5 --subframes 8 --out build/stills   # with motion blur
node $T/still.mjs --page src/index.html --width 1080 --height 1080 --scale 2 --t 0 --out build/poster   # poster = frame 0

# draft: no motion blur, fast
node $T/render.mjs --page src/index.html --out build/draft.mp4 --width 1080 --height 1080

# final: 1080x1080 CSS px at 2x = 2160x2160, 8 sub-frames of motion blur per frame
node $T/render.mjs --page src/index.html --out build/film-2160x2160.mp4 --width 1080 --height 1080 --scale 2 \
  --subframes 8 --shutter 0.5 --chunk 30 --maxrate 28
node $T/render.mjs --page src/index.html --out build/film-1080x1080.mp4 --width 1080 --height 1080 \
  --subframes 8 --shutter 0.5 --chunk 30 --maxrate 16

# a small GIF for a README, cut from the rendered file
node $T/gif.mjs --in build/film-1080x1080.mp4 --out build/demo.gif --to 10 --width 600
```

`render.mjs` options:

| Option | Default | Meaning |
|---|---|---|
| `--page`, `--out` | required | the film page and the MP4 to write |
| `--root` | nearest folder above the page with a `package.json` | the folder to serve |
| `--width`, `--height` | 1920, 1080 | viewport in CSS px; use the page's stage size |
| `--scale` | 1 | device pixel ratio: 2 renders the same layout at twice the pixels |
| `--fps`, `--from`, `--to` | page values | frame rate and the time range to render |
| `--workers` | 6 | browser processes capturing in parallel |
| `--subframes`, `--shutter` | 1, 0.5 | motion blur: N sub-frames spread over `shutter` × the frame interval, averaged in linear light |
| `--chunk` | 60 | frames captured, averaged, piped to the encoder and deleted per round; lower it when disk is tight (the run stops below 3 GiB free) |
| `--crf`, `--maxrate` | 16, none | x264 quality, and an optional bitrate cap in Mbit/s |
| `--audio` | none | a WAV/MP3 to mux as AAC |
| `--reset` | `display` | `display`, `far` or `none`, see below |
| `--query` | none | query string passed to the page |
| `--color-scheme` | `dark` | `prefers-color-scheme` seen by the page |
| `--keep-frames` | off | keep the final PNG frames, in `.frames-<name>/` next to the output |
| `--no-sync-css-animations` | off | do not pin CSS/Web Animations to the film clock |

Output is H.264 High, yuv420p, BT.709 limited range, tagged, with `+faststart`. Rough speed on a 10-core Apple
silicon laptop with 6 workers: a 37 s film at 2160x2160 with 8 sub-frames takes about 20 minutes; a 1080x1080
draft without blur takes about a minute.

## Why the output is deterministic

- **Seek, then two animation frames, then capture.** Style, layout and paint of the new state are committed
  before the screenshot.
- **Reset before every capture.** Chromium does not always fully repaint an element whose transform moved by
  ~0.01 px since the last painted frame, so the anti-aliasing would depend on which frame the page showed
  before, that is on worker count and order. `--reset display` hides `<html>` for one painted frame first
  (cheapest); `--reset far` paints the state half a film away first (use it if the page reacts to being hidden);
  `--reset none` is fastest and can differ by ±1 in a few edge pixels between runs.
- **One browser process per worker.** Independent compositors, about 40% faster than tabs in one browser.
- **Motion blur in linear light.** Sub-frames are converted sRGB → linear with exact lookup tables, averaged,
  and converted back; a self-test proves static pixels come back bit-identical before real frames are touched.
- **Frames go straight to one running encoder** chunk by chunk, so a long 4K render never needs the whole
  frame set on disk.

## Files

| File | Purpose |
|---|---|
| `render.mjs` | page → MP4 |
| `still.mjs` | stills, blurred stills, contact sheets, posters (default output folder: `build/stills`) |
| `gif.mjs` | MP4 → palette-optimized GIF |
| `serve.mjs` | preview server |
| `lib.mjs` | static server, browser launch, seek + capture, blur, encoder pipe |
| `template/index.html` | starter film page |
