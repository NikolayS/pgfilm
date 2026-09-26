# Polish review — postgres_history_final.mp4 (2:39, 1920x1080/30fps)

Method: read `scenes.mjs`/`lib.mjs`/`render.mjs` to compute exact beat/second budgets for every `caption()`/`headline()` call against `scenes_timing.tsv`; extracted the full film at 4fps to `qa/frames/` (635 frames) and built labelled contact sheets per 4-scene block in `qa/sheets/`; pulled full-res single frames at flagged timestamps (`qa/*.jpg`) to confirm each finding visually. Findings below are all frame-confirmed, not just computed. Skipping praise per instructions — this is a punch list only.

---

## 1. [HIGH] `post` scene — citation caption is cut off before it can be read
**t ≈ 26.6–28.0s (scene `post`, 24.00–28.00s)**

The caption `"THE DESIGN OF POSTGRES" · STONEBRAKER & ROWE · SIGMOD 1986` doesn't start typing until beat 5.2 of an 8-beat (4.0s @ 120bpm) scene, and the typewriter effect takes 1.5 beats. It finishes rendering at **t=27.85s**, 0.15s before the hard cut to `types` at t=28.00s. Confirmed via full-res grabs at t=26.9 (nothing readable yet) and t=27.85 (fully typed, then cut). Effectively unreadable at normal viewing speed.

File: `scenes.mjs:153`
```js
caption(c, th, S, '"THE DESIGN OF POSTGRES" · STONEBRAKER & ROWE · SIGMOD 1986', W / 2 - 440, 780, 5.2) }
```
Fix — start the caption earlier (no bar-count change needed):
```js
caption(c, th, S, '"THE DESIGN OF POSTGRES" · STONEBRAKER & ROWE · SIGMOD 1986', W / 2 - 440, 780, 3.6) }
```
This finishes typing at beat 5.1 (t≈27.15s), leaving ~0.85s to read instead of ~0.15s. If more margin is wanted, bump `post` from `bars: 2` to `bars: 3` (adds one whole bar = 2.0s at 120bpm) and keep `at` around 4.0–4.5.

---

## 2. [MED] `montage2` — two release cards show 3–4 word titles in a fixed 0.8s window
**t ≈ 85.96–86.76s ("16 · LOGICAL DECODING ON STANDBYS") and t ≈ 87.56–88.36s ("17 · LOGICAL SLOT FAILOVER")**

`montageDraw()` gives every card exactly 2 beats (0.8s at 150bpm) regardless of text length — fine for 1–2 word cards (`UPSERT`, `MERGE`, `SKIP SCAN`), but "LOGICAL DECODING ON STANDBYS" is 4 words and "LOGICAL SLOT FAILOVER" is 3, both well under the ≈3-words/sec floor (need ≥1.0–1.3s). Confirmed in `qa/sheets/sheet_020_montage2_platform_awards_vector.jpg` — each card is only on screen for 3 sampled frames at 4fps.

File: `scenes.mjs:331`
```js
cards: [..., ['16', 'LOGICAL DECODING ON STANDBYS', 2023], ['17', 'INCREMENTAL BACKUP', 2024], ['17', 'LOGICAL SLOT FAILOVER', 2024], ...],
```
Fix — shorten the two long labels so they fit the fixed per-card budget (word count only, doesn't touch timing code):
```js
cards: [..., ['16', 'DECODING ON STANDBYS', 2023], ['17', 'INCREMENTAL BACKUP', 2024], ['17', 'SLOT FAILOVER', 2024], ...],
```

---

## 3. [MED] `end` scene — opening query flashes for ~0.36s before fading
**t ≈ 147.6–147.96s (scene `end`, 146.76–156.36s)**

`postgres=# SELECT * FROM future;` finishes typing at beat 3.6 (t=147.6s), but `globalAlpha = clamp((5 - b) / 0.5)` starts fading it out at beat 4.5 (t=147.96s) — a full-opacity hold of only 0.9 beat / 0.36s for a 5-word line, right at the start of the film's closing beat. This is the first thing the audience reads in the last 15 seconds, and it's gone before it registers.

File: `scenes.mjs:565`
```js
if (b < 5) { const n = Math.floor(clamp((b - 0.3) / 3.3) * 30); c.globalAlpha = clamp((5 - b) / 0.5)
```
Fix — push the hold/fade window out by ~0.6 beat:
```js
if (b < 5.6) { const n = Math.floor(clamp((b - 0.3) / 3.3) * 30); c.globalAlpha = clamp((5.6 - b) / 0.6)
```
(The slonik/title fade-in already starts at `b > 5`, so this only adds a brief, intentional-looking crossfade rather than a jump cut.)

---

## 4. [MED] `mandala` — HUD "ANNO" is frozen on "—" while the timeline scrubber sweeps 1970→2026 under it
**t ≈ 140.4–146.4s (whole `mandala` scene)**

Confirmed with frames at t=141.0 (scrubber marker at ~1980) and t=146.5 (marker past 2020): the year triangle on the bottom timeline visibly animates across the whole scene, but the big "ANNO" number above it stays on the em-dash placeholder the entire time. Every other scene in the film ties that number to the moving marker, so here it reads as a broken/unfinished readout rather than a deliberate "timeless" choice.

File: `render.mjs:58–64`
```js
let year = null
if (s.year) year = s.cards ? ... : Math.floor(lerp(s.year[0], s.year[1] + 0.999, S.u))
if (s.id === 'mandala') year = null
...
mono(c, s.yearText || (year ? String(year) : (s.act === 4 && !s.year ? '∞' : '—')), 96, H - 86, 38, th.ink, 4, 'left', 500)
```
Fix — give `mandala` an explicit `yearText` (the `s.yearText ||` fallback already exists and is otherwise unused here):
```js
// scenes.mjs:544
{ id: 'mandala', bars: 4, bpm: 150, act: 4, chap: 'XV · FINIS', theme: 'dark', year: [1970, 2026], yearText: '∞', hit: true, impact: true, climax: true,
```

---

## 5. [LOW] `montage` / `montage2` — alternating card backgrounds hard-cut every ~0.8–0.9s
**Throughout `montage` (58.18–65.45s) and `montage2` (79.56–89.16s)**

`montageDraw()` flips the full-frame background between the scene's base theme and `altBg` (near-black) on every other card with an instant `fillRect`, no fade — visible in `qa/sheets/sheet_012...jpg` and `sheet_020...jpg` as a hard flash-cut roughly once per second, twelve times in `montage2`. It's consistent (same rule every time) but reads as flicker rather than a designed beat.

File: `scenes.mjs:43`
```js
if (alt) { c.fillStyle = this.altBg || '#16130f'; c.fillRect(0, 0, W, H) }
```
Fix — fade the alt background in over the card's first ~0.15 beat instead of hard-cutting:
```js
if (alt) { c.globalAlpha = clamp(lb / 0.15); c.fillStyle = this.altBg || '#16130f'; c.fillRect(0, 0, W, H); c.globalAlpha = 1 }
```

---

*Not flagged after investigation (verified fine, noted so they aren't re-litigated): the bright horizontal band visible on many scene-opening frames (e.g. t=47.30, 76.37, 140.40) is just the base radial background gradient briefly unmasked before content draws over it — present every scene, not a transition bug. `aicode`'s commit-hash stamp (t≈110.6–111.56) is tight but readable at full res. Headline word-by-word pacing (default `step: 0.5`) stays within budget everywhere it's used.*
