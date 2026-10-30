# Finish concept paintings from concepts.py for the game:
#   python3 scripts/glimmers/concepts-finish.py <dir> [--to public/game/glimmers] [id ...]
# Reads <dir>/raw/<id>.png (1024 x 1536 on a plain background) and writes into <dir>/out (or --to):
#   <id>.webp         the painting, 768 x 1152 (the size of every Glimmer painting)
#   face/<id>.webp    its face, 192 x 192 (team rows, menus); faces.json beside this script sets a face box by
#                     hand where the guess (the top of the creature) misses: { "<id>": [centre x, centre y,
#                     side] } in the 768 x 1152 painting
#   shape/<id>.webp   its outline as a dark see-through silhouette, 384 x 576 (the Glimmer Book's unmet ones)
# The outline comes from the plain background (anything far enough from the edge colour is the creature).
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

args = sys.argv[1:]
src = os.path.abspath(args.pop(0))
dst = f'{src}/out'
if '--to' in args:
    i = args.index('--to'); dst = os.path.abspath(args[i + 1]); del args[i:i + 2]
os.makedirs(f'{dst}/face', exist_ok=True); os.makedirs(f'{dst}/shape', exist_ok=True)
FJ = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'faces.json')
OV = json.load(open(FJ)) if os.path.exists(FJ) else {}
ids = args or sorted(f[:-4] for f in os.listdir(f'{src}/raw') if f.endswith('.png'))


def outline(im):
    a = np.asarray(im).astype(np.float32)
    # the background is the plain colour round the edges (it fades a little top to bottom)
    top, bot = a[:8].reshape(-1, 3).mean(0), a[-8:].reshape(-1, 3).mean(0)
    ys = np.linspace(0, 1, a.shape[0])[:, None, None]
    bg = top * (1 - ys) + bot * ys
    d = np.sqrt(((a - bg) ** 2).sum(2))
    # close the gaps first (grow then shrink 9 px), before the speck filter: a pale part close to the background
    # (cream fur on a cream background, a sunlit face the colour of the sand) only shows as broken strokes, and
    # without this the speck filter wipes them and the outside leaks in through the gap, leaving a hole
    m = Image.fromarray(((d > 34) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    m = m.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    # solid: anything the outside can't reach (white fur, eyes, pale bellies) is the creature too
    m = m.copy(); W, H = m.size
    pad = Image.new('L', (W + 2, H + 2), 0); pad.paste(m, (1, 1))
    ImageDraw.floodfill(pad, (0, 0), 128)
    return np.asarray(pad.crop((1, 1, W + 1, H + 1))) != 128


for gid in ids:
    im = Image.open(f'{src}/raw/{gid}.png').convert('RGB').resize((768, 1152), Image.LANCZOS)
    im.save(f'{dst}/{gid}.webp', 'WEBP', quality=82, method=6)
    mk = outline(im)
    rows, cols = np.where(mk)
    y0, y1, x0, x1 = rows.min(), rows.max(), cols.min(), cols.max()
    bw, bh = x1 - x0, y1 - y0
    if gid in OV:
        cx, cy, s = OV[gid]
    else:
        # the head: the top part of the creature, a square about 0.6 of its size
        band = mk[y0:y0 + int(bh * 0.45)]
        bx = np.where(band)[1]
        cx = int(bx.mean()) if len(bx) else (x0 + x1) // 2
        s = int(min(bw, bh) * 0.62)
        cy = y0 + int(s * 0.5)
    s = int(s); half = s // 2
    cx = min(max(int(cx), half), 768 - half); cy = min(max(int(cy), half), 1152 - half)
    im.crop((cx - half, cy - half, cx - half + s, cy - half + s)).resize((192, 192), Image.LANCZOS).save(f'{dst}/face/{gid}.webp', 'WEBP', quality=84, method=6)
    sil = Image.fromarray((mk * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)).resize((384, 576), Image.LANCZOS)
    rgba = Image.new('RGBA', (384, 576), (46, 34, 84, 0)); rgba.putalpha(sil)
    rgba.save(f'{dst}/shape/{gid}.webp', 'WEBP', quality=80, method=6)
    print(gid, 'face', cx, cy, s)
