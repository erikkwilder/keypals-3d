// What happens after a skill trip: each question's sub moves along its memory (the same stages as facts),
// the lesson record, a placement or checkpoint can test you out, and the same ending as every practice
// game (engine/settle.ts: goal, medals, friendship, stickers, buddies, eggs, shells, treasure).
import type { Profile } from '../../engine/profile';
import { buddyPal, dayKey } from '../../engine/profile';
import type { PalProgress } from '../../engine/stickers';
import { settlePractice, type Settled } from '../../engine/settle';
import { newStat, updateFact, type FactStat, type Stage } from '../facts';
import { mathTreasureFor, type FactResult, type TripStats } from '../meter';
import { mathOf, tripXp, type MathLessonRecord, type MathProgress } from '../progress';
import { SKILL, splitKey } from './registry';
import { SKILL_LESSON, SKILL_REGION, skillRegionsOf, tempoOf, type SkillLesson } from './course';
import { noteAbility, skillAnswers, thetaOf } from './ability';
import { applyPlacement, foundInArea, placeStart, skillLadder, type Found } from './placement';

/** The memory of the skill areas (empty in older saves). */
export const skillMem = (m: MathProgress): Record<string, FactStat> => m.skills ?? {};
/** One sub's stage (0 not met, 1 sprout, 2 bud, 3 bloom). */
export const keyStage = (m: MathProgress, key: string): Stage => (skillMem(m)[key]?.stage ?? 0) as Stage;

/** Where a skill stands, for the grown-ups: not started, growing, or solid (every sub at least a bud and
 *  most in bloom). */
export function skillStatus(m: MathProgress, skillId: string): 'not started' | 'growing' | 'solid' {
  const s = SKILL[skillId];
  if (!s) return 'not started';
  const stages = s.subs.map(sb => keyStage(m, `${skillId}:${sb.id}`));
  if (stages.every(x => x === 0)) return 'not started';
  return stages.every(x => x >= 2) && stages.filter(x => x === 3).length >= Math.ceil(stages.length / 2) ? 'solid' : 'growing';
}

/** Answers from a battle, a duel or an arcade game count for the skill memory, as in practice, and move
 *  the ability (a little less than a practice trip's answers do: games are noisier). */
export function noteSkillAnswers(m: MathProgress, answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[], at: number) {
  const mem = (m.skills = { ...(m.skills ?? {}) }), day = dayKey(at);
  for (const x of answers) mem[x.key] = updateFact(mem[x.key], { ok: x.ok, thinkMs: x.thinkMs, day, at, fastMs: SKILL[splitKey(x.key).skill]?.fastMs });
  noteAbility(m, skillAnswers(m, answers, at), 'game');
}

/** One answered question: its memory key and the question's id, the rung it was asked at, and whether it
 *  was turned into choices (easier: it counts half a rung lower). */
export type SkillResult = FactResult & { key: string; label: string; rung?: number; choice?: boolean };

export type SkillRunInput = { lessonId: string; results: SkillResult[]; stats: TripStats; stars: number; bestRide: number; finished: boolean; at: number; napped?: boolean };
export type SkillOutcome = Settled & {
  profile: Profile; before: MathLessonRecord | null; record: MathLessonRecord;
  newBestScore: boolean; newBestRide: boolean; regionJustDone: string | null;
  grew: { bloomed: string[]; budded: string[]; sprouted: string[] }; slipped: string[];
  /** lessons passed by testing out (placement) */
  testedOut: string[];
  /** a placement: what it found (comfortable with, next to grow) */
  placed?: Found;
};

export function applySkillRun(p0: Profile, run: SkillRunInput): SkillOutcome {
  const lesson: SkillLesson = SKILL_LESSON[run.lessonId];
  const grown = p0.settings.grown;
  const st = run.stats;
  const p: Profile = structuredClone(p0);
  const m: MathProgress = (p.math = mathOf(p));
  const mem = (m.skills = { ...(m.skills ?? {}) });
  const day = dayKey(run.at);

  // ---- memory ----
  const before = new Map<string, Stage>();
  for (const r of run.results) {
    if (!before.has(r.key)) before.set(r.key, (mem[r.key]?.stage ?? 0) as Stage);
    const sk = SKILL[splitKey(r.key).skill];
    if (r.intro) { const s = mem[r.key] ?? newStat(); mem[r.key] = { ...s, seen: s.seen + 1, last: run.at, stage: Math.max(1, s.stage) as Stage }; }
    else mem[r.key] = updateFact(mem[r.key], { ok: r.ok, thinkMs: r.thinkMs, day, at: run.at, fastMs: sk?.fastMs });
  }
  // ---- how hard the questions should be: every first try moves the ability; a placement sets it ----
  let placed: Found | undefined;
  const firsts = run.results.filter(r => !r.intro);
  if (lesson.kind === 'placement') {
    const ladder = skillLadder(lesson.area).filter(x => lesson.skills.includes(x.skill));
    const base = new Map(ladder.map(x => [x.skill, x.base]));
    const answers = firsts.filter(r => r.rung && base.has(splitKey(r.key).skill)).map(r => { const skill = splitKey(r.key).skill; return { skill, rung: r.rung!, d: base.get(skill)! + r.rung!, ok: r.ok }; });
    if (run.finished && answers.length) {
      applyPlacement(m, ladder, answers, placeStart(mathOf(p0), ladder, run.at), run.at);
      placed = foundInArea(m, lesson.area, run.at);
      m.placed = { ...(m.placed ?? {}), [lesson.area]: { at: run.at, ...placed } };
    }
  } else noteAbility(m, firsts.map(r => ({ skill: splitKey(r.key).skill, rung: (r.rung ?? 0) - (r.choice ? 0.5 : 0), ok: r.ok, thinkMs: r.thinkMs, at: run.at })).filter(x => x.rung > 0), 'trip', grown);

  const grew = { bloomed: [] as string[], budded: [] as string[], sprouted: [] as string[] };
  const slipped: string[] = [];
  for (const [key, b] of before) {
    const a = mem[key]?.stage ?? 0;
    if (a > b) (a === 3 ? grew.bloomed : a === 2 ? grew.budded : grew.sprouted).push(key);
    else if (a < b) slipped.push(key);
  }

  // ---- the record (scores are in "fact-equivalent" speed so stars, rides and treasure feel the same) ----
  const tempo = tempoOf(lesson.area);
  const score = Math.round(st.score);
  const prior = m.lessons[lesson.id] ? { ...m.lessons[lesson.id] } : null;
  const prev = prior ?? { stars: 0, bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: 0 };
  const passedNow = run.stars > 0;
  const treasure = run.finished ? mathTreasureFor(score * tempo, grown) : -1;
  const record: MathLessonRecord = {
    ...prev,
    stars: Math.max(prev.stars, run.stars), bestScore: Math.max(prev.bestScore, run.finished ? score : 0),
    bestFpm: Math.max(prev.bestFpm, run.finished ? st.fpm : 0), bestAcc: Math.max(prev.bestAcc, run.finished ? st.acc : 0),
    bestRide: Math.max(prev.bestRide, run.bestRide), attempts: prev.attempts + 1, finishes: prev.finishes + (run.finished ? 1 : 0),
    passes: prev.passes + (passedNow ? 1 : 0), lastAt: run.at, treasure: Math.max(prev.treasure ?? -1, treasure),
  };
  m.lessons[lesson.id] = record;

  // ---- placement: a Meet lesson opens when its skill's questions all came back right (and mostly
  // quick) and the placement puts the child at grade level on it or past it; or when it wasn't asked but
  // sits clearly below what the child showed (as before: nothing new is locked, nothing marked done that
  // the answers don't show) ----
  const testedOut: string[] = [];
  if (lesson.kind === 'placement' && run.finished) {
    for (const r of skillRegionsOf(lesson.area)) for (const l of r.lessons) {
      if (l.kind !== 'meet' || (m.lessons[l.id]?.stars ?? 0) > 0) continue;
      const mine = run.results.filter(x => !x.intro && l.learn.includes(splitKey(x.key).skill));
      const fast = mine.filter(x => x.ok && x.speed === 'fast').length;
      const level = Math.min(...l.learn.map(id => thetaOf(m, id, run.at)));
      const shown = mine.length > 0 && !mine.some(x => !x.ok) && fast >= Math.ceil(mine.length * 0.5) && level >= 3;
      if (!shown && !(mine.length === 0 && level >= 4.5)) continue;
      m.lessons[l.id] = { ...(m.lessons[l.id] ?? { bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: run.at }), stars: 1, testedOut: true };
      testedOut.push(l.id);
    }
  }

  m.totals = { trips: m.totals.trips + 1, facts: m.totals.facts + st.asked, ms: m.totals.ms + st.ms };
  m.history.push({ at: run.at, lessonId: lesson.id, fpm: st.fpm, acc: st.acc, score, stars: run.stars, ride: run.bestRide, ms: st.ms });
  if (m.history.length > 300) m.history.splice(0, m.history.length - 300);
  p.rideBest = Math.max(p.rideBest, run.bestRide);

  // ---- medals, the buddy's counters, and the same ending as every practice game ----
  const medals: string[] = [];
  if (run.finished && st.asked >= 8 && st.misses === 0) medals.push('clean');
  if (prior && run.bestRide > prior.bestRide) medals.push('pb');
  if (grew.bloomed.length) medals.push('bloom');
  if (passedNow && prev.attempts === 0) medals.push('firsttry');
  if (run.stars === 3) medals.push('three');
  const pal: PalProgress = buddyPal(p);
  pal.runs++;
  if (run.stars === 3) pal.stars3++;
  const perfect = run.finished && st.misses === 0 && st.asked >= 8;
  if (perfect) { pal.perfect++; pal.perfectRow++; } else if (run.finished) pal.perfectRow = 0;
  if (run.finished && st.acc >= 0.97 && st.asked >= 8) pal.sharp++;
  pal.rideBest = Math.max(pal.rideBest, run.bestRide);
  if (run.napped && run.finished) pal.naps++;
  // friendship as for a fact trip of the same effort (each skill question counts as `tempo` facts)
  const effort: TripStats = { ...st, asked: Math.round(st.asked * tempo) };
  const done = settlePractice(p, { at: run.at, ms: st.ms, finished: run.finished, stars: run.stars, medals, right: Math.round(run.results.filter(x => x.ok).length * tempo), xp: n => tripXp(effort, run.stars, n, run.finished, grown), move: lesson.move, treasure });

  let regionJustDone: string | null = null;
  if (lesson.region !== 'start' && lesson.kind === 'check' && passedNow && !(prior && prior.stars > 0)) regionJustDone = lesson.region;
  void SKILL_REGION;
  return {
    ...done, profile: p, before: prior, record,
    newBestScore: !!prior && run.finished && score > prior.bestScore,
    newBestRide: !!prior && run.bestRide > prior.bestRide,
    regionJustDone, grew, slipped, testedOut, placed,
  };
}
