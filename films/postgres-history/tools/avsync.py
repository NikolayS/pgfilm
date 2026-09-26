# Deep A/V sync audit: synth event log vs detected audio onsets vs visual pulse, all from the final mp4.
import json, subprocess, sys, numpy as np
from scipy.signal import butter, sosfilt
mp4 = sys.argv[1]; SR = 22050; FPS = 30
TL = json.load(open('build/timeline.json')); EV = json.load(open('build/audio_events.json'))
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vn', '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

def onsets(sig, hop=0.002):
    h = int(SR * hop); e = np.sqrt(np.convolve(sig ** 2, np.ones(h) / h, 'same'))[::h]
    return e, hop
lo = sosfilt(butter(4, 140, 'low', fs=SR, output='sos'), x); elo, hop = onsets(lo)
hi = sosfilt(butter(4, [2500, 7000], 'band', fs=SR, output='sos'), x); ehi, _ = onsets(hi)

def measure(env, t, win=0.06):
    # onset = first sample where energy crosses half-way between local floor and local peak after t-win
    i0, i1 = int((t - win) / hop), int((t + 0.12) / hop)
    seg = env[max(0, i0):i1]
    if len(seg) < 5: return None
    fl, pk = np.percentile(seg[:max(3, int(win / hop) - 5)], 20), seg.max()
    j = np.argmax(seg > fl + 0.5 * (pk - fl)); return (max(0, i0) + j) * hop - t

res = {}
for kind, env in (('kick', elo), ('taiko', elo), ('impact', elo), ('bell', ehi)):
    ts = sorted(t for k, t in EV if k == kind)
    d = [measure(env, t) for t in ts]; d = np.array([v for v in d if v is not None]) * 1000
    res[kind] = d
    print(f'{kind:7s} n={len(ts):4d}  onset offset ms: median {np.median(d):+6.1f}  p5 {np.percentile(d,5):+6.1f}  p95 {np.percentile(d,95):+6.1f}')

# visual: luminance of dark scenes; pulse flash should peak on the kick frame
fr = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', 'scale=64:36,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
L = np.frombuffer(fr, dtype=np.uint8).reshape(-1, 36, 64).mean((1, 2))
dark = {s['id'] for s in TL['scenes'] if s['act'] >= 3 and not s['quiet']}
lag = []
for k, t in EV:
    if k != 'kick': continue
    sc = next((s for s in TL['scenes'] if s['t0'] <= t < s['t0'] + s['dur']), None)
    if not sc or sc['id'] not in dark or t - sc['t0'] < 0.2: continue
    f = int(round(t * FPS)); w = L[f - 3:f + 4]
    if len(w) == 7: lag.append(int(np.argmax(w)) - 3)
lag = np.array(lag); vals, cnt = np.unique(lag, return_counts=True)
print('visual pulse peak vs kick frame (frames):', dict(zip(vals.tolist(), cnt.tolist())), f' → {100 * np.mean(np.abs(lag) <= 1):.0f}% within ±1 frame')
