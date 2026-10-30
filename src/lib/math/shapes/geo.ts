// Shapes and angles: the geometry under every picture, question, game and toy of the area. A polygon is
// a list of points (x right, y down, in grid units). From the points alone this works out what a child
// would say about the shape: how many sides and corners, its angles (and which are right, acute or
// obtuse), equal sides, parallel sides, lines of symmetry, its area, and its name (square, rectangle,
// rhombus, kite, trapezoid, parallelogram; equilateral, isosceles, scalene and right triangles). The
// skills, Shape Shifter's rules, the dot-grid input and the Shape Builder toy all ask it the same way.
export type P = [number, number];

const EPS = 1e-6;
const near = (a: number, b: number, e = 1e-4) => Math.abs(a - b) < e;
export const dist = (a: P, b: P) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Twice the signed area (positive: the points go clockwise on screen, y down). */
function area2(pts: P[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s;
}
/** The area inside a polygon (square units). */
export const areaOf = (pts: P[]) => Math.abs(area2(pts)) / 2;
/** The same points without repeats and without corners that are really a straight side (three in a row). */
export function clean(pts: P[]): P[] {
  let out = pts.filter((p, i) => i === 0 || dist(p, pts[i - 1]) > EPS);
  if (out.length > 1 && dist(out[0], out[out.length - 1]) < EPS) out = out.slice(0, -1);
  let changed = true;
  while (changed && out.length > 3) {
    changed = false;
    for (let i = 0; i < out.length; i++) {
      const a = out[(i + out.length - 1) % out.length], b = out[i], c = out[(i + 1) % out.length];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < EPS) { out = out.filter((_, j) => j !== i); changed = true; break; }
    }
  }
  return out;
}
/** Side i runs from point i to point i + 1. */
export const sideLengths = (pts: P[]) => pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]));

/** The inside angle at each corner, in degrees (a polygon that doesn't cross itself). */
export function angles(pts: P[]): number[] {
  const n = pts.length, cw = area2(pts) > 0;
  return pts.map((b, i) => {
    const a = pts[(i + n - 1) % n], c = pts[(i + 1) % n];
    const v1 = [a[0] - b[0], a[1] - b[1]], v2 = [c[0] - b[0], c[1] - b[1]];
    const dot = v1[0] * v2[0] + v1[1] * v2[1], cross = v1[0] * v2[1] - v1[1] * v2[0];
    let deg = (Math.atan2(Math.abs(cross), dot) * 180) / Math.PI;
    // a corner that turns the other way from the shape's own turning is a dent: its inside angle is reflex
    const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if ((cw && turn < -EPS) || (!cw && turn > EPS)) deg = 360 - deg;
    return Math.round(deg * 10) / 10;
  });
}
export type AngleKind = 'acute' | 'right' | 'obtuse' | 'straight' | 'reflex';
export const angleKind = (deg: number): AngleKind => (near(deg, 90, 0.5) ? 'right' : deg < 90 ? 'acute' : near(deg, 180, 0.5) ? 'straight' : deg < 180 ? 'obtuse' : 'reflex');

/** Whether two sides (as vectors) are parallel / at right angles. */
const parallel = (u: P, v: P) => Math.abs(u[0] * v[1] - u[1] * v[0]) < 1e-6 * (Math.hypot(...u) * Math.hypot(...v) + 1);
const perpendicular = (u: P, v: P) => Math.abs(u[0] * v[0] + u[1] * v[1]) < 1e-6 * (Math.hypot(...u) * Math.hypot(...v) + 1);
const vec = (pts: P[], i: number): P => { const a = pts[i], b = pts[(i + 1) % pts.length]; return [b[0] - a[0], b[1] - a[1]]; };
/** Pairs of sides that are parallel (as index pairs). */
export function parallelPairs(pts: P[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (parallel(vec(pts, i), vec(pts, j))) out.push([i, j]);
  return out;
}
/** Pairs of sides that meet at right angles or cross at right angles. */
export function perpendicularPairs(pts: P[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) if (perpendicular(vec(pts, i), vec(pts, j))) out.push([i, j]);
  return out;
}
export function convex(pts: P[]): boolean { return angles(pts).every(a => a < 180 - 0.01); }
/** Whether the sides cross each other (a bow tie isn't a shape). */
export function selfCrosses(pts: P[]): boolean {
  const n = pts.length;
  const seg = (p: P, q: P, r: P, s: P) => {
    const d = (a: P, b: P, c: P) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const d1 = d(p, q, r), d2 = d(p, q, s), d3 = d(r, s, p), d4 = d(r, s, q);
    return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
  };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
    if (seg(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return true;
  }
  return false;
}

/** How many lines of symmetry: the lines through the middle (the average of the corners) and a corner or
 *  the middle of a side, that fold the shape onto itself. */
export function symmetryLines(pts: P[]): { a: P; b: P }[] {
  const n = pts.length, c: P = [pts.reduce((t, p) => t + p[0], 0) / n, pts.reduce((t, p) => t + p[1], 0) / n];
  const cands: P[] = [...pts, ...pts.map((p, i) => [(p[0] + pts[(i + 1) % n][0]) / 2, (p[1] + pts[(i + 1) % n][1]) / 2] as P)];
  const out: { a: P; b: P }[] = [];
  const seen: number[] = [];
  for (const q of cands) {
    const dx = q[0] - c[0], dy = q[1] - c[1], len = Math.hypot(dx, dy);
    if (len < EPS) continue;
    const ux = dx / len, uy = dy / len;
    const ang = ((Math.atan2(uy, ux) * 180) / Math.PI + 360) % 180;
    if (seen.some(s => near(s, ang, 0.01) || near(Math.abs(s - ang), 180, 0.01))) continue;
    const refl = (p: P): P => { const px = p[0] - c[0], py = p[1] - c[1], k = px * ux + py * uy; return [c[0] + 2 * k * ux - px, c[1] + 2 * k * uy - py]; };
    if (pts.every(p => { const r = refl(p); return pts.some(o => dist(o, r) < 1e-4); })) {
      seen.push(ang);
      const far = Math.max(...pts.map(p => dist(p, c))) * 1.25;
      out.push({ a: [c[0] - ux * far, c[1] - uy * far], b: [c[0] + ux * far, c[1] + uy * far] });
    }
  }
  return out;
}

export type ShapeFacts = {
  sides: number; corners: number; angles: number[]; right: number; acute: number; obtuse: number; reflex: number;
  equalSides: boolean; equalAngles: boolean; parallel: number; perpendicular: number; symmetry: number; area: number;
  name: string; family: string[]; convex: boolean;
};
const POLY_NAME: Record<number, string> = { 3: 'triangle', 4: 'quadrilateral', 5: 'pentagon', 6: 'hexagon', 7: 'heptagon', 8: 'octagon', 9: 'nonagon', 10: 'decagon' };

/** Everything a child might say about a polygon, and its best name (with the family names that also fit:
 *  a square is also a rectangle, a rhombus, a parallelogram and a quadrilateral). */
export function factsOf(raw: P[]): ShapeFacts {
  const pts = clean(raw), n = pts.length;
  const ang = angles(pts), ls = sideLengths(pts);
  const eqSides = ls.every(l => near(l, ls[0], 1e-3)), eqAngles = ang.every(a => near(a, ang[0], 0.6));
  const right = ang.filter(a => angleKind(a) === 'right').length, acute = ang.filter(a => angleKind(a) === 'acute').length;
  const obtuse = ang.filter(a => angleKind(a) === 'obtuse').length, reflex = ang.filter(a => a > 180.5).length;
  const par = parallelPairs(pts).length, perp = perpendicularPairs(pts).length;
  const family: string[] = [];
  let name = POLY_NAME[n] ?? `${n}-sided shape`;
  if (n === 3) {
    const eq = ls.filter((l, i) => ls.some((m, j) => j !== i && near(l, m, 1e-3))).length;
    const bySide = eqSides ? 'equilateral' : eq >= 2 ? 'isosceles' : 'scalene';
    const byAngle = right ? 'right' : obtuse ? 'obtuse' : 'acute';
    family.push(`${bySide} triangle`, `${byAngle} triangle`, 'triangle', 'polygon');
    name = right ? 'right triangle' : eqSides ? 'equilateral triangle' : 'triangle';
  } else if (n === 4 && reflex === 0) {
    const p01 = parallel(vec(pts, 0), vec(pts, 2)), p12 = parallel(vec(pts, 1), vec(pts, 3));
    const pg = p01 && p12, trap = p01 || p12;
    const rect = pg && right === 4, rhom = eqSides;
    const kite = !rhom && ((near(ls[0], ls[1], 1e-3) && near(ls[2], ls[3], 1e-3)) || (near(ls[1], ls[2], 1e-3) && near(ls[3], ls[0], 1e-3)));
    if (rect && rhom) family.push('square');
    if (rect) family.push('rectangle');
    if (rhom) family.push('rhombus');
    if (pg) family.push('parallelogram');
    if (trap) family.push('trapezoid');
    if (kite || rhom) family.push('kite');
    family.push('quadrilateral', 'polygon');
    name = rect && rhom ? 'square' : rect ? 'rectangle' : rhom ? 'rhombus' : pg ? 'parallelogram' : trap ? 'trapezoid' : kite ? 'kite' : 'quadrilateral';
  } else {
    if (eqSides && eqAngles) family.push(`regular ${name}`);
    family.push(name, 'polygon');
  }
  return {
    sides: n, corners: n, angles: ang, right, acute, obtuse, reflex, equalSides: eqSides, equalAngles: eqAngles,
    parallel: par, perpendicular: perp, symmetry: symmetryLines(pts).length, area: Math.round(areaOf(pts) * 1000) / 1000,
    name, family, convex: reflex === 0,
  };
}

// ---------- making shapes ----------
/** A regular polygon of n corners, radius r, centred at (cx, cy), turned `rot` degrees (0: a flat bottom). */
export function regular(n: number, r: number, cx = 0, cy = 0, rot = 0): P[] {
  const base = 90 + 180 / n + rot;
  return Array.from({ length: n }, (_, i) => {
    const a = ((base + (360 * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P;
  });
}
/** Turn points by `deg` about (cx, cy). */
export function turn(pts: P[], deg: number, cx: number, cy: number): P[] {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as P);
}
/** Move and scale points so they fit a box of w by h (keeping their shape), centred. */
export function fit(pts: P[], w: number, h: number, pad = 0.12): P[] {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((w * (1 - 2 * pad)) / Math.max(EPS, x1 - x0), (h * (1 - 2 * pad)) / Math.max(EPS, y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  return pts.map(([x, y]) => [ox + x * k, oy + y * k] as P);
}
/** The middle (average of the corners). */
export const middle = (pts: P[]): P => [pts.reduce((t, p) => t + p[0], 0) / pts.length, pts.reduce((t, p) => t + p[1], 0) / pts.length];
/** Round to 3 places (pictures and ids). */
export const r3 = (x: number) => Math.round(x * 1000) / 1000;
