// Balance Scale: the calm Playground toy of the Star Lab. No clock: a mystery box (or two, or three, all
// the same) sits on the left pan with some weights; you put weights on the right pan from the shelf until
// it hangs level (too many and it tips your way: take one off), then say what one box weighs. Five
// puzzles a round, five levels, stars by slips like the other toys.
import type { Rng } from '../../engine/rng';

export type ScalePuzzle = { boxes: number; left: number; /** what each box weighs */ w: number };
export const SCALE_LEVELS = [
  { boxes: 1, left: [0, 0], w: [2, 9] },
  { boxes: 1, left: [1, 5], w: [2, 9] },
  { boxes: 2, left: [0, 0], w: [2, 8] },
  { boxes: 2, left: [1, 6], w: [2, 8] },
  { boxes: 3, left: [1, 6], w: [2, 7] },
] as const;
/** the weights on the shelf */
export const SHELF = [1, 2, 5] as const;
const int = (rng: Rng, lo: number, hi: number) => (hi <= lo ? lo : Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1))));
const levelOf = (level: number) => SCALE_LEVELS[Math.max(0, Math.min(SCALE_LEVELS.length - 1, level - 1))];

/** A round's puzzles: no two the same in a row. */
export function scalePuzzles(level: number, rng: Rng, n = 5): ScalePuzzle[] {
  const L = levelOf(level), out: ScalePuzzle[] = [];
  for (let i = 0; i < n; i++) {
    let w = int(rng, L.w[0], L.w[1]);
    const prev = out.at(-1);
    if (prev && prev.w === w) w = w === L.w[1] ? w - 1 : w + 1;
    out.push({ boxes: L.boxes, left: int(rng, L.left[0], L.left[1]), w });
  }
  return out;
}
/** everything on the left pan */
export const leftTotal = (z: ScalePuzzle) => z.boxes * z.w + z.left;
/** how far it hangs over: -1 (the right side down) to 1 (the left side down), level at 0 */
export const tiltOf = (left: number, right: number) => Math.max(-1, Math.min(1, (left - right) / Math.max(4, left * 0.6)));
/** three answers to pick from: the box's weight, the whole right side, and one off it */
export function scaleChoices(z: ScalePuzzle, rng: Rng): number[] {
  const right = leftTotal(z), set = new Set<number>([z.w]);
  for (const c of [right - z.left, right, z.w + 1, z.w - 1, z.w + 2]) if (c > 0 && set.size < 3) set.add(c);
  const xs = [...set];
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [xs[i], xs[j]] = [xs[j], xs[i]]; }
  return xs;
}
/** how it's worked out, for the box's word bubble */
export function scaleHow(z: ScalePuzzle): string {
  const right = leftTotal(z);
  if (z.boxes === 1) return z.left ? `${right} take away ${z.left} is ${z.w}.` : `The box balances ${right}.`;
  return `${z.left ? `${right} take away ${z.left} is ${right - z.left}. ` : ''}Shared by ${z.boxes} boxes: ${z.w} each.`;
}
