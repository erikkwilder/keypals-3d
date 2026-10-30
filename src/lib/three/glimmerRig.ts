// A Glimmer's skeleton, made in code when its model loads. The models are single meshes with no bones
// (image-to-3D), so each one gets a small skeleton from its body plan and a few landmarks (the middle of
// its head, its feet, the tip of its tail...), and every vertex of the mesh is tied to the bones near it
// (smooth weights by distance along each bone, normalised, softened where two bones meet so joints bend
// without creases). The result is a THREE.SkinnedMesh that glimmerMotion.ts poses: skinning runs on the
// GPU and a Glimmer has 10 to 24 bones.
//
// A NEW GLIMMER (the 70 coming), once its model is in public/models/glimmers/<id>.glb and has a meta.json
// entry (height, head...):
//   1. Run `node scripts/glimmers/rig-tool.mjs` and open the address it prints with ?id=<id>.
//   2. Pick its body plan (four legs, two legs, flyer, swimmer, jelly, long, blob). Its landmarks are
//      guessed from the mesh straight away: dots on the model, the skeleton as lines and each bone's part
//      tinted (Weights).
//   3. If a dot is off, click its name in the list, then click the model where it should be (the click
//      lands in the middle of the body part under the pointer, not on its skin). Try the moves (Idle,
//      Walk, Happy, Attack...) to see it bend.
//   4. Save: it writes the "rig" entry into meta.json. That's all; the game picks it up.
// A Glimmer with no "rig" entry keeps the old wiggle (a vertex program that nods, wags and flaps).
//
// Landmarks are in the model file's metres (y up, facing +z, standing on y = 0): the same space as the
// meta.json head, tail, wings and ears. Paired ones list the -x side first.
import * as THREE from 'three';

export type Plan = 'quad' | 'biped' | 'flyer' | 'swimmer' | 'jelly' | 'serpent' | 'blob';
export const PLANS: Plan[] = ['quad', 'biped', 'flyer', 'swimmer', 'jelly', 'serpent', 'blob'];
export const PLAN_NAME: Record<Plan, string> = { quad: 'Four legs', biped: 'Two legs', flyer: 'Flyer', swimmer: 'Swimmer', jelly: 'Jelly', serpent: 'Long', blob: 'Blob' };

export type V3 = [number, number, number];
/** A Glimmer's landmarks (meta.json "rig"). Only `plan` and `head` are needed; the rest are guessed from
 *  the mesh when missing. */
export type Landmarks = {
  plan: Plan;
  /** the middle of the head */
  head: V3;
  /** the middle of the front (or upper) body, where the neck starts */
  chest?: V3;
  /** the middle of the back (or lower) body */
  hips?: V3;
  /** from where it leaves the body to the tip (2 to 4 points); a long one's back half */
  tail?: V3[];
  /** four legs: front -x, front +x, back -x, back +x; two legs: -x, +x (the bottom of each foot) */
  feet?: V3[];
  /** arms: -x, +x (the hands) */
  hands?: V3[];
  /** [root, tip], -x then +x */
  wings?: [V3, V3][];
  /** a swimmer's side fins (or flippers): [root, tip], -x then +x */
  fins?: [V3, V3][];
  /** ears, horns, antennae, eye stalks: [base, tip] */
  ears?: [V3, V3][];
  /** a jelly's tentacles: root ... tip each */
  tentacles?: V3[][];
  /** the middle of each eye, on its skin (-x first): the face round them rides the head bone alone, so
   *  the eyes keep their shape whatever moves near them */
  eyes?: V3[];
};

export type Role = 'root' | 'spine' | 'neck' | 'head' | 'tail' | 'leg' | 'arm' | 'wing' | 'fin' | 'ear' | 'tentacle';
export type BoneSpec = {
  name: string; role: Role;
  /** index of the parent bone, -1 for the root */
  parent: number;
  /** the joint, and the far end of the bone (model space) */
  at: THREE.Vector3; end: THREE.Vector3;
  /** how far from its line the bone reaches into the mesh (found from the mesh) */
  r: number;
  /** which side it's on (-1: -x, 1: +x, 0: the middle) */
  side: number;
  /** which limb of its kind (leg 0..3, tentacle 0..7), and where in that limb (0 nearest the body) */
  chain: number; link: number; links: number;
  /** a front leg */
  front: boolean;
  /** how freely its limb can move (0.25..1): a limb whose skin is fused to another part (a hand on the
   *  belly, a tail curled round a foot) would tear if it moved fully, so its moves are scaled down */
  free: number;
  /** turning about these (model space, at rest) moves the bone's tip: up, forward, away from the body's
   *  middle, toward +x; `dir` points along the bone */
  dir: THREE.Vector3; aUp: THREE.Vector3; aFwd: THREE.Vector3; aOut: THREE.Vector3; aSide: THREE.Vector3;
  /** only the mesh on this side of these planes is tied to the bone (soft edged) */
  cuts: { p: THREE.Vector3; n: THREE.Vector3 }[];
};
export type Rig = { plan: Plan; bones: BoneSpec[]; height: number; lm: Required<Pick<Landmarks, 'plan' | 'head' | 'chest' | 'hips'>> & Landmarks };

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const v = (a: V3 | THREE.Vector3) => (a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]));
const arr = (p: THREE.Vector3): V3 => [r3(p.x), r3(p.y), r3(p.z)];
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** The mesh's points, for measuring. */
export type Cloud = { pos: Float32Array; n: number; min: THREE.Vector3; max: THREE.Vector3; height: number };
export function cloudOf(pos: Float32Array): Cloud {
  const n = pos.length / 3, min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (x < min.x) min.x = x; if (y < min.y) min.y = y; if (z < min.z) min.z = z;
    if (x > max.x) max.x = x; if (y > max.y) max.y = y; if (z > max.z) max.z = z;
  }
  return { pos, n, min, max, height: Math.max(1e-3, max.y - min.y) };
}
const P = (c: Cloud, i: number, out = new THREE.Vector3()) => out.set(c.pos[i * 3], c.pos[i * 3 + 1], c.pos[i * 3 + 2]);

/** The middle of the part of the mesh near `q` (the average of the points within `r`, twice, shrinking). */
export function snap(c: Cloud, q: THREE.Vector3, r: number): THREE.Vector3 {
  const at = q.clone(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (const rr of [r, r * 0.75]) {
    let k = 0; s.set(0, 0, 0);
    for (let i = 0; i < c.n; i++) if (P(c, i, p).distanceToSquared(at) < rr * rr) { s.add(p); k++; }
    if (k >= 4) at.copy(s.multiplyScalar(1 / k));
  }
  return at;
}
function centroid(c: Cloud, keep: (p: THREE.Vector3) => boolean): THREE.Vector3 | null {
  const s = new THREE.Vector3(), p = new THREE.Vector3(); let k = 0;
  for (let i = 0; i < c.n; i++) if (keep(P(c, i, p))) { s.add(p); k++; }
  return k >= 4 ? s.multiplyScalar(1 / k) : null;
}
function argmax(c: Cloud, score: (p: THREE.Vector3) => number): THREE.Vector3 | null {
  let best = -Infinity, at: THREE.Vector3 | null = null; const p = new THREE.Vector3();
  for (let i = 0; i < c.n; i++) { const s = score(P(c, i, p)); if (s > best) { best = s; at = p.clone(); } }
  return best > -Infinity ? at : null;
}
/** a chain from `a` to `b` (through `mid` points), resampled to `n` + 1 evenly spaced points */
function resample(pts: THREE.Vector3[], n: number): THREE.Vector3[] {
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = lens[lens.length - 1] || 1, out: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) {
    const d = (k / n) * total;
    let i = 1; while (i < pts.length - 1 && lens[i] < d) i++;
    const f = (d - lens[i - 1]) / Math.max(1e-6, lens[i] - lens[i - 1]);
    out.push(pts[i - 1].clone().lerp(pts[i], Math.min(1, Math.max(0, f))));
  }
  return out;
}
const pathLen = (pts: THREE.Vector3[]) => pts.reduce((a, p, i) => (i ? a + p.distanceTo(pts[i - 1]) : 0), 0);

/** A chain from root to tip that follows the mesh: points along the straight line pulled to the middle of
 *  the part round them (a curled tail, a tentacle on the ground). */
function trace(c: Cloud, a: THREE.Vector3, b: THREE.Vector3, r: number, n = 3): THREE.Vector3[] {
  const pts = [a.clone()];
  for (let k = 1; k < n; k++) pts.push(snap(c, a.clone().lerp(b, k / n), r));
  pts.push(b.clone());
  return pts;
}

// ---------------------------------------------------------------------------------------------------
// Guessing the landmarks from the mesh

/** What the meta.json entry already says (the old wiggle points): used as a start. */
export type OldMeta = { head: number[]; tail?: number[] | null; wings?: number[][] | null; ears?: number[][] | null };

/** Fill in every landmark the plan uses that `lm` doesn't have yet, from the mesh. Points the meta already
 *  has (head, the tail's root, the wings' and ears' roots) are kept. */
export function guessLandmarks(c: Cloud, plan: Plan, lm: Partial<Landmarks> = {}, old?: OldMeta): Landmarks {
  const H = c.height, cx = (c.min.x + c.max.x) / 2, cz = (c.min.z + c.max.z) / 2;
  const head = v((lm.head ?? old?.head ?? [cx, c.min.y + H * 0.75, c.max.z * 0.5]) as V3);
  const out: Landmarks = { ...lm, plan, head: arr(head) };
  const headR = 0.2 * H;
  const upright = plan === 'biped' || plan === 'flyer' || plan === 'blob' || plan === 'jelly';
  const oldTail = old?.tail ? v(old.tail as V3) : null;

  // the body: the mesh away from the head (and the feet), split front and back (or top and bottom)
  const body = (p: THREE.Vector3) => p.distanceTo(head) > headR * 1.2 && p.y > c.min.y + H * 0.12;
  if (!out.hips || !out.chest) {
    if (plan === 'jelly') {
      out.hips ??= arr(centroid(c, p => p.y > c.min.y + H * 0.36 && p.y < c.min.y + H * 0.5) ?? new THREE.Vector3(cx, H * 0.43, cz));
      out.chest ??= arr(centroid(c, p => p.y > c.min.y + H * 0.5 && p.y < head.y) ?? new THREE.Vector3(cx, H * 0.58, cz));
    } else if (upright) {
      let lo = Infinity, hi = -Infinity; const p = new THREE.Vector3();
      for (let i = 0; i < c.n; i++) if (body(P(c, i, p))) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
      const span = Math.max(1e-3, Math.min(hi, head.y) - lo);
      const near = (q: THREE.Vector3) => Math.abs(q.z - head.z) < H * 0.35;
      out.hips ??= arr(centroid(c, q => body(q) && near(q) && q.y < lo + span * 0.4) ?? new THREE.Vector3(cx, H * 0.3, cz));
      out.chest ??= arr(centroid(c, q => body(q) && near(q) && q.y > lo + span * 0.55 && q.y < head.y - headR * 0.6) ?? new THREE.Vector3(cx, H * 0.5, cz));
    } else {
      // along z: the back third and the front third of the body (a tail's own points left out)
      const behind = (q: THREE.Vector3) => (oldTail ? q.z < oldTail.z - H * 0.05 && q.distanceTo(oldTail) > H * 0.08 : false);
      let lo = Infinity, hi = -Infinity; const p = new THREE.Vector3();
      for (let i = 0; i < c.n; i++) if (body(P(c, i, p)) && !behind(p)) { lo = Math.min(lo, p.z); hi = Math.max(hi, Math.min(p.z, head.z)); }
      const span = Math.max(1e-3, hi - lo);
      const above = (q: THREE.Vector3) => q.y > c.min.y + H * (plan === 'swimmer' || plan === 'serpent' ? 0.05 : 0.2);
      out.hips ??= arr(centroid(c, q => body(q) && above(q) && !behind(q) && q.z < lo + span * 0.38) ?? new THREE.Vector3(cx, H * 0.4, cz - span * 0.2));
      out.chest ??= arr(centroid(c, q => body(q) && above(q) && !behind(q) && q.z > hi - span * 0.38 && q.z < head.z) ?? new THREE.Vector3(cx, H * 0.45, cz + span * 0.2));
    }
  }
  const hips = v(out.hips!), chest = v(out.chest!);
  const mid = hips.clone().lerp(chest, 0.5);

  // a tail: from its root to the point of the mesh furthest out that way
  const wantTail = plan !== 'jelly' && plan !== 'blob' && (oldTail || plan === 'swimmer' || plan === 'serpent');
  if (!out.tail && wantTail) {
    const root = oldTail ?? hips.clone().add(new THREE.Vector3(0, 0, -H * 0.15));
    const away = root.clone().sub(mid).normalize();
    const tip = argmax(c, p => (p.clone().sub(root).dot(away) > 0 && p.distanceTo(head) > headR ? p.distanceTo(mid) : -Infinity));
    if (tip && tip.distanceTo(root) > H * 0.08) out.tail = trace(c, root, tip, H * 0.07, 3).map(arr);
  }

  // feet: the lowest points, gathered round where each foot should be
  const nFeet = plan === 'quad' ? 4 : plan === 'biped' || plan === 'flyer' || plan === 'blob' ? 2 : 0;
  if (!out.feet && nFeet) {
    const low: THREE.Vector3[] = []; const p = new THREE.Vector3();
    for (let i = 0; i < c.n; i++) if (P(c, i, p).y < c.min.y + H * 0.07 && p.distanceTo(head) > headR) low.push(p.clone());
    const zs = [chest.z, hips.z], halfW = Math.max(0.05 * H, (c.max.x - c.min.x) * 0.22);
    const seeds = nFeet === 4 ? [[-1, 0], [1, 0], [-1, 1], [1, 1]].map(([s, f]) => new THREE.Vector3(cx + s * halfW, 0, zs[f]))
      : [-1, 1].map(s => new THREE.Vector3(cx + s * halfW, 0, (hips.z + chest.z) / 2));
    // (a foot the mesh had nothing near stays where it was seeded)
    const feet = kmeans(low, seeds);
    if (feet && low.length >= 8) out.feet = feet.map(f => arr(new THREE.Vector3(f.x, c.min.y + H * 0.035, f.z)));
  }

  // arms: two-legged ones' hands, the points furthest out at the sides between the hips and the head
  if (!out.hands && (plan === 'biped' || plan === 'blob')) {
    const hands: V3[] = [];
    for (const s of [-1, 1]) {
      const h = argmax(c, p => (p.y > hips.y && p.y < head.y - headR * 0.5 && p.distanceTo(head) > headR * 1.1 ? s * (p.x - cx) : -Infinity));
      if (h) hands.push(arr(snap(c, h.clone().lerp(new THREE.Vector3(cx, h.y, h.z), 0.08), H * 0.05)));
    }
    if (hands.length === 2) out.hands = hands;
  }

  // wings (and a swimmer's fins): from each root, the furthest point of the mesh on that side
  const roots = (old?.wings as V3[] | undefined)?.map(w => v(w));
  const tipFrom = (root: THREE.Vector3, s: number, reach: number) => argmax(c, p => {
    if (s * (p.x - cx) < s * (root.x - cx) || p.distanceTo(head) < headR || p.y < c.min.y + H * 0.08) return -Infinity;
    const d = p.distanceTo(root); return d < reach ? d : -Infinity;
  });
  if (!out.wings && plan === 'flyer' || !out.wings && roots && plan !== 'swimmer' && plan !== 'jelly') {
    const rs = roots ?? [-1, 1].map(s => chest.clone().add(new THREE.Vector3(s * H * 0.12, H * 0.05, -H * 0.05)));
    const w: [V3, V3][] = [];
    rs.forEach((r, i) => { const s = i === 0 ? -1 : 1, t = tipFrom(r, s, H * 0.9); if (t) w.push([arr(r), arr(t)]); });
    if (w.length === 2) out.wings = w;
  }
  if (!out.fins && plan === 'swimmer') {
    const rs = roots ?? [-1, 1].map(s => chest.clone().add(new THREE.Vector3(s * H * 0.15, -H * 0.1, 0)));
    const w: [V3, V3][] = [];
    rs.forEach((r, i) => { const s = i === 0 ? -1 : 1, t = tipFrom(r, s, H * 0.45); if (t) w.push([arr(r), arr(t)]); });
    if (w.length === 2) out.fins = w;
  }

  // ears: from each base, the point furthest out from the middle of the head
  if (!out.ears && old?.ears) {
    out.ears = old.ears.map(e => {
      const b = v(e as V3), dir = b.clone().sub(head).normalize();
      const t = argmax(c, p => (p.distanceTo(b) < H * 0.3 ? p.clone().sub(b).dot(dir) : -Infinity)) ?? b.clone().addScaledVector(dir, H * 0.1);
      return [arr(b), arr(t)] as [V3, V3];
    });
  }

  // a jelly's tentacles: round the body below its middle, the points that reach furthest (down and out),
  // one per bump in that reach
  if (!out.tentacles && plan === 'jelly') {
    const N = 36, reach = new Array(N).fill(-Infinity), tips: (THREE.Vector3 | null)[] = new Array(N).fill(null), p = new THREE.Vector3();
    for (let i = 0; i < c.n; i++) {
      P(c, i, p); if (p.y > hips.y) continue;
      const dx = p.x - hips.x, dz = p.z - hips.z, a = Math.atan2(dx, dz), b = ((Math.round((a / (Math.PI * 2)) * N) % N) + N) % N;
      // tentacles hang (or curl on the ground): low points count most, the bell's rim not at all
      if (p.y > hips.y - H * 0.15) continue;
      const rch = Math.hypot(dx, dz) * 0.4 + (hips.y - p.y);
      if (rch > reach[b]) { reach[b] = rch; tips[b] = p.clone(); }
    }
    // smooth round the circle, then the bumps
    const sm = reach.map((_, i) => (reach[(i + N - 1) % N] + 2 * reach[i] + reach[(i + 1) % N]) / 4);
    let peaks: number[] = [];
    for (let i = 0; i < N; i++) if (tips[i] && sm[i] >= sm[(i + N - 1) % N] && sm[i] > sm[(i + 1) % N]) peaks.push(i);
    // keep the biggest up to 8, at least 3 bins apart
    peaks.sort((a, b) => sm[b] - sm[a]);
    const kept: number[] = [];
    for (const i of peaks) if (kept.length < 8 && kept.every(j => Math.min(Math.abs(i - j), N - Math.abs(i - j)) >= 3)) kept.push(i);
    peaks = kept.sort((a, b) => a - b);
    if (peaks.length < 4) peaks = [0, 6, 12, 18, 24, 30].filter(i => tips[i]);
    const bellR = Math.max(H * 0.08, (c.max.x - c.min.x) * 0.2);
    out.tentacles = peaks.map(i => {
      const tip = tips[i]!, o = new THREE.Vector3(tip.x - hips.x, 0, tip.z - hips.z).normalize();
      const root = hips.clone().addScaledVector(o, bellR * 0.7).add(new THREE.Vector3(0, -H * 0.03, 0));
      return trace(c, root, tip, H * 0.06, 2).map(arr);
    });
  }
  return out;
}

/** k-means on the floor (x, z) from these seeds; null if a cluster ends up empty */
function kmeans(pts: THREE.Vector3[], seeds: THREE.Vector3[]): THREE.Vector3[] | null {
  if (!pts.length) return null;
  const cs = seeds.map(s => s.clone());
  for (let it = 0; it < 12; it++) {
    const sum = cs.map(() => new THREE.Vector3()), k = cs.map(() => 0);
    for (const p of pts) {
      let bi = 0, bd = Infinity;
      cs.forEach((c, i) => { const d = (p.x - c.x) ** 2 + (p.z - c.z) ** 2; if (d < bd) { bd = d; bi = i; } });
      sum[bi].add(p); k[bi]++;
    }
    cs.forEach((c, i) => { if (k[i]) c.copy(sum[i].multiplyScalar(1 / k[i])); });
  }
  return cs;
}

// ---------------------------------------------------------------------------------------------------
// The skeleton

const R0: Record<Role, number> = { root: 0.22, spine: 0.22, neck: 0.13, head: 0.2, tail: 0.07, leg: 0.07, arm: 0.06, wing: 0.1, fin: 0.07, ear: 0.045, tentacle: 0.055 };

/** The bones for these landmarks. */
export function buildRig(lmIn: Landmarks, c: Cloud): Rig {
  const H = c.height, cx = (c.min.x + c.max.x) / 2;
  const lm = guessLandmarks(c, lmIn.plan, lmIn) as Rig['lm'];
  const head = v(lm.head), chest = v(lm.chest), hips = v(lm.hips);
  const bones: BoneSpec[] = [];
  const add = (name: string, role: Role, parent: number, at: THREE.Vector3, end: THREE.Vector3, o: Partial<BoneSpec> = {}) => {
    bones.push({ name, role, parent, at: at.clone(), end: end.clone(), r: R0[role] * H, side: 0, chain: 0, link: 0, links: 1, front: false, free: 1, cuts: [], ...o,
      dir: new THREE.Vector3(), aUp: new THREE.Vector3(), aFwd: new THREE.Vector3(), aOut: new THREE.Vector3(), aSide: new THREE.Vector3() });
    return bones.length - 1;
  };
  // the trunk: hips, back, neck, head
  const midB = hips.clone().lerp(chest, 0.5);
  const neckAt = chest.clone().lerp(head, 0.5);
  const root = add('root', 'root', -1, hips, midB);
  const spine = add('spine', 'spine', root, midB, chest);
  const neck = add('neck', 'neck', spine, chest, neckAt);
  const headEnd = head.clone().add(head.clone().sub(neckAt).multiplyScalar(0.6));
  const headB = add('head', 'head', neck, neckAt, headEnd);
  const midX = (hips.x + chest.x) / 2;
  const sideCut = (s: number, x: number) => ({ p: new THREE.Vector3(x, 0, 0), n: new THREE.Vector3(s, 0, 0) });

  // the tail (a long one's back half): 2 or 3 bones along its points
  if (lm.tail && lm.tail.length >= 2) {
    const pts = [hips.clone().lerp(v(lm.tail[0]), 0.35), ...lm.tail.map(v)];
    const n = pathLen(pts) > H * 0.35 || lm.plan === 'serpent' || lm.plan === 'swimmer' ? 3 : 2;
    const q = resample(pts, n);
    let parent = root;
    for (let i = 0; i < n; i++) parent = add(`tail${i}`, 'tail', parent, q[i], q[i + 1], { link: i, links: n });
  }
  // legs: hip (or shoulder) joint above each foot inside the body, a knee half way, the foot
  if (lm.feet) {
    const four = lm.feet.length === 4;
    const zMid = four ? (lm.feet[0][2] + lm.feet[1][2] + lm.feet[2][2] + lm.feet[3][2]) / 4 : 0;
    lm.feet.forEach((f3, i) => {
      const f = v(f3), front = four && i < 2;
      const s = i % 2 === 0 ? -1 : 1;
      // the trunk's point nearest this foot along the body
      const t = four ? Math.min(1, Math.max(0, (f.z - hips.z) / ((chest.z - hips.z) || 1e-3))) : 0;
      const T = hips.clone().lerp(chest, t);
      const top = four ? T.y : hips.y;
      const j = new THREE.Vector3(T.x + (f.x - T.x) * 0.8, f.y + (top - f.y) * 0.72, T.z + (f.z - T.z) * 0.6);
      const k = j.clone().lerp(f, 0.5);
      const cuts = [sideCut(s, (lm.feet![s < 0 ? i : i - 1][0] + lm.feet![s < 0 ? i + 1 : i][0]) / 2)];
      if (four) cuts.push({ p: new THREE.Vector3(0, 0, zMid), n: new THREE.Vector3(0, 0, front ? 1 : -1) });
      const parent = front ? spine : root;
      const u = add(`leg${i}a`, 'leg', parent, j, k, { side: s, chain: i, link: 0, links: 2, front, cuts });
      add(`leg${i}b`, 'leg', u, k, f, { side: s, chain: i, link: 1, links: 2, front, cuts });
    });
  }
  // arms: shoulder a little out from the chest, elbow half way, the hand
  if (lm.hands) lm.hands.forEach((h3, i) => {
    const h = v(h3), s = i === 0 ? -1 : 1;
    const sh = chest.clone().lerp(h, 0.42); sh.y = Math.max(sh.y, Math.min(chest.y + H * 0.04, (chest.y + neckAt.y) / 2));
    const el = sh.clone().lerp(h, 0.5);
    const cuts = [sideCut(s, midX)];
    const u = add(`arm${i}a`, 'arm', spine, sh, el, { side: s, chain: i, link: 0, links: 2, cuts });
    add(`arm${i}b`, 'arm', u, el, h, { side: s, chain: i, link: 1, links: 2, cuts });
  });
  // wings: two bones each; fins: one (two when long)
  for (const [key, role] of [['wings', 'wing'], ['fins', 'fin']] as const) {
    lm[key]?.forEach(([r3, t3], i) => {
      const a = v(r3), b = v(t3), s = i === 0 ? -1 : 1, n = role === 'wing' || a.distanceTo(b) > H * 0.3 ? 2 : 1;
      const q = resample([a, b], n), cuts = [sideCut(s, midX)];
      let parent = spine;
      for (let k = 0; k < n; k++) parent = add(`${role}${i}${'ab'[k]}`, role, parent, q[k], q[k + 1], { side: s, chain: i, link: k, links: n, cuts });
    });
  }
  // ears: one bone each (two when long and floppy)
  if (lm.ears) lm.ears.forEach(([b3, t3], i) => {
    const a = v(b3), b = v(t3), n = a.distanceTo(b) > H * 0.2 ? 2 : 1;
    const s = lm.ears!.length === 2 ? (i === 0 ? -1 : 1) : 0;
    const cuts = s ? [sideCut(s, (lm.ears![0][0][0] + lm.ears![1][0][0]) / 2)] : [];
    const q = resample([a, b], n);
    let parent = headB;
    for (let k = 0; k < n; k++) parent = add(`ear${i}${'ab'[k]}`, 'ear', parent, q[k], q[k + 1], { side: s, chain: i, link: k, links: n, cuts });
  });
  // tentacles: two or three bones each, from the body
  if (lm.tentacles) lm.tentacles.forEach((t, i) => {
    // (three bones each for long ones, unless there are so many the skeleton would pass 24 bones)
    const pts = t.map(v), n = pathLen(pts) > H * 0.32 && lm.tentacles!.length <= 6 ? 3 : 2, q = resample(pts, n);
    let parent = root;
    for (let k = 0; k < n; k++) parent = add(`tent${i}${k}`, 'tentacle', parent, q[k], q[k + 1], { chain: i, link: k, links: n });
  });

  // each bone's turning axes
  for (const b of bones) {
    b.dir.subVectors(b.end, b.at); if (b.dir.lengthSq() < 1e-10) b.dir.copy(Y); b.dir.normalize();
    const out = b.role === 'tentacle' ? new THREE.Vector3(b.at.x - hips.x, 0, b.at.z - hips.z) : b.role === 'ear' ? b.at.clone().sub(head).setY(0) : new THREE.Vector3(b.side || Math.sign(b.at.x - cx) || 1, 0, 0);
    if (out.lengthSq() < 1e-8) out.set(b.side || 1, 0, 0);
    out.normalize();
    axis(b.aUp, b.dir, Y, out); axis(b.aFwd, b.dir, Z, Y.clone().negate()); axis(b.aOut, b.dir, out, Z.clone().negate()); axis(b.aSide, b.dir, X, Y);
  }
  fitRadii(bones, c);
  return { plan: lm.plan, bones, height: H, lm };
}
/** the axis that turns `dir` toward `want` (or toward `alt` when they're nearly the same line) */
function axis(out: THREE.Vector3, dir: THREE.Vector3, want: THREE.Vector3, alt: THREE.Vector3) {
  out.crossVectors(dir, want);
  if (out.length() < 0.25) out.crossVectors(dir, alt);
  if (out.lengthSq() < 1e-8) out.set(1, 0, 0);
  out.normalize();
}

// ---------------------------------------------------------------------------------------------------
// The weights

const segD = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, ab: THREE.Vector3, abl2: number) => {
  const t = abl2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / abl2)) : 0;
  const dx = p.x - (a.x + ab.x * t), dy = p.y - (a.y + ab.y * t), dz = p.z - (a.z + ab.z * t);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};
/** how much of a bone's pull a point on this side of its cut planes keeps: 1 well inside, 0 well outside */
function cutK(b: BoneSpec, p: THREE.Vector3, band: number) {
  let k = 1;
  for (const c of b.cuts) {
    const d = (p.x - c.p.x) * c.n.x + (p.y - c.p.y) * c.n.y + (p.z - c.p.z) * c.n.z;
    const f = Math.min(1, Math.max(0, (d + band) / (2 * band)));
    k *= f * f * (3 - 2 * f);
  }
  return k;
}
/** each bone's reach: how far from its line the part of the mesh nearest to it goes (nearest by plain
 *  distance, so a thick body never claims a thin limb next to it and grows from it) */
function fitRadii(bones: BoneSpec[], c: Cloud) {
  const ab = bones.map(b => b.end.clone().sub(b.at)), l2 = ab.map(x => x.lengthSq()), H = c.height;
  const step = Math.max(1, Math.floor(c.n / 8000)), p = new THREE.Vector3();
  const ds: number[][] = bones.map(() => []);
  for (let i = 0; i < c.n; i += step) {
    P(c, i, p);
    let bi = -1, bd = Infinity;
    bones.forEach((b, j) => { if (cutK(b, p, 0.02 * H) < 0.5) return; const d = segD(p, b.at, b.end, ab[j], l2[j]); if (d < bd) { bd = d; bi = j; } });
    if (bi >= 0) ds[bi].push(bd);
  }
  bones.forEach((b, j) => {
    const d = ds[j].sort((x, y) => x - y);
    if (d.length < 6) return;
    const base = R0[b.role] * H;
    b.r = Math.min(base * 2, Math.max(base * 0.5, d[Math.floor(d.length * 0.75)]));
  });
}

/** Ties each point of the mesh to up to four bones: weights from its distance to each bone (over that
 *  bone's reach), normalised. Bones that meet at a joint (a bone, its parent, its children) share the
 *  mesh round the joint softly so it bends smoothly; bones that don't (a tail and a foot, a hand and the
 *  belly) share it only where they truly touch, so one moving doesn't drag the other's skin along. */
export function skinWeights(rig: Rig, pos: Float32Array): { index: Uint16Array; weight: Float32Array } {
  const n = pos.length / 3, bones = rig.bones, B = bones.length, H = rig.height;
  const index = new Uint16Array(n * 4), weight = new Float32Array(n * 4);
  const ab = bones.map(b => b.end.clone().sub(b.at)), l2 = ab.map(x => x.lengthSq());
  const near = bones.map((b, i) => bones.map((c, j) => i === j || b.parent === j || c.parent === i));
  const sd = new Float64Array(B), ck = new Float64Array(B), w = new Float64Array(B), p = new THREE.Vector3(), band = 0.03 * H;
  // the eyes: each rides the head, or the part of it it's on (a snail's eye on its stalk); eyes on the head
  // get a stiff zone round the line from one to the other, eyes on stalks a ball each
  const hi = bones.findIndex(b => b.role === 'head'), eyes = (rig.lm.eyes ?? []).map(v);
  const onHead = (j: number): boolean => j === hi || (j >= 0 && bones[j].parent >= 0 && onHead(bones[j].parent));
  const eyeBone = eyes.map(e => {
    let best = hi, bd = Infinity;
    bones.forEach((b, j) => { if (!onHead(j)) return; const d = segD(e, b.at, b.end, ab[j], l2[j]) / b.r; if (d < bd) { bd = d; best = j; } });
    return best;
  });
  const together = eyes.length > 0 && eyeBone.every(j => j === eyeBone[0]);
  const eyeA = hi >= 0 && eyes.length ? eyes[0] : null, eyeB = eyeA ? eyes[eyes.length - 1] : null;
  const eyeAB = eyeA && eyeB ? eyeB.clone().sub(eyeA) : null, eyeL2 = eyeAB ? eyeAB.lengthSq() : 0;
  /** how much point q is an eye (or the face round the eyes), and which bone it rides */
  const eyeOf = (q: THREE.Vector3): [number, number] => {
    if (together) return [sstep(EYE_ZONE[1] * H, EYE_ZONE[0] * H, segD(q, eyeA!, eyeB!, eyeAB!, eyeL2)), eyeBone[0]];
    let f = 0, j = hi;
    eyes.forEach((e, k) => { const g = sstep(EYE_BALL[1] * H, EYE_BALL[0] * H, q.distanceTo(e)); if (g > f) { f = g; j = eyeBone[k]; } });
    return [f, j];
  };
  for (let i = 0; i < n; i++) {
    p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    let best = 0, bs = Infinity;
    for (let j = 0; j < B; j++) {
      const b = bones[j];
      ck[j] = b.cuts.length ? cutK(b, p, band) : 1;
      sd[j] = Math.max(0.02, segD(p, b.at, b.end, ab[j], l2[j]) / b.r);
      if (ck[j] > 0.5 && sd[j] < bs) { bs = sd[j]; best = j; }
    }
    for (let j = 0; j < B; j++) w[j] = ck[j] <= 0 ? 0 : ck[j] * Math.pow(bs / sd[j], near[best][j] ? 5 : 14);
    // the four strongest
    for (let k = 0; k < 4; k++) {
      let bj = 0, bw = -1;
      for (let j = 0; j < B; j++) if (w[j] > bw) { bw = w[j]; bj = j; }
      index[i * 4 + k] = bj; weight[i * 4 + k] = Math.max(0, bw); w[bj] = -1;
    }
    let s = weight[i * 4] + weight[i * 4 + 1] + weight[i * 4 + 2] + weight[i * 4 + 3];
    if (!(s > 0)) { weight[i * 4] = 1; weight[i * 4 + 1] = weight[i * 4 + 2] = weight[i * 4 + 3] = 0; index[i * 4] = 0; s = 1; }
    for (let k = 0; k < 4; k++) weight[i * 4 + k] /= s;
    // the eyes and the face between and round them ride the head and nothing else (an owl's eyes sit
    // right where its head meets its body, beside its wings' roots: they bent as it moved)
    if (eyeA) { const [f, j] = eyeOf(p); if (f > 0) pin(index, weight, i, j, f); }
  }
  return { index, weight };
}

/** round the eyes: all of it rides the head this close (a share of the Glimmer's height), none past this */
export const EYE_ZONE: [number, number] = [0.1, 0.16];
/** an eye on a stalk: the ball round it that rides the stalk's tip */
export const EYE_BALL: [number, number] = [0.06, 0.09];
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Tie point i to bone `to` by share f more (the others give up that share). */
function pin(index: Uint16Array, weight: Float32Array, i: number, to: number, f: number) {
  for (let k = 0; k < 4; k++) weight[i * 4 + k] *= 1 - f;
  let at = -1;
  for (let k = 0; k < 4; k++) if (index[i * 4 + k] === to && (weight[i * 4 + k] > 0 || at < 0)) at = k;
  if (at < 0) { at = 0; for (let k = 1; k < 4; k++) if (weight[i * 4 + k] < weight[i * 4 + at]) at = k; }
  index[i * 4 + at] = to; weight[i * 4 + at] += f;
  let s = 0;
  for (let k = 0; k < 4; k++) s += weight[i * 4 + k];
  for (let k = 0; k < 4; k++) weight[i * 4 + k] /= s;
}
/** How freely each limb can move (BoneSpec.free). Image-to-3D models are one skin, so a hand resting on
 *  the belly, a wing folded against the side or a tail curled round a foot is fused to that part: moved
 *  fully, it would drag that part's skin with it. For each limb, the share of its outer half that is
 *  also tied to some part it doesn't join scales its moves down (never below a quarter). */
export function fitFreedom(rig: Rig, pos: Float32Array, wts: { index: Uint16Array; weight: Float32Array }): Record<string, number> {
  const bones = rig.bones, n = pos.length / 3, seen: Record<string, number> = {};
  const LIMBS: Role[] = ['tail', 'leg', 'arm', 'wing', 'fin', 'ear', 'tentacle'];
  const chains = new Map<string, number[]>();
  bones.forEach((b, i) => { if (LIMBS.includes(b.role)) { const k = `${b.role}${b.chain}`; (chains.get(k) ?? chains.set(k, []).get(k)!).push(i); } });
  for (const [name, chain] of chains) {
    const r = bones[chain[0]], own = new Uint8Array(bones.length);
    chain.forEach(i => { own[i] = 1; });
    if (r.parent >= 0) own[r.parent] = 1;
    // tentacles brush each other and wave together: that's fine
    if (r.role === 'tentacle') bones.forEach((b, i) => { if (b.role === 'tentacle') own[i] = 1; });
    const tip = bones[chain[chain.length - 1]].end, along = tip.clone().sub(r.at), L2 = Math.max(1e-8, along.lengthSq());
    let all = 0, fused = 0;
    for (let i = 0; i < n; i++) {
      let wc = 0, other = 0;
      for (let k = 0; k < 4; k++) { const j = wts.index[i * 4 + k], w = wts.weight[i * 4 + k]; if (chain.includes(j)) wc += w; else if (!own[j]) other += w; }
      if (wc < 0.25) continue;
      // its outer half only (the joint at its root is shared with the body, as it should be)
      if ((pos[i * 3] - r.at.x) * along.x + (pos[i * 3 + 1] - r.at.y) * along.y + (pos[i * 3 + 2] - r.at.z) * along.z < 0.35 * L2) continue;
      all++; if (other > 0.2) fused++;
    }
    const f = all ? fused / all : 0;
    seen[name] = +f.toFixed(3);
    const free = Math.min(1, Math.max(0.25, 1 - (f - 0.04) * 4));
    chain.forEach(i => { bones[i].free = free; });
  }
  return seen;
}

// ---------------------------------------------------------------------------------------------------
// Turning a mesh into a skinned one

/** The bones as THREE.Bones (rest: no turn, each at its joint) and their bind inverses. */
export function makeBones(rig: Rig): { bones: THREE.Bone[]; inverses: THREE.Matrix4[] } {
  const bones = rig.bones.map(s => { const b = new THREE.Bone(); b.name = s.name; return b; });
  rig.bones.forEach((s, i) => {
    const par = s.parent >= 0 ? rig.bones[s.parent].at : new THREE.Vector3();
    bones[i].position.copy(s.at).sub(par);
    if (s.parent >= 0) bones[s.parent].add(bones[i]);
    // the moves set each bone's matrix themselves (a stretched bone doesn't stretch its children)
    bones[i].updateMatrix(); bones[i].matrixAutoUpdate = false;
  });
  const inverses = rig.bones.map(s => new THREE.Matrix4().makeTranslation(-s.at.x, -s.at.y, -s.at.z));
  return { bones, inverses };
}

/** Skinned geometry for a model's mesh (made once per model and shared). */
export type Skin = { rig: Rig; geometry: THREE.BufferGeometry };
const skins = new Map<string, Skin>();
/** `key`: the model and its landmarks, so a change in either makes it again. */
export function skinFor(key: string, geo: THREE.BufferGeometry, lm: Landmarks): Skin {
  let s = skins.get(key);
  if (!s) {
    const pos = positionsOf(geo);
    const c = cloudOf(pos), rig = buildRig(lm, c), wts = skinWeights(rig, pos);
    fitFreedom(rig, pos, wts);
    const g = new THREE.BufferGeometry();
    for (const [k, a] of Object.entries(geo.attributes)) g.setAttribute(k, a);
    g.setIndex(geo.index);
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(wts.index, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wts.weight, 4));
    g.boundingBox = geo.boundingBox?.clone() ?? null;
    g.computeBoundingSphere();
    s = { rig, geometry: g };
    skins.set(key, s);
  }
  return s;
}
/** A geometry's points as a plain array (the models' vertex data may be interleaved). */
export function positionsOf(geo: THREE.BufferGeometry): Float32Array {
  const a = geo.attributes.position, out = new Float32Array(a.count * 3);
  for (let i = 0; i < a.count; i++) { out[i * 3] = a.getX(i); out[i * 3 + 1] = a.getY(i); out[i * 3 + 2] = a.getZ(i); }
  return out;
}
/** Forget a made skin (the landmark tool, after moving a point). */
export function dropSkin(key: string) { skins.delete(key); }

/** The meta.json "rig" entry for these landmarks: rounded, in a fixed order. */
export function landmarksJson(lm: Landmarks): Landmarks {
  const out: Landmarks = { plan: lm.plan, head: lm.head };
  for (const k of ['chest', 'hips', 'tail', 'feet', 'hands', 'wings', 'fins', 'ears', 'tentacles', 'eyes'] as const) if (lm[k]) (out as Record<string, unknown>)[k] = round(lm[k]);
  return out;
}
const round = (x: unknown): unknown => (Array.isArray(x) ? x.map(round) : typeof x === 'number' ? r3(x) : x);
