// The place value Learn lessons, played as episodes in the Crystal Cave Workshop (episodes.ts, set 'cave'):
// ten ones snapping into a ten, tens and ones, hundreds in crates and a thousand, adding with a new ten,
// taking away by breaking a ten, and rounding on the number plank. The blocks are the episode's counters:
// a ten is a row of ten blocks, ones sit in columns of five, and a hundred is a crate marked 100.
//
// The questions are facts with words of their own ("3 tens 4 ones", "47 → nearest 10"): `text` is what's
// asked and `ans` the answer when it isn't the plain sum, so the episode asks and checks them like any fact.
import type { Fact } from './facts';
import type { Board, Dot, Hue, Lesson, Tag } from './learn';

const board = (b: Partial<Board>): Board => ({ cell: 24, dots: [], frames: [], plates: [], line: null, tags: [], ...b });
const tag = (id: string, x: number, y: number, text: string, c: Tag['c'] = 'ink', size = 26): Tag => ({ id, x, y, text, c, size });
const Q = (a: number, b: number, op: '+' | '-', text?: string, ans?: number): Fact => ({ a, b, op, ...(text ? { text } : {}), ...(ans !== undefined ? { ans } : {}) });

// ---------- where the blocks go ----------
const C = 24;
/** the tens: rows of ten blocks, one under the other (`left` is where the first block of a row sits) */
const ROW0 = 64, ROWG = 38;
const tenAt = (row: number, k: number, left: number, rowG = ROWG) => ({ x: left + k * C, y: ROW0 + row * rowG });
/** the ones: columns of five, beside the tens */
const oneAt = (i: number, left: number) => ({ x: left + Math.floor(i / 5) * 30, y: ROW0 + 20 + (i % 5) * 32 });
/** where the ones start when the tens start at `left` */
const onesLeft = (left: number) => left + 10 * C + 36;

/** `n` tens in rows `from`..: each block `${prefix}${row}-${k}` */
function tens(n: number, prefix: string, c: Hue, left: number, from = 0, rowG = ROWG): Dot[] {
  const out: Dot[] = [];
  for (let r = from; r < from + n; r++) for (let k = 0; k < 10; k++) out.push({ id: `${prefix}${r}-${k}`, ...tenAt(r, k, left, rowG), c, d: (r - from) * 0.2 + k * 0.02 });
  return out;
}
/** `n` ones at places `from`..: each `${prefix}${i}` */
const ones = (n: number, prefix: string, c: Hue, left: number, from = 0): Dot[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${from + i}`, ...oneAt(from + i, left), c, d: i * 0.06 }));
/** hundreds: crates marked 100, in a column (two columns for four) */
function crates(n: number, small = false) {
  if (small) {
    // ten of them: two rows of five
    const r = 36;
    const plates = Array.from({ length: n }, (_, i) => ({ id: `cr${i}`, x: 90 + (i % 5) * 105, y: 120 + Math.floor(i / 5) * 100, r }));
    return { plates, tags: plates.map(p => tag(`c${p.id}`, p.x, p.y + 8, '100', 'a', 22)) };
  }
  const r = 40, two = n > 3;
  const plates = Array.from({ length: n }, (_, i) => ({ id: `cr${i}`, x: two ? 52 + (i % 2) * 88 : 70, y: two ? 110 + Math.floor(i / 2) * 100 : 76 + i * 96, r }));
  return { plates, tags: plates.map(p => tag(`c${p.id}`, p.x, p.y + 8, '100', 'a', 24)) };
}
const LEFT = 110, LEFT_H = 200;

/** A number as blocks: crates of a hundred, rows of ten and ones (each part in its own colour if asked). */
function blocksOf(n: number, hues: [Hue, Hue] = ['a', 'a'], prefix = ''): Board {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10;
  const left = h ? LEFT_H : LEFT;
  const cr = crates(h);
  return board({ plates: cr.plates, tags: cr.tags, dots: [...tens(t, `${prefix}t`, hues[0], left), ...ones(o, `${prefix}o`, hues[1], onesLeft(left))] });
}
/** Two numbers to add: the first's tens and ones in blue, the second's in pink, the ones all together. */
function addPic(a: number, b: number): Board {
  const ta = Math.floor(a / 10), tb = Math.floor(b / 10), oa = a % 10, ob = b % 10;
  const L = onesLeft(LEFT);
  return board({ dots: [...tens(ta, 'ta', 'a', LEFT), ...tens(tb, 'tb', 'b', LEFT, ta), ...ones(oa, 'o', 'a', L), ...ones(ob, 'o', 'b', L, oa)] });
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const tensOnes = (n: number) => `${plural(Math.floor(n / 10), 'ten')} and ${plural(n % 10, 'one')}`;
const lineFor = (n: number, step = 10) => { const lo = Math.floor(n / step) * step; return { from: lo, to: lo + step, at: n, hops: [] as { a: number; b: number; label: string }[] }; };
const roundTen = (n: number) => Math.floor((n + 5) / 10) * 10;

// ---------- the lessons ----------
const L1 = onesLeft(LEFT);

export const PLACE_LESSONS: Lesson[] = [
  {
    id: 'pv-make-ten', title: 'Ten Ones Make a Ten', op: '+', regions: [], area: 'place', practice: 'place-a-1', blurb: 'Ten ones snap together into one ten.',
    steps: [
      { say: "Here are 7 ones. Let's count them. 1, 2, 3, 4, 5, 6, 7.", board: board({ dots: ones(7, 'o', 'a', L1) }), eq: '7 ones' },
      { say: '3 more make 10 ones!', board: board({ dots: [...ones(7, 'o', 'a', L1), ...ones(3, 'o', 'b', L1, 7)] }), eq: '7 + 3 = [10]' },
      { say: 'Ten ones snap together into one ten!', board: board({ dots: Array.from({ length: 10 }, (_, k) => ({ id: `o${k}`, ...tenAt(0, k, LEFT), c: 'c' as Hue, d: k * 0.05 })) }), eq: '10 ones = [1 ten]' },
      { say: '1 ten and 4 more ones make 14. The 1 in 14 means one ten!', board: board({ dots: [...Array.from({ length: 10 }, (_, k) => ({ id: `o${k}`, ...tenAt(0, k, LEFT), c: 'c' as Hue })), ...ones(4, 'n', 'b', L1)], tags: [tag('t', LEFT + 4.5 * C, ROW0 - 34, '1 ten', 'c'), tag('o', L1 + 15, ROW0 - 14, '4 ones', 'b'), tag('n', 300, 300, '14', 'ink', 40)] }), eq: '10 + 4 = [14]' },
    ],
    tries: [Q(10, 6, '+', '1 ten 6 ones'), Q(20, 3, '+', '2 tens 3 ones'), Q(10, 9, '+', '1 ten 9 ones')],
    pic: f => blocksOf(f.a + f.b, ['c', 'b']),
    hint: f => `${plural(f.a / 10, 'ten')} is ${f.a}, and ${f.b} more ones make ${f.a + f.b}.`,
  },
  {
    id: 'pv-tens-ones', title: 'Tens and Ones', op: '+', regions: [], area: 'place', practice: 'place-a-3', blurb: 'The tens go first, then the ones.',
    steps: [
      { say: 'Here are 3 tens. Each one is a row of ten blocks.', board: board({ dots: tens(3, 't', 'a', LEFT) }), eq: '3 tens' },
      { say: 'Count them by tens. 10, 20, 30!', board: board({ dots: tens(3, 't', 'a', LEFT), tags: [0, 1, 2].map(r => tag(`r${r}`, LEFT + 10 * C + 6, tenAt(r, 0, LEFT).y + 2, `${(r + 1) * 10}`, 'a', 22)) }), eq: '10, 20, [30]' },
      { say: 'Now add 4 ones.', board: board({ dots: [...tens(3, 't', 'a', LEFT), ...ones(4, 'o', 'b', L1)], tags: [0, 1, 2].map(r => tag(`r${r}`, LEFT + 10 * C + 6, tenAt(r, 0, LEFT).y + 2, `${(r + 1) * 10}`, 'a', 22)) }), eq: '30 + 4' },
      { say: '3 tens and 4 ones make 34. The tens go first, then the ones!', board: board({ dots: [...tens(3, 't', 'a', LEFT), ...ones(4, 'o', 'b', L1)], tags: [tag('t', LEFT + 4.5 * C, ROW0 - 34, '3 tens', 'a'), tag('o', L1 + 15, ROW0 - 14, '4 ones', 'b'), tag('n', 300, 300, '34', 'ink', 40)] }), eq: '30 + 4 = [34]' },
    ],
    tries: [Q(40, 5, '+', '4 tens 5 ones'), Q(20, 7, '+', '2 tens 7 ones'), Q(60, 1, '+', '6 tens 1 one')],
    pic: f => blocksOf(f.a + f.b, ['a', 'b']),
    hint: f => `${plural(f.a / 10, 'ten')} is ${f.a}, and ${plural(f.b, 'one')} more: ${f.a + f.b}.`,
  },
  {
    id: 'pv-big-numbers', title: 'Hundreds and Big Numbers', op: '+', regions: [], area: 'place', practice: 'place-b-1', blurb: 'Ten tens make a hundred. A zero keeps a place.',
    steps: [
      { say: 'Ten tens make 100! We pack each hundred in a crate.', board: board({ cell: 22, dots: tens(10, 'h', 'a', 180, 0, 26).map(d => ({ ...d, y: d.y - 30 })), tags: [tag('n', 300, 318, '10 tens = 100', 'ink', 28)] }), eq: '10 tens = [100]' },
      { say: 'Here are 3 crates of a hundred. Count them. 100, 200, 300.', board: board({ ...crates(3), tags: [...crates(3).tags, tag('n', 300, 300, '300', 'ink', 40)] }), eq: '100, 200, [300]' },
      { say: 'Ten hundreds make a thousand! Big numbers keep growing like that.', board: board({ ...crates(10, true), tags: [...crates(10, true).tags, tag('k', 300, 300, '10 hundreds = 1,000', 'ink', 32)] }), eq: '10 hundreds = [1,000]' },
      { say: 'Back to 3 hundreds, and add 5 ones. That makes 305.', board: board({ plates: crates(3).plates, tags: crates(3).tags, dots: ones(5, 'o', 'b', onesLeft(LEFT_H)) }), eq: '300 + 5 = [305]' },
      { say: "There are no tens, so a 0 keeps the tens place. 3, 0, 5. That's 305!", board: board({ plates: crates(3).plates, dots: ones(5, 'o', 'b', onesLeft(LEFT_H)), tags: [...crates(3).tags, tag('h', 70, 26, '3 hundreds', 'a', 22), tag('z', LEFT_H + 4.5 * C, 150, '0 tens', 'ink', 30), tag('o', onesLeft(LEFT_H) + 15, ROW0 - 14, '5 ones', 'b', 22)] }), eq: '300 + 0 + 5 = [305]' },
    ],
    tries: [Q(240, 6, '+', '200 + 40 + 6'), Q(400, 7, '+', '400 + 7'), Q(100, 30, '+', '100 + 30')],
    pic: f => blocksOf(f.a + f.b, ['a', 'b']),
    hint: f => { const n = f.a + f.b, h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10; return `${plural(h, 'hundred')}, ${plural(t, 'ten')} and ${plural(o, 'one')}${t === 0 || o === 0 ? ' (a zero keeps the empty place)' : ''}: ${n}.`; },
  },
  {
    id: 'pv-add-regroup', title: 'Adding: A New Ten', op: '+', regions: [], area: 'place', practice: 'place-b-3', blurb: 'Ones past 9? Ten of them make a new ten.',
    steps: [
      { say: '38 is 3 tens and 8 ones.', board: board({ dots: [...tens(3, 'ta', 'a', LEFT), ...ones(8, 'o', 'a', L1)] }), eq: '38 + 25' },
      { say: "Now add 25. That's 2 more tens and 5 more ones.", board: addPic(38, 25), eq: '38 + 25' },
      { say: "Ones first. 8 and 5 make 13. That's more than 9!", board: board({ ...addPic(38, 25), tags: [tag('o', L1 + 30, ROW0 - 14, '13 ones', 'b')] }), eq: '8 + 5 = [13]' },
      { say: 'Ten of the ones snap into a new ten!', board: board({ dots: [...tens(3, 'ta', 'a', LEFT), ...tens(2, 'tb', 'b', LEFT, 3), ...Array.from({ length: 10 }, (_, k) => ({ id: `o${k}`, ...tenAt(5, k, LEFT), c: 'c' as Hue, d: k * 0.04 })), ...[10, 11, 12].map(i => ({ id: `o${i}`, ...oneAt(i, L1), c: 'b' as Hue }))] }), eq: '13 = 10 + [3]' },
      { say: '6 tens and 3 ones: 38 + 25 = 63!', board: board({ dots: [...tens(3, 'ta', 'a', LEFT), ...tens(2, 'tb', 'b', LEFT, 3), ...Array.from({ length: 10 }, (_, k) => ({ id: `o${k}`, ...tenAt(5, k, LEFT), c: 'c' as Hue })), ...[10, 11, 12].map(i => ({ id: `o${i}`, ...oneAt(i, L1), c: 'b' as Hue }))], tags: [tag('t', LEFT + 4.5 * C, ROW0 - 34, '6 tens', 'ink'), tag('o', L1 + 60, ROW0 - 14, '3 ones', 'b'), tag('n', 300, 300, '63', 'ink', 40)] }), eq: '38 + 25 = [63]' },
    ],
    tries: [Q(27, 15, '+'), Q(46, 28, '+'), Q(19, 33, '+')],
    pic: f => addPic(f.a, f.b),
    hint: f => { const o = (f.a % 10) + (f.b % 10), n = f.a + f.b; return `Ones: ${f.a % 10} + ${f.b % 10} = ${o}${o > 9 ? `, so ten of them make a new ten and ${o - 10} ones are left` : ''}. Then ${tensOnes(n)}: ${n}.`; },
  },
  {
    id: 'pv-sub-regroup', title: 'Taking Away: Break a Ten', op: '-', regions: [], area: 'place', practice: 'place-b-4', blurb: 'Not enough ones? Break a ten into ten ones.',
    steps: [
      { say: "52 take away 27. Here is 52. That's 5 tens and 2 ones.", board: board({ dots: [...tens(5, 't', 'a', LEFT), ...ones(2, 'o', 'a', L1)] }), eq: '52 − 27' },
      { say: 'We need to take away 7 ones, but there are only 2. Break a ten into 10 ones!', board: board({ dots: [...tens(4, 't', 'a', LEFT), ...ones(2, 'o', 'a', L1), ...Array.from({ length: 10 }, (_, k) => ({ id: `t4-${k}`, ...oneAt(2 + k, L1), c: 'c' as Hue, d: k * 0.05 }))] }), eq: '52 = 40 + [12]' },
      { say: 'Now take away 7 ones. 12 take away 7 leaves 5.', board: board({ dots: [...tens(4, 't', 'a', LEFT), ...ones(2, 'o', 'a', L1), ...Array.from({ length: 10 }, (_, k) => ({ id: `t4-${k}`, ...oneAt(2 + k, L1), c: 'c' as Hue, out: k >= 3 }))] }), eq: '12 − 7 = [5]' },
      { say: 'And take away 2 tens. 4 tens take away 2 tens leaves 2 tens.', board: board({ dots: [...tens(4, 't', 'a', LEFT).map(d => ({ ...d, out: d.y >= tenAt(2, 0, LEFT).y })), ...ones(2, 'o', 'a', L1), ...Array.from({ length: 10 }, (_, k) => ({ id: `t4-${k}`, ...oneAt(2 + k, L1), c: 'c' as Hue, out: k >= 3 }))] }), eq: '4 − 2 = [2] tens' },
      { say: '2 tens and 5 ones are left. So 52 − 27 = 25!', board: board({ dots: [...tens(4, 't', 'a', LEFT).map(d => ({ ...d, out: d.y >= tenAt(2, 0, LEFT).y })), ...ones(2, 'o', 'a', L1), ...Array.from({ length: 10 }, (_, k) => ({ id: `t4-${k}`, ...oneAt(2 + k, L1), c: 'c' as Hue, out: k >= 3 }))], tags: [tag('t', LEFT + 4.5 * C, ROW0 - 34, '2 tens', 'a'), tag('o', L1 + 30, ROW0 - 14, '5 ones', 'c'), tag('n', 300, 310, '25', 'ink', 40)] }), eq: '52 − 27 = [25]' },
    ],
    tries: [Q(43, 18, '-'), Q(60, 24, '-'), Q(35, 17, '-')],
    pic: f => blocksOf(f.a),
    hint: f => { const oa = f.a % 10, ob = f.b % 10, n = f.a - f.b; return oa < ob ? `${oa} ones is not enough to take ${ob}: break a ten. ${oa + 10} − ${ob} = ${n % 10} ones, and ${tensOnes(n)} are left: ${n}.` : `${oa} − ${ob} = ${n % 10} ones, and ${tensOnes(n)} are left: ${n}.`; },
  },
  {
    id: 'pv-rounding', title: 'Rounding', op: '+', regions: [], area: 'place', practice: 'place-c-1', blurb: 'Which ten is nearer? Halfway rounds up.',
    steps: [
      { say: '47 is between 40 and 50. Which ten is nearer?', board: board({ line: lineFor(47) }), eq: '47' },
      { say: "Hop up to 50. 48, 49, 50. That's only 3 hops!", board: board({ line: { from: 40, to: 50, at: 50, hops: [{ a: 47, b: 48, label: '1' }, { a: 48, b: 49, label: '2' }, { a: 49, b: 50, label: '3' }] } }), eq: '47 → 50 is [3] hops' },
      { say: 'Going back to 40 would take 7 hops. 50 is nearer, so 47 rounds to 50!', board: board({ line: { from: 40, to: 50, at: 50, hops: [{ a: 47, b: 48, label: '1' }, { a: 48, b: 49, label: '2' }, { a: 49, b: 50, label: '3' }] }, tags: [tag('n', 300, 120, '47 rounds to 50', 'ink', 34)] }), eq: '47 rounds to [50]' },
      { say: "What if it's right in the middle, like 45? Then we round up, to 50! Hundreds work the same way.", board: board({ line: lineFor(45), tags: [tag('m', 300, 120, 'halfway: round up!', 'c', 32)] }), eq: '45 rounds to [50]' },
    ],
    tries: [Q(23, 10, '+', '23 → nearest 10', 20), Q(68, 10, '+', '68 → nearest 10', 70), Q(35, 10, '+', '35 → nearest 10', 40)],
    pic: f => board({ line: lineFor(f.a) }),
    hint: f => { const lo = Math.floor(f.a / 10) * 10, r = roundTen(f.a); return `${f.a} is ${f.a - lo} on from ${lo} and ${lo + 10 - f.a} back from ${lo + 10}${f.a - lo === 5 ? ': halfway rounds up' : ''}. It rounds to ${r}.`; },
  },
];
