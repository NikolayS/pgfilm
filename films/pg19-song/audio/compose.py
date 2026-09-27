"""Generate a take of "Must Be Reliable" with the ElevenLabs Music API (music_v2_5, chunk composition plan).

usage: ELEVENLABS_API_KEY=... python3 audio/compose.py <take-name> <voice: male|female|duet> <seed> <outdir>
Writes <outdir>/<take>.mp3, <take>.json (metadata + word timestamps from the API) and <take>.plan.json.
The key is read from the environment only; it is never printed or written.
128 BPM -> one bar = 1875 ms; every chunk is a whole number of bars.
"""
import json, os, sys, urllib.request, email, email.policy

BAR = 1875
VOICE = {
    'male':   ['warm male lead vocal', 'female harmony vocals in choruses'],
    'female': ['warm female lead vocal, clear alto', 'male harmony vocals in choruses'],
    'duet':   ['male and female duet, verses trade lines, choruses sung together in harmony'],
}

def plan(voice):
    V = VOICE[voice]
    base = ['anthemic synth-pop rock', '128 BPM', 'E minor', *V, 'driving eighth-note bass', 'gated 80s drums',
            'clear diction, every word intelligible', 'great production quality']
    C = lambda name, bars, lines, pos, neg=(), adh='high': {
        'text': f'[{name}]' + ('\n' + '\n'.join(lines) if lines else ''), 'duration_ms': bars * BAR,
        'positive_styles': list(pos), 'negative_styles': list(neg), 'context_adherence': adh}
    chorus = ['Forty-four, forty-four', 'Knocking, knocking at the door', 'Seven last year, now it\'s forty-four',
              'Postgres, please don\'t let me down', 'Hold the line in a burning town',
              'We don\'t need faster, we need more', 'Forty-four']
    return {'chunks': [
        C('Intro', 6, ['Nineteen ninety-six, July', 'Virgin sources, one commit', 'Thirty years of holding on',
                       'Nobody said it would be easy'],
          ['intimate felt piano alone', 'soft half-whispered vocal', 'anthemic synth-pop rock', '128 BPM', 'E minor', *V,
           'close-mic\'d', 'great production quality'], ['drums', 'loud']),
        C('Verse 1', 12, ['February came with a heap overflow', 'Five in the patch notes, fix it, let it go',
                          'May brought eleven, a record for a while', 'We shipped the minor release and we forced a smile',
                          'Somebody\'s scanner reading every line at night', 'Finding the ghosts we left in plain sight'],
          [*base, 'drums enter', 'verse, restrained energy', 'pulsing synth bass']),
        C('Pre-Chorus', 4, ['And the counter keeps on climbing', 'Climbing, climbing'],
          ['rising tension', 'snare roll build', 'stacked vocals rising']),
        C('Chorus', 14, chorus, ['big shout-along chorus', 'full band', 'gated drums hitting hard', 'female harmony',
                                 'anthemic', 'punchy'], ['sparse', 'a cappella']),
        C('Verse 2', 16, ['August came, twenty-eight in one go', 'The most we ever fixed at once, now you know',
                          'Eighteen-five never shipped, a regression in the way', 'Beta three came riding on the very same day',
                          'Out there curl shut its bounty down', 'A worm crawled through npm, town to town',
                          'Sixty-six thousand forecast for the year', 'Every maintainer running out of here'],
          ['verse, driving and tense', 'eighth-note bass', 'tight drums', 'clear diction, every word intelligible']),
        C('Pre-Chorus', 4, ['And the counter keeps on climbing', 'Climbing, climbing'],
          ['rising tension', 'snare roll build', 'stacked vocals rising']),
        C('Chorus', 14, chorus, ['big shout-along chorus', 'full band', 'gated drums hitting hard', 'harmony vocals',
                                 'anthemic', 'even bigger than before'], ['sparse', 'a cappella']),
        C('Bridge', 8, ['{spoken} Beta four. September.', 'Property graphs. Gone.', 'Online checksums. Gone.',
                        'For portion of. Gone.', 'Merge and split partitions. Gone.',
                        'And somebody wrote it down, plain as day'],
          ['music drops out to near silence', 'ticking clock', 'spoken word, calm low voice, filtered like a radio',
           'faint sustained synth pad', 'no drums'], ['drums', 'bass', 'singing', 'full band', 'loud']),
        C('Bridge Quote', 4, ['First and foremost, Postgres must be reliable'],
          ['a single voice sung alone', 'soft piano chord', 'fragile and exposed', 'no drums', 'slow and clear'],
          ['drums', 'full band', 'loud']),
        C('Build', 8, ['Seven hundred sixty-two commits since beta one', 'Four hundred thirty-nine of them say fix',
                       'Thirty committers, nights and weekends gone', 'Nine open items left on the list'],
          ['drums return slowly', 'kick on every beat building', 'stacked voices', 'rising energy', 'crescendo',
           'clear diction, every word intelligible'], ['full band from the start']),
        C('Final Chorus', 16, ['Must be reliable, must be reliable', 'We cut what wasn\'t ready, kept what\'s true',
                               'Repack concurrently, vacuum in parallel', 'Thirty years and still we\'re coming through',
                               'Three hundred hands wrote the code this year', 'Not the fastest, but still here',
                               'Postgres, you never let me down', 'Hold the line, it\'s still our town'],
          ['key change up to G major', 'full band, maximum energy', 'hopeful and bright', 'choir of stacked harmonies',
           'euphoric final chorus', 'big gated drums'], ['sad', 'sparse']),
        C('Outro', 5, ['Release candidate, early October', 'Test it, tell us what you find', 'Commit.'],
          ['felt piano alone', 'one soft voice', 'band stops', 'ends on a single piano note', 'G major'],
          ['drums', 'fade into noise']),
    ]}

def main():
    take, voice, seed, out = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
    p = plan(voice)
    json.dump(p, open(f'{out}/{take}.plan.json', 'w'), indent=1)
    body = json.dumps({'composition_plan': p, 'model_id': 'music_v2_5', 'seed': seed, 'with_timestamps': True}).encode()
    req = urllib.request.Request('https://api.elevenlabs.io/v1/music/detailed?output_format=mp3_48000_320', data=body,
                                 headers={'xi-api-key': os.environ['ELEVENLABS_API_KEY'], 'Content-Type': 'application/json'})
    try:
        r = urllib.request.urlopen(req, timeout=900)
    except urllib.error.HTTPError as e:
        print('HTTP', e.code, e.read()[:2000].decode(errors='replace')); sys.exit(1)
    hdr = {k: v for k, v in r.headers.items() if k.lower() in ('song-id', 'x-song-id', 'content-type', 'character-cost', 'x-character-count', 'request-id', 'history-item-id')}
    raw = r.read()
    msg = email.message_from_bytes(b'Content-Type: ' + r.headers['Content-Type'].encode() + b'\r\n\r\n' + raw, policy=email.policy.default)
    meta = {'headers': hdr, 'seed': seed, 'voice': voice}
    for part in msg.iter_parts():
        ct = part.get_content_type(); data = part.get_payload(decode=True)
        if 'json' in ct: meta['detail'] = json.loads(data)
        elif 'audio' in ct or 'octet' in ct: open(f'{out}/{take}.mp3', 'wb').write(data)
    json.dump(meta, open(f'{out}/{take}.json', 'w'), indent=1)
    print(take, 'ok', hdr, 'audio bytes', os.path.getsize(f'{out}/{take}.mp3'))

if __name__ == '__main__':
    main()
