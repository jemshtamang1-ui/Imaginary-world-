"""Pack assets/cloud_XX.png into assets/clouds_atlas.png (4x3 grid) + clouds_atlas.json.
Usage: python3 -I scripts/pack_atlas.py assets"""
import sys, glob, json, os
from PIL import Image
d = sys.argv[1] if len(sys.argv) > 1 else 'assets'
files = sorted(glob.glob(os.path.join(d, 'cloud_[0-9][0-9].png')))
if not files: sys.exit('no cloud_XX.png in ' + d + ' (run node tools/tools_bake.cjs first)')
cols, rows = 4, (len(files) + 3) // 4
size = Image.open(files[0]).size[0]
atlas = Image.new('RGBA', (cols * size, rows * size), (0, 0, 0, 0))
for i, f in enumerate(files):
    atlas.paste(Image.open(f).convert('RGBA'), ((i % cols) * size, (i // cols) * size))
atlas.save(os.path.join(d, 'clouds_atlas.png'), optimize=True)
json.dump({'cols': cols, 'rows': rows, 'count': len(files), 'tile': size,
           'kinds': [i % 3 for i in range(len(files))]},  # 0 wide, 1 heap, 2 tower
          open(os.path.join(d, 'clouds_atlas.json'), 'w'))
print('packed', len(files), 'tiles ->', os.path.join(d, 'clouds_atlas.png'))
