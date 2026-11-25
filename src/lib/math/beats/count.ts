// The arithmetic of counting a set of cookies, with no pictures in it: what a number of plates means for
// them, and the two slips children really make when the things to count are mixed up. Counting research
// (Gelman and Gallistel 1978; Fuson 1988) finds young children touch one thing twice or miss one, mostly
// when the things aren't in a line, and that knowing "the last number says how many" comes after being
// able to say the numbers. Each slip is here, so the cookies can act it out.

/** What a number of plates means for the cookies: one each, some cookies with none, or plates left empty. */
export type Meaning = { kind: 'full' } | { kind: 'short'; missing: number } | { kind: 'over'; extra: number };
export function plateMeaning(plates: number, cookies: number): Meaning {
  return plates === cookies ? { kind: 'full' } : plates < cookies ? { kind: 'short', missing: cookies - plates } : { kind: 'over', extra: plates - cookies };
}

export type Slip = 'twice' | 'skip';
/** The cookies a counter touches, in order, one number for each touch: all of them once, or with a slip:
 *  coming back to one already counted (one number too many), or missing one (one too few). */
export function countPath(n: number, slip?: Slip): number[] {
  const all = Array.from({ length: n }, (_, i) => i), k = Math.min(2, n - 1);
  if (slip === 'twice') return [...all.slice(0, k + 2), k, ...all.slice(k + 2)];
  if (slip === 'skip') return all.filter(i => i !== Math.min(4, n - 1));
  return all;
}
/** The cookie a slip happened to (touched twice, or never), or -1. */
export function slipped(path: number[], n: number): number {
  for (let i = 0; i < n; i++) if (path.filter(x => x === i).length !== 1) return i;
  return -1;
}
/** Every number said in a count, on the cookie it was said for (a cookie touched twice has two). */
export function numbersOn(path: number[], n: number): number[][] {
  const on: number[][] = Array.from({ length: n }, () => []);
  path.forEach((c, i) => on[c].push(i + 1));
  return on;
}
