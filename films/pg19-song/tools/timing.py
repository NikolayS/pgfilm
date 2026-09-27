"""Build the timing assets the renderer reads, from the chosen take (A) and its stems.

  assets/words.json  every lyric word with start/end (s), line and section ids, and the timing source
  assets/beats.json  beat grid (fit to kick onsets of the drum stem), downbeats, per-bar loudness, hits (strong onsets)

Word timing: lyric words (from the composition plan) are aligned with difflib to three transcripts in priority
order: faster-whisper on the vocal stem, faster-whisper on the full mix, then the ElevenLabs API word timestamps
(forced alignment returned with the take; always complete). Each chosen start is then snapped to the nearest
vocal-stem energy onset within +-70 ms. Numbers are normalized to words before alignment.
usage: python tools/timing.py <takes-dir> <film-dir>
"""
import json, re, sys, difflib, subprocess
import numpy as np, librosa

D, F = sys.argv[1], sys.argv[2]
plan = json.load(open(f'{D}/takeA_male.plan.json'))['chunks']
api = json.load(open(f'{D}/takeA_male.json'))['detail']['words_timestamps']
wstem = json.load(open(f'{D}/whisper/takeA_vocals.json')); wmix = json.load(open(f'{D}/whisper/takeA_male.json'))
sys.path.insert(0, F + '/tools')
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()
def n2w(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + n2w(n % 100))
    return n2w(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + n2w(n % 1000))
def norm(s):
    s = s.lower().replace('-', ' ').replace('’', "'")
    s = re.sub(r'(\d+),(\d{3})', r'\1\2', s)
    s = re.sub(r'(\d+)\.(\d+)', lambda m: m.group(1) + ' ' + m.group(2), s)
    s = re.sub(r'\d+', lambda m: ' ' + n2w(int(m.group())) + ' ', s)
    return re.sub(r"[^a-z' ]", ' ', s).replace("'", '').split()

# lyric words with section/line ids; each display word maps to 1+ normalized tokens
WORDS = []; T0 = 0.0
for si, c in enumerate(plan):
    lines = c['text'].split('\n'); name = lines[0].strip('[]')
    for li, L in enumerate(lines[1:]):
        L = re.sub(r'\{[^}]*\}\s*', '', L)
        for wi, w in enumerate(L.split()):
            WORDS.append({'w': w, 'sec': si, 'secname': name, 'line': f'{si}.{li}', 'toks': norm(w), 'chunk0': T0})
    T0 += c['duration_ms'] / 1000
# the intro of take A is instrumental (vocal stem ~-60 dB): its lines become silent titles timed to piano onsets
ref = [(k, t) for k, W in enumerate(WORDS) for t in W['toks'] if W['sec'] > 0]

def align(hyp):  # hyp: list of (token, start, end); returns {word index: (start, end)}
    sm = difflib.SequenceMatcher(a=[t for _, t in ref], b=[t for t, _, _ in hyp], autojunk=False)
    got = {}
    for a, b, n in sm.get_matching_blocks():
        for j in range(n):
            k = ref[a + j][0]; s, e = hyp[b + j][1], hyp[b + j][2]
            if k in got: got[k] = (min(got[k][0], s), max(got[k][1], e))
            else: got[k] = (s, e)
    return got
def wh_hyp(W): return [(t, w['s'], w['e']) for seg in W for w in seg['words'] for t in norm(w['w'])]
A_stem, A_mix = align(wh_hyp(wstem)), align(wh_hyp(wmix))
A_api = align([(t, w['start_ms'] / 1000, w['end_ms'] / 1000) for w in api for t in norm(w['word'])])

# reject matches that disagree wildly with the section window or neighbours (stray matches)
def ok(k, se):
    W = WORDS[k]; c0 = W['chunk0']; c1 = c0 + plan[W['sec']]['duration_ms'] / 1000
    return c0 - 1.0 <= se[0] <= c1 + 0.5
y, sr = librosa.load(f'{D}/stemsA/vocals.flac', sr=22050, mono=True)
on_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=128)
on = librosa.onset.onset_detect(onset_envelope=on_env, sr=sr, hop_length=128, units='time', backtrack=True)
rmsv = librosa.feature.rms(y=y, frame_length=1024, hop_length=128)[0]
def voiced(t): i = int(t * sr / 128); return 20 * np.log10(rmsv[max(0, i - 2):i + 6].mean() + 1e-9)

stats = {'stem': 0, 'mix': 0, 'api': 0, 'interp': 0, 'snapped': 0, 'piano': 0}
yp, _ = librosa.load(f'{D}/stemsA/piano.flac', sr=22050, mono=True)
pon = librosa.onset.onset_detect(y=yp, sr=sr, hop_length=128, units='time', backtrack=False)
BARd = 4 * 60 / 128; OFF = 0.034
for li in range(4):
    ws = [W for W in WORDS if W['line'] == f'0.{li}']; a, b = OFF + li * 1.5 * BARd + 0.25, OFF + (li + 1) * 1.5 * BARd - 0.6
    cand = [t for t in pon if a <= t < b]
    ts = cand[:len(ws)] if len(cand) >= len(ws) else list(np.linspace(a, b - 0.3, len(ws)))
    for W, t in zip(ws, sorted(ts)):
        W['t'], W['e'], W['src'] = round(float(t), 3), round(float(t) + 0.3, 3), 'piano'; stats['piano'] += 1
for k, W in enumerate(WORDS):
    if W['sec'] == 0: W['db'] = None; del W['toks']; continue
    for src, A in (('stem', A_stem), ('mix', A_mix), ('api', A_api)):
        if k in A and ok(k, A[k]):
            W['t'], W['e'], W['src'] = round(A[k][0], 3), round(A[k][1], 3), src; stats[src] += 1; break
# monotonic repair + interpolation for anything missing/out of order
for k, W in enumerate(WORDS):
    if W['sec'] == 0: continue
    prev = WORDS[k - 1]['t'] if WORDS[k - 1]['sec'] > 0 else 0
    if 't' not in W or W['t'] < prev:
        nxt = next((WORDS[j]['t'] for j in range(k + 1, len(WORDS)) if 't' in WORDS[j] and WORDS[j]['t'] >= prev), prev + 0.4)
        W['t'] = round(prev + (nxt - prev) * 0.5, 3); W['e'] = round(min(nxt, W['t'] + 0.3), 3); W['src'] = 'interp'; stats['interp'] += 1
    if len(on):
        j = np.argmin(np.abs(on - W['t']))
        if abs(on[j] - W['t']) <= 0.07: W['snap'] = round(float(on[j] - W['t']), 3); W['t'] = round(float(on[j]), 3); stats['snapped'] += 1
    # voice-onset refinement: whisper often starts a word inside the preceding silence; move the start to the
    # first 6 ms frame where the vocal stem is within 14 dB of the word's own peak (search up to 0.6 s / word end)
    i0 = int(W['t'] * sr / 128); i1 = int(min(W['e'], W['t'] + 0.6) * sr / 128) + 1
    seg = 20 * np.log10(rmsv[i0:i1] + 1e-9)
    if len(seg) > 2 and seg[:2].max() < seg.max() - 14:
        j = int(np.argmax(seg >= seg.max() - 14)); W['onset_fix'] = round(j * 128 / sr, 3); W['t'] = round(W['t'] + j * 128 / sr, 3)
    W['db'] = round(float(voiced(W['t'])), 1)
    del W['toks']
print('word timing sources:', stats, 'total', len(WORDS), 'onset-fixed', sum('onset_fix' in W for W in WORDS))
# agreement between API forced alignment and whisper (stem) where both exist
d = [A_api[k][0] - A_stem[k][0] for k in A_stem if k in A_api and ok(k, A_stem[k])]
print(f'API vs whisper-stem start diff: median {np.median(d)*1000:+.0f} ms, p90 |d| {np.percentile(np.abs(d),90)*1000:.0f} ms, n={len(d)}')

# ---- beats from the drum stem ----
yd, _ = librosa.load(f'{D}/stemsA/drums.flac', sr=22050, mono=True)
denv = librosa.onset.onset_strength(y=yd, sr=sr, hop_length=128)
tempo, bfr = librosa.beat.beat_track(onset_envelope=denv, sr=sr, hop_length=128, start_bpm=128, tightness=400)
bt = librosa.frames_to_time(bfr, sr=sr, hop_length=128)
# fit an exact grid: period and phase by least squares on detected beats
k = np.round((bt - bt[0]) / (60 / 128)); A = np.vstack([k, np.ones_like(k)]).T
(per, ph), *_ = np.linalg.lstsq(A, bt, rcond=None)
res = bt - (k * per + ph)
print(f'beat grid: {60/per:.3f} BPM, phase {ph:.3f}s, residual p90 {np.percentile(np.abs(res),90)*1000:.1f} ms, n={len(bt)}')
ph0 = ph - np.floor(ph / per) * per
grid = np.arange(ph0, len(yd) / sr, per)
# downbeats: sections start on bars (plan) -> choose the grid offset (0..3) closest to chunk boundaries
bounds = np.cumsum([0] + [c['duration_ms'] / 1000 for c in plan])
best = min(range(4), key=lambda o: sum(np.min(np.abs(grid[o::4] - b)) for b in bounds[1:-1]))
down = grid[best::4]
# strong drum hits (for flashes) and per-bar loudness of the final mix
yf, _ = librosa.load(f'{D}/final/must-be-reliable.wav', sr=22050, mono=True)
rf = librosa.feature.rms(y=yf, frame_length=2048, hop_length=512)[0]; rft = librosa.frames_to_time(np.arange(len(rf)), sr=sr, hop_length=512)
loud = [round(float(20 * np.log10(np.sqrt(np.mean(rf[(rft >= a) & (rft < a + per / 4 * 2)] ** 2)) + 1e-9)), 2) for a in np.arange(0, len(yf) / sr, per / 2)]
dp = librosa.onset.onset_detect(onset_envelope=denv, sr=sr, hop_length=128, units='time')
dstr = denv[librosa.time_to_frames(dp, sr=sr, hop_length=128)]
hits = [round(float(t), 3) for t, s in zip(dp, dstr) if s > np.percentile(dstr, 80)]
json.dump({'bpm': 60 / per, 'period': per, 'beats': [round(float(x), 4) for x in grid], 'downbeats': [round(float(x), 4) for x in down],
           'bounds': [round(float(b), 3) for b in bounds], 'sections': [c['text'].split('\n')[0].strip('[]') for c in plan],
           'loud_halfbeat_db': loud, 'loud_step': per / 2, 'hits': hits, 'grid_residual_p90_ms': float(np.percentile(np.abs(res), 90) * 1000)},
          open(f'{F}/assets/beats.json', 'w'))
json.dump(WORDS, open(f'{F}/assets/words.json', 'w'), indent=0)
print('downbeat offset', best, 'first downbeats', down[:3], 'bounds vs nearest downbeat (ms):', [round(float(np.min(np.abs(down - b))) * 1000) for b in bounds[1:-1]])
