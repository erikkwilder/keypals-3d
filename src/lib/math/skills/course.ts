// The lessons of the skill areas, laid out like the fact strands: regions on the islands, each with a
// Meet lesson per new skill, practice, a mix, and a checkpoint run that can be taken first to test out,
// plus a placement trip per area. Records go in the same lesson records as the fact trips (by id).
import type { RegionId } from '../../engine/course';
import type { MathMove } from '../course';
import type { MathProgress } from '../progress';
import type { AreaId } from './types';

export type SkillKind = 'meet' | 'practice' | 'mix' | 'check' | 'placement';
export type SkillLesson = {
  id: string; region: string; area: AreaId; n: number; title: string; kind: SkillKind;
  /** the skills the trip draws on; `learn` are the ones being met here */
  skills: string[]; learn: string[];
  /** the score for three stars (kids): skills take longer than facts */
  goal: number; blurb: string;
  move: MathMove; world: RegionId;
};
export type SkillRegion = { id: string; area: AreaId; name: string; blurb: string; world: RegionId; chip: string; skills: string[]; lessons: SkillLesson[];
  /** its own painted strip for the map (else the world's: regions/<world>.webp) */
  art?: string };

const L = (r: Omit<SkillRegion, 'lessons'>, n: number, title: string, kind: SkillKind, skills: string[], learn: string[], goal: number, move: MathMove, blurb: string): SkillLesson =>
  ({ id: `${r.id}-${n}`, region: r.id, area: r.area, n, title, kind, skills, learn, goal, blurb, move, world: r.world });

function region(r: Omit<SkillRegion, 'lessons'>, lessons: [string, SkillKind, string[], string[], number, MathMove, string][]): SkillRegion {
  return { ...r, lessons: lessons.map(([t, k, s, l, g, mv, b], i) => L(r, i + 1, t, k, s, l, g, mv, b)) };
}

// Fractions, grades 3 to 5, on three islands: the Pie Pantry (what a fraction is: parts, one piece, sets,
// the number line, comparing), Baker's Bridge (equal fractions, adding and taking away, mixed numbers) and
// the Waterfall Mill (times a fraction, different bottoms).
const PIE_SKILLS = ['fr-name', 'fr-unit', 'fr-set', 'fr-line', 'fr-compare'];
const BAKER_SKILLS = ['fr-equal', 'fr-add', 'fr-sub', 'fr-mixed'];
const MILL_SKILLS = ['fr-times', 'fr-unlike'];
const PIE: Omit<SkillRegion, 'lessons'> = { id: 'frac-a', area: 'fractions', name: 'Pie Pantry', blurb: 'What a fraction is: equal parts, one piece, part of a set, the number line, and which is bigger.', world: 'village', chip: '½ ¾', skills: PIE_SKILLS };
const BAKER: Omit<SkillRegion, 'lessons'> = { id: 'frac-b', area: 'fractions', name: "Baker's Bridge", blurb: 'Equal fractions, adding and taking away slices, and mixed numbers.', world: 'treetops', chip: '2/4 = ½', skills: BAKER_SKILLS };
const MILL: Omit<SkillRegion, 'lessons'> = { id: 'frac-c', area: 'fractions', name: 'Waterfall Mill', blurb: 'A whole number times a fraction, and adding fractions with different bottoms.', world: 'shores', chip: '½ + ¼', skills: MILL_SKILLS };
// Place value and big numbers, K to 4, in Counting Caves: Counting Steps (counting on, number names, skip
// counting, tens and ones), the Gem Mine (hundreds, comparing, adding and taking away with blocks) and the
// Big Vault (rounding, numbers to a million).
const STEPS_SKILLS = ['pv-count', 'pv-skip', 'pv-tens'];
const MINE_SKILLS = ['pv-hundreds', 'pv-compare', 'pv-add', 'pv-sub'];
const VAULT_SKILLS = ['pv-round', 'pv-big'];
const STEPS: Omit<SkillRegion, 'lessons'> = { id: 'place-a', area: 'place', name: 'Counting Steps', blurb: 'Counting on to 120, number names, skip counting, and tens and ones.', world: 'burrows', chip: '10s', skills: STEPS_SKILLS };
const MINE: Omit<SkillRegion, 'lessons'> = { id: 'place-b', area: 'place', name: 'The Gem Mine', blurb: 'Hundreds, bigger or smaller, and adding and taking away with blocks.', world: 'cliffs', chip: '100s', skills: MINE_SKILLS };
const VAULT: Omit<SkillRegion, 'lessons'> = { id: 'place-c', area: 'place', name: 'The Big Vault', blurb: 'Rounding, and numbers all the way to a million.', world: 'ridge', chip: '1,000s', skills: VAULT_SKILLS };
const PLACE_REGIONS: SkillRegion[] = [
  region(STEPS, [
    ['Count On', 'meet', ['pv-count'], ['pv-count'], 9, 'run', 'After 9 ones, the tens go up by one: 39, 40, 41.'],
    ['Skip Counting', 'meet', ['pv-skip', 'pv-count'], ['pv-skip'], 9, 'climb', 'Count by 2s, 5s, 10s and 100s: big jumps, same pattern.'],
    ['Tens and Ones', 'meet', ['pv-tens', 'pv-count'], ['pv-tens'], 8, 'swim', 'A rod is ten cubes. 47 is 4 rods and 7 cubes: 4 tens and 7 ones.'],
    ['Counting Mix', 'mix', STEPS_SKILLS, [], 8, 'slide', 'Everything so far, all mixed up.'],
    ['Counting Steps Run', 'check', STEPS_SKILLS, [], 9, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(MINE, [
    ['Hundreds', 'meet', ['pv-hundreds', 'pv-tens'], ['pv-hundreds'], 7, 'climb', 'A flat is a hundred: ten rods. 345 is 3 hundreds, 4 tens and 5 ones.'],
    ['Bigger or Smaller', 'meet', ['pv-compare', 'pv-hundreds'], ['pv-compare'], 8, 'run', 'Look at the biggest place first. The open mouth eats the bigger number.'],
    ['Adding with Blocks', 'meet', ['pv-add', 'pv-tens'], ['pv-add'], 5, 'swim', 'Ones with ones, tens with tens. Ten ones? Trade them for a ten.'],
    ['Taking with Blocks', 'meet', ['pv-sub', 'pv-add'], ['pv-sub'], 5, 'slide', 'Not enough ones? Break a ten into ten ones first.'],
    ['Gem Mine Mix', 'mix', MINE_SKILLS, [], 6, 'run', 'Everything on this island, all mixed up.'],
    ['Gem Mine Run', 'check', MINE_SKILLS, [], 6, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(VAULT, [
    ['Rounding', 'meet', ['pv-round', 'pv-hundreds'], ['pv-round'], 6, 'slide', 'Look at the next digit: 5 or more rounds up, 4 or less rounds down.'],
    ['Big Numbers', 'meet', ['pv-big', 'pv-hundreds'], ['pv-big'], 5, 'climb', 'Every place is worth ten times the one on its right, all the way to a million.'],
    ['Vault Practice', 'practice', ['pv-big', 'pv-round', 'pv-add', 'pv-sub'], [], 5, 'swim', 'The new ones again, with adding and taking away.'],
    ['Big Vault Mix', 'mix', [...VAULT_SKILLS, ...MINE_SKILLS], [], 5, 'run', 'This island and the last, all mixed up.'],
    ['Big Vault Run', 'check', VAULT_SKILLS, [], 6, 'slide', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
// Decimals and money, grades 2 to 5, on three islands: Coin Corner (counting coins, making amounts, change),
// the Chocolate Stall (tenths and hundredths as a bar and a slab, and which is bigger) and the Counting House
// (adding and taking away decimals, rounding, and times or divide by 10 and 100).
const COIN_SKILLS = ['dm-coins', 'dm-make', 'dm-change'];
const CHOC_SKILLS = ['dm-tenths', 'dm-hund', 'dm-compare'];
const HOUSE_SKILLS = ['dm-add', 'dm-sub', 'dm-round', 'dm-ten'];
const COIN: Omit<SkillRegion, 'lessons'> = { id: 'dec-a', area: 'decimals', name: 'Coin Corner', blurb: 'Pennies, nickels, dimes and quarters: count them, make amounts, and give change.', world: 'village', chip: '25¢ 10¢', skills: COIN_SKILLS };
const CHOC: Omit<SkillRegion, 'lessons'> = { id: 'dec-b', area: 'decimals', name: 'Chocolate Stall', blurb: 'Tenths and hundredths: a bar of 10, a slab of 100, and which decimal is bigger.', world: 'treetops', chip: '0.7 0.35', skills: CHOC_SKILLS };
const HOUSE: Omit<SkillRegion, 'lessons'> = { id: 'dec-c', area: 'decimals', name: 'Counting House', blurb: 'Adding and taking away decimals, rounding, and times or divide by 10 and 100.', world: 'shores', chip: '1.25 + 0.5', skills: HOUSE_SKILLS };
const DECIMAL_REGIONS = [
  region(COIN, [
    ['Meet the Coins', 'meet', ['dm-coins'], ['dm-coins'], 5, 'run', 'Penny 1¢, nickel 5¢, dime 10¢, quarter 25¢. Count the biggest first.'],
    ['Make It', 'meet', ['dm-make', 'dm-coins'], ['dm-make'], 4, 'swim', 'Make an amount: take the biggest coin that fits, then the next.'],
    ['Count Up for Change', 'meet', ['dm-change', 'dm-coins'], ['dm-change'], 5, 'climb', 'Change? Start at the price and count up to what was paid.'],
    ['Coin Corner Mix', 'mix', COIN_SKILLS, [], 5, 'slide', 'Everything so far, all mixed up.'],
    ['Coin Corner Run', 'check', COIN_SKILLS, [], 6, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(CHOC, [
    ['Tenths', 'meet', ['dm-tenths'], ['dm-tenths'], 6, 'run', 'A bar of 10 pieces: each piece is a tenth, 0.1. Seven pieces is 0.7.'],
    ['Hundredths', 'meet', ['dm-hund', 'dm-tenths'], ['dm-hund'], 5, 'swim', 'A slab of 100 squares: each is a hundredth, 0.01, like a cent in a dollar.'],
    ['Bigger or Smaller', 'meet', ['dm-compare', 'dm-hund'], ['dm-compare'], 6, 'climb', 'Line up the points: 0.4 is 0.40, and that beats 0.38.'],
    ['Chocolate Mix', 'mix', CHOC_SKILLS, [], 6, 'slide', 'Everything on this island, all mixed up.'],
    ['Chocolate Stall Run', 'check', CHOC_SKILLS, [], 6, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(HOUSE, [
    ['Adding Decimals', 'meet', ['dm-add', 'dm-hund'], ['dm-add'], 5, 'climb', 'Line up the points, add like whole numbers, and keep the point.'],
    ['Taking Away', 'meet', ['dm-sub', 'dm-add'], ['dm-sub'], 5, 'swim', 'Line up the points (fill gaps with zeros), then take away.'],
    ['Rounding', 'meet', ['dm-round', 'dm-compare'], ['dm-round'], 5, 'slide', 'Look next door: 5 or more goes up, 4 or less stays.'],
    ['Times Ten', 'meet', ['dm-ten', 'dm-tenths'], ['dm-ten'], 5, 'run', 'Times 10 slides every digit one place bigger; divide slides it smaller.'],
    ['Counting House Mix', 'mix', [...HOUSE_SKILLS, 'dm-compare'], [], 5, 'climb', 'This island and the last, all mixed up.'],
    ['Counting House Run', 'check', HOUSE_SKILLS, [], 5, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
// Measurement and time, grades 1 to 6, on three islands: Tick-Tock Square (o'clock and half past,
// longer or shorter, five minutes, a ruler), the Measuring Mill (to the minute, how long things take,
// scales and jugs) and the Builder's Yard (area, perimeter, changing units, volume, units and rates).
const TICK_SKILLS = ['ms-hour', 'ms-compare', 'ms-five', 'ms-ruler'];
const MILL_M_SKILLS = ['ms-minute', 'ms-elapsed', 'ms-mass'];
const YARD_SKILLS = ['ms-area', 'ms-perim', 'ms-convert', 'ms-volume', 'ms-ratio'];
const TICK: Omit<SkillRegion, 'lessons'> = { id: 'meas-a', area: 'measure', name: 'Tick-Tock Square', blurb: "O'clock and half past, longer or shorter, five minutes, and a ruler.", world: 'village', chip: '3:00', skills: TICK_SKILLS, art: 'math/measure/region-time.webp' };
const MILL_M: Omit<SkillRegion, 'lessons'> = { id: 'meas-b', area: 'measure', name: 'Measuring Mill', blurb: 'Time to the minute, how long things take, and scales and jugs.', world: 'shores', chip: 'kg mL', skills: MILL_M_SKILLS, art: 'math/measure/region-length.webp' };
const YARD: Omit<SkillRegion, 'lessons'> = { id: 'meas-c', area: 'measure', name: "Builder's Yard", blurb: 'Area, perimeter, changing units, the volume of a box, and rates.', world: 'cliffs', chip: '4 × 3', skills: YARD_SKILLS, art: 'math/measure/region-build.webp' };
const MEASURE_REGIONS = [
  region(TICK, [
    ["O'clock", 'meet', ['ms-hour'], ['ms-hour'], 6, 'run', "The short hand says the hour. The long hand on 12 is o'clock, on 6 is half past."],
    ['Longer or Shorter', 'meet', ['ms-compare', 'ms-hour'], ['ms-compare'], 6, 'swim', 'Line up the ends to compare. Count cubes end to end, with no gaps.'],
    ['Five Minutes', 'meet', ['ms-five', 'ms-hour'], ['ms-five'], 5, 'climb', 'Every number on the clock is 5 more minutes: count by fives.'],
    ['Use a Ruler', 'meet', ['ms-ruler', 'ms-compare'], ['ms-ruler'], 5, 'slide', 'Line one end up with 0, then read the number at the other end.'],
    ['Tick-Tock Mix', 'mix', TICK_SKILLS, [], 5, 'run', 'Everything so far, all mixed up.'],
    ['Tick-Tock Square Run', 'check', TICK_SKILLS, [], 6, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(MILL_M, [
    ['To the Minute', 'meet', ['ms-minute', 'ms-five'], ['ms-minute'], 5, 'run', 'Count by fives to the last number, then on by ones for the little marks.'],
    ['How Long?', 'meet', ['ms-elapsed', 'ms-minute'], ['ms-elapsed'], 4, 'climb', "Jump to the next o'clock, then add the minutes that are left."],
    ['Weigh and Pour', 'meet', ['ms-mass'], ['ms-mass'], 5, 'swim', 'Find the number just below, then count the marks up.'],
    ['Mill Mix', 'mix', [...MILL_M_SKILLS, 'ms-five'], [], 5, 'slide', 'This island and the last, all mixed up.'],
    ['Measuring Mill Run', 'check', MILL_M_SKILLS, [], 5, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(YARD, [
    ['Area', 'meet', ['ms-area'], ['ms-area'], 5, 'climb', 'Squares come in equal rows: length times width.'],
    ['Perimeter', 'meet', ['ms-perim', 'ms-area'], ['ms-perim'], 5, 'run', 'All the way round the fence: add every side.'],
    ['Change the Units', 'meet', ['ms-convert'], ['ms-convert'], 5, 'swim', 'Big unit to small: times. Small unit to big: divide.'],
    ['Volume', 'meet', ['ms-volume', 'ms-area'], ['ms-volume'], 4, 'slide', 'Cubes in the bottom layer, times the number of layers.'],
    ['Units and Rates', 'meet', ['ms-ratio', 'ms-convert'], ['ms-ratio'], 4, 'climb', 'Find how much for one first, then times.'],
    ["Builder's Mix", 'mix', YARD_SKILLS, [], 4, 'run', 'Everything on this island, all mixed up.'],
    ["Builder's Yard Run", 'check', YARD_SKILLS, [], 5, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
export const SKILL_REGIONS: SkillRegion[] = [
  region(PIE, [
    ['Meet Fractions', 'meet', ['fr-name'], ['fr-name'], 6, 'run', 'The bottom number is how many equal parts; the top is how many you have.'],
    ['One Piece', 'meet', ['fr-unit', 'fr-name'], ['fr-unit'], 6, 'swim', 'One of 4 equal parts is 1/4. And 3/4 is three of those pieces.'],
    ['Part of a Set', 'meet', ['fr-set', 'fr-name'], ['fr-set'], 6, 'climb', '2 of 6 cupcakes is 2/6. And 1/3 of 12? Share 12 into 3 groups.'],
    ['On the Line', 'meet', ['fr-line', 'fr-unit'], ['fr-line'], 5, 'slide', 'Cut the space from 0 to 1 into equal jumps, then count the jumps.'],
    ['Bigger or Smaller', 'meet', ['fr-compare', 'fr-name'], ['fr-compare'], 6, 'climb', 'Same size pieces? More is more. One piece each? Fewer cuts, bigger piece.'],
    ['Pie Pantry Mix', 'mix', PIE_SKILLS, [], 6, 'run', 'Everything so far, all mixed up.'],
    ['Pie Pantry Run', 'check', PIE_SKILLS, [], 7, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(BAKER, [
    ['Equal Shares', 'meet', ['fr-equal', 'fr-name'], ['fr-equal'], 6, 'run', '1/2 is the same as 2/4: do the same to the top and the bottom.'],
    ['Adding Slices', 'meet', ['fr-add', 'fr-equal'], ['fr-add'], 5, 'slide', 'Same bottom number? Add the tops and keep the bottom.'],
    ['Taking Slices', 'meet', ['fr-sub', 'fr-add'], ['fr-sub'], 5, 'climb', 'Same bottom number? Take away the tops and keep the bottom.'],
    ['Mixed Numbers', 'meet', ['fr-mixed', 'fr-add'], ['fr-mixed'], 5, 'swim', 'Every 4 quarters make a whole: 9/4 is 2 wholes and 1/4.'],
    ["Baker's Mix", 'mix', BAKER_SKILLS, [], 5, 'run', 'Everything on this island, all mixed up.'],
    ["Baker's Bridge Run", 'check', BAKER_SKILLS, [], 6, 'slide', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(MILL, [
    ['Times a Fraction', 'meet', ['fr-times', 'fr-add'], ['fr-times'], 5, 'climb', '3 × 2/5 is three lots of two fifths: times the top, keep the bottom.'],
    ['Different Bottoms', 'meet', ['fr-unlike', 'fr-equal'], ['fr-unlike'], 4, 'swim', "Different size pieces can't be added: make the bottoms match first."],
    ['Mill Practice', 'practice', ['fr-unlike', 'fr-times', 'fr-equal'], [], 4, 'slide', 'The new ones, again, with equal fractions to help.'],
    ['Waterfall Mix', 'mix', [...MILL_SKILLS, 'fr-add', 'fr-sub', 'fr-mixed'], [], 5, 'run', 'This island and the last, all mixed up.'],
    ['Waterfall Mill Run', 'check', MILL_SKILLS, [], 5, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  ...PLACE_REGIONS,
  ...DECIMAL_REGIONS,
  ...MEASURE_REGIONS,
];

export const SKILL_PLACEMENTS: Partial<Record<AreaId, SkillLesson>> = {
  place: { id: 'start-place', region: 'start', area: 'place', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...STEPS_SKILLS, ...MINE_SKILLS, ...VAULT_SKILLS], learn: [], goal: 7, move: 'run', world: 'burrows', blurb: 'A quick mix of counting, tens and hundreds, and big numbers. Answer what you know and skip ahead!' },
  decimals: { id: 'start-decimals', region: 'start', area: 'decimals', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...COIN_SKILLS, ...CHOC_SKILLS, ...HOUSE_SKILLS], learn: [], goal: 5, move: 'run', world: 'village', blurb: 'A quick mix of money and decimals. Answer what you know and skip ahead!' },
  measure: { id: 'start-measure', region: 'start', area: 'measure', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...TICK_SKILLS, ...MILL_M_SKILLS, ...YARD_SKILLS], learn: [], goal: 5, move: 'run', world: 'village', blurb: 'A quick mix of clocks, rulers, scales, area and units. Answer what you know and skip ahead!' },
  fractions: { id: 'start-fractions', region: 'start', area: 'fractions', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...PIE_SKILLS, ...BAKER_SKILLS, ...MILL_SKILLS], learn: [], goal: 6, move: 'run', world: 'village', blurb: 'A quick mix of fractions. Answer what you know and skip ahead!' },
};
/** The Learn episode that teaches each fraction skill (a hook for math/learn.ts: an episode added with
 *  one of these ids can be offered on that skill's Meet lesson, its results and its practice stop). */
export const SKILL_EPISODES: Record<string, string> = {
  'fr-name': 'frac-parts', 'fr-unit': 'frac-one-piece', 'fr-set': 'frac-of-a-set', 'fr-line': 'frac-number-line', 'fr-compare': 'frac-bigger',
  'fr-equal': 'frac-equal', 'fr-add': 'frac-add', 'fr-sub': 'frac-take-away', 'fr-mixed': 'frac-mixed', 'fr-times': 'frac-times', 'fr-unlike': 'frac-unlike',
  // place value: the six Learn episodes in the Crystal Cave Workshop (math/learn.ts)
  'pv-count': 'pv-make-ten', 'pv-skip': 'pv-make-ten', 'pv-tens': 'pv-tens-ones', 'pv-hundreds': 'pv-big-numbers', 'pv-compare': 'pv-big-numbers',
  'pv-add': 'pv-add-regroup', 'pv-sub': 'pv-sub-regroup', 'pv-round': 'pv-rounding', 'pv-big': 'pv-big-numbers',
  // decimals and money (the market): counting coins biggest first, change by counting up, tenths,
  // hundredths, lining up the point to compare and to add
  'dm-coins': 'dec-coins', 'dm-make': 'dec-coins', 'dm-change': 'dec-change', 'dm-tenths': 'dec-tenths', 'dm-hund': 'dec-hundredths',
  'dm-compare': 'dec-compare', 'dm-add': 'dec-add', 'dm-sub': 'dec-add',
  // measurement and time (the clockmaker's workshop: math/measure/episodes.ts)
  'ms-hour': 'ms-oclock', 'ms-five': 'ms-fives', 'ms-minute': 'ms-fives', 'ms-elapsed': 'ms-jump', 'ms-ruler': 'ms-zero', 'ms-compare': 'ms-zero',
  'ms-mass': 'ms-marks', 'ms-area': 'ms-rows', 'ms-perim': 'ms-rows',
};
export const SKILL_LESSONS: SkillLesson[] = SKILL_REGIONS.flatMap(r => r.lessons);
export const SKILL_LESSON: Record<string, SkillLesson> = Object.fromEntries([...Object.values(SKILL_PLACEMENTS), ...SKILL_LESSONS].map(l => [l!.id, l!]));
export const SKILL_REGION: Record<string, SkillRegion> = Object.fromEntries(SKILL_REGIONS.map(r => [r.id, r]));
export const skillRegionsOf = (area: AreaId) => SKILL_REGIONS.filter(r => r.area === area);
export const isSkillLesson = (id: string) => !!SKILL_LESSON[id];
/** How much longer a skill question takes than a fact: speeds, treasure and rides are scaled by it so a
 *  good fraction trip feels as fast as a good times-table trip. */
export const TEMPO: Partial<Record<AreaId, number>> = { fractions: 2.5, place: 2, decimals: 2.5, measure: 2.8 };
export const tempoOf = (area: AreaId) => TEMPO[area] ?? 2;

// ---------- what's open ----------
const rec = (m: MathProgress, id: string) => m.lessons[id];
export const skillPassed = (m: MathProgress, id: string) => (rec(m, id)?.stars ?? 0) > 0;
export const skillRegionPassed = (m: MathProgress, id: string) => skillPassed(m, SKILL_REGION[id].lessons.at(-1)!.id);
export function skillMovedOn(m: MathProgress, l: SkillLesson): boolean {
  const r = rec(m, l.id);
  if ((r?.stars ?? 0) > 0 || (r?.finishes ?? 0) >= 2) return true;
  return l.region !== 'start' && skillRegionPassed(m, l.region);
}
export function skillRegionOpen(m: MathProgress, id: string): boolean {
  const rs = skillRegionsOf(SKILL_REGION[id].area);
  const i = rs.findIndex(r => r.id === id);
  if (i <= 0) return true;
  const prev = rs[i - 1];
  return skillRegionPassed(m, prev.id) || prev.lessons.every(l => skillMovedOn(m, l));
}
export function skillUnlocked(m: MathProgress, l: SkillLesson): boolean {
  if (l.region === 'start') return true;
  if (!skillRegionOpen(m, l.region)) return false;
  if (l.kind === 'check' || l.n === 1) return true;
  return skillMovedOn(m, SKILL_REGION[l.region].lessons[l.n - 2]);
}
/** The next lesson to suggest in an area. */
export function nextSkillLesson(m: MathProgress, area: AreaId): SkillLesson {
  for (const l of SKILL_LESSONS) if (l.area === area && skillUnlocked(m, l) && !skillMovedOn(m, l)) return l;
  const rs = skillRegionsOf(area);
  return rs.at(-1)!.lessons.find(l => l.kind === 'mix') ?? rs.at(-1)!.lessons[0];
}
