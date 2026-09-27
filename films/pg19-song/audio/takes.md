# "Must Be Reliable" — takes

All takes were generated on 2026-09-26 with the ElevenLabs Music API. Each used `POST /v1/music/detailed`, `model_id=music_v2_5` and a 12-chunk composition plan (`<take>.plan.json`: 128 BPM, 111 bars, 3:28). Every take used the same lyrics and section styles; only the voice direction and the seed differ. The generator is `pgfilm/films/pg19-song/audio/compose.py`.

Transcripts were made with faster-whisper large-v3-turbo, with no lyric prompt so the check stays independent (`whisper/<take>.json`). Suspicious passages were re-transcribed as isolated clips. The analysis is in `whisper/<take>.analysis.json` (`tools/analyze_take.py`).

| | A: male lead + female harmony (seed 1901) | B: female lead (seed 1902) | C: male/female duet (seed 1903) |
|---|---|---|---|
| Lyric word recall (whisper vs lyrics) | **93.4 %** | 92.8 % | 91.4 % |
| Numbers sung correctly | **all** (44, seven, 28, 18.5, 66,000, 762, 439, 30, nine, 300) | Verse 1 unintelligible: "May brought eleven" transcribed as "They got a liquid"; "Five" transcribed as "Fire" | **FAIL**: both choruses sing "Seven last year, now it's *four* … forty-four" |
| "First and foremost, Postgres must be reliable" | clean | clean | clean |
| Lines dropped | none | chorus 2 drops "Hold the line in a burning town" | "We don't need faster" transcribed as "Don't go any faster" in chorus 2 |
| Tempo | 128.0 BPM (drum-stem grid fit, p90 residual 7.5 ms) | 129.2 (librosa bin) | 129.2 (librosa bin) |
| Bridge vs chorus loudness (raw take) | −0.9 dB (drums keep playing) | **−10.0 dB** (real drop) | −3.0 dB |
| Final chorus vs chorus | +0.2 dB, vocal register about 8 semitones higher, stacked voices | +0.8 dB | +0.5 dB |
| Key change in the final chorus | no (pitch classes stay E/G#; the lift is register, not key) | no | no |
| Intro | piano only; the intro lyrics were **not sung** (vocal stem about −60 dB) | sung, soft | sung, partly garbled ("Fortune sources") |

## Choice: A, remixed from its stems

A is the only take that passes the fact check end to end. C sings a wrong number in the hook. B has the best raw bridge, but its Verse 1 can't be verified as sung correctly and it loses a chorus line.

A's two arrangement failures were fixed from its ElevenLabs stems (`stemsA/`: vocals, drums, bass, guitar, piano, other; the stems sum to the mix within 2 % residual at 0 sample offset). The fix is `pgfilm/films/pg19-song/audio/remix.py`:
- **Spoken bridge (131.25–145.8 s):** drums and bass removed, the bed ducked 9 dB and low-passed at 900 Hz, plus a synthesized clock tick every two beats. The tick stops before "First and foremost", so the quote plays alone over piano. The bridge now sits **−9.3 dB** below chorus 2 (it was −1.2 dB).
- **Build (153.75–168.75 s):** drums and bass ramp from −30 dB to 0 dB across the 8 bars, so the drums now return slowly as the plan asked.
- Everything outside those windows is the original mix, spliced with 40 ms equal-power crossfades. The master is at −14.0 LUFS integrated, −2.9 dBFS peak.

Final audio: `final/must-be-reliable.wav`.

## Lyric deviations (take A)
- **Intro:** not sung. The four intro lines ("Nineteen ninety-six, July / Virgin sources, one commit / Thirty years of holding on / Nobody said it would be easy") appear on screen only, as silent titles timed to piano notes. The facts are unchanged.
- **Sung text:** no wording changes; every line is sung as written.
- **Soft consonants:** in the full mix whisper hears "Oh, stress" for "Postgres" in the final chorus, but the vocal stem transcribes it correctly as "Postgres, you never let me down". "Property graphs" and "For portion of" are spoken quietly and are sometimes heard as "Property drafts" and "Proportion of".
- **Key change:** the final chorus has none. It lifts through register and stacked voices instead.

## Credits
- Each 3:28 generation cost 1,429 credits, so the three takes cost 4,287.
- Stem separation of take A cost 2,859.
- Total spend: 7,146 credits. The account counter went from 292 to 7,438.
- Three generations were used out of the budget of five.
