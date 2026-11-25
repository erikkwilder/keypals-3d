// The arithmetic of sharing a chocolate bar, with no pictures in it: where a child's cuts leave the pieces,
// whether the pieces are fair, and the wrong ideas children really bring to unit fractions. Children call
// unequal pieces "fourths" because there are 4 of them, and think 1/8 is more than 1/4 because 8 is more than 4
// (Behr, Wachsmuth, Post & Lesh 1984; Mack 1990). Each of those is here, so the bar can act it out.

/** A cut sits on one of the lines between squares: line g has g squares to its left (1 .. squares - 1). */
export type Cuts = number[];

/** The pieces a set of cuts leaves, left to right, in squares. */
export function piecesOf(squares: number, cuts: Cuts): number[] {
  const at = [...new Set(cuts.filter(g => g > 0 && g < squares))].sort((a, b) => a - b);
  const out: number[] = [];
  let from = 0;
  for (const g of [...at, squares]) { out.push(g - from); from = g; }
  return out;
}
/** Every piece the same size. */
export const fair = (pieces: number[]) => pieces.length > 0 && pieces.every(p => p === pieces[0]);
/** The cuts that share `squares` fairly between `friends` (null: it can't be done in whole squares). */
export function fairCuts(squares: number, friends: number): Cuts | null {
  if (squares % friends) return null;
  const each = squares / friends;
  return Array.from({ length: friends - 1 }, (_, i) => (i + 1) * each);
}
/** The line in the middle of a run of squares from `from` to `to` (null: the run can't be halved). */
export function middle(from: number, to: number): number | null {
  return (to - from) % 2 ? null : from + (to - from) / 2;
}
/** The pieces either side of one cut in the run `from` .. `to`. */
export const sides = (from: number, to: number, g: number) => [g - from, to - g];

/** What a fraction's name means: one of `b` equal pieces of the whole, as a length in squares. */
export const pieceOf = (squares: number, b: number) => squares / b;
/** Which of two unit fractions of the same whole is more (or 'same'). */
export const moreOf = (a: number, b: number): number | 'same' => (a === b ? 'same' : a < b ? a : b);

/** The fraction name a child picks, checked against the pieces: right, or which wrong idea it comes from. */
export type NameIdea = 'right' | 'squares' | 'other';
export function nameIdea(pick: number, squares: number, pieces: number): NameIdea {
  if (pick === pieces) return 'right';
  if (pick === squares) return 'squares';
  return 'other';
}
