// Learn lessons: the buddy teaches each trick from the help card as a little moving picture. A lesson
// is a few "watch" steps (the dots, ten frames and number lines move to show the idea), then three
// "your turn" questions with the picture still there to help, then a finish with shells. Learned
// tricks are saved with the player's math, and show as a 💡 Trick in battles.
//
// The pictures are plain data (dots with ids and places), so moving from one step to the next only
// changes numbers: the same dot slides to its new place, new dots pop in, gone ones float away.

import { dayKey, type Profile } from '../engine/profile';
import { earnShells, notePractice } from '../adventure/state';
import type { Rarity } from '../adventure/glimmers';
import { minusGroup, plusGroup, STRAND, TRICK, trickFor, trickOf, type MathLesson, type MathRegionId } from './course';
import { answerOf, type Fact, type Op } from './facts';
import { mathOf, type MathProgress } from './progress';

// ---------- the pictures ----------

/** a: the first number (blue), b: the second (pink), c: the one that makes the trick work (gold),
 *  ghost: an empty place to count into */
export type Hue = 'a' | 'b' | 'c' | 'ghost';
export type Dot = { id: string; x: number; y: number; c: Hue; /** crossed out: taken away, still shown */ out?: boolean; /** seconds to wait before moving */ d?: number };
export type Tag = { id: string; x: number; y: number; text: string; c?: Hue | 'ink'; size?: number };
export type Board = {
  /** the dot size: every dot is drawn in a square this big */
  cell: number;
  dots: Dot[];
  /** ten frames (5 by 2 boxes), by their top left corner */
  frames: { id: string; x: number; y: number }[];
  /** plates for groups, by their middle */
  plates: { id: string; x: number; y: number; r: number; empty?: boolean }[];
  /** a number line with the buddy standing at `at`, and the hops made so far */
  line: { from: number; to: number; at: number; hops: { a: number; b: number; label: string }[] } | null;
  tags: Tag[];
};
/** the picture's size; it scales to fit */
export const BW = 600, BH = 340;
const board = (b: Partial<Board>): Board => ({ cell: 48, dots: [], frames: [], plates: [], line: null, tags: [], ...b });

// ten frames: two side by side
export const FC = 48;
const FX = [52, 308], FY = 128;
const inFrame = (i: number, frame = 0) => ({ x: FX[frame] + (i % 5) * FC + FC / 2, y: FY + Math.floor(i / 5) * FC + FC / 2 });
const frameDots = (n: number, c: Hue, prefix: string, frame = 0, from = 0, d = 0.06): Dot[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, ...inFrame(from + i, frame), c, d: i * d }));
const frames = (n: 1 | 2) => FX.slice(0, n).map((x, i) => ({ id: `f${i}`, x, y: FY }));

/** Rows of dots, centred, sized so the biggest picture in the lesson fits. `hue(r, c)` colours each. */
function rows(nRows: number, nCols: number, cell: number, hue: (r: number, c: number) => Hue | null, gapAfter: number[] = [], prefix = 'g'): Dot[] {
  const gap = cell * 0.35;
  const w = nCols * cell, h = nRows * cell + gapAfter.filter(g => g < nRows - 1).length * gap;
  const x0 = (BW - w) / 2 + cell / 2, y0 = 18 + (BH - 36 - h) / 2 + cell / 2;
  const out: Dot[] = [];
  for (let r = 0; r < nRows; r++) {
    const extra = gapAfter.filter(g => g < r).length * gap;
    for (let c = 0; c < nCols; c++) {
      const hu = hue(r, c);
      if (hu) out.push({ id: `${prefix}${r}-${c}`, x: x0 + c * cell, y: y0 + r * cell + extra, c: hu, d: (r * nCols + c) * 0.02 });
    }
  }
  return out;
}
/** A grid sized for a fixed frame (so dots keep their places as rows are added). */
function grid(maxRows: number, maxCols: number) {
  return Math.min(56, (BW - 60) / maxCols, (BH - 60) / maxRows);
}

/** Plates in a row, with `per` dots on each (dealt one plate at a time, round and round). */
function plateRow(n: number, per: number, prefix = 'p', withDots = true) {
  const r = n <= 3 ? 62 : n <= 5 ? 50 : 36;
  const span = BW - 80, step = span / n;
  const plates = Array.from({ length: n }, (_, i) => ({ id: `pl${i}`, x: 40 + step * (i + 0.5), y: 190, r, empty: per === 0 }));
  const dots: Dot[] = [];
  if (withDots) {
    const cols = per <= 4 ? 2 : 3, cell = Math.min(26, (r * 1.5) / cols);
    for (let k = 0; k < n * per; k++) {
      const plate = k % n, j = Math.floor(k / n);
      const rowsN = Math.ceil(per / cols), rr = Math.floor(j / cols), cc = j % cols;
      const inRow = Math.min(cols, per - rr * cols);
      dots.push({ id: `${prefix}${k}`, x: plates[plate].x + (cc - (inRow - 1) / 2) * cell, y: plates[plate].y + (rr - (rowsN - 1) / 2) * cell, c: 'a', d: k * 0.1 });
    }
  }
  return { plates, dots };
}
/** A pile of dots to share out, on the left above the plates. */
function pile(n: number, prefix = 'p'): Dot[] {
  const cols = Math.min(10, n), cell = 30;
  return Array.from({ length: n }, (_, k) => ({ id: `${prefix}${k}`, x: BW / 2 + ((k % cols) - (cols - 1) / 2) * cell, y: 60 + Math.floor(k / cols) * cell, c: 'a' as Hue, d: 0 }));
}
/** A ring of dots inside one plate. */
function ringOn(n: number, x: number, y: number, r: number, prefix = 'r'): Dot[] {
  if (n === 1) return [{ id: `${prefix}0`, x, y, c: 'a' }];
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, x: x + Math.cos((i / n) * Math.PI * 2 - Math.PI / 2) * r * 0.55, y: y + Math.sin((i / n) * Math.PI * 2 - Math.PI / 2) * r * 0.55, c: 'a' as Hue, d: i * 0.06 }));
}
const line = (from: number, to: number, at: number, hops: { a: number; b: number; label: string }[] = []) => ({ from, to, at, hops });

// ---------- the lessons ----------

export type Step = { say: string; board: Board; /** the sum under the picture; [x] is lit up */ eq: string };
export type Lesson = {
  id: string;
  title: string;
  op: Op;
  /** the map regions it teaches (their first stop gets "Learn it first") */
  regions: MathRegionId[];
  /** one line for its card */
  blurb: string;
  steps: Step[];
  /** your turn: three facts, each with a picture that helps */
  tries: Fact[];
  pic: (f: Fact) => Board;
  /** which watch step makes the best picture for its card (default: the last) */
  cover?: number;
};

const F = (a: number, b: number, op: Op = 'x'): Fact => ({ a, b, op });
const sum = (f: Fact) => `${f.a} ${sign(f.op ?? 'x')} ${f.b}`;
export const sign = (op: Op) => ({ '+': '+', '-': '−', x: '×', '/': '÷' })[op];

// a plus line from 0 to at least 10, with the buddy at the bigger number
const startLine = (f: Fact) => board({ line: line(0, Math.max(10, f.a + f.b), Math.max(f.a, f.b)) });
// two rows: the double, and the one more in gold
function twins(lo: number, hi: number, cell = 54, maxCols = 8): Dot[] {
  const x0 = (BW - maxCols * cell) / 2 + cell / 2;
  return [
    ...Array.from({ length: lo }, (_, i) => ({ id: `t${i}`, x: x0 + i * cell, y: 130, c: 'a' as Hue, d: i * 0.05 })),
    ...Array.from({ length: hi }, (_, i) => ({ id: `u${i}`, x: x0 + i * cell, y: 130 + cell * 1.2, c: (i < lo ? 'b' : 'c') as Hue, d: i * 0.05 })),
  ];
}
// bars of ten, standing up: `n` columns of ten dots, `half` greys the bottom five
function tenBars(n: number, cell: number, opts: { half?: boolean; maxCols?: number } = {}): Dot[] {
  const cols = opts.maxCols ?? n, gap = cell * 0.5;
  const w = cols * cell + (cols - 1) * gap;
  const x0 = (BW - w) / 2 + cell / 2, y0 = (BH - 10 * cell) / 2 + cell / 2 + 8;
  const out: Dot[] = [];
  for (let c = 0; c < n; c++) for (let r = 0; r < 10; r++) out.push({ id: `b${c}-${r}`, x: x0 + c * (cell + gap), y: y0 + r * cell, c: opts.half && r >= 5 ? 'ghost' : 'a', d: c * 0.25 + r * 0.02 });
  return out;
}

export const LESSONS: Lesson[] = [
  // ---- Plus Peaks ----
  {
    id: 'count-on', title: 'Count On', op: '+', regions: ['plus-s'], blurb: 'Start at the big number and hop on.',
    steps: [
      { say: 'Adding 2? Start at the bigger number: 6.', board: board({ line: line(0, 10, 6) }), eq: '6 + 2' },
      { say: 'Now count on. Hop 1: 7.', board: board({ line: line(0, 10, 7, [{ a: 6, b: 7, label: '7' }]) }), eq: '6 + 2' },
      { say: 'Hop 2: 8. So 6 + 2 = 8!', board: board({ line: line(0, 10, 8, [{ a: 6, b: 7, label: '7' }, { a: 7, b: 8, label: '8' }]) }), eq: '6 + 2 = [8]' },
      { say: 'Plus 1 is the very next number. Plus 0 changes nothing at all!', board: board({ line: line(0, 10, 5, [{ a: 4, b: 5, label: '+1' }]) }), eq: '4 + 1 = [5]   9 + 0 = [9]' },
    ],
    tries: [F(5, 2, '+'), F(1, 7, '+'), F(8, 0, '+')],
    cover: 2,
    pic: startLine,
  },
  {
    id: 'doubles', title: 'Doubles', op: '+', regions: ['plus-d'], blurb: 'Two of the same, and one more.',
    steps: [
      { say: 'Doubles are two of the same. Here are 6.', board: board({ cell: 54, dots: twins(6, 0) }), eq: '6' },
      { say: 'And 6 more, just like a mirror! 6 + 6 = 12.', board: board({ cell: 54, dots: twins(6, 6) }), eq: '6 + 6 = [12]' },
      { say: 'Near doubles are one more. 6 + 7 is the double, and 1 more...', board: board({ cell: 54, dots: twins(6, 7) }), eq: '6 + 7 = 6 + 6 + [1]' },
      { say: '12 and 1 more is 13!', board: board({ cell: 54, dots: twins(6, 7), tags: [{ id: 'n', x: 300, y: 64, text: '12 and 1 more', c: 'c' }] }), eq: '6 + 7 = [13]' },
    ],
    tries: [F(4, 4, '+'), F(7, 7, '+'), F(5, 6, '+')],
    pic: f => board({ cell: 54, dots: twins(Math.min(f.a, f.b), Math.max(f.a, f.b)) }),
  },
  {
    id: 'make-ten', title: 'Make Ten', op: '+', regions: ['plus-t'], blurb: 'Ten pairs, plus 10 and plus 9.',
    steps: [
      { say: 'A ten frame holds 10 dots. Here are 7.', board: board({ frames: frames(1), dots: frameDots(7, 'a', 'x') }), eq: '7' },
      { say: '3 more fill it up! 7 and 3 make 10.', board: board({ frames: frames(1), dots: [...frameDots(7, 'a', 'x'), ...frameDots(3, 'b', 'x', 0, 7).map((d, i) => ({ ...d, id: `x${7 + i}` }))] }), eq: '7 + 3 = [10]' },
      { say: 'Plus 10 is quick: a full ten and 4 more. A 1 goes in front: 14!', board: board({ frames: frames(2), dots: [...frameDots(10, 'a', 'x'), ...frameDots(4, 'b', 'y', 1)] }), eq: '10 + 4 = [14]' },
      { say: 'Plus 9 is plus 10, then 1 back. 5 + 10 is 15...', board: board({ line: line(0, 20, 15, [{ a: 5, b: 15, label: '+10' }]) }), eq: '5 + 9' },
      { say: '...then hop 1 back: 14. So 5 + 9 = 14!', board: board({ line: line(0, 20, 14, [{ a: 5, b: 15, label: '+10' }, { a: 15, b: 14, label: '−1' }]) }), eq: '5 + 9 = [14]' },
    ],
    tries: [F(6, 4, '+'), F(10, 3, '+'), F(9, 4, '+')],
    pic: f => {
      const hi = Math.max(f.a, f.b), lo = Math.min(f.a, f.b);
      if (f.a + f.b <= 10) return board({ frames: frames(1), dots: [...frameDots(f.a, 'a', 'x'), ...frameDots(f.b, 'b', 'y', 0, f.a)] });
      return board({ frames: frames(2), dots: [...frameDots(hi, 'a', 'x'), ...frameDots(lo, 'b', 'y', 1)] });
    },
  },
  {
    id: 'bridge-ten', title: 'Make Ten First', op: '+', regions: ['plus-b'], blurb: 'Fill the ten, then add the rest.',
    steps: [
      { say: '8 + 5. Put 8 in one ten frame and 5 in the other.', board: board({ frames: frames(2), dots: [...frameDots(8, 'a', 'x'), ...frameDots(5, 'b', 'y', 1)] }), eq: '8 + 5' },
      { say: 'Move 2 over to fill the ten!', board: board({ frames: frames(2), dots: [...frameDots(8, 'a', 'x'), { id: 'y0', ...inFrame(8), c: 'c' }, { id: 'y1', ...inFrame(9), c: 'c', d: 0.15 }, ...[2, 3, 4].map((k, i) => ({ id: `y${k}`, ...inFrame(i, 1), c: 'b' as Hue, d: 0.3 + i * 0.05 }))] }), eq: '8 + 5 = 10 + [3]' },
      { say: 'A full ten and 3 more: 13!', board: board({ frames: frames(2), dots: [...frameDots(8, 'a', 'x'), { id: 'y0', ...inFrame(8), c: 'c' }, { id: 'y1', ...inFrame(9), c: 'c' }, ...[2, 3, 4].map((k, i) => ({ id: `y${k}`, ...inFrame(i, 1), c: 'b' as Hue }))], tags: [{ id: 't10', x: FX[0] + 120, y: FY - 30, text: '10', c: 'a', size: 40 }, { id: 't3', x: FX[1] + 120, y: FY - 30, text: '3', c: 'b', size: 40 }] }), eq: '8 + 5 = [13]' },
    ],
    tries: [F(7, 4, '+'), F(7, 5, '+'), F(8, 6, '+')],
    pic: f => { const hi = Math.max(f.a, f.b), lo = Math.min(f.a, f.b); return board({ frames: frames(2), dots: [...frameDots(hi, 'a', 'x'), ...frameDots(lo, 'b', 'y', 1)] }); },
  },
  // ---- Minus Mountain ----
  {
    id: 'count-back', title: 'Count Back', op: '-', regions: ['minus-s'], blurb: 'Start at the big number and hop back.',
    steps: [
      { say: 'Taking away 2? Start at 9.', board: board({ line: line(0, 10, 9) }), eq: '9 − 2' },
      { say: 'Count back. Hop 1: 8.', board: board({ line: line(0, 10, 8, [{ a: 9, b: 8, label: '8' }]) }), eq: '9 − 2' },
      { say: 'Hop 2: 7. So 9 − 2 = 7!', board: board({ line: line(0, 10, 7, [{ a: 9, b: 8, label: '8' }, { a: 8, b: 7, label: '7' }]) }), eq: '9 − 2 = [7]' },
      { say: 'Take away 1 is the number just before. Take away 0? Nothing changes!', board: board({ line: line(0, 10, 5, [{ a: 6, b: 5, label: '−1' }]) }), eq: '6 − 1 = [5]   7 − 0 = [7]' },
    ],
    tries: [F(7, 1, '-'), F(10, 2, '-'), F(5, 0, '-')],
    cover: 2,
    pic: f => board({ line: line(0, Math.max(10, f.a), f.a) }),
  },
  {
    id: 'doubles-back', title: 'Doubles Back', op: '-', regions: ['minus-d'], blurb: 'Use a double backwards, and take away ten.',
    steps: [
      { say: 'You know 7 + 7 = 14.', board: board({ cell: 54, dots: twins(7, 7) }), eq: '7 + 7 = 14' },
      { say: 'Take one row away: 7 are left. 14 − 7 = 7!', board: board({ cell: 54, dots: twins(7, 0) }), eq: '14 − 7 = [7]' },
      { say: 'Take away 10? 16 is a full ten and 6.', board: board({ frames: frames(2), dots: [...frameDots(10, 'b', 'x'), ...frameDots(6, 'a', 'y', 1)] }), eq: '16 − 10' },
      { say: 'The ten goes, the 6 stay. 16 − 10 = 6!', board: board({ frames: frames(2), dots: frameDots(6, 'a', 'y', 1) }), eq: '16 − 10 = [6]' },
    ],
    tries: [F(12, 6, '-'), F(15, 10, '-'), F(10, 5, '-')],
    pic: f => {
      if (f.a === 2 * f.b) return board({ cell: 54, dots: twins(f.b, f.b).map(d => (d.c === 'b' ? { ...d, out: true } : d)) });
      if (f.a >= 10) return board({ frames: frames(2), dots: [...frameDots(10, f.b === 10 ? 'b' : 'a', 'x').map(d => (f.b === 10 ? { ...d, out: true } : d)), ...frameDots(f.a - 10, f.b === 10 ? 'a' : 'b', 'y', 1).map(d => (f.b !== 10 ? { ...d, out: true } : d))] });
      return board({ line: line(0, Math.max(10, f.a), f.a) });
    },
  },
  {
    id: 'ten-back', title: 'From Ten', op: '-', regions: ['minus-t'], blurb: 'Ten pairs backwards, and take away 9.',
    steps: [
      { say: 'Here is a full ten.', board: board({ frames: frames(1), dots: frameDots(10, 'a', 'x') }), eq: '10' },
      { say: 'Take 3 away. 3 and 7 make 10, so 7 are left!', board: board({ frames: frames(1), dots: frameDots(7, 'a', 'x') }), eq: '10 − 3 = [7]' },
      { say: 'Take away 9? Take away 10 first: 15 − 10 is 5...', board: board({ line: line(0, 20, 5, [{ a: 15, b: 5, label: '−10' }]) }), eq: '15 − 9' },
      { say: '...then give 1 back: 6. So 15 − 9 = 6!', board: board({ line: line(0, 20, 6, [{ a: 15, b: 5, label: '−10' }, { a: 5, b: 6, label: '+1' }]) }), eq: '15 − 9 = [6]' },
    ],
    tries: [F(10, 4, '-'), F(10, 8, '-'), F(13, 9, '-')],
    pic: f => (f.a === 10 ? board({ frames: frames(1), dots: frameDots(10, 'a', 'x').map((d, i) => (i >= 10 - f.b ? { ...d, out: true } : d)) }) : board({ line: line(0, 20, f.a) })),
  },
  {
    id: 'think-plus', title: 'Think Addition', op: '-', regions: ['minus-b'], blurb: 'Turn it around into a plus.',
    steps: [
      { say: '13 − 5? Turn it around: 5 plus what makes 13?', board: board({ frames: frames(2), dots: [...frameDots(5, 'a', 'x'), ...frameDots(5, 'ghost', 'g', 0, 5), ...frameDots(3, 'ghost', 'h', 1)] }), eq: '5 + ? = 13' },
      { say: 'Add 5 to fill the ten...', board: board({ frames: frames(2), dots: [...frameDots(5, 'a', 'x'), ...frameDots(5, 'b', 'g', 0, 5, 0.12), ...frameDots(3, 'ghost', 'h', 1)] }), eq: '5 + 5 = 10' },
      { say: '...and 3 more makes 13. We added 5 and 3: that is 8.', board: board({ frames: frames(2), dots: [...frameDots(5, 'a', 'x'), ...frameDots(5, 'b', 'g', 0, 5), ...frameDots(3, 'b', 'h', 1, 0, 0.12)], tags: [{ id: 'e', x: 300, y: 70, text: '5 + 3 = 8 added', c: 'b' }] }), eq: '5 + [8] = 13' },
      { say: 'So 13 − 5 = 8!', board: board({ frames: frames(2), dots: [...frameDots(5, 'a', 'x'), ...frameDots(5, 'b', 'g', 0, 5), ...frameDots(3, 'b', 'h', 1)] }), eq: '13 − 5 = [8]' },
    ],
    tries: [F(12, 4, '-'), F(11, 3, '-'), F(14, 6, '-')],
    pic: f => board({ frames: frames(2), dots: [...frameDots(f.b, 'a', 'x'), ...Array.from({ length: f.a - f.b }, (_, i) => ({ id: `g${i}`, ...(f.b + i < 10 ? inFrame(f.b + i) : inFrame(f.b + i - 10, 1)), c: 'ghost' as Hue }))] }),
  },
  // ---- Times Trail ----
  {
    id: 'zero-one', title: 'Times 1 and 0', op: 'x', regions: [], blurb: 'Times 1 stays the same. Times 0 is 0.',
    steps: [
      { say: 'Times 1 means one group. 1 group of 7...', board: board({ cell: 40, plates: [{ id: 'pl0', x: 300, y: 180, r: 92 }], dots: ringOn(7, 300, 180, 92) }), eq: '7 × 1' },
      { say: '...is just 7. Times 1 stays the same!', board: board({ cell: 40, plates: [{ id: 'pl0', x: 300, y: 180, r: 92 }], dots: ringOn(7, 300, 180, 92), tags: [{ id: 'n', x: 300, y: 50, text: '7', c: 'a', size: 44 }] }), eq: '7 × 1 = [7]' },
      { say: 'Times 0 means zero groups. 5 × 0: no groups of 5 at all...', board: board({ cell: 40, plates: [{ id: 'pl0', x: 300, y: 180, r: 92, empty: true }] }), eq: '5 × 0' },
      { say: '...so there is nothing at all. Times 0 is always 0!', board: board({ cell: 40, plates: [{ id: 'pl0', x: 300, y: 180, r: 92, empty: true }], tags: [{ id: 'n', x: 300, y: 50, text: '0', c: 'ink', size: 44 }] }), eq: '5 × 0 = [0]' },
    ],
    tries: [F(8, 1), F(4, 0), F(1, 6)],
    cover: 1,
    pic: f => {
      const n = f.b === 1 ? f.a : f.a === 1 ? f.b : 0;
      return board({ cell: 40, plates: [{ id: 'pl0', x: 300, y: 180, r: 92, empty: n === 0 }], dots: n ? ringOn(n, 300, 180, 92) : [] });
    },
  },
  {
    id: 'times-2', title: 'Times 2: Doubles', op: 'x', regions: ['twins'], blurb: 'Times 2 is a double.',
    steps: [
      { say: '6 × 2 means 2 groups of 6. Here is one group.', board: board({ cell: 54, dots: twins(6, 0) }), eq: '6 × 2' },
      { say: 'And the second group: it is a double! 6 + 6 = 12.', board: board({ cell: 54, dots: twins(6, 6) }), eq: '6 × 2 = 6 + 6 = [12]' },
      { say: 'Turn it round and it is the same: 2 × 6 = 12 too.', board: board({ cell: 54, dots: twins(6, 6), tags: [{ id: 'n', x: 300, y: 64, text: '12', c: 'ink', size: 44 }] }), eq: '2 × 6 = [12]' },
    ],
    tries: [F(3, 2), F(7, 2), F(2, 8)],
    pic: f => { const n = f.b === 2 ? f.a : f.b; return board({ cell: 54, dots: twins(n, n, 54, Math.max(8, n)) }); },
  },
  {
    id: 'times-10', title: 'Add a Zero', op: 'x', regions: ['tens'], blurb: 'Times 10: put a zero on the end.',
    steps: [
      { say: '4 × 10 means 4 bars of ten.', board: board({ cell: 26, dots: tenBars(4, 26) }), eq: '4 × 10' },
      { say: 'Count the tens: 10, 20, 30, 40.', board: board({ cell: 26, dots: tenBars(4, 26), tags: [0, 1, 2, 3].map(i => ({ id: `t${i}`, x: tenBars(4, 26)[i * 10].x, y: 30, text: `${(i + 1) * 10}`, c: 'a' as Hue, size: 26 })) }), eq: '10, 20, 30, 40' },
      { say: '4 tens is 40: put a zero on the end of the 4!', board: board({ cell: 26, dots: tenBars(4, 26), tags: [{ id: 'big', x: 300, y: 30, text: '4 → 40', c: 'ink', size: 34 }] }), eq: '4 × 10 = [40]' },
    ],
    tries: [F(3, 10), F(7, 10), F(10, 6)],
    pic: f => { const n = f.b === 10 ? f.a : f.b; return board({ cell: 26, dots: tenBars(n, Math.min(26, 500 / (n * 1.5))) }); },
  },
  {
    id: 'times-5', title: 'Half of Ten', op: 'x', regions: ['fives'], blurb: 'Times 5 is half of times 10.',
    steps: [
      { say: '6 × 10 is 60: 6 bars of ten.', board: board({ cell: 26, dots: tenBars(6, 26) }), eq: '6 × 10 = 60' },
      { say: 'Times 5 is half of that. Cover the bottom half...', board: board({ cell: 26, dots: tenBars(6, 26, { half: true }) }), eq: '6 × 5 = half of 60' },
      { say: 'Half of 60 is 30. So 6 × 5 = 30!', board: board({ cell: 26, dots: tenBars(6, 26, { half: true }), tags: [{ id: 'n', x: 300, y: 24, text: 'half of 60 is 30', c: 'a', size: 28 }] }), eq: '6 × 5 = [30]' },
    ],
    tries: [F(4, 5), F(8, 5), F(5, 3)],
    pic: f => { const n = f.b === 5 ? f.a : f.b; return board({ cell: 26, dots: tenBars(n, Math.min(26, 500 / (n * 1.5)), { half: true }) }); },
  },
  {
    id: 'times-4', title: 'Double, Double', op: 'x', regions: ['fours'], blurb: 'Times 4: double it, then double again.',
    steps: [
      { say: '3 × 4. Start with one row of 3.', board: board({ cell: 54, dots: rows(4, 3, 54, (r) => (r < 1 ? 'a' : null), [1]) }), eq: '3' },
      { say: 'Double it: 6.', board: board({ cell: 54, dots: rows(4, 3, 54, (r) => (r < 2 ? (r === 0 ? 'a' : 'b') : null), [1]) }), eq: '3 + 3 = 6' },
      { say: 'Double again: 6 and 6 is 12!', board: board({ cell: 54, dots: rows(4, 3, 54, (r) => (r < 2 ? 'a' : 'b'), [1]) }), eq: '3 × 4 = 6 + 6 = [12]' },
    ],
    tries: [F(5, 4), F(4, 6), F(7, 4)],
    pic: f => { const n = f.b === 4 ? f.a : f.b; const c = grid(4.4, n); return board({ cell: c, dots: rows(4, n, c, r => (r < 2 ? 'a' : 'b'), [1]) }); },
  },
  {
    id: 'times-3', title: 'Double and One More', op: 'x', regions: ['threes'], blurb: 'Times 3: double it, and one more.',
    steps: [
      { say: '6 × 3. Double 6 is 12.', board: board({ cell: 54, dots: rows(3, 6, 54, r => (r < 2 ? 'a' : null), [1]) }), eq: '6 + 6 = 12' },
      { say: 'One more 6 makes 18!', board: board({ cell: 54, dots: rows(3, 6, 54, r => (r < 2 ? 'a' : 'c'), [1]) }), eq: '6 × 3 = 12 + 6 = [18]' },
    ],
    tries: [F(4, 3), F(5, 3), F(7, 3)],
    pic: f => { const n = f.b === 3 ? f.a : f.b; const c = grid(3.4, n); return board({ cell: c, dots: rows(3, n, c, r => (r < 2 ? 'a' : 'c'), [1]) }); },
  },
  {
    id: 'times-9', title: 'Ten, Take One Away', op: 'x', regions: ['nines'], blurb: 'Times 9: times 10, then take one away.',
    steps: [
      { say: '4 × 9. First, 4 × 10 is 40.', board: board({ cell: 50, dots: rows(4, 10, 50, () => 'a') }), eq: '4 × 10 = 40' },
      { say: 'Times 9 is one 4 less: take one off each row.', board: board({ cell: 50, dots: rows(4, 10, 50, (_, c) => (c < 9 ? 'a' : null)) }), eq: '4 × 9 = 40 − 4' },
      { say: '40 take away 4 is 36!', board: board({ cell: 50, dots: rows(4, 10, 50, (_, c) => (c < 9 ? 'a' : null)) }), eq: '4 × 9 = [36]' },
    ],
    tries: [F(3, 9), F(5, 9), F(9, 6)],
    pic: f => { const n = f.b === 9 ? f.a : f.b; const c = grid(n, 10); return board({ cell: c, dots: rows(n, 10, c, (_, cc) => (cc < 9 ? 'a' : 'ghost')) }); },
  },
  {
    id: 'times-6', title: 'Five and One More', op: 'x', regions: ['sixes'], blurb: 'Times 6: times 5, and one more.',
    steps: [
      { say: '4 × 6. First, 4 × 5 is 20.', board: board({ cell: 54, dots: rows(4, 6, 54, (_, c) => (c < 5 ? 'a' : null)) }), eq: '4 × 5 = 20' },
      { say: 'One more 4 makes 24!', board: board({ cell: 54, dots: rows(4, 6, 54, (_, c) => (c < 5 ? 'a' : 'c')) }), eq: '4 × 6 = 20 + 4 = [24]' },
    ],
    tries: [F(3, 6), F(5, 6), F(6, 6)],
    pic: f => { const n = f.b === 6 ? f.a : f.b; const c = grid(n, 6); return board({ cell: c, dots: rows(n, 6, c, (_, cc) => (cc < 5 ? 'a' : 'c')) }); },
  },
  {
    id: 'times-8', title: 'Double, Double, Double', op: 'x', regions: ['eights'], blurb: 'Times 8: double three times.',
    steps: [
      { say: '3 × 8. Start with 3.', board: board({ cell: 32, dots: rows(8, 3, 32, r => (r < 1 ? 'a' : null), [0, 1, 3]) }), eq: '3' },
      { say: 'Double: 6.', board: board({ cell: 32, dots: rows(8, 3, 32, r => (r < 2 ? (r < 1 ? 'a' : 'b') : null), [0, 1, 3]) }), eq: '6' },
      { say: 'Double again: 12.', board: board({ cell: 32, dots: rows(8, 3, 32, r => (r < 4 ? (r < 2 ? 'a' : 'b') : null), [0, 1, 3]) }), eq: '12' },
      { say: 'And double once more: 24!', board: board({ cell: 32, dots: rows(8, 3, 32, r => (r < 4 ? 'a' : 'b'), [0, 1, 3]) }), eq: '3 × 8 = [24]' },
    ],
    tries: [F(2, 8), F(4, 8), F(5, 8)],
    pic: f => { const n = f.b === 8 ? f.a : f.b; const c = Math.min(32, grid(8.6, n)); return board({ cell: c, dots: rows(8, n, c, r => (r < 4 ? 'a' : 'b'), [0, 1, 3]) }); },
  },
  {
    id: 'times-7', title: 'Five and Two', op: 'x', regions: ['sevens'], blurb: 'Times 7: times 5 and times 2, together.',
    steps: [
      { say: '6 × 7. First, 6 × 5 is 30.', board: board({ cell: 44, dots: rows(6, 7, 44, (_, c) => (c < 5 ? 'a' : null)) }), eq: '6 × 5 = 30' },
      { say: 'Then 6 × 2 is 12.', board: board({ cell: 44, dots: rows(6, 7, 44, (_, c) => (c < 5 ? 'a' : 'b')) }), eq: '6 × 2 = 12' },
      { say: 'Together: 30 and 12 is 42!', board: board({ cell: 44, dots: rows(6, 7, 44, (_, c) => (c < 5 ? 'a' : 'b')), tags: [{ id: 'n', x: 300, y: 22, text: '30 + 12 = 42', c: 'ink', size: 28 }] }), eq: '6 × 7 = [42]' },
    ],
    tries: [F(2, 7), F(3, 7), F(4, 7)],
    pic: f => { const n = f.b === 7 ? f.a : f.b; const c = grid(n, 7); return board({ cell: c, dots: rows(n, 7, c, (_, cc) => (cc < 5 ? 'a' : 'b')) }); },
  },
  // ---- Share Shore ----
  {
    id: 'think-times', title: 'Share It Out', op: '/', regions: ['share-a', 'share-b', 'share-c', 'share-d'], blurb: 'Share into groups, and think of the times table.',
    steps: [
      { say: '12 ÷ 3 means share 12 into 3 groups.', board: board({ cell: 30, dots: pile(12), plates: plateRow(3, 4, 'p', false).plates }), eq: '12 ÷ 3' },
      { say: 'Give one to each plate, round and round...', board: board({ cell: 30, ...plateRow(3, 4) }), eq: '12 ÷ 3' },
      { say: 'Each plate gets 4!', board: board({ cell: 30, ...plateRow(3, 4), tags: [0, 1, 2].map(i => ({ id: `t${i}`, x: plateRow(3, 4).plates[i].x, y: 290, text: '4', c: 'a' as Hue, size: 34 })) }), eq: '12 ÷ 3 = [4]' },
      { say: 'Think times: 4 × 3 = 12, so 12 ÷ 3 = 4.', board: board({ cell: 30, ...plateRow(3, 4), tags: [{ id: 'n', x: 300, y: 50, text: '4 × 3 = 12', c: 'ink', size: 34 }] }), eq: '12 ÷ 3 = [4]' },
    ],
    tries: [F(8, 2, '/'), F(15, 3, '/'), F(20, 5, '/')],
    pic: f => board({ cell: 30, ...plateRow(f.b, f.a / f.b) }),
  },
];
export const LESSON: Record<string, Lesson> = Object.fromEntries(LESSONS.map(l => [l.id, l]));
export const lessonColor = (l: Lesson) => STRAND[l.op].color;

/** The buddy's words for a fact in this lesson's own trick (a times lesson uses its table's trick even
 *  when the help card would pick an easier one). */
export function hintFor(l: Lesson, f: Fact): string {
  if (l.id.startsWith('times-')) {
    const t = +l.id.slice(6), n = f.b === t ? f.a : f.b;
    return TRICK[t]?.say(n) ?? trickOf(f).say;
  }
  return trickOf(f).say;
}
/** The picture for a lesson's card. */
export const coverOf = (l: Lesson) => l.steps[l.cover ?? l.steps.length - 1].board;

/** The part of the board a set of pictures uses, with a margin: the picture is zoomed to it. */
export function boundsOf(boards: Board[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (ax: number, ay: number, bx: number, by: number) => { x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by); };
  for (const b of boards) {
    const h = b.cell / 2;
    for (const d of b.dots) add(d.x - h, d.y - h, d.x + h, d.y + h);
    for (const f of b.frames) add(f.x - 8, f.y - 8, f.x + FC * 5 + 8, f.y + FC * 2 + 8);
    for (const p of b.plates) add(p.x - p.r - 4, p.y - p.r, p.x + p.r + 4, p.y + p.r);
    if (b.line) add(10, 236 - 120, BW - 10, 236 + 48);
    for (const t of b.tags) { const sz = t.size ?? 30, w = t.text.length * sz * 0.32 + 8; add(t.x - w, t.y - sz, t.x + w, t.y + 10); }
  }
  if (!isFinite(x0)) return { x: 0, y: 0, w: BW, h: BH };
  // a margin, and never zoomed in more than about twice (a few dots shouldn't fill the whole board)
  const m = 18, w = Math.max(320, x1 - x0 + m * 2), h = Math.max(180, y1 - y0 + m * 2);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

// ---------- which lesson goes with what ----------

const PLUS_LESSON: Record<string, string> = { '+s': 'count-on', '+d': 'doubles', '+t': 'make-ten', '+b': 'bridge-ten' };
const MINUS_LESSON: Record<string, string> = { '-s': 'count-back', '-d': 'doubles-back', '-t': 'ten-back', '-b': 'think-plus' };
const TIMES_LESSON: Record<number, string> = { 0: 'zero-one', 1: 'zero-one', 2: 'times-2', 10: 'times-10', 5: 'times-5', 4: 'times-4', 3: 'times-3', 9: 'times-9', 6: 'times-6', 8: 'times-8', 7: 'times-7' };

/** The lesson for a fact: the one that teaches the trick the buddy uses for it. */
export function lessonForFact(f: Fact): Lesson {
  const op = f.op ?? 'x';
  if (op === '+') return LESSON[PLUS_LESSON[plusGroup(f)]];
  if (op === '-') return LESSON[MINUS_LESSON[minusGroup(f)]];
  if (op === '/') return LESSON['think-times'];
  return LESSON[TIMES_LESSON[trickFor(f).table] ?? 'times-2'];
}
/** The lesson to learn before a map stop: the rules stop gets Times 1 and 0, the rest their region's. */
export function lessonForStop(l: MathLesson): Lesson | null {
  if (l.region === 'start') return null;
  if (l.kind === 'rules') return LESSON['zero-one'];
  return LESSONS.find(x => x.regions.includes(l.region as MathRegionId)) ?? null;
}
/** Stops that get "Learn it first": the rules stop and each region's Meet stop. */
export const isLearnStop = (l: MathLesson) => l.kind === 'meet' || l.kind === 'rules';

// ---------- what the player has learned ----------

export const learnedOf = (m: MathProgress) => new Set(m.learned ?? []);
export const isLearned = (m: MathProgress, id: string) => (m.learned ?? []).includes(id);
/** The next lesson to learn: the one for the next math stop, if it isn't learned yet, then the first not learned in course order. */
export function nextToLearn(m: MathProgress, next: MathLesson | null): Lesson | null {
  const forNext = next ? lessonForStop(next) : null;
  if (forNext && !isLearned(m, forNext.id)) return forNext;
  const strandFirst = LESSONS.filter(l => l.op === (next?.op ?? m.strand ?? 'x'));
  return strandFirst.find(l => !isLearned(m, l.id)) ?? LESSONS.find(l => !isLearned(m, l.id)) ?? null;
}

/** Shells for learning a trick the first time. */
export const LEARN_SHELLS = 8;
/** Finish a lesson (call inside game.update): the trick is saved, its three right answers warm the eggs,
 *  and the first time earns shells. (It isn't a practice session: it doesn't finish a map practice stop.) */
export function finishLesson(p: Profile, id: string, now = Date.now()): { first: boolean; shells: number; eggsReady: Rarity[] } {
  const m = (p.math = mathOf(p));
  const first = !(m.learned ?? []).includes(id);
  if (first) { m.learned = [...(m.learned ?? []), id]; m.learnedOn = { ...(m.learnedOn ?? {}), [id]: dayKey(now) }; }
  const shells = first ? earnShells(p, LEARN_SHELLS) : 0;
  const eggsReady = notePractice(p, 3, false);
  return { first, shells, eggsReady };
}

/** The trick that's due its quick check: learned on an earlier day, not checked yet (the oldest first).
 *  (Tricks learned before the checks began have no day, so they never come due.) */
export function checkDue(m: MathProgress, now = Date.now()): Lesson | null {
  const today = dayKey(now), on = m.learnedOn ?? {}, done = new Set(m.checked ?? []);
  const id = (m.learned ?? []).find(x => on[x] && on[x] < today && !done.has(x) && LESSON[x]);
  return id ? LESSON[id] : null;
}
/** The quick check is done (call inside game.update). */
export function markChecked(p: Profile, id: string) {
  const m = (p.math = mathOf(p));
  if (!(m.checked ?? []).includes(id)) m.checked = [...(m.checked ?? []), id];
}

/** A learned trick for a battle card: the buddy's words with the answer left for you to say.
 *  Null if that trick hasn't been learned yet. */
export function learnedTrick(m: MathProgress, f: Fact): { name: string; say: string; lesson: string } | null {
  const l = lessonForFact(f);
  if (!isLearned(m, l.id)) return null;
  const t = trickOf(f);
  return { name: t.name, say: hideAnswer(t.say, f), lesson: l.id };
}
/** Swap the answer for "?": every time if it isn't one of the fact's own numbers, else only the last time. */
export function hideAnswer(text: string, f: Fact): string {
  const ans = String(answerOf(f));
  const parts = text.split(/(\d+)/);
  const own = ans === String(f.a) || ans === String(f.b);
  let last = -1;
  parts.forEach((p, i) => { if (p === ans) last = i; });
  return parts.map((p, i) => (p === ans && (!own || i === last) ? '?' : p)).join('');
}

/** The "your turn" question for a fact, as text: 6 + 2 */
export const askText = sum;
