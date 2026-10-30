// What a child is asked to make on the dot grid (the 'dot-grid' input in a question, and the Shape Builder
// toy's challenges): a shape with so many sides, a named four-sided shape, a shape with a given area. Each
// rule says itself in plain words and checks any shape a child makes; an example shape for each is the
// question's own answer.
import { areaOf, clean, factsOf, selfCrosses, type P } from './geo';

export type QuadName = 'square' | 'rectangle' | 'rect-not-square' | 'not-rect' | 'trapezoid' | 'parallelogram' | 'rhombus';
export type GridRule =
  | { k: 'poly'; sides: number; rightMin?: number }
  | { k: 'quad'; name: QuadName }
  | { k: 'area'; area: number; shape: 'rectangle' | 'triangle' | 'parallelogram' };

const QUAD_WORDS: Record<QuadName, string> = {
  square: 'a square', rectangle: 'a rectangle', 'rect-not-square': 'a rectangle that is not a square', 'not-rect': 'a shape with 4 sides that is not a rectangle',
  trapezoid: 'a trapezoid (just one pair of sides that go the same way)', parallelogram: 'a parallelogram that is not a rectangle', rhombus: 'a rhombus that is not a square',
};
/** The rule in words: "Make a shape with 5 sides." */
export function ruleText(r: GridRule): string {
  if (r.k === 'poly') return `Make a shape with ${r.sides} sides${r.rightMin ? ` and ${r.rightMin === 1 ? 'a right angle' : `at least ${r.rightMin} right angles`}` : ''}.`;
  if (r.k === 'quad') return `Make ${QUAD_WORDS[r.name]}.`;
  return `Make ${r.shape === 'rectangle' ? 'a rectangle' : r.shape === 'triangle' ? 'a triangle' : 'a parallelogram that is not a rectangle'} with an area of ${r.area} squares.`;
}
/** A short label for the rule ("5 sides", "area 6"). */
export function ruleShort(r: GridRule): string {
  if (r.k === 'poly') return `${r.sides} sides${r.rightMin ? ', right angle' : ''}`;
  if (r.k === 'quad') return ({ square: 'a square', rectangle: 'a rectangle', 'rect-not-square': 'a long rectangle', 'not-rect': 'not a rectangle', trapezoid: 'a trapezoid', parallelogram: 'a parallelogram', rhombus: 'a rhombus' } as const)[r.name];
  return `${r.shape}, area ${r.area}`;
}

/** Whether a shape (its corners in order) follows the rule. */
export function ruleOk(r: GridRule, raw: P[]): boolean {
  const pts = clean(raw);
  if (pts.length < 3 || selfCrosses(pts) || areaOf(pts) < 1e-6) return false;
  const f = factsOf(pts);
  if (r.k === 'poly') return f.sides === r.sides && f.right >= (r.rightMin ?? 0);
  if (r.k === 'quad') {
    if (f.sides !== 4 || !f.convex) return r.name === 'not-rect' && f.sides === 4;
    const has = (n: string) => f.family.includes(n);
    switch (r.name) {
      case 'square': return has('square');
      case 'rectangle': return has('rectangle');
      case 'rect-not-square': return has('rectangle') && !has('square');
      case 'not-rect': return !has('rectangle');
      case 'trapezoid': return f.parallel === 1;
      case 'parallelogram': return has('parallelogram') && !has('rectangle');
      case 'rhombus': return has('rhombus') && !has('square');
    }
  }
  if (r.k === 'area') {
    if (Math.abs(f.area - r.area) > 1e-6) return false;
    if (r.shape === 'triangle') return f.sides === 3;
    if (r.shape === 'rectangle') return f.family.includes('rectangle');
    return f.family.includes('parallelogram') && !f.family.includes('rectangle');
  }
  return false;
}

/** One shape that follows the rule, on a grid at least 6 by 6 (corners 0..5). */
export function exampleFor(r: GridRule): P[] {
  if (r.k === 'poly') {
    const ex: Record<number, P[]> = {
      3: r.rightMin ? [[0, 4], [4, 4], [0, 1]] : [[0, 4], [4, 4], [2, 1]], 4: [[1, 1], [4, 1], [4, 4], [1, 4]], 5: [[0, 4], [4, 4], [4, 2], [2, 0], [0, 2]],
      6: [[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [0, 4]], 7: [[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [1, 5], [0, 4]], 8: [[1, 0], [3, 0], [4, 1], [4, 3], [3, 4], [1, 4], [0, 3], [0, 1]],
    };
    return ex[r.sides] ?? ex[4];
  }
  if (r.k === 'quad') {
    const ex: Record<QuadName, P[]> = {
      square: [[1, 1], [3, 1], [3, 3], [1, 3]], rectangle: [[0, 1], [4, 1], [4, 3], [0, 3]], 'rect-not-square': [[0, 1], [4, 1], [4, 3], [0, 3]],
      'not-rect': [[0, 3], [4, 3], [3, 1], [1, 0]], trapezoid: [[0, 3], [4, 3], [3, 1], [1, 1]], parallelogram: [[1, 1], [4, 1], [3, 3], [0, 3]], rhombus: [[0, 2], [2, 1], [4, 2], [2, 3]],
    };
    return ex[r.name];
  }
  if (r.shape === 'rectangle') {
    // a long rectangle that fits: area as w x h with w <= 5, h <= 5
    for (const w of [5, 4, 3, 2, 1]) if (r.area % w === 0 && r.area / w <= 5) return [[0, 0], [w, 0], [w, r.area / w], [0, r.area / w]];
  }
  if (r.shape === 'triangle') {
    // base x height = twice the area
    for (const b of [5, 4, 3, 2, 1]) { const h = (r.area * 2) / b; if (Number.isInteger(h) && h <= 5) return [[0, h], [b, h], [0, 0]]; }
  }
  if (r.shape === 'parallelogram') {
    for (const b of [4, 3, 2, 1]) { const h = r.area / b; if (Number.isInteger(h) && h <= 5 && b + 1 <= 5) return [[1, 0], [b + 1, 0], [b, h], [0, h]]; }
  }
  return [[0, 0], [1, 0], [1, 1], [0, 1]];
}
/** A shape as a choice id ("0,4;4,4;2,1"), and back. */
export const encodePts = (pts: P[]) => pts.map(([x, y]) => `${x},${y}`).join(';');
export function decodePts(id: string): P[] | null {
  const pts = id.split(';').map(s => s.split(',').map(Number) as P);
  return pts.length >= 3 && pts.every(p => p.length === 2 && p.every(Number.isFinite)) ? pts : null;
}
