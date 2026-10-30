// Pictures of My Sky Island's things for the catalogue's cards (the island's build tray and the Shop's
// Island section): each thing drawn on its own, lit like the island on clear ground, kept for the session
// so the island and the Shop share them.
import * as THREE from 'three';
import { stage } from './stage';
import { PropKit } from '../island/props3d';
import { BlockKit } from './islandBlocks';
import type { ShapeId } from '../island/blocks';

/** the catalogue's pictures, drawn once a session */
const THUMBS = new Map<string, string>();
/** a picture already drawn (or undefined) */
export const thumbOf = (id: string) => THUMBS.get(id);

/** Draw things one by one with these kits ('block:<shape>:<paint>' is a block, anything else an island
 *  thing). `onOne` gets each picture as it's ready. */
export async function drawThumbs(kit: PropKit, blk: BlockKit, ids: string[], onOne: (id: string, url: string) => void, size = 168) {
  const r = stage.renderer; if (!r) return;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x9ab06a, 1.6));
  const d = new THREE.DirectionalLight(0xffe8cc, 2.6); d.position.set(-3, 5, 4); scene.add(d);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 200);
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
  const buf = new Uint8Array(size * size * 4), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d')!, clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
  try {
    for (const id of ids) {
      const had = THUMBS.get(id);
      if (had) { onOne(id, had); continue; }
      const bp = id.startsWith('block:') ? id.split(':') : null;
      const o = bp ? blk.sample(bp[1] as ShapeId, Number(bp[2] ?? 14)) : kit.make(id); if (!o) continue;
      scene.add(o); o.updateMatrixWorld(true);
      const box = new THREE.Box3(); o.traverse(m => { if ((m as THREE.Mesh).isMesh) box.expandByObject(m); });
      const sph = box.getBoundingSphere(new THREE.Sphere());
      const dir = new THREE.Vector3(0.45, 0.5, 1).normalize();
      cam.position.copy(sph.center).addScaledVector(dir, (sph.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.94); cam.lookAt(sph.center);
      r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
      r.readRenderTargetPixels(rt, 0, 0, size, size, buf);
      r.setRenderTarget(null);
      const img = g.createImageData(size, size);
      for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
      g.clearRect(0, 0, size, size); g.putImageData(img, 0, 0);
      const url = cv.toDataURL('image/webp', 0.9);
      THUMBS.set(id, url); onOne(id, url);
      scene.remove(o);
      await new Promise(res => setTimeout(res, 0));
    }
  } finally { r.setRenderTarget(null); r.setClearColor(clear, alpha); rt.dispose(); }
}

/** The same pictures away from the island (the Shop): the kits are loaded for the drawing and let go after. */
export async function shopThumbs(ids: string[], onOne: (id: string, url: string) => void, alive: () => boolean = () => true) {
  const todo = ids.filter(id => { const had = THUMBS.get(id); if (had) onOne(id, had); return !had; });
  if (!todo.length) return;
  // (the stage's renderer comes with the app's first screen)
  for (let i = 0; i < 40 && !stage.renderer; i++) await new Promise(res => setTimeout(res, 100));
  if (!stage.renderer || !alive()) return;
  const [kit, blk] = await Promise.all([PropKit.load(), BlockKit.load()]);
  try { if (alive()) await drawThumbs(kit, blk, todo, (id, url) => { if (alive()) onOne(id, url); }); }
  finally { kit.dispose(); blk.dispose(); }
}
