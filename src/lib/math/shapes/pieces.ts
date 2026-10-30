// Shapes cut into parts (equal or not) for the "equal parts" questions and pictures: a rectangle in strips
// or a grid, a square across its corners, a circle in slices, a hexagon in triangles, a triangle down the
// middle. Each piece is its own polygon (a circle's slices follow the curve), so a picture can colour any
// of them. Unequal cuts move the cutting lines by `off` (0.25: easy to see; 0.08: look closely).
import { regular, type P } from './geo';

export type CutKind = 'strips' | 'grid' | 'diagonals' | 'circle' | 'hexagon' | 'triangle';
export type Cut = { kind: CutKind; outline: P[] | null; circle?: { c: P; r: number }; pieces: P[][] };

const arc = (c: P, r: number, a0: number, a1: number, steps = 18): P[] =>
  Array.from({ length: steps + 1 }, (_, i) => { const a = ((a0 + ((a1 - a0) * i) / steps) * Math.PI) / 180; return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)] as P; });

/** Split [0, 1] into n parts: equal, or with the cuts moved by `off` (still in order, never touching). */
function splits(n: number, off: number): number[] {
  const xs = Array.from({ length: n + 1 }, (_, i) => i / n);
  if (!off) return xs;
  // push every inside cut the same way, a little less near the end, so every part changes size
  for (let i = 1; i < n; i++) xs[i] = Math.min(xs[i + 1] - 0.04, xs[i] + (off / n) * (i % 2 ? 1 : -0.6));
  return xs;
}

/** A shape cut into n parts (`off` 0: equal). Shapes sit in a 10 by 10 box. */
export function cut(kind: CutKind, n: number, off = 0, wide = 1.5): Cut {
  if (kind === 'strips' || kind === 'grid') {
    const W = 8, H = W / wide, x0 = 1, y0 = 5 - H / 2;
    const cols = kind === 'grid' ? (n === 4 ? 2 : n === 6 ? 3 : n === 8 ? 4 : n) : n, rows = kind === 'grid' ? n / cols : 1;
    const xs = splits(cols, off), ys = splits(rows, kind === 'grid' ? off * 0.7 : 0);
    const pieces: P[][] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const a = x0 + xs[c] * W, b = x0 + xs[c + 1] * W, t = y0 + ys[r] * H, u = y0 + ys[r + 1] * H;
      pieces.push([[a, t], [b, t], [b, u], [a, u]]);
    }
    return { kind, outline: [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]], pieces };
  }
  if (kind === 'diagonals') {
    // a square cut corner to corner: 2 triangles, or 4 from the middle (moved by off: not equal)
    const s: P[] = [[1.5, 1.5], [8.5, 1.5], [8.5, 8.5], [1.5, 8.5]];
    if (n === 2) {
      if (!off) return { kind, outline: s, pieces: [[s[0], s[1], s[2]], [s[0], s[2], s[3]]] };
      const m: P = [8.5, 1.5 + 7 * Math.min(0.8, 0.45 + off)];
      return { kind, outline: s, pieces: [[s[0], s[1], m], [s[0], m, s[2], s[3]]] };
    }
    const c: P = [5 + Math.min(2.4, off * 6), 5 - Math.min(2, off * 4)];
    return { kind, outline: s, pieces: s.map((p, i) => [p, s[(i + 1) % 4], c]) };
  }
  if (kind === 'circle') {
    const c: P = [5, 5], r = 4.2;
    if (!off) return { kind, outline: null, circle: { c, r }, pieces: Array.from({ length: n }, (_, i) => [c, ...arc(c, r, -90 + (360 * i) / n, -90 + (360 * (i + 1)) / n)]) };
    // slices of different sizes: the cuts moved round
    const as = splits(n, off).map(k => -90 + k * 360);
    return { kind, outline: null, circle: { c, r }, pieces: Array.from({ length: n }, (_, i) => [c, ...arc(c, r, as[i], as[i + 1])]) };
  }
  if (kind === 'hexagon') {
    const o = Math.min(off, 0.45), h = regular(6, 4.4, 5, 5, 30), c: P = o ? [5 + o * 5, 5 - o * 3] : [5, 5];
    if (n === 6) return { kind, outline: h, pieces: h.map((p, i) => [c, p, h[(i + 1) % 6]]) };
    if (n === 3) return { kind, outline: h, pieces: [0, 2, 4].map(i => [c, h[i], h[i + 1], h[(i + 2) % 6]]) };
    // halves: across the middle (or not quite)
    const a = off ? 1 : 0;
    return { kind, outline: h, pieces: [[h[0], h[1], h[2], h[3 + a]], [h[3 + a], ...h.slice(4 + a), h[0]]] };
  }
  // a triangle: halves down the middle, or (n 4) four smaller triangles from the middles of the sides
  const t: P[] = [[5, 1.2], [9, 8.4], [1, 8.4]];
  const mid = (a: P, b: P, k = 0.5): P => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  if (n === 2) { const m = mid(t[1], t[2], Math.min(0.85, 0.5 + off * 1.2)); return { kind, outline: t, pieces: [[t[0], t[1], m], [t[0], m, t[2]]] }; }
  const k = Math.min(0.85, 0.5 + off);
  const ab = mid(t[0], t[1], k), bc = mid(t[1], t[2]), ca = mid(t[2], t[0], 1 - k);
  return { kind, outline: t, pieces: [[t[0], ab, ca], [ab, t[1], bc], [ca, bc, t[2]], [ab, bc, ca]] };
}
/** Which cuts make n parts (and their names). */
export const CUTS_FOR: Record<number, CutKind[]> = { 2: ['strips', 'diagonals', 'circle', 'hexagon', 'triangle'], 3: ['strips', 'circle', 'hexagon'], 4: ['strips', 'grid', 'diagonals', 'circle', 'triangle'], 6: ['grid', 'circle', 'hexagon'], 8: ['grid', 'circle'] };
export const PART_WORD: Record<number, string> = { 2: 'half', 3: 'third', 4: 'quarter', 6: 'sixth', 8: 'eighth' };
export const PARTS_WORD: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters', 6: 'sixths', 8: 'eighths' };
