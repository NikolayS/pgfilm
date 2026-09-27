# PG19 song: "Must Be Reliable"

**Status: rendered, in review.** 3:28, 1080p30. QA (`qa/qa_report.md`): 45/45 lyric lines and 7/7 burst cards hold ≥ 0.5 s after full reveal; word-sync max error 0.89 frames (mean 0.26) over 310 words; 8/8 section cuts on the downbeat grid; 6245/6245 frames.

A 3:28 lyric music video about PostgreSQL 19 and the year open source had in 2026. PostgreSQL shipped 44 CVE fixes in 2026, four betas, and reverted features rather than ship them shaky, because "first and foremost, PostgreSQL must be reliable."

The song was generated with the ElevenLabs Music API. Every frame of the picture is drawn by code, timed to the sung words, and every on-screen number, name and hash is verified against git or a primary source.

## Pipeline
1. **Song**: `audio/compose.py` sends a 12-chunk composition plan (`music_v2_5`, 128 BPM, 111 bars) to `POST /v1/music/detailed`. The plan sets per-section lyrics and styles: a felt-piano intro, verses, pre-choruses, choruses, a spoken bridge with the music dropped, a solo sung quote, a build, a lifted final chorus and a piano outro. Three takes were made (male lead, female lead, duet). The API key is read from `ELEVENLABS_API_KEY` only.
2. **Fact-check of the takes**: `tools/transcribe.py` runs faster-whisper large-v3-turbo with no lyric prompt, and `tools/analyze_take.py` measures lyric recall, sung numbers, BPM, per-section and percussive loudness, the bridge drop and the key. See `audio/takes.md`: take A is the only one that sings every number correctly.
3. **Stem remix**: `audio/remix.py` uses the ElevenLabs stems of take A (vocals, drums, bass, guitar, piano, other) to fix the two sections where the model ignored the plan. In the spoken bridge the drums and bass drop out, the bed is filtered and a clock ticks. In the build the drums return slowly. The rest is the untouched mix, spliced with 40 ms crossfades; the master is −14 LUFS.
4. **Timing**: `tools/timing.py` aligns the lyric words to whisper output on the vocal stem, the full mix, and finally the API's forced-alignment timestamps, then snaps each word to a vocal onset. It fits a beat grid to the drum stem (127.997 BPM, p90 residual 7.5 ms). Output goes to `assets/words.json` and `assets/beats.json`.
5. **Picture**: `src/` is a Node renderer on skia-canvas, in the same approach as `films/postgres-history`. `scenes.mjs` gives every lyric line its own literal visual, cut on the vocal onset. `render.mjs` adds the HUD, camera drift, bloom, grain, and renders in parallel segments.
6. **QA**: `tools/qa.py` checks that every lyric line is fully revealed at least 0.5 s before it leaves, that word-sync error stays under 1 frame against the whisper timings, that hits sit on the beat grid, and the A/V frame count. `tools/contact.sh` makes contact sheets.

## Visual spine
- An orange CVE counter climbs 0 → 5 → 16 → 44 and freezes in the bridge. In the final chorus a second counter runs the PG19 open items from 176 down to 9.
- A recurring `psql=# SELECT hope FROM pg19_betaN;` returns `(0 rows)` for beta 1–3 and `(1 row)`, "must be reliable", after the bridge.
- One-word burst cards (FORTY / FOUR / KNOCKING / DOOR) alternate cream and black, with an orange frame first.
- The bridge is black with one cursor, which blinks on the clock ticks. Each reverted feature is typed and struck through with its real revert commit. Then the quote appears alone, in serif italic.
- The build is a commit wall of the 762 real commits between REL_19_BETA1 and REL_19_BETA4, with "fix" lit orange.
- In the final chorus the palette flips to dawn. Slonik appears, and "30 years" is marked with 1996 → 2026 ticks.
- The ending is a tiny `COMMIT`.
- The palette is near-black, cream and one orange. Type is Archivo Black for the hits, JetBrains Mono for UI and data, and Instrument Serif italic for the quiet lines (all SIL OFL, fetched by `tools/fetch-fonts.sh`).

## Build
Requirements: Node 20+, ffmpeg, and Python 3 with numpy, scipy, librosa and faster-whisper for the audio tools.
```bash
./build.sh                                # needs the final audio; TAKES=<dir with final/must-be-reliable.wav>
node src/render.mjs --stills 44.6,146    # preview frames -> build/stills/
tools/contact.sh video qa/sheets/v.jpg build/pg19-must-be-reliable.mp4 3
```
The audio (takes, stems, remix) and the rendered video are not in git. They'll be attached to a GitHub Release when final.

## Assets
- The song was generated with the ElevenLabs Music API (`music_v2_5`, take A, seed 1901) from our lyrics and composition plan, then remixed from its ElevenLabs stems.
- `assets/slonik.svg`: the PostgreSQL elephant logo (a PostgreSQL Community Association trademark, used per its trademark policy).
- Fonts (SIL OFL, fetched by `tools/fetch-fonts.sh`): Archivo Black, Instrument Serif, JetBrains Mono.
- `assets/heapam_excerpt.txt`: lines 1434–1480 of `src/backend/access/heap/heapam.c` at `REL_19_BETA4` (PostgreSQL License).
- `assets/commits.json`: commit hashes, dates, committers and subjects for `REL_19_BETA1..REL_19_BETA4`, from `tools/commits.py`.

## Facts
Every sung or on-screen claim is in [`verify/claims.md`](verify/claims.md), mapped to a git command and SHA or a primary URL.
