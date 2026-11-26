// A buddy's head and neck don't bend when its arms move. The Blender re-weighting that keeps raised
// arms round (character.ts) left shoulder and arm weights running from the shoulders up through the
// neck into the head (an antenna head vertex: Head 0.46, LeftShoulder 0.26, neck 0.15, RightShoulder
// 0.13), so when the arms moved the head bent with them, and in Straw's YMCA dance its straw tore.
// When a buddy on the list below loads, the skin of its neck and head lets go of those weights: none
// of them where the neck meets the shoulders, a growing share of them up the neck, all of them a little
// way on, each handed to the spine, neck and head bones that vertex already follows, in the shares it
// had. Nothing else changes, and the weights the model came with are kept for the code that asks which
// part of the body a vertex is (colours, hats, worn gear), so how a buddy looks stays the same.
import * as THREE from 'three';
import type { FriendId } from '../art/cast';

/** the head's own bones: the Head bone and the two that ride on it */
const HEAD = new Set(['Head', 'head_end', 'headfront']);
/** the bones whose weights the neck and head let go of */
const ARM = /shoulder|arm|hand|clav|thumb|index|middle|ring|pinky|finger/i;
/** where the skin lets go of the arms: from none `below` the head's edge (along the skin, as a share of
 * the head's height above its joint) to all of it `above` that edge, inside the head */
export type Fade = { below: number; above: number };
export const FADE: Fade = { below: 0.3, above: 0 };
/** the share of a vertex's weights that isn't an arm's from which it lets go of its arm weights in full */
const MIXED = 0.2;
/** the buddies whose neck and head let go of the arms, and where (Fade). Each was measured over every
 * move it has, every frame at 10 a second: the head's worst drift or stretch down by a fifth or more and
 * neither up, and no edge of the head, the neck or where the changed skin meets the rest stretching
 * more than 3% (and 3 points) past its worst before. The other buddies failed that with every fade
 * tried (fresh/handoff/buddy-heads-2.md), so they keep the weights they came with. */
export const STEADY_HEADS: Partial<Record<FriendId, Fade>> = {
  cat: { below: 0.5, above: 0 },
  diver: { below: 0.3, above: 0 },
  fluff: { below: 0.3, above: 0 },
  rabbit: { below: 0.3, above: 0 },
  sloth: { below: 0.5, above: 0 },
};

type Attr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
type Weights = { si: Attr; sw: Attr };

/** The skin weights the model came with. They say which part of the body a vertex is: what reads
 * them for that (the colours, where a hat sits, what a piece of gear holds on to) uses these. */
export function partWeights(g: THREE.BufferGeometry): Weights {
  const a = g.attributes, kept = a._partjoints && a._partweights ? { si: a._partjoints, sw: a._partweights } : null;
  return (g.userData.partWeights as Weights | undefined) ?? kept ?? { si: a.skinIndex, sw: a.skinWeight };
}

/**
 * A model whose skin was weighted again in the file for how it moves (Straw: its straw cloak and the strands round
 * its neck rode the arm bones, so a dance tore them) keeps the weights it came with there too, as _PARTJOINTS and
 * _PARTWEIGHTS, for what asks which part of the body a vertex is (the colours, where a hat sits, gear fitting, the
 * sled seat), so those read what they always did. Moved off the geometry so they aren't sent to the graphics card.
 */
export function keepParts(m: THREE.SkinnedMesh) {
  const g = m.geometry, a = g.attributes;
  if (!a._partjoints || !a._partweights) return;
  g.userData.partWeights = { si: a._partjoints, sw: a._partweights };
  g.deleteAttribute('_partjoints');
  g.deleteAttribute('_partweights');
}

export type NeckPart = {
  /** 1 for a vertex that lets go of some of its arm weights: the head and the skin near it */
  inPart: Uint8Array;
  /** 1 for a vertex of the head itself: nearest the head's own bones and above the Head joint */
  head: Uint8Array;
  /** for each vertex of the neck and head, the share of its arm weights it lets go of (0..1) */
  take: Float32Array;
  /** the head's height above its joint (the head's 95th percentile), in the space the skin was bound in */
  height: number;
};

/**
 * The head (skin above the Head joint nearest the head's own bones by shape, not by weights, which are
 * what's wrong) and the skin near it, and for each vertex how much of its arm weights it lets go of:
 * by its distance along the skin from the head's edge, none `below` of the head's height out from it,
 * all of it `above` in (with above 0, the whole head). A piece of skin not joined to the head (a body
 * made apart from it, a collar) goes by its straight distance to the edge. Vertices at one spot (split
 * for the texture) count as one, so they stay together.
 */
export function neckPart(m: THREE.SkinnedMesh, fade = FADE): NeckPart | null {
  const g = m.geometry, bones = m.skeleton.bones, hi = bones.findIndex(b => b.name === 'Head');
  const pos = g.attributes.position;
  if (hi < 0 || !pos) return null;
  const N = pos.count;
  // the bones where the skin was bound: each a segment to each child bone, a bone with none a point
  const at = m.skeleton.boneInverses.map(inv => new THREE.Vector3().setFromMatrixPosition(inv.clone().invert()));
  const segs: { j: number; a: THREE.Vector3; ab: THREE.Vector3; l2: number }[] = [];
  bones.forEach((b, j) => {
    const kids = b.children.map(c => bones.indexOf(c as THREE.Bone)).filter(c => c >= 0);
    for (const c of kids.length ? kids : [j]) {
      const ab = at[c].clone().sub(at[j]);
      segs.push({ j, a: at[j], ab, l2: ab.lengthSq() });
    }
  });
  const P = new Float32Array(N * 3), v = new THREE.Vector3(), q = new THREE.Vector3();
  const head = new Uint8Array(N);
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(m.bindMatrix);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    let best = Infinity, bj = -1;
    for (const s of segs) {
      const t = s.l2 > 1e-12 ? Math.max(0, Math.min(1, q.copy(v).sub(s.a).dot(s.ab) / s.l2)) : 0;
      const d = q.copy(s.a).addScaledVector(s.ab, t).distanceToSquared(v);
      if (d < best) { best = d; bj = s.j; }
    }
    if (HEAD.has(bones[bj].name) && v.y > at[hi].y) head[i] = 1;
  }
  const up: number[] = [];
  for (let i = 0; i < N; i++) if (head[i]) up.push(P[i * 3 + 1] - at[hi].y);
  up.sort((a, b) => a - b);
  const height = up.length ? up[Math.floor(up.length * 0.95)] : 0;
  // the skin as one surface: vertices at the same spot are one node
  const e = Math.max(1e-9, (y1 - y0) * 1e-5), ids = new Map<string, number>(), node = new Int32Array(N), rep: number[] = [];
  for (let i = 0; i < N; i++) {
    const k = `${Math.round(P[i * 3] / e)},${Math.round(P[i * 3 + 1] / e)},${Math.round(P[i * 3 + 2] / e)}`;
    let n = ids.get(k);
    if (n === undefined) { n = rep.length; ids.set(k, n); rep.push(i); }
    node[i] = n;
  }
  const K = rep.length, ix = g.index, T = ix ? ix.count : N;
  const corner = (c: number) => node[ix ? ix.getX(c) : c];
  const deg = new Int32Array(K + 1);
  for (let c = 0; c + 2 < T; c += 3) for (let s = 0; s < 3; s++) { deg[corner(c + s)]++; deg[corner(c + ((s + 1) % 3))]++; }
  const start = new Int32Array(K + 1);
  for (let n = 0; n < K; n++) start[n + 1] = start[n] + deg[n];
  const fill = start.slice(0, K), nb = new Int32Array(start[K]);
  for (let c = 0; c + 2 < T; c += 3) for (let s = 0; s < 3; s++) {
    const a = corner(c + s), b = corner(c + ((s + 1) % 3));
    nb[fill[a]++] = b; nb[fill[b]++] = a;
  }
  // distance along the skin from the part's own edge, its vertices next to one outside (Dijkstra)
  const dist = new Float64Array(K).fill(Infinity), heap: [number, number][] = [];
  const push = (d: number, n: number) => {
    heap.push([d, n]);
    for (let c = heap.length - 1; c > 0;) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let c = 0; ;) {
        const l = c * 2 + 1, r = l + 1;
        let m2 = c;
        if (l < heap.length && heap[l][0] < heap[m2][0]) m2 = l;
        if (r < heap.length && heap[r][0] < heap[m2][0]) m2 = r;
        if (m2 === c) break;
        [heap[m2], heap[c]] = [heap[c], heap[m2]]; c = m2;
      }
    }
    return top;
  };
  // pieces of skin joined to each other (Union-Find), and which of them hold some of the head
  const up2 = new Int32Array(K).map((_, n) => n), root = (n: number): number => { while (up2[n] !== n) n = up2[n] = up2[up2[n]]; return n; };
  for (let n = 0; n < K; n++) for (let s = start[n]; s < start[n + 1]; s++) { const a = root(n), b = root(nb[s]); if (a !== b) up2[a] = b; }
  const holds = new Uint8Array(K);
  for (let n = 0; n < K; n++) if (head[rep[n]]) holds[root(n)] = 1;
  // distance along the skin from the head's edge, out over the rest of the body (Dijkstra), as far as len
  const lo = fade.below * height, hi2 = fade.above * height, len = Math.max(lo, hi2), rim: number[] = [];
  for (let n = 0; n < K; n++) {
    if (!head[rep[n]]) continue;
    for (let s = start[n]; s < start[n + 1]; s++) if (!head[rep[nb[s]]]) { rim.push(n); break; }
  }
  for (const n of rim) { dist[n] = 0; push(0, n); }
  while (heap.length) {
    const [d, n] = pop();
    if (d > dist[n] || d > len) continue;
    const a = rep[n];
    for (let s = start[n]; s < start[n + 1]; s++) {
      const b = nb[s], r = rep[b], d2 = d + Math.hypot(P[r * 3] - P[a * 3], P[r * 3 + 1] - P[a * 3 + 1], P[r * 3 + 2] - P[a * 3 + 2]);
      if (d2 < dist[b]) { dist[b] = d2; push(d2, b); }
    }
  }
  // a piece of skin not joined to the head (an eye, a collar, a body made apart from it): its straight distance
  for (let n = 0; n < K; n++) {
    if (holds[root(n)] || head[rep[n]]) continue;
    const a = rep[n];
    for (const r0 of rim) {
      const r = rep[r0];
      dist[n] = Math.min(dist[n], Math.hypot(P[r * 3] - P[a * 3], P[r * 3 + 1] - P[a * 3 + 1], P[r * 3 + 2] - P[a * 3 + 2]));
    }
  }
  const take = new Float32Array(N), inPart = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const d = dist[node[i]], t = Math.max(0, Math.min(1, ((head[i] ? d : -d) + lo) / Math.max(1e-12, lo + hi2)));
    take[i] = t * t * (3 - 2 * t);
    if (take[i] > 0) inPart[i] = 1;
  }
  return { inPart, head, take, height };
}

/**
 * The neck and head let go of their arm weights, each vertex by its share (neckPart), on new skin
 * attributes; the old ones are kept as partWeights. What a vertex lets go of goes to the other bones
 * it follows, in the shares it had (one with only arm weights: to the bone it's nearest by shape).
 * Integer weights keep their exact sum, so at rest every vertex sits where it did. Returns how many
 * vertices changed, or null if done already.
 */
export function steadyHead(m: THREE.SkinnedMesh, fade = FADE) {
  const g = m.geometry, bones = m.skeleton.bones;
  if (g.userData.partWeights || !g.attributes.skinIndex || !g.attributes.skinWeight) return null;
  const np = neckPart(m, fade);
  if (!np) return null;
  const hi = bones.findIndex(b => b.name === 'Head'), arm = bones.map(b => ARM.test(b.name));
  const old = { si: g.attributes.skinIndex, sw: g.attributes.skinWeight };
  const si = old.si.clone() as THREE.BufferAttribute, sw = old.sw.clone() as THREE.BufferAttribute;
  const I = si.array, W = sw.array, whole = sw.normalized && !(W instanceof Float32Array);
  let changed = 0;
  for (let i = 0; i < np.inPart.length; i++) {
    const f = np.take[i];
    if (!np.inPart[i] || f <= 0) continue;
    const w = [0, 1, 2, 3].map(k => W[i * 4 + k]), b = [0, 1, 2, 3].map(k => I[i * 4 + k]);
    let a = 0, o = 0;
    for (let k = 0; k < 4; k++) if (w[k] > 0) { if (arm[b[k]]) a += w[k]; else o += w[k]; }
    if (a <= 0) continue;
    const sum = w.reduce((s, x) => s + x, 0);
    // skin that is nearly all arm lets go of less (none if it's all arm), so it changes smoothly into the arm's
    const f2 = f * Math.min(1, o / (MIXED * sum));
    if (f2 <= 0) continue;
    const nw = w.map((x, k) => (arm[b[k]] ? x * (1 - f2) : x));
    // what each arm lets go of goes to the Head bone: its own slot, an empty one (an arm's let go of in
    // full); in the head, else the place of the arm that keeps the least, with what it keeps; below the
    // head, else the vertex's biggest bone that isn't an arm's, so the change fades out smoothly
    for (let k = 0; k < 4; k++) {
      if (!arm[b[k]] || w[k] <= 0) continue;
      let give = w[k] * f2, t = b.indexOf(hi);
      if (t < 0) t = nw.findIndex(x => x <= 0);
      if (t < 0 && np.head[i]) {
        for (let q = 0; q < 4; q++) if (arm[b[q]] && (t < 0 || nw[q] < nw[t])) t = q;
        give += nw[t]; nw[t] = 0;
      }
      if (t < 0) for (let q = 0; q < 4; q++) if (!arm[b[q]] && (t < 0 || nw[q] > nw[t])) t = q;
      if (nw[t] <= 0) { b[t] = hi; nw[t] = 0; }
      nw[t] += give;
    }
    // the biggest slot takes up the rounding
    let h = 0;
    for (let k = 1; k < 4; k++) if (nw[k] > nw[h]) h = k;
    nw[h] = 0;
    nw[h] = sum - nw.reduce((s, x) => s + x, 0);
    if (whole) {
      // whole numbers with the same total: round down, then give the remainders out largest first
      const fl = nw.map(Math.floor), left = sum - fl.reduce((s, x) => s + x, 0);
      [0, 1, 2, 3].sort((x, y) => nw[y] - fl[y] - (nw[x] - fl[x])).slice(0, left).forEach(k => fl[k]++);
      fl.forEach((x, k) => (nw[k] = x));
    }
    let diff = false;
    for (let k = 0; k < 4; k++) if (W[i * 4 + k] !== nw[k] || I[i * 4 + k] !== b[k]) diff = true;
    if (!diff) continue;
    for (let k = 0; k < 4; k++) { W[i * 4 + k] = nw[k]; I[i * 4 + k] = b[k]; }
    changed++;
  }
  g.userData.partWeights = old;
  g.setAttribute('skinIndex', si);
  g.setAttribute('skinWeight', sw);
  return { part: np.inPart.reduce((s, x) => s + x, 0), changed };
}
