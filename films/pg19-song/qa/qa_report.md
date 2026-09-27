# QA report

## 1. Readability (full reveal → removal ≥ 0.5 s)
- lyric lines: 45/45 pass; min hold 0.61 s
- burst cards: 7/7 pass; min hold 0.57 s

## 2. Word sync (first visible frame − whisper onset)
- words checked: 310; max |error| 0.89 frames (29.7 ms); mean |error| 0.26 frames
- PASS: every checked reveal is within <1 frame of its word onset
- words with no visible reveal of their own: 26 (spoken bridge lines shown as typed feature names; 'at the' shown as a small tag on the KNOCKING card; burst repeats)
  - 6.1:at, 6.1:the

## 3. Hits on beats
- burst-card cuts (placed on the vocal onset): offset to nearest 8th-note: 3.0.0:-1.5f, 3.0.1:-0.7f, 3.1.0:-2.8f, 3.1.4:+2.1f, 6.0.0:-1.0f, 6.1.0:+0.7f, 6.1.4:-1.5f
  - within ±2 frames of an 8th-note: 5/7
- section cuts on the downbeat grid: 8/8 within 1.5 frames (max 1.1 f)
- beat pulse, hit flashes and ring pulses are driven directly by the fitted grid / drum-stem onsets (0 offset by construction)

## 4. A/V
- video frames 6245 (expected 6245), video 208.167 s, audio 208.152 s
