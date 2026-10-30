// The lessons of the skill areas, laid out like the fact strands: regions on the islands, each with a
// Meet lesson per new skill, practice, a mix, and a checkpoint run that can be taken first to test out,
// plus a placement trip per area. Records go in the same lesson records as the fact trips (by id).
import type { RegionId } from '../../engine/course';
import type { MathMove } from '../course';
import type { MathProgress } from '../progress';
import type { AreaId } from './types';
import { DATA_EPISODES, DATA_PLACEMENT, DATA_REGIONS } from '../data/course';
import { skillLessonTrips, swykTrips } from '../../path/lessonTrips';

export type SkillKind = 'meet' | 'practice' | 'mix' | 'check' | 'placement';
export type SkillLesson = {
  id: string; region: string; area: AreaId; n: number; title: string; kind: SkillKind;
  /** the skills the trip draws on; `learn` are the ones being met here */
  skills: string[]; learn: string[];
  /** the score for three stars (kids): skills take longer than facts */
  goal: number; blurb: string;
  move: MathMove; world: RegionId;
  /** a trip made for a curriculum lesson (path/lessonTrips.ts): only these memory keys (`skill:sub`, or a
   *  bare skill for all of it), only these rungs, the Learn to offer first (null: none, never a borrowed
   *  one), how many questions; a placement on a ladder of its own (a grade's or a unit's skills) that tests
   *  out lessons' quick checks */
  subs?: string[]; rungs?: [number, number]; ep?: string | null; length?: number;
  ladder?: { skill: string; base: number }[];
  testOut?: { trip: string; skills: string[]; keys: string[]; min: number }[];
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
// Shapes and angles, K to 8, in Shape Peaks: Shape Meadow (naming flat and solid shapes, sides and corners,
// equal parts, four-sided shapes), Angle Ridge (angles, lines and symmetry, the families of shapes), the
// Builder's Terrace (area of triangles and polygons, boxes) and the Crystal Summit (angle facts, circles,
// the Pythagorean theorem, slides, flips and turns).
const MEADOW_SKILLS = ['sh-name', 'sh-sides', 'sh-parts', 'sh-quad'];
const RIDGE_SKILLS = ['sh-angle', 'sh-lines', 'sh-family'];
const TERRACE_SKILLS = ['sh-area', 'sh-volume'];
const SUMMIT_SKILLS = ['sh-anglefacts', 'sh-circle', 'sh-pyth', 'sh-move'];
const MEADOW: Omit<SkillRegion, 'lessons'> = { id: 'shapes-a', area: 'shapes', name: 'Shape Meadow', blurb: 'Circles, triangles, squares and cubes: their names, sides and corners, equal parts, and four-sided shapes.', world: 'village', chip: '△ ○ □', skills: MEADOW_SKILLS, art: 'regions/shapes-meadow.webp' };
const RIDGE: Omit<SkillRegion, 'lessons'> = { id: 'shapes-b', area: 'shapes', name: 'Angle Ridge', blurb: 'Right, acute and obtuse angles, the protractor, parallel lines and folds, and the families of shapes.', world: 'ridge', chip: '90°', skills: RIDGE_SKILLS, art: 'regions/shapes-ridge.webp' };
const TERRACE: Omit<SkillRegion, 'lessons'> = { id: 'shapes-c', area: 'shapes', name: "Builder's Terrace", blurb: 'The area of triangles and other shapes, and boxes: volume, nets and surface area.', world: 'treetops', chip: '½ b × h', skills: TERRACE_SKILLS, art: 'regions/shapes-terrace.webp' };
const SUMMIT: Omit<SkillRegion, 'lessons'> = { id: 'shapes-d', area: 'shapes', name: 'Crystal Summit', blurb: 'Angle facts, circles, the Pythagorean theorem, and slides, flips and turns.', world: 'cliffs', chip: 'a² + b²', skills: SUMMIT_SKILLS, art: 'regions/shapes-summit.webp' };
const SHAPE_REGIONS = [
  region(MEADOW, [
    ['Meet the Shapes', 'meet', ['sh-name'], ['sh-name'], 6, 'run', 'Circles, triangles, squares and rectangles: turn them round and they keep their names.'],
    ['Sides and Corners', 'meet', ['sh-sides', 'sh-name'], ['sh-sides'], 6, 'climb', 'Touch each corner as you count. A shape has as many sides as corners.'],
    ['Equal Parts', 'meet', ['sh-parts', 'sh-name'], ['sh-parts'], 5, 'swim', 'Halves, thirds and quarters: every part exactly the same size.'],
    ['Four Sides', 'meet', ['sh-quad', 'sh-sides'], ['sh-quad'], 5, 'slide', 'Squares, rectangles, rhombuses and trapezoids. A square is a rectangle too!'],
    ['Meadow Mix', 'mix', MEADOW_SKILLS, [], 5, 'run', 'Everything so far, all mixed up.'],
    ['Shape Meadow Run', 'check', MEADOW_SKILLS, [], 6, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(RIDGE, [
    ['Angles', 'meet', ['sh-angle'], ['sh-angle'], 5, 'climb', 'A square corner is a right angle: 90°. Smaller is acute, bigger is obtuse.'],
    ['Lines and Folds', 'meet', ['sh-lines', 'sh-angle'], ['sh-lines'], 5, 'swim', 'Parallel lines never meet. A fold where both halves match is a line of symmetry.'],
    ['Shape Families', 'meet', ['sh-family', 'sh-quad'], ['sh-family'], 5, 'run', 'Every square is a rectangle and a rhombus. Triangles have families too.'],
    ['Ridge Practice', 'practice', RIDGE_SKILLS, [], 5, 'slide', 'The new ones again: angles, lines and families.'],
    ['Ridge Mix', 'mix', [...RIDGE_SKILLS, 'sh-quad'], [], 5, 'climb', 'This island and the last, all mixed up.'],
    ['Angle Ridge Run', 'check', RIDGE_SKILLS, [], 5, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(TERRACE, [
    ['Area of Triangles', 'meet', ['sh-area'], ['sh-area'], 4, 'run', 'A triangle is half of a rectangle: base × height ÷ 2.'],
    ['Boxes and Nets', 'meet', ['sh-volume', 'sh-area'], ['sh-volume'], 4, 'climb', 'Count one layer of cubes, then times by the layers. Unfold a box to see every face.'],
    ['Terrace Practice', 'practice', TERRACE_SKILLS, [], 4, 'swim', 'Areas and boxes again.'],
    ['Terrace Mix', 'mix', [...TERRACE_SKILLS, 'sh-angle', 'sh-family'], [], 4, 'slide', 'This island and the last, all mixed up.'],
    ["Builder's Terrace Run", 'check', TERRACE_SKILLS, [], 4, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(SUMMIT, [
    ['Angle Facts', 'meet', ['sh-anglefacts'], ['sh-anglefacts'], 4, 'climb', 'A straight line makes 180°, all the way round 360°, and a triangle\'s corners 180°.'],
    ['Circles', 'meet', ['sh-circle', 'sh-anglefacts'], ['sh-circle'], 4, 'swim', 'Round a circle is 3.14 × across. Its area is 3.14 × radius × radius.'],
    ['Pythagoras', 'meet', ['sh-pyth', 'sh-area'], ['sh-pyth'], 4, 'run', 'The squares on the two short sides add up to the square on the long side.'],
    ['Slides, Flips, Turns', 'meet', ['sh-move'], ['sh-move'], 4, 'slide', 'Slide it, flip it like a mirror, or turn it round a point.'],
    ['Summit Mix', 'mix', SUMMIT_SKILLS, [], 4, 'climb', 'Everything on this island, all mixed up.'],
    ['Crystal Summit Run', 'check', SUMMIT_SKILLS, [], 4, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
// Ratios and percents, grades 6 and 7, in the Juice Jungle: the Fruit Stall (ratio words, ratio tables, double
// number lines, unit rates), the Mango Grove (percents, percent of a number, the whole, converting units) and
// the Canopy Juice Bar (proportional or not, percent up and down, sales, tax and tips, scale drawings).
const STALL_SKILLS = ['rt-ratio', 'rt-table', 'rt-dnl', 'rt-rate'];
const GROVE_SKILLS = ['rt-pct', 'rt-pctof', 'rt-whole', 'rt-units'];
const CANOPY_SKILLS = ['rt-prop', 'rt-change', 'rt-shop', 'rt-scale'];
const STALL: Omit<SkillRegion, 'lessons'> = { id: 'ratio-a', area: 'ratios', name: 'The Fruit Stall', blurb: 'Ratios: for every 2 strawberries, 3 bananas. Ratio tables, double number lines and the price of one.', world: 'treetops', chip: '2 : 3', skills: STALL_SKILLS, art: 'math/ratios/region-stall.webp' };
const GROVE: Omit<SkillRegion, 'lessons'> = { id: 'ratio-b', area: 'ratios', name: 'Mango Grove', blurb: 'Percents: out of 100, a percent of a number, finding the whole, and changing units.', world: 'village', chip: '25%', skills: GROVE_SKILLS, art: 'math/ratios/region-grove.webp' };
const CANOPY: Omit<SkillRegion, 'lessons'> = { id: 'ratio-c', area: 'ratios', name: 'Canopy Juice Bar', blurb: 'Proportional or not, percent up and down, sales, tax and tips, and scale drawings.', world: 'shores', chip: 'y = kx', skills: CANOPY_SKILLS, art: 'math/ratios/region-canopy.webp' };
const RATIO_REGIONS = [
  region(STALL, [
    ['For Every', 'meet', ['rt-ratio'], ['rt-ratio'], 6, 'run', 'For every 2 strawberries, 3 bananas: that ratio is 2 : 3. Order matters.'],
    ['Ratio Tables', 'meet', ['rt-table', 'rt-ratio'], ['rt-table'], 5, 'climb', 'Bigger batches of the same mix: times both numbers by the same number.'],
    ['Two Lines', 'meet', ['rt-dnl', 'rt-table'], ['rt-dnl'], 5, 'swim', 'A double number line counts both together, step for step.'],
    ['The Price of One', 'meet', ['rt-rate', 'rt-table'], ['rt-rate'], 5, 'slide', 'A unit rate is how much for ONE. Then the better buy is easy.'],
    ['Fruit Stall Mix', 'mix', STALL_SKILLS, [], 5, 'run', 'Everything so far, all mixed up.'],
    ['Fruit Stall Run', 'check', STALL_SKILLS, [], 6, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(GROVE, [
    ['Out of 100', 'meet', ['rt-pct'], ['rt-pct'], 6, 'run', 'Percent means out of 100: 35 of 100 squares is 35%.'],
    ['Percent Of', 'meet', ['rt-pctof', 'rt-pct'], ['rt-pctof'], 5, 'swim', '50% is half, 10% is a tenth, 25% is half of a half.'],
    ['The Whole Crate', 'meet', ['rt-whole', 'rt-pctof'], ['rt-whole'], 5, 'climb', '12 is 25% of the crate? Times up to 100%: 48.'],
    ['Changing Units', 'meet', ['rt-units', 'rt-rate'], ['rt-units'], 5, 'slide', '1 foot is 12 inches. Bigger to smaller: times. Smaller to bigger: divide.'],
    ['Mango Grove Mix', 'mix', [...GROVE_SKILLS, 'rt-table'], [], 5, 'run', 'This island and the last, all mixed up.'],
    ['Mango Grove Run', 'check', GROVE_SKILLS, [], 5, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(CANOPY, [
    ['Proportional?', 'meet', ['rt-prop', 'rt-table'], ['rt-prop'], 5, 'climb', 'Proportional: y is always the same number times x. A straight line through 0.'],
    ['Up and Down', 'meet', ['rt-change', 'rt-pctof'], ['rt-change'], 5, 'slide', 'Find the percent, then add it on or take it away.'],
    ['Sales and Tips', 'meet', ['rt-shop', 'rt-pctof'], ['rt-shop'], 4, 'run', '25% off, 15% tip, 5% tax: find the percent of the price first.'],
    ['Scale Maps', 'meet', ['rt-scale', 'rt-rate'], ['rt-scale'], 5, 'swim', '1 cm on the map is 5 km for real: 4 cm is 20 km.'],
    ['Canopy Mix', 'mix', [...CANOPY_SKILLS, 'rt-pctof', 'rt-rate'], [], 5, 'climb', 'This island and the last, all mixed up.'],
    ['Canopy Juice Bar Run', 'check', CANOPY_SKILLS, [], 5, 'slide', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
// Negative numbers and the coordinate plane, grades 5 to 7, in Below Zero Caves: Sea Level Dock (points
// on the map, below zero in real life, opposites), the Treasure Map Grotto (bigger or smaller, how far
// from zero, the whole four-corner map, distances on it) and the Deep Freeze (adding, taking away, times
// and sharing with negatives, and decimals below zero).
const DOCK_SKILLS = ['in-plot', 'in-real', 'in-opp'];
const GROTTO_SKILLS = ['in-compare', 'in-abs', 'in-quad', 'in-dist'];
const FREEZE_SKILLS = ['in-add', 'in-sub', 'in-mult', 'in-rat'];
const DOCK: Omit<SkillRegion, 'lessons'> = { id: 'int-a', area: 'integers', name: 'Sea Level Dock', blurb: 'Points on the map, temperatures and depths below zero, and opposites on the number line.', world: 'shores', chip: '−3°', skills: DOCK_SKILLS, art: 'math/integers/region-dock.webp' };
const GROTTO: Omit<SkillRegion, 'lessons'> = { id: 'int-b', area: 'integers', name: 'Treasure Map Grotto', blurb: 'Which is bigger, how far from zero, the whole four-corner map, and distances on it.', world: 'ridge', chip: '(−3, 2)', skills: GROTTO_SKILLS, art: 'math/integers/region-grotto.webp' };
const FREEZE: Omit<SkillRegion, 'lessons'> = { id: 'int-c', area: 'integers', name: 'The Deep Freeze', blurb: 'Adding, taking away, times and sharing with negative numbers, and decimals below zero.', world: 'cliffs', chip: '−3 + 5', skills: FREEZE_SKILLS, art: 'math/integers/region-freeze.webp' };
const INTEGER_REGIONS = [
  region(DOCK, [
    ['Map Points', 'meet', ['in-plot'], ['in-plot'], 6, 'run', 'Across first, then up: (3, 5) is 3 across and 5 up.'],
    ['Below Zero', 'meet', ['in-real', 'in-plot'], ['in-real'], 6, 'swim', 'Below zero gets a minus sign: 5 degrees below zero is −5.'],
    ['Opposites', 'meet', ['in-opp', 'in-real'], ['in-opp'], 6, 'climb', 'Opposites are the same distance from 0 on different sides: 4 and −4.'],
    ['Dock Mix', 'mix', DOCK_SKILLS, [], 6, 'slide', 'Everything so far, all mixed up.'],
    ['Sea Level Run', 'check', DOCK_SKILLS, [], 7, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(GROTTO, [
    ['Bigger or Smaller', 'meet', ['in-compare', 'in-opp'], ['in-compare'], 7, 'run', 'Further right is bigger: −3 is bigger than −7.'],
    ['How Far From Zero', 'meet', ['in-abs', 'in-compare'], ['in-abs'], 6, 'swim', 'Count the steps to 0: |−8| = 8.'],
    ['The Whole Map', 'meet', ['in-quad', 'in-plot'], ['in-quad'], 5, 'climb', 'Minus goes left or down: (−3, 2) is 3 left and 2 up.'],
    ['Map Distances', 'meet', ['in-dist', 'in-quad'], ['in-dist'], 5, 'slide', 'Across the axis? Add the two distances.'],
    ['Grotto Mix', 'mix', GROTTO_SKILLS, [], 6, 'run', 'Everything on this island, all mixed up.'],
    ['Grotto Run', 'check', GROTTO_SKILLS, [], 6, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(FREEZE, [
    ['Adding Negatives', 'meet', ['in-add', 'in-opp'], ['in-add'], 6, 'swim', 'Plus hops right, minus hops left.'],
    ['Taking Away', 'meet', ['in-sub', 'in-add'], ['in-sub'], 5, 'run', 'Taking away a negative is adding: 4 − (−3) = 7.'],
    ['Times and Share', 'meet', ['in-mult', 'in-add'], ['in-mult'], 6, 'climb', 'Same signs make plus, different signs make minus.'],
    ['Decimals Below Zero', 'meet', ['in-rat', 'in-add'], ['in-rat'], 5, 'slide', 'Same rules, smaller steps: −1.5 is between −1 and −2.'],
    ['Deep Freeze Mix', 'mix', [...FREEZE_SKILLS, 'in-compare'], [], 5, 'run', 'This island and the last, all mixed up.'],
    ['Deep Freeze Run', 'check', FREEZE_SKILLS, [], 6, 'swim', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
];
// Expressions and equations, grades 3 to 8, in the Star Lab: Star Steps (missing numbers, patterns and the
// order of operations), the Balance Room (letters for numbers: writing and working out expressions, equal
// expressions, one-step equations on the balance) and the Telescope Tower (inequalities on a number line,
// two-step equations, slope, two equations at once).
const STAR_SKILLS = ['al-missing', 'al-pattern', 'al-order'];
const ROOM_SKILLS = ['al-write', 'al-eval', 'al-one', 'al-equal'];
const TOWER_SKILLS = ['al-ineq', 'al-two', 'al-slope', 'al-system'];
const STAR: Omit<SkillRegion, 'lessons'> = { id: 'alg-a', area: 'algebra', name: 'Star Steps', blurb: 'Missing numbers, number patterns, and which part of a sum to do first.', world: 'ridge', chip: '□ + 3 = 8', skills: STAR_SKILLS };
const ROOM: Omit<SkillRegion, 'lessons'> = { id: 'alg-b', area: 'algebra', name: 'The Balance Room', blurb: 'Letters for numbers: write them, work them out, and keep the balance level.', world: 'cliffs', chip: 'x + 7 = 15', skills: ROOM_SKILLS };
const TOWER: Omit<SkillRegion, 'lessons'> = { id: 'alg-c', area: 'algebra', name: 'Telescope Tower', blurb: 'More or less on a number line, two-step equations, slope, and two equations at once.', world: 'shores', chip: 'y = 2x + 1', skills: TOWER_SKILLS };
const ALGEBRA_REGIONS = [
  region(STAR, [
    ['Missing Numbers', 'meet', ['al-missing'], ['al-missing'], 6, 'run', 'Do the opposite: 8 × □ = 48? Share 48 by 8. □ + 7 = 15? Take 7 from 15.'],
    ['Number Patterns', 'meet', ['al-pattern', 'al-missing'], ['al-pattern'], 6, 'climb', 'Find the jump from one number to the next, then keep going.'],
    ['Times Comes First', 'meet', ['al-order', 'al-missing'], ['al-order'], 5, 'swim', 'Brackets first, then times and divide, then plus and take away.'],
    ['Star Steps Mix', 'mix', STAR_SKILLS, [], 6, 'slide', 'Everything so far, all mixed up.'],
    ['Star Steps Run', 'check', STAR_SKILLS, [], 6, 'run', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(ROOM, [
    ['Letters for Numbers', 'meet', ['al-write'], ['al-write'], 6, 'run', 'A letter stands for a number: 5 more than n is n + 5, and 3n is 3 × n.'],
    ['Swap In the Number', 'meet', ['al-eval', 'al-write'], ['al-eval'], 5, 'climb', 'Put the number where the letter is, then work it out.'],
    ['Keep It Level', 'meet', ['al-one', 'al-eval'], ['al-one'], 5, 'swim', 'Do the same to both sides and the balance stays level: x + 7 = 15, so x = 8.'],
    ['Share and Gather', 'meet', ['al-equal', 'al-eval'], ['al-equal'], 5, 'slide', '3(x + 4) is 3x + 12, and 2x + 5x is 7x: like goes with like.'],
    ['Balance Room Mix', 'mix', ROOM_SKILLS, [], 5, 'run', 'Everything on this island, all mixed up.'],
    ['Balance Room Run', 'check', ROOM_SKILLS, [], 5, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
  ]),
  region(TOWER, [
    ['More or Less', 'meet', ['al-ineq', 'al-one'], ['al-ineq'], 5, 'run', 'x > 3 means bigger than 3: an open dot at 3, shaded to the right.'],
    ['Two Steps', 'meet', ['al-two', 'al-one'], ['al-two'], 5, 'climb', 'Undo the plus first, then the times: 2x + 3 = 11, 2x = 8, x = 4.'],
    ['Slope', 'meet', ['al-slope'], ['al-slope'], 4, 'swim', 'How far y goes up for each 1 that x goes along.'],
    ['Two at Once', 'meet', ['al-system', 'al-two'], ['al-system'], 4, 'slide', 'Two equations, two letters: take one from the other and a letter disappears.'],
    ['Telescope Mix', 'mix', [...TOWER_SKILLS, 'al-equal'], [], 4, 'run', 'This island and the last, all mixed up.'],
    ['Telescope Tower Run', 'check', TOWER_SKILLS, [], 5, 'climb', 'Every kind of question on this island. Already know them? Start here.'],
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
  ...SHAPE_REGIONS,
  ...RATIO_REGIONS,
  ...INTEGER_REGIONS,
  ...DATA_REGIONS,
  ...ALGEBRA_REGIONS,
];

export const SKILL_PLACEMENTS: Partial<Record<AreaId, SkillLesson>> = {
  place: { id: 'start-place', region: 'start', area: 'place', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...STEPS_SKILLS, ...MINE_SKILLS, ...VAULT_SKILLS], learn: [], goal: 7, move: 'run', world: 'burrows', blurb: 'A quick mix of counting, tens and hundreds, and big numbers. Answer what you know and skip ahead!' },
  ratios: { id: 'start-ratios', region: 'start', area: 'ratios', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...STALL_SKILLS, ...GROVE_SKILLS, ...CANOPY_SKILLS], learn: [], goal: 5, move: 'run', world: 'treetops', blurb: 'A quick mix of ratios and percents. Answer what you know and skip ahead!' },
  decimals: { id: 'start-decimals', region: 'start', area: 'decimals', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...COIN_SKILLS, ...CHOC_SKILLS, ...HOUSE_SKILLS], learn: [], goal: 5, move: 'run', world: 'village', blurb: 'A quick mix of money and decimals. Answer what you know and skip ahead!' },
  measure: { id: 'start-measure', region: 'start', area: 'measure', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...TICK_SKILLS, ...MILL_M_SKILLS, ...YARD_SKILLS], learn: [], goal: 5, move: 'run', world: 'village', blurb: 'A quick mix of clocks, rulers, scales, area and units. Answer what you know and skip ahead!' },
  data: DATA_PLACEMENT,
  algebra: { id: 'start-algebra', region: 'start', area: 'algebra', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...STAR_SKILLS, ...ROOM_SKILLS, ...TOWER_SKILLS], learn: [], goal: 5, move: 'run', world: 'ridge', blurb: 'A quick mix of missing numbers, letters and equations. Answer what you know and skip ahead!' },
  fractions: { id: 'start-fractions', region: 'start', area: 'fractions', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...PIE_SKILLS, ...BAKER_SKILLS, ...MILL_SKILLS], learn: [], goal: 6, move: 'run', world: 'village', blurb: 'A quick mix of fractions. Answer what you know and skip ahead!' },
  shapes: { id: 'start-shapes', region: 'start', area: 'shapes', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...MEADOW_SKILLS, ...RIDGE_SKILLS, ...TERRACE_SKILLS, ...SUMMIT_SKILLS], learn: [], goal: 5, move: 'run', world: 'village', blurb: 'A quick mix of shapes and angles. Answer what you know and skip ahead!' },
  integers: { id: 'start-integers', region: 'start', area: 'integers', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...DOCK_SKILLS, ...GROTTO_SKILLS, ...FREEZE_SKILLS], learn: [], goal: 6, move: 'run', world: 'shores', blurb: 'A quick mix of negative numbers and the map. Answer what you know and skip ahead!' },
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
  // shapes and angles (the crystal workshop at Shape Peaks: math/shapes/episodes.ts)
  'sh-name': 'sh-sides', 'sh-sides': 'sh-sides', 'sh-parts': 'sh-halves', 'sh-angle': 'sh-angles', 'sh-family': 'sh-angles',
  'sh-area': 'sh-tri-area', 'sh-volume': 'sh-boxes', 'sh-anglefacts': 'sh-tri-180', 'sh-pyth': 'sh-pyth',
  // ratios and percents (the Jungle Juice Bar: math/ratioEpisodes.ts)
  'rt-ratio': 'rt-for-every', 'rt-table': 'rt-batches', 'rt-dnl': 'rt-two-lines', 'rt-rate': 'rt-one-each', 'rt-units': 'rt-one-each',
  'rt-pct': 'rt-out-of-100', 'rt-pctof': 'rt-percent-of', 'rt-whole': 'rt-percent-of', 'rt-shop': 'rt-percent-off', 'rt-change': 'rt-percent-off',
  // negative numbers (the Ice Cave Chart Room, math/integers/episodes.ts)
  'in-plot': 'neg-map', 'in-real': 'neg-zero', 'in-opp': 'neg-opposites', 'in-compare': 'neg-compare', 'in-abs': 'neg-opposites', 'in-quad': 'neg-map',
  'in-dist': 'neg-map', 'in-add': 'neg-add', 'in-sub': 'neg-sub', 'in-mult': 'neg-times', 'in-rat': 'neg-add',
  // data and chance (the fair booth: math/data/episodes.ts)
  ...DATA_EPISODES,
  // expressions and equations: the Star Lab episodes (math/algebra/episodes.ts)
  'al-missing': 'alg-balance', 'al-one': 'alg-balance', 'al-two': 'alg-two-step', 'al-order': 'alg-order', 'al-write': 'alg-letters', 'al-eval': 'alg-letters',
  'al-equal': 'alg-gather', 'al-pattern': 'alg-pattern', 'al-slope': 'alg-pattern', 'al-ineq': 'alg-ineq', 'al-system': 'alg-two-step',
};
export const SKILL_LESSONS: SkillLesson[] = SKILL_REGIONS.flatMap(r => r.lessons);
/** the curriculum's lesson trips, unit checks and Show What You Know (not stops on the islands) */
export const PATH_TRIPS: SkillLesson[] = [...skillLessonTrips(SKILL_REGIONS), ...swykTrips(SKILL_REGIONS)];
export const SKILL_LESSON: Record<string, SkillLesson> = Object.fromEntries([...Object.values(SKILL_PLACEMENTS), ...SKILL_LESSONS, ...PATH_TRIPS].map(l => [l!.id, l!]));
export const SKILL_REGION: Record<string, SkillRegion> = Object.fromEntries(SKILL_REGIONS.map(r => [r.id, r]));
export const skillRegionsOf = (area: AreaId) => SKILL_REGIONS.filter(r => r.area === area);
export const isSkillLesson = (id: string) => !!SKILL_LESSON[id];
/** How much longer a skill question takes than a fact: speeds, treasure and rides are scaled by it so a
 *  good fraction trip feels as fast as a good times-table trip. */
export const TEMPO: Partial<Record<AreaId, number>> = { fractions: 2.5, place: 2, decimals: 2.5, measure: 2.8, shapes: 2.5, ratios: 2.5, integers: 2.5, data: 2.5, algebra: 2.8 };
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
