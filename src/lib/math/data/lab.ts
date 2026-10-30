// Spin Lab: the calm Playground toy for Data and chance. No clock. Each round has three experiments: look
// at the spinner (or the die, or the two dice, or the coin), pick what you think will come up most, then
// spin or roll as many times as you like (one at a time, or ten at once) and watch a bar graph of what
// happened build up. A star for each smart pick: the most likely one, whatever the spins then do (a smart
// pick can still lose a few spins; over lots of spins, the graph grows toward the chances).
//   1 Two colours: a spinner with more of one colour than the other
//   2 Three colours: one colour has the most parts
//   3 Roll a die: every number is as likely (any pick is smart: the graph evens out)
//   4 Two dice: the totals pile up in the middle (7 is the most likely)
//   5 Mixed up: spinners of 8 or 10 parts in three or four colours
import type { Rng } from '../../engine/rng';
import { COLORS, type ColorId } from './pics';

export type LabKind = 'spinner' | 'die' | 'dice2';
export type Experiment = {
  kind: LabKind;
  /** a spinner's parts (equal, each a colour) */
  parts?: ColorId[];
  /** what can come up, in the graph's order (colours, or numbers as text) */
  outcomes: string[];
  /** how many ways each outcome can happen (its chance is ways / all the ways) */
  ways: number[];
  /** spins or rolls to make before the graph's done */
  target: number;
};
export const LAB_LEVELS = 5;
export const EXPERIMENTS = 3;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
function shuffled<T>(rng: Rng, xs: readonly T[]): T[] { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rng() * (i + 1))); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** a spinner of `counts` parts per colour, the colours mixed round it */
function spinner(rng: Rng, counts: number[]): Experiment {
  const cols = shuffled(rng, COLORS).slice(0, counts.length);
  const left = counts.slice();
  const parts: ColorId[] = [];
  const n = counts.reduce((t, x) => t + x, 0);
  for (let i = 0; i < n; i++) {
    const order = left.map((c, k) => ({ c, k })).filter(x => x.c > 0).sort((a, b) => b.c - a.c);
    const prev = parts[parts.length - 1];
    const o = order.find(x => cols[x.k] !== prev) ?? order[0];
    parts.push(cols[o.k]); left[o.k]--;
  }
  return { kind: 'spinner', parts, outcomes: cols, ways: counts, target: 20 };
}

/** The i-th experiment of a round at this level. */
export function experiment(level: number, i: number, rng: Rng): Experiment {
  const L = Math.max(1, Math.min(LAB_LEVELS, level));
  if (L === 1) return spinner(rng, pick(rng, [[3, 1], [5, 3], [2, 1], [4, 2]]));
  if (L === 2) return spinner(rng, pick(rng, [[3, 2, 1], [4, 1, 1], [3, 1, 2], [2, 3, 1]]));
  if (L === 3) return i === 1 ? { kind: 'die', outcomes: ['1', '2', '3', '4', '5', '6'], ways: [1, 1, 1, 1, 1, 1], target: 30 } : spinner(rng, pick(rng, [[3, 2, 1], [4, 2, 2]]));
  if (L === 4) return i === 2 ? spinner(rng, [4, 3, 1]) : { kind: 'dice2', outcomes: ['2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'], ways: [1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1], target: 36 };
  return spinner(rng, pick(rng, [[4, 3, 1], [3, 3, 2], [5, 3, 2], [4, 3, 2, 1], [3, 2, 2, 1]]));
}
/** Whether a pick is a smart one: no outcome has more ways. */
export const smartPick = (e: Experiment, k: number) => e.ways[k] === Math.max(...e.ways);
/** One spin or roll: the index of the outcome it gave (fair: every part, face or pair of faces as likely). */
export function trial(e: Experiment, rng: Rng): { k: number; faces?: number[]; part?: number } {
  if (e.kind === 'spinner') { const part = Math.min(e.parts!.length - 1, Math.floor(rng() * e.parts!.length)); return { k: e.outcomes.indexOf(e.parts![part]), part }; }
  const d = () => 1 + Math.min(5, Math.floor(rng() * 6));
  if (e.kind === 'die') { const a = d(); return { k: a - 1, faces: [a] }; }
  const a = d(), b = d();
  return { k: a + b - 2, faces: [a, b] };
}
/** Stars for a round: one per smart pick. */
export const labStars = (smart: number): 0 | 1 | 2 | 3 => (Math.max(0, Math.min(3, smart)) as 0 | 1 | 2 | 3);
