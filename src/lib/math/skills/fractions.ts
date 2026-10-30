// The fraction skills, grades 3 to 5 (Common Core 3.NF, 4.NF and the start of 5.NF): what fraction is
// shaded, one piece and how many pieces, fractions of a set, fractions on a number line, which is bigger,
// equal fractions, adding and taking away with the same bottom number, mixed numbers, a whole number times
// a fraction, and adding with different bottoms. Each makes endless questions from a seeded generator on a
// ladder of six rungs (types.ts): rung 1 gentle (small denominators, pictures to help), rung 3 the full
// grade-level range, rungs 4 to 6 the stretch (bigger bottoms, missing parts, more steps, closer choices,
// fewer pictures); each skill's comment says what its rungs mean. No generator ever draws again "until
// it's different": every choice comes from a list that already leaves out what it mustn't be, so a
// question is made in one go whatever the random numbers are.
import type { Rng } from '../../engine/rng';
import { perRung, rungOf, type Answer, type FracPic, type Part, type Pic, type Skill } from './types';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
/** a number from lo to hi that isn't `not` (lo..hi must hold at least two numbers) */
const intNot = (rng: Rng, lo: number, hi: number, not: number) => { const v = lo + Math.floor(rng() * (hi - lo)); return v >= not ? v + 1 : v; };
const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n: number | null, d: number | null): Part => ({ t: 'frac', n, d });
const pic = (p: Pic): Part => ({ t: 'pic', pic: p });
const fs = (n: number, d: number) => `${n}/${d}`;
const NAME: Record<number, string> = { 2: 'halves', 3: 'thirds', 4: 'quarters', 5: 'fifths', 6: 'sixths', 8: 'eighths', 10: 'tenths', 12: 'twelfths' };

/** Equal as numbers (2/4 and 1/2 are equal). */
export const sameValue = (a: { n: number; d: number }, b: { n: number; d: number }) => a.d > 0 && b.d > 0 && a.n * b.d === b.n * a.d;
/** The usual check: the same number, the same fraction (or an equal one), the same choice. */
export function checkAnswer(want: Answer, given: Answer): boolean {
  if (want.kind === 'number' && given.kind === 'number') return Math.abs(want.value - given.value) < 1e-9;
  if (want.kind === 'fraction' && given.kind === 'fraction') return sameValue(want, given);
  if (want.kind === 'choice' && given.kind === 'choice') return want.id === given.id;
  if (want.kind === 'point' && given.kind === 'point') return Math.abs(want.x - given.x) < 1e-9 && Math.abs((want.y ?? 0) - (given.y ?? 0)) < 1e-9;
  return false;
}

// ---------- what fraction is shaded? ----------
// rungs: 1 mostly one shaded piece · 2 one piece a third of the time · 3 any number shaded · 4 sometimes
// "what is NOT shaded?" · 5 more of those, and now and then more than one whole (a full pie and part of
// another) · 6 more than one whole often
export const frName: Skill = {
  id: 'fr-name', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'Name the fraction', short: 'Name it', plain: 'Says what fraction of a shape is shaded: 3 of 4 equal parts is 3/4.',
  input: 'fraction', fastMs: 6000,
  subs: [2, 3, 4, 6, 8].map(d => ({ id: String(d), label: NAME[d] })),
  make(rng, sub, rung) {
    const r = rungOf(rung), d = +sub;
    const n = rng() < perRung(r, [0.6, 0.35, 0]) ? 1 : int(rng, 1, d - 1);
    const kind: FracPic['kind'] = rng() < 0.5 ? 'pie' : 'bar';
    const v = rng();
    const over = r >= 5 && v < (r === 5 ? 0.25 : 0.4);
    const not = !over && r >= 4 && v < perRung(r, [0, 0, 0, 0.3, 0.75, 0.7]);
    const base = { skill: 'fr-name', key: `fr-name:${d}`, input: 'fraction' as const, weight: Math.min(5, (d <= 4 ? 1 : 2) + (over || not ? 1 : 0)) };
    if (over) return {
      ...base, id: `fr-name:${kind}:1+${n}/${d}`,
      ask: 'How much is shaded? (more than one whole)', prompt: [pic({ kind, parts: d, filled: d }), pic({ kind, parts: d, filled: n })],
      answer: { kind: 'fraction', n: d + n, d },
      explain: `A whole is ${fs(d, d)}, and ${n} more ${n === 1 ? 'part' : 'parts'}: ${d} + ${n} = ${d + n} parts, ${fs(d + n, d)}.`,
      trick: { name: 'Count every shaded part', say: `Each whole has ${d} parts, so the bottom stays ${d}. Count every shaded part for the top: ${d} + ${n} = ${d + n}.` },
    };
    if (not) return {
      ...base, id: `fr-name:not:${kind}:${n}/${d}`,
      ask: 'What fraction is NOT shaded?', prompt: [pic({ kind, parts: d, filled: n })],
      answer: { kind: 'fraction', n: d - n, d },
      explain: `${n} of the ${d} parts ${n === 1 ? 'is' : 'are'} shaded, so ${d - n} ${d - n === 1 ? 'is' : 'are'} not: ${fs(d - n, d)}.`,
      trick: { name: 'Count the empty parts', say: `The bottom number counts all the parts (${d}). This time the top counts the parts that are NOT shaded (${d - n}).` },
    };
    return {
      ...base, id: `fr-name:${kind}:${n}/${d}`,
      ask: 'What fraction is shaded?', prompt: [pic({ kind, parts: d, filled: n })],
      answer: { kind: 'fraction', n, d },
      explain: `${n} of the ${d} equal parts ${n === 1 ? 'is' : 'are'} shaded: ${fs(n, d)}.`,
      trick: { name: 'Count the parts', say: `The bottom number counts all the equal parts (${d}). The top number counts the shaded ones (${n}).` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- which is bigger? ----------
// rungs: 1 small bottoms, with a bar picture on each choice · 2 wider bottoms, still with pictures · 3 no
// pictures, bottoms to 12, "the same" sometimes (next to a half) · 4 bigger bottoms · 5 close together
// (tops or bottoms one apart, both just either side of a half) · 6 the closest, biggest bottoms
type Pair = { a: [number, number]; b: [number, number] };
/** two different numbers from a list (2 or more long), the second next to the first in it when `close` */
function twoOf(rng: Rng, xs: readonly number[], close: boolean): [number, number] {
  const i = int(rng, 0, xs.length - 1);
  if (close) { const j = i === 0 ? 1 : i === xs.length - 1 ? i - 1 : rng() < 0.5 ? i - 1 : i + 1; return [xs[i], xs[j]]; }
  return [xs[i], xs[intNot(rng, 0, xs.length - 1, i)]];
}
const upTo = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
function comparePair(rng: Rng, sub: string, r: number): Pair {
  const close = r >= 5;
  if (sub === 'same-d') {
    const d = pick(rng, perRung(r, [[3, 4, 5, 6, 8], [4, 5, 6, 8], [5, 6, 8, 10, 12], [8, 10, 12], [8, 10, 12], [10, 12]]));
    const [n1, n2] = twoOf(rng, upTo(1, d - 1), close);
    return { a: [n1, d], b: [n2, d] };
  }
  if (sub === 'same-n') {
    const n = pick(rng, perRung(r, [[1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5], [4, 5, 6], [5, 6, 7]]));
    const [d1, d2] = twoOf(rng, upTo(n + 1, r >= 4 ? 12 : 10), close);
    return { a: [n, d1], b: [n, d2] };
  }
  if (sub === 'unit') {
    const [d1, d2] = twoOf(rng, perRung(r, [[2, 3, 4, 6, 8], [2, 3, 4, 5, 6, 8], [2, 3, 4, 5, 6, 8, 10, 12], [4, 5, 6, 8, 10, 12], [5, 6, 8, 10, 12], [6, 8, 10, 12]]), close);
    return { a: [1, d1], b: [1, d2] };
  }
  // compare through a half: one more than a half, one less (from rung 3, sometimes exactly the same)
  if (r >= 3 && rng() < 0.25) { const k = pick(rng, r >= 5 ? [3, 4, 5, 6] : [2, 3, 4, 5]); return rng() < 0.5 ? { a: [1, 2], b: [k, 2 * k] } : { a: [k, 2 * k], b: [1, 2] }; }
  const d1 = pick(rng, perRung(r, [[4, 6, 8, 10], [4, 6, 8, 10], [4, 6, 8, 10], [6, 8, 10, 12], [7, 8, 9, 10, 11, 12], [9, 10, 11, 12]]));
  const d2 = pick(rng, perRung(r, [[3, 5, 6, 8, 10], [3, 5, 6, 8, 10], [3, 5, 6, 8, 10], [5, 6, 7, 8, 10, 12], [5, 6, 7, 8, 9, 10, 11, 12], [7, 8, 9, 10, 11, 12]]).filter(x => x !== d1));
  // close: just over a half against just under one
  const big: [number, number] = [close ? Math.floor(d1 / 2) + 1 : int(rng, Math.floor(d1 / 2) + 1, d1 - 1), d1];
  const small: [number, number] = [close ? Math.ceil(d2 / 2) - 1 : int(rng, 1, Math.ceil(d2 / 2) - 1), d2];
  return rng() < 0.5 ? { a: big, b: small } : { a: small, b: big };
}
const WHY: Record<string, string> = {
  'same-d': 'Same size pieces: more pieces is more.',
  'same-n': 'The same number of pieces: fewer cuts make bigger pieces.',
  unit: 'One piece each: the fewer parts it is cut into, the bigger the piece.',
  half: 'Compare each with a half.',
};
export const frCompare: Skill = {
  id: 'fr-compare', area: 'fractions', grade: 3, standard: '3.NF.A.3d',
  name: 'Which is bigger?', short: 'Bigger?', plain: 'Compares two fractions: same bottom, same top, one piece each, or each against a half.',
  input: 'choice', fastMs: 6000,
  subs: [{ id: 'same-d', label: 'same bottom' }, { id: 'same-n', label: 'same top' }, { id: 'unit', label: 'one piece each' }, { id: 'half', label: 'next to a half' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const { a, b } = comparePair(rng, sub, r);
    const va = a[0] / a[1], vb = b[0] / b[1];
    const id = Math.abs(va - vb) < 1e-9 ? 'same' : va > vb ? 'a' : 'b';
    const show = r <= 2;
    const side = (f: [number, number]): Part[] => (show ? [pic({ kind: 'bar', parts: f[1], filled: f[0] }), frac(f[0], f[1])] : [frac(f[0], f[1])]);
    const bigger = id === 'same' ? null : id === 'a' ? a : b, smaller = id === 'a' ? b : a;
    return {
      skill: 'fr-compare', key: `fr-compare:${sub}`, id: `fr-compare:${fs(a[0], a[1])}:${fs(b[0], b[1])}`,
      ask: 'Which is bigger?', prompt: [frac(a[0], a[1]), { t: 'op', s: 'or' }, frac(b[0], b[1])],
      input: 'choice', choices: [{ id: 'a', parts: side(a) }, { id: 'same', parts: [{ t: 'text', s: 'The same' }] }, { id: 'b', parts: side(b) }],
      answer: { kind: 'choice', id }, weight: (sub === 'half' ? 3 : 2) + (r >= 5 ? 1 : 0),
      explain: bigger ? `${fs(bigger[0], bigger[1])} is bigger than ${fs(smaller[0], smaller[1])}. ${WHY[sub]}` : `${fs(a[0], a[1])} and ${fs(b[0], b[1])} are the same size: equal fractions.`,
      trick: { name: sub === 'half' ? 'Next to a half' : 'Look at the pieces', say: WHY[sub] + (sub === 'half' ? ' More than half the parts is more than a half.' : '') },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- equal fractions ----------
// rungs: 1 halves to quarters · 2 to fifths · 3 to sixths · 4 to eighths ("make it smaller" by up to 5) ·
// 5 to tenths, sometimes the bottom is missing instead of the top · 6 to twelfths, by up to 6
export const frEqual: Skill = {
  id: 'fr-equal', area: 'fractions', grade: 4, standard: '4.NF.A.1',
  name: 'Equal fractions', short: 'Equal', plain: 'Finds equal fractions: 1/2 = 2/4, by multiplying (or dividing) the top and bottom by the same number.',
  input: 'number', fastMs: 6000,
  subs: [{ id: 'x2', label: 'times 2' }, { id: 'x3', label: 'times 3' }, { id: 'x4', label: 'times 4' }, { id: 'smaller', label: 'make it smaller' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = pick(rng, perRung(r, [[2, 3, 4], [2, 3, 4, 5], [2, 3, 4, 5, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [5, 6, 8, 10, 12]]));
    const n = int(rng, 1, d - 1);
    const k = sub === 'x2' ? 2 : sub === 'x3' ? 3 : sub === 'x4' ? 4 : pick(rng, perRung(r, [[2, 3, 4], [2, 3, 4], [2, 3, 4], [2, 3, 4, 5], [2, 3, 4, 5, 6]]));
    const big: [number, number] = [n * k, d * k], small: [number, number] = [n, d];
    // "make it smaller": the big one is given, find the top of the small one
    const [from, to] = sub === 'smaller' ? [big, small] : [small, big];
    // the stretch: the top is given, the bottom is missing
    const bottom = r >= 5 && rng() < (r === 5 ? 0.4 : 0.5);
    return {
      skill: 'fr-equal', key: `fr-equal:${sub}`, id: `fr-equal:${fs(from[0], from[1])}=${bottom ? `${to[0]}/?` : to[1]}`,
      ask: bottom ? 'Make them equal. What goes on the bottom?' : 'Make them equal. What goes on top?',
      prompt: [frac(from[0], from[1]), { t: 'op', s: '=' }, bottom ? frac(to[0], null) : frac(null, to[1])],
      input: 'number', answer: { kind: 'number', value: bottom ? to[1] : to[0] }, weight: (sub === 'smaller' ? 3 : 2) + (bottom ? 1 : 0),
      explain: sub === 'smaller'
        ? `${from[1]} ÷ ${k} = ${to[1]} and ${from[0]} ÷ ${k} = ${to[0]}: divide the top and the bottom by ${k}. ${fs(from[0], from[1])} = ${fs(to[0], to[1])}.`
        : `${from[1]} × ${k} = ${to[1]} and ${from[0]} × ${k} = ${to[0]}: times the top and the bottom by ${k}. ${fs(from[0], from[1])} = ${fs(to[0], to[1])}.`,
      trick: { name: 'Same to top and bottom', say: 'Whatever you do to the bottom number, do to the top number too. The pieces change size, the amount stays the same.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding with the same bottom number ----------
// rungs: 1-3 two fractions (more than a whole: thirds to fifths, then up to eighths) · 4 sometimes three
// fractions, bottoms to twelfths · 5 three fractions, or a missing one (2/5 + ? = 4/5) · 6 more of both
export const frAdd: Skill = {
  id: 'fr-add', area: 'fractions', grade: 4, standard: '4.NF.B.3',
  name: 'Add fractions', short: 'Add', plain: 'Adds fractions with the same bottom number: 2/5 + 1/5 = 3/5 (equal answers like 4/8 = 1/2 count).',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'small', label: 'halves to fifths' }, { id: 'mid', label: 'sixths to tenths' }, { id: 'over', label: 'more than one whole' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = sub === 'small' ? pick(rng, [2, 3, 4, 5]) : sub === 'mid' ? pick(rng, r >= 4 ? [6, 8, 10, 12] : [6, 8, 10])
      : pick(rng, perRung(r, [[3, 4, 5], [3, 4, 5, 6], [4, 5, 6, 8], [5, 6, 8, 10], [6, 8, 10, 12], [8, 10, 12]]));
    const v = rng();
    const three = r >= 4 && d >= 3 && v < perRung(r, [0, 0, 0, 0.3, 0.4, 0.4]);
    const missing = !three && r >= 5 && v < (r === 5 ? 0.7 : 0.8);
    let ns: number[];
    if (three) {
      // every top at least 1; "more than a whole" really is more than a whole
      if (sub === 'over') { const a = int(rng, Math.ceil(d / 3), d - 1), b = int(rng, 1, d - 1); ns = [a, b, int(rng, Math.max(1, d + 1 - a - b), d - 1)]; }
      else { const a = int(rng, 1, d - 2), b = int(rng, 1, d - 1 - a); ns = [a, b, int(rng, 1, d - a - b)]; }
    } else if (sub === 'over') { const a = int(rng, Math.ceil(d / 2), d - 1); ns = [a, int(rng, d - a + 1, d - 1)]; }
    else { const a = int(rng, 1, d - 1); let b = int(rng, 1, Math.max(1, d - a)); if (a + b > d) b = d - a; ns = [a, b]; }
    const s = ns.reduce((t, x) => t + x, 0), g = gcd(s, d);
    const sum = ns.map(x => fs(x, d)).join(' + ');
    const tail = `${g > 1 ? ` (that's the same as ${fs(s / g, d / g)})` : ''}${s > d ? `: more than one whole` : s === d ? ': one whole' : ''}`;
    if (missing) {
      const [a, b] = ns;
      return {
        skill: 'fr-add', key: `fr-add:${sub}`, id: `fr-add:${fs(a, d)}+?=${fs(s, d)}`,
        ask: 'What is missing?', prompt: [frac(a, d), { t: 'op', s: '+' }, { t: 'blank' }, { t: 'op', s: '=' }, frac(s, d)],
        input: 'fraction', answer: { kind: 'fraction', n: b, d }, weight: sub === 'over' ? 5 : 4,
        explain: `${fs(s, d)} take away ${fs(a, d)} is ${fs(b, d)}: ${fs(a, d)} + ${fs(b, d)} = ${fs(s, d)}.`,
        trick: { name: 'Count up the tops', say: `The bottoms all match (${d}). What goes with ${a} to make ${s}? ${s} − ${a} = ${b}.` },
      };
    }
    const prompt: Part[] = [];
    ns.forEach((x, i) => { if (i) prompt.push({ t: 'op', s: '+' }); prompt.push(frac(x, d)); });
    return {
      skill: 'fr-add', key: `fr-add:${sub}`, id: `fr-add:${sum.replace(/ /g, '')}`,
      ask: 'Add them up.', prompt: [...prompt, { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: s, d }, weight: (sub === 'over' ? 4 : 3) + (three ? 1 : 0),
      explain: `Same size pieces: add the tops, keep the bottom. ${sum} = ${fs(s, d)}${tail}.`,
      trick: { name: 'Add the tops', say: 'When the bottoms match, the pieces are the same size: count them up (add the tops) and keep the bottom.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- one piece, and how many pieces ----------
// rungs: 1 halves to sixths with a picture · 2 to eighths · 3 to twelfths, counts past a whole · 4 bigger
// bottoms, sometimes "how many pieces make a whole?", counts to two wholes · 5 sometimes no picture, just
// words · 6 the biggest bottoms, counts to three wholes
export const frUnit: Skill = {
  id: 'fr-unit', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'One piece', short: 'One piece', plain: 'Knows one of d equal parts is 1/d, and that 3/4 is three pieces of 1/4.',
  input: 'fraction', fastMs: 6000,
  subs: [{ id: 'one', label: 'one piece' }, { id: 'count', label: 'how many pieces' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = pick(rng, perRung(r, [[2, 3, 4, 6], [2, 3, 4, 5, 6, 8], [3, 4, 5, 6, 8, 10, 12], [5, 6, 8, 10, 12], [6, 8, 10, 12], [8, 10, 12]]));
    if (sub === 'one') {
      const kind: FracPic['kind'] = rng() < 0.5 ? 'pie' : 'bar';
      const v = rng();
      if (r >= 4 && v < perRung(r, [0, 0, 0, 0.35, 0.3, 0.45])) return {
        skill: 'fr-unit', key: 'fr-unit:one', id: `fr-unit:whole:${d}`,
        ask: `How many pieces of ${fs(1, d)} make one whole?`, prompt: [frac(1, d), { t: 'op', s: '×' }, { t: 'blank' }, { t: 'op', s: '=' }, { t: 'num', n: 1 }],
        input: 'number', answer: { kind: 'number', value: d }, weight: 2,
        explain: `The whole is cut into ${d} equal pieces, so ${d} pieces of ${fs(1, d)} make it: ${fs(d, d)} = 1.`,
        trick: { name: 'The bottom counts the pieces', say: `${fs(1, d)} is one of ${d} equal pieces. All ${d} of them make the whole.` },
      };
      if (r >= 5 && v < 0.75) return {
        skill: 'fr-unit', key: 'fr-unit:one', id: `fr-unit:one:words:${d}`,
        ask: 'One piece is what fraction of the whole?', prompt: [{ t: 'text', s: `A cake is cut into ${d} equal pieces. One piece is` }, { t: 'blank' }],
        input: 'fraction', answer: { kind: 'fraction', n: 1, d }, weight: 2,
        explain: `${d} equal pieces make the cake, so one piece is ${fs(1, d)}.`,
        trick: { name: 'Count the parts', say: `${d} equal parts make the whole. One of them is 1 over ${d}.` },
      };
      return {
        skill: 'fr-unit', key: 'fr-unit:one', id: `fr-unit:one:${kind}:${d}`,
        ask: 'One piece is what fraction of the whole?', prompt: [pic({ kind, parts: d, filled: 1 })],
        input: 'fraction', answer: { kind: 'fraction', n: 1, d }, weight: 1,
        explain: `The whole is cut into ${d} equal parts, so one part is ${fs(1, d)}.`,
        trick: { name: 'Count the parts', say: `${d} equal parts make the whole. One of them is 1 over ${d}.` },
      };
    }
    const top = perRung(r, [d - 1, d - 1, d - 1 + Math.floor(d / 2), 2 * d - 1, 2 * d + Math.floor(d / 2), 3 * d - 1]);
    const n = int(rng, 2, Math.max(2, top));
    return {
      skill: 'fr-unit', key: 'fr-unit:count', id: `fr-unit:count:${n}/${d}`,
      ask: `How many pieces of ${fs(1, d)} make it?`, prompt: [frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }, { t: 'op', s: 'pieces of' }, frac(1, d)],
      input: 'number', answer: { kind: 'number', value: n }, weight: n > d ? 3 : 2,
      explain: `${fs(n, d)} is ${n} pieces of ${fs(1, d)}: the top number counts the pieces.`,
      trick: { name: 'The top counts pieces', say: `In ${fs(n, d)} the bottom says how big each piece is, the top says how many pieces: ${n}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- fractions of a set ----------
// rungs: 1 sets of 2 to 6, small shares · 2 sets to 8 · 3 sets to 10, shares to 9 each · 4 sets to 12 ·
// 5 sometimes "what fraction are NOT pink?", shares to 12 each · 6 the biggest, and now and then the other
// way round (1/3 of a number is 4: what is the number?)
export const frSet: Skill = {
  id: 'fr-set', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'Fractions of a set', short: 'Of a set', plain: 'Names a fraction of a group (2 of 6 cupcakes is 2/6) and finds a fraction of a number (1/3 of 12 is 4).',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'name', label: 'name the part' }, { id: 'unit-of', label: 'one part of a number' }, { id: 'of', label: 'some parts of a number' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'name') {
      const k = pick(rng, perRung(r, [[2, 3, 4, 5, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [6, 8, 10, 12], [8, 10, 12], [10, 12]]));
      const f = int(rng, 1, k - 1);
      if (r >= 5 && rng() < 0.4) return {
        skill: 'fr-set', key: 'fr-set:name', id: `fr-set:not:${f}/${k}`,
        ask: 'What fraction of the cupcakes are NOT pink?', prompt: [pic({ kind: 'set', parts: k, filled: f })],
        input: 'fraction', answer: { kind: 'fraction', n: k - f, d: k }, weight: 3,
        explain: `${f} of the ${k} cupcakes are pink, so ${k - f} are not: ${fs(k - f, k)}.`,
        trick: { name: 'Count them all, then the plain ones', say: `The bottom number is all the cupcakes (${k}). The top number is the ones that are not pink (${k - f}).` },
      };
      return {
        skill: 'fr-set', key: 'fr-set:name', id: `fr-set:name:${f}/${k}`,
        ask: 'What fraction of the cupcakes are pink?', prompt: [pic({ kind: 'set', parts: k, filled: f })],
        input: 'fraction', answer: { kind: 'fraction', n: f, d: k }, weight: 2,
        explain: `${f} of the ${k} cupcakes are pink: ${fs(f, k)}.`,
        trick: { name: 'Count them all, then the pink ones', say: `The bottom number is all the cupcakes (${k}). The top number is the pink ones (${f}).` },
      };
    }
    const d = pick(rng, perRung(r, [[2, 3, 4, 5], [3, 4, 5, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [5, 6, 8, 10, 12], [6, 8, 10, 12]]));
    const each = int(rng, 2, perRung(r, [5, 7, 9, 10, 12, 12])), whole = d * each;
    const top = sub === 'unit-of' ? 1 : int(rng, 2, d - 1);
    const ans = top * each;
    if (r >= 6 && sub === 'unit-of' && rng() < 0.3) return {
      skill: 'fr-set', key: 'fr-set:unit-of', id: `fr-set:back:1/${d}is${each}`,
      ask: `${fs(1, d)} of a number is ${each}. What is the number?`, input: 'number',
      prompt: [frac(1, d), { t: 'op', s: 'of' }, { t: 'blank' }, { t: 'op', s: '=' }, { t: 'num', n: each }],
      answer: { kind: 'number', value: whole }, weight: 4,
      explain: `${fs(1, d)} is one of ${d} equal groups. One group is ${each}, so all ${d} groups are ${d} × ${each} = ${whole}.`,
      trick: { name: 'One group, then all of them', say: `If one of the ${d} groups is ${each}, the whole is ${d} groups: ${d} × ${each} = ${whole}.` },
    };
    return {
      skill: 'fr-set', key: `fr-set:${sub}`, id: `fr-set:${sub}:${top}/${d}of${whole}`,
      ask: `What is ${fs(top, d)} of ${whole}?`, input: 'number',
      prompt: [frac(top, d), { t: 'op', s: 'of' }, { t: 'num', n: whole }, { t: 'op', s: '=' }, { t: 'blank' }],
      answer: { kind: 'number', value: ans }, weight: sub === 'of' ? 3 : 2,
      explain: `Share ${whole} into ${d} equal groups: ${each} in each.${top > 1 ? ` ${top} groups is ${top} × ${each} = ${ans}.` : ''}`,
      trick: { name: 'Share, then take', say: `Divide by the bottom number (${whole} ÷ ${d} = ${each}), then times by the top (${top} × ${each} = ${ans}).` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- on the number line ----------
// rungs: 1 halves to quarters · 2 to sixths · 3 to eighths · 4 to tenths · 5 twelfths, and a longer line
// (0 to 2 for a fraction under 1, 0 to 3 past 1) so the end doesn't give it away · 6 the biggest bottoms
// on the longer line
export const frLine: Skill = {
  id: 'fr-line', area: 'fractions', grade: 3, standard: '3.NF.A.2',
  name: 'Fractions on a number line', short: 'Number line', plain: 'Puts a fraction on a number line: 3/4 is three jumps of 1/4 from 0.',
  input: 'numberline', fastMs: 8000,
  subs: [{ id: 'to-one', label: 'between 0 and 1' }, { id: 'past-one', label: 'past 1' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = pick(rng, perRung(r, [[2, 3, 4], [2, 3, 4, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [6, 8, 10, 12], [8, 10, 12]]));
    const max = (sub === 'past-one' ? 2 : 1) + (r >= 5 ? 1 : 0);
    let n = sub === 'past-one' ? int(rng, d + 1, max * d - 1) : int(rng, 1, d - 1);
    if (n % d === 0) n++; // a whole number isn't a fraction to find
    return {
      skill: 'fr-line', key: `fr-line:${sub}`, id: `fr-line:${n}/${d}${r >= 5 ? `:to${max}` : ''}`,
      ask: `Drag the pin to ${fs(n, d)}.`, prompt: [{ t: 'text', s: 'Find' }, frac(n, d)],
      input: 'numberline', line: { min: 0, max, step: 1 / d, labels: 'ends', denom: d },
      answer: { kind: 'point', x: n / d }, weight: (sub === 'past-one' ? 3 : 2) + (r >= 5 ? 1 : 0),
      explain: `Each jump between ticks is ${fs(1, d)}. ${fs(n, d)} is ${n} ${n === 1 ? "jump" : "jumps"} from 0${n > d ? `, past the 1 (which is ${fs(d, d)})` : ''}.`,
      trick: { name: 'Jump from zero', say: `The bottom number says how many jumps make 1 (${d}). The top number says how many jumps to take (${n}).` },
    };
  },
  // a pin on the right tick (the line snaps to ticks, so a tiny rounding difference doesn't count)
  check: (it, a) => a.kind === 'point' && it.answer.kind === 'point' && Math.abs(a.x - it.answer.x) < 1e-6,
};

// ---------- taking away with the same bottom number ----------
// rungs: 1-3 two fractions (from a whole: halves to quarters, then to eighths) · 4 take away twice
// (7/8 − 2/8 − 3/8), or from 2 wholes · 5 sometimes the part taken is missing (5/8 − ? = 2/8) · 6 more of
// those, bottoms to twelfths
export const frSub: Skill = {
  id: 'fr-sub', area: 'fractions', grade: 4, standard: '4.NF.B.3a',
  name: 'Take away fractions', short: 'Take away', plain: 'Takes away fractions with the same bottom number: 5/8 − 2/8 = 3/8, and 1 − 3/4 = 1/4.',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'small', label: 'thirds to fifths' }, { id: 'mid', label: 'sixths to tenths' }, { id: 'from-one', label: 'from a whole' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = sub === 'small' ? pick(rng, [3, 4, 5]) : sub === 'mid' ? pick(rng, r >= 4 ? [6, 8, 10, 12] : [6, 8, 10])
      : pick(rng, perRung(r, [[2, 3, 4], [2, 3, 4, 5, 6], [4, 5, 6, 8], [5, 6, 8, 10], [6, 8, 10, 12], [8, 10, 12]]));
    const v = rng();
    const missing = r >= 5 && v < (r === 5 ? 0.3 : 0.4);
    if (sub === 'from-one') {
      const n = int(rng, 1, d - 1);
      const two = !missing && r >= 4 && v < (r === 4 ? 0.4 : 0.6);
      if (missing) return {
        skill: 'fr-sub', key: 'fr-sub:from-one', id: `fr-sub:1-?=${d - n}/${d}`,
        ask: 'What was taken away?', prompt: [{ t: 'num', n: 1 }, { t: 'op', s: '−' }, { t: 'blank' }, { t: 'op', s: '=' }, frac(d - n, d)],
        input: 'fraction', answer: { kind: 'fraction', n, d }, weight: 4,
        explain: `1 whole is ${fs(d, d)}. ${fs(d, d)} − ${fs(n, d)} = ${fs(d - n, d)}, so ${fs(n, d)} was taken.`,
        trick: { name: 'A whole is the bottom over itself', say: `Write the 1 as ${fs(d, d)}. What takes ${d} down to ${d - n}? ${d} − ${d - n} = ${n}.` },
      };
      if (two) return {
        skill: 'fr-sub', key: 'fr-sub:from-one', id: `fr-sub:2-${n}/${d}`,
        ask: 'Take it away.', prompt: [{ t: 'num', n: 2 }, { t: 'op', s: '−' }, frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }],
        input: 'fraction', answer: { kind: 'fraction', n: 2 * d - n, d }, weight: 4,
        explain: `2 wholes are ${fs(2 * d, d)}. ${fs(2 * d, d)} − ${fs(n, d)} = ${fs(2 * d - n, d)}.`,
        trick: { name: 'Wholes into pieces', say: `Each whole is ${fs(d, d)}, so 2 is ${fs(2 * d, d)}. Then take away the tops: ${2 * d} − ${n} = ${2 * d - n}.` },
      };
      return {
        skill: 'fr-sub', key: 'fr-sub:from-one', id: `fr-sub:1-${n}/${d}`,
        ask: 'Take it away.', prompt: [{ t: 'num', n: 1 }, { t: 'op', s: '−' }, frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }],
        input: 'fraction', answer: { kind: 'fraction', n: d - n, d }, weight: 3,
        explain: `1 whole is ${fs(d, d)}. ${fs(d, d)} − ${fs(n, d)} = ${fs(d - n, d)}.`,
        trick: { name: 'A whole is the bottom over itself', say: `Write the 1 as ${fs(d, d)}, then take away the tops: ${d} − ${n} = ${d - n}.` },
      };
    }
    // take away twice: a top of at least 3, two parts that leave something
    if (!missing && r >= 4 && d >= 4 && v < (r === 4 ? 0.35 : 0.6)) {
      const a = int(rng, 3, d - 1), b = int(rng, 1, a - 2), c = int(rng, 1, a - b - 1), left = a - b - c;
      return {
        skill: 'fr-sub', key: `fr-sub:${sub}`, id: `fr-sub:${fs(a, d)}-${fs(b, d)}-${fs(c, d)}`,
        ask: 'Take them both away.', prompt: [frac(a, d), { t: 'op', s: '−' }, frac(b, d), { t: 'op', s: '−' }, frac(c, d), { t: 'op', s: '=' }, { t: 'blank' }],
        input: 'fraction', answer: { kind: 'fraction', n: left, d }, weight: 4,
        explain: `Same size pieces: ${a} − ${b} − ${c} = ${left}, so ${fs(left, d)}.`,
        trick: { name: 'Take away the tops', say: 'The bottoms all match, so take both tops away from the first one and keep the bottom.' },
      };
    }
    const n1 = int(rng, 2, d - 1), n2 = int(rng, 1, n1 - 1);
    const left = n1 - n2, g = gcd(left, d);
    if (missing) return {
      skill: 'fr-sub', key: `fr-sub:${sub}`, id: `fr-sub:${fs(n1, d)}-?=${fs(left, d)}`,
      ask: 'What was taken away?', prompt: [frac(n1, d), { t: 'op', s: '−' }, { t: 'blank' }, { t: 'op', s: '=' }, frac(left, d)],
      input: 'fraction', answer: { kind: 'fraction', n: n2, d }, weight: 4,
      explain: `${fs(n1, d)} − ${fs(n2, d)} = ${fs(left, d)}: ${n1} − ${left} = ${n2}.`,
      trick: { name: 'Think about the tops', say: `The bottoms match. What takes ${n1} down to ${left}? ${n1} − ${left} = ${n2}.` },
    };
    return {
      skill: 'fr-sub', key: `fr-sub:${sub}`, id: `fr-sub:${fs(n1, d)}-${fs(n2, d)}`,
      ask: 'Take it away.', prompt: [frac(n1, d), { t: 'op', s: '−' }, frac(n2, d), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: left, d }, weight: 3,
      explain: `Same size pieces: take away the tops, keep the bottom. ${fs(n1, d)} − ${fs(n2, d)} = ${fs(left, d)}${g > 1 ? ` (the same as ${fs(left / g, d / g)})` : ''}.`,
      trick: { name: 'Take away the tops', say: 'When the bottoms match, the pieces are the same size: take away the tops and keep the bottom.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- mixed numbers ----------
// rungs: 1 halves to quarters, 1 or 2 wholes · 2 to sixths, 3 wholes · 3 to eighths, 4 wholes · 4 to
// tenths, 6 wholes, and sometimes "how many wholes?" · 5 to twelfths, 9 wholes · 6 up to 12 wholes
export const frMixed: Skill = {
  id: 'fr-mixed', area: 'fractions', grade: 4, standard: '4.NF.B.3c',
  name: 'Mixed numbers', short: 'Mixed', plain: 'Changes mixed numbers and fractions bigger than one into each other: 2 1/4 = 9/4, and 11/4 = 2 3/4.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'to-frac', label: 'mixed to a fraction' }, { id: 'to-mixed', label: 'a fraction to mixed' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = pick(rng, perRung(r, [[2, 3, 4], [2, 3, 4, 5, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [5, 6, 8, 10, 12], [6, 8, 10, 12]]));
    const w = int(rng, 1, perRung(r, [2, 3, 4, 6, 9, 12])), n = int(rng, 1, d - 1), top = w * d + n;
    if (sub === 'to-mixed' && r >= 4 && rng() < 0.4) return {
      skill: 'fr-mixed', key: 'fr-mixed:to-mixed', id: `fr-mixed:${top}/${d}:w`,
      ask: 'How many wholes?', prompt: [frac(top, d), { t: 'op', s: '=' }, { t: 'blank' }, frac(n, d)],
      input: 'number', answer: { kind: 'number', value: w }, weight: 3,
      explain: `${top} ÷ ${d} = ${w} ${w === 1 ? 'whole' : 'wholes'} with ${n} left over. ${fs(top, d)} = ${w} ${fs(n, d)}.`,
      trick: { name: 'Pull out the wholes', say: `Every ${d} pieces make a whole. How many lots of ${d} fit in ${top}? ${w} (that's ${w * d}), with ${n} left.` },
    };
    if (sub === 'to-frac') {
      return {
        skill: 'fr-mixed', key: 'fr-mixed:to-frac', id: `fr-mixed:${w}_${n}/${d}`,
        ask: 'What goes on top?', prompt: [{ t: 'num', n: w }, frac(n, d), { t: 'op', s: '=' }, frac(null, d)],
        input: 'number', answer: { kind: 'number', value: top }, weight: 3,
        explain: `Each whole is ${fs(d, d)}, so ${w} ${w === 1 ? "whole is" : "wholes are"} ${w * d} pieces. Add the ${n} more: ${w * d} + ${n} = ${top}. ${w} ${fs(n, d)} = ${fs(top, d)}.`,
        trick: { name: 'Wholes into pieces', say: `Times the whole number by the bottom (${w} × ${d} = ${w * d}), then add the top (${n}).` },
      };
    }
    return {
      skill: 'fr-mixed', key: 'fr-mixed:to-mixed', id: `fr-mixed:${top}/${d}`,
      ask: `How many ${NAME[d] ?? 'pieces'} are left over?`, prompt: [frac(top, d), { t: 'op', s: '=' }, { t: 'num', n: w }, frac(null, d)],
      input: 'number', answer: { kind: 'number', value: n }, weight: 3,
      explain: `${top} ÷ ${d} = ${w} ${w === 1 ? "whole" : "wholes"} with ${n} left over. ${fs(top, d)} = ${w} ${fs(n, d)}.`,
      trick: { name: 'Pull out the wholes', say: `Every ${d} pieces make a whole. ${w} wholes use ${w * d} pieces; ${top} − ${w * d} = ${n} are left over.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- a whole number times a fraction ----------
// rungs: 1 thirds to sixths, times 2 to 5 · 2 to eighths, times 7 · 3 to tenths, times 9 · 4 to twelfths,
// times 10 · 5 sometimes the whole number is missing (? × 2/5 = 6/5), times 12 · 6 more of those
export const frTimes: Skill = {
  id: 'fr-times', area: 'fractions', grade: 4, standard: '4.NF.B.4',
  name: 'Times a fraction', short: 'Times', plain: 'Multiplies a fraction by a whole number: 3 × 2/5 = 6/5 (three lots of two fifths).',
  input: 'fraction', fastMs: 8000,
  subs: [{ id: 'unit', label: 'times one piece' }, { id: 'pieces', label: 'times some pieces' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const d = pick(rng, perRung(r, [[3, 4, 5, 6], [3, 4, 5, 6, 8], [4, 5, 6, 8, 10], [5, 6, 8, 10, 12], [6, 8, 10, 12], [8, 10, 12]]));
    const k = int(rng, 2, perRung(r, [5, 7, 9, 10, 12, 12]));
    const n = sub === 'unit' ? 1 : int(rng, 2, d - 1);
    if (r >= 5 && rng() < (r === 5 ? 0.3 : 0.45)) return {
      skill: 'fr-times', key: `fr-times:${sub}`, id: `fr-times:?x${fs(n, d)}=${k * n}`,
      ask: 'How many lots?', prompt: [{ t: 'blank' }, { t: 'op', s: '×' }, frac(n, d), { t: 'op', s: '=' }, frac(k * n, d)],
      input: 'number', answer: { kind: 'number', value: k }, weight: 5,
      explain: `The bottom stays ${d}, so the tops tell it: ${k} × ${n} = ${k * n}. That's ${k} lots of ${fs(n, d)}.`,
      trick: { name: 'Times the top', say: `Keep the bottom and look at the tops: what times ${n} makes ${k * n}? ${k}.` },
    };
    return {
      skill: 'fr-times', key: `fr-times:${sub}`, id: `fr-times:${k}x${fs(n, d)}`,
      ask: 'Times it.', prompt: [{ t: 'num', n: k }, { t: 'op', s: '×' }, frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: k * n, d }, weight: sub === 'unit' ? 3 : 4,
      explain: `${k} lots of ${fs(n, d)} is ${k * n} pieces of ${fs(1, d)}: ${fs(k * n, d)}${k * n > d ? ' (more than one whole)' : ''}.`,
      trick: { name: 'Times the top', say: `The pieces stay the same size, so keep the bottom (${d}) and times the top: ${k} × ${n} = ${k * n}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding with different bottom numbers ----------
// rungs: 1 the easiest pairs (halves with quarters, sixths, eighths) · 2 more pairs · 3 every grade 5 pair
// · 4 bigger bottoms (thirds and eighths, eighths and twelfths) · 5 sometimes taking away instead · 6
// taking away half the time
const UNLIKE_FITS: [number, number][] = [[2, 4], [2, 6], [2, 8], [3, 6], [4, 8], [2, 10], [5, 10], [3, 12], [4, 12], [6, 12], [3, 9]];
const UNLIKE_BOTH: [number, number][] = [[2, 3], [3, 4], [2, 5], [4, 6], [3, 5], [6, 8], [4, 10], [3, 8], [5, 6], [6, 9], [8, 12], [6, 10]];
export const frUnlike: Skill = {
  id: 'fr-unlike', area: 'fractions', grade: 5, standard: '5.NF.A.1',
  name: 'Different bottoms', short: 'Unlike', plain: 'Adds fractions with different bottom numbers by making them match first: 1/2 + 1/4 = 2/4 + 1/4 = 3/4.',
  input: 'fraction', fastMs: 10000,
  subs: [{ id: 'fits', label: 'one bottom fits the other' }, { id: 'both', label: 'both bottoms change' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const pairs = sub === 'fits' ? UNLIKE_FITS.slice(0, perRung(r, [5, 7, 9, 11])) : UNLIKE_BOTH.slice(0, perRung(r, [3, 5, 7, 12]));
    const [d1, d2] = pick(rng, pairs);
    const n1 = int(rng, 1, d1 - 1), n2 = int(rng, 1, d2 - 1);
    const lcm = (d1 * d2) / gcd(d1, d2);
    const t1 = n1 * (lcm / d1), t2 = n2 * (lcm / d2);
    // taking away: the bigger one first (never two equal ones: that would leave nothing)
    const minus = r >= 5 && t1 !== t2 && rng() < (r === 5 ? 0.35 : 0.5);
    const swap = minus ? t1 < t2 : rng() < 0.5;
    const A: [number, number] = swap ? [n2, d2] : [n1, d1], B: [number, number] = swap ? [n1, d1] : [n2, d2];
    const top = minus ? Math.abs(t1 - t2) : t1 + t2, g = gcd(top, lcm);
    const verb = minus ? 'take away' : 'add';
    return {
      skill: 'fr-unlike', key: `fr-unlike:${sub}`, id: `fr-unlike:${fs(A[0], A[1])}${minus ? '-' : '+'}${fs(B[0], B[1])}`,
      ask: minus ? 'Take it away.' : 'Add them up.', prompt: [frac(A[0], A[1]), { t: 'op', s: minus ? '−' : '+' }, frac(B[0], B[1]), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: top, d: lcm }, weight: Math.min(5, (sub === 'fits' ? 4 : 5) + (minus ? 1 : 0)),
      explain: `Make the bottoms match: ${fs(A[0], A[1])} = ${fs(A[0] * (lcm / A[1]), lcm)} and ${fs(B[0], B[1])} = ${fs(B[0] * (lcm / B[1]), lcm)}. Then ${verb} the tops: ${fs(top, lcm)}${g > 1 ? ` (the same as ${fs(top / g, lcm / g)})` : ''}.`,
      trick: { name: 'Make the pieces match', say: `You can't ${verb} different sized pieces. Turn both into ${NAME[lcm] ?? `pieces of ${fs(1, lcm)}`} first, then ${verb} the tops.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

/** Every fraction skill, in the order they're learned. */
export const FRACTION_SKILLS: Skill[] = [frName, frUnit, frSet, frLine, frCompare, frEqual, frAdd, frSub, frMixed, frTimes, frUnlike];
