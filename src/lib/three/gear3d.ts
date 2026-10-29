// Gear in 3D: what a buddy holds, wears on the back and on its feet. Everything is painted: the cape,
// wings, kite, wand and the rocket pack use the item pictures themselves (so the 3D piece looks like
// its card), the shoes and springs use painted tiles. Pieces are fitted to each buddy from its own
// body: the back from the vertices the spine moves, shoe shells from the feet's own triangles, the
// hand from the vertices the right hand moves. Things that move (the cape's sway, flapping wings,
// bubbles, music notes, flames) run from the buddy's own update.
import * as THREE from 'three';
import type { Character } from './character';
import { loadTexture } from './assets';
import { stage } from './stage';
import { FRIEND } from '../art/cast';
import type { Slot } from '../adventure/gear';

type Worn = { id: string; objs: THREE.Object3D[]; tick?: (dt: number, t: number) => void };
type Rig = { worn: Partial<Record<Slot, Worn>>; t: number; tick: (dt: number) => void; want: Partial<Record<Slot, string | null>> };
const rigs = new WeakMap<Character, Rig>();

// ---------- measuring the buddy (in the model's bind space: it faces +z, up is +y) ----------
type Pts = THREE.Vector3[];
type Fit = {
  /** bind units in a metre (the model is scaled down to its height) */
  unit: number; minY: number; H: number;
  back: { cx: number; top: number; z: number; w: number } | null;
  feet: { side: 'Left' | 'Right'; geo: THREE.BufferGeometry | null; cx: number; sole: number; heel: number; toe: number; w: number }[];
  hand: THREE.Vector3 | null;
};
const fits = new WeakMap<Character, Fit>();

function skinned(c: Character): THREE.SkinnedMesh[] {
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
function points(c: Character, names: string[], min = 0.5): Pts {
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

function fitOf(c: Character): Fit {
  let f = fits.get(c);
  if (f) return f;
  let minY = Infinity, maxY = -Infinity;
  for (const p of points(c, Object.keys(c.bones), 0)) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
  const H = maxY - minY;
  const unit = 1 / c.scale;
  // the back: the upper spine's vertices
  const torso = points(c, ['Spine01', 'Spine02']);
  let back: Fit['back'] = null;
  if (torso.length > 20) {
    // the shoulder line: where the upper arms join (the spine's own vertices stop lower on some buddies)
    const arms = points(c, ['LeftArm', 'RightArm'], 0.6);
    const top = arms.length > 10 ? pct(arms.map(p => p.y), 0.5) : pct(torso.map(p => p.y), 0.96);
    const near = points(c, ['Spine01', 'Spine02', 'neck'], 0.3).filter(p => p.y > top - H * 0.22 && p.y < top + H * 0.04);
    back = { cx: pct(torso.map(p => p.x), 0.5), top, z: pct((near.length > 10 ? near : torso).map(p => p.z), 0.02), w: pct(torso.map(p => p.x), 0.95) - pct(torso.map(p => p.x), 0.05) };
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
  f = { unit, minY, H, back, feet, hand };
  fits.set(c, f);
  return f;
}
/** A group that rides on a bone but whose children are placed in bind space. */
function onBone(c: Character, name: string): THREE.Group | null {
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
async function painted(path: string, opts: { repeat?: boolean; cut?: boolean; side?: THREE.Side } = {}) {
  const map = await loadTexture(path, { repeat: opts.repeat });
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.6, metalness: 0, side: opts.side ?? THREE.FrontSide });
  if (opts.cut) { mat.alphaTest = 0.45; mat.side = THREE.DoubleSide; }
  return mat;
}
async function spriteOf(path: string, blend: THREE.Blending = THREE.NormalBlending) {
  const map = await loadTexture(path);
  return new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: blend }));
}
function shadows(o: THREE.Object3D) { o.traverse(x => { if ((x as THREE.Mesh).isMesh) { x.castShadow = true; x.receiveShadow = false; x.frustumCulled = false; } }); }

/** The rocket picture's outline, top (0) to the nozzle's rim (1): radius as a share of the picture's width. */
const ROCKET: [number, number][] = [[0, 0.0], [0.05, 0.1], [0.12, 0.25], [0.2, 0.36], [0.3, 0.43], [0.4, 0.45], [0.55, 0.44], [0.7, 0.4], [0.78, 0.37], [0.85, 0.3], [0.93, 0.33], [1, 0.36]];
const ROCKET_ASPECT = 295 / 610;
/** A lathe body painted by projecting a front-on picture onto it (the picture's x across, y down). */
function latheFromPicture(height: number, prof: [number, number][], aspect: number, segs = 20): THREE.BufferGeometry {
  const w = height * aspect;
  const pts = prof.slice().reverse().map(([t, r]) => new THREE.Vector2(Math.max(0.0005, r * w), (0.5 - t) * height));
  const g = new THREE.LatheGeometry(pts, segs);
  const P = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < P.count; i++) uv.setXY(i, 0.5 + P.getX(i) / w, 0.5 + P.getY(i) / height);
  return g;
}

// ---------- the pieces ----------
type Built = { objs: THREE.Object3D[]; tick?: (dt: number, t: number) => void };

async function cape(c: Character, f: Fit): Promise<Built | null> {
  const b = f.back, g = b && onBone(c, 'Spine02');
  if (!b || !g) return null;
  const mat = await painted('gear/tex-cape.webp', { cut: true });
  const W = Math.max(b.w * 2.1, f.H * 0.42), L = Math.max(f.H * 0.4, b.top - (f.minY + f.H * 0.22)), y0 = b.top + f.H * 0.01, z0 = b.z - f.H * 0.02;
  const geo = new THREE.PlaneGeometry(1, 1, 10, 14);
  const P = geo.attributes.position as THREE.BufferAttribute, uvs = geo.attributes.uv as THREE.BufferAttribute;
  const shape = (u: number, v: number, sway: number, x: THREE.Vector3) => {
    const bulge = (1 - (2 * u - 1) ** 2) * f.H * 0.05 * (0.35 + v);
    // seen from behind, +x is on the left: the picture's left edge goes to +x so it reads the right way round
    x.set(b.cx - (u - 0.5) * W * (0.78 + 0.22 * v), y0 - v * L, z0 - bulge - v * v * sway);
  };
  const tmp = new THREE.Vector3();
  const place = (t: number) => {
    for (let i = 0; i < P.count; i++) {
      const u = uvs.getX(i), v = 1 - uvs.getY(i);
      const sway = f.H * (0.05 + 0.03 * Math.sin(t * 2.2 + u * 3.2));
      shape(u, v, sway, tmp);
      P.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    P.needsUpdate = true; geo.computeVertexNormals();
  };
  place(0);
  const mesh = new THREE.Mesh(geo, mat);
  g.add(mesh); shadows(mesh);
  let acc = 0;
  return { objs: [g], tick: (dt, t) => { acc += dt; if (acc > 1 / 30) { acc = 0; place(t); } } };
}

async function wings(c: Character, f: Fit): Promise<Built | null> {
  const b = f.back, g = b && onBone(c, 'Spine02');
  if (!b || !g) return null;
  const map = await loadTexture('gear/tex-wing.webp');
  if (!map) return null;
  const mat = new THREE.MeshBasicMaterial({ map, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide, depthWrite: false });
  const h = f.H * 0.46, w = h * (321 / 512);
  const hinge = new THREE.Vector3(b.cx, b.top - f.H * 0.09, b.z - f.H * 0.015);
  const make = (dir: 1 | -1) => {
    const geo = new THREE.PlaneGeometry(w, h);
    // the picture is the right wing seen from behind: it spreads away from the hinge
    geo.translate(w / 2, 0, 0);
    const piv = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 2;
    if (dir === -1) m.scale.x = -1; // the buddy's right side is -x
    m.rotation.y = Math.PI; // face backwards
    piv.add(m); piv.position.copy(hinge);
    g.add(piv);
    return piv;
  };
  const right = make(-1), left = make(1);
  return {
    objs: [g],
    tick: (_dt, t) => {
      const flap = 0.5 + 0.32 * Math.sin(t * 6.5);
      left.rotation.y = -flap; right.rotation.y = flap;
      left.rotation.z = right.rotation.z = Math.sin(t * 6.5 + 1) * 0.04;
    },
  };
}

async function rocketPack(c: Character, f: Fit): Promise<Built | null> {
  const b = f.back, g = b && onBone(c, 'Spine02');
  if (!b || !g) return null;
  const [body, fin, flameMap, pack] = await Promise.all([painted('gear/tex-rocket.webp'), painted('gear/tex-fin.webp', { cut: true }), loadTexture('gear/tex-flame.webp'), painted('gear/tex-pack.webp', { cut: true })]);
  const h = f.H * 0.38, rw = h * ROCKET_ASPECT;
  const geo = latheFromPicture(h, ROCKET, ROCKET_ASPECT);
  const flames: THREE.Sprite[] = [];
  const cy = b.top - f.H * 0.16, gap = Math.max(b.w * 0.36, rw * 0.62);
  for (const s of [-1, 1]) {
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
    r.position.set(b.cx + s * gap, cy, b.z - rw * 0.42);
    r.rotation.x = -0.08;
    g.add(r);
  }
  const pg = new THREE.PlaneGeometry(gap * 1.25, gap * 1.25 * (256 / 187));
  const pm = new THREE.Mesh(pg, pack); pm.position.set(b.cx, cy + h * 0.06, b.z - f.H * 0.012); pm.rotation.y = Math.PI;
  g.add(pm);
  shadows(g);
  return {
    objs: [g],
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
const hw = (c: Character) => FRIEND[c.id].height;

async function bubbleWand(c: Character, f: Fit): Promise<Built | null> {
  const hand = handTracker(c, f);
  if (!hand) return null;
  const s = hw(c), wand = await spriteOf('gear/tex-wand.webp');
  const wh = s * 0.24;
  wand.scale.set(wh * (185 / 384), wh, 1);
  wand.center.set(0.5, 0.08);
  c.root.add(wand);
  const bubbleMap = await loadTexture('math/bubble.webp');
  const bubbles: { s: THREE.Sprite; age: number; life: number; v: THREE.Vector3; size: number }[] = [];
  let next = 0.4;
  return {
    objs: [hand.g, wand],
    tick: (dt, t) => {
      const p = hand.at();
      wand.position.copy(p).add(new THREE.Vector3(0, -s * 0.02, s * 0.03));
      (wand.material as THREE.SpriteMaterial).rotation = 0.18 + Math.sin(t * 1.7) * 0.08;
      next -= dt;
      if (next < 0 && bubbles.length < 7) {
        next = 0.7 + Math.random() * 0.6;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleMap, transparent: true, depthWrite: false }));
        const size = s * (0.05 + Math.random() * 0.05);
        sp.position.copy(p).add(new THREE.Vector3(-s * 0.03, wh * 0.85, s * 0.04));
        c.root.add(sp);
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

async function kite(c: Character, f: Fit): Promise<Built | null> {
  const hand = handTracker(c, f);
  if (!hand) return null;
  const s = hw(c), k = await spriteOf('gear/tex-kite.webp');
  const kh = s * 0.55;
  k.scale.set(kh * (335 / 512), kh, 1);
  c.root.add(k);
  const N = 14, pts = new Float32Array(N * 3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xfff4e0, transparent: true, opacity: 0.9 }));
  line.frustumCulled = false;
  c.root.add(line);
  const a = new THREE.Vector3(), e = new THREE.Vector3(), m = new THREE.Vector3();
  return {
    objs: [hand.g, k, line],
    tick: (_dt, t) => {
      a.copy(hand.at());
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

async function boombox(c: Character, f: Fit): Promise<Built | null> {
  const hand = handTracker(c, f);
  if (!hand) return null;
  const s = hw(c);
  const [front, teal] = await Promise.all([painted('gear/tex-boombox.webp'), painted('gear/tex-teal.webp')]);
  const bw = s * 0.32, bh = bw * (456 / 768), bd = s * 0.1;
  const box = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), [teal, teal, teal, teal, front, front]);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(bw * 0.3, s * 0.014, 8, 18, Math.PI), teal);
  handle.position.y = bh / 2;
  box.add(body, handle);
  shadows(box);
  c.root.add(box);
  const notes = await Promise.all([0, 1, 2].map(i => loadTexture(`gear/tex-note${i}.webp`)));
  const flying: { s: THREE.Sprite; age: number; dx: number }[] = [];
  let next = 0.3, which = 0;
  const cam = new THREE.Vector3();
  return {
    objs: [hand.g, box],
    tick: (dt, t) => {
      const p = hand.at();
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
        c.root.add(sp);
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

async function shoes(c: Character, f: Fit, id: string): Promise<Built | null> {
  if (!f.feet.length) return null;
  const tile = id === 'rocket_sneakers' ? 'tile-sneaker_rocket' : id === 'spring_shoes' ? 'tile-sneaker_spring' : 'tile-cloud';
  const [shell, chrome, rocket, flameMap, puffA, puffB] = await Promise.all([
    painted(`gear/${tile}.webp`, { repeat: true }), painted('gear/tile-chrome.webp', { repeat: true }), painted('gear/tex-rocket.webp'),
    loadTexture('gear/tex-flame.webp'), loadTexture('game/storm1.webp'), loadTexture('game/storm2.webp'),
  ]);
  if (id === 'cloud_slippers') { shell.roughness = 0.9; shell.emissive = new THREE.Color(0x2a3550); }
  const s = hw(c) * f.unit, objs: THREE.Object3D[] = [], ticks: ((dt: number, t: number) => void)[] = [];
  for (const ft of f.feet) {
    const g = onBone(c, `${ft.side}Foot`);
    if (!g) continue;
    objs.push(g);
    if (ft.geo) { const m = new THREE.Mesh(ft.geo, shell); g.add(m); }
    const outer = ft.side === 'Left' ? 1 : -1;
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

const BUILD: Record<string, (c: Character, f: Fit, id: string) => Promise<Built | null>> = {
  hero_cape: cape, fairy_wings: wings, rocket_pack: rocketPack,
  bubble_wand: bubbleWand, sky_kite: kite, boombox,
  spring_shoes: shoes, cloud_slippers: shoes, rocket_sneakers: shoes,
};

function rigOf(c: Character): Rig {
  let r = rigs.get(c);
  if (r) return r;
  const rig: Rig = { worn: {}, t: Math.random() * 10, want: {}, tick: (dt: number) => {
    rig.t += dt;
    for (const w of Object.values(rig.worn)) w?.tick?.(dt, rig.t);
  } };
  c.tickers.add(rig.tick);
  rigs.set(c, rig);
  return rig;
}
function takeOff(w: Worn) {
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

/** Put a piece of gear on a slot (null takes it off). Safe to call again while one is still loading. */
export async function wearGear(c: Character, slot: Slot, id: string | null) {
  const rig = rigOf(c);
  if ((rig.worn[slot]?.id ?? null) === id && rig.want[slot] === undefined) return;
  rig.want[slot] = id;
  const old = rig.worn[slot];
  if (old) { takeOff(old); delete rig.worn[slot]; }
  if (!id || !BUILD[id]) { delete rig.want[slot]; return; }
  const built = await BUILD[id](c, fitOf(c), id).catch(() => null);
  if (rig.want[slot] !== id) { if (built) takeOff({ id, ...built }); return; }
  delete rig.want[slot];
  if (built) rig.worn[slot] = { id, ...built };
}
/** Wear a whole set of pieces (missing slots are taken off). */
export async function wearKit(c: Character, kit: Partial<Record<Slot, string>>) {
  await Promise.all((['hand', 'back', 'shoes'] as Slot[]).map(s => wearGear(c, s, kit[s] ?? null)));
}
