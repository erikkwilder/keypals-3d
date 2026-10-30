// The math course: four strands, one per operation, each its own string of regions on the 3D islands.
//
//   Times Trail (×)    run the trail: the 2s (with the 0 and 1 rules), 10s, 5s, 4s, then 3s, 9s, 6s, 8s, 7s
//   Plus Peaks (+)     climb: small steps (+0, +1, +2), doubles, tens (make ten, +10, +9), bridging ten
//   Minus Mountain (−) slide down: small steps back, doubles back and tens, from ten, think addition
//   Share Shore (÷)    swim: divide by 2, 10, 5, then 4 and 3, 9 and 6, 8 and 7 (think times)
//
// Facts come in groups, each with a trick the buddy shows on the help card. Every region has a Meet
// lesson, practice, a mix with the groups before it, and a checkpoint run that can be taken first to
// test out. The times tables keep their ids from the first version, so saved progress carries on.

import type { RegionId } from '../engine/course';
import { isRuleFact, type Fact, type Op } from './facts';
import { factLessonTrips } from '../path/lessonTrips';

export type MathRegionId =
  | 'twins' | 'tens' | 'fives' | 'fours' | 'threes' | 'nines' | 'sixes' | 'eights' | 'sevens'
  | 'plus-s' | 'plus-d' | 'plus-t' | 'plus-b'
  | 'minus-s' | 'minus-d' | 'minus-t' | 'minus-b'
  | 'share-a' | 'share-b' | 'share-c' | 'share-d';
/** rules: the 0 and 1 rules. meet: new facts with their trick. practice: the group, a few new facts at
 *  a time. mix: this group with the ones before. check: every fact of the region, no new ones held back.
 *  placement: a sample of everything, to start a new player in the right place. */
export type MathKind = 'rules' | 'meet' | 'practice' | 'mix' | 'check' | 'placement';
/** How the buddy moves on a strand: numbers going up climb, coming down slide, groups of run the trail, sharing swims. */
export type MathMove = 'run' | 'climb' | 'slide' | 'swim';

export type MathLesson = {
  id: string;
  region: MathRegionId | 'start';
  n: number;
  title: string;
  kind: MathKind;
  op: Op;
  /** the fact groups the trip draws from; `learn` are the ones whose new facts are met here */
  groups: string[];
  learn: string[];
  /** times lessons: the tables, as numbers (the first is the one being learned) */
  tables: number[];
  /** the score for three stars (kids; grown-ups need 1.6 times as much) */
  goal: number;
  blurb: string;
  /** how many questions (a curriculum lesson's quick check is short) */
  length?: number;
};

export type MathRegion = {
  id: MathRegionId;
  name: string;
  blurb: string;
  op: Op;
  /** the 3D island it runs on */
  world: RegionId;
  /** the label on its banner: × 2, + 0 1 2, ÷ 2 10 5 */
  chip: string;
  /** the times table it teaches (times regions only) */
  table: number;
  groups: string[];
  lessons: MathLesson[];
};

export type Strand = { op: Op; name: string; move: MathMove; blurb: string; color: string; art: string };
export const STRANDS: Strand[] = [
  { art: 'math/strand-plus.webp', op: '+', name: 'Plus Peaks', move: 'climb', blurb: 'Adding to 20: small steps, doubles, tens and making ten.', color: '#3fa7e0' },
  { art: 'math/strand-minus.webp', op: '-', name: 'Minus Mountain', move: 'slide', blurb: 'Taking away within 20: count back, doubles back and thinking addition.', color: '#7c5cf5' },
  { art: 'math/strand-times.webp', op: 'x', name: 'Times Trail', move: 'run', blurb: 'All the times tables, from the 2s to the 7s, with a trick for each.', color: '#ef7d2b' },
  { art: 'math/strand-share.webp', op: '/', name: 'Share Shore', move: 'swim', blurb: 'Dividing: share it out, thinking of the times tables.', color: '#2fa898' },
];
export const STRAND: Record<Op, Strand> = Object.fromEntries(STRANDS.map(s => [s.op, s])) as Record<Op, Strand>;

// ---------- the facts, in groups ----------

/** The order new facts of a table are met in: the easy anchors first, the rule facts (0 and 1) last
 *  because the rules lesson covers them. */
const ORDER = [2, 5, 10, 3, 4, 6, 8, 7, 9, 1, 0];
/** Every fact of a times table: 0 × t to 10 × t, in teaching order. */
export function tableFacts(t: number): Fact[] {
  if (t === 1 || t === 0) return [];
  return ORDER.map(a => ({ a, b: t }));
}

/** The rules lesson's facts: every fact with a 0 or a 1 in it (40 of them), so each square of the
 *  garden's 0 and 1 rows and columns can come up: 0 × 0 and 1 × 0 too. */
export function ruleFacts(): Fact[] {
  const out: Fact[] = [];
  for (const a of [3, 7, 5, 9, 2, 6, 8, 4, 10, 0, 1]) { out.push({ a, b: 1 }); out.push({ a, b: 0 }); }
  for (const b of [4, 6, 8, 3, 2, 5, 7, 9, 10]) { out.push({ a: 1, b }); out.push({ a: 0, b }); }
  return out;
}

const range = (n: number, from = 0) => Array.from({ length: n }, (_, i) => i + from);
/** Which addition group a fact belongs to: small steps, doubles and near doubles, tens, or bridging ten. */
export function plusGroup(f: Fact): string {
  const lo = Math.min(f.a, f.b), hi = Math.max(f.a, f.b);
  if (lo <= 2) return '+s';
  if (hi - lo <= 1) return '+d';
  if (f.a + f.b === 10 || hi >= 9) return '+t';
  return '+b';
}
/** Which subtraction group: small steps back, doubles back and tens, from ten (and −9), or think addition. */
export function minusGroup(f: Fact): string {
  const d = f.a - f.b;
  if (f.b <= 2 || d <= 0) return '-s';
  if (f.a === 2 * f.b || f.b === 10 || d === 10) return '-d';
  if (f.a === 10 || f.b === 9 || d === 9) return '-t';
  return '-b';
}
// all 121 addition facts (0 + 0 to 10 + 10) and the 121 subtraction facts that undo them
const PLUS: Fact[] = range(11).flatMap(a => range(11).map(b => ({ a, b, op: '+' as const })));
const MINUS: Fact[] = range(11).flatMap(b => range(11).map(d => ({ a: b + d, b, op: '-' as const })));
// teaching order inside a group: the gentle ones first
const byEase = (f: Fact) => (isRuleFact(f) ? 100 : 0) + Math.max(f.a, f.b) + (f.op === '-' ? f.b : Math.min(f.a, f.b)) * 0.5;
const sorted = (fs: Fact[]) => [...fs].sort((x, y) => byEase(x) - byEase(y));

/** The curriculum's fact groups on just one lesson's facts (path/lessonSpecs.ts), cut from the strands:
 *  adding and taking away within 5 and within 10, the ten pairs (1 + 9 to 9 + 1), and making ten first
 *  where it really crosses ten (8 + 5; Summit Bridge's 3 + 5 and 3 + 6 don't). */
const LESSON_GROUPS: Record<string, (f: Fact) => boolean> = {
  '+w5': f => f.a + f.b <= 5, '-w5': f => f.a <= 5, '+w10': f => f.a + f.b <= 10, '-w10': f => f.a <= 10,
  '+p10': f => f.a + f.b === 10 && f.a > 0 && f.b > 0, '+bx': f => plusGroup(f) === '+b' && f.a + f.b > 10,
};
export const isLessonGroup = (g: string) => g in LESSON_GROUPS;
/** Every fact of a group, in teaching order. Group ids: x2 (times table), +s +d +t +b, -s -d -t -b, /6 (divide by),
 *  and the lesson groups above. */
export function groupFacts(g: string): Fact[] {
  const op = g[0];
  const only = LESSON_GROUPS[g];
  if (only) return sorted((op === '+' ? PLUS : MINUS).filter(only));
  if (op === 'x') return tableFacts(+g.slice(1));
  if (op === '+') {
    const fs = PLUS.filter(f => plusGroup(f) === g);
    // small steps: +1s, then +2s, then +0s
    return g === '+s' ? [...fs].sort((x, y) => { const k = (f: Fact) => { const lo = Math.min(f.a, f.b); return (lo === 1 ? 0 : lo === 2 ? 20 : 40) + Math.max(f.a, f.b); }; return k(x) - k(y); }) : sorted(fs);
  }
  if (op === '-') return sorted(MINUS.filter(f => minusGroup(f) === g));
  if (op === '/') { const t = +g.slice(1); return ORDER.filter(q => q >= 0).map(q => ({ a: q * t, b: t, op: '/' as const })); }
  return [];
}

// ---------- how hard a fact is, in rungs (skills/types.ts) ----------
// The fact strands have rungs of their own: a fact's rung is how hard it is in its strand, 1 to 6, so the
// same ability scale (skills/ability.ts) works for facts and for fractions alike.
//   +  1 count on 0, 1, 2 · 2 doubles and near doubles · 3 making ten, plus 10 and plus 9 · 4 bridging
//      ten to 11 · 5 bridging to 12 · 6 bridging to 13 and 14 (8 + 6, 7 + 6)
//   −  its own families: 1 count back · 2 doubles back and take ten · 3 from ten, take 9 · 4-6 think
//      addition, by how big the number taken from is (to 11, 12-13, 14-15)
//   ×  by the easier of its two tables: 1 the 0s, 1s, 2s and 10s · 2 the 5s · 3 the 3s and 4s · 4 the 6s
//      and 9s · 5 the 7s and 8s; one rung more when both numbers are 3 or more and it's 40 or more (6 × 7,
//      8 × 8 are 6)
//   ÷  as the times fact that undoes it
const TABLE_RUNG: Record<number, number> = { 0: 1, 1: 1, 2: 1, 10: 1, 5: 2, 3: 3, 4: 3, 6: 4, 9: 4, 7: 5, 8: 5 };
export function factRung(f: Fact): number {
  const op = f.op ?? 'x';
  if (op === '+') { const g = plusGroup(f), s = f.a + f.b; return g === '+s' ? 1 : g === '+d' ? 2 : g === '+t' ? 3 : s <= 11 ? 4 : s <= 12 ? 5 : 6; }
  if (op === '-') { const g = minusGroup(f); return g === '-s' ? 1 : g === '-d' ? 2 : g === '-t' ? 3 : f.a <= 11 ? 4 : f.a <= 13 ? 5 : 6; }
  const [a, b] = op === '/' ? [f.b, f.b ? f.a / f.b : 0] : [f.a, f.b];
  const easy = Math.min(TABLE_RUNG[a] ?? 5, TABLE_RUNG[b] ?? 5);
  return Math.min(6, easy + (a >= 3 && b >= 3 && a * b >= 40 ? 1 : 0));
}
/** What a fact trip's rung means besides which facts come up most (math/picker.ts): how much of the rest
 *  of the strand is mixed back in, whether the dot picture shows with the question, and how quick counts as
 *  quick (times the grown-ups' setting) for the ability. */
export type FactRungSpec = { older: number; dots: boolean; speed: number };
export const FACT_RUNGS: FactRungSpec[] = [
  { older: 0, dots: true, speed: 1.5 },
  { older: 0.05, dots: false, speed: 1.3 },
  { older: 0.1, dots: false, speed: 1.15 },
  { older: 0.2, dots: false, speed: 1 },
  { older: 0.3, dots: false, speed: 0.9 },
  { older: 0.4, dots: false, speed: 0.8 },
];
export const factRungSpec = (rung: number) => FACT_RUNGS[Math.max(1, Math.min(6, Math.round(rung))) - 1];

// ---------- tricks: what the buddy says on the help card ----------

/** Each times table's trick. */
export const TRICK: Record<number, { name: string; say: (a: number) => string }> = {
  0: { name: 'Times zero', say: () => 'Zero groups of anything is nothing at all: always 0.' },
  1: { name: 'Times one', say: a => `One group of ${a} is just ${a}. Times 1 stays the same.` },
  2: { name: 'Doubles', say: a => `Times 2 is a double: ${a} + ${a} = ${a * 2}.` },
  10: { name: 'Add a zero', say: a => `Times 10: put a zero on the end. ${a} becomes ${a * 10}.` },
  5: { name: 'Half of ten', say: a => `${a} × 10 is ${a * 10}. Times 5 is half of that: ${a * 5}.` },
  4: { name: 'Double, double', say: a => `Double ${a} is ${a * 2}. Double again: ${a * 4}.` },
  3: { name: 'Double and one more', say: a => `Double ${a} is ${a * 2}. One more ${a}: ${a * 3}.` },
  9: { name: 'Ten, take one away', say: a => `${a} × 10 is ${a * 10}. Take away one ${a}: ${a * 9}.` },
  6: { name: 'Five and one more', say: a => `${a} × 5 is ${a * 5}. One more ${a}: ${a * 6}.` },
  8: { name: 'Double, double, double', say: a => `Double ${a} three times: ${a * 2}, ${a * 4}, ${a * 8}.` },
  7: { name: 'Five and two', say: a => `${a} × 5 is ${a * 5}, ${a} × 2 is ${a * 2}. Together: ${a * 7}.` },
};

/** The trick that fits a times fact best: the rules first, then the table it belongs to (or its partner's). */
export function trickFor(f: Fact): { table: number; a: number } {
  if (f.a === 0 || f.b === 0) return { table: 0, a: f.b === 0 ? f.a : f.b };
  if (f.b === 1) return { table: 1, a: f.a };
  if (f.a === 1) return { table: 1, a: f.b };
  const easy = [2, 10, 5, 4, 3, 9, 6, 8, 7];
  const ia = easy.indexOf(f.a), ib = easy.indexOf(f.b);
  if (ib >= 0 && (ia < 0 || ib <= ia)) return { table: f.b, a: f.a };
  if (ia >= 0) return { table: f.a, a: f.b };
  return { table: f.b, a: f.a };
}

/** Any fact's trick, in words: its name and what the buddy says. */
export function trickOf(f: Fact): { name: string; say: string } {
  const op = f.op ?? 'x', { a, b } = f;
  if (op === 'x') { const t = trickFor(f); const tr = TRICK[t.table]; return { name: tr?.name ?? 'Times', say: (a !== t.a || b !== t.table ? `${a} × ${b} is the same as ${t.a} × ${t.table}. ` : '') + (tr?.say(t.a) ?? '') }; }
  if (op === '+') {
    const lo = Math.min(a, b), hi = Math.max(a, b), s = a + b;
    if (lo === 0) return { name: 'Plus zero', say: `Adding 0 changes nothing: ${hi} stays ${hi}.` };
    if (lo <= 2) return { name: 'Count on', say: `Start at ${hi} and count on ${lo}: ${range(lo, hi + 1).join(', ')}.` };
    if (hi === lo) return { name: 'Doubles', say: `Double ${a} is ${s}.` };
    if (hi - lo === 1) return { name: 'Near doubles', say: `${lo} + ${lo} = ${lo * 2}, and one more is ${s}.` };
    if (s === 10) return { name: 'Make ten', say: `${a} and ${b} are a ten pair: they make 10.` };
    if (hi === 10) return { name: 'Plus ten', say: `Ten and ${lo} is ${s}: a 1 in front of the ${lo}.` };
    if (hi === 9) return { name: 'Plus nine', say: `Add 10, then take 1 away: ${lo} + 10 = ${lo + 10}, so ${lo} + 9 = ${s}.` };
    const need = 10 - hi;
    return { name: 'Make ten first', say: `${hi} + ${need} = 10, then ${lo - need} more: ${s}.` };
  }
  if (op === '-') {
    const d = a - b;
    if (b === 0) return { name: 'Take away zero', say: `Take nothing away: ${a} stays ${a}.` };
    if (d === 0) return { name: 'All gone', say: `Take away all of it: ${a} − ${a} = 0.` };
    if (b <= 2) return { name: 'Count back', say: `Start at ${a} and count back ${b}: ${range(b, d).reverse().join(', ')}.` };
    if (a === 2 * b) return { name: 'Doubles back', say: `${b} + ${b} = ${a}, so ${a} − ${b} = ${b}.` };
    if (b === 10) return { name: 'Take away ten', say: `Take away 10: ${a} becomes ${d}.` };
    if (d === 10) return { name: 'The ten is left', say: `${a} is 10 and ${b}. Take the ${b} away: 10 is left.` };
    if (a === 10) return { name: 'Ten pairs', say: `${b} and ${d} make 10, so 10 − ${b} = ${d}.` };
    if (b === 9) return { name: 'Take ten, give one back', say: `${a} − 10 = ${a - 10}, give 1 back: ${d}.` };
    return { name: 'Think addition', say: `${b} + what = ${a}? ${b} + ${d} = ${a}, so ${a} − ${b} = ${d}.` };
  }
  const q = b ? a / b : 0;
  if (b === 1) return { name: 'Share into one', say: `One group gets everything: ${a} ÷ 1 = ${a}.` };
  if (a === 0) return { name: 'Nothing to share', say: `Nothing shared out is nothing each: 0.` };
  if (a === b) return { name: 'One each', say: `${a} shared into ${a} groups: 1 each.` };
  return { name: 'Think times', say: `What times ${b} makes ${a}? ${q} × ${b} = ${a}, so ${a} ÷ ${b} = ${q}.` };
}

// ---------- the regions ----------

const L = (region: MathLesson['region'], n: number, title: string, kind: MathKind, op: Op, groups: string[], learn: string[], goal: number, blurb: string): MathLesson =>
  ({ id: `${region}-${n}`, region, n, title, kind, op, groups, learn, tables: op === 'x' ? groups.filter(g => g[0] === 'x').map(g => +g.slice(1)) : [], goal, blurb });

/** A times table's region: meet, practice, a mix with the tables before, the checkpoint run. */
function timesRegion(id: MathRegionId, t: number, name: string, blurb: string, world: RegionId, before: number[], mixTitle: string, goals = [12, 14, 15, 16]): MathRegion {
  const g = `x${t}`, prev = before.map(x => `x${x}`);
  return { id, name, blurb, op: 'x', world, chip: `× ${t}`, table: t, groups: [g], lessons: [
    L(id, 1, `Meet the ${t}s`, 'meet', 'x', [g], [g], goals[0], `${TRICK[t].name}: ${TRICK[t].say(6)}`),
    L(id, 2, `${t}s Practice`, 'practice', 'x', [g], [g], goals[1], `More ${t}s, a few new ones at a time.`),
    L(id, 3, mixTitle, 'mix', 'x', [g, ...prev.slice(0, 3)], [g], goals[2], 'Everything so far, all mixed up.'),
    L(id, 4, `${name} Run`, 'check', 'x', [g], [g], goals[3], `Every ${t}s fact. Already know them? Start here.`),
  ] };
}
/** An addition, subtraction or division region. */
function opRegion(id: MathRegionId, op: Op, name: string, chip: string, blurb: string, world: RegionId, groups: string[], before: string[], meet: string, goals = [12, 14, 15, 16]): MathRegion {
  return { id, name, blurb, op, world, chip, table: 0, groups, lessons: [
    L(id, 1, `Meet ${name}`, 'meet', op, groups, groups, goals[0], meet),
    L(id, 2, `${name} Practice`, 'practice', op, groups, groups, goals[1], 'More of them, a few new ones at a time.'),
    L(id, 3, `${name} Mix`, 'mix', op, [...groups, ...before], groups, goals[2], 'These and everything before, all mixed up.'),
    L(id, 4, `${name} Run`, 'check', op, groups, groups, goals[3], 'Every one of them. Already know them? Start here.'),
  ] };
}

const TWINS: MathRegion = { id: 'twins', name: 'Twin Bridges', blurb: 'Doubles up in the treetops: the 2s.', op: 'x', world: 'treetops', chip: '× 2', table: 2, groups: ['x2'], lessons: [
  L('twins', 1, 'Zero and One', 'rules', 'x', ['x1', 'x0'], [], 14, 'Two rules that work for every number: times 1 stays the same, times 0 is always 0.'),
  L('twins', 2, 'Meet the 2s', 'meet', 'x', ['x2'], ['x2'], 12, 'Times 2 is a double. 6 × 2 is 6 + 6.'),
  L('twins', 3, '2s Practice', 'practice', 'x', ['x2'], ['x2'], 14, 'More doubles, a few new ones at a time.'),
  L('twins', 4, 'Twin Bridges Run', 'check', 'x', ['x2'], ['x2'], 16, 'Every 2s fact. Already know them? Start here.'),
] };

export const MATH_REGIONS: MathRegion[] = [
  // Plus Peaks: climbing the cliffs
  opRegion('plus-s', '+', 'Little Steps', '+ 0 1 2', 'Start the climb: plus 1, plus 2, plus 0.', 'cliffs', ['+s'], [], 'Plus 1 is the next number. Plus 2 counts on two. Plus 0 changes nothing.', [16, 18, 20, 22]),
  opRegion('plus-d', '+', 'Double Ledge', '+ doubles', 'Doubles and near doubles: 6 + 6, then 6 + 7.', 'cliffs', ['+d'], ['+s'], 'Doubles are easy to see: 6 + 6 = 12. Near doubles are one more: 6 + 7 = 13.', [14, 16, 18, 20]),
  opRegion('plus-t', '+', 'Ten Tower', '+ 10 9', 'Ten pairs, plus 10 and plus 9.', 'cliffs', ['+t'], ['+d', '+s'], 'Ten pairs make 10 (7 and 3). Plus 10 puts a 1 in front. Plus 9 is plus 10, take 1.', [14, 16, 17, 19]),
  opRegion('plus-b', '+', 'Summit Bridge', '+ to 20', 'Bridge through ten: 8 + 5 is 8 + 2 + 3.', 'cliffs', ['+b'], ['+t', '+d', '+s'], 'Make ten first: 8 + 5 is 8 + 2 (that is 10) and 3 more, 13.', [12, 14, 15, 17]),
  // Minus Mountain: sliding down the snowy ridge
  opRegion('minus-s', '-', 'Gentle Slope', '− 0 1 2', 'Count back 1 and 2, take away 0, and all of it.', 'ridge', ['-s'], [], 'Take away 1 is the number before. Take away 2 counts back two.', [16, 18, 20, 22]),
  opRegion('minus-d', '-', 'Double Drop', '− doubles', 'Doubles back (14 − 7) and take away ten.', 'ridge', ['-d'], ['-s'], 'If 7 + 7 = 14, then 14 − 7 = 7. Take away 10: 16 becomes 6.', [14, 16, 18, 20]),
  opRegion('minus-t', '-', 'Ten Trail', '− from 10', 'Ten pairs backwards, and take away 9.', 'ridge', ['-t'], ['-d', '-s'], '3 and 7 make 10, so 10 − 3 = 7. Take away 9: take 10, give 1 back.', [14, 16, 17, 19]),
  opRegion('minus-b', '-', 'Big Run', '− to 20', 'Think addition: 13 − 5? 5 + 8 = 13.', 'ridge', ['-b'], ['-t', '-d', '-s'], 'Turn it around: 13 − 5 asks what goes with 5 to make 13. 5 + 8 = 13, so 8.', [12, 14, 15, 17]),
  // the Times Trail: running the islands
  TWINS,
  timesRegion('tens', 10, 'Ten Cliffs', 'Big numbers up on the cliffs: the 10s.', 'cliffs', [2], '2s and 10s', [12, 15, 15, 17]),
  timesRegion('fives', 5, 'High Five Shores', 'Down by the sea: the 5s.', 'shores', [10, 2], '2s, 10s and 5s'),
  timesRegion('fours', 4, 'Hop Hollow', 'Hills and burrows: the 4s.', 'burrows', [5, 10, 2], 'The Big Mix', [11, 13, 14, 15]),
  timesRegion('threes', 3, 'Triple Peaks', 'Up the ridge in threes.', 'ridge', [4, 5, 2], '3s and friends', [11, 13, 14, 15]),
  timesRegion('nines', 9, 'Nine Mile Road', 'Out on the open road: the 9s.', 'road', [3, 10, 5], '9s and friends', [10, 12, 13, 14]),
  timesRegion('sixes', 6, 'Six Sands', 'Back home on the island: the 6s.', 'village', [9, 3, 5], '6s and friends', [10, 12, 13, 14]),
  timesRegion('eights', 8, 'Octo Treetops', 'High in the trees: the 8s.', 'treetops', [6, 4, 9], '8s and friends', [10, 12, 13, 14]),
  timesRegion('sevens', 7, 'Seven Summits', 'The last table: the 7s.', 'cliffs', [8, 6, 9], 'Every Table', [10, 11, 12, 13]),
  // Share Shore: swimming the bay
  opRegion('share-a', '/', 'Splash Cove', '÷ 2 10 5', 'Share by 2, 10 and 5 (and the ÷1 rule).', 'shores', ['/2', '/10', '/5'], [], 'Think times: 30 ÷ 5 asks what times 5 makes 30. 6 × 5 = 30, so 6.', [12, 14, 15, 16]),
  opRegion('share-b', '/', 'Shell Bay', '÷ 4 3', 'Share by 4 and by 3.', 'shores', ['/4', '/3'], ['/2', '/10', '/5'], 'Halve and halve again for ÷ 4. For ÷ 3, think of the 3s: 21 ÷ 3 = 7.', [11, 13, 14, 15]),
  opRegion('share-c', '/', 'Kelp Reef', '÷ 9 6', 'Share by 9 and by 6.', 'shores', ['/9', '/6'], ['/4', '/3', '/5'], 'Think of the 9s and the 6s: 54 ÷ 9 = 6 because 6 × 9 = 54.', [10, 12, 13, 14]),
  opRegion('share-d', '/', 'Deep Lagoon', '÷ 8 7', 'Share by 8 and by 7: the last ones.', 'shores', ['/8', '/7'], ['/9', '/6', '/4'], 'Think of the 8s and the 7s: 56 ÷ 7 = 8 because 8 × 7 = 56.', [10, 11, 12, 13]),
];

/** The placement trips, one per strand: a sample of the first regions, to skip ahead. The times one keeps its old id. */
export const PLACEMENT = L('start', 1, 'Show What You Know', 'placement', 'x', ['x2', 'x10', 'x5', 'x4'], [], 14, 'A quick mix of the first tables. Answer what you know and skip ahead!');
export const PLACEMENTS: Record<Op, MathLesson> = {
  x: PLACEMENT,
  '+': { ...L('start', 2, 'Show What You Know', 'placement', '+', ['+s', '+d', '+t', '+b'], [], 18, 'A quick mix of adding. Answer what you know and skip ahead!'), id: 'start-plus' },
  '-': { ...L('start', 3, 'Show What You Know', 'placement', '-', ['-s', '-d', '-t', '-b'], [], 18, 'A quick mix of taking away. Answer what you know and skip ahead!'), id: 'start-minus' },
  '/': { ...L('start', 4, 'Show What You Know', 'placement', '/', ['/2', '/4', '/9', '/8'], [], 14, 'A quick mix of sharing. Answer what you know and skip ahead!'), id: 'start-share' },
};

export const MATH_LESSONS: MathLesson[] = MATH_REGIONS.flatMap(r => r.lessons);
/** the curriculum's fact lesson trips: on just a lesson's facts (within 5, ten pairs...), not island stops */
export const PATH_FACT_TRIPS: MathLesson[] = factLessonTrips(op => MATH_REGIONS.find(r => r.op === op)?.lessons[0]?.goal ?? 14,
  t => { const l = MATH_LESSONS.find(x => x.id === t); return l ? { op: l.op, groups: l.kind === 'rules' ? ['x1', 'x0'] : l.groups } : null; });
export const MATH_LESSON: Record<string, MathLesson> = Object.fromEntries([...Object.values(PLACEMENTS), ...MATH_LESSONS, ...PATH_FACT_TRIPS].map(l => [l.id, l]));
export const MATH_REGION: Record<MathRegionId, MathRegion> = Object.fromEntries(MATH_REGIONS.map(r => [r.id, r])) as Record<MathRegionId, MathRegion>;
export const mathLessonIndex = (id: string) => MATH_LESSONS.findIndex(l => l.id === id);
/** A strand's regions, in order. */
export const regionsOf = (op: Op) => MATH_REGIONS.filter(r => r.op === op);
/** The 3D island a lesson runs on (the placement trips start on the strand's first island). */
export const worldOf = (l: MathLesson): RegionId => (l.region === 'start' ? (regionsOf(l.op)[0]?.world ?? 'village') : MATH_REGION[l.region].world);
/** Metres moved for each answer: a long stretch of trail, a sled run, a stroke, a step up the cliff. */
export const STRIDE: Record<MathMove, number> = { run: 9, slide: 6, swim: 2.2, climb: 1.1 };
/** How the buddy moves on a lesson: every strand has all four, so nobody misses the climbing because they
 *  aren't doing subtraction. A region's four trips go round run, climb, swim and sled, starting one
 *  further along in each region. */
const CYCLE: MathMove[] = ['run', 'climb', 'swim', 'slide'];
export function moveOf(l: MathLesson): MathMove {
  if (l.region === 'start') return 'run';
  const i = regionsOf(l.op).findIndex(r => r.id === l.region);
  return CYCLE[(Math.max(0, i) + l.n - 1) % 4];
}
export const MOVE_NAME: Record<MathMove, string> = { run: 'Run', climb: 'Climb', swim: 'Swim', slide: 'Sled' };
/** The times tables, in the order they're learned. */
export const TABLES = regionsOf('x').map(r => r.table);

/** The facts a lesson draws on: its groups' facts (the rules lesson: the rule facts). */
export function lessonFacts(l: MathLesson): Fact[] {
  if (l.kind === 'rules') return ruleFacts();
  return l.groups.flatMap(groupFacts);
}
