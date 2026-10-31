// Where things go in the Fact Garden (three/gardenScene.ts), and what the buddy can't walk through. Pure
// numbers, no three.js, so it can be checked: every plot on the land, the buddy never inside a rock.
//
// The plots stand in two rows: the four fact plots (plus, take away, times, share) along the back row in
// front of the little house, as before, and the skill areas (fractions, place value, decimals and money,
// and any added later) in a second row in front, each row with its own path. More areas make the rows
// longer and the island bigger, so every plot is always on the land and can be walked to.

// ---------- sizes, in metres ----------
export const CELL = 0.62;
export const BED_L = 11 * CELL + 0.5;
export const BED_D = 0.82, BED_H = 0.32, RIM = 0.07;
export const SOIL_Y = BED_H - 0.05;
/** from one bed to the next, front to back */
export const ROW = 1.35;
/** from one plot to the next along a row */
export const PLOT_GAP = 17;
/** the path in front of a row of plots, from the row's front bed */
export const PATH_Z = 1.55;
/** the front row's distance in front of the back row */
export const ROW_Z = 21;
/** the island's grass reaches at least this far from the middle */
export const MIN_LAND = 48;
/** a plant's place along a bed, for column c (0 to 10) */
export const plantX = (c: number) => -BED_L / 2 + 0.25 + (c + 0.5) * CELL;
/** a bed's place behind its plot's front, for bed j */
export const bedZ = (j: number) => -j * ROW;

export type PlotPlace = { x: number; z: number; row: number };
/** Each plot's middle front (x, and z of its front bed), and its row (0 back, 1 front). Four or fewer:
 *  one row. More: the first half (at least four) along the back row, the rest along the front. */
export function plotPlaces(n: number): PlotPlace[] {
  const back = n <= 4 ? n : Math.max(4, Math.ceil(n / 2)), front = n - back;
  return Array.from({ length: n }, (_, i) => {
    const row = i < back ? 0 : 1, k = row ? front : back, c = row ? i - back : i;
    return { x: (c - (k - 1) / 2) * PLOT_GAP, z: row ? ROW_Z : 0, row };
  });
}
/** a row's path (z) */
export const pathZ = (row: number) => (row ? ROW_Z : 0) + PATH_Z;
/** how deep a plot is, front bed to back bed (metres) */
export const plotDepth = (beds: number) => Math.max(0, beds - 1) * ROW;
/** A plot's ground, sign posts and path included: x0..x1, z0 (back) .. z1 (its path's far edge). */
export function plotRect(p: PlotPlace, beds: number) {
  return { x0: p.x - BED_L / 2 - 1.3, x1: p.x + BED_L / 2 + 1.2, z0: p.z - plotDepth(beds) - BED_D / 2, z1: p.z + PATH_Z + 1.6 };
}
/** The little house and the surprises behind the back row reach this far back (the golden flower). */
export const BACK_REACH = 36.5;
/** How big the island has to be: every plot and its path on the grass with room to walk round it. */
export function landRadius(places: PlotPlace[], beds: number[]): number {
  let need = BACK_REACH + 4;
  places.forEach((p, i) => {
    const r = plotRect(p, beds[i] ?? 11);
    for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) need = Math.max(need, Math.hypot(x, z) + 4);
  });
  return Math.max(MIN_LAND, Math.ceil(need));
}
/** how far from the middle the buddy can walk */
export const walkRadius = (land: number) => land - 2;
/** Where the paths between rows cross: beside each front-row plot (the gaps between them and the ends). */
export function crossings(places: PlotPlace[]): number[] {
  const front = places.filter(p => p.row === 1).map(p => p.x).sort((a, b) => a - b);
  if (!front.length) return [];
  return [front[0] - PLOT_GAP / 2, ...front.slice(1).map((x, i) => (x + front[i]) / 2), front[front.length - 1] + PLOT_GAP / 2];
}

// ---------- what the buddy can't walk through ----------
/** a round thing (a rock, a tree trunk, the well) or a box (a bed, the little house) */
export type Solid = { x: number; z: number; r: number; tall?: boolean; kind?: string };
export type Box = { x0: number; x1: number; z0: number; z1: number };
type P = { x: number; z: number };
/** the buddy's own size round its feet */
export const BUDDY_R = 0.3;

function pushOut(p: P, solids: Solid[], boxes: Box[], r: number): boolean {
  let moved = false;
  for (const s of solids) {
    const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz), min = s.r + r;
    if (d < min - 1e-6) { moved = true; if (d < 1e-4) p.x = s.x + min; else { p.x = s.x + (dx / d) * min; p.z = s.z + (dz / d) * min; } }
  }
  for (const b of boxes) {
    const x0 = b.x0 - r, x1 = b.x1 + r, z0 = b.z0 - r, z1 = b.z1 + r;
    if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) {
      moved = true;
      const out = [p.x - x0, x1 - p.x, p.z - z0, z1 - p.z], m = Math.min(...out), i = out.indexOf(m);
      if (i === 0) p.x = x0; else if (i === 1) p.x = x1; else if (i === 2) p.z = z0; else p.z = z1;
    }
  }
  return moved;
}
/** Keep a spot out of everything solid and on the island: pushed out the shortest way, a few times over
 *  (out of one thing and into the next, then out of that). */
export function resolve<T extends P>(p: T, solids: Solid[], boxes: Box[], r = BUDDY_R, walkR = Infinity): T {
  for (let i = 0; i < 4; i++) {
    const moved = pushOut(p, solids, boxes, r);
    const d = Math.hypot(p.x, p.z);
    if (d > walkR) { p.x *= walkR / d; p.z *= walkR / d; }
    if (!moved) break;
  }
  return p;
}
/** Is a spot inside something solid (with the buddy's size)? */
export function blocked(p: P, solids: Solid[], boxes: Box[], r = BUDDY_R): boolean {
  return solids.some(s => Math.hypot(p.x - s.x, p.z - s.z) < s.r + r - 1e-3) || boxes.some(b => p.x > b.x0 - r + 1e-3 && p.x < b.x1 + r - 1e-3 && p.z > b.z0 - r + 1e-3 && p.z < b.z1 + r - 1e-3);
}
/**
 * A step of `dist` toward `dir` (unit), sliding along whatever is in the way: pushed out of a rock it
 * goes on round it instead of stopping dead. When it's walking straight at something, it tries turning a
 * little either side and takes the way that gets furthest. Returns how far it really got.
 */
export function step<T extends P>(p: T, dir: P, dist: number, solids: Solid[], boxes: Box[], r = BUDDY_R, walkR = Infinity): number {
  const from = { x: p.x, z: p.z };
  const tryDir = (a: number) => {
    const c = Math.cos(a), s = Math.sin(a), dx = dir.x * c - dir.z * s, dz = dir.x * s + dir.z * c;
    const q = resolve({ x: from.x + dx * dist, z: from.z + dz * dist }, solids, boxes, r, walkR);
    // how far it got the way it wanted to go
    return { q, gain: (q.x - from.x) * dir.x + (q.z - from.z) * dir.z };
  };
  let best = tryDir(0);
  if (best.gain < dist * 0.3) for (const a of [0.6, -0.6, 1.1, -1.1]) { const t = tryDir(a); if (t.gain > best.gain + 1e-4) best = t; }
  p.x = best.q.x; p.z = best.q.z;
  return Math.hypot(p.x - from.x, p.z - from.z);
}

// ---------- finding the way ----------
/** Can something of size `r` go straight from a to b? `leaving`: a is where it stands now, maybe touching something. */
export function clearLine(a: P, b: P, solids: Solid[], boxes: Box[], r = BUDDY_R, walkR = Infinity, leaving = false): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(d / 0.1));
  for (let i = 1; i <= n; i++) {
    const t = i / n, p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    if (Math.hypot(p.x, p.z) > walkR || blocked(p, solids, boxes, leaving && t * d < 0.6 ? Math.min(r, 0.2) : r)) return false;
  }
  return true;
}

/** the search's squares (a little under the buddy's width, so it can't miss a way round) */
const GRID = 0.3;
/** a smallest-first list of cells, for the search */
class Queue {
  private h: { c: number; f: number }[] = [];
  get size() { return this.h.length; }
  push(c: number, f: number) {
    const h = this.h; h.push({ c, f });
    for (let i = h.length - 1; i > 0;) { const u = (i - 1) >> 1; if (h[u].f <= h[i].f) break; [h[u], h[i]] = [h[i], h[u]]; i = u; }
  }
  pop(): number {
    const h = this.h, top = h[0], end = h.pop()!;
    if (h.length) {
      h[0] = end;
      for (let i = 0; ;) {
        let m = i; const a = 2 * i + 1, b = a + 1;
        if (a < h.length && h[a].f < h[m].f) m = a;
        if (b < h.length && h[b].f < h[m].f) m = b;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]]; i = m;
      }
    }
    return top.c;
  }
}
/** The shortest way across a grid laid over the two spots with `pad` metres round them; null if there's none in there. */
function gridWay(from: P, to: P, pad: number, away: number, solids: Solid[], boxes: Box[], r: number, walkR: number): P[] | null {
  const x0 = Math.min(from.x, to.x) - pad, x1 = Math.max(from.x, to.x) + pad, z0 = Math.min(from.z, to.z) - pad, z1 = Math.max(from.z, to.z) + pad;
  // (only what's in the search's box counts)
  const S = solids.filter(s => s.x + s.r + r > x0 && s.x - s.r - r < x1 && s.z + s.r + r > z0 && s.z - s.r - r < z1);
  const B = boxes.filter(b => b.x1 + r > x0 && b.x0 - r < x1 && b.z1 + r > z0 && b.z0 - r < z1);
  const si = Math.round((from.x - x0) / GRID), sj = Math.round((from.z - z0) / GRID);
  const ox = from.x - si * GRID, oz = from.z - sj * GRID;
  const W = Math.ceil((x1 - ox) / GRID) + 1, H = Math.ceil((z1 - oz) / GRID) + 1, N = W * H;
  const at = (c: number): P => ({ x: ox + (c % W) * GRID, z: oz + Math.floor(c / W) * GRID });
  // the cells something stands on (a hair wider than the buddy, so a step between two free cells is clear);
  // if the buddy is touching something where it starts, the `away` cells round it stay free so it can step off
  const R = r + 0.05, shut = new Uint8Array(N);
  const span = (a: number, b: number, o: number, n: number) => [Math.max(0, Math.ceil((a - o) / GRID)), Math.min(n - 1, Math.floor((b - o) / GRID))];
  for (const s of S) {
    const R2 = (s.r + R) ** 2, [i0, i1] = span(s.x - s.r - R, s.x + s.r + R, ox, W), [j0, j1] = span(s.z - s.r - R, s.z + s.r + R, oz, H);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if ((ox + i * GRID - s.x) ** 2 + (oz + j * GRID - s.z) ** 2 < R2) shut[j * W + i] = 1;
  }
  for (const b of B) {
    const [i0, i1] = span(b.x0 - R, b.x1 + R, ox, W), [j0, j1] = span(b.z0 - R, b.z1 + R, oz, H);
    for (let j = j0; j <= j1; j++) shut.fill(1, j * W + i0, j * W + i1 + 1);
  }
  if (shut[sj * W + si]) for (let j = Math.max(0, sj - away); j <= Math.min(H - 1, sj + away); j++) for (let i = Math.max(0, si - away); i <= Math.min(W - 1, si + away); i++) shut[j * W + i] = 0;
  const free = (c: number) => { if (shut[c]) return false; const p = at(c); return Math.hypot(p.x, p.z) <= walkR; };
  const left = (c: number) => { const p = at(c), dx = Math.abs(p.x - to.x), dz = Math.abs(p.z - to.z); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), q = new Queue();
  const start = sj * W + si;
  g[start] = 0; q.push(start, left(start));
  while (q.size) {
    const c = q.pop(), i = c % W, j = Math.floor(c / W);
    if (left(c) < GRID * 2 && clearLine(at(c), to, S, B, r, walkR, c === start)) {
      // (only the corners: a straight run of cells is one step)
      const way: P[] = [];
      for (let k = c, next = -1; k !== start && k >= 0; next = k, k = came[k]) if (next < 0 || next - k !== k - came[k]) way.push(at(k));
      return way.reverse();
    }
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj, n = b * W + a;
      if ((!di && !dj) || a < 0 || b < 0 || a >= W || b >= H || !free(n)) continue;
      // (never cutting across the corner of something)
      if (di && dj && (!free(j * W + a) || !free(b * W + i))) continue;
      const d = g[c] + GRID * (di && dj ? Math.SQRT2 : 1);
      // (the distance left counts a little extra: far fewer cells to look at, and tighten() takes up the slack)
      if (d < g[n] - 1e-4) { g[n] = d; came[n] = c; q.push(n, d + left(n) * 1.15); }
    }
  }
  return null;
}
/** Pull a way tight: from each corner on to the furthest one it can reach in a straight line. */
function tighten(way: P[], solids: Solid[], boxes: Box[], r: number, walkR: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < way.length - 1;) {
    let j = way.length - 1;
    while (j > i + 1 && !clearLine(way[i], way[j], solids, boxes, r, walkR, i === 0)) j--;
    out.push(way[j]); i = j;
  }
  return out;
}
/**
 * The way from one spot to another, as the corners to walk through (the last one is `to`): straight if it
 * can be, otherwise the shortest way round what's in between, along the aisle it's in and round the signs
 * and the ends of the beds. `to` should be a spot the buddy can stand on (resolve). If there's really no
 * way, it's just `to`, and the walk slides along whatever it meets.
 */
export function findRoute(from: P, to: P, solids: Solid[], boxes: Box[], r = BUDDY_R, walkR = Infinity): P[] {
  const end = { x: to.x, z: to.z };
  if (clearLine(from, end, solids, boxes, r, walkR, true)) return [end];
  for (const [pad, away] of [[5, 1], [5, 3], [12, 1], [30, 3]]) {
    const way = gridWay(from, end, pad, away, solids, boxes, r, walkR);
    if (way) return tighten([{ x: from.x, z: from.z }, ...way, end], solids, boxes, r, walkR);
  }
  return [end];
}
/** How long a way is, from `from` through its corners. */
export function routeLength(from: P, way: P[]): number {
  return way.reduce((a, q, i) => { const p = i ? way[i - 1] : from; return a + Math.hypot(q.x - p.x, q.z - p.z); }, 0);
}
