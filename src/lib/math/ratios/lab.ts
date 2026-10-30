// The Smoothie Lab: a calm Playground toy, no clock. A glass of smoothie stands on the bench: mix fruit in the
// big jug until yours is the same colour, then pour. The colour is the ratio: 2 strawberries to 3 bananas is
// the same colour as 4 to 6, so any equal mix matches. Five levels:
//   1 one to one          the recipe card says 1 : 1 (two fruits, the same of each)
//   2 one to more         the card says 1 : 2, 3 : 1...
//   3 match the colour    no card: mix, look, add a little more of one, until it matches
//   4 a bigger jug        the card and how much of the first fruit to use: find how much of the second
//   5 percent smoothies   "25% mango": any mix where mango is a quarter of the fruit
// Six glasses a round; stars by slips (playground.ts slipStars).
import { type Rng } from '../../engine/rng';
import { FRUITS, type Fruit } from '../skills/ratioPic';

export type LabOrder = {
  fruits: [Fruit, Fruit]; ratio: [number, number];
  /** what the card shows: the recipe, nothing (match by colour), or a percent of the first fruit */
  card: 'recipe' | 'none' | 'percent';
  /** level 4: the first fruit's amount is set; level 5: the percent */
  first?: number; pct?: number;
};
export const GLASSES = 6;
/** the jug's size */
export const JUG_MAX = 24;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));

const RATIOS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[1, 2], [2, 1], [1, 3], [3, 1]],
  3: [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]],
  4: [[1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 4]],
};
const PCT: [number, [number, number]][] = [[50, [1, 1]], [25, [1, 3]], [75, [3, 1]], [20, [1, 4]], [40, [2, 3]], [60, [3, 2]]];

/** The glasses of a round at a level (never loops). */
export function labOrders(level: number, rng: Rng): LabOrder[] {
  const lv = Math.max(1, Math.min(5, level));
  return Array.from({ length: GLASSES }, () => {
    const i = int(rng, 0, 5), fruits: [Fruit, Fruit] = [FRUITS[i], FRUITS[(i + int(rng, 1, 5)) % 6]];
    if (lv === 5) { const [pct, ratio] = pick(rng, PCT); return { fruits, ratio, card: 'percent', pct }; }
    const ratio = pick(rng, RATIOS[lv]);
    if (lv === 4) return { fruits, ratio, card: 'recipe', first: ratio[0] * int(rng, 2, Math.max(2, Math.floor(JUG_MAX / (ratio[0] + ratio[1])))) };
    return { fruits, ratio, card: lv === 3 ? 'none' : 'recipe' };
  });
}
/** Does the jug match? The same ratio (any size), and on level 4 the set amount of the first fruit. */
export function labMatch(o: LabOrder, have: [number, number]): boolean {
  if (!have[0] || !have[1]) return false;
  if (have[0] * o.ratio[1] !== have[1] * o.ratio[0]) return false;
  return o.first === undefined || have[0] === o.first;
}
/** A word on how far off the jug is: which fruit to add (by colour), never the answer itself. */
export function labNudge(o: LabOrder, have: [number, number], names: [string, string]): string {
  if (!have[0] || !have[1]) return `It needs both: ${names[0]} and ${names[1]}.`;
  const mine = have[0] / (have[0] + have[1]), want = o.ratio[0] / (o.ratio[0] + o.ratio[1]);
  if (o.first !== undefined && have[0] !== o.first) return `Use ${o.first} ${names[0]}, then make the ${names[1]} fit the recipe.`;
  if (Math.abs(mine - want) < 1e-9) return 'Same colour!';
  return mine > want ? `A bit too much ${names[0]}. Add some ${names[1]} (or take a ${names[0]} out).` : `Not enough ${names[0]}. Add some ${names[0]} (or take a ${names[1]} out).`;
}
