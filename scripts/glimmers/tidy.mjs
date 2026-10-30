// A raw image-to-3D model (Hunyuan3D, TRELLIS, Meshy...) into a game-ready Glimmer, the way the 16
// Hunyuan3D Glimmers of 2026-10-29 were made: one mesh, 16k triangles, 1 m tall, standing on y = 0,
// centred, facing +z, textures 1024 px JPEG (base colour, plus metal/roughness if the model has one).
//   cd <folder with the deps (deps.mjs)> && node <repo>/scripts/glimmers/tidy.mjs <raw.glb> <out.glb> [--turn 90] [--tris 16000] [--tex 1024] [--lift gamma,vib]
// --turn: degrees about the vertical, if the model doesn't face +z (generators differ); --lift: the
// colour lift from colour.mjs, for models that come out dim (compare with the painting first).
// Afterwards: add its wiggle points (head, tail, wings, ears) to public/models/glimmers/meta.json.
import { core, ext, fns, meshopt, sharp } from './deps.mjs';
import { liftPixels } from './colour.mjs';

const args = process.argv.slice(2);
const [src, dst] = args;
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const turn = +opt('turn', 0), tris = +opt('tris', 16000), texSize = +opt('tex', 1024);
const lift = opt('lift', null)?.split(',').map(Number);

await meshopt.MeshoptSimplifier.ready;
const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS);
const doc = await io.read(src);
const root = doc.getRoot();
// one mesh in world space, no node transforms
await doc.transform(fns.flatten(), fns.join(), fns.weld(), fns.dedup(), fns.prune());
for (const node of root.listNodes()) if (node.getMesh()) {
  const m = node.getWorldMatrix();
  for (const prim of node.getMesh().listPrimitives()) fns.transformPrimitive(prim, m);
  node.setMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
for (const n of root.listNodes()) if (n.getMesh()) for (const p of n.getMesh().listPrimitives()) {
  const count = (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3;
  if (count > tris) await doc.transform(fns.simplify({ simplifier: meshopt.MeshoptSimplifier, ratio: tris / count, error: 0.01, lockBorder: false }));
}
// turn to face +z, then 1 m tall, centred, feet on the ground
const pos = root.listMeshes().flatMap(m => m.listPrimitives()).map(p => p.getAttribute('POSITION'));
const rad = (turn * Math.PI) / 180, c = Math.cos(rad), s = Math.sin(rad);
const rot = [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
for (const p of root.listMeshes().flatMap(m => m.listPrimitives())) fns.transformPrimitive(p, rot);
let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const a of pos) { const lo = a.getMin([]), hi = a.getMax([]); mn = mn.map((v, i) => Math.min(v, lo[i])); mx = mx.map((v, i) => Math.max(v, hi[i])); }
const k = 1 / (mx[1] - mn[1]);
const fit = [k, 0, 0, 0, 0, k, 0, 0, 0, 0, k, 0, -k * (mn[0] + mx[0]) / 2, -k * mn[1], -k * (mn[2] + mx[2]) / 2, 1];
for (const p of root.listMeshes().flatMap(m => m.listPrimitives())) fns.transformPrimitive(p, fit);
// textures: 1024 JPEG; the colour lift on the base colour if asked
for (const mat of root.listMaterials()) {
  const base = mat.getBaseColorTexture();
  for (const tex of root.listTextures()) {
    let img = sharp(Buffer.from(tex.getImage())).removeAlpha().resize(texSize, texSize, { fit: 'fill' });
    if (lift && tex === base) {
      const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
      liftPixels(data, info.channels, { gamma: lift[0], vib: lift[1] ?? 0 });
      img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
    }
    tex.setImage(new Uint8Array(await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer())).setMimeType('image/jpeg');
  }
}
root.listExtensionsUsed().filter(e => e.extensionName === 'EXT_texture_webp').forEach(e => e.dispose());
await doc.transform(fns.prune());
await io.write(dst, doc);
const nt = root.listMeshes().flatMap(m => m.listPrimitives()).reduce((n, p) => n + (p.getIndices()?.getCount() ?? 0) / 3, 0);
console.log(JSON.stringify({ out: dst, triangles: nt, height: 1, textures: root.listTextures().length }));
