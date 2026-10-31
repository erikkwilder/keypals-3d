// What stands on the Shop's stage when it isn't your buddy (showScene.ts `put`): a thing for My Sky Island on
// a small patch of ground, an egg in a nest, or one of your Glimmers enjoying a treat. All made from the
// game's own models and paintings, each sized to fill the same space on the stage as a buddy does.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { stage } from './stage';
import type { OnShow } from './showScene';
import type { GlimmerId } from '../adventure/glimmers';
import type { ShopEntry } from '../shop/shop';
import type { PropKit } from '../island/props3d';
import type { BlockKit } from './islandBlocks';

const R = 0.92;
/** a seedable little random, so the patch and the nest look the same every time */
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** A small round patch of ground: grass on top, earth at its edge, standing a little proud of the trail. */
export async function groundPatch(): Promise<{ root: THREE.Group; dispose(): void }> {
  const [grass, dirt] = await Promise.all([loadTexture('world/grass.webp', { repeat: true, color: true }), loadTexture('world/dirt.webp', { repeat: true, color: true })]);
  const root = new THREE.Group(), rnd = rng(7), own: { dispose(): void }[] = [];
  const top = new THREE.CircleGeometry(R, 48, 0, Math.PI * 2); top.rotateX(-Math.PI / 2);
  { // a gentle dome with a wobbly edge
    const p = top.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) / R, a = Math.atan2(z, x), w = 1 + Math.sin(a * 5) * 0.025 + Math.sin(a * 11 + 1) * 0.015; p.setXYZ(i, x * w, 0.09 + (1 - r * r) * 0.04, z * w); }
    top.computeVertexNormals();
    const uv = top.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.9, p.getZ(i) * 0.9);
  }
  const edge = new THREE.CylinderGeometry(R * 1.015, R * 1.06, 0.13, 48, 1, true); edge.translate(0, 0.03, 0);
  { const uv = edge.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 7, uv.getY(i) * 0.5); }
  const gm = new THREE.MeshStandardMaterial({ map: grass, color: 0xdcf2a8, roughness: 1 }), dm = new THREE.MeshStandardMaterial({ map: dirt, color: 0xd8bea0, roughness: 1 });
  const a = new THREE.Mesh(top, gm), b = new THREE.Mesh(edge, dm);
  a.receiveShadow = true; b.receiveShadow = true; b.castShadow = true;
  root.add(a, b); own.push(top, edge, gm, dm);
  // tufts of grass and a few stones round the rim (one draw each)
  const tuft: THREE.BufferGeometry[] = [], stones: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 90; i++) {
    const th = rnd() * Math.PI * 2, r = R * (0.72 + rnd() * 0.27), h = 0.08 + rnd() * 0.1;
    const c = new THREE.ConeGeometry(0.014 + rnd() * 0.012, h, 3); c.translate(0, h / 2, 0); c.rotateZ((rnd() - 0.5) * 0.7); c.rotateX((rnd() - 0.5) * 0.7);
    c.translate(Math.cos(th) * r, 0.1, Math.sin(th) * r); tuft.push(c.toNonIndexed());
  }
  for (let i = 0; i < 9; i++) {
    const th = rnd() * Math.PI * 2, r = R * (0.92 + rnd() * 0.07), s = 0.035 + rnd() * 0.04;
    const c = new THREE.DodecahedronGeometry(s, 0); c.scale(1.2, 0.7, 1); c.rotateY(rnd() * 3); c.translate(Math.cos(th) * r, 0.1, Math.sin(th) * r); stones.push(c.toNonIndexed());
  }
  const tg = mergeGeometries(tuft)!, sg = mergeGeometries(stones)!; [...tuft, ...stones].forEach(g => g.dispose());
  const tm = new THREE.MeshStandardMaterial({ color: 0x7fbf4a, roughness: 1 }), sm = new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 1 });
  const t = new THREE.Mesh(tg, tm), s = new THREE.Mesh(sg, sm); t.castShadow = true; s.castShadow = true;
  root.add(t, s); own.push(tg, sg, tm, sm);
  return { root, dispose() { for (const x of own) x.dispose(); } };
}

/** Size a thing to fill the stage like a buddy does, standing on the patch at its middle. */
function fit(o: THREE.Object3D, w = 1.5, h = 1.5, lift = 0.11): THREE.Group {
  const holder = new THREE.Group(); holder.add(o);
  o.updateMatrixWorld(true);
  const box = new THREE.Box3(); o.traverse(m => { if ((m as THREE.Mesh).isMesh) box.expandByObject(m); });
  const size = box.getSize(new THREE.Vector3()), k = Math.min(w / Math.max(0.01, Math.max(size.x, size.z)), h / Math.max(0.01, size.y));
  o.scale.multiplyScalar(k);
  o.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k + lift, -(box.min.z + box.max.z) / 2 * k);
  return holder;
}

/** A thing for My Sky Island, or a little pile of a special paint's blocks. */
export function islandThing(e: ShopEntry, kit: PropKit, blk: BlockKit): Pick<OnShow, 'root' | 'tick'> | null {
  if (e.group === 'paint') {
    const g = new THREE.Group(), n = Number(e.id);
    for (const [x, y, z] of [[-0.52, 0, 0], [0.52, 0, 0], [0, 1, 0]] as const) { const b = blk.sample('cube', n); b.position.set(x, y, z); g.add(b); }
    g.traverse(m => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
    return { root: fit(g, 1.3, 1.3) };
  }
  const o = kit.make(e.id);
  if (!o) return null;
  // (the things that move on the island move here too: a windmill, a fountain)
  const moves = kit.tickFor(o), root = fit(o);
  return { root, tick: moves ? (dt, t) => moves(t, dt) : undefined };
}

// ---------- an egg in a nest ----------
/** The egg's painting round a real egg shape: the picture laid over it from the front and from the back. */
async function eggMesh(pic: string, height: number): Promise<{ mesh: THREE.Mesh; dispose(): void }> {
  const map = await loadTexture(pic, { color: true });
  if (!map) throw new Error(`no picture: ${pic}`);
  const img = map.image as HTMLImageElement, W = img.naturalWidth || img.width || 321, H = img.naturalHeight || img.height || 420;
  // where the egg is in its picture (the paintings have a little air round them)
  const cv = document.createElement('canvas'), small = 64; cv.width = small; cv.height = small;
  const g2 = cv.getContext('2d', { willReadFrequently: true })!; g2.drawImage(img, 0, 0, small, small);
  const px = g2.getImageData(0, 0, small, small).data;
  let x0 = small, x1 = 0, y0 = small, y1 = 0;
  for (let y = 0; y < small; y++) for (let x = 0; x < small; x++) if (px[(y * small + x) * 4 + 3] > 60) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const u0 = x0 / small, u1 = (x1 + 1) / small, v0 = 1 - (y1 + 1) / small, v1 = 1 - y0 / small;
  const aspect = ((u1 - u0) * W) / ((v1 - v0) * H), rMax = (height * aspect) / 2;
  // a smooth egg: fuller below the middle
  const shape = (v: number) => { const s = 2 * v - 1; return Math.sqrt(Math.max(0, 1 - s * s)) * (1 - 0.14 * s); };
  let top = 0; for (let i = 0; i <= 100; i++) top = Math.max(top, shape(i / 100));
  const NS = 48, NT = 40, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let j = 0; j <= NT; j++) for (let i = 0; i <= NS; i++) {
    const v = j / NT, a = (i / NS) * Math.PI * 2, r = (shape(v) / top) * rMax, x = Math.sin(a) * r, z = Math.cos(a) * r;
    pos.push(x, v * height, z);
    uv.push(u0 + (u1 - u0) * (0.5 + x / (2 * rMax)), v0 + (v1 - v0) * v);
  }
  for (let j = 0; j < NT; j++) for (let i = 0; i < NS; i++) { const a = j * (NS + 1) + i, b = a + NS + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.02 });
  const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true;
  return { mesh, dispose() { geo.dispose(); mat.dispose(); } };
}

/** A round nest of woven twigs with a soft, straw-lined hollow in the middle. */
function nestMesh(rIn: number): { root: THREE.Group; dispose(): void } {
  const rnd = rng(31), root = new THREE.Group(), lists: THREE.BufferGeometry[][] = [[], [], []];
  const tube = 0.2, ringR = rIn + tube;
  for (let i = 0; i < 520; i++) {
    // on the rim's upper surface, laid round the ring, each a little askew
    const th = rnd() * Math.PI * 2, phi = rnd() * Math.PI, ring = ringR + Math.cos(phi) * tube, y = 0.1 + Math.sin(phi) * tube * 0.8;
    const len = 0.26 + rnd() * 0.32, c = new THREE.CylinderGeometry(0.008 + rnd() * 0.006, 0.011 + rnd() * 0.008, len, 5);
    c.rotateZ(Math.PI / 2 + (rnd() - 0.5) * 0.7); c.rotateY(-th + Math.PI / 2 + (rnd() - 0.5) * 1.1);
    c.translate(Math.cos(th) * ring, y, Math.sin(th) * ring);
    lists[Math.floor(rnd() * 3)].push(c.toNonIndexed());
  }
  const own: { dispose(): void }[] = [];
  [0x7a5430, 0xa97c4a, 0xdcbb7a].forEach((col, i) => {
    const g = mergeGeometries(lists[i])!; lists[i].forEach(x => x.dispose());
    const m = new THREE.MeshStandardMaterial({ color: col, roughness: 1 }), mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true; root.add(mesh); own.push(g, m);
  });
  // the nest's body under the twigs, and the straw lining it
  const bowl = new THREE.TorusGeometry(ringR, tube, 10, 32); bowl.rotateX(Math.PI / 2); bowl.scale(1, 0.72, 1); bowl.translate(0, 0.1, 0);
  const inner = new THREE.CircleGeometry(ringR, 32); inner.rotateX(-Math.PI / 2); inner.translate(0, 0.07, 0);
  const bm = new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 1 }), im = new THREE.MeshStandardMaterial({ color: 0xe9d8a6, roughness: 1 });
  root.add(new THREE.Mesh(bowl, bm), new THREE.Mesh(inner, im)); own.push(bowl, inner, bm, im);
  return { root, dispose() { for (const x of own) x.dispose(); } };
}

/** An egg in its nest, turning with the turntable, with a little rock now and then. */
export async function eggInNest(pic: string): Promise<Pick<OnShow, 'root' | 'tick' | 'dispose'>> {
  const root = new THREE.Group(), nest = nestMesh(0.4), egg = await eggMesh(pic, 1.02);
  nest.root.position.y = 0.11; egg.mesh.position.y = 0.17;
  root.add(nest.root, egg.mesh);
  return {
    root,
    tick(_dt, t) { const k = Math.sin(t * 0.9) > 0.86 ? Math.sin(t * 15) * 0.035 : 0; egg.mesh.rotation.z = k; egg.mesh.rotation.x = k * 0.5; },
    dispose() { nest.dispose(); egg.dispose(); },
  };
}

// ---------- a Glimmer enjoying a treat ----------
function starShape(R1: number, R2: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? R2 : R1; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) s.lineTo(x, y); else s.moveTo(x, y); }
  s.closePath();
  return s;
}
/** The Glimmer treat, a golden star; or an island treat, a little jam biscuit. */
function treatModel(kind: 'star' | 'biscuit'): { root: THREE.Group; dispose(): void } {
  const root = new THREE.Group(), own: { dispose(): void }[] = [];
  if (kind === 'star') {
    const g = new THREE.ExtrudeGeometry(starShape(0.21, 0.1), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }); g.translate(0, 0, -0.04);
    const m = new THREE.MeshStandardMaterial({ color: 0xffc62e, roughness: 0.3, metalness: 0.35, emissive: 0x7a4b00, emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(g, m); mesh.castShadow = true; root.add(mesh); own.push(g, m);
  } else {
    const b = new THREE.CylinderGeometry(0.2, 0.19, 0.075, 28), rim = new THREE.TorusGeometry(0.15, 0.04, 10, 28), jam = new THREE.SphereGeometry(0.09, 18, 12);
    rim.rotateX(Math.PI / 2); rim.translate(0, 0.045, 0); jam.scale(1, 0.62, 1); jam.translate(0, 0.075, 0);
    const bm = new THREE.MeshStandardMaterial({ color: 0xe0a34f, roughness: 0.85 }), rm = new THREE.MeshStandardMaterial({ color: 0xf3cb78, roughness: 0.7 }), jm = new THREE.MeshStandardMaterial({ color: 0xd8214f, roughness: 0.3 });
    const parts = [new THREE.Mesh(b, bm), new THREE.Mesh(rim, rm), new THREE.Mesh(jam, jm)]; parts.forEach(p => { p.castShadow = true; root.add(p); });
    // tipped towards you, so you see the jam
    root.rotation.x = 0.8;
    own.push(b, rim, jam, bm, rm, jm);
  }
  return { root, dispose() { for (const x of own) x.dispose(); } };
}

/** One of your Glimmers on the patch: a treat floats up, it eats it with hearts all round, is delighted, and
 *  another one comes. With no Glimmer yet, the treat turns on its own. */
export async function treatTime(kind: 'star' | 'biscuit', who: GlimmerId | null): Promise<Pick<OnShow, 'root' | 'tick' | 'dispose'>> {
  const root = new THREE.Group(), treat = treatModel(kind), fx = new Fx();
  const g = who ? await GlimmerModel.create(who, 1.05).catch(() => null) : null;
  stage.scene.add(fx.root);
  fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
  root.add(treat.root);
  if (g) { g.root.position.y = 0.11; g.fx = fx; root.add(g.root); } else treat.root.scale.setScalar(2.2);
  const here = new THREE.Vector3(), LOOP = 3.6;
  let last = -1;
  return {
    root,
    tick(dt, t) {
      fx.update(dt, t);
      if (g) { g.lookAt = stage.camera.position; g.update(dt, t); }
      // in front of the Glimmer, at about its chin; a whole one, then gone at the bite
      const u = t % LOOP, n = Math.floor(t / LOOP), near = g ? Math.min(1, u / 1.1) : 0, bob = Math.sin(t * 2.4) * 0.03;
      if (g) {
        treat.root.position.set(0.5 - near * 0.24, 0.72 + bob, 0.56 + near * 0.04);
        const size = u < 1.4 ? Math.min(1, u * 3) : Math.max(0, 1 - (u - 1.4) * 8);
        treat.root.scale.setScalar(Math.max(0.001, size));
        if (u > 1.1 && last !== n) {
          last = n; g.play('eat');
          treat.root.getWorldPosition(here);
          fx.emit({ at: here, count: 16, shape: ['heart', 'star'], color: [0xff6b9d, 0xffd34d, 0xffffff], speed: [0.5, 1.5], life: [0.7, 1.3], size: [0.07, 0.15], gravity: -0.5, drag: 1.2 });
          setTimeout(() => g.play('happy'), 800);
        }
      } else { treat.root.position.set(0, 0.8 + bob, 0); treat.root.rotation.y = t * 0.8; }
    },
    dispose() { treat.dispose(); g?.dispose(); fx.root.removeFromParent(); fx.dispose(); },
  };
}
