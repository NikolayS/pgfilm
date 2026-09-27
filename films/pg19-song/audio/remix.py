"""Surgical remix of take A (ElevenLabs music_v2_5, seed 1901) using its ElevenLabs stems.

The generated take ignored two arrangement directions: drums/bass kept playing under the spoken bridge, and the
drums slammed back at full level instead of "returning slowly" in the build. We fix only those windows:
  * spoken bridge (131.25 -> 145.9 s): drums + bass out, the rest ducked and low-passed (radio feel), a synthesized
    clock tick every 2 beats; the tick stops just before "First and foremost" so the quote is truly alone.
  * build (153.75 -> 168.75 s): drums and bass ramp from -30 dB to 0 dB across the 8 bars.
Outside those windows the original mix is used untouched; windows are joined with 40 ms equal-power crossfades
(the stem sum matches the mix to 2 % residual, zero sample offset).
Output: <takes>/final/must-be-reliable.wav (48 kHz stereo, loudness-normalized to -14 LUFS by ffmpeg afterwards).

usage: python audio/remix.py <takes-dir>
"""
import sys, subprocess, numpy as np
from scipy.signal import butter, sosfilt

D = sys.argv[1]; SR = 48000; BEAT = 60 / 128
def load(f):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 's16le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32).reshape(-1, 2) / 32768
mix = load(f'{D}/takeA_male.mp3')
st = {n: load(f'{D}/stemsA/{n}.flac') for n in ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other']}
N = min(len(mix), *(len(v) for v in st.values())); mix = mix[:N]; st = {k: v[:N] for k, v in st.items()}
T = np.arange(N) / SR

BR0, QUOTE, BR1 = 131.25, 145.80, 146.25        # bridge start, tick stop (just before "First"), quote chunk start
BU0, BU1 = 153.75, 168.75                       # build

def env(t0, t1, a, b):  # linear gain ramp from a to b on [t0,t1], constant outside
    return np.clip((T - t0) / (t1 - t0), 0, 1) * (b - a) + a
db = lambda x: 10 ** (x / 20)

# drums/bass gain: 1 -> 0 over one beat at BR0; 0 through the quote; ramp -30 dB -> 0 dB across the build
g_rhythm = np.ones(N)
m = (T >= BR0) & (T < BU0); g_rhythm[m] = np.clip(1 - (T[m] - BR0) / BEAT, 0, 1)
m = (T >= BU0) & (T < BU1); g_rhythm[m] = db(-30 + 30 * ((T[m] - BU0) / (BU1 - BU0)) ** 1.6)
# "other/guitar/piano" under the spoken bridge: -9 dB and low-passed at 900 Hz
lp = butter(4, 900, 'low', fs=SR, output='sos')
bed = st['other'] + st['guitar'] + st['piano']
bed_lp = sosfilt(lp, bed, axis=0).astype(np.float32)
w_lp = np.zeros(N); m = (T >= BR0) & (T < BR1); w_lp[m] = np.clip((T[m] - BR0) / BEAT, 0, 1) * np.clip((BR1 - T[m]) / 0.3, 0, 1)
bed_mix = bed * (1 - w_lp[:, None]) + bed_lp * db(-9) * w_lp[:, None]
rem = st['vocals'] + bed_mix + (st['drums'] + st['bass']) * g_rhythm[:, None]

# ticking clock: every 2 beats, alternating tick/tock (short resonant clicks), from BR0 + 1 beat until QUOTE
rng = np.random.default_rng(7)
def click(f0, dur=0.05, amp=0.22):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n) * np.exp(-t / 0.002)
    ping = np.sin(2 * np.pi * f0 * t) * np.exp(-t / 0.012)
    return (amp * (0.5 * noise + ping)).astype(np.float32)
TICK, TOCK = click(3100), click(2350)
tick = np.zeros(N, np.float32); k = 0; tt = BR0 + BEAT
ticks = []
while tt < QUOTE - 0.2:
    i = int(round(tt * SR)); c = TICK if k % 2 == 0 else TOCK; tick[i:i + len(c)] += c[:N - i]; ticks.append(round(tt, 4)); k += 1; tt += 2 * BEAT
rem += tick[:, None] * np.array([0.9, 1.0], np.float32)  # slightly right of centre

# splice: remix inside [BR0-0.02, BU1+0.02], original elsewhere, 40 ms equal-power crossfades
XF = 0.04
w = np.clip(np.minimum((T - (BR0 - XF)) / XF, ((BU1 + XF) - T) / XF), 0, 1)
w = np.sin(w * np.pi / 2) ** 2
out = mix * (1 - w[:, None]) + rem * w[:, None]
peak = np.abs(out).max(); print('peak', peak, 'ticks', len(ticks))
import os, json; os.makedirs(f'{D}/final', exist_ok=True)
raw = (np.clip(out / max(1, peak / 0.98), -1, 1) * 32767).astype(np.int16).tobytes()
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', f'{D}/final/remix_raw.wav'], input=raw, check=True)
json.dump({'ticks': ticks, 'bridge': [BR0, BR1], 'quote_alone_from': QUOTE, 'build': [BU0, BU1]}, open(f'{D}/final/remix_events.json', 'w'))
