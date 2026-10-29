// The fraction skills, grades 3 to 5 (Common Core 3.NF, 4.NF and the start of 5.NF): what fraction is
// shaded, one piece and how many pieces, fractions of a set, fractions on a number line, which is bigger,
// equal fractions, adding and taking away with the same bottom number, mixed numbers, a whole number times
// a fraction, and adding with different bottoms. Each makes endless questions from a seeded generator,
// gentle at level 1 (small denominators, pictures to help) and wider at level 2. No generator ever draws
// again "until it's different": every choice comes from a list that already leaves out what it mustn't
// be, so a question is made in one go whatever the random numbers are.
import type { Rng } from '../../engine/rng';
import type { Answer, Item, Part, Pic, Skill } from './types';

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
    const n1 = int(rng, 1, d - 1), n2 = intNot(rng, 1, d - 1, n1);
    return { a: [n1, d], b: [n2, d] };
  }
  if (sub === 'same-n') {
    const n = level === 1 ? pick(rng, [1, 2]) : pick(rng, [2, 3, 4]);
    const d1 = int(rng, n + 1, 10), d2 = intNot(rng, n + 1, 10, d1);
    return { a: [n, d1], b: [n, d2] };
  }
  if (sub === 'unit') {
    const ds = level === 1 ? [2, 3, 4, 6, 8] : [2, 3, 4, 5, 6, 8, 10, 12];
    const d1 = pick(rng, ds), d2 = pick(rng, ds.filter(x => x !== d1));
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

// ---------- one piece, and how many pieces ----------
export const frUnit: Skill = {
  id: 'fr-unit', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'One piece', short: 'One piece', plain: 'Knows one of d equal parts is 1/d, and that 3/4 is three pieces of 1/4.',
  input: 'fraction', fastMs: 6000,
  subs: [{ id: 'one', label: 'one piece' }, { id: 'count', label: 'how many pieces' }],
  make(rng, sub, level) {
    const d = pick(rng, level === 1 ? [2, 3, 4, 6] : [3, 4, 5, 6, 8, 10, 12]);
    if (sub === 'one') {
      const kind: Pic['kind'] = rng() < 0.5 ? 'pie' : 'bar';
      return {
        skill: 'fr-unit', key: 'fr-unit:one', id: `fr-unit:one:${kind}:${d}`,
        ask: 'One piece is what fraction of the whole?', prompt: [pic({ kind, parts: d, filled: 1 })],
        input: 'fraction', answer: { kind: 'fraction', n: 1, d }, weight: 1,
        explain: `The whole is cut into ${d} equal parts, so one part is ${fs(1, d)}.`,
        trick: { name: 'Count the parts', say: `${d} equal parts make the whole. One of them is 1 over ${d}.` },
      };
    }
    const n = int(rng, 2, Math.max(2, d - 1 + (level === 2 ? Math.floor(d / 2) : 0)));
    return {
      skill: 'fr-unit', key: 'fr-unit:count', id: `fr-unit:count:${n}/${d}`,
      ask: `How many pieces of ${fs(1, d)} make it?`, prompt: [frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }, { t: 'op', s: 'pieces of' }, frac(1, d)],
      input: 'number', answer: { kind: 'number', value: n }, weight: 2,
      explain: `${fs(n, d)} is ${n} pieces of ${fs(1, d)}: the top number counts the pieces.`,
      trick: { name: 'The top counts pieces', say: `In ${fs(n, d)} the bottom says how big each piece is, the top says how many pieces: ${n}.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- fractions of a set ----------
export const frSet: Skill = {
  id: 'fr-set', area: 'fractions', grade: 3, standard: '3.NF.A.1',
  name: 'Fractions of a set', short: 'Of a set', plain: 'Names a fraction of a group (2 of 6 cupcakes is 2/6) and finds a fraction of a number (1/3 of 12 is 4).',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'name', label: 'name the part' }, { id: 'unit-of', label: 'one part of a number' }, { id: 'of', label: 'some parts of a number' }],
  make(rng, sub, level) {
    if (sub === 'name') {
      const k = pick(rng, level === 1 ? [2, 3, 4, 5, 6] : [4, 5, 6, 8, 10]);
      const f = int(rng, 1, k - 1);
      return {
        skill: 'fr-set', key: 'fr-set:name', id: `fr-set:name:${f}/${k}`,
        ask: 'What fraction of the cupcakes are pink?', prompt: [pic({ kind: 'set', parts: k, filled: f })],
        input: 'fraction', answer: { kind: 'fraction', n: f, d: k }, weight: 2,
        explain: `${f} of the ${k} cupcakes are pink: ${fs(f, k)}.`,
        trick: { name: 'Count them all, then the pink ones', say: `The bottom number is all the cupcakes (${k}). The top number is the pink ones (${f}).` },
      };
    }
    const d = pick(rng, level === 1 ? [2, 3, 4, 5] : [3, 4, 5, 6, 8]);
    const each = int(rng, 2, level === 1 ? 5 : 9), whole = d * each;
    const top = sub === 'unit-of' ? 1 : int(rng, 2, d - 1);
    const ans = top * each;
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
export const frLine: Skill = {
  id: 'fr-line', area: 'fractions', grade: 3, standard: '3.NF.A.2',
  name: 'Fractions on a number line', short: 'Number line', plain: 'Puts a fraction on a number line: 3/4 is three jumps of 1/4 from 0.',
  input: 'numberline', fastMs: 8000,
  subs: [{ id: 'to-one', label: 'between 0 and 1' }, { id: 'past-one', label: 'past 1' }],
  make(rng, sub, level) {
    const d = pick(rng, level === 1 ? [2, 3, 4] : [3, 4, 5, 6, 8]);
    const max = sub === 'past-one' ? 2 : 1;
    const n = sub === 'past-one' ? int(rng, d + 1, 2 * d - 1) : int(rng, 1, d - 1);
    return {
      skill: 'fr-line', key: `fr-line:${sub}`, id: `fr-line:${n}/${d}`,
      ask: `Drag the pin to ${fs(n, d)}.`, prompt: [{ t: 'text', s: 'Find' }, frac(n, d)],
      input: 'numberline', line: { min: 0, max, step: 1 / d, labels: 'ends', denom: d },
      answer: { kind: 'point', x: n / d }, weight: sub === 'past-one' ? 3 : 2,
      explain: `Each jump between ticks is ${fs(1, d)}. ${fs(n, d)} is ${n} ${n === 1 ? "jump" : "jumps"} from 0${n > d ? `, past the 1 (which is ${fs(d, d)})` : ''}.`,
      trick: { name: 'Jump from zero', say: `The bottom number says how many jumps make 1 (${d}). The top number says how many jumps to take (${n}).` },
    };
  },
  // a pin on the right tick (the line snaps to ticks, so a tiny rounding difference doesn't count)
  check: (it, a) => a.kind === 'point' && it.answer.kind === 'point' && Math.abs(a.x - it.answer.x) < 1e-6,
};

// ---------- taking away with the same bottom number ----------
export const frSub: Skill = {
  id: 'fr-sub', area: 'fractions', grade: 4, standard: '4.NF.B.3a',
  name: 'Take away fractions', short: 'Take away', plain: 'Takes away fractions with the same bottom number: 5/8 − 2/8 = 3/8, and 1 − 3/4 = 1/4.',
  input: 'fraction', fastMs: 7000,
  subs: [{ id: 'small', label: 'thirds to fifths' }, { id: 'mid', label: 'sixths to tenths' }, { id: 'from-one', label: 'from a whole' }],
  make(rng, sub, level) {
    const d = sub === 'small' ? pick(rng, [3, 4, 5]) : sub === 'mid' ? pick(rng, [6, 8, 10]) : pick(rng, level === 1 ? [2, 3, 4] : [4, 5, 6, 8]);
    if (sub === 'from-one') {
      const n = int(rng, 1, d - 1);
      return {
        skill: 'fr-sub', key: 'fr-sub:from-one', id: `fr-sub:1-${n}/${d}`,
        ask: 'Take it away.', prompt: [{ t: 'num', n: 1 }, { t: 'op', s: '−' }, frac(n, d), { t: 'op', s: '=' }, { t: 'blank' }],
        input: 'fraction', answer: { kind: 'fraction', n: d - n, d }, weight: 3,
        explain: `1 whole is ${fs(d, d)}. ${fs(d, d)} − ${fs(n, d)} = ${fs(d - n, d)}.`,
        trick: { name: 'A whole is the bottom over itself', say: `Write the 1 as ${fs(d, d)}, then take away the tops: ${d} − ${n} = ${d - n}.` },
      };
    }
    const n1 = int(rng, 2, d - 1), n2 = int(rng, 1, n1 - 1);
    const r = n1 - n2, g = gcd(r, d);
    return {
      skill: 'fr-sub', key: `fr-sub:${sub}`, id: `fr-sub:${fs(n1, d)}-${fs(n2, d)}`,
      ask: 'Take it away.', prompt: [frac(n1, d), { t: 'op', s: '−' }, frac(n2, d), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: r, d }, weight: 3,
      explain: `Same size pieces: take away the tops, keep the bottom. ${fs(n1, d)} − ${fs(n2, d)} = ${fs(r, d)}${g > 1 ? ` (the same as ${fs(r / g, d / g)})` : ''}.`,
      trick: { name: 'Take away the tops', say: 'When the bottoms match, the pieces are the same size: take away the tops and keep the bottom.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- mixed numbers ----------
export const frMixed: Skill = {
  id: 'fr-mixed', area: 'fractions', grade: 4, standard: '4.NF.B.3c',
  name: 'Mixed numbers', short: 'Mixed', plain: 'Changes mixed numbers and fractions bigger than one into each other: 2 1/4 = 9/4, and 11/4 = 2 3/4.',
  input: 'number', fastMs: 8000,
  subs: [{ id: 'to-frac', label: 'mixed to a fraction' }, { id: 'to-mixed', label: 'a fraction to mixed' }],
  make(rng, sub, level) {
    const d = pick(rng, level === 1 ? [2, 3, 4] : [3, 4, 5, 6, 8]);
    const w = int(rng, 1, level === 1 ? 2 : 4), n = int(rng, 1, d - 1), top = w * d + n;
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
export const frTimes: Skill = {
  id: 'fr-times', area: 'fractions', grade: 4, standard: '4.NF.B.4',
  name: 'Times a fraction', short: 'Times', plain: 'Multiplies a fraction by a whole number: 3 × 2/5 = 6/5 (three lots of two fifths).',
  input: 'fraction', fastMs: 8000,
  subs: [{ id: 'unit', label: 'times one piece' }, { id: 'pieces', label: 'times some pieces' }],
  make(rng, sub, level) {
    const d = pick(rng, level === 1 ? [3, 4, 5, 6] : [4, 5, 6, 8, 10]);
    const k = int(rng, 2, level === 1 ? 5 : 9);
    const n = sub === 'unit' ? 1 : int(rng, 2, d - 1);
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
const UNLIKE_FITS: [number, number][] = [[2, 4], [2, 6], [2, 8], [3, 6], [4, 8], [2, 10], [5, 10], [3, 12], [4, 12]];
const UNLIKE_BOTH: [number, number][] = [[2, 3], [3, 4], [2, 5], [4, 6], [3, 5], [6, 8], [4, 10]];
export const frUnlike: Skill = {
  id: 'fr-unlike', area: 'fractions', grade: 5, standard: '5.NF.A.1',
  name: 'Different bottoms', short: 'Unlike', plain: 'Adds fractions with different bottom numbers by making them match first: 1/2 + 1/4 = 2/4 + 1/4 = 3/4.',
  input: 'fraction', fastMs: 10000,
  subs: [{ id: 'fits', label: 'one bottom fits the other' }, { id: 'both', label: 'both bottoms change' }],
  make(rng, sub, level) {
    const pairs = sub === 'fits' ? (level === 1 ? UNLIKE_FITS.slice(0, 5) : UNLIKE_FITS) : (level === 1 ? UNLIKE_BOTH.slice(0, 3) : UNLIKE_BOTH);
    const [d1, d2] = pick(rng, pairs);
    const n1 = int(rng, 1, d1 - 1), n2 = int(rng, 1, d2 - 1);
    const lcm = (d1 * d2) / gcd(d1, d2);
    const top = n1 * (lcm / d1) + n2 * (lcm / d2), g = gcd(top, lcm);
    const swap = rng() < 0.5;
    const A: [number, number] = swap ? [n2, d2] : [n1, d1], B: [number, number] = swap ? [n1, d1] : [n2, d2];
    return {
      skill: 'fr-unlike', key: `fr-unlike:${sub}`, id: `fr-unlike:${fs(A[0], A[1])}+${fs(B[0], B[1])}`,
      ask: 'Add them up.', prompt: [frac(A[0], A[1]), { t: 'op', s: '+' }, frac(B[0], B[1]), { t: 'op', s: '=' }, { t: 'blank' }],
      input: 'fraction', answer: { kind: 'fraction', n: top, d: lcm }, weight: sub === 'fits' ? 4 : 5,
      explain: `Make the bottoms match: ${fs(n1, d1)} = ${fs(n1 * (lcm / d1), lcm)} and ${fs(n2, d2)} = ${fs(n2 * (lcm / d2), lcm)}. Then add the tops: ${fs(top, lcm)}${g > 1 ? ` (the same as ${fs(top / g, lcm / g)})` : ''}.`,
      trick: { name: 'Make the pieces match', say: `You can't add different sized pieces. Turn both into ${NAME[lcm] ?? `pieces of ${fs(1, lcm)}`} first, then add the tops.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

/** Every fraction skill, in the order they're learned. */
export const FRACTION_SKILLS: Skill[] = [frName, frUnit, frSet, frLine, frCompare, frEqual, frAdd, frSub, frMixed, frTimes, frUnlike];
