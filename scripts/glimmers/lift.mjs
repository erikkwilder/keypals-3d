// Brighten Glimmers whose models came out dim: lift each listed model's base-colour texture (colour.mjs)
// and write it back in the same format (JPEG or WebP) at about the same file size. Nothing else in the
// file changes. Run it on the ORIGINAL models (it is not meant to be applied twice).
//   cd <folder with the deps (deps.mjs)> && node <repo>/scripts/glimmers/lift.mjs <in-dir> <out-dir> [params.json]
// params.json defaults to lift-params.json next to this script: { id: { gamma, vib, hue? } }.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { core, ext, sharp } from './deps.mjs';
import { liftPixels } from './colour.mjs';

const [inDir, outDir, pfile] = process.argv.slice(2);
const params = JSON.parse(readFileSync(pfile ?? join(dirname(fileURLToPath(import.meta.url)), 'lift-params.json'), 'utf8'));
const io = new core.NodeIO().registerExtensions(ext.ALL_EXTENSIONS);
for (const [id, p] of Object.entries(params)) {
  if (id.startsWith('_')) continue;
  const doc = await io.read(join(inDir, `${id}.glb`));
  const tex = doc.getRoot().listMaterials()[0].getBaseColorTexture();
  const was = tex.getImage(), mime = tex.getMimeType();
  const { data, info } = await sharp(Buffer.from(was)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  liftPixels(data, info.channels, p);
  const img = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  let best;
  for (const q of [92, 90, 88, 86, 84, 82, 80, 78, 75, 72]) {
    const b = await (mime === 'image/webp' ? img.clone().webp({ quality: q, effort: 5 }) : img.clone().jpeg({ quality: q, mozjpeg: true })).toBuffer();
    best = { q, b };
    if (b.length <= was.byteLength * 1.08) break;
  }
  tex.setImage(new Uint8Array(best.b));
  await io.write(join(outDir, `${id}.glb`), doc);
  console.log(id, mime, `${was.byteLength} -> ${best.b.length} bytes (q${best.q})`);
}
