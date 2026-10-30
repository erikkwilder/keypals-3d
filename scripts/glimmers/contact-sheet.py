# A contact sheet of Glimmer pictures, named, for looking at many at once:
#   python3 scripts/glimmers/contact-sheet.py <out.jpg> <kind: painting|face|shape> <dir> [id ...]
# <dir> holds <id>.webp (and face/, shape/). Ids default to every painting in <dir>.
import os, sys
from PIL import Image, ImageDraw, ImageFont

out, kind, d = sys.argv[1], sys.argv[2], sys.argv[3]
ids = sys.argv[4:] or sorted(f[:-5] for f in os.listdir(d) if f.endswith('.webp') and not f.endswith('-evo.webp'))
W, H = {'painting': (192, 288), 'face': (128, 128), 'shape': (96, 144)}[kind]
cols = 8 if kind == 'painting' else 12
LAB = 18
try:
    font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
except Exception:
    font = ImageFont.load_default()
rows = (len(ids) + cols - 1) // cols
sheet = Image.new('RGB', (cols * W, rows * (H + LAB)), (255, 250, 240))
dr = ImageDraw.Draw(sheet)
for i, g in enumerate(ids):
    x, y = (i % cols) * W, (i // cols) * (H + LAB)
    p = f'{d}/{g}.webp' if kind == 'painting' else f'{d}/{kind}/{g}.webp'
    im = Image.open(p).convert('RGBA').resize((W, H), Image.LANCZOS)
    sheet.paste(im, (x, y), im)
    dr.text((x + 4, y + H + 2), g, fill=(60, 40, 90), font=font)
sheet.save(out, quality=84)
print(out, len(ids))
