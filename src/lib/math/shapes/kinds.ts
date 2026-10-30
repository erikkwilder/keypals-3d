// Named shapes, made fresh each time: a shape of a kind (a triangle, a rhombus, a hexagon...) with its own
// proportions, size and turn, so "a triangle" is never only the upright one. `wild` makes the less usual
// members of a kind (skinny, lopsided, turned a lot): what the harder rungs ask about. Shapes come out in
// a 10 by 10 box (grid units), ready for a picture.
import type { Rng } from '../../engine/rng';
import { fit, regular, turn, type P } from './geo';

export type Kind = 'triangle' | 'right-triangle' | 'square' | 'rectangle' | 'rhombus' | 'parallelogram' | 'trapezoid' | 'kite'
  | 'quadrilateral' | 'pentagon' | 'hexagon' | 'octagon' | 'circle' | 'arrow' | 'ell';
export const KIND_NAME: Record<Kind, string> = {
  triangle: 'triangle', 'right-triangle': 'right triangle', square: 'square', rectangle: 'rectangle', rhombus: 'rhombus', parallelogram: 'parallelogram',
  trapezoid: 'trapezoid', kite: 'kite', quadrilateral: 'quadrilateral', pentagon: 'pentagon', hexagon: 'hexagon', octagon: 'octagon', circle: 'circle',
  arrow: 'arrow shape', ell: 'L shape',
};
/** "a" or "an" before a word */
export const an = (w: string) => (/^[aeiou]/i.test(w) ? `an ${w}` : `a ${w}`);
/** the plural for a kind's name */
export const plural = (w: string) => (w.endsWith('s') ? w : `${w}s`);

const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo);
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];

/** The corners of a shape of this kind (a circle is a 40-sided stand-in; pictures draw it round). */
export function shapeOf(rng: Rng, kind: Kind, opt: { wild?: boolean; turn?: number; size?: number } = {}): P[] {
  const w = !!opt.wild;
  let pts: P[];
  switch (kind) {
    case 'triangle': {
      // upright and even, or (wild) any three corners that aren't nearly in a line
      if (!w) { const h = between(rng, 0.8, 1.1), sk = between(rng, -0.15, 0.15); pts = [[0, h], [1, h], [0.5 + sk, 0]]; }
      else { const tip = pick(rng, [-0.6, -0.3, 0.15, 0.85, 1.3]), h = between(rng, 0.35, 1.2); pts = [[0, h], [1, h], [tip, 0]]; }
      break;
    }
    case 'right-triangle': { const a = between(rng, 0.6, 1.2), b = between(rng, 0.6, 1.2); pts = [[0, 0], [0, a], [b, a]]; break; }
    case 'square': pts = [[0, 0], [1, 0], [1, 1], [0, 1]]; break;
    case 'rectangle': { const k = w ? pick(rng, [0.3, 0.38, 2.6, 3]) : pick(rng, [0.5, 0.6, 1.7, 2]); pts = [[0, 0], [k, 0], [k, 1], [0, 1]]; break; }
    case 'rhombus': {
      // four equal sides, never square: as tall as wide only when it's a square, so never that
      const h = w ? between(rng, 0.5, 0.72) : between(rng, 1.3, 1.6);
      pts = [[0, h / 2], [0.5, 0], [1, h / 2], [0.5, h]]; break;
    }
    // (its slanted sides never as long as its flat ones: that would be a rhombus)
    case 'parallelogram': { const s = w ? between(rng, 0.6, 0.75) : between(rng, 0.3, 0.5), h = w ? between(rng, 0.3, 0.45) : between(rng, 0.55, 0.8); pts = [[s, 0], [1 + s, 0], [1, h], [0, h]]; break; }
    case 'trapezoid': {
      const top = w ? between(rng, 0.15, 0.35) : between(rng, 0.45, 0.65), off = w ? pick(rng, [0, 1 - top]) : (1 - top) / 2 + between(rng, -0.1, 0.1), h = between(rng, 0.55, 0.8);
      pts = [[off, 0], [off + top, 0], [1, h], [0, h]]; break;
    }
    // (the top two sides shorter than the bottom two: equal ones would make a rhombus)
    case 'kite': { const t = w ? between(rng, 0.08, 0.14) : between(rng, 0.18, 0.28); pts = [[0.5, 0], [1, t * 2], [0.5, 1.3], [0, t * 2]]; break; }
    case 'quadrilateral': pts = [[0, 0.1], [between(rng, 0.8, 1), 0], [between(rng, 1.1, 1.3), between(rng, 0.7, 0.95)], [between(rng, 0.15, 0.35), 0.75]]; break;
    case 'pentagon': pts = w ? [[0, 0.4], [0.5, 0], [1, 0.3], [0.85, 1], [0.15, 0.9]] : regular(5, 1); break;
    case 'hexagon': pts = w ? [[0, 0.5], [0.3, 0], [0.9, 0.05], [1.1, 0.45], [0.8, 1], [0.25, 0.95]] : regular(6, 1, 0, 0, 30); break;
    case 'octagon': pts = regular(8, 1, 0, 0, 22.5 - 22.5); break;
    case 'circle': pts = regular(40, 1); break;
    case 'arrow': pts = [[0, 0.35], [0.55, 0.35], [0.55, 0], [1, 0.5], [0.55, 1], [0.55, 0.65], [0, 0.65]]; break;
    case 'ell': pts = [[0, 0], [0.45, 0], [0.45, 0.6], [1, 0.6], [1, 1], [0, 1]]; break;
  }
  const deg = opt.turn ?? 0;
  if (deg) pts = turn(pts, deg, 0.5, 0.5);
  const s = opt.size ?? 10;
  return fit(pts, s, s, 0.1);
}

/** The kinds that are NOT this one, for pictures to tell apart (no square among "rectangles": a square is
 *  one too, and a kindergartner shouldn't be tricked by it). */
export function others(kind: Kind, pool: readonly Kind[]): Kind[] {
  const clash: Partial<Record<Kind, Kind[]>> = {
    rectangle: ['square'], square: ['rectangle', 'rhombus'], rhombus: ['square', 'kite'], parallelogram: ['rectangle', 'square', 'rhombus'],
    kite: ['rhombus', 'square'], triangle: ['right-triangle'], 'right-triangle': ['triangle'], quadrilateral: ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'kite'],
  };
  const no = new Set([kind, ...(clash[kind] ?? [])]);
  return pool.filter(k => !no.has(k));
}
/** Whether a kind belongs to a family (squares are rectangles; every four-sided kind is a quadrilateral). */
export function isA(kind: Kind, family: Kind): boolean {
  if (kind === family) return true;
  const fam: Partial<Record<Kind, Kind[]>> = {
    rectangle: ['square'], rhombus: ['square'], parallelogram: ['square', 'rectangle', 'rhombus'], kite: ['square', 'rhombus'],
    quadrilateral: ['square', 'rectangle', 'rhombus', 'parallelogram', 'trapezoid', 'kite'], triangle: ['right-triangle'],
  };
  return fam[family]?.includes(kind) ?? false;
}
