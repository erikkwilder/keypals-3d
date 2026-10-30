// The Smoothie Lab: a calm Playground toy, no clock. A glass of smoothie stands on the bench: mix fruit in the
// big jug until yours is the same colour, then pour. The colour is the ratio: 2 strawberries to 3 bananas is
// the same colour as 4 to 6, so any equal mix matches. Many glasses also ask for a bigger mix, so the
// smallest one (1 and 3 for 1 : 3) won't do: "use all 6 strawberries", or "fill the jug to the line".
// Five levels:
//   1 one to one          the recipe card says 1 : 1; then some ask for a full jug or a set number
//   2 one to more         the card says 1 : 2, 3 : 1...; most glasses ask for a bigger mix
//   3 match the colour    no card: a colour guide under the glass shows what 3 : 1, 2 : 1, 1 : 1... look
//                         like (with your jug's colour marked on it), the two fruits are always far apart
//                         in colour, and a wrong pour says which fruit needs more
//   4 a bigger jug        every glass needs a bigger mix: a set amount of one fruit, or a jug line to fill
//   5 percent smoothies   "25% mango" in a jug of 8 or 12: a quarter of the fruit is mango
// Six glasses a round; stars by slips (playground.ts slipStars).
import { type Rng } from '../../engine/rng';
import { FRUIT, FRUITS, type Fruit } from '../skills/ratioPic';

export type LabOrder = {
  fruits: [Fruit, Fruit]; ratio: [number, number];
  /** what the card shows: the recipe, nothing (match by colour), or a percent of the first fruit */
  card: 'recipe' | 'none' | 'percent';
  /** use exactly this many of the first fruit ("use all 6 strawberries") */
  first?: number;
  /** fill the jug to the line: exactly this many fruit in all */
  total?: number;
  pct?: number;
};
export const GLASSES = 6;
/** the jug's size */
export const JUG_MAX = 24;
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));

const RATIOS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[1, 2], [2, 1], [1, 3], [3, 1]],
  // far enough apart to tell by colour (2 : 3 and 3 : 2 look too much like 1 : 1)
  3: [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1]],
  4: [[1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 4]],
};
const PCT: [number, [number, number]][] = [[50, [1, 1]], [25, [1, 3]], [75, [3, 1]], [20, [1, 4]], [40, [2, 3]], [60, [3, 2]]];
/** the colour guide's mixes, from mostly the first fruit to mostly the second */
export const GUIDE: [number, number][] = [[3, 1], [2, 1], [1, 1], [1, 2], [1, 3]];

/** How far apart two colours look (0..441). */
export function colourGap(a: string, b: string) {
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const x = rgb(a), y = rgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
/** Fruit pairs whose colours are far apart (for matching by colour): not mango with orange, and so on. */
export const CONTRAST: [Fruit, Fruit][] = FRUITS.flatMap(a => FRUITS.filter(b => b !== a && colourGap(FRUIT[a].color, FRUIT[b].color) > 140).map(b => [a, b] as [Fruit, Fruit]));

/** A bigger mix of the recipe: "use all N" of the first fruit, or a jug line to fill. Never the smallest
 *  mix itself (at least twice it), and it always fits the jug. */
function bigger(rng: Rng, ratio: [number, number], lo = 2): Pick<LabOrder, 'first' | 'total'> {
  const sum = ratio[0] + ratio[1], k = int(rng, lo, Math.max(lo, Math.min(lo + 3, Math.floor(JUG_MAX / sum))));
  return rng() < 0.5 ? { first: ratio[0] * k } : { total: sum * k };
}

/** The glasses of a round at a level (never loops). */
export function labOrders(level: number, rng: Rng): LabOrder[] {
  const lv = Math.max(1, Math.min(5, level));
  return Array.from({ length: GLASSES }, (_, g) => {
    const i = int(rng, 0, 5);
    let fruits: [Fruit, Fruit] = [FRUITS[i], FRUITS[(i + int(rng, 1, 5)) % 6]];
    if (lv === 5) {
      const [pct, ratio] = pick(rng, PCT), sum = ratio[0] + ratio[1];
      // a jug line too, from the second glass: 25% of 8 is 2
      return { fruits, ratio, card: 'percent', pct, ...(g ? { total: sum * int(rng, 2, Math.max(2, Math.min(4, Math.floor(JUG_MAX / sum)))) } : {}) };
    }
    const ratio = pick(rng, RATIOS[lv]);
    if (lv === 3) { fruits = pick(rng, CONTRAST); return { fruits, ratio, card: 'none' }; }
    // the first glass or two just the recipe; after that a bigger mix (every glass on level 4)
    const scaled = lv === 4 || (lv === 1 ? g >= 2 : g >= 1);
    return { fruits, ratio, card: 'recipe', ...(scaled ? bigger(rng, ratio, lv === 4 ? 2 : 2) : {}) };
  });
}
/** Does the jug match? The same ratio (any size), and the set amount of the first fruit or the jug line. */
export function labMatch(o: LabOrder, have: [number, number]): boolean {
  if (!have[0] || !have[1]) return false;
  if (have[0] * o.ratio[1] !== have[1] * o.ratio[0]) return false;
  if (o.first !== undefined && have[0] !== o.first) return false;
  return o.total === undefined || have[0] + have[1] === o.total;
}
/** A word on how far off the jug is: which fruit needs more (or how big the mix must be), never the
 *  answer itself. */
export function labNudge(o: LabOrder, have: [number, number], names: [string, string]): string {
  if (!have[0] || !have[1]) return `It needs both: ${names[0]} and ${names[1]}.`;
  const mine = have[0] / (have[0] + have[1]), want = o.ratio[0] / (o.ratio[0] + o.ratio[1]);
  if (o.first !== undefined && have[0] !== o.first) return `Use all ${o.first} ${names[0]}, then make the ${names[1]} fit the recipe.`;
  if (Math.abs(mine - want) < 1e-9) return o.total !== undefined && have[0] + have[1] !== o.total ? `Right mix! Now make it bigger: fill the jug to the line, ${o.total} fruit in all.` : 'Same colour!';
  const near = Math.abs(mine - want) < 0.12;
  return mine > want ? `${near ? 'A bit' : 'Lots'} more ${names[1]}!` : `${near ? 'A bit' : 'Lots'} more ${names[0]}!`;
}
