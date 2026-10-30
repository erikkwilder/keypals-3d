// A 3D buddy: the model (weights redone in Blender so raised arms stay round), its moves, a colour
// lift for the scanned textures, and two fixes applied every frame: planted feet are turned flat on
// the ground, and the character never casts shadows on itself (that's what flickered on faces).
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { loadGltf } from './assets';
import { FRIEND, type FriendId } from '../art/cast';

import { CLIP_NAMES as MOVE } from './clipNames';
const ONCE = new Set(['cheer', 'jump', 'wave', 'fistpump', 'wave1']);
/** extra moves: the seated pose for rides, celebrations and dances, loaded the first time they're needed */
export const MOVE_FILES = ['moves'];

type Loaded = { scene: THREE.Group; clips: THREE.AnimationClip[] };
const sources = new Map<FriendId, Promise<Loaded | null>>();
function source(id: FriendId) {
  let p = sources.get(id);
  if (!p) {
    p = loadGltf(`models/${id}.glb`).then(g => {
      if (!g) return null;
      g.scene.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) liftColours(o as THREE.SkinnedMesh); });
      return { scene: g.scene, clips: g.animations };
    });
    sources.set(id, p);
  }
  return p;
}
const moveSets = new Map<string, Promise<THREE.AnimationClip[]>>();
function moves(id: FriendId) {
  let p = moveSets.get(id);
  if (!p) {
    // the Meshy moves, and the dances remapped from Mixamo and Sketchfab (tools/blender/retarget.py)
    // (and climbing and swimming for the math courses, copied the same way)
    p = Promise.all([loadGltf(`models/${id}-moves.glb`), loadGltf(`models/${id}-dances.glb`), loadGltf(`models/${id}-moves2.glb`)]).then(gs => gs.flatMap(g => g?.animations ?? []));
    moveSets.set(id, p);
  }
  return p;
}

/** The scanned textures read drab on screen: lift saturation and a touch of brightness in the shader. */
function liftColours(m: THREE.SkinnedMesh, vivid = 1.28, bright = 1.06) {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  for (const mat of mats) {
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), diffuseColor.rgb, ${vivid.toFixed(3)})) * ${bright.toFixed(3)}; }`);
    };
    mat.customProgramCacheKey = () => 'kp-lift';
    const mm = mat as THREE.MeshStandardMaterial;
    if (mm.map) mm.map.anisotropy = 8;
  }
}

// ---------- colours: paint a buddy a new colour (adventure/colours.ts) ----------
/** The colour a buddy is made in (its fur, skin or box), read from its own texture where its head is
 *  (a hat or a jacket doesn't count): the middle hue, how wide a band, how colourful a pixel has to be,
 *  and whether the buddy is black or dark grey (then darkness is what's painted, not a hue). */
type Band = { h: number; w: number; s: number; dark: boolean; v: number; sm: number };
const bodyHues = new Map<string, Band>();
/** Momo's cap, Fizz's fin and Axel's frills are bigger than their fur and skin on their heads, Tuck's
 *  skin is close to his jacket, and Mochi is a black cat with bright eyes ('dark': paint the darkness) */
const BODY_HINT: Partial<Record<FriendId, string>> = { monkey: '#3a6fd0', fish: '#3b8fc4', axolotl: '#86a85a', turtle: '#7f9c45', cat: 'dark' };
if (import.meta.env.DEV) (window as unknown as { __bands: typeof bodyHues }).__bands = bodyHues;
function hsvOf(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h / 6) + 1) % 1, mx > 0 ? d / mx : 0, mx];
}
const hueGap = (a: number, b: number) => Math.abs(((a - b + 1.5) % 1) - 0.5);
/** sRGB (0..1) to Lab: how far apart two colours look */
function labOf(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const R = lin(r), G = lin(g), B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const f = (n: number) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
function bodyHue(id: FriendId, model: THREE.Object3D): Band {
  const known = bodyHues.get(id);
  if (known) return known;
  const hex = FRIEND[id].color, cast = hsvOf(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)[0];
  let out: Band = { h: cast, w: 0.07, s: 0.2, dark: false, v: 0.7, sm: 0.5 };
  try {
    let mesh: THREE.SkinnedMesh | null = null;
    model.traverse(o => { const m = o as THREE.SkinnedMesh; if (!mesh && m.isSkinnedMesh && m.geometry.attributes.uv) mesh = m; });
    const m = mesh as THREE.SkinnedMesh | null;
    const mt = m && ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial);
    const img = mt?.map?.image as CanvasImageSource | undefined;
    if (m && img) {
      const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
      const cx = cv.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(img, 0, 0, N, N);
      const px = cx.getImageData(0, 0, N, N).data;
      // the head's own surface (triangles the Head bone moves), each spot weighted by its area, so the
      // skin or fur counts for more than the eyes and teeth, which have lots of little triangles
      const hi = m.skeleton.bones.findIndex(b => b.name === 'Head');
      const uv = m.geometry.attributes.uv, pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
      const ix = m.geometry.index, tris = ix ? ix.count / 3 : pos.count / 3;
      const onHead = new Uint8Array(pos.count);
      for (let i = 0; i < pos.count; i++) { let w = 0; for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k); onHead[i] = w >= 0.6 ? 1 : 0; }
      const head: [number, number, number, number][] = [];
      const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
      for (let t = 0; t < tris; t++) {
        const a = ix ? ix.getX(t * 3) : t * 3, b = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, c = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
        if (!onHead[a] || !onHead[b] || !onHead[c]) continue;
        A.fromBufferAttribute(pos, a); B.fromBufferAttribute(pos, b); C.fromBufferAttribute(pos, c);
        const area = B.sub(A).cross(C.sub(A)).length() / 2;
        const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3, v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
        const x = Math.min(N - 1, Math.max(0, Math.floor((u % 1 + 1) % 1 * N))), y = Math.min(N - 1, Math.max(0, Math.floor((v % 1 + 1) % 1 * N)));
        const j = (y * N + x) * 4;
        const [h, sat, val] = hsvOf(px[j] / 255, px[j + 1] / 255, px[j + 2] / 255);
        head.push([h, sat, val, area]);
      }
      const total = head.reduce((a, x) => a + x[3], 0);
      const colourful = head.filter(([, sat, v]) => sat >= 0.22 && v >= 0.15), cTotal = colourful.reduce((a, x) => a + x[3], 0);
      if (head.length > 30 && cTotal >= total * 0.25 && BODY_HINT[id] !== 'dark') {
        // the commonest colourful hue on the head (by area), then the middle and spread of the hues near it
        const bins = new Array(36).fill(0);
        for (const [h, , , ar] of colourful) bins[Math.floor(h * 36) % 36] += ar;
        // (a few buddies wear a lot of another colour on their heads: start from their own skin or fur)
        const hint = BODY_HINT[id];
        const top = hint ? hsvOf(parseInt(hint.slice(1, 3), 16) / 255, parseInt(hint.slice(3, 5), 16) / 255, parseInt(hint.slice(5, 7), 16) / 255)[0] : bins.indexOf(Math.max(...bins)) / 36 + 1 / 72;
        const near = colourful.filter(([h]) => hueGap(h, top) < 0.08), nT = near.reduce((a, x) => a + x[3], 0) || 1;
        const sx = near.reduce((a, [h, , , ar]) => a + Math.cos(h * Math.PI * 2) * ar, 0), sy = near.reduce((a, [h, , , ar]) => a + Math.sin(h * Math.PI * 2) * ar, 0);
        const mean = ((Math.atan2(sy, sx) / (Math.PI * 2)) + 1) % 1;
        const sd = Math.sqrt(near.reduce((a, [h, , , ar]) => a + hueGap(h, mean) ** 2 * ar, 0) / nT);
        // how colourful the body is: a pale face or a grey tummy nearby stays as it is
        const ss = near.map(([, sat]) => sat).sort((a, b) => a - b);
        // and how light it is (a dark brown monkey and a light blue dino end up just as bright in a colour)
        const v = near.reduce((a, [, , val, ar]) => a + val * ar, 0) / nT;
        out = { h: mean, w: Math.max(0.05, Math.min(0.1, sd * 2.2 + 0.02)), s: Math.max(0.2, Math.min(0.45, (ss[Math.floor(ss.length * 0.25)] ?? 0.25) * 0.8)), dark: false, v, sm: near.reduce((a, [, sat, , ar]) => a + sat * ar, 0) / nT };
      } else if (head.length > 30 && (BODY_HINT[id] === 'dark' || head.filter(([, , v]) => v < 0.3).reduce((a, x) => a + x[3], 0) >= total * 0.45)) {
        // a black or dark grey buddy (Ink, Mochi): its darkness is what gets the colour
        const darkBits = head.filter(([, , val]) => val < 0.3), dT = darkBits.reduce((a, x) => a + x[3], 0) || 1;
        out = { h: cast, w: 0.07, s: 0.2, dark: true, v: darkBits.reduce((a, [, , val, ar]) => a + val * ar, 0) / dT, sm: 0.1 };
      }
    }
  } catch { /* a texture that can't be read: the cast's colour */ }
  bodyHues.set(id, out);
  return out;
}
// ---------- the mask: which bits of the buddy are its own colour ----------
// The buddy's own surface: the triangles in the colour its head is made in (a jacket or hat in another
// colour isn't), in pieces big enough to be fur or skin rather than a pattern, with clothes a buddy
// wears in its own colour left out by name below. Drawn into a picture the shape of its texture.
type Zone = 'head' | 'neck' | 'torso' | 'arm' | 'forearm' | 'hand' | 'thigh' | 'shin' | 'foot';
const ZONE: Record<string, Zone> = {
  Head: 'head', head_end: 'head', headfront: 'head', neck: 'neck', Hips: 'torso', Spine: 'torso', Spine01: 'torso', Spine02: 'torso', LeftShoulder: 'torso', RightShoulder: 'torso',
  LeftArm: 'arm', RightArm: 'arm', LeftForeArm: 'forearm', RightForeArm: 'forearm', LeftHand: 'hand', RightHand: 'hand',
  LeftUpLeg: 'thigh', RightUpLeg: 'thigh', LeftLeg: 'shin', RightLeg: 'shin', LeftFoot: 'foot', RightFoot: 'foot', LeftToeBase: 'foot', RightToeBase: 'foot',
};
/** Clothes in a buddy's own colour stay as they are: the parts of the body they cover (skip; or only:
 *  the parts where the fur or skin shows), or boxes round them (cut), with boxes kept anyway (keep: a
 *  tail out of a jacket). Boxes are shares of the buddy's size, [left, bottom, back, right, top, front],
 *  0 to 1. tol: how far from the body's colour still counts (1: as found); bright: how much lighter
 *  than the body a bit of it can be (a paler face). */
type Box = [number, number, number, number, number, number];
type Fix = { skip?: Zone[]; only?: Zone[]; cut?: Box[]; keep?: Box[]; tol?: number; bright?: number };
const PAINT_FIX: Partial<Record<FriendId, Fix>> = {
  // jackets, sweaters and hoods in the buddy's own colour (and tails that hang out of them)
  cheetah: { skip: ['torso', 'arm', 'forearm'], keep: [[0, 0, 0, 1, 0.62, 0.32]] },
  monkey: { skip: ['torso', 'arm', 'forearm'], keep: [[0, 0, 0, 1, 0.6, 0.15]] },
  turtle: { only: ['head', 'neck', 'hand', 'shin'], tol: 0.7 },
  sweater: { skip: ['torso', 'arm', 'forearm'] },
  dog: { skip: ['torso', 'arm', 'forearm'] },
  // Moss's bucket hat is the same brown as his fur, and his jeans have brown pockets
  sloth: { only: ['head', 'hand'], cut: [[0, 0.83, 0, 1, 1, 1]] },
  // Ember's colour is her white hair: her white shirt and shoes stay white
  elf: { only: ['head', 'hand'] },
  // a coat in many yellows, and a paler face
  fluff: { tol: 2.6, bright: 2.1 }, diver: { tol: 2.6, bright: 2.1 },
  // brown tips on a tan coat, and straw in many yellows
  terrier: { tol: 1.7, bright: 1.8 }, straw: { tol: 2.2, bright: 2.1 },
};
const ZONES: Zone[] = ['head', 'neck', 'torso', 'arm', 'forearm', 'hand', 'thigh', 'shin', 'foot'];
type Plan = { mask: THREE.CanvasTexture; h: number; hw: number; s: number; lum: number; grey: boolean };
const plans = new Map<string, Plan | null>();
if (import.meta.env.DEV) (window as unknown as { __plans: typeof plans }).__plans = plans;
const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
function paintPlan(id: FriendId, model: THREE.Object3D): Plan | null {
  if (plans.has(id)) return plans.get(id)!;
  let out: Plan | null = null;
  try { out = buildPlan(id, model); } catch { out = null; }
  plans.set(id, out);
  return out;
}
function headRef(m: THREE.SkinnedMesh, px: Uint8ClampedArray, N: number, band: Band) {
  const hi = m.skeleton.bones.findIndex(b => b.name === 'Head');
  const g = m.geometry, uv = g.attributes.uv, si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const pts: [number, number, number][] = [];
  for (let i = 0; i < uv.count; i += 1) {
    let w = 0;
    for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
    if (w < 0.6) continue;
    const x = Math.min(N - 1, Math.max(0, Math.floor(((uv.getX(i) % 1) + 1) % 1 * N))), y = Math.min(N - 1, Math.max(0, Math.floor(((uv.getY(i) % 1) + 1) % 1 * N)));
    const j = (y * N + x) * 4, r = px[j] / 255, gg = px[j + 1] / 255, b = px[j + 2] / 255;
    const [h, sat, val] = hsvOf(r, gg, b);
    if (band.dark ? val < 0.3 : hueGap(h, band.h) <= band.w && sat >= band.s) pts.push(labOf(r, gg, b));
  }
  if (pts.length < 10) return { L: 50, a: 0, b: 0, tol: 12 };
  const med = (xs: number[]) => xs.sort((p, q) => p - q)[Math.floor(xs.length / 2)];
  const L = med(pts.map(p => p[0])), a = med(pts.map(p => p[1])), b = med(pts.map(p => p[2]));
  const d = pts.map(([pl, pa, pb]) => { const k = Math.min(L / Math.max(8, pl), 2); return Math.hypot(pa * k - a, pb * k - b); }).sort((p, q) => p - q);
  return { L, a, b, tol: Math.max(8, Math.min(16, d[Math.floor(d.length * 0.8)] * 1.5)) };
}
function buildPlan(id: FriendId, model: THREE.Object3D): Plan | null {
  const band = bodyHue(id, model);
  let mesh: THREE.SkinnedMesh | null = null;
  model.traverse(o => { const m = o as THREE.SkinnedMesh; if (!mesh && m.isSkinnedMesh && m.geometry.attributes.uv) mesh = m; });
  const m = mesh as THREE.SkinnedMesh | null;
  const img = m && ((Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshStandardMaterial).map?.image as CanvasImageSource | undefined;
  if (!m || !img) return null;
  const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, N, N);
  const px = cx.getImageData(0, 0, N, N).data;
  const g = m.geometry, uv = g.attributes.uv, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, ix = g.index;
  const tris = ix ? ix.count / 3 : pos.count / 3;
  const vid = (t: number, k: number) => (ix ? ix.getX(t * 3 + k) : t * 3 + k);
  // each vertex: its part of the body (the bone that moves it most), and the same spot on the mesh
  // for vertices split at a seam in the texture
  const zone: Zone[] = [], weld = new Int32Array(pos.count), keys = new Map<string, number>();
  const names = m.skeleton.bones.map(b => ZONE[b.name] ?? 'torso');
  for (let i = 0; i < pos.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    zone.push(names[best] ?? 'torso');
    const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    weld[i] = keys.get(key) ?? (keys.set(key, keys.size), keys.size - 1);
  }
  g.computeBoundingBox();
  const bb = g.boundingBox!, sz = bb.getSize(new THREE.Vector3());
  const fix = PAINT_FIX[id] ?? {}, skip = new Set(fix.only ? ZONES.filter(z => !fix.only!.includes(z)) : fix.skip ?? []);
  const inBox = (p: THREE.Vector3, bx: Box) => {
    const x = (p.x - bb.min.x) / sz.x, y = (p.y - bb.min.y) / sz.y, z = (p.z - bb.min.z) / sz.z;
    return x >= bx[0] && x <= bx[3] && y >= bx[1] && y <= bx[4] && z >= bx[2] && z <= bx[5];
  };
  // each triangle: is it the body's colour (most of four spots on it), its part, its area
  const sample = (u: number, v: number) => {
    const x = Math.min(N - 1, Math.max(0, Math.floor(((u % 1) + 1) % 1 * N))), y = Math.min(N - 1, Math.max(0, Math.floor(((v % 1) + 1) % 1 * N)));
    const j = (y * N + x) * 4;
    return [px[j] / 255, px[j + 1] / 255, px[j + 2] / 255] as const;
  };
  // the body's colour as it looks (Lab), from the head's surface in the body's hue: a pixel is the body's
  // if its colour (not counting how light it is: shading) is close to that, and it's not far lighter or darker
  const ref = headRef(m, px, N, band), tol = ref.tol * (PAINT_FIX[id]?.tol ?? 1);
  const like = (r: number, gg: number, b: number) => {
    const [L, a, bb] = labOf(r, gg, b);
    if (band.dark) { const [, sat, val] = hsvOf(r, gg, b); return sat < 0.3 && val < 0.42 && val > 0.03; }
    // (darker bits of a colour are less colourful: compare at the body's lightness)
    const k = ref.L / Math.max(8, L);
    return Math.hypot(a * Math.min(k, 2) - ref.a, bb * Math.min(k, 2) - ref.b) <= tol && L >= ref.L * 0.42 && L <= ref.L * (PAINT_FIX[id]?.bright ?? 1.5) + 6;
  };
  const body = new Uint8Array(tris), tz: Zone[] = [], area = new Float32Array(tris), stat: [number, number, number, number][] = [];
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let t = 0; t < tris; t++) {
    const a = vid(t, 0), b = vid(t, 1), c = vid(t, 2);
    const ua = uv.getX(a), va = uv.getY(a), ub = uv.getX(b), vb = uv.getY(b), uc = uv.getX(c), vc = uv.getY(c);
    const mu = (ua + ub + uc) / 3, mv = (va + vb + vc) / 3;
    let n = 0, sr = 0, sg = 0, sb = 0;
    for (const [u, v] of [[mu, mv], [(mu * 2 + ua) / 3, (mv * 2 + va) / 3], [(mu * 2 + ub) / 3, (mv * 2 + vb) / 3], [(mu * 2 + uc) / 3, (mv * 2 + vc) / 3]]) {
      const [r, gg, bb] = sample(u, v);
      if (like(r, gg, bb)) { n++; sr += r; sg += gg; sb += bb; }
    }
    A.fromBufferAttribute(pos, a); B.fromBufferAttribute(pos, b); C.fromBufferAttribute(pos, c);
    area[t] = B.clone().sub(A).cross(C.clone().sub(A)).length() / 2;
    const zs = [zone[a], zone[b], zone[c]];
    tz.push(zs[0] === zs[1] || zs[0] === zs[2] ? zs[0] : zs[1]);
    const mid = A.clone().add(B).add(C).divideScalar(3);
    const out = (skip.has(tz[t]) || (fix.cut ?? []).some(bx => inBox(mid, bx))) && !(fix.keep ?? []).some(bx => inBox(mid, bx));
    body[t] = n >= 2 && !out ? 1 : 0;
    if (out) tz[t] = 'skip' as Zone;
    stat.push(n ? [sr / n, sg / n, sb / n, n] : [0, 0, 0, 0]);
  }
  // which triangles touch each spot on the mesh
  const start = new Int32Array(keys.size + 1);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) start[weld[vid(t, k)] + 1]++;
  for (let i = 0; i < keys.size; i++) start[i + 1] += start[i];
  const fill = start.slice(0, keys.size), around = new Int32Array(tris * 3);
  for (let t = 0; t < tris; t++) for (let k = 0; k < 3; k++) around[fill[weld[vid(t, k)]]++] = t;
  const each = (t: number, f: (o: number) => void) => { for (let k = 0; k < 3; k++) { const w = weld[vid(t, k)]; for (let q = start[w]; q < start[w + 1]; q++) if (around[q] !== t) f(around[q]); } };
  // the body's colour in pieces across the mesh: big pieces (or ones on the head) are the buddy, little
  // ones are a pattern on its clothes that happens to match
  const inn = new Uint8Array(tris), comp = new Int32Array(tris).fill(-1);
  let bodyArea = 0;
  for (let t = 0; t < tris; t++) if (body[t]) bodyArea += area[t];
  for (let t0 = 0; t0 < tris; t0++) {
    if (!body[t0] || comp[t0] >= 0) continue;
    const list = [t0], stack = [t0];
    comp[t0] = t0;
    let ar = 0, head = false;
    while (stack.length) {
      const t = stack.pop()!; ar += area[t]; head ||= tz[t] === 'head';
      each(t, o => { if (body[o] && comp[o] < 0) { comp[o] = t0; stack.push(o); list.push(o); } });
    }
    if (head || ar >= bodyArea * 0.012) list.forEach(t => (inn[t] = 1));
  }
  if (!inn.some(Boolean)) return null;
  // close little holes (a spot, a stripe, a crease): a triangle mostly surrounded by the body joins it
  for (let pass = 0; pass < 2; pass++) {
    const add: number[] = [];
    for (let t = 0; t < tris; t++) {
      if (inn[t] || (tz[t] as string) === 'skip') continue;
      let tot = 0, yes = 0;
      each(t, o => { tot++; yes += inn[o]; });
      if (tot && yes / tot >= 0.7) add.push(t);
    }
    add.forEach(t => (inn[t] = 1));
  }
  // the body's colour, from its own triangles (by area)
  let wsum = 0, L = 0, S = 0, hx = 0, hy = 0;
  for (let t = 0; t < tris; t++) {
    if (!inn[t] || !stat[t][3]) continue;
    const [r, gg, b] = stat[t], [h, sat] = hsvOf(r, gg, b), w = area[t];
    wsum += w; L += luma(r, gg, b) * w; S += sat * w; hx += Math.cos(h * Math.PI * 2) * w * sat; hy += Math.sin(h * Math.PI * 2) * w * sat;
  }
  if (!wsum) return null;
  // draw the mask: the body's triangles in white, a pixel or so wider so the edges of the texture's pieces
  // don't show as thin lines in the old colour (the pixel test in the shader keeps it off the clothes)
  const mc = document.createElement('canvas'); mc.width = mc.height = N;
  const mx = mc.getContext('2d')!;
  mx.fillStyle = '#000'; mx.fillRect(0, 0, N, N);
  mx.fillStyle = mx.strokeStyle = '#fff'; mx.lineWidth = 2; mx.lineJoin = 'round';
  mx.beginPath();
  for (let t = 0; t < tris; t++) {
    if (!inn[t]) continue;
    const a = vid(t, 0), b = vid(t, 1), c = vid(t, 2);
    mx.moveTo(uv.getX(a) * N, uv.getY(a) * N); mx.lineTo(uv.getX(b) * N, uv.getY(b) * N); mx.lineTo(uv.getX(c) * N, uv.getY(c) * N); mx.closePath();
  }
  mx.fill(); mx.stroke();
  const soft = document.createElement('canvas'); soft.width = soft.height = N;
  const sx = soft.getContext('2d')!;
  sx.filter = 'blur(0.8px)'; sx.drawImage(mc, 0, 0);
  const mask = new THREE.CanvasTexture(soft);
  // (no smaller copies: those blur the pieces' edges into lines when the buddy is small on screen)
  mask.flipY = false; mask.colorSpace = THREE.NoColorSpace; mask.generateMipmaps = false; mask.minFilter = THREE.LinearFilter;
  const S0 = S / wsum;
  return { mask, h: ((Math.atan2(hy, hx) / (Math.PI * 2)) + 1) % 1, hw: Math.max(0.06, band.w * 1.2) * (fix.tol ?? 1), s: S0, lum: Math.max(0.04, L / wsum), grey: band.dark || S0 < 0.16 };
}
const PAINT_HEAD = `uniform float uPaint; uniform sampler2D uMask; uniform float uLum; uniform float uSB; uniform float uH0; uniform float uHW; uniform float uGrey;
uniform float uHT; uniform float uST; uniform float uK; uniform float uMode; uniform float uPTime;
vec3 kpHsv(vec3 c) { vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); float e = 1.0e-10; return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x); }
vec3 kpRgb(vec3 c) { vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0); vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www); return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y); }
`;
// The new colour keeps the buddy's own light and shade: each pixel as much lighter or darker than the
// body's middle as it was, its hue moved round by the same amount, and dark markings (stripes, spots,
// lines) and bits in other colours (a nose, a tummy) left as they are.
const PAINT_BODY = `
#ifdef USE_MAP
if (uPaint > 0.5) {
  float m = texture2D(uMask, vMapUv).r;
  if (m > 0.004) {
    vec3 sc = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(1.0 / 2.2));
    vec3 hsv = kpHsv(sc);
    float L = dot(sc, vec3(0.299, 0.587, 0.114));
    float r = L / uLum;
    float dh = fract(hsv.x - uH0 + 0.5) - 0.5;
    // dark markings (stripes, spots, lines) take the new hue but stay just as dark as they were
    float body = smoothstep(0.3, 0.52, r);
    float hw = uHW * mix(3.0, 1.0, body);
    float like = uGrey > 0.5 ? 1.0 - smoothstep(0.24, 0.4, hsv.y)
      : mix(1.0, 1.0 - smoothstep(hw, hw * 2.0, abs(dh)), smoothstep(0.1, 0.25, hsv.y));
    float w = m * like;
    if (w > 0.001) {
      float hue = fract(uHT + (uGrey > 0.5 ? 0.0 : dh * 0.35) + 1.0);
      float sat = clamp(uST * mix(1.0, clamp(hsv.y / max(uSB, 0.05), 0.65, 1.3), uGrey > 0.5 ? 0.0 : 0.5), 0.0, 1.0);
      if (uMode > 1.5 && uMode < 2.5) { hue = fract(uPTime * 0.05 + vMapUv.y * 1.4 + vMapUv.x * 0.7); sat = 0.62; }
      float Ln = mix(L, clamp(uLum * uK * pow(max(r, 0.0), 0.85), 0.0, 1.0), body);
      sat *= mix(0.75, 1.0, body);
      vec3 base = kpRgb(vec3(hue, sat, 1.0));
      vec3 rgb = base * (Ln / max(dot(base, vec3(0.299, 0.587, 0.114)), 0.05));
      float top = max(rgb.r, max(rgb.g, rgb.b));
      if (top > 1.0) rgb = mix(rgb / top, vec3(1.0), clamp((top - 1.0) * 0.4, 0.0, 1.0));
      if (uMode > 0.5 && uMode < 1.5) {
        float sweep = pow(max(0.0, sin(vMapUv.y * 9.0 + vMapUv.x * 4.0 - uPTime * 2.2)), 8.0);
        rgb += vec3(1.0, 0.86, 0.5) * sweep * 0.35;
      }
      if (uMode > 2.5) {
        vec2 g = floor(vMapUv * 240.0);
        float rr = fract(sin(dot(g, vec2(12.9898, 78.233))) * 43758.5453);
        rgb += vec3(1.0, 0.95, 1.0) * step(0.988, rr) * (0.55 + 0.45 * sin(uPTime * 3.0 + rr * 40.0)) * 0.85;
        float n = sin(vMapUv.x * 7.0 + uPTime * 0.3) * sin(vMapUv.y * 6.0 - uPTime * 0.2);
        rgb = mix(rgb, rgb * vec3(0.85, 0.9, 1.35) + vec3(0.06, 0.0, 0.08), 0.3 + 0.3 * n);
      }
      diffuseColor.rgb = mix(diffuseColor.rgb, pow(max(rgb, vec3(0.0)), vec3(2.2)), w);
    }
  }
}
#endif
`;

/** a soft round puff (the sneeze), drawn once */
let puffTex: THREE.CanvasTexture | null = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(245,250,255,.75)'); gr.addColorStop(1, 'rgba(235,245,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return (puffTex = new THREE.CanvasTexture(cv));
}

/** Shared looks: smooth mode (older computers) has no real shadows, so each buddy gets a soft blob under its feet. */
export const charLook = { blob: false };
let blobParts: { geo: THREE.CircleGeometry; mat: THREE.MeshBasicMaterial } | null = null;
function blobMesh() {
  if (!blobParts) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(30,40,20,0.5)'); grad.addColorStop(1, 'rgba(30,40,20,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    blobParts = { geo: new THREE.CircleGeometry(1, 24), mat: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }) };
  }
  const m = new THREE.Mesh(blobParts.geo, blobParts.mat);
  m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.visible = false;
  return m;
}

type Foot = { foot: THREE.Bone; toe: THREE.Bone | null; bindQ: THREE.Quaternion; toeBindLocal: THREE.Quaternion | null; bindY: number };

export class Character {
  readonly id: FriendId;
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly actions: Record<string, THREE.AnimationAction> = {};
  readonly bones: Record<string, THREE.Bone> = {};
  /** metres a second each gait really travels, so feet don't skate */
  speedOf: Record<string, number> = {};
  scale = 1;
  current: THREE.AnimationAction | null = null;
  currentName = '';
  /** flatten planted feet (off while seated on a ride) */
  groundFeet = true;
  private feet: Foot[] = [];
  /** every bone's turn in the bind pose (standing straight), for sitting up straight on rides */
  private bindQ = new Map<THREE.Bone, THREE.Quaternion>();
  private outfit: THREE.Object3D | null = null;
  private blob: THREE.Mesh;
  outfitId = 'none';
  /** worn things that move on their own every frame (gear3d: a cape's sway, bubbles, flames) */
  readonly tickers = new Set<(dt: number) => void>();

  private constructor(id: FriendId, model: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.id = id;
    this.model = model;
    this.root.add(model);
    model.traverse(o => {
      if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o as THREE.Bone;
    });
    for (const b of Object.values(this.bones)) this.bindQ.set(b, b.quaternion.clone());
    // size from the skinned vertices (Meshy's armature is in centimetres, so the plain box is wrong)
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse(o => {
      const s = o as THREE.SkinnedMesh;
      if (s.isSkinnedMesh) { s.skeleton.update(); s.computeBoundingBox(); box.union(s.boundingBox!.clone().applyMatrix4(s.matrixWorld)); }
    });
    this.scale = FRIEND[id].height / box.getSize(new THREE.Vector3()).y;
    this.blob = blobMesh();
    this.blob.scale.setScalar(FRIEND[id].height * 0.32);
    this.root.add(this.blob);
    model.scale.setScalar(this.scale);
    model.position.y = -box.min.y * this.scale;
    model.updateMatrixWorld(true);
    this.mixer = new THREE.AnimationMixer(model);
    this.addClips(clips);
    for (const k of ['walk', 'run', 'sprint']) this.speedOf[k] = this.gaitSpeed(k);
    this.mixer.stopAllAction();
    // measuring the gaits ran the clock on: back to zero, or the first move's fade-in would be scheduled
    // in the future and the buddy would stand in its stiff bind pose until the clock caught up
    this.mixer.setTime(0);
    this.addEyes();
    // feet as they stand in the bind pose (flat on the ground)
    model.updateMatrixWorld(true);
    for (const side of ['Left', 'Right']) {
      const foot = this.bones[`${side}Foot`], toe = this.bones[`${side}ToeBase`] ?? null;
      if (!foot) continue;
      this.feet.push({
        foot, toe,
        bindQ: foot.getWorldQuaternion(new THREE.Quaternion()),
        toeBindLocal: toe ? toe.quaternion.clone() : null,
        bindY: foot.getWorldPosition(new THREE.Vector3()).y,
      });
    }
  }

  /** Glowing eyes for a face hidden in a hood (Scruff): two little lights fixed to the head bone. */
  private addEyes() {
    const e = FRIEND[this.id].eyes, head = this.bones.Head;
    if (!e || !head) return;
    this.model.updateMatrixWorld(true);
    const hp = head.getWorldPosition(new THREE.Vector3());
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshBasicMaterial({ color: e.color, toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: e.color, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
    for (const side of [-1, 1]) {
      // placed in world space in the bind pose (the model faces +z), then kept in the head bone's space
      const w = hp.clone().add(new THREE.Vector3((e.x ?? 0) + side * e.gap / 2, e.up, e.fwd));
      const eye = new THREE.Mesh(geo, mat), halo = new THREE.Mesh(geo, glow);
      const local = head.worldToLocal(w.clone());
      const s = head.getWorldScale(new THREE.Vector3()).x || 1;
      eye.position.copy(local); eye.scale.setScalar(e.size / s); eye.scale.y *= 1.25;
      halo.position.copy(local); halo.scale.setScalar((e.size * 1.9) / s);
      head.add(eye, halo);
    }
  }

  static async create(id: FriendId): Promise<Character | null> {
    const src = await source(id);
    if (!src) return null;
    const model = cloneSkinned(src.scene);
    return new Character(id, model, src.clips);
  }

  private addClips(clips: THREE.AnimationClip[]) {
    for (const clip of clips) {
      const key = MOVE[clip.name] ?? clip.name.replace(/^Armature\|/, '').toLowerCase();
      if (this.actions[key]) continue;
      const a = this.mixer.clipAction(clip);
      if (ONCE.has(key)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[key] = a;
    }
  }

  /** The extra moves (seated pose, dances), loaded once per buddy. */
  async loadMoves() {
    const clips = await moves(this.id);
    // dances and sitting stay in one place: drop any drift of the hips across the ground
    for (const c of clips) for (const tr of c.tracks) {
      if (tr.name.endsWith('Hips.position')) {
        const v = tr.values, first = [v[0], v[2]];
        for (let i = 0; i < v.length; i += 3) { v[i] = first[0]; v[i + 2] = first[1]; }
        // climbing moves the hips up through the cycle; the course does the rising, so take that out
        // (or the buddy drops back down every time the move starts over)
        if (c.name === 'climb') { const n = v.length / 3, y0 = v[1], yN = v[v.length - 2]; for (let k = 0; k < n; k++) v[k * 3 + 1] -= ((yN - y0) * k) / Math.max(1, n - 1); }
      }
    }
    this.addClips(clips);
  }

  // ---------- a new colour (adventure/colours.ts) ----------
  private paint: { u: Record<string, THREE.IUniform>; tick: (dt: number) => void } | null = null;
  private isShadowed = false;
  /** Paint the buddy a new colour (null: its own colour). Only the buddy's own hue changes; the eyes, the
   *  mouth and clothes in other colours stay as they are. Gold, rainbow and galaxy move a little. */
  setColour(c: { hue: number; sat: number; light: number; mode: 'plain' | 'gold' | 'rainbow' | 'galaxy' } | null) {
    if (this.isShadowed) return;
    if (!c) { if (this.paint) this.paint.u.uPaint.value = 0; return; }
    if (!this.paint) {
      const plan = paintPlan(this.id, this.model);
      if (!plan) return;
      const u: Record<string, THREE.IUniform> = {
        uPaint: { value: 1 }, uMask: { value: plan.mask }, uLum: { value: plan.lum }, uSB: { value: plan.s }, uH0: { value: plan.h }, uHW: { value: plan.hw }, uGrey: { value: plan.grey ? 1 : 0 },
        uHT: { value: 0 }, uST: { value: 0 }, uK: { value: 1 }, uMode: { value: 0 }, uPTime: { value: 0 },
      };
      this.model.traverse(o => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || m.userData.kpEdge) return;
        const one = (mat: THREE.Material) => {
          const cl = mat.clone(), prev = mat.onBeforeCompile;
          cl.onBeforeCompile = (sh, r) => {
            prev.call(mat, sh, r);
            Object.assign(sh.uniforms, u);
            sh.fragmentShader = PAINT_HEAD + sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' + PAINT_BODY);
          };
          cl.customProgramCacheKey = () => 'kp-paint';
          return cl;
        };
        m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
      });
      const tick = (dt: number) => { (u.uPTime.value as number) += dt; };
      this.tickers.add(tick);
      this.paint = { u, tick };
    }
    const u = this.paint.u, lum = u.uLum.value as number;
    // how light the new colour is, against how light the buddy is
    const [r, g, b] = hsvToRgb(c.hue, c.sat, Math.min(1, 0.78 * c.light));
    u.uPaint.value = 1; u.uHT.value = c.hue; u.uST.value = c.sat;
    u.uK.value = Math.max(0.3, Math.min(2.6, luma(r, g, b) / lum));
    u.uMode.value = c.mode === 'gold' ? 1 : c.mode === 'rainbow' ? 2 : c.mode === 'galaxy' ? 3 : 0;
  }

  /** The colour the buddy is painted (hue and colourfulness, 0..1), or null when it's in its own colour. */
  paintTone(): { hue: number; sat: number } | null {
    const u = this.paint?.u;
    return u && (u.uPaint.value as number) > 0.5 ? { hue: u.uHT.value as number, sat: u.uST.value as number } : null;
  }

  /** Shown in shadowy black and white (a buddy who hasn't joined the team yet). */
  shadowed() {
    this.isShadowed = true;
    this.model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.userData.kpEdge) return;
      const one = (mat: THREE.Material) => {
        const c = mat.clone();
        c.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float grey = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
            gl_FragColor.rgb = mix(vec3(0.16, 0.17, 0.22), vec3(0.62, 0.64, 0.7), smoothstep(0.0, 0.9, grey));`);
        };
        c.customProgramCacheKey = () => 'shadowed';
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
    });
  }

  has(name: string) { return !!this.actions[name]; }

  play(name: string, fade = 0.3, timeScale = 1) {
    const a = this.actions[name];
    if (!a) return null;
    if (this.current === a) { a.timeScale = timeScale; return a; }
    a.reset().setEffectiveTimeScale(timeScale).setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = a;
    this.currentName = name;
    return a;
  }

  /** Sit up straight: hips, back, neck and head back to their bind-pose turn (the sitting move slouches). */
  uprightSpine(amount = 1) {
    for (const n of ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head']) {
      const b = this.bones[n], q = b && this.bindQ.get(b);
      if (b && q) b.quaternion.slerp(q, amount);
    }
    this.model.updateMatrixWorld(true);
  }

  /** True once a play-once move has reached its end. */
  finished(name: string) {
    const a = this.actions[name];
    return !!a && this.current === a && a.time >= a.getClip().duration - 0.02;
  }

  /** How fast a gait carries the body: the speed a planted toe slides backward under the hips. */
  private gaitSpeed(name: string) {
    const a = this.actions[name], toe = this.bones.LeftToeBase ?? this.bones.LeftFoot, hips = this.bones.Hips;
    if (!a || !toe || !hips) return 2;
    this.mixer.stopAllAction();
    a.reset().play();
    const dur = a.getClip().duration, n = 120, rel: number[] = [], low: number[] = [];
    const tp = new THREE.Vector3(), hp = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      this.mixer.setTime((i / n) * dur);
      this.model.updateMatrixWorld(true);
      toe.getWorldPosition(tp); hips.getWorldPosition(hp);
      rel.push(tp.z - hp.z); low.push(tp.y);
    }
    a.stop();
    const ymin = Math.min(...low), ymax = Math.max(...low), back: number[] = [];
    for (let i = 1; i <= n; i++) if (low[i] <= ymin + (ymax - ymin) * 0.2) back.push(-(rel[i] - rel[i - 1]) / (dur / n));
    back.sort((x, y) => x - y);
    const v = back.length ? back[Math.floor(back.length / 2)] : 0;
    return Math.max(0.5, name === 'sprint' ? v * 0.8 : v);
  }

  private q = new THREE.Quaternion(); private q2 = new THREE.Quaternion(); private rootQ = new THREE.Quaternion(); private v = new THREE.Vector3();

  // ---------- a tickle and a sneeze: the body's own bones, on top of whatever move is playing ----------
  private act: { kind: 'tickle' | 'sneeze'; t: number; len: number; puffed?: boolean } | null = null;
  /** bones turned for the tickle or sneeze last frame, with their turn before that (put back first) */
  private posed: [THREE.Bone, THREE.Quaternion][] = [];
  private lift = 0;
  /** Squirm and giggle: shoulders up, a wiggle from side to side through the back, arms pulled in, the
   *  head shaking, two little hops. Returns how long it takes (seconds). */
  tickle(): number { this.act = { kind: 'tickle', t: 0, len: 1.6 }; return 1.6; }
  /** "Ah... ah... ACHOO!": the head and chest tip back with two breaths in, then snap forward with a jolt
   *  through the body and a little puff (timed to sfx.sneeze: the snap comes at 0.95 s). */
  sneeze(): number { this.act = { kind: 'sneeze', t: 0, len: 2.2 }; return 2.2; }
  /** a tickle or a sneeze is playing */
  get acting() { return !!this.act; }
  private _pq = new THREE.Quaternion(); private _wq = new THREE.Quaternion(); private _rq = new THREE.Quaternion(); private _ax = new THREE.Vector3();
  /** Turn a bone through its joint about one of the buddy's own directions (x: to its left, y: up, z:
   *  forward), on top of its pose this frame. Parents go first. */
  private turnBone(name: string, axis: 'x' | 'y' | 'z', angle: number) {
    const b = this.bones[name];
    if (!b || !b.parent || Math.abs(angle) < 1e-4) return;
    if (!this.posed.some(([x]) => x === b)) this.posed.push([b, b.quaternion.clone()]);
    const parentQ = b.parent.getWorldQuaternion(this._pq);
    this._ax.set(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0).applyQuaternion(this.root.getWorldQuaternion(this._rq));
    // the turn in the world, carried into the bone's own space: parent⁻¹ · turn · parent
    const w = this._wq.setFromAxisAngle(this._ax, angle);
    b.quaternion.premultiply(parentQ.clone().invert().multiply(w).multiply(parentQ));
    b.updateMatrixWorld(true);
  }
  private unpose() {
    for (const [b, q] of this.posed) b.quaternion.copy(q);
    this.posed.length = 0;
    if (this.lift) { this.model.position.y -= this.lift; this.lift = 0; }
  }
  private pose(dt: number) {
    const a = this.act!;
    a.t += dt;
    if (a.t >= a.len) { this.act = null; return; }
    const t = a.t, k = t / a.len, H = FRIEND[this.id].height;
    const ss = THREE.MathUtils.smoothstep, bump = (x: number, a0: number, a1: number) => (x < a0 || x > a1 ? 0 : Math.sin(((x - a0) / (a1 - a0)) * Math.PI));
    this.model.updateMatrixWorld(true);
    const T: [string, 'x' | 'y' | 'z', number][] = [];
    let lift = 0;
    if (a.kind === 'tickle') {
      const env = ss(k, 0, 0.14) * (1 - ss(k, 0.78, 1));
      const w = Math.sin(t * Math.PI * 2 * 3.4), w2 = Math.sin(t * Math.PI * 2 * 3.4 + 1.3), shake = Math.sin(t * Math.PI * 2 * 4.6);
      T.push(
        ['Spine', 'y', 0.12 * w * env], ['Spine', 'z', 0.06 * w2 * env],
        ['Spine01', 'y', 0.16 * w * env], ['Spine01', 'x', 0.1 * env],
        ['Spine02', 'y', 0.12 * w * env], ['Spine02', 'x', 0.1 * env], ['Spine02', 'z', 0.05 * w2 * env],
        // shoulders up round the ears, arms pulled in with the hands up in front
        ['LeftShoulder', 'z', (0.32 + 0.05 * w) * env], ['RightShoulder', 'z', -(0.32 + 0.05 * w) * env],
        ['LeftArm', 'z', -0.25 * env], ['LeftArm', 'x', -0.35 * env], ['RightArm', 'z', 0.25 * env], ['RightArm', 'x', -0.35 * env],
        ['LeftForeArm', 'x', -0.9 * env], ['RightForeArm', 'x', -0.9 * env],
        // the head shakes and tips back a little, laughing
        ['neck', 'y', 0.18 * shake * env], ['neck', 'x', -0.08 * env],
        ['Head', 'y', 0.22 * shake * env], ['Head', 'z', 0.12 * Math.sin(t * Math.PI * 2 * 2.3) * env], ['Head', 'x', -0.1 * env],
      );
      lift = (bump(k, 0.08, 0.36) * 0.07 + bump(k, 0.46, 0.68) * 0.04) * H;
    } else {
      // two breaths in (the head and chest tip back a step each), a held moment, the snap forward, then
      // back to standing with a little shake of the head
      const back = 0.5 * ss(t, 0, 0.38) + 0.5 * ss(t, 0.42, 0.82) + 0.03 * Math.sin(t * 40) * ss(t, 0.78, 0.94);
      const snap = ss(t, 0.93, 1.03), rel = 1 - ss(t, 1.25, 2.05), fwd = snap * rel, bk = back * (1 - snap);
      T.push(
        ['Spine01', 'x', -0.08 * bk + 0.18 * fwd], ['Spine02', 'x', -0.12 * bk + 0.22 * fwd],
        ['LeftShoulder', 'z', 0.2 * bk], ['RightShoulder', 'z', -0.2 * bk],
        ['LeftArm', 'z', 0.08 * bk], ['RightArm', 'z', -0.08 * bk], ['LeftArm', 'x', -0.28 * fwd], ['RightArm', 'x', -0.28 * fwd],
        ['LeftForeArm', 'x', -0.35 * fwd], ['RightForeArm', 'x', -0.35 * fwd],
        ['neck', 'x', -0.15 * bk + 0.25 * fwd], ['Head', 'x', -0.24 * bk + 0.36 * fwd],
        ['Head', 'y', 0.16 * Math.sin(t * Math.PI * 2 * 5) * bump(t, 1.45, 2.05)],
      );
      // the jolt: a quick dip through the knees as it snaps
      lift = -0.035 * H * bump(t, 0.95, 1.25);
      if (!a.puffed && t >= 0.97) { a.puffed = true; this.puff(); }
    }
    for (const [n, ax, ang] of T) this.turnBone(n, ax, ang);
    if (lift) { this.model.position.y += lift; this.lift = lift; }
  }
  /** The sneeze's little puff: soft white clouds bursting out in front of the face and fading. */
  private puff() {
    const head = this.bones.Head;
    if (!head) return;
    const H = FRIEND[this.id].height;
    this.root.updateMatrixWorld(true);
    const at = this.root.worldToLocal(head.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, H * 0.02, H * 0.22));
    const map = puffTexture();
    const bits = Array.from({ length: 6 }, (_, i) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0.9 }));
      sp.position.copy(at);
      this.root.add(sp);
      const a = (i / 6) * Math.PI * 2;
      return { sp, v: new THREE.Vector3(Math.cos(a) * 0.35, Math.sin(a) * 0.25 + 0.05, 0.9 + Math.random() * 0.3).multiplyScalar(H) };
    });
    let age = 0;
    const tick = (dt: number) => {
      age += dt;
      const k = age / 0.7;
      for (const b of bits) {
        b.sp.position.addScaledVector(b.v, dt * (1 - k * 0.8));
        b.sp.scale.setScalar(H * (0.08 + 0.16 * Math.min(1, k * 1.6)));
        b.sp.material.opacity = 0.9 * (1 - Math.max(0, k - 0.35) / 0.65);
      }
      if (k >= 1) { for (const b of bits) { b.sp.removeFromParent(); b.sp.material.dispose(); } this.tickers.delete(tick); }
    };
    this.tickers.add(tick);
  }

  /** Advance the moves, then lay planted feet flat (turned only about the up axis, as in the bind pose). */
  update(dt: number) {
    // last frame's tickle or sneeze comes off before the moves set this frame's pose, then goes on again
    if (this.posed.length || this.lift) this.unpose();
    this.mixer.update(dt);
    if (this.act) this.pose(dt);
    for (const f of this.tickers) f(dt);
    // the blob only on the ground (seated on a ride, the ride is underneath)
    this.blob.visible = charLook.blob && this.groundFeet;
    if (!this.groundFeet || !this.feet.length) return;
    this.root.updateMatrixWorld(true);
    this.root.getWorldQuaternion(this.rootQ);
    const rootY = this.root.getWorldPosition(this.v).y;
    for (const f of this.feet) {
      const y = f.foot.getWorldPosition(this.v).y - rootY;
      const w = 1 - THREE.MathUtils.smoothstep(y, f.bindY + 0.02, f.bindY + 0.09);
      if (w <= 0.01) continue;
      // the foot's turn since the bind pose, keeping only its twist about the world's up axis
      const cur = f.foot.getWorldQuaternion(this.q);
      const bind = this.q2.copy(this.rootQ).multiply(f.bindQ);
      const d = cur.clone().multiply(bind.clone().invert());
      const twist = new THREE.Quaternion(0, d.y, 0, d.w).normalize();
      const want = twist.multiply(bind);
      cur.slerp(want, w);
      const parentQ = f.foot.parent!.getWorldQuaternion(new THREE.Quaternion());
      f.foot.quaternion.copy(parentQ.invert().multiply(cur));
      if (f.toe && f.toeBindLocal) f.toe.quaternion.slerp(f.toeBindLocal, w);
      f.foot.updateMatrixWorld(true);
    }
  }

  // ---------- outfits: hats and things worn on the head ----------
  private headFit: { top: THREE.Vector3; width: number; basis: THREE.Quaternion } | null = null;
  /**
   * Where the top of the head is, in the Head bone's own space, from the vertices the head moves, and
   * which way is up and forward there (the bone's axes aren't the world's).
   */
  private fitHead() {
    if (this.headFit) return this.headFit;
    const head = this.bones.Head;
    let mesh: THREE.SkinnedMesh | null = null;
    this.model.traverse(o => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = o as THREE.SkinnedMesh; });
    if (!head || !mesh) return null;
    const m = mesh as THREE.SkinnedMesh;
    const hi = m.skeleton.bones.indexOf(head);
    const pos = m.geometry.attributes.position, si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight;
    // everything in the head bone's own space as it was when the skin was bound: bone space doesn't
    // change as the head moves, so a hat placed there rides along
    const toBone = m.skeleton.boneInverses[hi];
    const hq = new THREE.Quaternion();
    toBone.decompose(new THREE.Vector3(), hq, new THREE.Vector3());
    // world up and forward (the model faces +z), seen from inside the head bone
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(hq).normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(hq).normalize();
    const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
    const p = new THREE.Vector3();
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === hi) w += sw.getComponent(i, k);
      if (w < 0.7) continue;
      p.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix).applyMatrix4(toBone);
      pts.push(p.clone());
    }
    if (pts.length < 20) return null;
    const c = pts.reduce((a, q) => a.add(q), new THREE.Vector3()).divideScalar(pts.length);
    const across = (q: THREE.Vector3) => { const d = q.clone().sub(c); return Math.hypot(d.dot(side), d.dot(fwd)); };
    const widthSide = Math.max(...pts.map(q => q.clone().sub(c).dot(side))) - Math.min(...pts.map(q => q.clone().sub(c).dot(side)));
    const widthFwd = Math.max(...pts.map(q => q.clone().sub(c).dot(fwd))) - Math.min(...pts.map(q => q.clone().sub(c).dot(fwd)));
    // the crown: the highest head points near the middle (ears and spikes stick out to the sides)
    const core = pts.filter(q => across(q) < Math.min(widthSide, widthFwd) * 0.25);
    let topH = Math.max(...(core.length ? core : pts).map(q => q.clone().sub(c).dot(up)));
    if (FRIEND[this.id].hatOn === 'flat') {
      // a flat-topped head with things sticking up (feathers): the top is the highest level where
      // the head is still nearly full width
      const hs = pts.map(q => q.clone().sub(c).dot(up)), lo = Math.min(...hs), hi = Math.max(...hs), N = 40;
      const bins = Array.from({ length: N }, () => [Infinity, -Infinity]);
      pts.forEach((q, i) => { const b = Math.min(N - 1, Math.floor(((hs[i] - lo) / (hi - lo)) * N)), x = q.clone().sub(c).dot(side); bins[b][0] = Math.min(bins[b][0], x); bins[b][1] = Math.max(bins[b][1], x); });
      const widths = bins.map(([a, b]) => (b > a ? b - a : 0)), full = Math.max(...widths);
      for (let b = N - 1; b >= 0; b--) if (widths[b] >= full * 0.6) { topH = lo + ((b + 1) / N) * (hi - lo); break; }
    }
    const top = c.clone().addScaledVector(up, topH + (FRIEND[this.id].hatLift ?? 0) / Math.max(1e-6, this.scale));
    const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, fwd));
    this.headFit = { top, width: Math.min(widthSide, widthFwd * 1.1), basis };
    return this.headFit;
  }

  /** the Wardrobe's Move it nudge for the hat (shares of the buddy's height, a size, a turn) */
  private hatN: { x: number; y: number; z: number; s: number; r: number; p?: number; t?: number } | null = null;
  /** Move, size, turn, tip and tilt the hat about where it sits on the head (null: back to its own place). */
  nudgeHat(n: { x: number; y: number; z: number; s: number; r: number; p?: number; t?: number } | null) {
    this.hatN = n;
    const fit = this.headFit, h = this.outfit;
    if (!fit || !h) return;
    // the nudge is in the buddy's own directions (x to its left, y up, z forward); the hat's holder sits in
    // the head bone's space, so turn the offset into it, in that space's own units (metres over the head
    // bone's world scale: the rigs' armatures are scaled, so the model's scale alone made moves ~100x too small)
    const head = this.bones.Head, ws = head ? head.getWorldScale(new THREE.Vector3()).x / Math.max(1e-6, this.root.getWorldScale(new THREE.Vector3()).x) : this.scale;
    const u = FRIEND[this.id].height / Math.max(1e-9, ws), q = fit.basis;
    const off = new THREE.Vector3(n?.x ?? 0, n?.y ?? 0, n?.z ?? 0).multiplyScalar(u).applyQuaternion(q);
    h.position.copy(fit.top).add(off);
    h.quaternion.copy(q).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(n?.p ?? 0, n?.r ?? 0, n?.t ?? 0, 'YXZ')));
    h.scale.setScalar(n?.s ?? 1);
  }

  /** The hat's holder (the Wardrobe taps it to move it), or null without a hat. */
  hatHolder(): THREE.Object3D | null { return this.outfit; }

  /** Put an outfit on the head; `make` builds a fresh copy of the outfit's model. */
  async wear(id: string, make: (id: string) => Promise<THREE.Object3D | null>) {
    if (id === this.outfitId) return;
    this.outfitId = id;
    if (this.outfit) { this.outfit.removeFromParent(); this.outfit = null; }
    if (id === 'none') return;
    const fit = this.fitHead(), head = this.bones.Head;
    const obj = await make(id);
    if (!obj || !fit || !head || this.outfitId !== id) return;
    const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3());
    const s = (fit.width * (obj.userData.fit ?? 0.8)) / Math.max(size.x, size.z);
    obj.scale.multiplyScalar(s);
    obj.position.set(-(box.min.x + size.x / 2) * s, -box.min.y * s - size.y * s * (obj.userData.sink ?? 0.18), -(box.min.z + size.z / 2) * s);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.copy(fit.top);
    holder.quaternion.copy(fit.basis);
    holder.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = false; } });
    holder.userData.wear = { slot: 'head', id };
    head.add(holder);
    this.outfit = holder;
    if (this.hatN) this.nudgeHat(this.hatN);
  }

  dispose() { this.mixer.stopAllAction(); this.root.removeFromParent(); }
}
