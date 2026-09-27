# Visual review log

## Round 0 (first stills)
- Captions collided with the heapam code block and the town skyline, and the previous and current caption lines overlapped while sliding.
- The top-right counter showed "9" in one still. That was a mid-roll frame of the 5 → 16 roll (it lasted 0.5 s).
- The "Seven last year" bar chart was tiny.

## Round 1
- Captions sit in a lower-third band with a soft scrim. The current line is at the bottom and the previous line is dimmed above it. No slide.
- Scene content stays above y ≈ 790: the code view is capped at 17 lines, and the labels in may11, most, maint, repack and outro moved up.
- Counter rolls take 0.2 s, so stills never catch intermediate values. The counter narrative is: 0 → 5 on "Five" (Feb 12), 16 on "eleven" (May 14), and 44 across the first "forty-four". The scanner and ghosts lines come after "May brought eleven", so 16 is correct there.
- The chart is now huge: 7/7/7, then the 2026 bar grows off the top of the frame to 44. The heap cells and the "heap overflow" label are bigger.

## Round 2
- Final chorus HUD: the CVE counter steps left and dims, and the open-items counter (176 → 9) takes the corner.
- Ending: the HUD fades with the scene, so only the tiny `psql=# COMMIT;` / `COMMIT` remains on black.
- "hundred" is no longer orange in "Four hundred thirty-nine" (the key word there is "fix").
- Burst readability: in chorus 1 the two "knocking"s share one card, and the second knock flips it cream/black and shakes it. In chorus 2 the two "forty-four"s do the same. Every card now holds at least 0.57 s.

## Render fixes
- Workers failed under Metal GPU contention, so rendering is CPU-only.
- Frames now go to ffmpeg through a named FIFO (a Node pipe caused EAGAIN truncation).
- Canvases are recreated every frame. skia-canvas's lazy op recording, combined with the bloom's canvas→canvas copy, made frame time grow exponentially.

## Known weaknesses (not fixed, time-boxed)
- The post-chorus "44" holds (about 8 s each) are mostly static.
- Burst cuts follow the vocal onset, which is up to 2.8 frames ahead of or behind the 8th-note grid (5/7 are within ±2 frames).
- The fcst scene counts up to ≈66, so mid-count values show briefly.
- No true key change in the song.
