// The Times Trail: the math game's course. One table per region, each on one of the 3D islands, in
// the order of the tricks: the 2s (doubles, with the 0 and 1 rules first), the 10s (add a zero), the
// 5s (half of ten), the 4s (double, then double again). Each region has a Meet lesson, practice, a mix
// with the tables before it, and a checkpoint run that can be taken first to test out.

import type { RegionId } from '../engine/course';
import type { Fact } from './facts';

export type MathRegionId = 'twins' | 'tens' | 'fives' | 'fours';
/** rules: the 0 and 1 rules. meet: new facts with their trick. practice: the table, a few new facts at
 *  a time. mix: this table with the ones before. check: every fact of the table, no new ones held back.
 *  placement: a sample of everything, to start a new player in the right place. */
export type MathKind = 'rules' | 'meet' | 'practice' | 'mix' | 'check' | 'placement';

export type MathLesson = {
  id: string;
  region: MathRegionId | 'start';
  n: number;
  title: string;
  kind: MathKind;
  /** the tables the trip draws from (the first is the one being learned) */
  tables: number[];
  /** the score for three stars (kids; grown-ups need 1.6 times as much) */
  goal: number;
  blurb: string;
};

export type MathRegion = {
  id: MathRegionId;
  name: string;
  blurb: string;
  /** the 3D island it runs on */
  world: RegionId;
  table: number;
  lessons: MathLesson[];
};

/** Each table's trick, as the buddy says it on the help card. */
export const TRICK: Record<number, { name: string; say: (a: number) => string }> = {
  0: { name: 'Times zero', say: () => 'Zero groups of anything is nothing at all: always 0.' },
  1: { name: 'Times one', say: a => `One group of ${a} is just ${a}. Times 1 stays the same.` },
  2: { name: 'Doubles', say: a => `Times 2 is a double: ${a} + ${a} = ${a * 2}.` },
  10: { name: 'Add a zero', say: a => `Times 10: put a zero on the end. ${a} becomes ${a * 10}.` },
  5: { name: 'Half of ten', say: a => `${a} × 10 is ${a * 10}. Times 5 is half of that: ${a * 5}.` },
  4: { name: 'Double, double', say: a => `Double ${a} is ${a * 2}. Double again: ${a * 4}.` },
};

/** The trick that fits a fact best: the rules first, then the table it belongs to (or its partner's). */
export function trickFor(f: Fact): { table: number; a: number } {
  if (f.a === 0 || f.b === 0) return { table: 0, a: f.b === 0 ? f.a : f.b };
  if (f.b === 1) return { table: 1, a: f.a };
  if (f.a === 1) return { table: 1, a: f.b };
  if (TRICK[f.b]) return { table: f.b, a: f.a };
  if (TRICK[f.a]) return { table: f.a, a: f.b };
  return { table: f.b, a: f.a };
}

const L = (region: MathLesson['region'], n: number, title: string, kind: MathKind, tables: number[], goal: number, blurb: string): MathLesson =>
  ({ id: `${region}-${n}`, region, n, title, kind, tables, goal, blurb });

export const PLACEMENT = L('start', 1, 'Show What You Know', 'placement', [2, 10, 5, 4], 14,
  'A quick mix of everything on the trail. Answer what you know and skip ahead!');

export const MATH_REGIONS: MathRegion[] = [
  { id: 'twins', name: 'Twin Bridges', blurb: 'Doubles up in the treetops: the 2s.', world: 'treetops', table: 2, lessons: [
    L('twins', 1, 'Zero and One', 'rules', [1, 0], 14, 'Two rules that work for every number: times 1 stays the same, times 0 is always 0.'),
    L('twins', 2, 'Meet the 2s', 'meet', [2], 12, 'Times 2 is a double. 6 × 2 is 6 + 6.'),
    L('twins', 3, '2s Practice', 'practice', [2], 14, 'More doubles, a few new ones at a time.'),
    L('twins', 4, 'Twin Bridges Run', 'check', [2], 16, 'Every 2s fact. Already know them? Start here.'),
  ] },
  { id: 'tens', name: 'Ten Cliffs', blurb: 'Big numbers up on the cliffs: the 10s.', world: 'cliffs', table: 10, lessons: [
    L('tens', 1, 'Meet the 10s', 'meet', [10], 12, 'Times 10: put a zero on the end. 7 × 10 is 70.'),
    L('tens', 2, '10s Practice', 'practice', [10], 15, 'More tens, a few new ones at a time.'),
    L('tens', 3, '2s and 10s', 'mix', [10, 2], 15, 'Doubles and tens, all mixed up.'),
    L('tens', 4, 'Ten Cliffs Run', 'check', [10], 17, 'Every 10s fact. Already know them? Start here.'),
  ] },
  { id: 'fives', name: 'High Five Shores', blurb: 'Down by the sea: the 5s.', world: 'shores', table: 5, lessons: [
    L('fives', 1, 'Meet the 5s', 'meet', [5], 12, 'Times 5 is half of times 10. 6 × 10 is 60, so 6 × 5 is 30.'),
    L('fives', 2, '5s Practice', 'practice', [5], 14, 'More fives, a few new ones at a time.'),
    L('fives', 3, '2s, 10s and 5s', 'mix', [5, 10, 2], 15, 'Everything so far, all mixed up.'),
    L('fives', 4, 'High Five Run', 'check', [5], 16, 'Every 5s fact. Already know them? Start here.'),
  ] },
  { id: 'fours', name: 'Hop Hollow', blurb: 'Hills and burrows: the 4s.', world: 'burrows', table: 4, lessons: [
    L('fours', 1, 'Meet the 4s', 'meet', [4], 11, 'Times 4: double it, then double again. 7 → 14 → 28.'),
    L('fours', 2, '4s Practice', 'practice', [4], 13, 'More fours, a few new ones at a time.'),
    L('fours', 3, 'The Big Mix', 'mix', [4, 5, 10, 2], 14, 'All four tables, all mixed up.'),
    L('fours', 4, 'Hop Hollow Run', 'check', [4], 15, 'Every 4s fact. Already know them? Start here.'),
  ] },
];

export const MATH_LESSONS: MathLesson[] = MATH_REGIONS.flatMap(r => r.lessons);
export const MATH_LESSON: Record<string, MathLesson> = Object.fromEntries([PLACEMENT, ...MATH_LESSONS].map(l => [l.id, l]));
export const MATH_REGION: Record<MathRegionId, MathRegion> = Object.fromEntries(MATH_REGIONS.map(r => [r.id, r])) as Record<MathRegionId, MathRegion>;
export const mathLessonIndex = (id: string) => MATH_LESSONS.findIndex(l => l.id === id);
/** The 3D island a lesson runs on (the placement trip starts on Home Row Island). */
export const worldOf = (l: MathLesson): RegionId => (l.region === 'start' ? 'village' : MATH_REGION[l.region].world);
/** The tables in round one, in the order they're learned. */
export const TABLES = MATH_REGIONS.map(r => r.table);

/** The order new facts of a table are met in: the easy anchors first, the rule facts (0 and 1) last
 *  because the rules lesson covers them. */
const ORDER = [2, 5, 10, 3, 4, 6, 8, 7, 9, 1, 0];
/** Every fact of a table: 0 × t to 10 × t, in teaching order. */
export function tableFacts(t: number): Fact[] {
  if (t === 1 || t === 0) return [];
  return ORDER.map(a => ({ a, b: t }));
}

/** The rules lesson's facts: a few of the 0s and 1s, both ways round. */
export function ruleFacts(): Fact[] {
  // every fact with a 0 or a 1 in it (40 of them), so each square of the garden's 0 and 1 rows and
  // columns can come up: 0 × 0 and 1 × 0 too
  const out: Fact[] = [];
  for (const a of [3, 7, 5, 9, 2, 6, 8, 4, 10, 0, 1]) { out.push({ a, b: 1 }); out.push({ a, b: 0 }); }
  for (const b of [4, 6, 8, 3, 2, 5, 7, 9, 10]) { out.push({ a: 1, b }); out.push({ a: 0, b }); }
  return out;
}

/** The facts a lesson draws on: its tables' facts (the rules lesson: the rule facts). */
export function lessonFacts(l: MathLesson): Fact[] {
  if (l.kind === 'rules') return ruleFacts();
  return l.tables.flatMap(tableFacts);
}
