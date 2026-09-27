"""Word-level transcription of a take with faster-whisper (large-v3-turbo), no lyric prompt (independent fact-check).
usage: python tools/transcribe.py take.mp3 out.json"""
import json, sys
from faster_whisper import WhisperModel
m = WhisperModel('large-v3-turbo', compute_type='int8')
segs, _ = m.transcribe(sys.argv[1], language='en', word_timestamps=True, vad_filter=False,
                       condition_on_previous_text=False, beam_size=5)
out = []
for s in segs:
    out.append({'start': s.start, 'end': s.end, 'text': s.text,
                'words': [{'w': w.word, 's': w.start, 'e': w.end, 'p': w.probability} for w in s.words]})
    print(f'[{s.start:6.1f}-{s.end:6.1f}] {s.text}', flush=True)
json.dump(out, open(sys.argv[2], 'w'), indent=0)
