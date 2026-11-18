"""Original score + sound design, synthesized from scratch, mixed under an optional voice-over.

Usage:
  node tools/export_cues.cjs                       # writes work/cues.json from the director
  python3 -I sound.py work/cues.json [--vo vo.wav] [--music track.wav] [--out work/mix.wav]
  STEM=sfx python3 -I sound.py ...                 # SFX only (also STEM=score, STEM=vo)

Cue types: whoosh, impact, riser, typing, click, pop, swarm, crack, shatter, crt, shimmer,
           score (arrangement level change: {t, type:'score', level:0..1})
"""
import json, os, sys, argparse
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
rng = np.random.default_rng(7)

def T(sec): return int(round(sec * SR))
def secs(n): return np.arange(n) / SR
def db(x): return 10 ** (x / 20)
def adsr(n, a, r, curve=3.0):
    e = np.ones(n); A, R = min(T(a), n), min(T(r), n)
    if A: e[:A] = np.linspace(0, 1, A) ** 1.5
    if R: e[-R:] *= np.linspace(1, 0, R) ** curve
    return e
def lp(x, f, order=2): return signal.sosfilt(signal.butter(order, min(f, SR * .45), 'low', fs=SR, output='sos'), x, axis=0)
def hp(x, f, order=2): return signal.sosfilt(signal.butter(order, f, 'high', fs=SR, output='sos'), x, axis=0)
def bp(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, min(hi, SR * .45)], 'band', fs=SR, output='sos'), x, axis=0)
def sweep_filter(x, freqs, kind='band', q=1.2, block=256):
    """Time-varying filter: freqs is an array (one value per sample)."""
    y = np.zeros_like(x); zi = None
    for i in range(0, len(x), block):
        f = float(np.clip(freqs[min(i, len(freqs) - 1)], 40, SR * .42))
        if kind == 'band': sos = signal.butter(2, [f / (1 + 1 / q), f * (1 + 1 / q)], 'band', fs=SR, output='sos')
        elif kind == 'high': sos = signal.butter(2, f, 'high', fs=SR, output='sos')
        else: sos = signal.butter(2, f, 'low', fs=SR, output='sos')
        if zi is None or zi.shape[0] != sos.shape[0]: zi = signal.sosfilt_zi(sos) * 0
        y[i:i + block], zi = signal.sosfilt(sos, x[i:i + block], zi=zi)
    return y
def pan(mono, p):  # p in [-1,1], constant power
    a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)
def pan_sweep(mono, p0, p1):
    p = np.linspace(p0, p1, len(mono)); a = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], 1)
def noise(n): return rng.standard_normal(n)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)

_ir = None
def reverb(x, wet=.25, decay=2.4, pre=.02):
    global _ir
    if _ir is None:
        n = T(decay); t = secs(n)
        ir = np.stack([noise(n), noise(n)], 1) * np.exp(-t * 6.9 / decay)[:, None]
        ir = lp(ir, 7000); ir[:T(pre)] = 0
        _ir = ir / np.sqrt((ir ** 2).sum())
    y = np.stack([signal.fftconvolve(x[:, c], _ir[:, c])[:len(x)] for c in range(2)], 1)
    return x * (1 - wet * .5) + y * wet * 2.2

def place(bus, snd, t):
    i = T(t)
    if i < 0: snd = snd[-i:]; i = 0
    j = min(len(bus), i + len(snd))
    if j > i: bus[i:j] += snd[:j - i]

# ---------------------------------------------------------------- SFX vocabulary
def sfx_whoosh(dur=.5, amount=.8, p0=-.7, p1=.7):
    n = T(dur); x = noise(n); k = np.linspace(0, 1, n)
    env = np.where(k < .6, (k / .6) ** 2.2, ((1 - k) / .4) ** 1.6)
    f = 250 + 3200 * np.sin(np.pi * np.clip(k / .75, 0, 1)) ** 2
    y = sweep_filter(x, f, 'band', q=1.4) * env * 1.1 + lp(x, 300) * env * .5
    return pan_sweep(y * amount, p0, p1), .6 * dur      # (sound, offset of its peak)
def sfx_impact(amount=1.0):
    n = T(2.2); t = secs(n)
    f = 38 + 34 * np.exp(-t * 9)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.6)
    boom = lp(noise(n), 160) * np.exp(-t * 5) * 2.5
    click = hp(noise(n), 2500) * np.exp(-t * 90) * .5
    body = bp(noise(n), 400, 1800) * np.exp(-t * 14) * .5
    y = (sub * 1.1 + boom + click + body) * amount
    return reverb(pan(y, 0), .18), 0
def sfx_riser(dur=1.2):
    n = T(dur); k = np.linspace(0, 1, n)
    x = sweep_filter(noise(n), 400 + 9000 * k ** 2.2, 'high') * k ** 2.5
    f = 180 * 2 ** (k * 2.5)
    tone = (np.sin(2 * np.pi * np.cumsum(f) / SR) + .5 * np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR)) * k ** 3 * .25
    trem = 1 + .25 * np.sin(2 * np.pi * (3 + 14 * k ** 2) * secs(n))
    y = (x * .7 + tone) * trem
    y[-T(.012):] *= np.linspace(1, 0, T(.012))
    return reverb(np.stack([y, np.roll(y, 240)], 1) * .8, .3), dur
def sfx_click(gain=1.0):
    n = T(.09); t = secs(n)
    y = np.sin(2 * np.pi * 1900 * t) * np.exp(-t * 120) * .6 + bp(noise(n), 3000, 9000) * np.exp(-t * 300) * .5
    y += np.sin(2 * np.pi * 900 * t) * np.exp(-t * 80) * .35
    return pan(y * gain, .05), 0
def sfx_pop():
    n = T(.22); t = secs(n); f = 420 + 700 * (1 - np.exp(-t * 30))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22) * .45 + lp(noise(n), 2500) * np.exp(-t * 60) * .25
    return reverb(pan(y, 0), .25), 0
def sfx_typing(dur=1.3):
    out = np.zeros((T(dur) + T(.1), 2)); t = 0
    while t < dur:
        n = T(.05); s = secs(n)
        k = bp(noise(n), 2500 + rng.random() * 2500, 9000) * np.exp(-s * 420) * (.35 + rng.random() * .2)
        k += np.sin(2 * np.pi * (150 + rng.random() * 60) * s) * np.exp(-s * 160) * .35
        place(out, pan(k, (rng.random() - .5) * .3), t)
        t += .055 + rng.random() * .06 + (.12 if rng.random() < .08 else 0)
    return reverb(out, .12), 0
def sfx_swarm(dur=1.0):
    out = np.zeros((T(dur + .8), 2))
    for i in range(14):
        w, _ = sfx_whoosh(.18 + rng.random() * .25, .25 + rng.random() * .25, (rng.random() - .5) * 2, (rng.random() - .5) * 2)
        place(out, w, rng.random() ** 1.5 * dur)
    return out, 0
def sfx_crack(dur=.45):
    out = np.zeros((T(dur + .5), 2)); t = 0
    while t < dur:
        n = T(.03); s = secs(n)
        c = hp(noise(n), 1500) * np.exp(-s * 500) * (.3 + .7 * t / dur)
        c += np.sin(2 * np.pi * (2500 + rng.random() * 4000) * s) * np.exp(-s * 140) * .2
        place(out, pan(c, (rng.random() - .5) * .6), t)
        t += .07 * (1 - .8 * t / dur) + rng.random() * .03
    return reverb(out, .2), 0
def sfx_shatter():
    n = T(2.0); t = secs(n)
    burst = hp(noise(n), 900) * np.exp(-t * 18) * 1.1
    y = pan(burst, 0)
    for i in range(40):
        m = T(.6); s = secs(m); f = 2500 + rng.random() * 6500
        ping = np.sin(2 * np.pi * f * s) * np.exp(-s * (12 + rng.random() * 20)) * (.08 + rng.random() * .12)
        place(y, pan(ping, (rng.random() - .5) * 1.6), rng.random() ** 2 * 1.0)
    imp, _ = sfx_impact(.8)
    place(y, imp[:n], 0)
    return reverb(y, .3), 0
def sfx_crt(dur=.3):
    n = T(dur + .25); t = secs(n); k = np.clip(t / dur, 0, 1)
    f = 1400 * (1 - k) ** 2 + 50
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * .35 * (1 - k * .6)
    y += signal.square(2 * np.pi * 60 * t) * .06 * (1 - k)
    y += hp(noise(n), 3000) * .15 * np.exp(-t * 8)
    end = T(dur); y[end:] *= np.exp(-secs(n - end) * 40)
    return reverb(pan(y, 0), .2), 0
def sfx_shimmer(dur=2.0, root=74):
    n = T(dur); t = secs(n); y = np.zeros(n)
    for i, iv in enumerate([0, 7, 12, 16, 19, 24, 28]):
        f = mtof(root + 12 + iv)
        y += np.sin(2 * np.pi * f * t + i) * (1 + .3 * np.sin(2 * np.pi * (5 + i) * t)) / (1 + i * .5)
    y *= adsr(n, .25, dur * .7) * .09
    return reverb(np.stack([y, np.roll(y, 400)], 1), .55), 0

SFX = {'whoosh': lambda c: sfx_whoosh(c.get('dur', .5), c.get('amount', .8)), 'impact': lambda c: sfx_impact(c.get('amount', 1)),
       'riser': lambda c: sfx_riser(c.get('dur', 1.2)), 'click': lambda c: sfx_click(), 'pop': lambda c: sfx_pop(),
       'typing': lambda c: sfx_typing(c.get('dur', 1.3)), 'swarm': lambda c: sfx_swarm(c.get('dur', 1)), 'crack': lambda c: sfx_crack(c.get('dur', .45)),
       'shatter': lambda c: sfx_shatter(), 'crt': lambda c: sfx_crt(c.get('dur', .3)), 'shimmer': lambda c: sfx_shimmer(c.get('dur', 2))}
SFX_GAIN = {'whoosh': .55, 'impact': .9, 'riser': .5, 'click': .5, 'pop': .45, 'typing': .55, 'swarm': .45, 'crack': .6, 'shatter': .7, 'crt': .5, 'shimmer': .6}

# ---------------------------------------------------------------- score
PROG = [(62, [0, 4, 7, 11, 14]), (59, [0, 3, 7, 10, 14]), (55, [0, 4, 7, 11, 14]), (57, [0, 2, 7, 9, 14])]  # Dmaj9 Bm9 Gmaj9 A6sus

def level_curve(n, cues, dur):
    pts = [(0, .45)] + [(c['t'], c.get('level', .7)) for c in cues if c['type'] == 'score']
    if len(pts) == 1: pts.append((dur, .9))
    xs, ys = zip(*sorted(pts))
    # hold each level, with short glides
    lev = np.interp(secs(n), xs, ys)
    steps = np.zeros(n); cur = ys[0]; j = 0
    for i, (x, y) in enumerate(zip(xs, ys)): steps[T(x):] = y
    return lp(steps, 3) if len(pts) > 2 else lev

def score(dur, cues, bpm=96):
    n = T(dur + 1.5); t = secs(n); beat = 60 / bpm; bar = beat * 4
    lev = level_curve(n, cues, dur)
    pad = np.zeros((n, 2)); pl = np.zeros((n, 2)); kick = np.zeros(n)
    nb = int(np.ceil((dur + 1.5) / bar))
    for b in range(nb):
        root, ivs = PROG[b % len(PROG)]
        s0, L = T(b * bar), T(bar + 1.2)
        seg = np.zeros((L, 2)); tt = secs(L)
        for iv in ivs:
            f = mtof(root - 12 + iv)
            for det, p in ((-.08, -.6), (0, 0), (.08, .6)):
                ff = f * 2 ** (det / 12)
                saw = 2 * ((tt * ff + rng.random()) % 1) - 1
                seg += pan(saw, p) * .05
        seg = lp(seg, 1600) * adsr(L, .6, 1.4)[:, None]
        place(pad, seg, b * bar)
        # arpeggio: 8ths of chord tones, upper octave
        for k in range(8):
            f = mtof(root + 12 + ivs[(k * 2 + b) % len(ivs)])
            m = T(1.2); s = secs(m)
            pluck = (np.sin(2 * np.pi * f * s) + .3 * np.sin(4 * np.pi * f * s) + .1 * np.sin(6 * np.pi * f * s)) * np.exp(-s * 5.5) * .11
            place(pl, pan(pluck, .35 if k % 2 else -.35), b * bar + k * beat / 2)
        for k in range(4):
            m = T(.5); s = secs(m); f = 48 + 60 * np.exp(-s * 35)
            kk = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-s * 9)
            i0 = T(b * bar + k * beat); kick[i0:i0 + m] += kk[:max(0, min(m, n - i0))]
    # delay on plucks
    d = T(beat * .75); dl = np.zeros_like(pl); dl[d:] += pl[:-d, ::-1] * .35; dl[2 * d:] += pl[:-2 * d] * .15
    pl = pl + dl
    air = np.stack([hp(noise(n), 6000), hp(noise(n), 6000)], 1) * .012
    pad_lev = (.55 + .45 * lev)[:, None]; pl_lev = np.clip((lev - .25) / .5, 0, 1)[:, None]; k_lev = np.clip((lev - .6) / .3, 0, 1)
    pad_f = lp(pad * pad_lev, 900 + 4000 * float(np.mean(lev)))
    mix = pad_f + pl * pl_lev + air + pan(kick * k_lev * .5, 0)
    return reverb(mix, .35)[:n]

# ---------------------------------------------------------------- mix
def load(path):
    sr, x = wavfile.read(path)
    x = x.astype(np.float32) / (np.iinfo(x.dtype).max if x.dtype.kind == 'i' else 1)
    if x.ndim == 1: x = np.stack([x, x], 1)
    if sr != SR: x = signal.resample_poly(x, SR, sr, axis=0)
    return x
def band_rms(x, mask):
    y = bp(x.mean(1), 300, 3400)
    return 20 * np.log10(np.sqrt(np.mean(y[mask] ** 2)) + 1e-9)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cues'); ap.add_argument('--vo'); ap.add_argument('--music'); ap.add_argument('--out', default='work/mix.wav')
    a = ap.parse_args(); stem = os.environ.get('STEM', 'all')
    data = json.load(open(a.cues)); dur = data['meta']['duration']; cues = data['cues']
    n = T(dur + .2)
    sfx = np.zeros((n, 2))
    for c in cues:
        f = SFX.get(c['type'])
        if not f: continue
        snd, peak = f(c)
        place(sfx, snd * SFX_GAIN[c['type']] * c.get('gain', 1), c['t'] - peak)
    bed = load(a.music)[:n] if a.music else score(dur, cues)[:n]
    if len(bed) < n: bed = np.pad(bed, ((0, n - len(bed)), (0, 0)))
    vo = None
    if a.vo:
        vo = load(a.vo)[:n]; vo = np.pad(vo, ((0, n - len(vo)), (0, 0)))
        # sidechain duck: follow the voice envelope, pull the bed down up to 8 dB
        e = np.abs(bp(vo.mean(1), 200, 4000)); e = signal.sosfilt(signal.butter(1, 6, fs=SR, output='sos'), e)
        e = e / (e.max() + 1e-9); duck = 1 - np.clip(e * 3, 0, 1) * (1 - db(-8))
        bed = bed * duck[:, None]
        speech = e > .08
        if speech.any():
            gap = band_rms(vo, speech) - band_rms(bed + sfx * .5, speech)
            target = 11.0
            bed *= db(np.clip(gap - target, -12, 12)); 
            print(f'voice over bed (speech band): {gap:.1f} dB before, adjusted to ~{target} dB')
    parts = {'sfx': sfx, 'score': bed, 'vo': vo if vo is not None else np.zeros_like(sfx)}
    mix = parts[stem] if stem in parts else bed * .8 + sfx + (vo * 1.0 if vo is not None else 0)
    mix = np.tanh(mix * 1.1) / 1.1          # gentle safety saturation
    mix /= max(1e-9, np.abs(mix).max() / .89)
    os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
    wavfile.write(a.out, SR, mix.astype(np.float32))
    print(f'wrote {a.out} ({dur:.2f}s, stem={stem}, {len([c for c in cues if c["type"] in SFX])} sfx cues)')

if __name__ == '__main__': main()
