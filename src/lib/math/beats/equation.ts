// The arithmetic of a balance with mystery bags on it, with no pictures in it. One side holds `p` bags that
// all weigh the same and `q` loose weights; the other side holds `r` weights: p·x + q = r. The balance tips
// toward whichever side weighs more, so any number a child gives (a guess for one bag, how many to take off
// the other side, how many come off with one bag) can be put on the balance and seen. The wrong moves are the
// ones grade 7 students really make (Kieran 1992; Booth 1984; Küchemann 1981): doing something to one side
// only, sharing only part of a side (the bags but not the loose weights), and reading the letter as a name
// for the bag rather than a number. The fourth, checking by eye, is answered by putting the number back in.

export type Eq = { p: number; q: number; r: number };
export const xOf = (e: Eq) => (e.r - e.q) / e.p;
/** which way it hangs: 1 the bags' side down, -1 the other side down, 0 level */
export const tipOf = (left: number, right: number) => Math.sign(left - right) as -1 | 0 | 1;

/** A guess for one bag, put in place of every bag: what the bags' side then weighs, and which way it hangs. */
export function swapped(e: Eq, n: number) { const left = e.p * n + e.q; return { left, tip: tipOf(left, e.r) }; }

/** After the q loose weights come off the bags' side, `n` come off the other side: which way it hangs. */
export const offOther = (e: Eq, n: number) => tipOf(e.p * xOf(e), e.r - Math.min(n, e.r));

/** With p bags against r − q weights, one bag comes off and `n` weights come off the other side. */
export function oneBagOff(e: Eq, n: number) { const x = xOf(e), right = e.r - e.q; return tipOf((e.p - 1) * x, right - Math.min(n, right)); }

/** The buddy's way: share the bags and the other side into p parts, but keep every loose weight. */
export function partShare(e: Eq) { const left = xOf(e) + e.q, right = e.r / e.p; return { left, right, tip: tipOf(left, right), says: right - e.q }; }

/** The equation's lines as the hands made them: the start, both sides less q, each side shared into p. */
export type Part = { t: string; c?: 'a' | 'b' | 'c'; /** being said right now: lit */ hot?: boolean };
export function written(e: Eq): { parts: Part[]; why: string }[] {
  const x = xOf(e), bags = e.p === 1 ? 'x' : `${e.p}x`;
  return [
    { parts: [{ t: bags, c: 'b' }, { t: '+' }, { t: String(e.q), c: 'a' }, { t: '=' }, { t: String(e.r), c: 'c' }], why: 'the balance at the start' },
    { parts: [{ t: bags, c: 'b' }, { t: '=' }, { t: String(e.r - e.q), c: 'c' }], why: `${e.q} off both sides` },
    { parts: [{ t: 'x', c: 'b' }, { t: '=' }, { t: String(x), c: 'c' }], why: e.p === 2 ? 'half of each side' : `each side shared into ${e.p}` },
  ];
}
