// Gear in 3D: what a buddy holds, wears on its face, neck, back and feet (hats are character.ts).
// Everything is painted: the cape, wings, kite, wand and the rocket pack use the item pictures
// themselves (so the 3D piece looks like its card), the shoes and springs use painted tiles, and the
// library's things are painted models (public/wear). Pieces are fitted to each buddy from its own
// body: the back from the vertices the spine moves, shoe shells from the feet's own triangles, the
// hand from the vertices the right hand moves, the face and neck from the head's. Every piece sits in a
// group that takes the Wardrobe's "Move it" nudge (moved, turned and sized about its own attach point),
// so a nudge can change live without building the piece again. Things that move (the cape's sway,
// flapping wings, bubbles, music notes, flames) run from the buddy's own update.
import * as THREE from 'three';
import type { Character } from './character';
import { loadTexture } from './assets';
import { stage } from './stage';
import { FRIEND } from '../art/cast';
import { loadGltf } from './assets';
import { NO_NUDGE, nudgeNow, type Nudge, type WearSlot } from '../adventure/gear';
import { LIB } from '../adventure/wardrobe';
import { VIBE } from '../adventure/vibes';
import { COLOUR, colourSoon } from '../adventure/colours';
type Slot = WearSlot;

type Worn = { id: string; objs: THREE.Object3D[]; tick?: (dt: number, t: number) => void; nz: { v: Nudge }; onNudge: (() => void)[]; follow: (() => void)[]; conv?: number };
type Rig = { worn: Partial<Record<Slot, Worn>>; t: number; tick: (dt: number) => void; want: Partial<Record<Slot, string | null>> };
const rigs = new WeakMap<Character, Rig>();

// ---------- measuring the buddy (in the model's bind space: it faces +z, up is +y) ----------
type Pts = THREE.Vector3[];
type Fit = {
  /** bind units in a metre (the model is scaled down to its height) */
  unit: number; minY: number; H: number;
  back: { cx: number; top: number; z: number; w: number; shoulder: number; span: number; hips: number } | null;
  /** the back's outline seen from the side, from the shoulders down: the backmost point at each height
   *  (a backpack, a shell, a tail's root), so a cape can drape over it instead of hanging off it */
  backLine: { top: number; bottom: number; z: number[] } | null;
  /** the front's outline the same way (the most forward point at each height, near the middle), from the
   *  top of the head down: where a bow tie or a medal sits */
  frontLine: { top: number; bottom: number; z: number[] } | null;
  feet: { side: 'Left' | 'Right'; geo: THREE.BufferGeometry | null; cx: number; sole: number; heel: number; toe: number; w: number }[];
  hand: THREE.Vector3 | null;
  /** the head (bind space): its middle across, the eye line, the front of the face, the width */
  head: { cx: number; eyes: number; front: number; top: number; w: number; neck: number; zmid: number; face: number; fx: number } | null;
};
const fits = new WeakMap<Character, Fit>();

export function skinned(c: Character): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = [];
  c.model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) out.push(o as THREE.SkinnedMesh); });
  return out;
}
/** how much of a vertex the named bones move */
function weightOn(m: THREE.SkinnedMesh, i: number, idx: Set<number>) {
  const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
  let w = 0;
  for (let k = 0; k < 4; k++) if (idx.has(si.getComponent(i, k))) w += sw.getComponent(i, k);
  return w;
}
const boneIdx = (m: THREE.SkinnedMesh, names: string[]) => new Set(m.skeleton.bones.map((b, i) => (names.includes(b.name) ? i : -1)).filter(i => i >= 0));
export function points(c: Character, names: string[], min = 0.5): Pts {
  const out: Pts = [];
  for (const m of skinned(c)) {
    const idx = boneIdx(m, names), pos = m.geometry.attributes.position;
    if (!idx.size) continue;
    for (let i = 0; i < pos.count; i++) if (weightOn(m, i, idx) >= min) out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix));
  }
  return out;
}
const pct = (xs: number[], p: number) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))] ?? 0; };

/** A shell around a foot: the foot's own triangles, pushed out a little, with box-mapped UVs. */
function footShell(c: Character, side: 'Left' | 'Right', push: number, tile: number): THREE.BufferGeometry | null {
  const names = [`${side}Foot`, `${side}ToeBase`, `${side}Toe_End`];
  const pos: number[] = [];
  for (const m of skinned(c)) {
    const idx = boneIdx(m, names), p = m.geometry.attributes.position, ix = m.geometry.index;
    if (!idx.size) continue;
    const ok = new Uint8Array(p.count);
    for (let i = 0; i < p.count; i++) ok[i] = weightOn(m, i, idx) >= 0.5 ? 1 : 0;
    const n = ix ? ix.count : p.count, v = new THREE.Vector3();
    for (let t = 0; t < n; t += 3) {
      const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, d = ix ? ix.getX(t + 2) : t + 2;
      if (!(ok[a] && ok[b] && ok[d])) continue;
      for (const q of [a, b, d]) { v.fromBufferAttribute(p, q).applyMatrix4(m.bindMatrix); pos.push(v.x, v.y, v.z); }
    }
  }
  if (pos.length < 9 * 24) return null;
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  // weld the corners so the shell is smooth, then push it out along its normals
  geo = mergeClose(geo);
  geo.computeVertexNormals();
  const P = geo.attributes.position as THREE.BufferAttribute, N = geo.attributes.normal as THREE.BufferAttribute;
  const uv = new Float32Array(P.count * 2);
  for (let i = 0; i < P.count; i++) {
    const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    P.setXYZ(i, P.getX(i) + nx * push, P.getY(i) + ny * push, P.getZ(i) + nz * push);
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
    const [u, w] = ax >= ay && ax >= az ? [P.getZ(i), P.getY(i)] : ay >= az ? [P.getX(i), P.getZ(i)] : [P.getX(i), P.getY(i)];
    uv[i * 2] = u / tile; uv[i * 2 + 1] = w / tile;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}
/** Share vertices that sit in the same place (the skinned meshes keep seams split). */
function mergeClose(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const p = g.attributes.position as THREE.BufferAttribute, key = new Map<string, number>(), out: number[] = [], index: number[] = [];
  const q = 1e4;
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * q)},${Math.round(p.getY(i) * q)},${Math.round(p.getZ(i) * q)}`;
    let j = key.get(k);
    if (j === undefined) { j = out.length / 3; key.set(k, j); out.push(p.getX(i), p.getY(i), p.getZ(i)); }
    index.push(j);
  }
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  r.setIndex(index);
  return r;
}

export function fitOf(c: Character): Fit {
  let f = fits.get(c);
  if (f) return f;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points(c, Object.keys(c.bones), 0)) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const H = maxY - minY;
  const unit = 1 / c.scale;
  // the back: the upper spine's vertices
  // (a few buddies' upper spine moves too few vertices on its own: then the whole spine, more loosely)
  let torso = points(c, ['Spine01', 'Spine02']);
  if (torso.length <= 20) torso = points(c, ['Spine', 'Spine01', 'Spine02', 'neck'], 0.25);
  let back: Fit['back'] = null;
  if (torso.length > 20) {
    // the shoulder line: where the upper arms join (the spine's own vertices stop lower on some buddies)
    const arms = points(c, ['LeftArm', 'RightArm'], 0.6);
    const top = arms.length > 10 ? pct(arms.map(p => p.y), 0.5) : pct(torso.map(p => p.y), 0.96);
    const near = points(c, ['Spine01', 'Spine02', 'neck'], 0.3).filter(p => p.y > top - H * 0.22 && p.y < top + H * 0.04);
    // the middle of the back: halfway between the shoulders (a tail or a strap pulled the spine's own middle
    // to one side)
    const cx = arms.length > 10 ? (pct(arms.map(p => p.x), 0.03) + pct(arms.map(p => p.x), 0.97)) / 2 : pct(torso.map(p => p.x), 0.5);
    // the shoulder joints themselves (the arms' vertices hang lower when a buddy stands with its arms down)
    const joints = ['LeftArm', 'RightArm'].map(n => { const bn = c.bones[n], sk = bn && skinned(c).find(m => m.skeleton.bones.includes(bn)); return sk ? new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.skeleton.boneInverses[sk.skeleton.bones.indexOf(bn)]).invert()).y : null; }).filter((y): y is number => y !== null);
    const shoulder = joints.length ? joints.reduce((a, y) => a + y, 0) / joints.length : top;
    const w = pct(torso.map(p => p.x), 0.95) - pct(torso.map(p => p.x), 0.05);
    // from one shoulder joint to the other: what a necklace or a scarf has to go round (the spine's own
    // vertices are only the middle of the back, far too narrow on a buddy in a puffy coat)
    const jx = ['LeftArm', 'RightArm'].map(n => { const bn = c.bones[n], sk = bn && skinned(c).find(m => m.skeleton.bones.includes(bn)); return sk ? new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.skeleton.boneInverses[sk.skeleton.bones.indexOf(bn)]).invert()).x : null; }).filter((x): x is number => x !== null);
    const span = jx.length === 2 ? Math.max(w, Math.abs(jx[0] - jx[1])) : w * 1.6;
    // the hips joint: with the shoulders, how long the body is (what a backpack covers)
    const hb = c.bones.Hips, hsk = hb && skinned(c).find(m => m.skeleton.bones.includes(hb));
    const hipY = hsk ? new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(hsk.skeleton.boneInverses[hsk.skeleton.bones.indexOf(hb)]).invert()).y : shoulder - H * 0.17;
    back = { cx, top, shoulder, z: pct((near.length > 10 ? near : torso).map(p => p.z), 0.02), w, span, hips: Math.min(hipY, shoulder - H * 0.1) };
  }
  let backLine: Fit['backLine'] = null;
  if (back) {
    const all = points(c, Object.keys(c.bones), 0).filter(p => Math.abs(p.x - back!.cx) < back!.w * 0.55);
    const top = back.top + H * 0.02, bottom = minY + H * 0.12, N = 18, z: number[] = [];
    for (let i = 0; i < N; i++) {
      const y = top - (i / (N - 1)) * (top - bottom), band = all.filter(p => Math.abs(p.y - y) < (top - bottom) / N);
      z.push(band.length > 4 ? pct(band.map(p => p.z), 0.03) : (z[i - 1] ?? back.z));
    }
    backLine = { top, bottom, z };
  }
  let frontLine: Fit['frontLine'] = null;
  {
    const cx = back?.cx ?? 0, w = back?.w ?? H * 0.3;
    const all = points(c, Object.keys(c.bones), 0).filter(p => Math.abs(p.x - cx) < w * 0.35);
    const top = maxY, bottom = minY + H * 0.2, N = 24, z: number[] = [];
    for (let i = 0; i < N; i++) {
      const y = top - (i / (N - 1)) * (top - bottom), band = all.filter(p => Math.abs(p.y - y) < (top - bottom) / N);
      z.push(band.length > 4 ? pct(band.map(p => p.z), 0.97) : (z[i - 1] ?? 0));
    }
    frontLine = { top, bottom, z };
  }
  const feet: Fit['feet'] = [];
  for (const side of ['Left', 'Right'] as const) {
    const fp = points(c, [`${side}Foot`, `${side}ToeBase`]);
    if (fp.length < 10) continue;
    feet.push({
      side, geo: footShell(c, side, 0.014 * unit, 0.13 * unit),
      cx: pct(fp.map(p => p.x), 0.5), sole: pct(fp.map(p => p.y), 0.02), heel: pct(fp.map(p => p.z), 0.03), toe: pct(fp.map(p => p.z), 0.97),
      w: pct(fp.map(p => p.x), 0.95) - pct(fp.map(p => p.x), 0.05),
    });
  }
  const hp = points(c, ['RightHand']);
  const hand = hp.length > 6 ? hp.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(hp.length) : null;
  const hd = points(c, ['Head'], 0.7);
  let head: Fit['head'] = null;
  if (hd.length > 20) {
    const ys = hd.map(p => p.y), lo = pct(ys, 0.02), hi = pct(ys, 0.98);
    const zs = hd.map(p => p.z), zmid = pct(zs, 0.5), zfront = pct(zs, 0.97), depth = zfront - pct(zs, 0.03);
    // the face is the front of the head: the frontmost third of its depth (big ears, hair, antennas and
    // fluff stick out at the sides and the top further back)
    const face = hd.filter(p => p.z > zfront - depth * 0.33);
    // the eye line: a little over halfway up the part of the face that's nearly full width (not ear tips
    // or leaves; snouts sit low, so not right in the middle)
    const N = 24, bandW: number[] = [];
    for (let k = 0; k < N; k++) {
      const y0 = lo + (k / N) * (hi - lo), y1 = lo + ((k + 1) / N) * (hi - lo), xs = face.filter(p => p.y >= y0 && p.y < y1).map(p => p.x);
      bandW.push(xs.length > 3 ? Math.max(...xs) - Math.min(...xs) : 0);
    }
    const full = Math.max(...bandW), core = bandW.map((w, k) => (w >= full * 0.6 ? k : -1)).filter(k => k >= 0);
    let eyes = core.length ? lo + ((core[0] + (core[core.length - 1] + 1 - core[0]) * 0.55) / N) * (hi - lo) : lo + (hi - lo) * 0.55;
    const band = face.filter(p => Math.abs(p.y - eyes) < (hi - lo) * 0.1);
    let front = pct((band.length > 10 ? band : face).map(p => p.z), 0.9);
    const w = pct(hd.map(p => p.x), 0.97) - pct(hd.map(p => p.x), 0.03);
    let faceW = band.length > 10 ? Math.min(w, pct(band.map(p => p.x), 0.95) - pct(band.map(p => p.x), 0.05)) : w;
    // a buddy whose eyes are drawn on (Scruff, under all that straw): its own eye spot
    // centred on the face itself (a sprout or headphones on one side pull the whole head's middle over)
    let fx = band.length > 10 ? (pct(band.map(p => p.x), 0.05) + pct(band.map(p => p.x), 0.95)) / 2 : pct(hd.map(p => p.x), 0.5);
    const e = FRIEND[c.id].eyes, hb = c.bones.Head, sk = skinned(c).find(m => m.skeleton.bones.includes(hb));
    if (e && hb && sk) {
      const at = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.skeleton.boneInverses[sk.skeleton.bones.indexOf(hb)]).invert());
      // (the eye spot is in metres; bind units per metre from the buddy's own measured height)
      const upm = H / FRIEND[c.id].height;
      eyes = at.y + e.up * upm; front = at.z + (e.fwd + 0.02) * upm; fx = at.x + (e.x ?? 0) * upm;
      faceW = Math.min(faceW, (e.gap + e.size * 4) * upm * 2.2);
    }
    // never behind the front of the body at the eye line (a box head only partly moved by the Head bone)
    if (!e) front = Math.max(front, lineAt(frontLine, eyes, front));
    head = { cx: pct(hd.map(p => p.x), 0.5), eyes, front, top: hi, w, neck: lo, zmid, face: faceW, fx };
  }
  f = { unit, minY, H, back, backLine, frontLine, feet, hand, head };
  fits.set(c, f);
  return f;
}
if (import.meta.env.DEV) (window as unknown as { __fit: typeof fitOf }).__fit = (c: Character) => fitOf(c);
/** A group that rides on a bone but whose children are placed in bind space. */
export function onBone(c: Character, name: string): THREE.Group | null {
  const bone = c.bones[name];
  const m = skinned(c).find(s => s.skeleton.bones.includes(bone));
  if (!bone || !m) return null;
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  g.matrix.copy(m.skeleton.boneInverses[m.skeleton.bones.indexOf(bone)]);
  bone.add(g);
  return g;
}

// ---------- materials ----------
export async function painted(path: string, opts: { repeat?: boolean; cut?: boolean; side?: THREE.Side } = {}) {
  const map = await loadTexture(path, { repeat: opts.repeat });
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0, side: opts.side ?? THREE.FrontSide });
  if (opts.cut) { mat.alphaTest = 0.45; mat.side = THREE.DoubleSide; }
  return mat;
}
async function spriteOf(path: string, blend: THREE.Blending = THREE.NormalBlending) {
  const map = await loadTexture(path);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: blend }));
}
export function shadows(o: THREE.Object3D) { o.traverse(x => { if ((x as THREE.Mesh).isMesh) { x.castShadow = true; x.receiveShadow = false; x.frustumCulled = false; } }); }

/** The rocket picture's outline, top (0) to the nozzle's rim (1): radius as a share of the picture's width. */
export const ROCKET: [number, number][] = [[0, 0.0], [0.05, 0.1], [0.12, 0.25], [0.2, 0.36], [0.3, 0.43], [0.4, 0.45], [0.55, 0.44], [0.7, 0.4], [0.78, 0.37], [0.85, 0.3], [0.93, 0.33], [1, 0.36]];
export const ROCKET_ASPECT = 295 / 610;
/** A lathe body painted by projecting a front-on picture onto it (the picture's x across, y down). */
export function latheFromPicture(height: number, prof: [number, number][], aspect: number, segs = 20): THREE.BufferGeometry {
  const w = height * aspect;
  const pts = prof.slice().reverse().map(([t, r]) => new THREE.Vector2(Math.max(0.0005, r * w), (0.5 - t) * height));
  const g = new THREE.LatheGeometry(pts, segs);
  const P = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) uv.setXY(i, 0.5 + P.getX(i) / w, 0.5 + P.getY(i) / height);
  return g;
}

// ---------- moving a piece (the Wardrobe's Move it) ----------
/** Everything a builder needs: the buddy, its measurements, the piece, and its nudge (a box, so a new
 *  nudge reaches the piece without building it again; bone-held pieces register how to re-apply it). */
type Ctx = { c: Character; f: Fit; id: string; nz: { v: Nudge }; onNudge: (() => void)[]; /** groups that follow the skin, set each frame */ follow: (() => void)[];
  /** a size saved before back pieces were sized by the body (no `v`) times this is the same size now */
  conv?: number };

type Built = { objs: THREE.Object3D[]; tick?: (dt: number, t: number) => void };
const _a = new THREE.Matrix4(), _b = new THREE.Matrix4();
/** T(pivot + offset) · turn · tip · tilt · size · T(−pivot): moved, turned round (about up), tipped forward
 *  or back (about the buddy's side to side), tilted (about its front to back) and sized about its own
 *  attach point. `unit` turns the nudge's shares of the buddy's height into this space's units. */
const _e = new THREE.Euler();
function nudgeMatrix(m: THREE.Matrix4, pivot: THREE.Vector3, n: Nudge, unit: number) {
  m.makeTranslation(-pivot.x, -pivot.y, -pivot.z);
  m.premultiply(_a.makeScale(n.s, n.s, n.s));
  m.premultiply(_b.makeRotationFromEuler(_e.set(n.p ?? 0, n.r, n.t ?? 0, 'YXZ')));
  m.premultiply(_a.makeTranslation(pivot.x + n.x * unit, pivot.y + n.y * unit, pivot.z + n.z * unit));
}
/** A group riding a bone, its children placed in bind space, nudged about `pivot` (bind space). */
function boneHeld(x: Ctx, bone: string, pivot: THREE.Vector3): { g: THREE.Group; inner: THREE.Group } | null {
  const g = onBone(x.c, bone);
  if (!g) return null;
  return { g, inner: nudged(x, g, pivot) };
}
function nudged(x: Ctx, g: THREE.Group, pivot: THREE.Vector3) {
  const inner = new THREE.Group();
  inner.matrixAutoUpdate = false;
  g.add(inner);
  const apply = () => { nudgeMatrix(inner.matrix, pivot, nudgeNow(x.nz.v, x.conv), x.f.H); inner.matrixWorldNeedsUpdate = true; };
  apply(); x.onNudge.push(apply);
  return inner;
}
/** the bones a scarf or a necklace may follow (not the arms: a wave would swing it off the neck), and
 *  the ones a cape or a backpack may (just the back) */
const NECK_BONES = ['Spine01', 'Spine02', 'neck', 'Head'];
const BACK_BONES = ['Spine', 'Spine01', 'Spine02', 'neck'];
/** The bones that move the skin round a point (bind space), and how much each, from the buddy's own
 *  skin weights there: what a piece lying on that spot has to follow so it moves just like the body
 *  under it (a scarf with the neck as the head bobs, a cape with the back as it twists). */
function skinNear(c: Character, at: THREE.Vector3, H: number, allow: string[]): { bone: THREE.Bone; inv: THREE.Matrix4; w: number }[] {
  const acc = new Map<THREE.Bone, { inv: THREE.Matrix4; w: number }>(), v = new THREE.Vector3();
  // a wider look when the point is inside the body (a scarf's middle is in the neck)
  for (const r of [0.05, 0.08, 0.12, 0.18].map(k => k * H)) {
    let n = 0;
    acc.clear();
    for (const m of skinned(c)) {
      const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight, bones = m.skeleton.bones;
      for (let i = 0; i < pos.count; i++) {
        const d = v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix).distanceTo(at);
        if (d > r) continue;
        n++;
        const f = 1 - d / r;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k), b = bones[si.getComponent(i, k)];
          if (w <= 0 || !b || !allow.includes(b.name)) continue;
          const e = acc.get(b) ?? { inv: m.skeleton.boneInverses[si.getComponent(i, k)], w: 0 };
          e.w += w * f; acc.set(b, e);
        }
      }
    }
    if (n >= 24 && acc.size) break;
  }
  const out = [...acc.entries()].map(([bone, e]) => ({ bone, inv: e.inv, w: e.w })).sort((a, b) => b.w - a.w).slice(0, 3);
  const tot = out.reduce((a, b) => a + b.w, 0);
  return tot > 0 ? out.map(b => ({ ...b, w: b.w / tot })).filter(b => b.w > 0.04) : [];
}
/** A group that moves the way the skin at `at` moves (bind space): the bones there blended by their skin
 *  weights, the same sum the skinning itself does, worked out each frame before the piece's own moves.
 *  Its children are placed in bind space, nudged about `pivot`. Falls back to riding `fallback`. */
function skinHeld(x: Ctx, at: THREE.Vector3, pivot: THREE.Vector3, allow: string[], fallback: string): { g: THREE.Group; inner: THREE.Group } | null {
  const ws = skinNear(x.c, at, x.f.H, allow);
  if (ws.length < 2) return boneHeld(x, ws[0]?.bone.name ?? fallback, pivot);
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  x.c.root.add(g);
  const rootInv = new THREE.Matrix4(), sum = new THREE.Matrix4(), m = new THREE.Matrix4();
  const follow = () => {
    // (relative to the buddy's root: a scene moving the buddy after its update moves this with it)
    rootInv.copy(x.c.root.matrixWorld).invert();
    sum.elements.fill(0);
    for (const b of ws) { m.multiplyMatrices(b.bone.matrixWorld, b.inv); for (let i = 0; i < 16; i++) sum.elements[i] += m.elements[i] * b.w; }
    g.matrix.multiplyMatrices(rootInv, sum);
    g.matrixWorldNeedsUpdate = true;
  };
  x.c.root.updateMatrixWorld(true);
  follow();
  x.follow.push(follow);
  return { g, inner: nudged(x, g, pivot) };
}
/** A group in the buddy's own space for things that follow the hand each frame: call `at(p)` with the
 *  hand's place every frame and the nudge turns and sizes about it. */
function handHeld(x: Ctx): { g: THREE.Group; at: (p: THREE.Vector3) => void } {
  const g = new THREE.Group();
  g.matrixAutoUpdate = false;
  x.c.root.add(g);
  const h = hw(x.c);
  return { g, at: p => { nudgeMatrix(g.matrix, p, x.nz.v, h); g.matrixWorldNeedsUpdate = true; } };
}

// ---------- the pieces ----------
/** Where a cape, wings or a pack meet the back: just under the shoulders, at the back's surface. */
const backPivot = (f: Fit) => new THREE.Vector3(f.back!.cx, f.back!.top - f.H * 0.06, f.back!.z);
/** a piece on the back, moving with the back's own skin there */
const backHeld = (x: Ctx) => skinHeld(x, backPivot(x.f), backPivot(x.f), BACK_BONES, 'Spine02');

async function cape(x: Ctx): Promise<Built | null> {
  const { f } = x, b = f.back, h = b && backHeld(x);
  if (!b || !h) return null;
  const mat = await painted('gear/tex-cape.webp', { cut: true });
  const W = Math.max(b.w * 2.1, f.H * 0.42), L = Math.max(f.H * 0.4, b.top - (f.minY + f.H * 0.22)), y0 = b.top + f.H * 0.01;
  // the cape lies on the back from the shoulders down: at each height it's just behind the backmost point
  // above it (over a backpack or a shell, then straight down past it, never back in)
  const line = f.backLine, gapZ = f.H * 0.018;
  const rows = 14, laid: number[] = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 - (i / rows) * L;
    let z = b.z;
    if (line) { const k = Math.max(0, Math.min(line.z.length - 1, Math.round(((line.top - y) / (line.top - line.bottom)) * (line.z.length - 1)))); z = line.z[k]; }
    laid.push(Math.min(z - gapZ, i ? laid[i - 1] : Infinity));
  }
  const zAt = (v: number) => { const t = v * rows, i = Math.min(rows - 1, Math.floor(t)), k = t - i; return laid[i] * (1 - k) + laid[i + 1] * k; };
  const geo = new THREE.PlaneGeometry(1, 1, 10, rows);
  const P = geo.attributes.position as THREE.BufferAttribute, uvs = geo.attributes.uv as THREE.BufferAttribute;
  const shape = (u: number, v: number, sway: number, o: THREE.Vector3) => {
    // rounder across the back as it goes down, and swaying more at the hem
    const bulge = (1 - (2 * u - 1) ** 2) * f.H * 0.03 * (0.2 + v);
    // seen from behind, +x is on the left: the picture's left edge goes to +x so it reads the right way round
    o.set(b.cx - (u - 0.5) * W * (0.72 + 0.28 * v), y0 - v * L, zAt(v) - bulge - v * v * sway);
  };
  const tmp = new THREE.Vector3();
  const place = (t: number) => {
    for (let i = 0; i < P.count; i++) {
      const u = uvs.getX(i), v = 1 - uvs.getY(i);
      const sway = f.H * (0.025 + 0.02 * Math.sin(t * 2.2 + u * 3.2));
      shape(u, v, sway, tmp);
      P.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  };
  place(0);
  const mesh = new THREE.Mesh(geo, mat);
  h.inner.add(mesh); shadows(mesh);
  let acc = 0;
  return { objs: [h.g], tick: (dt, t) => { acc += dt; if (acc > 1 / 30) { acc = 0; place(t); } } };
}

async function wings(x: Ctx): Promise<Built | null> {
  const { f } = x, b = f.back, h = b && backHeld(x);
  if (!b || !h) return null;
  const map = await loadTexture('gear/tex-wing.webp');
  if (!map) return null;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const hh = f.H * 0.46, w = hh * (321 / 512);
  const hinge = new THREE.Vector3(b.cx, b.top - f.H * 0.05, b.z - f.H * 0.015);
  const make = (dir: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(w, hh);
    // the picture is the right wing seen from behind: it spreads away from the hinge
    geo.translate(w / 2, 0, 0);
    const piv = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    if (dir === -1) m.scale.x = -1; // the buddy's right side is -x
    m.rotation.y = Math.PI; // face backwards
    piv.add(m); piv.position.copy(hinge);
    h.inner.add(piv);
    return piv;
  };
  const right = make(-1), left = make(1);
  return {
    objs: [h.g],
    tick: (_dt, t) => {
      const flap = 0.5 + 0.32 * Math.sin(t * 6.5);
      left.rotation.y = -flap; right.rotation.y = flap;
      left.rotation.z = right.rotation.z = Math.sin(t * 6.5 + 1) * 0.04;
    },
  };
}

async function rocketPack(x: Ctx): Promise<Built | null> {
  const { f } = x, b = f.back, hb = b && backHeld(x);
  if (!b || !hb) return null;
  const g = hb.inner;
  const [body, fin, flameMap, pack] = await Promise.all([painted('gear/tex-rocket.webp'), painted('gear/tex-fin.webp', { cut: true }), loadTexture('gear/tex-flame.webp'), painted('gear/tex-pack.webp', { cut: true })]);
  // two rockets riding high on the back (they hung down by the knees when sized and placed lower)
  const h = f.H * 0.3, rw = h * ROCKET_ASPECT;
  const geo = latheFromPicture(h, ROCKET, ROCKET_ASPECT);
  const flames: THREE.Sprite[] = [];
  const cy = b.top - f.H * 0.09, gap = Math.max(b.w * 0.36, rw * 0.62);
  for (const sd of [-1, 1]) {
    const r = new THREE.Group();
    const m = new THREE.Mesh(geo, body); m.rotation.y = Math.PI; r.add(m);
    for (const fs of [-1, 1]) {
      const fg = new THREE.PlaneGeometry(rw * 0.42, rw * 0.7); fg.translate(rw * 0.21, 0, 0);
      const fm = new THREE.Mesh(fg, fin); fm.scale.x = fs; fm.position.set(fs * rw * 0.36, -h * 0.17, 0); fm.rotation.y = Math.PI;
      r.add(fm);
    }
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameMap, transparent: true, depthWrite: false }));
    fl.scale.set(rw * 0.6, rw * 0.62, 1); fl.position.set(0, -h * 0.5 - rw * 0.26, 0);
    r.add(fl); flames.push(fl);
    r.position.set(b.cx + sd * gap, cy, b.z - rw * 0.42);
    r.rotation.x = -0.08;
    g.add(r);
  }
  const pg = new THREE.PlaneGeometry(gap * 1.25, gap * 1.25 * (256 / 187));
  const pm = new THREE.Mesh(pg, pack); pm.position.set(b.cx, cy + h * 0.06, b.z - f.H * 0.012); pm.rotation.y = Math.PI;
  g.add(pm);
  shadows(g);
  return {
    objs: [hb.g],
    tick: (_dt, t) => flames.forEach((fl, i) => { const k = 0.85 + 0.25 * Math.abs(Math.sin(t * 23 + i * 2.1)); fl.scale.y = rw * 0.62 * k; fl.position.y = -h * 0.5 - rw * 0.26 * k; }),
  };
}

/** Where the right hand is, in the buddy's own frame (root), each frame. */
function handTracker(c: Character, f: Fit) {
  const g = f.hand && onBone(c, 'RightHand');
  if (!g || !f.hand) return null;
  const anchor = new THREE.Object3D(); anchor.position.copy(f.hand); g.add(anchor);
  const v = new THREE.Vector3();
  return { g, at: () => { c.root.updateMatrixWorld(true); return c.root.worldToLocal(anchor.getWorldPosition(v)).clone(); } };
}
export const hw = (c: Character) => FRIEND[c.id].height;

async function bubbleWand(x: Ctx): Promise<Built | null> {
  const { c, f } = x, hand = handTracker(c, f);
  if (!hand) return null;
  const hold = handHeld(x);
  const s = hw(c), wand = await spriteOf('gear/tex-wand.webp');
  const wh = s * 0.24;
  wand.scale.set(wh * (185 / 384), wh, 1);
  wand.center.set(0.5, 0.08);
  hold.g.add(wand);
  const bubbleMap = await loadTexture('math/bubble.webp');
  const bubbles: { s: THREE.Sprite; age: number; life: number; v: THREE.Vector3; size: number }[] = [];
  let next = 0.4;
  return {
    objs: [hand.g, hold.g],
    tick: (dt, t) => {
      const p = hand.at();
      hold.at(p);
      wand.position.copy(p).add(new THREE.Vector3(0, -s * 0.02, s * 0.03));
      (wand.material as THREE.SpriteMaterial).rotation = 0.18 + Math.sin(t * 1.7) * 0.08;
      next -= dt;
      if (next < 0 && bubbles.length < 7) {
        next = 0.7 + Math.random() * 0.6;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleMap, transparent: true, depthWrite: false }));
        const size = s * (0.05 + Math.random() * 0.05);
        sp.position.copy(p).add(new THREE.Vector3(-s * 0.03, wh * 0.85, s * 0.04));
        hold.g.add(sp);
        bubbles.push({ s: sp, age: 0, life: 2.4 + Math.random(), v: new THREE.Vector3((Math.random() - 0.7) * 0.18, 0.22 + Math.random() * 0.12, (Math.random() - 0.2) * 0.16).multiplyScalar(s), size });
      }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const q = bubbles[i]; q.age += dt;
        const k = q.age / q.life;
        q.s.position.addScaledVector(q.v, dt);
        q.s.position.x += Math.sin(t * 3 + i) * dt * 0.04 * s;
        const grow = Math.min(1, q.age * 4) * (1 + Math.sin(t * 7 + i) * 0.05);
        q.s.scale.setScalar(q.size * grow * (k > 0.92 ? 1 + (k - 0.92) * 4 : 1));
        (q.s.material as THREE.SpriteMaterial).opacity = k > 0.92 ? Math.max(0, 1 - (k - 0.92) / 0.08) : 0.9;
        if (k >= 1) { q.s.removeFromParent(); q.s.material.dispose(); bubbles.splice(i, 1); }
      }
    },
  };
}

async function kite(x: Ctx): Promise<Built | null> {
  const { c, f } = x, hand = handTracker(c, f);
  if (!hand) return null;
  const hold = handHeld(x);
  const s = hw(c), k = await spriteOf('gear/tex-kite.webp');
  const kh = s * 0.55;
  k.scale.set(kh * (335 / 512), kh, 1);
  hold.g.add(k);
  const N = 14, pts = new Float32Array(N * 3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.9 }));
  line.frustumCulled = false;
  hold.g.add(line);
  const a = new THREE.Vector3(), e = new THREE.Vector3(), m = new THREE.Vector3();
  return {
    objs: [hand.g, hold.g],
    tick: (_dt, t) => {
      a.copy(hand.at());
      hold.at(a);
      k.position.set(-s * 0.5 + Math.sin(t * 0.9) * s * 0.06, s * 1.22 + Math.sin(t * 1.3) * s * 0.05, -s * 0.35);
      (k.material as THREE.SpriteMaterial).rotation = Math.sin(t * 1.1) * 0.12;
      // the string runs from the hand up to the kite's cross, with a gentle sag
      e.copy(k.position).add(new THREE.Vector3(0, -kh * 0.02, 0));
      m.copy(a).lerp(e, 0.5).add(new THREE.Vector3(0, -s * 0.12, 0));
      for (let i = 0; i < N; i++) {
        const u = i / (N - 1), w0 = (1 - u) ** 2, w1 = 2 * u * (1 - u), w2 = u * u;
        pts[i * 3] = a.x * w0 + m.x * w1 + e.x * w2; pts[i * 3 + 1] = a.y * w0 + m.y * w1 + e.y * w2; pts[i * 3 + 2] = a.z * w0 + m.z * w1 + e.z * w2;
      }
      (lg.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    },
  };
}

async function boombox(x: Ctx): Promise<Built | null> {
  const { c, f } = x, hand = handTracker(c, f);
  if (!hand) return null;
  const hold = handHeld(x);
  const s = hw(c);
  const [front, teal] = await Promise.all([painted('gear/tex-boombox.webp'), painted('gear/tex-teal.webp')]);
  const bw = s * 0.32, bh = bw * (456 / 768), bd = s * 0.1;
  const box = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [teal, teal, teal, teal, front, front]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(bw * 0.3, s * 0.014, 8, 18, Math.PI), teal);
  handle.position.y = bh / 2;
  box.add(body, handle);
  shadows(box);
  hold.g.add(box);
  const notes = await Promise.all([0, 1, 2].map(i => loadTexture(`gear/tex-note${i}.webp`)));
  const flying: { s: THREE.Sprite; age: number; dx: number }[] = [];
  let next = 0.3, which = 0;
  const cam = new THREE.Vector3();
  return {
    objs: [hand.g, hold.g],
    tick: (dt, t) => {
      const p = hand.at();
      hold.at(p);
      box.position.set(p.x - s * 0.06, p.y - bh / 2 - bw * 0.3 + s * 0.01, p.z + s * 0.02);
      // turn the speakers toward whoever is looking
      c.root.worldToLocal(cam.copy(stage.camera.position));
      const want = Math.atan2(cam.x - box.position.x, cam.z - box.position.z);
      box.rotation.y += (Math.max(-1.2, Math.min(1.2, want)) - box.rotation.y) * Math.min(1, dt * 4);
      box.rotation.z = Math.sin(t * 6) * 0.03;
      next -= dt;
      if (next < 0) {
        next = 0.55 + Math.random() * 0.35;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: notes[which++ % 3], transparent: true, depthWrite: false }));
        sp.position.copy(box.position).add(new THREE.Vector3((Math.random() - 0.5) * bw * 0.6, bh * 0.6, 0));
        hold.g.add(sp);
        flying.push({ s: sp, age: 0, dx: (Math.random() - 0.5) * 0.3 });
      }
      for (let i = flying.length - 1; i >= 0; i--) {
        const q = flying[i]; q.age += dt;
        q.s.position.y += dt * s * 0.35; q.s.position.x += Math.sin(q.age * 5) * dt * s * 0.12 + q.dx * dt * s;
        const k = q.age / 1.6;
        q.s.scale.setScalar(s * 0.075 * Math.min(1, q.age * 5));
        (q.s.material as THREE.SpriteMaterial).opacity = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.3) : 1;
        if (k >= 1) { q.s.removeFromParent(); q.s.material.dispose(); flying.splice(i, 1); }
      }
    },
  };
}

/** Shoes: a painted shell around each foot (the foot's own triangles, pushed out a little), and for the
 *  battle shoes their extras: springs, boosters, cloud puffs. A library pair is just its painted tile. */
async function shoes(x: Ctx): Promise<Built | null> {
  const { c, f, id } = x;
  if (!f.feet.length) return null;
  const lib = LIB[id];
  const tile = lib?.shoeTile ?? `gear/${id === 'rocket_sneakers' ? 'tile-sneaker_rocket' : id === 'spring_shoes' ? 'tile-sneaker_spring' : 'tile-cloud'}.webp`;
  const [shell, chrome, rocket, flameMap, puffA, puffB] = await Promise.all([
    painted(tile, { repeat: true }), painted('gear/tile-chrome.webp', { repeat: true }), painted('gear/tex-rocket.webp'),
    loadTexture('gear/tex-flame.webp'), loadTexture('game/storm1.webp'), loadTexture('game/storm2.webp'),
  ]);
  if (id === 'cloud_slippers') { shell.roughness = 0.9; shell.emissive = new THREE.Color(0x2a3550); }
  const s = hw(c) * f.unit, objs: THREE.Object3D[] = [], ticks: ((dt: number, t: number) => void)[] = [];
  for (const ft of f.feet) {
    const hb = boneHeld(x, `${ft.side}Foot`, new THREE.Vector3(ft.cx, ft.sole, (ft.heel + ft.toe) / 2));
    if (!hb) continue;
    const g = hb.inner;
    objs.push(hb.g);
    if (ft.geo) { const m = new THREE.Mesh(ft.geo, shell); g.add(m); }
    const outer = ft.side === 'Left' ? 1 : -1;
    if (lib) continue;
    if (id === 'spring_shoes') {
      // a coil spring under the back of the heel: squashes and springs back
      const turns = 4.5, r = s * 0.032, hh = s * 0.075;
      const curve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => { const a = (i / 63) * turns * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * r, (i / 63) * hh, Math.sin(a) * r); }));
      const coil = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, s * 0.0065, 8, false), chrome);
      const holder = new THREE.Group(); holder.add(coil);
      holder.position.set(ft.cx, ft.sole, ft.heel - r * 0.6);
      g.add(holder);
      ticks.push((_dt, t) => { holder.scale.y = 1 + 0.16 * Math.sin(t * 5 + (outer > 0 ? 0 : 1.6)); });
    } else if (id === 'rocket_sneakers') {
      // a little booster on the outside of each heel, flame out the back
      const bh = s * 0.11;
      const bg = latheFromPicture(bh, ROCKET, ROCKET_ASPECT, 14);
      const booster = new THREE.Mesh(bg, rocket);
      const holder = new THREE.Group(); holder.add(booster);
      booster.rotation.x = Math.PI / 2; // nose forward, nozzle back
      holder.position.set(ft.cx + outer * (ft.w * 0.5 + bh * 0.12), ft.sole + s * 0.05, ft.heel + bh * 0.25);
      // the flame: two crossed painted cards pointing out the back, so it shows from the side and from above
      const fmat = new THREE.MeshBasicMaterial({ map: flameMap, transparent: true, depthWrite: false, side: THREE.DoubleSide });
      const fl = new THREE.Group();
      for (const side of [true, false]) {
        const fg = new THREE.PlaneGeometry(bh * 0.42, bh * 0.55); fg.translate(0, -bh * 0.275, 0); fg.rotateX(Math.PI / 2);
        if (side) fg.rotateZ(Math.PI / 2);
        fl.add(new THREE.Mesh(fg, fmat));
      }
      fl.position.set(0, 0, -bh * 0.48);
      holder.add(fl);
      g.add(holder);
      ticks.push((_dt, t) => { fl.scale.z = 0.75 + 0.35 * Math.abs(Math.sin(t * 21 + outer)); });
    } else {
      // soft cloud puffs drifting round the ankles
      const puffs: THREE.Sprite[] = [];
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: i % 2 ? puffB : puffA, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.95 }));
        sp.scale.set(s * 0.13, s * 0.08, 1);
        g.add(sp); puffs.push(sp);
      }
      const mid = (ft.heel + ft.toe) / 2, len = ft.toe - ft.heel;
      ticks.push((_dt, t) => puffs.forEach((sp, i) => {
        const a = t * 0.8 + i * 2.1 + (outer > 0 ? 0 : 1);
        sp.position.set(ft.cx + Math.cos(a) * ft.w * 0.75, ft.sole + s * (0.02 + 0.015 * Math.sin(t * 2 + i)), mid + Math.sin(a) * len * 0.55);
      }));
    }
  }
  objs.forEach(shadows);
  return { objs, tick: (dt, t) => ticks.forEach(k => k(dt, t)) };
}

/** A little life for some things in hand: a wobble, a swish, rain from the umbrella's cloud, a butterfly
 *  that won't be caught, a phone that rings. Cheap: a turn each frame, a few sprites at most. */
async function handFun(x: Ctx, g: THREE.Group, piece: THREE.Group, s: number, len: number): Promise<((dt: number, t: number, p: THREE.Vector3) => void) | null> {
  const id = x.id, rnd = Math.random;
  const sprite = async (path: string, tint = 0xffffff) => { const m = await loadTexture(path); const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: m, color: tint, transparent: true, depthWrite: false })); g.add(sp); return sp; };
  if (id === 'rubber_chicken') {
    // a squeeze every few seconds, and a little bounce
    const base = piece.scale.x;
    return (_dt, t) => { const k = Math.max(0, Math.sin(t * 2.2)) ** 8; piece.scale.set(base * (1 + k * 0.12), base * (1 - k * 0.18), base); piece.rotation.z += Math.sin(t * 9) * k * 0.2; };
  }
  if (id === 'foam_finger') return (_dt, t) => { piece.rotation.z += Math.sin(t * 3.4) * 0.22; };
  if (id === 'baguette_sword') return (_dt, t) => { const k = Math.max(0, Math.sin(t * 0.9)) ** 12; piece.rotation.z += -k * 0.9; piece.rotation.x += k * 0.3; };
  // (turning a flat lollipop round showed its thin edge: a happy waggle keeps the swirl facing out)
  if (id === 'giant_lollipop') return (_dt, t) => { piece.rotation.z += Math.sin(t * 2.4) * 0.14; piece.rotation.y += Math.sin(t * 1.1) * 0.25; };
  if (id === 'triple_cone') return (_dt, t) => { piece.rotation.z += Math.sin(t * 2.6) * 0.06; piece.rotation.x += Math.sin(t * 2.1) * 0.05; };
  if (id === 'banana_phone') {
    // it rings: a buzz now and then, with notes
    const notes = await Promise.all([0, 1].map(i => sprite(`gear/tex-note${i}.webp`)));
    notes.forEach(n => n.scale.setScalar(0.0001));
    return (_dt, t, p) => {
      const ring = (t % 4) < 0.9, k = (t % 4) / 0.9;
      if (ring) piece.rotation.z += Math.sin(t * 60) * 0.06;
      notes.forEach((n, i) => { n.position.set(p.x + (i ? -1 : 1) * s * 0.07, p.y + len * 0.6 + k * s * 0.12, p.z + s * 0.05); n.scale.setScalar(ring ? s * 0.06 * Math.sin(Math.min(1, k) * Math.PI) : 0.0001); });
    };
  }
  if (id === 'cloud_umbrella') {
    // drizzle from the cloud on top, landing on the brim
    const drops = await Promise.all(Array.from({ length: stage.low ? 3 : 6 }, () => sprite('vibes/dot.webp', 0x8ccfff)));
    const ph = drops.map(() => rnd());
    return (dt, t, p) => drops.forEach((d, i) => {
      ph[i] = (ph[i] + dt * 1.1) % 1;
      const a = i * 2.4;
      d.position.set(p.x + Math.sin(a) * s * 0.1, p.y + len * (0.95 - ph[i] * 0.35), p.z + s * 0.04 + Math.cos(a) * s * 0.08);
      d.scale.setScalar(s * 0.025 * Math.sin(ph[i] * Math.PI));
    });
  }
  // the top of the thing in hand (it stands up from the grip, a fifth of the way up)
  const top = (p: THREE.Vector3, k = 0.8) => tmpTop.set(p.x - s * 0.02, p.y + len * k, p.z + s * 0.04);
  const tmpTop = new THREE.Vector3();
  if (id === 'balloon_sword') {
    const base = piece.scale.x;
    return (_dt, t) => { const k = Math.sin(t * 5.5); piece.scale.set(base * (1 + k * 0.05), base * (1 - k * 0.06), base * (1 + k * 0.05)); piece.rotation.z += Math.sin(t * 2.3) * 0.12; };
  }
  if (id === 'fish_rod') return (_dt, t) => { piece.rotation.z += Math.sin(t * 1.8) * 0.16 + Math.sin(t * 13) * 0.025; piece.rotation.x += Math.sin(t * 1.1) * 0.06; };
  if (id === 'magic_8ball') {
    // the answer window glows, and a shake now and then
    const glow = await sprite('vibes/dot.webp', 0x7ab8ff);
    (glow.material as THREE.SpriteMaterial).blending = THREE.AdditiveBlending;
    return (_dt, t, p) => {
      const shake = (t % 5) < 0.6;
      if (shake) { piece.rotation.z += Math.sin(t * 40) * 0.12; piece.rotation.x += Math.cos(t * 37) * 0.08; }
      top(p, 0.45); glow.position.set(tmpTop.x, tmpTop.y, tmpTop.z + len * 0.32);
      glow.scale.setScalar(len * (0.35 + 0.12 * Math.sin(t * 2.5)) * (shake ? 0.6 : 1));
    };
  }
  if (id === 'firefly_lantern') {
    // a warm glow that pulses and flickers (painted light alone looked pale)
    const glow = await sprite('vibes/dot.webp', 0xffc95a);
    (glow.material as THREE.SpriteMaterial).blending = THREE.AdditiveBlending;
    return (_dt, t, p) => {
      top(p, 0.5); glow.position.copy(tmpTop);
      const f = 0.85 + 0.15 * Math.sin(t * 3) + 0.06 * Math.sin(t * 17) * Math.sin(t * 7);
      glow.scale.setScalar(len * 0.95 * f);
      (glow.material as THREE.SpriteMaterial).opacity = 0.75 * f;
      piece.rotation.z += Math.sin(t * 1.4) * 0.07;
    };
  }
  if (id === 'walkie_talkie') {
    const led = await sprite('vibes/dot.webp', 0x5dff7a);
    (led.material as THREE.SpriteMaterial).blending = THREE.AdditiveBlending;
    return (_dt, t, p) => { top(p, 0.86); led.position.set(tmpTop.x + len * 0.08, tmpTop.y, tmpTop.z + len * 0.12); led.scale.setScalar((t % 1.2) < 0.35 ? len * 0.12 : 0.0001); };
  }
  if (id === 'ufo_string') {
    // it bobs on its string and spins slowly; its rim lights blink in turn
    const cols = [0xff6b6b, 0xffe066, 0x6ec6ff, 0x7ee081];
    const lights = await Promise.all(cols.map(c => sprite('vibes/dot.webp', c)));
    lights.forEach(l => ((l.material as THREE.SpriteMaterial).blending = THREE.AdditiveBlending));
    return (_dt, t, p) => {
      piece.position.y += Math.sin(t * 1.7) * len * 0.05;
      piece.rotation.y += t * 0.9;
      // round the saucer's rim (about three quarters of the way up, nearly half the thing wide)
      top(p, 0.66);
      lights.forEach((l, i) => {
        const a = t * 0.9 + (i / lights.length) * Math.PI * 2;
        l.position.set(tmpTop.x + Math.sin(a) * len * 0.42, tmpTop.y + Math.sin(t * 1.7) * len * 0.05, tmpTop.z + Math.cos(a) * len * 0.42);
        l.scale.setScalar(Math.floor(t * 3) % lights.length === i ? len * 0.09 : len * 0.04);
      });
    };
  }
  if (id === 'bubble_blaster' || id === 'toot_trumpet' || id === 'star_mic') {
    // puffs of bubbles, notes or sparkles from the end, every few seconds
    const paths = id === 'bubble_blaster' ? ['math/bubble.webp'] : id === 'toot_trumpet' ? ['gear/tex-note0.webp', 'gear/tex-note1.webp', 'gear/tex-note2.webp'] : ['vibes/sparkle.webp'];
    const ps = await Promise.all(Array.from({ length: stage.low ? 3 : 5 }, (_, i) => sprite(paths[i % paths.length])));
    const life = ps.map(() => -1), vel = ps.map(() => new THREE.Vector3()), every = id === 'star_mic' ? 1.4 : 3;
    let next = 0.5, k = 0;
    return (dt, t, p) => {
      next -= dt;
      if (next < 0) {
        next = every;
        for (let j = 0; j < (id === 'star_mic' ? 2 : 3); j++) {
          const i = k++ % ps.length;
          top(p, 0.9); ps[i].position.copy(tmpTop); life[i] = 0;
          vel[i].set((rnd() - 0.5) * s * 0.15, s * (0.18 + rnd() * 0.12), s * (0.08 + rnd() * 0.08));
        }
      }
      ps.forEach((sp, i) => {
        if (life[i] < 0) { sp.scale.setScalar(0.0001); return; }
        life[i] += dt;
        const kk = life[i] / 1.6;
        sp.position.addScaledVector(vel[i], dt);
        if (id === 'star_mic') (sp.material as THREE.SpriteMaterial).rotation += dt * 2;
        sp.scale.setScalar(kk >= 1 ? 0.0001 : s * (id === 'bubble_blaster' ? 0.07 : 0.06) * Math.min(1, life[i] * 5) * (1 - Math.max(0, kk - 0.7) / 0.3));
        if (kk >= 1) life[i] = -1;
      });
    };
  }
  if (id === 'butterfly_net') {
    // a firefly that always gets away
    const fly = await sprite('vibes/firefly.webp');
    return (_dt, t, p) => {
      fly.position.set(p.x + Math.sin(t * 1.3) * s * 0.18 - s * 0.05, p.y + len * 0.95 + Math.sin(t * 2.7) * s * 0.06, p.z + s * 0.1 + Math.cos(t * 1.3) * s * 0.12);
      fly.scale.setScalar(s * 0.08 * (0.9 + 0.1 * Math.sin(t * 20)));
      piece.rotation.z += Math.sin(t * 1.3 + 0.6) * 0.18;
    };
  }
  return null;
}

/** A line's value at a height (bind space). */
function lineAt(l: { top: number; bottom: number; z: number[] } | null, y: number, dflt: number) {
  if (!l) return dflt;
  const k = Math.max(0, Math.min(l.z.length - 1, Math.round(((l.top - y) / (l.top - l.bottom)) * (l.z.length - 1))));
  return l.z[k];
}
/** A painted model from the library (public/wear), for the face, neck, back or hand. It's placed by
 *  its own box, so it sits right whatever its origin: glasses with their back on the front of the
 *  face at the eyes; a bow tie or a medal on the front of the chest at the neck, a scarf or a lei round
 *  the neck; a pack with its back on the buddy's back under the shoulders (its front, +Z, facing out
 *  behind); a held thing at its grip (its origin, if that's inside it, else a third of the way up).
 *  `size` is its width as a share of the head (face, neck) or the back, or its height as a share of
 *  the buddy (hand). */
/** The back's surface (bind space): the backmost point of the body in each little square of the back
 *  seen from behind (the spine and hips only: hair hanging down or arms don't count). */
const backDepth = new WeakMap<Character, { cell: number; z: Map<string, number> }>();
function backDepthOf(c: Character, f: Fit) {
  let d = backDepth.get(c);
  if (d) return d;
  const cell = f.H * 0.025, z = new Map<string, number>();
  for (const p of points(c, ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck'], 0.35)) {
    const key = `${Math.round(p.x / cell)},${Math.round(p.y / cell)}`, was = z.get(key);
    if (was === undefined || p.z < was) z.set(key, p.z);
  }
  d = { cell, z };
  backDepth.set(c, d);
  return d;
}
/** How far a back piece placed at `at` (turned round, scaled by k about `anchor`) can move forward (+z)
 *  until its own back meets the body's, a little into it so no light shows between (negative: back). Its
 *  bottom quarter doesn't count (a tail or a bottom sticking out there would push it away). */
function restOnBack(c: Character, f: Fit, obj: THREE.Object3D, anchor: THREE.Vector3, k: number, at: THREE.Vector3) {
  const d = backDepthOf(c, f), v = new THREE.Vector3();
  obj.updateMatrixWorld(true);
  const pts: THREE.Vector3[] = [];
  obj.traverse(o => {
    const m = o as THREE.Mesh, p = m.isMesh ? m.geometry.attributes.position : null;
    if (!p) return;
    const step = Math.max(1, Math.floor(p.count / 1500));
    for (let i = 0; i < p.count; i += step) {
      v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld).sub(anchor).multiplyScalar(k);
      // turned round (about up), then put in place
      pts.push(new THREE.Vector3(at.x - v.x, at.y + v.y, at.z - v.z));
    }
  });
  if (!pts.length) return 0;
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
  const low = y0 + (y1 - y0) * 0.25;
  let room = Infinity;
  for (const p of pts) {
    if (p.y < low) continue;
    const bz = d.z.get(`${Math.round(p.x / d.cell)},${Math.round(p.y / d.cell)}`);
    if (bz !== undefined) room = Math.min(room, bz - p.z);
  }
  return Number.isFinite(room) ? room + f.H * 0.004 : 0;
}
/** How much a back piece from the library is scaled on this buddy: its height `size` times the back's
 *  length (shoulders to hips), but never wider than `wide` times the shoulders (joint to joint). */
function backScale(f: Fit, lib: { size: number; wide?: number }, size: THREE.Vector3) {
  const b = f.back!, len = Math.max(f.H * 0.12, b.shoulder - b.hips);
  return Math.min((lib.size * len) / Math.max(1e-6, size.y), ((lib.wide ?? 1.35) * b.span) / Math.max(1e-6, size.x));
}
async function libModel(x: Ctx): Promise<Built | null> {
  const { c, f, id } = x, lib = LIB[id];
  if (!lib?.model) return null;
  const gl = await loadGltf(lib.model);
  if (!gl) return null;
  const obj = gl.scene.clone(true);
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), mid = box.getCenter(new THREE.Vector3());
  shadows(obj);
  if (lib.slot === 'hand') {
    const hand = handTracker(c, f);
    if (!hand) return null;
    const hold = handHeld(x), s = hw(c);
    // held near the bottom: a handle, a stick, the tip of a cone (models' own origins aren't reliable)
    const grip = new THREE.Vector3(mid.x, box.min.y + size.y * 0.2, mid.z);
    obj.position.copy(grip).negate();
    const piece = new THREE.Group(); piece.add(obj);
    piece.scale.setScalar((lib.size * s) / Math.max(1e-6, size.y));
    hold.g.add(piece);
    const fun = await handFun(x, hold.g, piece, s, (size.y * piece.scale.y));
    return {
      objs: [hand.g, hold.g],
      tick: (dt, t) => {
        const p = hand.at();
        hold.at(p);
        // held a little in front of the hand, upright, swaying with the buddy
        piece.position.set(p.x - s * 0.02, p.y, p.z + s * 0.04);
        piece.rotation.set(0, -0.25 + Math.sin(t * 1.3) * 0.06, Math.sin(t * 1.7) * 0.05);
        fun?.(dt, t, p);
      },
    };
  }
  // everything else rides a bone, placed in bind space
  const hd = f.head, b = f.back;
  let bone = 'Head', at: THREE.Vector3 | null = null, anchor = new THREE.Vector3(), width = 0, turn = 0, k = 0;
  if (lib.slot === 'face' && hd) {
    at = new THREE.Vector3(hd.fx, hd.eyes, hd.front); width = hd.face;
    anchor.set(mid.x, mid.y, box.min.z);
  } else if (lib.slot === 'neck' && hd) {
    // where the head meets the shoulders
    bone = 'Spine02';
    const y = Math.min(hd.neck, (b?.top ?? hd.neck) + f.H * 0.04) - f.H * 0.015;
    // a ring that goes round the neck (a puffy scarf) is deep; a lei, a chain or a medal is a flat piece
    // lying on the chest, its top at the neck
    const wraps = size.z > size.x * 0.65;
    // sized to the shoulders (joint to joint), not the head (big ears made a lei the size of the buddy)
    // and not the spine (a puffy coat made a scarf a thin string round the neck)
    width = b?.span ?? hd.face;
    const k = (lib.size * width) / Math.max(1e-6, size.x);
    const tall = size.y > size.x * 0.8;
    anchor.set(mid.x, wraps ? box.max.y - size.y * 0.3 : tall ? box.max.y - size.y * 0.22 : mid.y, wraps ? mid.z : box.min.z);
    // the frontmost point of the body over the piece's height (a puffy coat or a round tummy): the
    // piece lies on it, never inside
    const below = (anchor.y - box.min.y) * k;
    let front = -Infinity;
    for (let t = 0; t <= 1; t += 0.125) front = Math.max(front, lineAt(f.frontLine, y - below * t, hd.front));
    if (!Number.isFinite(front)) front = hd.front;
    if (wraps) at = new THREE.Vector3(hd.cx, y, Math.max((hd.zmid + lineAt(f.frontLine, y, hd.front)) / 2, front + f.H * 0.008 - (box.max.z - mid.z) * k));
    else at = new THREE.Vector3(hd.cx, y, front + f.H * 0.004);
  } else if (lib.slot === 'back' && b) {
    // centred on the upper back, between the shoulder blades, facing out; it rests on whatever is
    // furthest back over its height (a backpack, a shell), so nothing of the buddy's own hides it.
    // Sized by the body: its height a share of the back's length (shoulders to hips), never wider than
    // its share of the shoulders (it used to be a share of the spine's own skin, which is a narrow strip
    // on some buddies and wide on others: a backpack was a matchbox on Ember and a house on Sloth)
    bone = 'Spine02';
    k = backScale(f, lib, size);
    // (a size saved on the old scale keeps its look: see nudgeNow)
    x.conv = ((lib.oldSize ?? lib.size) * b.w / Math.max(1e-6, size.x)) / k;
    const y = Math.max(b.top, b.shoulder) - f.H * 0.09, half = (size.y * k) / 2;
    let z = Infinity;
    for (let t = -1; t <= 1; t += 0.25) z = Math.min(z, lineAt(f.backLine, y + t * half, b.z));
    at = new THREE.Vector3(b.cx, y, (Number.isFinite(z) ? z : b.z) - f.H * 0.01); width = b.w; turn = Math.PI;
    anchor.set(mid.x, mid.y, box.min.z);
    // then settle it right onto the back: as far forward as its own shape lets it go before it meets the
    // body (the outline above is the backmost point in a strip down the middle: a dinosaur's spikes there
    // left a big pack hanging in the air behind its jacket)
    at.z += restOnBack(x.c, f, obj, anchor, k, at);
  }
  if (!at || !width) return null;
  if (!k) k = (lib.size * width) / Math.max(1e-6, size.x);
  // the neck and the back move with the skin right under the piece (the neck bends away from the chest
  // when a buddy dances, so a scarf held by the chest alone slid off to one side); the face rides the head
  const hb = lib.slot === 'neck' ? skinHeld(x, at, at, NECK_BONES, bone) : lib.slot === 'back' ? skinHeld(x, at, at, BACK_BONES, bone) : boneHeld(x, bone, at);
  if (!hb) return null;
  obj.position.copy(anchor).negate();
  const piece = new THREE.Group(); piece.add(obj);
  piece.scale.setScalar(k);
  // a back thing faces backwards (its front +Z is the side people see behind the buddy)
  piece.rotation.y = turn;
  piece.position.copy(at);
  hb.inner.add(piece);
  if (id === 'robot_visor') {
    // a light sweeps across the visor's strip
    const map = await loadTexture('vibes/dot.webp');
    const w = lib.size * width, sw = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xff4d6d, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sw.scale.setScalar(w * 0.22); hb.inner.add(sw);
    return { objs: [hb.g], tick: (_dt, t) => { sw.position.set(at!.x + Math.sin(t * 2.2) * w * 0.36, at!.y, at!.z + w * 0.1); } };
  }
  return { objs: [hb.g] };
}

// ---------- vibes: an aura round the buddy ----------
/** A vibe (vibes.ts): a few painted sprites round the buddy, moving their own way. Never more than a
 *  dozen or so (half on a slow device), sized by the buddy, and a sprite that drifts in front of the
 *  face shrinks away. Everything sits in the buddy's own space (so it follows it), but a trail is
 *  left in the world, so a run leaves a stripe behind. */
async function vibeFx(x: Ctx): Promise<Built | null> {
  const { c } = x, v = VIBE[x.id];
  if (!v) return null;
  const h = hw(c);
  const maps = (await Promise.all(v.sprites.map(p => loadTexture(p)))).filter((m): m is THREE.Texture => !!m);
  if (!maps.length) return null;
  const hold = new THREE.Group();
  hold.matrixAutoUpdate = false;
  c.root.add(hold);
  const pivot = new THREE.Vector3(0, h * 0.55, 0);
  const apply = () => { nudgeMatrix(hold.matrix, pivot, x.nz.v, h); hold.matrixWorldNeedsUpdate = true; };
  apply(); x.onNudge.push(apply);
  const mat = (map: THREE.Texture, tint?: number) => new THREE.SpriteMaterial({ map, color: tint ?? 0xffffff, transparent: true, depthWrite: false, blending: v.glow ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: v.glow ? 0.95 : 1 });
  const N = stage.low ? 7 : 14, rnd = Math.random;
  type P = { s: THREE.Sprite; age: number; life: number; a: number; r: number; y: number; vy: number; ph: number; size: number; spin: number; world?: THREE.Vector3; seen: number };
  const ps: P[] = [];
  // sides and back, not the front (where the face is): an angle round the buddy, 0 straight ahead
  const side = () => (0.32 + rnd() * 1.36) * Math.PI;
  const objs: THREE.Object3D[] = [hold];
  let trail: THREE.Group | null = null;
  const make = (k: number): P => {
    const map = maps[k % maps.length], tint = v.tints ? v.tints[k % v.tints.length] : undefined;
    const sp = new THREE.Sprite(mat(map, tint));
    sp.renderOrder = 3;
    return { s: sp, age: rnd() * 3, life: 2.2 + rnd() * 1.4, a: side(), r: h * (0.3 + rnd() * 0.25), y: h * (0.15 + rnd() * 0.85), vy: 0, ph: rnd() * 6.28, size: h * v.size * (0.75 + rnd() * 0.5), spin: (rnd() - 0.5) * 2, seen: 1 };
  };
  const count = v.motion === 'overhead' ? 1 + Math.round(N * 0.4) : v.motion === 'orbit' ? 6 : v.motion === 'trail' ? Math.round(N * 1.4) : N;
  for (let k = 0; k < count; k++) { const p = make(k); ps.push(p); if (v.motion !== 'trail') hold.add(p.s); }
  // the glow: a soft pool of light on the ground under the buddy
  let pool: THREE.Mesh | null = null;
  if (v.motion === 'glow') {
    const pm = new THREE.MeshBasicMaterial({ map: maps[0], color: 0xffd36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 });
    pool = new THREE.Mesh(new THREE.PlaneGeometry(h * 1.0, h * 1.0), pm);
    // a little above the ground: the islands slope, and a flat pool sank into the uphill side
    pool.rotation.x = -Math.PI / 2; pool.position.y = h * 0.06; pool.renderOrder = 1;
    hold.add(pool);
  }
  const cloud = v.motion === 'overhead' ? ps[0] : null;
  if (cloud) { cloud.size = h * v.size; cloud.s.material.map = maps[0]; }
  const face = (q: THREE.Vector3) => (q.z > -h * 0.02 && Math.abs(q.x) < h * 0.3 && q.y > h * 0.55 && q.y < h * 1.0 ? 0 : 1);
  const tmp = new THREE.Vector3();
  const respawn = (p: P) => {
    p.age = 0; p.life = 2.2 + rnd() * 1.4; p.a = side(); p.ph = rnd() * 6.28;
    if (v.motion === 'rise') { p.r = h * (0.3 + rnd() * 0.22); p.y = h * (0.15 + rnd() * 0.4); p.vy = h * (0.16 + rnd() * 0.12); }
    if (v.motion === 'fall') { p.a = rnd() * Math.PI * 2; p.r = h * (0.18 + rnd() * 0.45); p.y = h * (1.3 + rnd() * 0.2); p.vy = -h * (0.14 + rnd() * 0.1); p.life = 6; }
  };
  ps.forEach(p => { if (v.motion === 'rise' || v.motion === 'fall') { respawn(p); p.age = rnd() * p.life; if (v.motion === 'fall') p.y -= rnd() * h * 1.1; } });
  return {
    objs,
    tick: (dt, t) => {
      if (v.motion === 'trail' && !trail && c.root.parent) { trail = new THREE.Group(); c.root.parent.add(trail); objs.push(trail); ps.forEach(p => trail!.add(p.s)); }
      if (pool) (pool.material as THREE.MeshBasicMaterial).opacity = 0.42 + 0.14 * Math.sin(t * 1.6);
      ps.forEach((p, k) => {
        p.age += dt;
        let grow = 1;
        if (p === cloud) {
          tmp.set(Math.sin(t * 0.7) * h * 0.04, h * 1.12 + Math.sin(t * 1.3) * h * 0.025, -h * 0.02);
        } else if (cloud) {
          // drizzle from the cloud's belly, stopping above the head
          const k2 = (p.age % 1.1) / 1.1;
          if (p.age % 1.1 < dt) { p.a = (rnd() - 0.5) * h * 0.3; p.ph = (rnd() - 0.5) * h * 0.12; }
          tmp.set(p.a, h * (1.04 - k2 * 0.12), p.ph); grow = (1 - k2) * 0.3; p.s.material.color.setHex(0x9fd4ff);
        } else if (v.motion === 'drift' || v.motion === 'glow') {
          p.a += dt * 0.25 * (k % 2 ? 1 : -1);
          const yy = v.motion === 'glow' ? h * (0.05 + ((p.ph + t * 0.12) % 1) * 1.0) : p.y + Math.sin(t * 0.8 + p.ph) * h * 0.06;
          tmp.set(Math.sin(p.a) * p.r, yy, Math.cos(p.a) * p.r);
          grow = 0.55 + 0.45 * Math.sin(t * 3 + p.ph) ** 2;
          if (v.motion === 'glow') grow *= Math.sin(((p.ph + t * 0.12) % 1) * Math.PI);
        } else if (v.motion === 'rise' || v.motion === 'fall') {
          p.y += p.vy * dt;
          const sway = Math.sin(t * 1.6 + p.ph) * h * (v.motion === 'fall' ? 0.08 : 0.04);
          tmp.set(Math.sin(p.a) * p.r + sway, p.y, Math.cos(p.a) * p.r);
          const k2 = p.age / p.life;
          grow = Math.min(1, p.age * 3) * (v.motion === 'rise' ? Math.max(0, 1 - Math.max(0, k2 - 0.7) / 0.3) : 1);
          if (v.motion === 'fall') { p.s.material.rotation += p.spin * dt * 1.5; if (p.y < h * 0.02) respawn(p); }
          else if (k2 >= 1) respawn(p);
        } else if (v.motion === 'orbit') {
          const a = t * 1.6 + (k / ps.length) * Math.PI * 2;
          tmp.set(Math.sin(a) * h * 0.26, h * 1.03 + Math.sin(a * 2) * h * 0.02, Math.cos(a) * h * 0.2);
          grow = 0.8 + 0.2 * Math.sin(t * 5 + k);
        } else if (v.motion === 'swirl') {
          const u = (p.ph / 6.28 + t * 0.09) % 1, a = p.ph * 3 + t * 1.3;
          tmp.set(Math.sin(a) * h * 0.42, h * (0.05 + u * 1.15), Math.cos(a) * h * 0.42);
          grow = Math.sin(u * Math.PI);
        } else if (v.motion === 'trail') {
          // a stripe left behind: each sparkle starts at the feet and stays where it was let go
          if (p.age >= p.life || !p.world) {
            p.age = 0; p.life = 1.2 + rnd() * 0.8;
            c.root.updateMatrixWorld();
            p.world = c.root.localToWorld(new THREE.Vector3((rnd() - 0.5) * h * 0.4, h * (0.03 + rnd() * 0.25), (rnd() - 0.6) * h * 0.3));
          }
          p.world.y += dt * h * 0.12;
          const k2 = p.age / p.life;
          grow = Math.min(1, p.age * 4) * (1 - k2);
          p.s.position.copy(p.world);
          p.s.scale.setScalar(p.size * grow * x.nz.v.s);
          return;
        }
        // a sprite in front of the face shrinks away; it comes back as it moves on
        p.seen += (face(tmp) - p.seen) * Math.min(1, dt * 8);
        p.s.position.copy(tmp);
        p.s.scale.setScalar(Math.max(0.0001, p.size * grow * (p === cloud ? 1 : p.seen)));
      });
    },
  };
}

const BUILD: Record<string, (x: Ctx) => Promise<Built | null>> = {
  hero_cape: cape, fairy_wings: wings, rocket_pack: rocketPack,
  bubble_wand: bubbleWand, sky_kite: kite, boombox,
  spring_shoes: shoes, cloud_slippers: shoes, rocket_sneakers: shoes,
};
const builderOf = (id: string) => BUILD[id] ?? (VIBE[id] ? vibeFx : LIB[id]?.slot === 'feet' ? shoes : LIB[id] ? libModel : null);

function rigOf(c: Character): Rig {
  let r = rigs.get(c);
  if (r) return r;
  const rig: Rig = { worn: {}, t: Math.random() * 10, want: {}, tick: (dt: number) => {
    rig.t += dt;
    const ws = Object.values(rig.worn);
    // pieces that follow the skin: the bones' places this frame first (the moves just changed them)
    if (ws.some(w => w?.follow.length)) { c.root.updateMatrixWorld(true); for (const w of ws) w?.follow.forEach(f => f()); }
    for (const w of ws) w?.tick?.(dt, rig.t);
  } };
  c.tickers.add(rig.tick);
  rigs.set(c, rig);
  return rig;
}
function takeOff(w: { objs: THREE.Object3D[] }) {
  for (const o of w.objs) {
    o.removeFromParent();
    o.traverse(x => {
      const m = x as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
      for (const mt of mats) mt.dispose();
    });
  }
}

/** Put a piece on a slot (null takes it off), with its nudge. Wearing the same piece again only moves
 *  it. Safe to call again while one is still loading. */
export async function wearGear(c: Character, slot: Slot, id: string | null, nudge: Nudge | null = null) {
  // a colour isn't a thing to wear: it paints the buddy itself
  if (slot === 'colour') { c.setColour(id && !colourSoon(c.id) ? COLOUR[id] ?? null : null); return; }
  const rig = rigOf(c);
  const cur = rig.worn[slot];
  if ((cur?.id ?? null) === id && rig.want[slot] === undefined) {
    if (cur) { cur.nz.v = { ...NO_NUDGE, ...(nudge ?? {}) }; cur.onNudge.forEach(f => f()); }
    return;
  }
  rig.want[slot] = id;
  if (cur) { takeOff(cur); delete rig.worn[slot]; }
  const build = id ? builderOf(id) : null;
  if (!id || !build) { delete rig.want[slot]; return; }
  const x: Ctx = { c, f: fitOf(c), id, nz: { v: { ...NO_NUDGE, ...(nudge ?? {}) } }, onNudge: [], follow: [] };
  const built = await build(x).catch(e => { console.warn('gear', id, e); return null; });
  if (rig.want[slot] !== id) { if (built) takeOff(built); return; }
  delete rig.want[slot];
  if (built) {
    // tagged, so a tap on the buddy in the Wardrobe can tell what was touched (wornAt)
    for (const o of built.objs) o.userData.wear = { slot, id };
    rig.worn[slot] = { id, ...built, nz: x.nz, onNudge: x.onNudge, follow: x.follow, conv: x.conv };
  }
}
/** What a ray hits first of what a buddy wears (the Wardrobe: tap a thing on the buddy to move it). The
 *  hat counts too; a vibe's sprites count when the ray has a camera. Null: nothing worn there. */
export function wornAt(c: Character, ray: THREE.Raycaster): { slot: Slot; id: string; point: THREE.Vector3 } | null {
  const targets: THREE.Object3D[] = [];
  for (const w of Object.values(rigs.get(c)?.worn ?? {})) if (w) targets.push(...w.objs);
  const hat = c.hatHolder();
  if (hat) targets.push(hat);
  let best: { slot: Slot; id: string; point: THREE.Vector3; d: number } | null = null;
  for (const t of targets) {
    const tag = (t.userData.wear ?? null) as { slot: Slot; id: string } | null;
    if (!tag) continue;
    let hits: THREE.Intersection[] = [];
    try { hits = ray.intersectObject(t, true); } catch { hits = []; }
    // a little allowance for thin things (a necklace, glasses): the nearest hit wins
    const h = hits.find(x => (x.object as THREE.Mesh).isMesh || (x.object as THREE.Sprite).isSprite);
    if (h && (!best || h.distance < best.d)) best = { ...tag, point: h.point.clone(), d: h.distance };
  }
  return best ? { slot: best.slot, id: best.id, point: best.point } : null;
}
// the outline round a thing being moved: its own shape drawn again a few pixels bigger, inside out, in
// gold (the same width on screen however near it is), gently pulsing
let rimMat: THREE.MeshBasicMaterial | null = null;
function rim() {
  if (rimMat) return rimMat;
  rimMat = new THREE.MeshBasicMaterial({ color: 0xffc23d, side: THREE.BackSide, transparent: true, opacity: 0.9, depthWrite: false });
  rimMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      mvPosition.xyz += normalize(normalMatrix * normal) * (-mvPosition.z) * 0.0065;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  return rimMat;
}
/** A gold outline round a worn thing while it's being moved (null: none). */
export function highlightWorn(c: Character, slot: Slot | null) {
  const targets: THREE.Object3D[] = [];
  for (const w of Object.values(rigs.get(c)?.worn ?? {})) if (w) targets.push(...w.objs);
  const hat = c.hatHolder();
  if (hat) targets.push(hat);
  for (const t of targets) {
    const rims: THREE.Object3D[] = [];
    t.traverse(o => { if (o.userData.rim) rims.push(o); });
    rims.forEach(o => o.removeFromParent());
    if (!slot || (t.userData.wear as { slot: Slot } | undefined)?.slot !== slot) continue;
    const meshes: THREE.Mesh[] = [];
    t.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry?.attributes.normal && m.visible) meshes.push(m); });
    for (const m of meshes) {
      const r = new THREE.Mesh(m.geometry, rim());
      r.userData.rim = true; r.raycast = () => {}; r.renderOrder = m.renderOrder;
      r.onBeforeRender = () => { rim().opacity = 0.78 + 0.22 * Math.sin(performance.now() / 160); };
      m.add(r);
    }
  }
}
/** Wear everything for every slot but the head (missing slots are taken off), with the nudges. */
export async function wearKit(c: Character, kit: Partial<Record<Slot, string>>, nudge: Record<string, Nudge> = {}) {
  await Promise.all((['face', 'neck', 'back', 'hand', 'feet', 'vibe', 'colour'] as Slot[]).map(s => { const id = kit[s] ?? null; return wearGear(c, s, id, id ? nudge[id] ?? null : null); }));
}
/** The nudge a worn piece is drawn with now, on today's scale (the Wardrobe starts Move it from this,
 *  so a size saved on the old scale doesn't jump when it's moved). */
export function wornNudge(c: Character, slot: Slot, n: Nudge): Nudge {
  const w = rigs.get(c)?.worn[slot];
  return nudgeNow(n, w?.conv ?? 1);
}
/** Live nudge while moving a piece in the Wardrobe (no rebuild). */
export function nudgeGear(c: Character, slot: Slot, n: Nudge) {
  const w = rigs.get(c)?.worn[slot];
  if (w) { w.nz.v = n; w.onNudge.forEach(f => f()); }
}

// ---------- the climbing kit (the cliff course: three/runScene.ts) ----------
/** What a climber wears up the cliff, and how fast it shows it's going. `update` with the speed step (0
 *  Hold On .. 5 Rocket Boots) and how fast the buddy is moving (m/s). */

/** Show or hide what a buddy wears on a spot for a moment (a climbing method's own gear takes its place). */
export function showWorn(c: Character, slot: Slot, on: boolean) {
  for (const o of rigs.get(c)?.worn[slot]?.objs ?? []) o.visible = on;
}
