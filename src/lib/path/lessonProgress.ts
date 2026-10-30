// How far a child is with each curriculum lesson, as four ticks, all read from what Keypals already keeps
// (nothing new is counted):
//   Learn        the lesson's Learn episode watched to the end (a lesson with no Learn of its own has none)
//   Try it       its practice trip played to the end once (the trip's first questions come with the trick
//                shown: the nearest thing to "try it with help"), or an old trip for it played
//   Practice     its practice trip moved on from (a star, or finished twice), or an old trip for it moved on
//                from (a child who did "Meet the Fractions" has "Name the fraction" practised)
//   Quick check  its quick check passed (or tested out by Show What You Know), the Learn's own next-day
//                check done, or comfortable at the lesson's grade by the game's ability estimate (with the
//                lesson's own questions met: one skill can hold two lessons)
// A lesson whose quick check is done before its practice is "You know this": the path moves past it and it
// comes back in warm-ups. The warm-up before a day's lesson is a few questions from earlier lessons on the
// path, the ones most due (spaced the way the Fact Garden spaces facts).
import type { Profile } from '../engine/profile';
import { mathMovedOn, mathOf, mathPassed, type MathProgress } from '../math/progress';
import { isLearned } from '../math/learn';
import { factRung, groupFacts, MATH_LESSON } from '../math/course';
import { isRuleFact, isDue } from '../math/facts';
import { SKILL_LESSON, SKILL_REGIONS, skillMovedOn, skillPassed, type SkillLesson } from '../math/skills/course';
import { SKILL } from '../math/skills/registry';
import { STRAND_SKILL, hasEvidence, thetaOf, workingOf, type Working } from '../math/skills/ability';
import { checkTrips, comfortableAt, factPart, practiceTrips, skillPart, sourceTrips } from './lessonTrips';
import { lessonIndex, lessonLearn, PATH_LESSONS, regionGroups } from './units';

const rec = (m: MathProgress, id: string) => m.lessons[id];
const tripMovedOn = (m: MathProgress, id: string) => (MATH_LESSON[id] ? mathMovedOn(m, MATH_LESSON[id]) : SKILL_LESSON[id] ? skillMovedOn(m, SKILL_LESSON[id]) : false);
const tripPassed = (m: MathProgress, id: string) => (MATH_LESSON[id] ? mathPassed(m, id) : skillPassed(m, id));
/** old trips that count for a lesson (not the placements) */
const sources = (id: string) => sourceTrips(id).filter(t => !t.startsWith('start'));

/** A fact strand's groups: comfortable when the strand's ability reaches their typical fact. */
const groupRung = (g: string) => { const rs = groupFacts(g).filter(f => !isRuleFact(f)).map(factRung).sort((a, b) => a - b); return rs.length ? rs[Math.floor(rs.length / 2)] : 1; };
export function factLevel(m: MathProgress, skill: string, groups: string[], now: number): Working {
  if (!hasEvidence(m, skill) && workingOf(m, skill, now).word === 'not started') return 'not started';
  const d = thetaOf(m, skill, now) - Math.max(...groups.map(groupRung));
  return d < 0 ? 'getting started' : d < 1.5 ? 'comfortable' : d < 3 ? 'strong' : 'stretching';
}
const keyMet = (m: MathProgress, key: string) => { const st = m.skills?.[key]; return !!st && ((st.stage ?? 0) > 0 || (st.seen ?? 0) > 0); };
const keysOfPart = (keys: string[]) => keys.flatMap(k => (k.includes(':') ? [k] : (SKILL[k]?.subs ?? []).map(s => `${k}:${s.id}`)));

/** Comfortable with a lesson at its own grade, by the ability estimate. */
export function lessonComfortable(m: MathProgress, id: string, now = Date.now()): boolean {
  const sk = skillPart(id);
  if (sk) {
    if (!keysOfPart(sk.keys).some(k => keyMet(m, k))) return false;
    return sk.skills.every(s => hasEvidence(m, s) && thetaOf(m, s, now) >= comfortableAt(sk.rungs));
  }
  const fs = factPart(id, regionGroups);
  if (!fs.length) return false;
  return fs.every(f => { const l = factLevel(m, STRAND_SKILL[f.op], f.groups, now); return l !== 'not started' && l !== 'getting started'; });
}

export type LessonTicks = {
  /** null: the lesson has no Learn of its own */
  learn: boolean | null; tryIt: boolean; practice: boolean; quick: boolean;
  /** shown already (quick check before practice): "You know this" */
  known: boolean; done: boolean;
};
export function lessonTicks(p: Profile, id: string, now = Date.now()): LessonTicks {
  const m = mathOf(p);
  const ep = lessonLearn(id);
  const learn = ep ? isLearned(m, ep) : null;
  const trips = practiceTrips(id), old = sources(id);
  const practice = (trips.length > 0 && trips.every(t => tripMovedOn(m, t))) || old.some(t => tripMovedOn(m, t));
  const tryIt = practice || trips.some(t => (rec(m, t)?.finishes ?? 0) > 0) || old.some(t => (rec(m, t)?.finishes ?? 0) > 0);
  const checks = checkTrips(id);
  const quick = (checks.length > 0 && checks.every(t => tripPassed(m, t))) || (!!ep && (m.checked ?? []).includes(ep)) || lessonComfortable(m, id, now);
  return { learn, tryIt, practice, quick, known: quick && !practice, done: practice && quick && learn !== false };
}

// ---------- the warm-up ----------
/** The memory keys a warm-up before a lesson can ask: earlier skill lessons' questions already met, the
 *  most due first (then the weakest), at most four. Empty: nothing to warm up on yet (the item is skipped). */
export function warmKeys(p: Profile, lessonId: string, now = Date.now()): string[] {
  const m = mathOf(p), mem = m.skills ?? {};
  const at = lessonIndex(lessonId);
  const before = PATH_LESSONS.slice(0, at < 0 ? 0 : at);
  const cands = [...new Set(before.flatMap(l => { const sk = skillPart(l.id); return sk ? keysOfPart(sk.keys) : []; }))].filter(k => keyMet(m, k));
  const score = (k: string) => (isDue(mem[k], now) ? 2 : 0) + ((mem[k]?.stage ?? 0) < 3 ? 1 : 0) - (mem[k]?.last ?? 0) / 1e13;
  return cands.sort((a, b) => score(b) - score(a)).slice(0, 4);
}
/** The warm-up trip before a lesson (made when it starts, filed with the trips like a teacher's trip). */
export function warmLesson(p: Profile, lessonId: string, now = Date.now()): SkillLesson | null {
  const keys = warmKeys(p, lessonId, now);
  if (!keys.length) return null;
  const skills = [...new Set(keys.map(k => k.slice(0, k.indexOf(':'))))];
  const r = SKILL_REGIONS.find(x => x.skills.includes(skills[0]));
  const lesson: SkillLesson = {
    id: `warm-${lessonId}`, region: 'start', area: SKILL[skills[0]].area, n: 1, title: 'Warm-up', kind: 'mix', skills, learn: [],
    goal: r?.lessons[0]?.goal ?? 5, move: r?.lessons[0]?.move ?? 'run', world: r?.world ?? 'village',
    blurb: 'A few questions from earlier lessons, to warm up.', subs: keys, ep: null, length: 5,
  };
  (SKILL_LESSON as Record<string, SkillLesson>)[lesson.id] = lesson;
  return lesson;
}
/** The warm-up before a lesson is done (played to the end today or before). */
export const warmDone = (p: Profile, lessonId: string) => (rec(mathOf(p), `warm-${lessonId}`)?.finishes ?? 0) > 0;
