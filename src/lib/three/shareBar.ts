// The size of each square of Fair Shares' chocolate bar (shareKit.ts). The squares of a piece touch: one bar with
// lines on it until the knife cuts it, and a piece standing on its plate is one piece too. Each square was a little
// smaller than its place, so the bar lay apart from the start and a bar to be cut looked already cut. Erik,
// 2026-11-25: "it should look more like one chocolate bar with lines on it, not separate pieces from the start...
// If we're cutting the bar up, it should actually look like one piece that we're cutting."

/** how thick a square is, and how wide across the bar, against its place along it */
export const THICK = 0.34, ACROSS = 0.94;
/** A square's size (x, y, z) for its place `pitch`, lying flat in the bar (`st` 0, the squares in a row along x) or
 *  standing in a piece's tower on its plate (`st` 1, the squares one above the other). Along the way they join it
 *  fills its place, so neighbours meet in a thin scored line (the rounding of their edges). */
export function squareSize(pitch: number, st: number): [number, number, number] {
  const flat = pitch * THICK, across = pitch * ACROSS;
  return [pitch + (across - pitch) * st, flat + (pitch - flat) * st, across + (flat - across) * st];
}
/** how round a square's edges are (of its size): side by side, two squares meet in a thin line, not a gap */
export const ROUND = 0.05;
