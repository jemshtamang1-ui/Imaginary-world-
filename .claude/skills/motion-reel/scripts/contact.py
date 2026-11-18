"""Tile review frames into a labelled contact sheet.
Usage: python3 -I scripts/contact.py out.png [--w 640] [--cols 3] frame1.png frame2.png ..."""
import sys, os
from PIL import Image, ImageDraw
args = sys.argv[1:]; out = args.pop(0); w, cols = 640, 3
while args and args[0].startswith('--'):
    k = args.pop(0); v = int(args.pop(0))
    if k == '--w': w = v
    elif k == '--cols': cols = v
ims = [Image.open(f).convert('RGB') for f in args]
h = round(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * h + (rows + 1) * 6), (18, 20, 26))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, args)):
    x, y = 6 + (i % cols) * (w + 6), 6 + (i // cols) * (h + 6)
    sheet.paste(im.resize((w, h), Image.LANCZOS), (x, y))
    label = os.path.splitext(os.path.basename(f))[0]
    d.rectangle([x, y, x + 8 * len(label) + 10, y + 18], fill=(0, 0, 0))
    d.text((x + 5, y + 3), label, fill=(255, 255, 255))
sheet.save(out); print('wrote', out, sheet.size)
