// When a box on the fraction pad is finished, the way the number pad checks a whole number once it has as
// many digits as the answer: the top is finished once it can't grow into the answer's top (1 for 1/2, so
// "1, 2" is 1 over 2; a 1 waits for its 2 in 12/5); the bottom once it can't grow into the bottom that
// goes with that top: the answer's own, or the one that makes an equal fraction (20 after a top of 10, for
// 1/2, when a child goes back up to make it 10/20). Choices give several answers to go by.
export type Frac = { n: number; d: number };

/** Can what's typed still grow into one of these numbers? */
const grows = (typed: string, ws: string[]) => ws.some(w => w !== typed && w.startsWith(typed));

/** Is the top finished (on to the bottom)? */
export function topDone(nn: string, wants: Frac[]): boolean {
  return !!nn && !grows(nn, wants.map(w => String(w.n)));
}

/** The bottoms that go with this top: an answer with this top, or an equal fraction of one. */
export function bottomsFor(nn: string, wants: Frac[]): string[] {
  const t = Number(nn);
  const own = wants.filter(w => String(w.n) === nn).map(w => String(w.d));
  const equal = nn && t > 0 ? wants.filter(w => w.n > 0 && (t * w.d) % w.n === 0).map(w => String((t * w.d) / w.n)) : [];
  const all = [...new Set([...own, ...equal])];
  return all.length ? all : wants.map(w => String(w.d));
}

/** Is the bottom finished (check it)? */
export function bottomDone(nn: string, dd: string, wants: Frac[]): boolean {
  return !!dd && dd !== '0' && !grows(dd, bottomsFor(nn, wants));
}
