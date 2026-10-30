# Paint the special eggs of the 100-Glimmer ladder (one per kind of goal) with gpt-image-2, in the style of
# the rarity eggs (public/game/egg-*.webp), then cut each out of its plain background:
#   python3 scripts/glimmers/special-eggs.py <work-dir> [kind ...]      (paints what's missing, then cuts all)
# Writes public/game/egg-<kind>.webp (see-through, 420 tall like the others).
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PY = os.path.expanduser('~/.hermes/hermes-agent/venv/bin/python')
GEN = os.path.expanduser('~/.claude/skills/gpt-image-gen/scripts/gen.py')
EGGS = {
    'native': 'a pearly cream egg painted with a little round world: tiny floating islands, a waterfall, glowing crystal caves and striped market awnings in soft colours, a gold compass-rose clasp on the front',
    'milestone': 'a glossy deep-blue egg wrapped in a golden ribbon tied in a big bow, covered in tiny gold stars, a shining gold medal on the front',
    'collection': 'a soft pastel rainbow egg patterned with little glowing paw prints and tiny hearts, a silver filigree band round the middle',
    'season': 'an egg in four soft quarters: pink spring blossoms, green summer leaves, red autumn maple leaves and white winter snowflakes, a gold leafy band round it',
    'secret': 'a dark purple velvet egg with a glowing silver keyhole on the front and faint glowing silver swirls, a little mysterious',
    'apex': 'a radiant opal egg with a small golden crown on top, rainbow fire glowing inside the shell, thin cracks of light and floating sparkles',
}


def paint(work, kind):
    out = f'{work}/eggs/{kind}.png'
    if os.path.exists(out):
        return f'{kind}: have it'
    prompt = ('In the exact painted style of the reference images: one ornate glossy fantasy egg, standing upright, front view, '
              'filling most of the picture, on a plain flat pure white background, no text, no shadow, nothing else. '
              f'The egg: {EGGS[kind]}.')
    r = subprocess.run([PY, GEN, prompt, 'portrait', out, 'medium', f'{REPO}/public/game/egg-legendary.webp', f'{REPO}/public/game/egg-mythic.webp'], capture_output=True, text=True)
    return f'{kind}: {(r.stdout.strip().splitlines() or [""])[-1]} {r.stderr[-200:] if r.returncode else ""}'


def cut(work, kind):
    im = Image.open(f'{work}/eggs/{kind}.png').convert('RGB')
    a = np.asarray(im).astype(np.float32)
    d = np.sqrt(((a - 255) ** 2).sum(2))
    m = Image.fromarray(((d > 22) * 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(5))
    W, H = m.size
    pad = Image.new('L', (W + 2, H + 2), 0); pad.paste(m, (1, 1)); ImageDraw.floodfill(pad, (0, 0), 128)
    solid = (np.asarray(pad.crop((1, 1, W + 1, H + 1))) != 128)
    alpha = Image.fromarray((solid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0))
    rgba = im.convert('RGBA'); rgba.putalpha(alpha)
    rgba = rgba.crop(rgba.getbbox())
    w = round(rgba.width * 420 / rgba.height)
    rgba.resize((w, 420), Image.LANCZOS).save(f'{REPO}/public/game/egg-{kind}.webp', 'WEBP', quality=84, method=6)
    return f'{kind}: {w}x420'


if __name__ == '__main__':
    work = os.path.abspath(sys.argv[1]); kinds = sys.argv[2:] or list(EGGS)
    os.makedirs(f'{work}/eggs', exist_ok=True)
    with ThreadPoolExecutor(3) as ex:
        for line in ex.map(lambda k: paint(work, k), kinds):
            print(line, flush=True)
    for k in kinds:
        print(cut(work, k))
