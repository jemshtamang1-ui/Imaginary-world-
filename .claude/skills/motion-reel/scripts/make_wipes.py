"""Generate soft foreground cloud wipes (white + alpha) for DOM cloud-wipe transitions.
Usage: python3 -I scripts/make_wipes.py assets [count=3]"""
import sys, os, numpy as np
from PIL import Image, ImageFilter
d = sys.argv[1] if len(sys.argv) > 1 else 'assets'
n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
W, H = 2400, 1400
def fbm(h, w, rng, oct=6):
    out = np.zeros((h, w))
    amp = 1.0
    for o in range(oct):
        s = 2 ** (o + 2)
        g = rng.random((s * h // w + 2, s + 2))
        img = Image.fromarray((g * 255).astype('uint8')).resize((w, h), Image.BICUBIC)
        out += amp * (np.asarray(img) / 255.0)
        amp *= .5
    return out / (2 - 2 ** (1 - oct))
for k in range(n):
    rng = np.random.default_rng(42 + k)
    yy, xx = np.mgrid[0:H, 0:W] / np.array([H, W])[:, None, None]
    # a horizontal bank of billows, densest in the middle band
    base = np.zeros((H, W))
    for _ in range(40):
        cx, cy, r = rng.random(), .5 + (rng.random() - .5) * .45, .08 + rng.random() * .16
        base = np.maximum(base, 1 - np.hypot((xx - cx) * W / H, yy - cy) / r)
    f = fbm(H, W, rng)
    dens = np.clip((base + (f - .5) * .9) * 2.2, 0, 1)
    shade = np.clip(.78 + .3 * (1 - yy) + (f - .5) * .3, 0, 1)
    rgb = np.stack([shade * .99 + .01, shade * .995 + .005, np.ones_like(shade)], -1)
    a = Image.fromarray((dens * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(6))
    img = Image.fromarray((rgb * 255).astype('uint8')).convert('RGBA'); img.putalpha(a)
    img.save(os.path.join(d, f'wipe_{k}.png'), optimize=True)
    print('wrote', os.path.join(d, f'wipe_{k}.png'))
