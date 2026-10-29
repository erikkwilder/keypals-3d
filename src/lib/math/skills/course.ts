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
export type SkillRegion = { id: string; area: AreaId; name: string; blurb: string; world: RegionId; chip: string; skills: string[]; lessons: SkillLesson[] };

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
];

export const SKILL_PLACEMENTS: Partial<Record<AreaId, SkillLesson>> = {
  fractions: { id: 'start-fractions', region: 'start', area: 'fractions', n: 1, title: 'Show What You Know', kind: 'placement', skills: [...PIE_SKILLS, ...BAKER_SKILLS, ...MILL_SKILLS], learn: [], goal: 6, move: 'run', world: 'village', blurb: 'A quick mix of fractions. Answer what you know and skip ahead!' },
};
/** The Learn episode that teaches each fraction skill (a hook for math/learn.ts: an episode added with
 *  one of these ids can be offered on that skill's Meet lesson, its results and its practice stop). */
export const SKILL_EPISODES: Record<string, string> = {
  'fr-name': 'frac-parts', 'fr-unit': 'frac-one-piece', 'fr-set': 'frac-of-a-set', 'fr-line': 'frac-number-line', 'fr-compare': 'frac-bigger',
  'fr-equal': 'frac-equal', 'fr-add': 'frac-add', 'fr-sub': 'frac-take-away', 'fr-mixed': 'frac-mixed', 'fr-times': 'frac-times', 'fr-unlike': 'frac-unlike',
};
export const SKILL_LESSONS: SkillLesson[] = SKILL_REGIONS.flatMap(r => r.lessons);
export const SKILL_LESSON: Record<string, SkillLesson> = Object.fromEntries([...Object.values(SKILL_PLACEMENTS), ...SKILL_LESSONS].map(l => [l!.id, l!]));
export const SKILL_REGION: Record<string, SkillRegion> = Object.fromEntries(SKILL_REGIONS.map(r => [r.id, r]));
export const skillRegionsOf = (area: AreaId) => SKILL_REGIONS.filter(r => r.area === area);
export const isSkillLesson = (id: string) => !!SKILL_LESSON[id];
/** How much longer a skill question takes than a fact: speeds, treasure and rides are scaled by it so a
 *  good fraction trip feels as fast as a good times-table trip. */
export const TEMPO: Partial<Record<AreaId, number>> = { fractions: 2.5 };
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
