// What the game does for each lesson of the curriculum (curriculum.ts): which practice it gets and which
// Learn goes with it. Written by hand (curriculum.ts is generated), so the plan can be regenerated without
// losing these choices. Phase 1 re-sorts what Keypals has, nothing new:
//   - a skill lesson practises only its own part of a skill (its subs) and, where a skill runs across
//     grades, only its grade's rungs (a rung band): a trip made for the lesson (path/lessonTrips.ts);
//   - a fact lesson uses its fact region's own stops when the region is exactly the lesson (Meet, then the
//     region's run as the quick check), or a trip on just its facts (within 5, ten pairs...);
//   - the Learn is the one that teaches exactly this (LEARN_TEACHES); a lesson with none shows none.
import type { Op } from '../math/facts';
import { CUR_LESSONS, type CurLesson } from './curriculum';

export type Band = [number, number];
/** A fact lesson: its region's stops (`trips` to practise, `checks` as the quick check), or trips made on
 *  just these fact groups, by operation (`+w5`: adding within 5; see math/course.ts groupFacts). */
export type FactPractice = { trips: string[]; checks: string[] } | { groups: Partial<Record<Op, string[]>> };
export type SkillPractice = {
  /** memory keys it asks: `skill:sub` (every sub of a skill when only its id is given) */
  keys: string[];
  /** only these rungs of its skills (where a skill runs across grades), else all six */
  rungs?: Band;
};
export type LessonSpec = { facts?: FactPractice; skill?: SkillPractice; learn: string | null };

// ---------- which Learn teaches what ----------
/** Each Learn episode and exactly what it teaches (skills, or `skill:sub` where it shows only part). A
 *  lesson's Learn must teach the lesson's practice; a borrowed one that teaches something else is not
 *  shown. Trimmed episodes (`base~part`) show only their first steps (math/episodes.ts TRIMS). */
export const LEARN_TEACHES: Record<string, string[]> = {
  // fact tricks
  'count-on': ['add-facts:+s'], 'doubles': ['add-facts:+d'], 'make-ten': ['add-facts:+t', 'add-facts:+p10'], 'bridge-ten': ['add-facts:+b', 'add-facts:+bx'],
  'count-back': ['sub-facts:-s'], 'doubles-back': ['sub-facts:-d'], 'ten-back': ['sub-facts:-t'], 'think-plus': ['sub-facts:-b'],
  'zero-one': ['mult-facts:x0', 'mult-facts:x1'], 'times-2': ['mult-facts:x2'], 'times-10': ['mult-facts:x10'], 'times-5': ['mult-facts:x5'], 'times-4': ['mult-facts:x4'],
  'times-3': ['mult-facts:x3'], 'times-9': ['mult-facts:x9'], 'times-6': ['mult-facts:x6'], 'times-8': ['mult-facts:x8'], 'times-7': ['mult-facts:x7'],
  'think-times': ['div-facts'],
  // place value: ten ones snap into a ten (and the teens: ten and some more); tens and ones opens with 10, 20, 30
  'pv-make-ten': ['pv-tens:teen', 'pv-tens:read'], 'pv-tens-ones': ['pv-tens', 'pv-skip:10'],
  'pv-big-numbers': ['pv-hundreds', 'pv-count:words', 'pv-big'], 'pv-big-numbers~hundred': ['pv-hundreds:read'],
  'pv-add-regroup': ['pv-add'], 'pv-sub-regroup': ['pv-sub'], 'pv-rounding': ['pv-round'],
  // fractions
  'frac-parts': ['fr-name'], 'frac-one-piece': ['fr-unit'], 'frac-of-a-set': ['fr-set'],
  'frac-number-line': ['fr-line'], 'frac-bigger': ['fr-compare'], 'frac-equal': ['fr-equal'], 'frac-add': ['fr-add'], 'frac-take-away': ['fr-sub'],
  'frac-mixed': ['fr-mixed'], 'frac-times': ['fr-times'], 'frac-unlike': ['fr-unlike'],
  // decimals and money
  'dec-coins': ['dm-coins', 'dm-make'], 'dec-change': ['dm-change'], 'dec-tenths': ['dm-tenths'], 'dec-hundredths': ['dm-hund'], 'dec-compare': ['dm-compare'], 'dec-add': ['dm-add', 'dm-sub'],
  // measuring and time (Rows of Squares ends on the fence: it teaches area by rows and perimeter, so it
  // goes with neither part alone until it can be trimmed)
  'ms-oclock': ['ms-hour'], 'ms-fives': ['ms-five', 'ms-minute'], 'ms-jump': ['ms-elapsed'], 'ms-zero': ['ms-ruler', 'ms-compare'], 'ms-marks': ['ms-mass'],
  // shapes: Sides and Corners is flat shapes' sides and corners (not naming, not solids); Layers of Cubes
  // is whole cubes in layers, so it goes with grade 5 volume (ms-volume), not grade 6 fraction edges
  'sh-sides': ['sh-sides:sides', 'sh-sides:corners'], 'sh-halves': ['sh-parts'], 'sh-angles': ['sh-angle:kind'], 'sh-tri-area': ['sh-area:tri'],
  'sh-boxes': ['ms-volume:cubes', 'ms-volume:multiply'], 'sh-tri-180': ['sh-anglefacts:triangle'], 'sh-pyth': ['sh-pyth'],
  // ratios
  'rt-for-every': ['rt-ratio'], 'rt-batches': ['rt-table'], 'rt-two-lines': ['rt-dnl'], 'rt-one-each': ['rt-rate'], 'rt-out-of-100': ['rt-pct'], 'rt-percent-of': ['rt-pctof'], 'rt-percent-off': ['rt-shop'],
  // negative numbers (the four-corner map is all four quadrants: not the first-quadrant grid)
  'neg-zero': ['in-real'], 'neg-opposites': ['in-opp'], 'neg-compare': ['in-compare'], 'neg-map': ['in-quad'], 'neg-add': ['in-add', 'in-rat:line', 'in-rat:compare', 'in-rat:add'],
  'neg-sub': ['in-sub'], 'neg-times': ['in-mult'],
  // algebra (the balance shows only adding: a box plus a weight)
  'alg-balance': ['al-missing:add', 'al-one:plus', 'al-one:minus'], 'alg-pattern': ['al-pattern'], 'alg-order': ['al-order'], 'alg-letters': ['al-write', 'al-eval'],
  'alg-gather': ['al-equal:share'], 'alg-ineq': ['al-ineq'], 'alg-two-step': ['al-two'],
  // data and chance (the bar graph episode works out "how many more" by taking away, as picture graphs ask)
  'data-sort': ['da-sort'], 'data-bars': ['da-bars', 'da-picgraph:more'], 'data-lineplot': ['da-lineplot'], 'data-mean': ['da-mean'], 'data-median': ['da-middle'],
  'data-chance': ['da-likely', 'da-chance'], 'data-both': ['da-both'],
};

// ---------- the lessons that need more than the plan's own list ----------
const keys = (...k: string[]): SkillPractice => ({ keys: k });
const band = (r: Band, ...k: string[]): SkillPractice => ({ keys: k, rungs: r });
/** a fact region's stops: Meet (or the rules) to practise, the region's run as the quick check */
const region = (practise: string, check?: string): FactPractice => ({ trips: [practise], checks: check ? [check] : [] });

const OVERRIDE: Record<string, Partial<LessonSpec>> = {
  // Kindergarten
  'k-sort-count': { skill: band([1, 3], 'da-sort') },
  'k-make-ten': { facts: { groups: { '+': ['+p10'] } } },
  'k-plus-5': { facts: { groups: { '+': ['+w5'] } } },
  'k-minus-5': { facts: { groups: { '-': ['-w5'] } } },
  'k-teen-numbers': { skill: band([1, 3], 'pv-tens:teen') },
  // grade 1
  'g1-count-on': { facts: region('plus-s-1', 'plus-s-4') },
  'g1-count-back': { facts: region('minus-s-1', 'minus-s-4') },
  'g1-within-10': { facts: { groups: { '+': ['+w10'], '-': ['-w10'] } } },
  'g1-data-3': { skill: band([2, 4], 'da-sort:total') },
  'g1-data-more': { skill: band([1, 2], 'da-picgraph:more') },
  'g1-missing-number': { skill: band([1, 3], 'al-missing:add') },
  'g1-doubles': { facts: region('plus-d-1', 'plus-d-4') },
  'g1-ten-pairs': { facts: region('plus-t-1', 'plus-t-4') },
  'g1-bridge-ten': { facts: { groups: { '+': ['+bx'] } } },
  'g1-ten-and-more': { skill: band([1, 4], 'pv-tens:teen') },
  'g1-doubles-back': { facts: region('minus-d-1', 'minus-d-4') },
  'g1-from-ten': { facts: region('minus-t-1', 'minus-t-4') },
  'g1-think-addition': { facts: region('minus-b-1', 'minus-b-4') },
  'g1-make-a-ten': { skill: band([1, 3], 'pv-tens:read') },
  'g1-decades': { skill: band([1, 2], 'pv-skip:10') },
  'g1-add-new-ten': { skill: band([1, 2], 'pv-add:regroup') },
  'g1-halves-quarters': { skill: band([1, 2], 'sh-parts:equal', 'sh-parts:name') },
  // grade 2
  'g2-facts-by-heart': { facts: { trips: ['plus-b-3', 'minus-b-3'], checks: [] } },
  'g2-bar-graphs': { skill: band([1, 2], 'da-bars') },
  'g2-hundred': { skill: band([1, 3], 'pv-hundreds:read'), learn: 'pv-big-numbers~hundred' },
  'g2-hundreds-tens-ones': { skill: keys('pv-hundreds:read', 'pv-hundreds:zero') },
  'g2-sub-1000': { skill: band([1, 3], 'pv-sub:three') },
  'g2-thirds': { skill: band([1, 4], 'sh-parts:equal', 'sh-parts:name') },
  // grade 3: the times tables and sharing in their units (each table's Meet, its run as the quick check)
  'g3-times-0-1': { facts: region('twins-1') },
  'g3-times-2': { facts: region('twins-2', 'twins-4') },
  'g3-times-10': { facts: region('tens-1', 'tens-4') },
  'g3-times-5': { facts: region('fives-1', 'fives-4') },
  'g3-times-4': { facts: region('fours-1', 'fours-4') },
  'g3-times-3': { facts: region('threes-1', 'threes-4') },
  'g3-times-9': { facts: region('nines-1', 'nines-4') },
  'g3-times-6': { facts: region('sixes-1', 'sixes-4') },
  'g3-times-8': { facts: region('eights-1', 'eights-4') },
  'g3-times-7': { facts: region('sevens-1', 'sevens-4') },
  'g3-think-times': { facts: region('share-a-1') },
  'g3-divide-2-10-5': { facts: region('share-a-2', 'share-a-4') },
  'g3-divide-4-3': { facts: region('share-b-1', 'share-b-4') },
  'g3-divide-9-6': { facts: region('share-c-1', 'share-c-4') },
  'g3-divide-8-7': { facts: region('share-d-1', 'share-d-4') },
  'g3-all-tables': { facts: { groups: { x: ['x2', 'x10', 'x5', 'x4', 'x3', 'x9', 'x6', 'x8', 'x7'], '/': ['/2', '/10', '/5', '/4', '/3', '/9', '/6', '/8', '/7'] } } },
  'g3-area-multiply': { learn: null },
  'g3-add-fluent': { skill: band([3, 6], 'pv-add:three') },
  'g3-sub-fluent': { skill: band([3, 6], 'pv-sub:three') },
  'g3-round': { skill: band([1, 3], 'pv-round:10', 'pv-round:100') },
  'g3-missing-factor': { learn: null },
  // (Part of a Set goes on to 1/3 of 12, a grade 5 idea, and its own questions are on that: none fits here)
  'g3-part-of-set': { learn: null },
  'g3-line-plots': { skill: band([2, 3], 'da-lineplot') },
  // grade 4
  'g4-sum-of-pieces': { skill: band([3, 6], 'fr-unit:count') },
  'g4-line-plot-eighths': { skill: band([4, 5], 'da-lineplot') },
  'g4-tenths': { skill: keys('dm-tenths:pic', 'dm-tenths:frac') },
  'g4-compare-decimals': { skill: band([1, 4], 'dm-compare:tenths', 'dm-compare:mixed') },
  'g4-round-any': { skill: band([4, 6], 'pv-round') },
  // grade 5: volume is ms-volume with the Layers of Cubes Learn (sh-volume keeps fraction edges for grade 6)
  'g5-what-is-volume': { skill: band([1, 2], 'ms-volume:cubes') },
  'g5-brackets': { skill: band([1, 5], 'al-order:brackets', 'al-order:times-first') },
  'g5-compare-thousandths': { skill: band([5, 6], 'dm-compare:tricky') },
  'g5-add-decimals': { skill: band([1, 4], 'dm-add') },
  'g5-grid': { learn: null },
  // grade 6
  'g6-better-buy': { skill: keys('rt-rate:more', 'rt-rate:best') },
  'g6-fraction-boxes': { skill: band([5, 6], 'sh-volume:lwh'), learn: null },
  'g6-decimals-fluent': { skill: band([4, 6], 'dm-add', 'dm-sub') },
  'g6-solve-plus': { skill: band([1, 5], 'al-one:plus', 'al-one:minus') },
  'g6-solve-times': { skill: band([1, 5], 'al-one:times', 'al-one:divide'), learn: null },
  'g6-inequality-line': { skill: keys('al-ineq:read', 'al-ineq:draw') },
  // grade 7
  'g7-add-negatives': { skill: keys('in-add:negpos', 'in-add:posneg', 'in-add:negneg') },
};

/** The spec for a lesson: the plan's own skills and Learn, changed where OVERRIDE says. */
export function specOf(l: CurLesson): LessonSpec {
  const o = OVERRIDE[l.id] ?? {};
  const learn = o.learn !== undefined ? o.learn : (l.learn[0] ?? null);
  if (o.facts) return { facts: o.facts, learn };
  return { skill: o.skill ?? { keys: [...l.skills] }, learn };
}
export const SPEC: Record<string, LessonSpec> = Object.fromEntries(CUR_LESSONS.map(l => [l.id, specOf(l)]));
