# Procedural score for the Postgres film. Reads timeline.json (same bar grid as the visuals), writes score.wav.
import json, numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
TL = json.load(open('build/timeline.json'))
N = int((TL['total'] + 1) * SR)
dry = np.zeros((2, N)); wet = np.zeros((2, N)); duck_sig = np.zeros((2, N))
R = np.random.default_rng(7)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def lp(x, f, o=2): return sosfilt(butter(o, min(f, SR / 2 - 100), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x)
def env(n, a, r, s=1.0):
    e = np.full(n, s); na = min(n, int(a * SR)); nr = min(n - na, int(r * SR))
    if na: e[:na] = np.linspace(0, s, na)
    if nr: e[n - nr:] *= np.linspace(1, 0, nr)
    return e
def put(t, sig, gain=1.0, pan=0.0, send=0.0, bus=None):
    i = int(t * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i]; l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    tgt = bus if bus is not None else dry
    tgt[0, i:i + len(sig)] += sig * gain * l; tgt[1, i:i + len(sig)] += sig * gain * r
    if send: wet[0, i:i + len(sig)] += sig * gain * send * l; wet[1, i:i + len(sig)] += sig * gain * send * r
def saw(f, n, ph=0.0):
    t = np.arange(n) / SR; return 2 * ((f * t + ph) % 1) - 1

# ---------- instruments ----------
def pad(notes, t, dur, bright=1200, vol=0.08, attack=0.5):
    n = int((dur + 0.8) * SR)
    for m in notes:
        s = sum(saw(hz(m) * 2 ** (d / 1200), n, R.random()) for d in (-9, 0, 8))
        s = hp(lp(s, bright), 160) * env(n, attack, 0.9)
        put(t, s, vol / len(notes) * 2, pan=R.uniform(-0.5, 0.5), send=0.55, bus=duck_sig)
def bass(m, t, dur, vol=0.22):
    vol *= 0.8
    n = int((dur + 0.05) * SR); tt = np.arange(n) / SR
    s = np.sin(2 * np.pi * hz(m) * tt) + 0.35 * lp(saw(hz(m), n), 500)
    put(t, s * env(n, 0.008, min(0.12, dur * 0.4)) * np.exp(-tt * 1.2), vol, bus=duck_sig)
def pluck(m, t, vol=0.06, pan=0.0, dec=0.22):
    n = int(1.2 * SR); tt = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * tt + 1.6 * np.exp(-tt / 0.06) * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / dec)
    put(t, s * env(n, 0.002, 0.05), vol, pan=pan, send=0.35)
def bell(m, t, vol=0.09):
    EVLOG.append(('bell', t))
    n = int(3 * SR); tt = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * tt + 2.2 * np.exp(-tt / 0.5) * np.sin(2 * np.pi * 3.5 * f * tt)) * np.exp(-tt / 0.9)
    s += 0.3 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.4)
    put(t, s * env(n, 0.002, 0.3), vol, pan=R.uniform(-0.3, 0.3), send=0.7)
def lead(m, t, dur, vol=0.07, bright=2600):
    n = int((dur + 0.25) * SR); tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * tt) * np.clip(tt / 0.3, 0, 1)
    ph = np.cumsum(hz(m) * vib) / SR
    s = sum((2 * ((ph * k + R.random()) % 1) - 1) for k in (1.0, 1.003, 0.997)) / 3
    s = lp(s, bright) * env(n, 0.04, 0.22) * (0.8 + 0.2 * np.exp(-tt * 3))
    put(t, s, vol, pan=0.05, send=0.5)
    put(t, lp(s, 900), vol * 0.5, pan=-0.2, send=0.5)  # octave-ish body
def taiko(t, vol=0.55, f0=70):
    EVLOG.append(('taiko', t))
    n = int(1.6 * SR); tt = np.arange(n) / SR
    f = f0 * (0.65 + 0.35 * np.exp(-tt / 0.06)); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.45)
    s += lp(R.standard_normal(n), 900) * np.exp(-tt / 0.05) * 0.5
    put(t, s, vol, send=0.25)
def kick(t, vol=0.55):
    EVLOG.append(('kick', t))
    n = int(0.5 * SR); tt = np.arange(n) / SR
    f = 45 + 110 * np.exp(-tt / 0.035); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.22)
    s += hp(R.standard_normal(n), 3000) * np.exp(-tt / 0.004) * 0.2
    put(t, s, vol)
    i = int(t * SR); k = min(N - i, int(0.3 * SR))
    if k > 0: DUCK[i:i + k] = np.minimum(DUCK[i:i + k], 1 - 0.72 * np.exp(-np.arange(k) / SR / 0.11))
def clap(t, vol=0.2):
    n = int(0.4 * SR); tt = np.arange(n) / SR; e = np.exp(-tt / 0.12)
    for d in (0, 0.009, 0.019): e += 0.6 * np.exp(-np.clip(tt - d, 0, None) / 0.008) * (tt >= d)
    put(t, bp(R.standard_normal(n), 900, 3500) * e, vol, send=0.4)
def hat(t, vol=0.05, open_=False):
    n = int(0.3 * SR); tt = np.arange(n) / SR
    put(t, hp(R.standard_normal(n), 7500) * np.exp(-tt / (0.14 if open_ else 0.03)), vol, pan=0.25)
def crash(t, vol=0.2, dec=1.8):
    n = int(4 * SR); tt = np.arange(n) / SR
    put(t, hp(R.standard_normal(n), 4500) * np.exp(-tt / dec), vol, send=0.4)
def revcrash(t_hit, dur, vol=0.18):
    n = int(dur * SR); tt = np.arange(n) / SR
    put(t_hit - dur, hp(R.standard_normal(n), 3000) * (tt / dur) ** 3, vol, send=0.3)
def impact(t, vol=0.8):
    EVLOG.append(('impact', t))
    n = int(4 * SR); tt = np.arange(n) / SR
    f = 32 + 60 * np.exp(-tt / 0.08); put(t, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 1.3), vol)
    taiko(t, 0.6, 62); crash(t, 0.22, 2.4)
def riser(t0, dur, vol=0.12):
    n = int(dur * SR); tt = np.arange(n) / SR; x = tt / dur
    f = 200 * (12 ** x); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.3
    s += hp(R.standard_normal(n), 1500) * (0.4 + x)
    put(t0, s * x ** 2.2, vol, send=0.5)
def click(t, vol=0.12, kind='type'):
    n = int(0.06 * SR); tt = np.arange(n) / SR
    if kind == 'type':
        s = bp(R.standard_normal(n), 1800, 5200) * np.exp(-tt / 0.006) + 0.5 * np.sin(2 * np.pi * 180 * tt) * np.exp(-tt / 0.012)
    else:
        s = bp(R.standard_normal(n), 2500, 7000) * np.exp(-tt / 0.003)
    put(t, s, vol, pan=R.uniform(-0.3, 0.3), send=0.1)
def snare_roll(t0, dur, vol=0.15):
    t = t0; k = 0
    while t < t0 + dur:
        x = (t - t0) / dur; n = int(0.12 * SR); tt = np.arange(n) / SR
        put(t, bp(R.standard_normal(n), 1200, 6000) * np.exp(-tt / 0.05), vol * (0.2 + x), send=0.3)
        t += 0.125 * (1 - 0.6 * x)

DUCK = np.ones(N)
EVLOG = []

# ---------- harmony: bright, major, uplifting ----------
CH = {'D': [50, 57, 62, 66], 'A': [45, 57, 61, 64], 'Bm': [47, 54, 59, 62], 'G': [43, 55, 59, 62], 'Em': [52, 55, 59, 64],
      'F#m': [54, 57, 61, 66], 'Asus': [45, 57, 62, 64], 'Dadd9': [50, 57, 64, 66],
      'E': [52, 59, 64, 68], 'B': [47, 54, 59, 63], 'C#m': [49, 56, 61, 64], 'Aup': [45, 57, 61, 64]}
ROOT = {k: v[0] for k, v in CH.items()}
SCENE_CH = {'post': ['A', 'D', 'Bm'], 'open1': ['Dadd9', 'Dadd9'], 'open2': ['G', 'Asus'],
    'montage': ['Bm', 'G', 'D', 'A'], 'turing': ['G', 'A'], 'montage2': ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'A'], 'commits': ['Bm', 'G', 'A'],
    'people': ['D', 'A', 'Bm', 'G'], 'future': ['Bm', 'G', 'A'],
    'nobody': ['G', 'Em'], 'everybody': ['Asus', 'A'],
    'mandala': ['E', 'B', 'C#m', 'Aup'], 'end': ['Aup', 'B', 'E', 'E', 'E', 'E']}   # key change up to E major
CYCLE = {1: ['D', 'Bm', 'G', 'A'], 2: ['D', 'A', 'Bm', 'G'], 3: ['G', 'A', 'D', 'Bm']}

def stab(notes, t, dur, vol=0.05, bright=4200):
    n = int((dur + 0.15) * SR)
    for m_ in notes:
        s = sum(saw(hz(m_) * 2 ** (d / 1200), n, R.random()) for d in (-12, 0, 11))
        put(t, lp(s, bright) * env(n, 0.003, 0.08) * np.exp(-np.arange(n) / SR / 0.18), vol / len(notes) * 2, pan=R.uniform(-0.4, 0.4), send=0.35)
def supersaw(m_, t, dur, vol=0.07, bright=5200):
    n = int((dur + 0.2) * SR); tt = np.arange(n) / SR
    s = sum(saw(hz(m_) * 2 ** (d / 1200) * (1 + 0.003 * np.sin(2 * np.pi * 5.5 * tt) * np.clip(tt / 0.25, 0, 1)), n, R.random()) for d in (-17, -8, 0, 7, 16)) / 5
    s = lp(s, bright) * env(n, 0.012, 0.15)
    put(t, s, vol, pan=-0.15, send=0.45); put(t + 0.012, s, vol * 0.8, pan=0.15, send=0.45)

# bar grid from scenes
bars = []
for s in TL['scenes']:
    bd = 60 / s['bpm']
    for k in range(s['bars']): bars.append(dict(t=s['t0'] + k * 4 * bd, bd=bd, act=s['act'], sc=s, k=k))
cyc = {1: 0, 2: 0, 3: 0}
for i, b in enumerate(bars):
    sid = b['sc']['id']
    if sid in SCENE_CH: b['ch'] = SCENE_CH[sid][b['k']]
    else: a_ = b['act']; b['ch'] = CYCLE[a_][cyc[a_] % 4]; cyc[a_] += 1
    b['i'] = i

# melody from chord tones: two alternating rhythmic motifs, lifted an octave in act III / finale
MOT = [[(0, 2, 1.5), (1.5, 1, .5), (2, 2, .5), (2.5, 3, .5), (3, 2, 1)],
       [(0, 3, 1), (1, 2, .5), (1.5, 1, .5), (2, 0, .75), (2.75, 1, .25), (3, 2, 1)]]
def mel_notes(ch):
    tones = sorted({(n - CH[ch][0]) % 12 for n in CH[ch]}); base = 72 + (CH[ch][0] % 12) - 12 * ((CH[ch][0] % 12) > 7)
    return [base + tones[0], base + tones[1 % len(tones)], base + tones[2 % len(tones)], base + 12]

for b in bars:
    t, bd, act, sc, ch, i = b['t'], b['bd'], b['act'], b['sc'], b['ch'], b['i']
    notes, root, bar = CH[ch], ROOT[ch], 4 * bd
    sid = sc['id']; fin = sid in ('mandala', 'end'); quiet = sc['quiet']
    # pads (sidechained)
    bright = 900 if quiet else {1: 2400, 2: 3200, 3: 4200, 4: 4600}[act]
    pvol = 0.07 if sid == 'open1' else (0.13 if fin else 0.1)
    if not (sid == 'end' and b['k'] >= 3): pad(notes + [notes[-1] + 12] * (act >= 2), t, bar, bright, pvol, attack=0.5 if sid.startswith('open') else 0.08)
    elif b['k'] == 3: pad(CH['E'] + [76, 80, 83], t, bar * 3, 3000, 0.14, attack=0.05)
    # bass
    if sid.startswith('open'): bass(root - 12, t, bar, 0.16)
    elif quiet: bass(root - 12, t, bar, 0.14)
    elif sid == 'end' and b['k'] >= 3:
        if b['k'] == 3: bass(root - 12, t, bar * 3, 0.2)
    elif act == 1:
        for e in range(4): bass(root - 12 + (12 if e == 3 else 0), t + e * bd, bd * 0.85, 0.17)
    else:
        for e in range(8): bass(root - 12 + (12 if e % 2 else 0), t + e * bd / 2, bd / 2 * 0.8, 0.18)
    # arps
    arp = sorted(n + 12 for n in notes[1:]) + [notes[1] + 24]; pat = [0, 1, 2, 3, 2, 1, 3, 2]
    if not quiet and not (sid == 'end' and b['k'] >= 3):
        steps = 8 if sid.startswith('open') else 16
        for e in range(steps): pluck(arp[pat[e % 8]] + (12 if act >= 3 and e % 4 == 2 else 0), t + e * bar / steps, 0.045 if act == 1 else 0.05, pan=(-0.5, 0.5)[e % 2], dec=0.14)
    elif sid == 'everybody':
        for e in range(16 if b['k'] else 8): pluck(arp[pat[e % 8]], t + e * bar / (16 if b['k'] else 8), 0.05, pan=(-0.5, 0.5)[e % 2])
    # offbeat chord stabs (act II+)
    if act >= 2 and not quiet and not sc['montage'] and not (sid == 'end' and b['k'] >= 3):
        for e in range(4): stab([n + 12 for n in notes[1:]], t + (e + 0.5) * bd, bd * 0.3, 0.05 if act == 2 else 0.06)
    # lead
    mel_on = (act == 1 and not sid.startswith('open') and b['k'] % 2 == 1) or (act == 2 and not sc['montage']) or (act == 3 and not sc['montage'] and sid not in ('commits',)) or sid == 'mandala' or (sid == 'end' and b['k'] < 3)
    if mel_on:
        mn = mel_notes(ch); lift = 12 if act >= 3 else 0
        if sid == 'end' and b['k'] == 2: supersaw(mn[3] + lift - 12, t, bar * 2.5, 0.09)
        else:
            for (o, k, d) in MOT[b['i'] % 2]:
                if act == 1: lead(mn[k], t + o * bd, d * bd * 0.95, 0.06, 3000)
                else:
                    supersaw(mn[k] + lift - (12 if act == 2 else 12), t + o * bd, d * bd * 0.92, 0.075 if act == 2 else 0.085)
                    if act >= 3: supersaw(mn[k] + lift - 24, t + o * bd, d * bd * 0.92, 0.04, 3000)
    # drums
    if act == 1 and not sid.startswith('open'):
        kick(t, 0.5); kick(t + 2 * bd, 0.45); clap(t + 3 * bd, 0.12)
        for e in range(8): hat(t + e * bd / 2, 0.025 + 0.02 * (e % 2))
    if (act in (2, 3) and not sc['montage']) or sid == 'mandala':
        for e in range(4): kick(t + e * bd, 0.6)
        clap(t + bd, 0.2); clap(t + 3 * bd, 0.2)
        for e in range(8): hat(t + e * bd / 2, 0.03 + 0.03 * (e % 2), open_=(e % 2 == 1))
        if act >= 3 or fin:
            for e in range(16): hat(t + e * bd / 4, 0.018)
        if b['k'] == sc['bars'] - 1 and not fin:   # fill into the next cut
            for e in range(4): clap(t + 3 * bd + e * bd / 4, 0.07 + 0.03 * e)
    if sc['montage']:
        for e in range(4): kick(t + e * bd, 0.6)
        for e in range(0, 4, 2): taiko(t + e * bd, 0.3, 80); crash(t + e * bd, 0.06, 0.5)
        for e in range(8): hat(t + e * bd / 2, 0.04, open_=(e % 2 == 1))
    if sid == 'mandala': taiko(t, 0.4, 60); crash(t, 0.13, 1.6)
    if sid == 'end' and b['k'] < 2:
        for e in range(4): kick(t + e * bd, 0.6)
        taiko(t, 0.45, 60); taiko(t + 2 * bd, 0.35, 70); crash(t, 0.1, 1.2)
        for e in range(4): taiko(t + 3 * bd + e * bd / 4, 0.2 + 0.07 * e, 90 - 5 * e)
    if sid == 'end' and b['k'] == 2: impact(t, 0.9)

# scene-level events
for s in TL['scenes']:
    t0, bd = s['t0'], 60 / s['bpm']
    if s['hit'] and s['act'] == 1 and not s['id'].startswith('open'): taiko(t0, 0.4, 60)
    if s['hit'] and s['act'] >= 2: crash(t0, 0.11, 1.2)
    if s['impact']: impact(t0, 0.75); revcrash(t0, 2 * bd, 0.14)
    if s['big']: impact(t0 + 4 * bd, 0.8); revcrash(t0 + 4 * bd, 2 * bd, 0.16); riser(t0, 4 * bd, 0.09)
    if s['riser']: riser(t0, s['dur'], 0.18); snare_roll(t0 + s['dur'] / 2, s['dur'] / 2, 0.14)
    if s['id'] in ('release', 'turing', 'future'): riser(t0 + s['dur'] - 4 * bd, 4 * bd, 0.13); snare_roll(t0 + s['dur'] - 2 * bd, 2 * bd, 0.1)
    if s['type']:
        kind = 'type' if s['act'] == 1 and s['id'] != 'pg95' else 'key'
        evs = [e for e in TL['typing'] if s['t0'] <= e['t'] < s['t0'] + s['dur']]
        for e in evs:  # one click per revealed char, at most two per frame
            k = min(e['n'], 2)
            for j in range(k): click(e['t'] + j / 30 / k, (0.09 if kind == 'type' else 0.06) * (1 if j == 0 else 0.7), kind)
        if s['id'] == 'codd' and evs: bell(98, evs[-1]['t'] + 0.05, 0.05)
# opening: warm swell + bright bells (D major)
op = TL['scenes'][2]['t0']; n = int(op * SR); tt = np.arange(n) / SR
drone = lp(sum(saw(hz(38) * k, n, R.random()) for k in (1, 1.004)), 400) * np.clip(tt / 2.5, 0, 1)
put(0, drone, 0.1, send=0.5)
for k, (tb, m_) in enumerate([(0.05, 78), (1.05, 81), (2.05, 86), (4.05, 85), (6.05, 88)]): bell(m_, tb * 60 / 120, 0.09)
riser(op - 2 * 0.5 * 4, 4 * 0.5, 0.1)
# accent-word bells, tuned to the bar chord
for e in TL['events']:
    if e['kind'] != 'accent': continue
    b = max((b for b in bars if b['t'] <= e['t'] + 1e-6), key=lambda b: b['t'])
    bell(CH[b['ch']][-1] + 24, e['t'], 0.045)

# ---------- mix ----------
dry += duck_sig * DUCK
wet += 0  # sends already added
L = int(3.2 * SR); tt = np.arange(L) / SR
ir = np.stack([lp(R.standard_normal(L), 5000) * np.exp(-tt / 0.75) for _ in range(2)]); ir /= np.abs(ir).sum(1, keepdims=True) ** 0.5 * 12
rev = np.stack([fftconvolve(wet[c], ir[c])[:N] for c in range(2)])
mix = dry + rev * 1.0
mix = hp(mix, 28)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
end = int(TL['total'] * SR); fade = int(2.2 * SR); mix[:, end - fade:end] *= np.linspace(1, 0, fade); mix[:, end:] = 0
mix = mix[:, :end]
mix /= np.abs(mix).max() / 0.86
import wave
w = wave.open('build/score.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix.T * 32767).astype('<i2').tobytes()); w.close()
json.dump(EVLOG, open('build/audio_events.json', 'w'))
print('ok', mix.shape[1] / SR, 's')
