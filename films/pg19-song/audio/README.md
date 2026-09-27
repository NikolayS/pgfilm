# Audio

- `compose.py` generates a take through the ElevenLabs Music API (a `music_v2_5` chunk composition plan) and saves the mp3, the returned plan, word timestamps and song id. Usage: `ELEVENLABS_API_KEY=… python3 audio/compose.py takeA_male male 1901 <takes-dir>`.
- `remix.py` does the surgical stem remix of take A (bridge drop, clock tick, slow drum return in the build). It writes `<takes-dir>/final/remix_raw.wav`. Loudness is then set with a linear `-2.84 dB` gain to −14.0 LUFS: `ffmpeg -i remix_raw.wav -af volume=-2.84dB must-be-reliable.wav`.
- `takes.md` compares the three takes and explains why take A was chosen, with the lyric deviations.

The takes, the stems (`stemsA/*.flac`, from `POST /v1/music/stem-separation`) and the final wav live outside git, in `~/Desktop/pg19-song/takes/`.
