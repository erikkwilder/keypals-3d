# Make a Glimmer model from its painting on Tencent's free Hunyuan3D 2.1 Space (Hugging Face), the
# model the 16 Glimmers of 2026-10-29 came from. Free accounts get 5 GPU minutes a day and one run asks
# for 270 s, so this is about one model a day (Hugging Face PRO: 40 minutes, about eight).
#   uv run --with gradio_client python scripts/glimmers/hf-hunyuan.py <painting.png> <out-raw.glb> [seed]
# The painting: the creature cut out on a transparent background works best. Then tidy.mjs.
# The token is read from ~/.keys/hf.token (never printed).
import os, shutil, sys, time
from gradio_client import Client, handle_file

img, out = sys.argv[1], sys.argv[2]
seed = int(sys.argv[3]) if len(sys.argv) > 3 else 1234
tok = open(os.path.expanduser('~/.keys/hf.token')).read().strip()
c = Client('tencent/Hunyuan3D-2.1', token=tok, verbose=False)
t = time.time()
# image, four optional multi-view images, steps, guidance, seed, octree resolution, remove background,
# chunks, random seed
r = c.predict(handle_file(img), None, None, None, None, 30, 5.0, seed, 256, True, 8000, False, api_name='/generation_all')
# r[0]: the white model, r[1]: the textured one
shutil.copy(r[1], out)
print(f'{out}: {os.path.getsize(out)} bytes in {time.time() - t:.0f} s')
