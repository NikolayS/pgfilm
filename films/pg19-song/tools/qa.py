"""QA for the rendered film. usage: python3 tools/qa.py build/<master>.mp4   (run from the film folder, after render)
Checks:
  1. readability: every lyric line / burst card is fully revealed >= 0.5 s before it leaves the screen (build/timeline.json)
  2. word sync: first frame each lyric word is drawn (build/rec.json, recorded by the renderer) vs whisper timing (assets/words.json)
  3. hits on beats: burst-card cuts and section cuts vs the drum-stem beat grid (assets/beats.json)
  4. A/V: frame count and durations of the muxed file
Writes qa/qa_report.md.
"""
import json, subprocess, sys
mp4 = sys.argv[1]
FPS = 30
TL = json.load(open('build/timeline.json')); REC = json.load(open('build/rec.json'))
WORDS = json.load(open('assets/words.json')); B = json.load(open('assets/beats.json'))
out = []; P = lambda s='': (print(s), out.append(s))

P('# QA report\n')
# 1 readability
bad = [l for l in TL['lines'] if l['hold'] < 0.5]; badc = [c for c in TL['cards'] if c['hold'] < 0.5]
P(f"## 1. Readability (full reveal → removal ≥ 0.5 s)\n- lyric lines: {len(TL['lines']) - len(bad)}/{len(TL['lines'])} pass; min hold {min(l['hold'] for l in TL['lines']):.2f} s")
for l in bad: P(f"  - FAIL {l['id']} “{l['text']}” hold {l['hold']:.2f} s")
P(f"- burst cards: {len(TL['cards']) - len(badc)}/{len(TL['cards'])} pass; min hold {min(c['hold'] for c in TL['cards']):.2f} s")
for c in badc: P(f"  - FAIL card {c['key']} {c['words']} hold {c['hold']:.2f} s")

# 2 word sync
errs = []; missing = []
for i, w in enumerate(WORDS):
    f = REC['words'].get(str(i))
    if f is None: missing.append(w); continue
    errs.append((f / FPS - w['t']) * FPS)
# card words (bursts) and scene-drawn words
for pre in ('3', '6'):
    L0 = [w for w in WORDS if w['line'] == pre + '.0']; L1 = [w for w in WORDS if w['line'] == pre + '.1']
    for key, w in ((f'{pre}.0.0', L0[0]), (f'{pre}.0.1', L0[1]), (f'{pre}.1.0', L1[0]), (f'{pre}.1.4', L1[4])):
        f = REC['marks'].get(f'flash_{key}', REC['marks'].get(f'card_{key}'))
        if f is not None: errs.append((f / FPS - w['t']) * FPS); missing = [m for m in missing if m is not w]
    f = REC['marks'].get(f'flip_{pre}.1.0')   # second "knocking" = the in-place flip of the KNOCKING card
    if f is not None: errs.append((f / FPS - L1[1]['t']) * FPS); missing = [m for m in missing if m is not L1[1]]
    f = REC['marks'].get(f'flip_{pre}.0.0')   # second "forty-four" as an in-place flip (chorus 2)
    if f is not None: errs.append((f / FPS - L0[1]['t']) * FPS); missing = [m for m in missing if m is not L0[1]]
for lid, gi in (('7.1', 2), ('7.2', 2), ('7.3', 3), ('7.4', 4)):
    w = [x for x in WORDS if x['line'] == lid][gi]; f = REC['marks'].get('gone_' + lid)
    if f is not None: errs.append((f / FPS - w['t']) * FPS); missing = [m for m in missing if m is not w]
mx = max(abs(e) for e in errs)
P(f"\n## 2. Word sync (first visible frame − whisper onset)\n- words checked: {len(errs)}; max |error| {mx:.2f} frames ({mx / FPS * 1000:.1f} ms); mean |error| {sum(abs(e) for e in errs) / len(errs):.2f} frames")
P(f"- {'PASS' if mx < 1 else 'FAIL'}: every checked reveal is within {'<1' if mx < 1 else '>=1'} frame of its word onset")
sung_missing = [m for m in missing if m['line'] not in ('3.1',) and not m['line'].startswith('7.')]
P(f"- words with no visible reveal of their own: {len(missing)} (spoken bridge lines shown as typed feature names; 'at the' shown as a small tag on the KNOCKING card; burst repeats)")
if sung_missing: P('  - ' + ', '.join(f"{m['line']}:{m['w']}" for m in sung_missing[:40]))

# 3 hits on beats
per = B['period']; ph0 = B['beats'][0]
def off(t, div):  # offset to nearest grid point at beat/div, in frames
    g = per / div; k = round((t - ph0) / g); return (t - (ph0 + k * g)) * FPS
cardc = [(c['key'], c['show']) for c in TL['cards']]
co = [off(t, 2) for _, t in cardc]
sec_cuts = [s for s in TL['scenes'] if any(abs(s['t0'] - b) < 0.05 for b in B['bounds'][1:])]
so = [off(s['t0'] + 0.035, 1) for s in sec_cuts]  # plan boundary + 35 ms grid latency
P(f"\n## 3. Hits on beats\n- burst-card cuts (placed on the vocal onset): offset to nearest 8th-note: " + ', '.join(f'{k}:{o:+.1f}f' for (k, _), o in zip(cardc, co)))
P(f"  - within ±2 frames of an 8th-note: {sum(abs(o) <= 2 for o in co)}/{len(co)}")
P(f"- section cuts on the downbeat grid: {sum(abs(o) <= 1.5 for o in so)}/{len(so)} within 1.5 frames (max {max(abs(o) for o in so):.1f} f)")
P("- beat pulse, hit flashes and ring pulses are driven directly by the fitted grid / drum-stem onsets (0 offset by construction)")

# 4 A/V
pr = lambda sel: subprocess.run(['ffprobe', '-v', 'error', '-select_streams', sel, '-count_packets', '-show_entries', 'stream=nb_read_packets,duration', '-of', 'json', mp4], capture_output=True, text=True).stdout
v = json.loads(pr('v:0'))['streams'][0]; a = json.loads(pr('a:0'))['streams'][0]
P(f"\n## 4. A/V\n- video frames {v['nb_read_packets']} (expected {TL['frames']}), video {float(v['duration']):.3f} s, audio {float(a['duration']):.3f} s")
open('qa/qa_report.md', 'w').write('\n'.join(out) + '\n')
