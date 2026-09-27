"""Analyze a take: fact-check the whisper transcript against the plan lyrics, then BPM, per-section loudness,
bridge drop, and key estimate per section.
usage: python tools/analyze_take.py <takes-dir> <take>   (reads <take>.mp3, <take>.plan.json, whisper/<take>.json)"""
import json, re, sys, difflib
import numpy as np, librosa

D, T = sys.argv[1], sys.argv[2]
plan = json.load(open(f'{D}/{T}.plan.json'))['chunks']
wh = json.load(open(f'{D}/whisper/{T}.json'))

ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'x x twenty thirty forty fifty sixty seventy eighty ninety'.split()
def n2w(n):
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10] + ('' if n % 10 == 0 else ' ' + ONES[n % 10])
    if n < 1000: return ONES[n // 100] + ' hundred' + ('' if n % 100 == 0 else ' ' + n2w(n % 100))
    return n2w(n // 1000) + ' thousand' + ('' if n % 1000 == 0 else ' ' + n2w(n % 1000))
def norm(s):
    s = s.lower().replace('-', ' ')
    s = re.sub(r'(\d+)\.(\d+)', lambda m: m.group(1) + ' ' + m.group(2), s)
    s = re.sub(r'\d+', lambda m: ' ' + n2w(int(m.group())) + ' ', s)
    s = re.sub(r'\{[^}]*\}|\[[^\]]*\]', ' ', s)
    return re.sub(r'[^a-z ]', ' ', s).split()

# section boundaries (v2_5 enforces chunk durations)
bounds, t = [], 0.0
for c in plan:
    name = c['text'].split(']')[0][1:]; bounds.append((name, t, t + c['duration_ms'] / 1000)); t += c['duration_ms'] / 1000

ref = [w for c in plan for w in norm(c['text'])]
hyp_words = [(norm(w['w']), w['s']) for s in wh for w in s['words']]
hyp = [x for ws, _ in hyp_words for x in ws]
sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
match = sum(b.size for b in sm.get_matching_blocks())
print(f'lyric word recall: {match}/{len(ref)} = {match / len(ref):.1%}')

FACTS = ['forty four forty four', 'seven last year now it s forty four', 'five in the patch', 'may brought eleven',
         'twenty eight in one go', 'eighteen five never shipped', 'beta three', 'sixty six thousand',
         'beta four september', 'first and foremost postgres must be reliable', 'seven hundred sixty two commits',
         'four hundred thirty nine', 'thirty committers', 'nine open items', 'three hundred hands', 'thirty years']
H = ' '.join(hyp)
res = {}
for f in FACTS:
    ok = f in H
    if not ok:  # fuzzy: best window similarity
        fw = f.split(); best = 0
        for i in range(len(hyp) - len(fw) + 1):
            best = max(best, difflib.SequenceMatcher(a=fw, b=hyp[i:i + len(fw)]).ratio())
        res[f] = f'MISS (best {best:.2f})'
    else: res[f] = 'ok'
    print(f'  fact {f!r}: {res[f]}')
# any number words sung that are NOT in the lyrics = potential wrong number
NUMW = set(ONES + TENS[2:] + ['hundred', 'thousand'])
extra = [w for w in hyp if w in NUMW and w not in set(ref)]
print('  number words not in lyrics:', extra or 'none')

y, sr = librosa.load(f'{D}/{T}.mp3', sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, start_bpm=128)
bt = librosa.frames_to_time(beats, sr=sr)
print(f'BPM (librosa): {float(np.atleast_1d(tempo)[0]):.1f}; median IBI BPM: {60 / np.median(np.diff(bt)):.1f}; duration {len(y) / sr:.1f}s')
rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]; rt = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512)
yh, yp = librosa.effects.hpss(y); prms = librosa.feature.rms(y=yp, frame_length=2048, hop_length=512)[0]
chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=2048); ct = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr, hop_length=2048)
MAJ = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]); MIN = np.array([6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
NAMES = 'C C# D D# E F F# G G# A A# B'.split()
def key(v):
    best = max(((np.corrcoef(np.roll(P, k), v)[0, 1], NAMES[k] + (' maj' if P is MAJ else ' min')) for P in (MAJ, MIN) for k in range(12)))
    return best[1]
sec = []
for name, a, b in bounds:
    m = (rt >= a) & (rt < b); db = 20 * np.log10(np.mean(rms[m] ** 2) ** 0.5 + 1e-9)
    pdb = 20 * np.log10(np.mean(prms[m[:len(prms)]] ** 2) ** 0.5 + 1e-9)
    k = key(chroma[:, (ct >= a) & (ct < b)].mean(1)); sec.append((name, a, b, float(db), k, float(pdb)))
    print(f'  {name:14s} {a:6.1f}-{b:6.1f}  {db:6.1f} dB  perc {pdb:6.1f} dB  key~{k}')
ch = np.mean([s[3] for s in sec if s[0] == 'Chorus'])
br = [s for s in sec if s[0] == 'Bridge'][0][3]; fc = [s for s in sec if s[0] == 'Final Chorus'][0][3]
pch = np.mean([s[5] for s in sec if s[0] == 'Chorus']); pbr = [s for s in sec if s[0] == 'Bridge'][0][5]; pfc = [s for s in sec if s[0] == 'Final Chorus'][0][5]
print(f'bridge drop vs chorus: {br - ch:+.1f} dB (percussive {pbr - pch:+.1f} dB); final chorus vs chorus: {fc - ch:+.1f} dB (perc {pfc - pch:+.1f})')
json.dump({'recall': match / len(ref), 'extra': extra, 'facts': res, 'extra_numbers': extra, 'sections': sec,
           'bpm': float(np.atleast_1d(tempo)[0]), 'bridge_drop_db': float(br - ch), 'bridge_perc_drop_db': float(pbr - pch), 'final_lift_db': float(fc - ch)},
          open(f'{D}/whisper/{T}.analysis.json', 'w'), indent=1)
