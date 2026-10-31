// The arithmetic of a crate of cubes, with no pictures in it: where each cube goes, what any number a
// child gives would look like in the crate, and the wrong ideas children really bring to it. Battista and
// Clements (1996) found children in grades 3 to 5 add the edges, stop at the floor, or see a block as its
// outside; each of those is here, so the crate can act it out.

export type Dims = { l: number; w: number; h: number };
/** a cube's place: x along the length (0 is left), z along the width (0 is the back), y up (0 is the floor) */
export type Slot = { x: number; y: number; z: number };

export const volume = (d: Dims) => d.l * d.w * d.h;
export const floorOf = (d: Dims) => d.l * d.w;
export const addedUp = (d: Dims) => d.l + d.w + d.h;

/** Every place in the order cubes pour in: the floor first, from the back row forward, then the next layer. */
export function pourOrder(d: Dims): Slot[] {
  const out: Slot[] = [];
  for (let y = 0; y < d.h; y++) for (let z = 0; z < d.w; z++) for (let x = 0; x < d.l; x++) out.push({ x, y, z });
  return out;
}
/** The row along the length edge, nearest the child: where building by hand starts. */
export const firstRow = (d: Dims): Slot[] => Array.from({ length: d.l }, (_, x) => ({ x, y: 0, z: d.w - 1 }));
/** The row `n` rows back from the first. */
export const rowBack = (d: Dims, n: number): Slot[] => firstRow(d).map(s => ({ ...s, z: d.w - 1 - n }));
/** Layer `y`. */
export const layer = (d: Dims, y: number): Slot[] => pourOrder(d).filter(s => s.y === y);
/** The places a child standing at the near corner can see (the top, the front, the right side). */
export const seenOnly = (d: Dims): Slot[] => pourOrder(d).filter(s => s.y === d.h - 1 || s.z === d.w - 1 || s.x === d.l - 1);

/** What a number means in a crate: full, short of cubes, or some left over. */
export type Meaning = { kind: 'full' } | { kind: 'short'; missing: number } | { kind: 'over'; extra: number };
export function meaning(n: number, d: Dims): Meaning {
  const v = volume(d);
  return n === v ? { kind: 'full' } : n < v ? { kind: 'short', missing: v - n } : { kind: 'over', extra: n - v };
}

/** Which of the known wrong ideas a number comes from (null: none of them, or it's right). */
export type WrongIdea = 'added' | 'floor' | 'seen';
export function wrongIdea(n: number, d: Dims): WrongIdea | null {
  if (n === volume(d)) return null;
  if (n === addedUp(d)) return 'added';
  if (n === floorOf(d)) return 'floor';
  if (n === seenOnly(d).length) return 'seen';
  return null;
}

/** The sum as it's written at the end, each number with the line it came from. */
export type SumPart = { t: string; c?: 'a' | 'b' | 'c' };
export const sumParts = (d: Dims, inks: ('a' | 'b' | 'c')[] = ['a', 'b', 'c']): SumPart[] => [{ t: String(d.l), c: inks[0] }, { t: '×' }, { t: String(d.w), c: inks[1] }, { t: '×' }, { t: String(d.h), c: inks[2] }, { t: '=' }, { t: String(volume(d)) }];
