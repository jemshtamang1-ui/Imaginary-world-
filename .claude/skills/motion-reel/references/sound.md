# Sound reference

`template/sound.py` builds everything from numpy oscillators and filtered noise: no samples, so no
licensing questions. It reads `work/cues.json` (written by `node tools/export_cues.cjs`).

## Score

* Four-bar loop of lush extended chords (Dmaj9 → Bm9 → Gmaj9 → A6sus) at 96 bpm: detuned-saw pad
  through a low-pass filter, an eighth-note pluck arpeggio with ping-pong delay, a soft sine kick, an
  air-noise bed, and convolution reverb throughout.
* **Arrangement follows the edit** through `{t, type: 'score', level}` cues (0..1): below 0.25 it's pad
  only (use this for a hush, such as the space beat), plucks fade in from 0.25–0.75, and the kick comes
  in above 0.6. Drop the level right before a big reveal and slam it to 1 on the reveal.
* Change key or progression in `PROG` (MIDI root, intervals). Change tempo with `score(..., bpm=)`.
  Keep cuts musical: put big reveals on bar lines where you can (bar = 2.5 s at 96 bpm).

## SFX vocabulary

| cue | `t` means | sound | use on |
|---|---|---|---|
| `whoosh` | the cut | band-pass noise sweep with stereo pan, peaks at 60% | every cut (auto for whip/rush/wipe) |
| `impact` | the hit | pitch-dropping sub, boom, click, short room | every punch word (auto for `^words`), reveals |
| `riser` | the reveal it lands on | rising high-pass noise, gliding tone, accelerating tremolo | into every big reveal |
| `typing` | first keystroke | randomized key clicks with thock | under every typed line (dur = typing time) |
| `click` | the press | crisp UI click | send buttons, toggles |
| `pop` | glass appears | soft upward blip | glass UI entrances |
| `swarm` | burst start | a dozen tiny panned whooshes | card swarms, particles |
| `crack` | first crack | accelerating crackles and pings | fracture build-up (dur until the shatter) |
| `shatter` | the break | noise burst, 40 glass tinkles, impact | the shatter |
| `crt` | collapse start | descending tone, mains buzz | CRT collapse (auto) |
| `shimmer` | start | high chord cluster with tremolo | title cards, magic moments |

Any cue takes `gain` (linear). Per-type gains are in `SFX_GAIN`.

## Mix targets and how to measure

* **Voice 8–14 dB over the bed in the speech band** (300–3400 Hz) while speaking. With `--vo`, sound.py
  ducks the bed up to 8 dB with a voice-envelope sidechain, measures that gap, trims the bed to about
  11 dB, and prints the before value.
* **Loudness:** render.sh does two-pass `loudnorm` to −14 LUFS integrated, −1 dBTP. Check with
  `ffmpeg -i out.mp4 -af ebur128=peak=true -f null -` (look at I and Peak in the summary).
* **Shape check without ears:** a spectrogram shows every SFX as a vertical event, so mistimed cues stand out:
  `ffmpeg -i work/mix.wav -lavfi showspectrumpic=s=1200x400:legend=1:scale=log spec.png`. Also print
  RMS per half second (see SKILL step 5) to confirm the hush and reveal dynamics.
* **Stems:** `STEM=sfx`, `STEM=score` or `STEM=vo` writes only that bus. Offer the SFX stem to the user.
* **User music:** `--music track.wav` replaces the synth score and keeps all SFX timing and the ducking.
