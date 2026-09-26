# Verify A/V sync of a muxed film against the timeline it was generated from.
import json, subprocess, sys, numpy as np, wave
mp4 = sys.argv[1]
TL = json.load(open('build/timeline.json'))

def pcm(args, sr=22050):
    raw = subprocess.run(['ffmpeg', '-v', 'error', *args, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768

# 1) audio offset: muxed track vs source score (cross-correlation around 20 s windows)
a = pcm(['-i', mp4, '-vn']); s = pcm(['-i', 'build/score.wav'])
sr = 22050; offs = []
for t in (10, 60, 110, TL['total'] - 12):
    i = int(t * sr); w = s[i:i + sr * 2]; seg = a[i - 2205:i + sr * 2 + 2205]
    c = np.correlate(seg, w, 'valid'); offs.append((np.argmax(c) - 2205) / sr * 1000)
print('audio offset vs score (ms) at 10/60/110/end:', [f'{o:+.2f}' for o in offs])

# 2) video: every scene cut lands on its frame (frame-difference spike)
fr = subprocess.run(['ffmpeg', '-v', 'error', '-i', mp4, '-vf', 'scale=96:54,format=gray', '-f', 'rawvideo', '-'], capture_output=True).stdout
F = np.frombuffer(fr, dtype=np.uint8).reshape(-1, 54, 96).astype(np.float32)
d = np.abs(np.diff(F, axis=0)).mean((1, 2))
bad = []
for sc in TL['scenes'][1:]:
    f = round(sc['t0'] * 30 + 1e-9); win = d[f - 4:f + 3]; peak = f - 4 + int(np.argmax(win)) + 1
    if peak != f: bad.append((sc['id'], f, peak))
print(f'scene cuts on expected frame: {len(TL["scenes"]) - 1 - len(bad)}/{len(TL["scenes"]) - 1}', bad or '')
print('video frames:', len(F), ' expected:', int(np.ceil(TL['total'] * 30)), ' audio s:', len(a) / sr)
