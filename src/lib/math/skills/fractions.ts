// The first fraction skills (the pilot of the skills engine): what fraction is shaded, which is bigger,
// equal fractions, and adding fractions with the same bottom number. Each makes endless questions from a
// seeded generator, gentle at level 1 (small denominators, pictures to help) and wider at level 2.
import type { Rng } from '../../engine/rng';
import type { Answer, Item, Part, Pic, Skill } from './types';

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
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
export const frName: Skill = {
  id: 'fr-name', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'Name the fraction', short: 'Name it', plain: 'Says what fraction of a shape is shaded: 3 of 4 equal parts is 3/4.',
  input: 'fraction', fastMs: 6000,
  subs: [2, 3, 4, 6, 8].map(d => ({ id: String(d), label: NAME[d] })),
  make(rng, sub, level) {
    const d = +sub;
    const n = level === 1 ? (rng() < 0.6 ? 1 : int(rng, 1, d - 1)) : int(rng, 1, d - 1);
    const kind: Pic['kind'] = rng() < 0.5 ? 'pie' : 'bar';
    return {
      skill: 'fr-name', key: `fr-name:${d}`, id: `fr-name:${kind}:${n}/${d}`,
      ask: 'What fraction is shaded?', prompt: [pic({ kind, parts: d, filled: n })],
      input: 'fraction', answer: { kind: 'fraction', n, d }, weight: d <= 4 ? 1 : 2,
      explain: `${n} of the ${d} equal parts ${n === 1 ? 'is' : 'are'} shaded: ${fs(n, d)}.`,
      trick: { name: 'Count the parts', say: `The bottom number counts all the equal parts (${d}). The top number counts the shaded ones (${n}).` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- which is bigger? ----------
type Pair = { a: [number, number]; b: [number, number] };
function comparePair(rng: Rng, sub: string, level: 1 | 2): Pair {
  if (sub === 'same-d') {
    const d = pick(rng, level === 1 ? [3, 4, 5, 6, 8] : [5, 6, 8, 10, 12]);
    let n1 = int(rng, 1, d - 1), n2 = int(rng, 1, d - 1);
    while (n2 === n1) n2 = int(rng, 1, d - 1);
    return { a: [n1, d], b: [n2, d] };
  }
  if (sub === 'same-n') {
    const n = level === 1 ? pick(rng, [1, 2]) : pick(rng, [2, 3, 4]);
    let d1 = int(rng, n + 1, 10), d2 = int(rng, n + 1, 10);
    while (d2 === d1) d2 = int(rng, n + 1, 10);
    return { a: [n, d1], b: [n, d2] };
  }
  if (sub === 'unit') {
    const ds = level === 1 ? [2, 3, 4, 6, 8] : [2, 3, 4, 5, 6, 8, 10, 12];
    let d1 = pick(rng, ds), d2 = pick(rng, ds);
    while (d2 === d1) d2 = pick(rng, ds);
    return { a: [1, d1], b: [1, d2] };
  }
  // compare through a half: one more than a half, one less (or, at level 2, sometimes exactly the same)
  if (level === 2 && rng() < 0.25) { const k = pick(rng, [2, 3, 4, 5]); return rng() < 0.5 ? { a: [1, 2], b: [k, 2 * k] } : { a: [k, 2 * k], b: [1, 2] }; }
  const d1 = pick(rng, [4, 6, 8, 10]), d2 = pick(rng, [3, 5, 6, 8, 10].filter(x => x !== d1));
  const big: [number, number] = [int(rng, Math.floor(d1 / 2) + 1, d1 - 1), d1];
  const small: [number, number] = [int(rng, 1, Math.ceil(d2 / 2) - 1), d2];
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
  make(rng, sub, level) {
    const { a, b } = comparePair(rng, sub, level);
    const va = a[0] / a[1], vb = b[0] / b[1];
    const id = Math.abs(va - vb) < 1e-9 ? 'same' : va > vb ? 'a' : 'b';
    const show = level === 1;
    const side = (f: [number, number]): Part[] => (show ? [pic({ kind: 'bar', parts: f[1], filled: f[0] }), frac(f[0], f[1])] : [frac(f[0], f[1])]);
    const bigger = id === 'same' ? null : id === 'a' ? a : b, smaller = id === 'a' ? b : a;
    return {
      skill: 'fr-compare', key: `fr-compare:${sub}`, id: `fr-compare:${fs(a[0], a[1])}:${fs(b[0], b[1])}`,
      ask: 'Which is bigger?', prompt: [frac(a[0], a[1]), { t: 'op', s: 'or' }, frac(b[0], b[1])],
      input: 'choice', choices: [{ id: 'a', parts: side(a) }, { id: 'same', parts: [{ t: 'text', s: 'The same' }] }, { id: 'b', parts: side(b) }],
      answer: { kind: 'choice', id }, weight: sub === 'half' ? 3 : 2,
      explain: bigger ? `${fs(bigger[0], bigger[1])} is bigger than ${fs(smaller[0], smaller[1])}. ${WHY[sub]}` : `${fs(a[0], a[1])} and ${fs(b[0], b[1])} are the same size: equal fractions.`,
      trick: { name: sub === 'half' ? 'Next to a half' : 'Look at the pieces', say: WHY[sub] + (sub === 'half' ? ' More than half the parts is more than a half.' : '') },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- equal fractions ----------
export const frEqual: Skill = {
  id: 'fr-equal', area: 'fractions', grade: 4, standard: '4.NF.A.1',
  name: 'Equal fractions', short: 'Equal', plain: 'Finds equal fractions: 1/2 = 2/4, by multiplying (or dividing) the top and bottom by the same number.',
  input: 'number', fastMs: 6000,
  subs: [{ id: 'x2', label: 'times 2' }, { id: 'x3', label: 'times 3' }, { id: 'x4', label: 'times 4' }, { id: 'smaller', label: 'make it smaller' }],
  make(rng, sub, level) {
    const d = pick(rng, level === 1 ? [2, 3, 4] : [2, 3, 4, 5, 6]);
    const n = int(rng, 1, d - 1);
    const k = sub === 'x2' ? 2 : sub === 'x3' ? 3 : sub === 'x4' ? 4 : pick(rng, [2, 3, 4]);
    const big: [number, number] = [n * k, d * k], small: [number, number] = [n, d];
    // "make it smaller": the big one is given, find the top of the small one
    const [from, to] = sub === 'smaller' ? [big, small] : [small, big];
    return {
      skill: 'fr-equal', key: `fr-equal:${sub}`, id: `fr-equal:${fs(from[0], from[1])}=${to[1]}`,
      ask: 'Make them equal. What goes on top?', prompt: [frac(from[0], from[1]), { t: 'op', s: '=' }, frac(null, to[1])],
      input: 'number', answer: { kind: 'number', value: to[0] }, weight: sub === 'smaller' ? 3 : 2,
      explain: sub === 'smaller'
        ? `${from[1]} ÷ ${k} = ${to[1]}, so divide the top by ${k} too: ${from[0]} ÷ ${k} = ${to[0]}. ${fs(from[0], from[1])} = ${fs(to[0], to[1])}.`
        : `${from[1]} × ${k} = ${to[1]}, so times the top by ${k} too: ${from[0]} × ${k} = ${to[0]}. ${fs(from[0], from[1])} = ${fs(to[0], to[1])}.`,
      trick: { name: 'Same to top and bottom', say: 'Whatever you do to the bottom number, do to the top number too. The pieces change size, the amount stays the same.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding with the same bottom number ----------
export const frAdd: Skill = {
  id: 'fr-add', area: 'fractions', grade: 4, standard: '4.NF.B.3',
  name: 'Add fractions', short: 'Add', plain: 'Adds fractions with the same bottom number: 2/5 + 1/5 = 3/5 (equal answers like 4/8 = 1/2 count).',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'small', label: 'halves to fifths' }, { id: 'mid', label: 'sixths to tenths' }, { id: 'over', label: 'more than one whole' }],
  make(rng, sub, level) {
    const d = sub === 'small' ? pick(rng, [2, 3, 4, 5]) : sub === 'mid' ? pick(rng, [6, 8, 10]) : pick(rng, level === 1 ? [3, 4, 5] : [4, 5, 6, 8]);
    let n1: number, n2: number;
    if (sub === 'over') { n1 = int(rng, Math.ceil(d / 2), d - 1); n2 = int(rng, d - n1 + 1, d - 1); }
    else { n1 = int(rng, 1, d - 1); n2 = int(rng, 1, Math.max(1, d - n1)); if (n1 + n2 > d) n2 = d - n1; }
    const s = n1 + n2, g = gcd(s, d);
    return {
      skill: 'fr-add', key: `fr-add:${sub}`, id: `fr-add:${fs(n1, d)}+${fs(n2, d)}`,
      ask: 'Add them up.', prompt: [frac(n1, d), { t: 'op', s: '+' }, frac(n2, d), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: s, d }, weight: sub === 'over' ? 4 : 3,
      explain: `Same size pieces: add the tops, keep the bottom. ${fs(n1, d)} + ${fs(n2, d)} = ${fs(s, d)}${g > 1 ? ` (that's the same as ${fs(s / g, d / g)})` : ''}${s > d ? `: more than one whole` : s === d ? ': one whole' : ''}.`,
      trick: { name: 'Add the tops', say: 'When the bottoms match, the pieces are the same size: count them up (add the tops) and keep the bottom.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const FRACTION_SKILLS: Skill[] = [frName, frCompare, frEqual, frAdd];
