// Star Sketch: the calm Playground toy for negative numbers and the coordinate plane. A chalkboard map
// in an ice cave; the pairs of a picture are listed beside it. Tap each point in turn and a gold star
// lands there, joined to the last one by a line of light, until the picture appears (a sailboat, a
// kite, a fish...). No clock: a tap in the wrong place just says what was right. Five levels:
//   1  first-quadrant pictures, 4 to 6 points            (5.G.A.1)
//   2  bigger first-quadrant pictures, 7 to 10 points    (5.G.A.2)
//   3  pictures across all four quadrants                 (6.NS.C.6c)
//   4  mirror pictures: half is drawn, flip the rest over the y-axis   (6.NS.C.6b)
//   5  reflections in the lake: flip the top half over the x-axis      (6.NS.C.6b)
// Stars by slips, like the other Playground games (playground.ts slipStars).
import type { Rng } from '../../engine/rng';
import type { GridSpec } from '../skills/types';
import { neg } from '../skills/integers';

export type P = { x: number; y: number };
/** A picture: its strokes (each a line through its points; `closed` joins the last back to the first). */
export type Picture = { id: string; name: string; grid: GridSpec; strokes: { pts: P[]; closed?: boolean }[]; color: string };
/** One point to plot: where it goes, and (on the mirror levels) the point it is the mirror of. */
export type Task = { at: P; stroke: number; from?: P; axis?: 'x' | 'y' };
export type SketchLevel = { pictures: Picture[]; mirror?: 'x' | 'y' };

const p = (x: number, y: number): P => ({ x, y });
const Q1 = (n: number): GridSpec => ({ xMin: 0, xMax: n, yMin: 0, yMax: n });
const ALL = (n: number): GridSpec => ({ xMin: -n, xMax: n, yMin: -n, yMax: n });

export const SKETCH_LEVELS: SketchLevel[] = [
  { pictures: [
    { id: 'house', name: 'a little house', grid: Q1(8), color: '#e8735a', strokes: [{ pts: [p(2, 1), p(2, 4), p(4, 6), p(6, 4), p(6, 1)], closed: true }] },
    { id: 'kite', name: 'a kite', grid: Q1(8), color: '#e0567a', strokes: [{ pts: [p(4, 7), p(6, 4), p(4, 1), p(2, 4)], closed: true }] },
    { id: 'boat', name: 'a sailboat', grid: Q1(8), color: '#3f8fe0', strokes: [{ pts: [p(1, 3), p(7, 3), p(6, 1), p(2, 1)], closed: true }, { pts: [p(4, 3), p(4, 7), p(6, 4)] }] },
  ] },
  { pictures: [
    { id: 'star', name: 'a star', grid: Q1(10), color: '#f2b51e', strokes: [{ pts: [p(5, 9), p(6, 6), p(9, 6), p(7, 4), p(8, 1), p(5, 3), p(2, 1), p(3, 4), p(1, 6), p(4, 6)], closed: true }] },
    { id: 'rocket', name: 'a rocket', grid: Q1(10), color: '#7c5cf5', strokes: [{ pts: [p(5, 10), p(7, 7), p(7, 3), p(8, 1), p(2, 1), p(3, 3), p(3, 7)], closed: true }] },
    { id: 'tree', name: 'a pine tree', grid: Q1(10), color: '#2e9e6e', strokes: [{ pts: [p(5, 9), p(8, 5), p(6, 5), p(8, 2), p(2, 2), p(4, 5), p(2, 5)], closed: true }] },
  ] },
  { pictures: [
    { id: 'fish', name: 'a fish', grid: ALL(6), color: '#ef7d2b', strokes: [{ pts: [p(-5, 0), p(-2, 3), p(2, 2), p(4, 1), p(6, 3), p(6, -3), p(4, -1), p(2, -2), p(-2, -3)], closed: true }] },
    { id: 'heart', name: 'a heart', grid: ALL(6), color: '#e0567a', strokes: [{ pts: [p(0, -5), p(-5, 0), p(-5, 3), p(-3, 5), p(0, 3), p(3, 5), p(5, 3), p(5, 0)], closed: true }] },
    { id: 'penguin', name: 'a penguin', grid: ALL(6), color: '#2a5fa8', strokes: [{ pts: [p(0, 5), p(2, 3), p(3, -2), p(4, -5), p(-4, -5), p(-3, -2), p(-2, 3)], closed: true }] },
  ] },
  { mirror: 'y', pictures: [
    { id: 'butterfly', name: 'a butterfly', grid: ALL(6), color: '#a061f0', strokes: [{ pts: [p(0, 2), p(3, 5), p(5, 4), p(3, 0), p(5, -3), p(2, -4), p(0, -1), p(-2, -4), p(-5, -3), p(-3, 0), p(-5, 4), p(-3, 5)], closed: true }] },
    { id: 'crab', name: 'a crab', grid: ALL(6), color: '#e8413a', strokes: [{ pts: [p(0, 2), p(3, 2), p(5, 5), p(6, 2), p(4, -1), p(2, -3), p(-2, -3), p(-4, -1), p(-6, 2), p(-5, 5), p(-3, 2)], closed: true }] },
  ] },
  { mirror: 'x', pictures: [
    { id: 'mountain', name: 'a mountain in the lake', grid: ALL(6), color: '#3fa7e0', strokes: [{ pts: [p(-6, 0), p(-3, 4), p(-1, 2), p(2, 6), p(6, 0), p(2, -6), p(-1, -2), p(-3, -4)], closed: true }] },
    { id: 'iceberg', name: 'an iceberg', grid: ALL(6), color: '#2fb3d0', strokes: [{ pts: [p(-5, 0), p(-2, 3), p(0, 5), p(3, 2), p(5, 0), p(3, -2), p(0, -5), p(-2, -3)], closed: true }] },
  ] },
];

/** The level's pictures for a round: two of them, in a shuffled order. */
export function sketchRound(level: number, rng: Rng): Picture[] {
  const L = SKETCH_LEVELS[Math.max(0, Math.min(4, level - 1))];
  const ps = L.pictures.slice();
  for (let i = ps.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ps[i], ps[j]] = [ps[j], ps[i]]; }
  return ps.slice(0, 2);
}

/** A picture's points to plot, in order. On the mirror levels the half on the near side (right of the
 *  y-axis, or above the x-axis) is drawn already: those are `given`, and each task is the mirror of a
 *  given point. */
export function sketchTasks(pic: Picture, mirror?: 'x' | 'y'): { given: P[]; tasks: Task[] } {
  const given: P[] = [], tasks: Task[] = [];
  pic.strokes.forEach((s, k) => s.pts.forEach(q => {
    const far = mirror === 'y' ? q.x < 0 : mirror === 'x' ? q.y < 0 : true;
    if (!far) { given.push(q); return; }
    const from = mirror === 'y' ? p(-q.x, q.y) : mirror === 'x' ? p(q.x, -q.y) : undefined;
    tasks.push({ at: q, stroke: k, from, axis: mirror });
  }));
  return { given, tasks };
}

export const pairOf = (q: P) => `(${neg(q.x)}, ${neg(q.y)})`;
/** What to say after a tap in the wrong place. */
export function sketchHint(t: Task, tapped: P): string {
  if (t.from && t.axis === 'y') return tapped.x === t.from.x && tapped.y === t.from.y ? 'That one is already there! Flip it over the y-axis: the first number changes sign.' : `Flip ${pairOf(t.from)} over the y-axis: the first number changes sign, the second stays.`;
  if (t.from && t.axis === 'x') return tapped.x === t.from.x && tapped.y === t.from.y ? 'That one is already there! Flip it over the x-axis: the second number changes sign.' : `Flip ${pairOf(t.from)} over the x-axis: the second number changes sign, the first stays.`;
  if (tapped.x === t.at.y && tapped.y === t.at.x) return 'Swapped! The first number goes across, the second goes up or down.';
  if (tapped.x === t.at.x) return 'Across is right! Now check up or down.';
  if (tapped.y === t.at.y) return 'Up and down is right! Now check across.';
  return `Start at (0, 0): ${Math.abs(t.at.x)} ${t.at.x < 0 ? 'left' : 'right'}, then ${Math.abs(t.at.y)} ${t.at.y < 0 ? 'down' : 'up'}.`;
}
