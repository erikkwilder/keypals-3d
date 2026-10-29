// Place value and big numbers, kindergarten to grade 4 (Common Core K.CC, 1.NBT, 2.NBT, 3.NBT, 4.NBT):
// counting on to 120 and number names, skip counting, tens and ones, hundreds, comparing, adding and
// taking away with regrouping (shown with base-ten blocks), rounding, and big numbers to a million. Each
// skill makes endless questions from a seeded generator on six rungs (types.ts): rung 1 gentle (small
// numbers, blocks to help), rung 3 the full grade-level range, rungs 4 to 6 the stretch (bigger numbers,
// missing parts, counting back, blocks that need trading, numbers written another way). Each skill's
// comment says what its rungs mean. As with the fractions, no generator ever draws again "until it's
// different": every choice comes from a list that already leaves out what it mustn't be, so a question
// is made in one go whatever the random numbers.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import { perRung, rungOf, type Blocks, type Item, type Part, type Skill } from './types';

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const tx = (s: string): Part => ({ t: 'text', s });
const blocks = (b: Blocks): Part => ({ t: 'blocks', b });
const blank: Part = { t: 'blank' };
/** a number as base-ten blocks */
export const blocksOf = (n: number): Blocks => ({ th: Math.floor(n / 1000) % 10, h: Math.floor(n / 100) % 10, t: Math.floor(n / 10) % 10, o: n % 10 });
/** 4,382 with a comma (four digits and up) */
export const commas = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n));
/** 345 as 300 + 40 + 5 (zeros left out; the order shuffled when `mix`) */
function expanded(n: number, rng?: Rng): string {
  const s = String(n), terms = [...s].map((d, i) => +d * 10 ** (s.length - 1 - i)).filter(t => t > 0);
  if (rng && terms.length > 1) { const i = int(rng, 0, terms.length - 1); [terms[0], terms[i]] = [terms[i], terms[0]]; }
  return terms.map(commas).join(' + ');
}

// ---------- number names ----------
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function under1000(n: number): string {
  const h = Math.floor(n / 100), r = n % 100, out: string[] = [];
  if (h) out.push(`${ONES[h]} hundred`);
  if (r) out.push(r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : ''));
  return out.join(' and ');
}
/** 243 -> "two hundred and forty-three"; 47,382 -> "forty-seven thousand, three hundred and eighty-two" */
export function words(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const m = Math.floor(n / 1_000_000), th = Math.floor(n / 1000) % 1000, r = n % 1000;
  if (m) parts.push(`${under1000(m)} million`);
  if (th) parts.push(`${under1000(th)} thousand`);
  if (r) parts.push(under1000(r));
  return parts.join(', ');
}

// ---------- counting on to 120 ----------
// rungs: 1 counting on and back to 40, names to 50 · 2 to 80, sometimes across a ten · 3 to 120, across
// tens and 100 (49 → 50, 99 → 100) · 4 to 300, across hundreds, sometimes the middle one missing · 5 to
// 1,000 (2.NBT.A.2) · 6 to 1,000 across hundreds, names with a zero in them (four hundred and six)
export const pvCount: Skill = {
  id: 'pv-count', area: 'place', grade: 1, standard: '1.NBT.A.1',
  name: 'Count on', short: 'Count on', plain: 'Counts on and back to 120 from any number, and reads number names.',
  input: 'number', fastMs: 4000,
  subs: [{ id: 'next', label: 'what comes next' }, { id: 'before', label: 'what comes before' }, { id: 'words', label: 'number names' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    if (sub === 'words') {
      let n = int(rng, ...perRung(r, [[11, 50], [21, 99], [51, 120], [101, 199], [100, 999], [101, 999]] as [number, number][]));
      // the stretch: a zero in the middle or at the end (405, 760)
      if (r >= 6) { const h = Math.floor(n / 100); n = rng() < 0.5 ? 100 * h + int(rng, 1, 9) : 100 * h + 10 * int(rng, 1, 9); }
      return {
        skill: 'pv-count', key: 'pv-count:words', id: `pv-count:w${n}`,
        ask: 'Write the number', prompt: [tx(words(n)), op('='), blank],
        input: 'number', answer: { kind: 'number', value: n }, weight: n > 100 ? (r >= 5 ? 3 : 2) : 1,
        explain: `${words(n)} is ${n}.`, trick: { name: n >= 100 ? 'Hundreds first' : 'Tens first', say: n >= 100 ? 'Write the hundreds digit first, then the tens and ones. No tens? A 0 holds the place.' : `Find the tens word first (${n >= 20 ? TENS[Math.floor(n / 10) % 10] || 'one hundred' : 'teen'}), then the ones.` },
      };
    }
    // crossing a ten (rung 2-3) or a hundred (from rung 4): 49 -> 50, 99 -> 100, 110 -> 109, 299 -> 300
    const cross = rng() < perRung(r, [0, 0.3, 0.6, 0.6, 0.5, 0.6]);
    const tens = [19, 29, 39, 49, 59, 69, 79, 89, 99, 109];
    const hundreds = [99, 199, 299, 399, 499, 599, 699, 799, 899];
    const edges = r >= 4 ? hundreds : tens;
    const [lo, hi] = perRung(r, [[1, 37], [10, 77], [30, 115], [90, 297], [100, 990], [100, 996]] as [number, number][]);
    const next = sub === 'next';
    let a: number;
    if (next) a = cross ? pick(rng, r <= 2 ? tens.slice(0, 7) : edges) - 2 : int(rng, lo, hi);
    else a = cross ? pick(rng, r <= 2 ? tens.slice(0, 7) : edges) + 3 : int(rng, lo + 5, hi + 3);
    const seq = next ? [a, a + 1, a + 2] : [a, a - 1, a - 2];
    const want = next ? a + 3 : a - 3;
    // the stretch: the middle one is missing (47, __, 49)
    const mid = r >= 4 && rng() < perRung(r, [0, 0, 0, 0.3, 0.3, 0.4]);
    return {
      skill: 'pv-count', key: `pv-count:${sub}`, id: `pv-count:${sub}${a}${mid ? 'm' : ''}`,
      ask: mid ? 'What number is missing?' : next ? 'What comes next?' : 'Count back: what comes next?',
      prompt: mid ? [num(seq[0]), op(','), blank, op(','), num(seq[2])] : [num(seq[0]), op(','), num(seq[1]), op(','), num(seq[2]), op(','), blank],
      input: 'number', answer: { kind: 'number', value: mid ? seq[1] : want }, weight: (cross ? 2 : 1) + (r >= 5 ? 1 : 0),
      explain: mid ? `${seq.join(', ')}.` : `${seq.join(', ')}, ${want}.`, trick: { name: 'Watch the ones', say: next ? 'After 9 ones, the tens go up by one and the ones start again at 0.' : 'Before 0 ones, the tens go down by one and the ones go back to 9.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- skip counting ----------
// rungs: 1 starting on the step itself (5, 10, 15) · 2 anywhere on the pattern up to 9 steps · 3 anywhere,
// even off it (by 10s from 3) · 4 sometimes counting back · 5 bigger numbers (by 2s past 100, by 100s past
// 1,000) and back · 6 big numbers, back, and sometimes the middle one missing
export const pvSkip: Skill = {
  id: 'pv-skip', area: 'place', grade: 2, standard: '2.NBT.A.2',
  name: 'Skip counting', short: 'Skip count', plain: 'Skip counts by 2s, 5s, 10s and 100s.',
  input: 'number', fastMs: 4000,
  subs: [{ id: '2', label: 'by 2s' }, { id: '5', label: 'by 5s' }, { id: '10', label: 'by 10s' }, { id: '100', label: 'by 100s' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), k = +sub;
    let start: number;
    if (r === 1) start = k * int(rng, 1, 4);
    else if (r === 2) start = k * int(rng, 1, 9);
    else if (r <= 4) start = k === 2 || k === 5 ? k * int(rng, 2, 18) : k === 10 ? int(rng, 1, 60) : 100 * int(rng, 1, 5) + (rng() < 0.5 ? 0 : int(rng, 1, 9) * 10);
    else start = k === 2 || k === 5 ? k * int(rng, 10, 100) : k === 10 ? int(rng, 1, 500) : 100 * int(rng, 1, 30) + (rng() < 0.5 ? 0 : int(rng, 1, 99));
    const back = r >= 4 && rng() < 0.4;
    if (back) start = Math.max(start, 3 * k + (start % k));
    const step = back ? -k : k;
    const seq = [start, start + step, start + 2 * step];
    const want = start + 3 * step;
    const mid = r >= 6 && rng() < 0.4;
    return {
      skill: 'pv-skip', key: `pv-skip:${sub}`, id: `pv-skip:${k}:${start}${back ? 'b' : ''}${mid ? 'm' : ''}`,
      ask: mid ? `Counting by ${k}s: what number is missing?` : back ? `Count back by ${k}s: what comes next?` : `Count by ${k}s: what comes next?`,
      prompt: mid ? [num(seq[0]), op(','), blank, op(','), num(seq[2])] : [num(seq[0]), op(','), num(seq[1]), op(','), num(seq[2]), op(','), blank],
      input: 'number', answer: { kind: 'number', value: mid ? seq[1] : want }, weight: Math.min(5, (k === 100 || start % k ? 2 : 1) + (back ? 1 : 0) + (r >= 5 ? 1 : 0)),
      explain: `Counting ${back ? 'back ' : ''}by ${k}s: ${seq.join(', ')}, ${want}.`,
      trick: { name: `Jumps of ${k}`, say: k === 10 ? 'By 10s, only the tens change: the ones stay the same.' : k === 100 ? 'By 100s, only the hundreds change.' : k === 5 ? 'By 5s, the ones go 5, 0, 5, 0.' : 'By 2s, skip one number each time.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- tens and ones ----------
// rungs: 1 up to 5 tens, a few ones · 2 up to 7 tens · 3 any two-digit number, sometimes "how many ones?"
// · 4 blocks that need trading (2 rods and 13 cubes is 33), splits that do too (47 = 3 tens and 17 ones),
// teens as loose cubes · 5 more of those · 6 more again, and 10 to 12 tens (12 tens and 3 ones is 123)
export const pvTens: Skill = {
  id: 'pv-tens', area: 'place', grade: 1, standard: '1.NBT.B.2',
  name: 'Tens and ones', short: 'Tens & ones', plain: 'Sees a two-digit number as tens and ones: 47 is 4 tens and 7 ones.',
  input: 'number', fastMs: 5000,
  subs: [{ id: 'teen', label: 'teen numbers' }, { id: 'read', label: 'blocks to a number' }, { id: 'split', label: 'how many tens' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const trade = r >= 4 && rng() < perRung(r, [0, 0, 0, 0.3, 0.45, 0.5]);
    if (sub === 'teen') {
      const o = int(rng, 1, 9), n = 10 + o;
      return {
        skill: 'pv-tens', key: 'pv-tens:teen', id: `pv-tens:teen${n}${trade ? 'c' : ''}`,
        ask: 'How many?', prompt: [blocks(trade ? { h: 0, t: 0, o: n } : { h: 0, t: 1, o })],
        input: 'number', answer: { kind: 'number', value: n }, weight: trade ? 2 : 1,
        explain: trade ? `${n} cubes: ten of them make a ten, and ${o} more. ${n}.` : `1 ten and ${o} ones is ${n}.`,
        trick: { name: 'A ten and some more', say: trade ? `Count ten cubes: that's a ten. Then count on the rest from 10: ${Array.from({ length: o }, (_, i) => 11 + i).join(', ')}.` : `The rod is 10. Count on from 10: ${Array.from({ length: o }, (_, i) => 11 + i).join(', ')}.` },
      };
    }
    const [tHi, oLo, oHi] = perRung(r, [[5, 1, 6], [7, 0, 8], [9, 0, 9]] as [number, number, number][]);
    const t = int(rng, 2, tHi), o = int(rng, oLo, oHi), n = 10 * t + o;
    if (sub === 'read') {
      const big = r >= 6 && !trade && rng() < 0.3;
      // 2 rods and 13 cubes; or 12 rods and 3 cubes
      const b: Blocks = big ? { h: 0, t: int(rng, 10, 12), o } : trade ? { h: 0, t: int(rng, 1, 7), o: int(rng, 10, 15) } : { h: 0, t, o };
      const v = 10 * b.t + b.o;
      return {
        skill: 'pv-tens', key: 'pv-tens:read', id: `pv-tens:read${b.t}.${b.o}`,
        ask: 'How many?', prompt: [blocks(b)],
        input: 'number', answer: { kind: 'number', value: v }, weight: trade || big ? 3 : 2,
        explain: `${b.t} tens and ${b.o} ones is ${v}.${b.o > 9 ? ` (${b.o} ones are 1 ten and ${b.o - 10} more.)` : ''}`,
        trick: { name: 'Count the rods by 10s', say: b.o > 9 ? 'Count the rods by 10s, then the cubes: ten cubes make one more ten.' : `${Array.from({ length: Math.min(b.t, 12) }, (_, i) => 10 * (i + 1)).join(', ')}... then count on the ones.` },
      };
    }
    // split: 47 = __ tens and 7 ones (or the ones, sometimes); the stretch: 47 = 3 tens and __ ones
    if (trade) {
      const fewer = r >= 6 && t >= 3 && rng() < 0.3 ? 2 : 1;
      return {
        skill: 'pv-tens', key: 'pv-tens:split', id: `pv-tens:split${n}-${fewer}`,
        ask: 'How many ones?', prompt: [num(n), op('='), num(t - fewer), tx('tens and'), blank, tx('ones')],
        input: 'number', answer: { kind: 'number', value: o + 10 * fewer }, weight: 3,
        explain: `${n} is ${t} tens and ${o} ones. With ${fewer === 1 ? 'one ten' : 'two tens'} fewer, those ${10 * fewer} go into the ones: ${t - fewer} tens and ${o + 10 * fewer} ones.`,
        trick: { name: 'Break a ten', say: `A ten is ten ones. Take ${fewer === 1 ? 'a ten' : 'two tens'} away from the tens and the ones get ${10 * fewer} more.` },
      };
    }
    const askOnes = rng() < perRung(r, [0, 0.2, 0.35]);
    return {
      skill: 'pv-tens', key: 'pv-tens:split', id: `pv-tens:split${n}${askOnes ? 'o' : 't'}`,
      ask: askOnes ? 'How many ones?' : 'How many tens?',
      prompt: askOnes ? [num(n), op('='), num(t), tx('tens and'), blank, tx('ones')] : [num(n), op('='), blank, tx('tens and'), num(o), tx('ones')],
      input: 'number', answer: { kind: 'number', value: askOnes ? o : t }, weight: 2,
      explain: `${n} is ${t} tens and ${o} ones.`, trick: { name: 'Digits have places', say: 'The first digit counts the tens, the last digit counts the ones.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- hundreds ----------
// rungs: 1 up to 4 hundreds, small tens and ones · 2 up to 6 hundreds · 3 any three-digit number, expanded
// both ways · 4 blocks that need trading (2 flats, 13 rods, 4 cubes is 334), expanded in any order
// (5 + 300 + 40) · 5 more of those, and the hundreds missing (345 = __ + 40 + 5) · 6 more again, zeros
// in expanded form (400 + 7 = 407)
export const pvHundreds: Skill = {
  id: 'pv-hundreds', area: 'place', grade: 2, standard: '2.NBT.A.1',
  name: 'Hundreds, tens and ones', short: 'Hundreds', plain: 'Reads and writes numbers to 1,000: 345 is 3 hundreds, 4 tens and 5 ones (300 + 40 + 5).',
  input: 'number', fastMs: 6000,
  subs: [{ id: 'read', label: 'blocks to a number' }, { id: 'expanded', label: 'expanded form' }, { id: 'zero', label: 'numbers with a zero' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [hHi, tHi, oHi] = perRung(r, [[4, 5, 6], [6, 7, 8], [9, 9, 9]] as [number, number, number][]);
    const h = int(rng, 1, hHi);
    let t = int(rng, 1, tHi), o = int(rng, 1, oHi);
    const stretch = r >= 4 && rng() < perRung(r, [0, 0, 0, 0.35, 0.45, 0.5]);
    if (sub === 'zero') { if (r >= 6 && rng() < 0.25) { t = 0; o = 0; } else if (rng() < 0.5) t = 0; else o = 0; }
    if (sub === 'read' || sub === 'zero') {
      // trading: more than 9 rods or cubes (only on numbers without a zero, so "zero" stays about zeros)
      const b: Blocks = stretch && sub === 'read' ? (rng() < 0.5 ? { h: Math.min(h, 8), t, o: int(rng, 10, 14) } : { h: Math.min(h, 8), t: int(rng, 10, 13), o }) : { h, t, o };
      const n = 100 * b.h + 10 * b.t + b.o;
      if (sub === 'zero' && stretch) return {
        skill: 'pv-hundreds', key: 'pv-hundreds:zero', id: `pv-hundreds:zx${n}`,
        ask: 'What number is it?', prompt: [tx(expanded(n)), op('='), blank],
        input: 'number', answer: { kind: 'number', value: n }, weight: 3,
        explain: `${expanded(n)} = ${n}: the 0 holds the empty place.`,
        trick: { name: 'Zero holds the place', say: 'Write a digit for every place: hundreds, tens, ones. A place with nothing in it gets a 0.' },
      };
      return {
        skill: 'pv-hundreds', key: `pv-hundreds:${sub}`, id: `pv-hundreds:${sub}${b.h}.${b.t}.${b.o}`,
        ask: 'How many?', prompt: [blocks(b)],
        input: 'number', answer: { kind: 'number', value: n }, weight: sub === 'zero' || b.t > 9 || b.o > 9 ? 3 : 2,
        explain: `${b.h} hundreds, ${b.t} tens and ${b.o} ones is ${n}.${b.t > 9 ? ` (${b.t} tens are 1 hundred and ${b.t - 10} tens.)` : b.o > 9 ? ` (${b.o} ones are 1 ten and ${b.o - 10} ones.)` : ''}`,
        trick: { name: sub === 'zero' ? 'Zero holds the place' : b.t > 9 || b.o > 9 ? 'Trade ten for one' : 'Hundreds, then tens, then ones', say: sub === 'zero' ? `No ${t === 0 ? 'tens' : 'ones'}? Write a 0 there, so every digit stays in its place.` : b.t > 9 || b.o > 9 ? 'Ten of anything make one of the next place: ten cubes are a rod, ten rods are a flat. Trade, then count.' : 'Count the flats by 100s, the rods by 10s, then the cubes.' },
      };
    }
    // expanded: 300 + 40 + 5 = __, or 345 = 300 + __ + 5; the stretch: any order, or the hundreds missing
    const n = 100 * h + 10 * t + o;
    if (stretch) {
      const missH = r >= 5 && rng() < 0.4;
      if (missH) return {
        skill: 'pv-hundreds', key: 'pv-hundreds:expanded', id: `pv-hundreds:xh${n}`,
        ask: 'What is missing?', prompt: [num(n), op('='), blank, op('+'), num(10 * t), op('+'), num(o)],
        input: 'number', answer: { kind: 'number', value: 100 * h }, weight: 3,
        explain: `${n} = ${100 * h} + ${10 * t} + ${o}: the ${h} is in the hundreds place.`, trick: { name: 'Each digit is worth its place', say: `The first digit of ${n} is in the hundreds place: it's worth ${100 * h}.` },
      };
      const terms = [100 * h, 10 * t, o];
      const order = [[2, 0, 1], [1, 2, 0], [2, 1, 0], [0, 2, 1]][int(rng, 0, 3)];
      return {
        skill: 'pv-hundreds', key: 'pv-hundreds:expanded', id: `pv-hundreds:xs${n}${order.join('')}`,
        ask: 'What number is it?', prompt: [num(terms[order[0]]), op('+'), num(terms[order[1]]), op('+'), num(terms[order[2]]), op('='), blank],
        input: 'number', answer: { kind: 'number', value: n }, weight: 3,
        explain: `The hundreds, tens and ones, put in their places: ${100 * h} + ${10 * t} + ${o} = ${n}.`, trick: { name: 'Sort them by place', say: 'Find the hundreds first, then the tens, then the ones, whatever order they come in.' },
      };
    }
    const back = rng() < perRung(r, [0, 0.25, 0.5]);
    return {
      skill: 'pv-hundreds', key: 'pv-hundreds:expanded', id: `pv-hundreds:x${n}${back ? 'b' : 'f'}`,
      ask: back ? 'What is missing?' : 'What number is it?',
      prompt: back ? [num(n), op('='), num(100 * h), op('+'), blank, op('+'), num(o)] : [num(100 * h), op('+'), num(10 * t), op('+'), num(o), op('='), blank],
      input: 'number', answer: { kind: 'number', value: back ? 10 * t : n }, weight: 2,
      explain: `${n} = ${100 * h} + ${10 * t} + ${o}.`, trick: { name: 'Each digit is worth its place', say: `The 4 in 345 is in the tens place: it's worth 40.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- comparing ----------
// rungs: 1 the first digit decides more often · 2 the first digit shared more often · 3 everything but the
// last two digits shared (and 5- and 6-digit numbers) · 4 only the last digit different, and sometimes
// one side in expanded form (300 + 40 + 5 ? 350) · 5 more of those · 6 both sides in expanded form, in
// any order
function comparePair(rng: Rng, sub: string, r: number): [number, number] {
  const [lo, hi] = sub === 'two' ? [10, 99] : sub === 'three' ? [100, 999] : r <= 2 ? [1000, 9999] : [10000, 999999];
  const a = int(rng, lo, hi);
  // the tricky ones: the same first digit (or digits), or the same digits swapped; sometimes equal
  const v = rng();
  if (v < 0.12) return [a, a];
  if (v < perRung(r, [0.4, 0.5, 0.5, 0.6])) {
    const s = String(a), keep = r <= 2 ? 1 : r === 3 ? Math.max(1, s.length - 2) : s.length - 1;
    const tail = s.slice(keep), rest = int(rng, 0, 10 ** tail.length - 1);
    const b = +(s.slice(0, keep) + String(rest).padStart(tail.length, '0'));
    return [a, b === a ? (a === hi ? a - 1 : a + 1) : b];
  }
  if (v < 0.7 && sub === 'two' && a % 10 !== Math.floor(a / 10) && a % 10 !== 0) return [a, (a % 10) * 10 + Math.floor(a / 10)];
  const b = int(rng, lo, hi - 1);
  return [a, b >= a ? b + 1 : b];
}
export const pvCompare: Skill = {
  id: 'pv-compare', area: 'place', grade: 2, standard: '2.NBT.A.4',
  name: 'Bigger or smaller', short: 'Compare', plain: 'Compares numbers with <, = and >, looking at the biggest place first.',
  input: 'choice', fastMs: 5000,
  subs: [{ id: 'two', label: 'two digits' }, { id: 'three', label: 'three digits' }, { id: 'big', label: 'thousands and more' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [a, b] = comparePair(rng, sub, r);
    const id = a < b ? 'lt' : a > b ? 'gt' : 'eq';
    const word = id === 'lt' ? 'less than' : id === 'gt' ? 'greater than' : 'equal to';
    // the stretch: written as expanded sums
    const xa = r >= 4 && rng() < perRung(r, [0, 0, 0, 0.35, 0.5, 0.7]), xb = r >= 6 && xa && rng() < 0.6;
    const side = (n: number, x: boolean): Part => (x ? tx(expanded(n, r >= 6 ? rng : undefined)) : num(n));
    return {
      skill: 'pv-compare', key: `pv-compare:${sub}`, id: `pv-compare:${a}:${b}${xa ? ':x' : ''}${xb ? 'x' : ''}`,
      ask: 'Which sign goes in the middle?', prompt: [side(a, xa), op('?'), side(b, xb)],
      input: 'choice', choices: [{ id: 'lt', parts: [op('<')] }, { id: 'eq', parts: [op('=')] }, { id: 'gt', parts: [op('>')] }],
      answer: { kind: 'choice', id }, weight: Math.min(5, (sub === 'two' ? 1 : sub === 'three' ? 2 : 3) + (xa ? 1 : 0)),
      explain: `${commas(a)} is ${word} ${commas(b)}: ${commas(a)} ${id === 'lt' ? '<' : id === 'gt' ? '>' : '='} ${commas(b)}.`,
      trick: { name: 'Biggest place first', say: xa ? 'Turn a sum back into one number first (300 + 40 + 5 is 345), then compare from the left.' : 'More digits is bigger. Same number of digits? Compare from the left: the first digit that differs decides. The open mouth eats the bigger number.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding with regrouping ----------
// rungs: 1 blocks shown for two-digit sums, small numbers · 2 blocks for "no new ten" only, bigger
// numbers · 3 no blocks, the full range · 4 sometimes a missing number (34 + __ = 61), three-digit sums
// that make a new ten AND a new hundred · 5 more missing numbers · 6 sometimes three numbers to add
function addPair(rng: Rng, sub: string, r: number): [number, number] {
  if (sub === 'easy') {
    // two digits, no new ten: the ones add to 9 or less
    const t1 = int(rng, 1, 6), t2 = int(rng, 1, 8 - t1), o1 = int(rng, 0, 8), o2 = int(rng, 0, 9 - o1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'regroup') {
    // two digits, the ones make a new ten
    const o1 = int(rng, 2, 9), o2 = int(rng, 10 - o1, 9), t1 = int(rng, 1, perRung(r, [4, 6, 7])), t2 = int(rng, 1, 8 - t1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'three') {
    if (r >= 4) {
      // a new ten and a new hundred: 368 + 457
      const o1 = int(rng, 2, 9), o2 = int(rng, 10 - o1, 9), t1 = int(rng, 1, 8), t2 = int(rng, 9 - t1, 9), h1 = int(rng, 1, 4), h2 = int(rng, 1, 8 - h1);
      return [100 * h1 + 10 * t1 + o1, 100 * h2 + 10 * t2 + o2];
    }
    const a = int(rng, 120, perRung(r, [450, 600, 780])), b = int(rng, 105, 999 - a);
    return [a, b];
  }
  const a = int(rng, 1200, perRung(r, [4000, 5500, 6800])), b = int(rng, 1100, 9999 - a);
  return [a, b];
}
export const pvAdd: Skill = {
  id: 'pv-add', area: 'place', grade: 2, standard: '2.NBT.B.5',
  name: 'Adding big numbers', short: 'Adding', plain: 'Adds two-, three- and four-digit numbers, making a new ten (or hundred) when the ones fill up.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'easy', label: 'no new ten' }, { id: 'regroup', label: 'making a new ten' }, { id: 'three', label: 'three digits' }, { id: 'four', label: 'four digits' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [a, b] = addPair(rng, sub, r);
    const sum = a + b;
    const weight = (sub === 'easy' ? 2 : sub === 'regroup' ? 3 : sub === 'three' ? 4 : 5);
    const v = rng();
    // three numbers: two-digit ones (the third keeps the total under 100), or a third small number
    const three = r >= 6 && v < 0.3 && sum <= (sub === 'four' ? 9890 : sub === 'three' ? 990 : 90);
    if (three) {
      const c = sub === 'four' ? int(rng, 10, 9999 - sum) : sub === 'three' ? int(rng, 5, Math.min(99, 999 - sum)) : int(rng, 1, 99 - sum);
      return {
        skill: 'pv-add', key: `pv-add:${sub}`, id: `pv-add:${a}+${b}+${c}`,
        ask: 'Add them all up', prompt: [num(a), op('+'), num(b), op('+'), num(c), op('='), blank],
        input: 'number', answer: { kind: 'number', value: sum + c }, weight: Math.min(5, weight + 1),
        explain: `${commas(a)} + ${commas(b)} + ${commas(c)} = ${commas(sum + c)}.`,
        trick: { name: 'Two at a time', say: 'Add the first two, then add the third to that. Ones with ones, tens with tens.' },
      };
    }
    const missing = r >= 4 && v < perRung(r, [0, 0, 0, 0.3, 0.4, 0.5]);
    if (missing) return {
      skill: 'pv-add', key: `pv-add:${sub}`, id: `pv-add:${a}+?=${sum}`,
      ask: 'What is missing?', prompt: [num(a), op('+'), blank, op('='), num(sum)],
      input: 'number', answer: { kind: 'number', value: b }, weight: Math.min(5, weight + 1),
      explain: `${commas(sum)} − ${commas(a)} = ${commas(b)}, so ${commas(a)} + ${commas(b)} = ${commas(sum)}.`,
      trick: { name: 'Count up, or take away', say: `What goes with ${commas(a)} to make ${commas(sum)}? Count up from ${commas(a)}, or take ${commas(a)} away from ${commas(sum)}.` },
    };
    // gentle two-digit ones show both numbers as blocks
    const show = (r === 1 && (sub === 'easy' || sub === 'regroup')) || (r === 2 && sub === 'easy');
    const carry = (a % 10) + (b % 10) >= 10;
    return {
      skill: 'pv-add', key: `pv-add:${sub}`, id: `pv-add:${a}+${b}`,
      ask: 'Add them up', prompt: show ? [blocks(blocksOf(a)), op('+'), blocks(blocksOf(b)), op('='), blank] : [num(a), op('+'), num(b), op('='), blank],
      input: 'number', answer: { kind: 'number', value: sum }, weight,
      explain: `${commas(a)} + ${commas(b)} = ${commas(sum)}.${carry ? ` The ones make ${(a % 10) + (b % 10)}: that's a new ten and ${((a % 10) + (b % 10)) % 10} ones.` : ''}`,
      trick: { name: carry ? 'Ten ones make a ten' : 'Ones with ones, tens with tens', say: carry ? 'Add the ones. 10 or more? Trade ten cubes for one rod and carry it to the tens.' : 'Add the ones, then the tens, then the hundreds.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- taking away with regrouping ----------
// rungs: 1 blocks shown for two-digit ones · 2 blocks for "no breaking" only, bigger numbers · 3 no
// blocks, the full range · 4 taking away across a zero (403 − 167, 5004 − 2378), sometimes a missing
// number (57 − __ = 23) · 5 more missing numbers · 6 from a round number (80 − 37) and more of both
function subPair(rng: Rng, sub: string, r: number): [number, number] {
  if (sub === 'easy') {
    const t1 = int(rng, 2, 9), o1 = int(rng, 1, 9), t2 = int(rng, 1, t1 - 1), o2 = int(rng, 0, o1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'regroup') {
    // the ones on top are fewer: break a ten (from a round number, at the top rung, sometimes)
    const o1 = r >= 6 && rng() < 0.35 ? 0 : int(rng, 0, 7), o2 = int(rng, o1 + 1, 9), t1 = int(rng, 2, perRung(r, [6, 8, 9])), t2 = int(rng, 1, t1 - 1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  const zero = r >= 4 && rng() < 0.5;
  if (sub === 'three') {
    // across a zero: 403, 600
    const a = zero ? 100 * int(rng, 3, 9) + int(rng, 0, 9) : int(rng, perRung(r, [300, 350, 400]), 999), b = int(rng, 101, a - 50);
    return [a, b];
  }
  const a = zero ? 1000 * int(rng, 3, 9) + int(rng, 0, 9) : int(rng, 3000, 9999), b = int(rng, 1001, a - 500);
  return [a, b];
}
export const pvSub: Skill = {
  id: 'pv-sub', area: 'place', grade: 2, standard: '2.NBT.B.7',
  name: 'Taking away big numbers', short: 'Taking away', plain: 'Takes away two-, three- and four-digit numbers, breaking a ten (or hundred) when there aren\'t enough ones.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'easy', label: 'no breaking' }, { id: 'regroup', label: 'breaking a ten' }, { id: 'three', label: 'three digits' }, { id: 'four', label: 'four digits' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const [a, b] = subPair(rng, sub, r);
    const diff = a - b;
    const weight = sub === 'easy' ? 2 : sub === 'regroup' ? 3 : sub === 'three' ? 4 : 5;
    if (r >= 4 && rng() < perRung(r, [0, 0, 0, 0.3, 0.4, 0.45])) return {
      skill: 'pv-sub', key: `pv-sub:${sub}`, id: `pv-sub:${a}-?=${diff}`,
      ask: 'What is missing?', prompt: [num(a), op('−'), blank, op('='), num(diff)],
      input: 'number', answer: { kind: 'number', value: b }, weight: Math.min(5, weight + 1),
      explain: `${commas(a)} − ${commas(diff)} = ${commas(b)}, so ${commas(a)} − ${commas(b)} = ${commas(diff)}.`,
      trick: { name: 'Take away the answer', say: `What takes ${commas(a)} down to ${commas(diff)}? Take ${commas(diff)} away from ${commas(a)}.` },
    };
    const show = (r === 1 && (sub === 'easy' || sub === 'regroup')) || (r === 2 && sub === 'easy');
    const borrow = a % 10 < b % 10;
    return {
      skill: 'pv-sub', key: `pv-sub:${sub}`, id: `pv-sub:${a}-${b}`,
      ask: 'Take it away', prompt: show ? [blocks(blocksOf(a)), op('−'), num(b), op('='), blank] : [num(a), op('−'), num(b), op('='), blank],
      input: 'number', answer: { kind: 'number', value: diff }, weight,
      explain: `${commas(a)} − ${commas(b)} = ${commas(diff)}.${borrow ? ` Not enough ones: break a ten into 10 ones first.` : ''}`,
      trick: { name: borrow ? 'Break a ten' : 'Ones from ones, tens from tens', say: borrow ? 'Not enough ones to take away? Break one rod into ten cubes, then take them away. No tens to break? Break a hundred first.' : 'Take the ones from the ones, then the tens from the tens.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- rounding ----------
// rungs: 1 two-digit numbers to 10, hundreds to 100 · 2 bigger numbers · 3 the full grade 3 range · 4
// four- and five-digit numbers, and ones that round up into the next hundred or thousand (397 → 400) ·
// 5 to six digits (4.NBT.A.3) · 6 six digits, crossing more often
function crossing(rng: Rng, k: number, lo: number, hi: number): number {
  // just under the next multiple of 10k, so rounding up carries over: 10k × q + 10k − (1..k/2)
  const q = int(rng, Math.max(0, Math.floor(lo / (10 * k))), Math.max(0, Math.floor(hi / (10 * k)) - 1));
  return 10 * k * q + 10 * k - int(rng, 1, Math.max(1, k / 2));
}
export const pvRound: Skill = {
  id: 'pv-round', area: 'place', grade: 3, standard: '3.NBT.A.1',
  name: 'Rounding', short: 'Rounding', plain: 'Rounds to the nearest 10, 100 or 1,000: look at the next digit; 5 or more rounds up.',
  input: 'number', fastMs: 7000,
  subs: [{ id: '10', label: 'to the nearest 10' }, { id: '100', label: 'to the nearest 100' }, { id: '1000', label: 'to the nearest 1,000' }],
  make(rng, sub, rung) {
    const r = rungOf(rung), k = +sub;
    const R10: [number, number][] = [[11, 99], [101, 499], [101, 989], [1001, 9989], [10001, 99989], [100001, 999989]];
    const R100: [number, number][] = [[110, 990], [1010, 4990], [1010, 9890], [10100, 98900], [100100, 989900], [100100, 989900]];
    const R1000: [number, number][] = [[1100, 9800], [1100, 49800], [1100, 98800], [10100, 989000], [100100, 989900], [100100, 989900]];
    const [lo, hi] = perRung(r, k === 10 ? R10 : k === 100 ? R100 : R1000);
    // never exactly on the step (nothing to round); now and then right on the 5 (rounds up)
    let n = int(rng, lo, hi);
    if (n % k === 0) n += Math.max(1, Math.floor(k / 10));
    const v = rng();
    if (r >= 4 && v < perRung(r, [0, 0, 0, 0.3, 0.3, 0.4])) n = crossing(rng, k, lo, hi);
    else if (v > (r >= 4 ? 0.75 : 0.8)) n = Math.floor(n / k) * k + k / 2;
    const want = Math.round(n / k) * k;
    const next = Math.floor(n / (k / 10)) % 10;
    return {
      skill: 'pv-round', key: `pv-round:${sub}`, id: `pv-round:${k}:${n}`,
      ask: `Round to the nearest ${commas(k)}`, prompt: [num(n), op('≈'), blank],
      input: 'number', answer: { kind: 'number', value: want }, weight: Math.min(5, (k === 10 ? 2 : k === 100 ? 3 : 4) + (r >= 5 ? 1 : 0)),
      explain: `${commas(n)} is between ${commas(Math.floor(n / k) * k)} and ${commas(Math.floor(n / k) * k + k)}. The next digit is ${next}, so it rounds ${next >= 5 ? 'up' : 'down'} to ${commas(want)}.`,
      trick: { name: 'Five or more, round up', say: `Look at the digit after the ${k === 10 ? 'tens' : k === 100 ? 'hundreds' : 'thousands'}: 5 or more, round up; 4 or less, round down.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- big numbers to a million ----------
// rungs: 1 four digits, no zeros · 2 five digits, no zeros · 3 five or six digits, zeros allowed · 4 six
// digits, a zero for sure · 5 six digits with two zeros (406,020) · 6 three zeros (304,050)
const PLACE_NAME = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
export const pvBig: Skill = {
  id: 'pv-big', area: 'place', grade: 4, standard: '4.NBT.A.2',
  name: 'Big numbers', short: 'Big numbers', plain: 'Reads numbers to a million: what each digit is worth, expanded form, and number names.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'value', label: 'what a digit is worth' }, { id: 'expanded', label: 'expanded form' }, { id: 'words', label: 'number names' }],
  make(rng, sub, rung) {
    const r = rungOf(rung);
    const digits = r === 1 ? 4 : r === 2 ? 5 : r === 3 ? int(rng, 5, 6) : 6;
    // where the zeros go (never first, never two side by side, so every digit differs from its neighbours)
    const zeroAt: number[] = r === 4 ? [int(rng, 1, 5)] : r === 5 ? pick(rng, [[1, 3], [1, 4], [2, 4], [2, 5], [3, 5], [1, 5]]) : r === 6 ? [1, 3, 5] : [];
    // every digit different from its neighbours so "the 7" is clear
    const ds: number[] = [];
    for (let i = 0; i < digits; i++) {
      const prev = ds[i - 1];
      if (zeroAt.includes(i)) { ds.push(0); continue; }
      const lo = i === 0 || r <= 2 || zeroAt.length ? 1 : 0;
      const opts = Array.from({ length: 10 - lo }, (_, k) => k + lo).filter(d => d !== prev && !(d === 0 && zeroAt.includes(i + 1)));
      ds.push(pick(rng, opts));
    }
    const n = +ds.join('');
    if (sub === 'value') {
      // a digit that appears only once
      const once = ds.map((d, i) => ({ d, i })).filter(x => x.d !== 0 && ds.filter(y => y === x.d).length === 1);
      const x = pick(rng, once.length ? once : [{ d: ds[0], i: 0 }]);
      const place = digits - 1 - x.i, worth = x.d * 10 ** place;
      return {
        skill: 'pv-big', key: 'pv-big:value', id: `pv-big:v${n}:${x.d}`,
        ask: `What is the ${x.d} worth?`, prompt: [num(n), tx(`the ${x.d} is worth`), blank],
        input: 'number', answer: { kind: 'number', value: worth }, weight: r >= 5 ? 4 : 3,
        explain: `The ${x.d} is in the ${PLACE_NAME[place]} place: it's worth ${commas(worth)}.`, trick: { name: 'Count the places', say: 'Count places from the right: ones, tens, hundreds, thousands, ten thousands. Then put that many zeros after the digit.' },
      };
    }
    if (sub === 'words') {
      return {
        skill: 'pv-big', key: 'pv-big:words', id: `pv-big:w${n}`,
        ask: 'Write the number', prompt: [tx(words(n))],
        input: 'number', answer: { kind: 'number', value: n }, weight: r >= 5 ? 5 : 4,
        explain: `${words(n)} is ${commas(n)}.`, trick: { name: 'Thousands, then the rest', say: 'Write the thousands part first, then a comma, then the three digits after it. No hundreds? Write a 0 there.' },
      };
    }
    // expanded: which part is missing (zeros aren't written in expanded form)
    const terms = ds.map((d, i) => d * 10 ** (digits - 1 - i)).filter(t => t > 0);
    const miss = int(rng, 1, terms.length - 1);
    const prompt: Part[] = [num(n), op('=')];
    terms.forEach((t, i) => { if (i) prompt.push(op('+')); prompt.push(i === miss ? blank : num(t)); });
    return {
      skill: 'pv-big', key: 'pv-big:expanded', id: `pv-big:x${n}:${miss}`,
      ask: 'What is missing?', prompt,
      input: 'number', answer: { kind: 'number', value: terms[miss] }, weight: r >= 5 ? 4 : 3,
      explain: `${commas(n)} = ${terms.map(commas).join(' + ')}.`, trick: { name: 'Each digit is worth its place', say: 'Each digit with its zeros: the digit in the hundreds place gets two zeros.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const PLACE_SKILLS: Skill[] = [pvCount, pvSkip, pvTens, pvHundreds, pvCompare, pvAdd, pvSub, pvRound, pvBig];
/** (for tests and the trick card's pictures) every place value item's numbers read as blocks */
export const itemBlocks = (it: Item) => it.prompt.filter((p): p is Extract<Part, { t: 'blocks' }> => p.t === 'blocks').map(p => p.b);
