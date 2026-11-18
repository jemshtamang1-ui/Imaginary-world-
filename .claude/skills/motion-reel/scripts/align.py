"""Force-align a voice-over to its script -> per-word timings (words.json) for the text system.

Usage:
  ffmpeg -i vo.mp3 -ac 1 -ar 16000 vo16.wav
  python3 -I scripts/align.py vo16.wav script.txt words.json [--dict extra.dict]

Needs `pip install pocketsphinx` (the US-English model ships inside the wheel, so this works offline).
Words missing from the pronunciation dictionary are listed; add them to a dict file, one per line,
in CMUdict format, e.g.:   daydream D EY D R IY M
Output: [{"w": "What", "t0": 0.41, "t1": 0.6}, ...] in script order, including punctuation-stripped words.
"""
import sys, json, re, argparse, wave
import numpy as np
from pocketsphinx import Decoder

ap = argparse.ArgumentParser()
ap.add_argument('wav'); ap.add_argument('script'); ap.add_argument('out'); ap.add_argument('--dict')
a = ap.parse_args()

text = open(a.script).read()
raw_words = re.findall(r"[A-Za-z0-9']+(?:[-.][A-Za-z0-9']+)*[.,!?;:…]*", text)
norm = [re.sub(r"[^a-z0-9']", '', w.lower()) for w in raw_words]
norm = [w for w in norm if w]

with wave.open(a.wav) as wf:
    if wf.getframerate() != 16000 or wf.getnchannels() != 1:
        sys.exit('expected 16 kHz mono wav: ffmpeg -i vo.mp3 -ac 1 -ar 16000 vo16.wav')
    audio = wf.readframes(wf.getnframes())

dec = Decoder(bestpath=False, samprate=16000, loglevel='FATAL')
if a.dict:
    for line in open(a.dict):
        parts = line.split()
        if len(parts) >= 2: dec.add_word(parts[0].lower(), ' '.join(parts[1:]), True)
missing = sorted({w for w in norm if dec.lookup_word(w) is None})
if missing:
    print('not in dictionary (add to --dict file with phones, e.g. "word W ER D"):', ' '.join(missing))
    sys.exit(2)

dec.set_align_text(' '.join(norm))
dec.start_utt(); dec.process_raw(audio, full_utt=True); dec.end_utt()
seg = dec.seg()
if seg is None or dec.hyp() is None:
    sys.exit('alignment failed: make sure script.txt matches the VO word for word, the audio is clean speech, and the wav is 16 kHz mono')
segs = [s for s in seg if s.word not in ('<s>', '</s>', '<sil>', '[NOISE]', '(NULL)')]
if len(segs) != len(norm):
    print(f'warning: aligned {len(segs)} words, script has {len(norm)}; check the script matches the VO exactly')

out = []
for i, s in enumerate(segs):
    w = re.sub(r'\(\d+\)$', '', s.word)
    display = raw_words[i] if i < len(raw_words) else w
    out.append({'w': re.sub(r"[.,!?;:…]+$", '', display), 't0': round(s.start / 100, 3), 't1': round((s.end + 1) / 100, 3)})
json.dump(out, open(a.out, 'w'), indent=0)
print(f'wrote {a.out}: {len(out)} words, {out[0]["t0"] if out else 0:.2f}s - {out[-1]["t1"] if out else 0:.2f}s')
gaps = [(out[i]['t1'], out[i + 1]['t0']) for i in range(len(out) - 1) if out[i + 1]['t0'] - out[i]['t1'] > .25]
if gaps: print('pauses > 0.25s (good cut points):', ', '.join(f'{a:.2f}-{b:.2f}' for a, b in gaps))
