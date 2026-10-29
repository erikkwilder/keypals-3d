// Place value and big numbers, kindergarten to grade 4 (Common Core K.CC, 1.NBT, 2.NBT, 3.NBT, 4.NBT):
// counting on to 120 and number names, skip counting, tens and ones, hundreds, comparing, adding and
// taking away with regrouping (shown with base-ten blocks), rounding, and big numbers to a million. Each
// skill makes endless questions from a seeded generator, gentle at level 1 and wider at level 2. As with
// the fractions, no generator ever draws again "until it's different": every choice comes from a list
// that already leaves out what it mustn't be, so a question is made in one go whatever the random numbers.
import type { Rng } from '../../engine/rng';
import { checkAnswer } from './fractions';
import type { Blocks, Item, Part, Skill } from './types';

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const num = (n: number): Part => ({ t: 'num', n });
const op = (s: string): Part => ({ t: 'op', s });
const blocks = (b: Blocks): Part => ({ t: 'blocks', b });
const blank: Part = { t: 'blank' };
/** a number as base-ten blocks */
export const blocksOf = (n: number): Blocks => ({ th: Math.floor(n / 1000) % 10, h: Math.floor(n / 100) % 10, t: Math.floor(n / 10) % 10, o: n % 10 });
/** 4,382 with a comma (four digits and up) */
export const commas = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-US') : String(n));

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
export const pvCount: Skill = {
  id: 'pv-count', area: 'place', grade: 1, standard: '1.NBT.A.1',
  name: 'Count on', short: 'Count on', plain: 'Counts on and back to 120 from any number, and reads number names.',
  input: 'number', fastMs: 4000,
  subs: [{ id: 'next', label: 'what comes next' }, { id: 'before', label: 'what comes before' }, { id: 'words', label: 'number names' }],
  make(rng, sub, level) {
    if (sub === 'words') {
      const n = level === 1 ? int(rng, 11, 50) : int(rng, 51, 120);
      return {
        skill: 'pv-count', key: 'pv-count:words', id: `pv-count:w${n}`,
        ask: 'Write the number', prompt: [{ t: 'text', s: words(n) }, op('='), blank],
        input: 'number', answer: { kind: 'number', value: n }, weight: n > 100 ? 2 : 1,
        explain: `${words(n)} is ${n}.`, trick: { name: 'Tens first', say: `Find the tens word first (${n >= 20 ? TENS[Math.floor(n / 10) % 10] || 'one hundred' : 'teen'}), then the ones.` },
      };
    }
    // level 2 crosses a ten or a hundred: 49 -> 50, 99 -> 100, 110 -> 109
    const cross = level === 2 && rng() < 0.6;
    let a: number;
    if (sub === 'next') a = cross ? pick(rng, [19, 29, 39, 49, 59, 69, 79, 89, 99, 109]) - 2 : int(rng, level === 1 ? 1 : 30, level === 1 ? 37 : 115);
    else a = cross ? pick(rng, [20, 30, 40, 50, 60, 70, 80, 90, 100, 110]) + 2 : int(rng, level === 1 ? 6 : 33, level === 1 ? 40 : 120);
    const seq = sub === 'next' ? [a, a + 1, a + 2] : [a, a - 1, a - 2];
    const want = sub === 'next' ? a + 3 : a - 3;
    return {
      skill: 'pv-count', key: `pv-count:${sub}`, id: `pv-count:${sub}${a}`,
      ask: sub === 'next' ? 'What comes next?' : 'Count back: what comes next?',
      prompt: [num(seq[0]), op(','), num(seq[1]), op(','), num(seq[2]), op(','), blank],
      input: 'number', answer: { kind: 'number', value: want }, weight: cross ? 2 : 1,
      explain: `${seq.join(', ')}, ${want}.`, trick: { name: 'Watch the ones', say: sub === 'next' ? 'After 9 ones, the tens go up by one and the ones start again at 0.' : 'Before 0 ones, the tens go down by one and the ones go back to 9.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- skip counting ----------
export const pvSkip: Skill = {
  id: 'pv-skip', area: 'place', grade: 2, standard: '2.NBT.A.2',
  name: 'Skip counting', short: 'Skip count', plain: 'Skip counts by 2s, 5s, 10s and 100s.',
  input: 'number', fastMs: 4000,
  subs: [{ id: '2', label: 'by 2s' }, { id: '5', label: 'by 5s' }, { id: '10', label: 'by 10s' }, { id: '100', label: 'by 100s' }],
  make(rng, sub, level) {
    const k = +sub;
    // gentle: start on the step itself; full: start anywhere on the pattern, or off it (by 10s from 3)
    const start = level === 1 ? k * int(rng, 1, 4) : k === 2 || k === 5 ? k * int(rng, 2, 18) : k === 10 ? int(rng, 1, 60) : 100 * int(rng, 1, 5) + (rng() < 0.5 ? 0 : int(rng, 1, 9) * 10);
    const seq = [start, start + k, start + 2 * k];
    const want = start + 3 * k;
    return {
      skill: 'pv-skip', key: `pv-skip:${sub}`, id: `pv-skip:${k}:${start}`,
      ask: `Count by ${k}s: what comes next?`,
      prompt: [num(seq[0]), op(','), num(seq[1]), op(','), num(seq[2]), op(','), blank],
      input: 'number', answer: { kind: 'number', value: want }, weight: k === 100 || start % k ? 2 : 1,
      explain: `Counting by ${k}s: ${seq.join(', ')}, ${want}.`,
      trick: { name: `Jumps of ${k}`, say: k === 10 ? 'By 10s, only the tens change: the ones stay the same.' : k === 100 ? 'By 100s, only the hundreds change.' : k === 5 ? 'By 5s, the ones go 5, 0, 5, 0.' : 'By 2s, skip one number each time.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- tens and ones ----------
export const pvTens: Skill = {
  id: 'pv-tens', area: 'place', grade: 1, standard: '1.NBT.B.2',
  name: 'Tens and ones', short: 'Tens & ones', plain: 'Sees a two-digit number as tens and ones: 47 is 4 tens and 7 ones.',
  input: 'number', fastMs: 5000,
  subs: [{ id: 'teen', label: 'teen numbers' }, { id: 'read', label: 'blocks to a number' }, { id: 'split', label: 'how many tens' }],
  make(rng, sub, level) {
    if (sub === 'teen') {
      const o = int(rng, 1, 9), n = 10 + o;
      return {
        skill: 'pv-tens', key: 'pv-tens:teen', id: `pv-tens:teen${n}`,
        ask: 'How many?', prompt: [blocks({ h: 0, t: 1, o })],
        input: 'number', answer: { kind: 'number', value: n }, weight: 1,
        explain: `1 ten and ${o} ones is ${n}.`, trick: { name: 'A ten and some more', say: `The rod is 10. Count on from 10: ${Array.from({ length: o }, (_, i) => 11 + i).join(', ')}.` },
      };
    }
    const t = level === 1 ? int(rng, 2, 5) : int(rng, 2, 9), o = level === 1 ? int(rng, 1, 6) : int(rng, 0, 9), n = 10 * t + o;
    if (sub === 'read') {
      return {
        skill: 'pv-tens', key: 'pv-tens:read', id: `pv-tens:read${n}`,
        ask: 'How many?', prompt: [blocks({ h: 0, t, o })],
        input: 'number', answer: { kind: 'number', value: n }, weight: 2,
        explain: `${t} tens and ${o} ones is ${n}.`, trick: { name: 'Count the rods by 10s', say: `${Array.from({ length: t }, (_, i) => 10 * (i + 1)).join(', ')}... then count on the ones.` },
      };
    }
    // split: 47 = __ tens and 7 ones (or the ones, sometimes)
    const askOnes = level === 2 && rng() < 0.35;
    return {
      skill: 'pv-tens', key: 'pv-tens:split', id: `pv-tens:split${n}${askOnes ? 'o' : 't'}`,
      ask: askOnes ? 'How many ones?' : 'How many tens?',
      prompt: askOnes ? [num(n), op('='), num(t), { t: 'text', s: 'tens and' }, blank, { t: 'text', s: 'ones' }] : [num(n), op('='), blank, { t: 'text', s: 'tens and' }, num(o), { t: 'text', s: 'ones' }],
      input: 'number', answer: { kind: 'number', value: askOnes ? o : t }, weight: 2,
      explain: `${n} is ${t} tens and ${o} ones.`, trick: { name: 'Digits have places', say: 'The first digit counts the tens, the last digit counts the ones.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- hundreds ----------
export const pvHundreds: Skill = {
  id: 'pv-hundreds', area: 'place', grade: 2, standard: '2.NBT.A.1',
  name: 'Hundreds, tens and ones', short: 'Hundreds', plain: 'Reads and writes numbers to 1,000: 345 is 3 hundreds, 4 tens and 5 ones (300 + 40 + 5).',
  input: 'number', fastMs: 6000,
  subs: [{ id: 'read', label: 'blocks to a number' }, { id: 'expanded', label: 'expanded form' }, { id: 'zero', label: 'numbers with a zero' }],
  make(rng, sub, level) {
    const h = int(rng, 1, level === 1 ? 4 : 9);
    let t = int(rng, 1, level === 1 ? 5 : 9), o = int(rng, 1, level === 1 ? 6 : 9);
    if (sub === 'zero') { if (rng() < 0.5) t = 0; else o = 0; }
    const n = 100 * h + 10 * t + o;
    if (sub === 'read' || sub === 'zero') {
      return {
        skill: 'pv-hundreds', key: `pv-hundreds:${sub}`, id: `pv-hundreds:${sub}${n}`,
        ask: 'How many?', prompt: [blocks({ h, t, o })],
        input: 'number', answer: { kind: 'number', value: n }, weight: sub === 'zero' ? 3 : 2,
        explain: `${h} hundreds, ${t} tens and ${o} ones is ${n}.`,
        trick: { name: sub === 'zero' ? 'Zero holds the place' : 'Hundreds, then tens, then ones', say: sub === 'zero' ? `No ${t === 0 ? 'tens' : 'ones'}? Write a 0 there, so every digit stays in its place.` : 'Count the flats by 100s, the rods by 10s, then the cubes.' },
      };
    }
    // expanded: 300 + 40 + 5 = __, or 345 = 300 + __ + 5
    const back = level === 2 && rng() < 0.5;
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
function comparePair(rng: Rng, sub: string, level: 1 | 2): [number, number] {
  const [lo, hi] = sub === 'two' ? [10, 99] : sub === 'three' ? [100, 999] : level === 1 ? [1000, 9999] : [10000, 999999];
  const a = int(rng, lo, hi);
  // the tricky ones: the same first digit (or digits), or the same digits swapped; sometimes equal
  const r = rng();
  if (r < 0.12) return [a, a];
  if (r < 0.5) {
    const s = String(a), keep = level === 1 ? 1 : Math.max(1, s.length - 2);
    const tail = s.slice(keep), rest = int(rng, 0, 10 ** tail.length - 1);
    const b = +(s.slice(0, keep) + String(rest).padStart(tail.length, '0'));
    return [a, b === a ? (a === hi ? a - 1 : a + 1) : b];
  }
  if (r < 0.7 && sub === 'two' && a % 10 !== Math.floor(a / 10) && a % 10 !== 0) return [a, (a % 10) * 10 + Math.floor(a / 10)];
  const b = int(rng, lo, hi - 1);
  return [a, b >= a ? b + 1 : b];
}
export const pvCompare: Skill = {
  id: 'pv-compare', area: 'place', grade: 2, standard: '2.NBT.A.4',
  name: 'Bigger or smaller', short: 'Compare', plain: 'Compares numbers with <, = and >, looking at the biggest place first.',
  input: 'choice', fastMs: 5000,
  subs: [{ id: 'two', label: 'two digits' }, { id: 'three', label: 'three digits' }, { id: 'big', label: 'thousands and more' }],
  make(rng, sub, level) {
    const [a, b] = comparePair(rng, sub, level);
    const id = a < b ? 'lt' : a > b ? 'gt' : 'eq';
    const word = id === 'lt' ? 'less than' : id === 'gt' ? 'greater than' : 'equal to';
    return {
      skill: 'pv-compare', key: `pv-compare:${sub}`, id: `pv-compare:${a}:${b}`,
      ask: 'Which sign goes in the middle?', prompt: [num(a), op('?'), num(b)],
      input: 'choice', choices: [{ id: 'lt', parts: [op('<')] }, { id: 'eq', parts: [op('=')] }, { id: 'gt', parts: [op('>')] }],
      answer: { kind: 'choice', id }, weight: sub === 'two' ? 1 : sub === 'three' ? 2 : 3,
      explain: `${commas(a)} is ${word} ${commas(b)}: ${commas(a)} ${id === 'lt' ? '<' : id === 'gt' ? '>' : '='} ${commas(b)}.`,
      trick: { name: 'Biggest place first', say: 'More digits is bigger. Same number of digits? Compare from the left: the first digit that differs decides. The open mouth eats the bigger number.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- adding with regrouping ----------
function addPair(rng: Rng, sub: string, level: 1 | 2): [number, number] {
  if (sub === 'easy') {
    // two digits, no new ten: the ones add to 9 or less
    const t1 = int(rng, 1, 6), t2 = int(rng, 1, 8 - t1), o1 = int(rng, 0, 8), o2 = int(rng, 0, 9 - o1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'regroup') {
    // two digits, the ones make a new ten
    const o1 = int(rng, 2, 9), o2 = int(rng, 10 - o1, 9), t1 = int(rng, 1, level === 1 ? 4 : 7), t2 = int(rng, 1, 8 - t1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'three') {
    const a = int(rng, 120, level === 1 ? 450 : 780), b = int(rng, 105, 999 - a);
    return [a, b];
  }
  const a = int(rng, 1200, 6800), b = int(rng, 1100, 9999 - a);
  return [a, b];
}
export const pvAdd: Skill = {
  id: 'pv-add', area: 'place', grade: 2, standard: '2.NBT.B.5',
  name: 'Adding big numbers', short: 'Adding', plain: 'Adds two-, three- and four-digit numbers, making a new ten (or hundred) when the ones fill up.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'easy', label: 'no new ten' }, { id: 'regroup', label: 'making a new ten' }, { id: 'three', label: 'three digits' }, { id: 'four', label: 'four digits' }],
  make(rng, sub, level) {
    const [a, b] = addPair(rng, sub, level);
    const sum = a + b;
    // gentle two-digit ones show both numbers as blocks
    const show = level === 1 && (sub === 'easy' || sub === 'regroup');
    const carry = (a % 10) + (b % 10) >= 10;
    return {
      skill: 'pv-add', key: `pv-add:${sub}`, id: `pv-add:${a}+${b}`,
      ask: 'Add them up', prompt: show ? [blocks(blocksOf(a)), op('+'), blocks(blocksOf(b)), op('='), blank] : [num(a), op('+'), num(b), op('='), blank],
      input: 'number', answer: { kind: 'number', value: sum }, weight: sub === 'easy' ? 2 : sub === 'regroup' ? 3 : sub === 'three' ? 4 : 5,
      explain: `${commas(a)} + ${commas(b)} = ${commas(sum)}.${carry ? ` The ones make ${(a % 10) + (b % 10)}: that's a new ten and ${((a % 10) + (b % 10)) % 10} ones.` : ''}`,
      trick: { name: carry ? 'Ten ones make a ten' : 'Ones with ones, tens with tens', say: carry ? 'Add the ones. 10 or more? Trade ten cubes for one rod and carry it to the tens.' : 'Add the ones, then the tens, then the hundreds.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- taking away with regrouping ----------
function subPair(rng: Rng, sub: string, level: 1 | 2): [number, number] {
  if (sub === 'easy') {
    const t1 = int(rng, 2, 9), o1 = int(rng, 1, 9), t2 = int(rng, 1, t1 - 1), o2 = int(rng, 0, o1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'regroup') {
    // the ones on top are fewer: break a ten
    const o1 = int(rng, 0, 7), o2 = int(rng, o1 + 1, 9), t1 = int(rng, 2, level === 1 ? 6 : 9), t2 = int(rng, 1, t1 - 1);
    return [10 * t1 + o1, 10 * t2 + o2];
  }
  if (sub === 'three') {
    const a = int(rng, level === 1 ? 300 : 400, 999), b = int(rng, 101, a - 50);
    return [a, b];
  }
  const a = int(rng, 3000, 9999), b = int(rng, 1001, a - 500);
  return [a, b];
}
export const pvSub: Skill = {
  id: 'pv-sub', area: 'place', grade: 2, standard: '2.NBT.B.7',
  name: 'Taking away big numbers', short: 'Taking away', plain: 'Takes away two-, three- and four-digit numbers, breaking a ten (or hundred) when there aren\'t enough ones.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'easy', label: 'no breaking' }, { id: 'regroup', label: 'breaking a ten' }, { id: 'three', label: 'three digits' }, { id: 'four', label: 'four digits' }],
  make(rng, sub, level) {
    const [a, b] = subPair(rng, sub, level);
    const diff = a - b;
    const show = level === 1 && (sub === 'easy' || sub === 'regroup');
    const borrow = a % 10 < b % 10;
    return {
      skill: 'pv-sub', key: `pv-sub:${sub}`, id: `pv-sub:${a}-${b}`,
      ask: 'Take it away', prompt: show ? [blocks(blocksOf(a)), op('−'), num(b), op('='), blank] : [num(a), op('−'), num(b), op('='), blank],
      input: 'number', answer: { kind: 'number', value: diff }, weight: sub === 'easy' ? 2 : sub === 'regroup' ? 3 : sub === 'three' ? 4 : 5,
      explain: `${commas(a)} − ${commas(b)} = ${commas(diff)}.${borrow ? ` Not enough ones: break a ten into 10 ones first.` : ''}`,
      trick: { name: borrow ? 'Break a ten' : 'Ones from ones, tens from tens', say: borrow ? 'Not enough ones to take away? Break one rod into ten cubes, then take them away.' : 'Take the ones from the ones, then the tens from the tens.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- rounding ----------
export const pvRound: Skill = {
  id: 'pv-round', area: 'place', grade: 3, standard: '3.NBT.A.1',
  name: 'Rounding', short: 'Rounding', plain: 'Rounds to the nearest 10, 100 or 1,000: look at the next digit; 5 or more rounds up.',
  input: 'number', fastMs: 7000,
  subs: [{ id: '10', label: 'to the nearest 10' }, { id: '100', label: 'to the nearest 100' }, { id: '1000', label: 'to the nearest 1,000' }],
  make(rng, sub, level) {
    const k = +sub;
    const [lo, hi] = k === 10 ? (level === 1 ? [11, 99] : [101, 989]) : k === 100 ? (level === 1 ? [110, 990] : [1010, 9890]) : [1100, level === 1 ? 9800 : 98800];
    // never exactly on the step (nothing to round); half the time right on the 5 (rounds up)
    let n = int(rng, lo, hi);
    if (n % k === 0) n += Math.max(1, Math.floor(k / 10));
    if (rng() < 0.2) n = Math.floor(n / k) * k + k / 2;
    const want = Math.round(n / k) * k;
    const next = Math.floor(n / (k / 10)) % 10;
    return {
      skill: 'pv-round', key: `pv-round:${sub}`, id: `pv-round:${k}:${n}`,
      ask: `Round to the nearest ${commas(k)}`, prompt: [num(n), op('≈'), blank],
      input: 'number', answer: { kind: 'number', value: want }, weight: k === 10 ? 2 : k === 100 ? 3 : 4,
      explain: `${commas(n)} is between ${commas(Math.floor(n / k) * k)} and ${commas(Math.floor(n / k) * k + k)}. The next digit is ${next}, so it rounds ${next >= 5 ? 'up' : 'down'} to ${commas(want)}.`,
      trick: { name: 'Five or more, round up', say: `Look at the digit after the ${k === 10 ? 'tens' : k === 100 ? 'hundreds' : 'thousands'}: 5 or more, round up; 4 or less, round down.` },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

// ---------- big numbers to a million ----------
const PLACE_NAME = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands', 'hundred thousands'];
export const pvBig: Skill = {
  id: 'pv-big', area: 'place', grade: 4, standard: '4.NBT.A.2',
  name: 'Big numbers', short: 'Big numbers', plain: 'Reads numbers to a million: what each digit is worth, expanded form, and number names.',
  input: 'number', fastMs: 9000,
  subs: [{ id: 'value', label: 'what a digit is worth' }, { id: 'expanded', label: 'expanded form' }, { id: 'words', label: 'number names' }],
  make(rng, sub, level) {
    const digits = level === 1 ? 4 : int(rng, 5, 6);
    // every digit different from its neighbours so "the 7" is clear; no zeros at level 1
    const ds: number[] = [];
    for (let i = 0; i < digits; i++) {
      const lo = i === 0 || level === 1 ? 1 : 0;
      const prev = ds[i - 1];
      const opts = Array.from({ length: 10 - lo }, (_, k) => k + lo).filter(d => d !== prev);
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
        ask: `What is the ${x.d} worth?`, prompt: [num(n), { t: 'text', s: `the ${x.d} is worth` }, blank],
        input: 'number', answer: { kind: 'number', value: worth }, weight: 3,
        explain: `The ${x.d} is in the ${PLACE_NAME[place]} place: it's worth ${commas(worth)}.`, trick: { name: 'Count the places', say: 'Count places from the right: ones, tens, hundreds, thousands, ten thousands. Then put that many zeros after the digit.' },
      };
    }
    if (sub === 'words') {
      return {
        skill: 'pv-big', key: 'pv-big:words', id: `pv-big:w${n}`,
        ask: 'Write the number', prompt: [{ t: 'text', s: words(n) }],
        input: 'number', answer: { kind: 'number', value: n }, weight: 4,
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
      input: 'number', answer: { kind: 'number', value: terms[miss] }, weight: 3,
      explain: `${commas(n)} = ${terms.map(commas).join(' + ')}.`, trick: { name: 'Each digit is worth its place', say: 'Each digit with its zeros: the digit in the hundreds place gets two zeros.' },
    };
  },
  check: (it, a) => checkAnswer(it.answer, a),
};

export const PLACE_SKILLS: Skill[] = [pvCount, pvSkip, pvTens, pvHundreds, pvCompare, pvAdd, pvSub, pvRound, pvBig];
/** (for tests and the trick card's pictures) every place value item's numbers read as blocks */
export const itemBlocks = (it: Item) => it.prompt.filter((p): p is Extract<Part, { t: 'blocks' }> => p.t === 'blocks').map(p => p.b);
