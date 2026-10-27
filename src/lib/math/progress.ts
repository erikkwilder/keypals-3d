// The math game's part of a player's save, and what happens after every trip: the fact memory, lesson
// records, unlocking, and the same rewards as typing (the buddy's friendship, outfits and dances,
// medals, stickers, treasure, the daily goal). Pure functions over plain data, like engine/profile.ts.

import type { Profile, MedalWin, XpInfo } from '../engine/profile';
import { dayKey } from '../engine/profile';
import { AWARD } from '../engine/achievements';
import { STICKERS, levelFromXp, medalTier, newPalProgress, type PalProgress, type StickerDef } from '../engine/stickers';
import { newBetween, type Reward } from '../engine/rewards';
import { RIDES } from '../engine/rides';
import { MATH_LESSON, MATH_LESSONS, MATH_REGION, MATH_REGIONS, PLACEMENT, type MathLesson, type MathRegionId } from './course';
import { factId, newStat, parseFact, seedPartner, updateFact, FAST_MS, type FactStat, type Stage } from './facts';
import { mathTreasureFor, type FactResult, type TripStats } from './meter';

export type MathLessonRecord = {
  stars: number; bestScore: number; bestFpm: number; bestAcc: number; bestRide: number;
  attempts: number; finishes: number; passes: number; lastAt: number; treasure: number;
  /** passed by testing out (a checkpoint taken first, or the placement trip) */
  testedOut?: boolean;
};

export type MathHistoryItem = { at: number; lessonId: string; fpm: number; acc: number; score: number; stars: number; ride: number; ms: number };

export type MathProgress = {
  /** which game home shows: typing or math */
  home: 'typing' | 'math';
  facts: Record<string, FactStat>;
  lessons: Record<string, MathLessonRecord>;
  history: MathHistoryItem[];
  totals: { trips: number; facts: number; ms: number };
  /** calm mode: no rides, no speed */
  calm?: boolean;
  /** "fast" means starting to answer within this many ms (a grown-up setting, 2000 to 6000) */
  fastMs?: number;
  /** the tables whose trick card has been shown */
  tricksSeen?: number[];
};

export const newMathProgress = (): MathProgress => ({ home: 'typing', facts: {}, lessons: {}, history: [], totals: { trips: 0, facts: 0, ms: 0 } });

/** The player's math progress, with anything missing filled in (older saves have none). */
export function mathOf(p: Profile): MathProgress {
  const m = p.math;
  if (!m) return newMathProgress();
  return { ...newMathProgress(), ...m, totals: { ...newMathProgress().totals, ...(m.totals ?? {}) } };
}

const rec = (m: MathProgress, id: string) => m.lessons[id];
export const mathPassed = (m: MathProgress, id: string) => (rec(m, id)?.stars ?? 0) > 0;

/** A region is done once its checkpoint is passed. */
export const regionPassed = (m: MathProgress, r: MathRegionId) => mathPassed(m, MATH_REGION[r].lessons.at(-1)!.id);

/** You can move on after a star, after finishing twice, or when the region's checkpoint is passed. */
export function mathMovedOn(m: MathProgress, l: MathLesson): boolean {
  const r = rec(m, l.id);
  if ((r?.stars ?? 0) > 0 || (r?.finishes ?? 0) >= 2) return true;
  return l.region !== 'start' && regionPassed(m, l.region);
}

export function mathRegionOpen(m: MathProgress, id: MathRegionId): boolean {
  const i = MATH_REGIONS.findIndex(r => r.id === id);
  if (i <= 0) return true;
  const prev = MATH_REGIONS[i - 1];
  return regionPassed(m, prev.id) || prev.lessons.every(l => mathMovedOn(m, l));
}

/** Lessons open in order; a region's checkpoint is open as soon as the region is, to test out. */
export function mathUnlocked(m: MathProgress, l: MathLesson): boolean {
  if (l.region === 'start') return true;
  if (!mathRegionOpen(m, l.region)) return false;
  if (l.kind === 'check' || l.n === 1) return true;
  const prev = MATH_REGION[l.region].lessons[l.n - 2];
  return mathMovedOn(m, prev);
}

/** The lesson to suggest: the first open one not yet moved on from; once the whole trail is done, The
 *  Big Mix (all four tables), which keeps the reviews coming. */
export function nextMathLesson(m: MathProgress): MathLesson {
  for (const l of MATH_LESSONS) if (mathUnlocked(m, l) && !mathMovedOn(m, l)) return l;
  return MATH_LESSON['fours-3'];
}

export const mathStarsTotal = (m: MathProgress) => Object.values(m.lessons).reduce((a, r) => a + (r.stars || 0), 0);

/** How many facts are at each stage, over a set of fact ids. */
export function stageCounts(m: MathProgress, ids: string[]): Record<Stage, number> {
  const c: Record<Stage, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const id of ids) c[(m.facts[id]?.stage ?? 0) as Stage]++;
  return c;
}

export type MathRunInput = {
  lessonId: string;
  results: FactResult[];
  stats: TripStats;
  stars: number;
  bestRide: number;
  finished: boolean;
  at: number;
  napped?: boolean;
};

export type MathOutcome = {
  profile: Profile;
  medals: MedalWin[];
  stickers: StickerDef[];
  rewards: Reward[];
  treasure: number;
  newBestTreasure: boolean;
  xp: XpInfo;
  before: MathLessonRecord | null;
  record: MathLessonRecord;
  newBestScore: boolean;
  newBestRide: boolean;
  goalJustHit: boolean;
  regionJustDone: MathRegionId | null;
  /** facts that moved up this trip, by the stage they reached, and facts that slipped */
  grew: { bloomed: string[]; budded: string[]; sprouted: string[] };
  slipped: string[];
  /** regions passed by the placement trip */
  testedOut: MathRegionId[];
};

/** Friendship XP for a trip, paced like a typing lesson's (a 20-fact trip earns about what 90 letters do). */
export function tripXp(st: TripStats, stars: number, medals: number, finished: boolean, grown: boolean) {
  return Math.round(st.asked * 2.2 * (0.5 + st.acc) * (grown ? 0.8 : 1) + stars * 10 + Math.min(medals, 5) * 4 + (finished ? 10 : 0));
}

export function applyMathRun(p0: Profile, run: MathRunInput): MathOutcome {
  const lesson = MATH_LESSON[run.lessonId];
  const grown = p0.settings.grown;
  const st = run.stats;
  const p: Profile = structuredClone(p0);
  const m: MathProgress = (p.math = mathOf(p));
  const day = dayKey(run.at);
  const fastMs = m.fastMs ?? FAST_MS;

  // ---- the fact memory ----
  const stageBefore = new Map<string, Stage>();
  for (const r of run.results) {
    if (!stageBefore.has(r.id)) stageBefore.set(r.id, (m.facts[r.id]?.stage ?? 0) as Stage);
    if (r.intro) {
      // met with its trick: a sprout
      const s = m.facts[r.id] ?? newStat();
      m.facts[r.id] = { ...s, seen: s.seen + 1, last: run.at, stage: (Math.max(1, s.stage) as Stage) };
    } else {
      m.facts[r.id] = updateFact(m.facts[r.id], { ok: r.ok, thinkMs: r.thinkMs, day, at: run.at, fastMs });
    }
    seedPartner(m.facts, parseFact(r.id));
  }
  const grew = { bloomed: [] as string[], budded: [] as string[], sprouted: [] as string[] };
  const slipped: string[] = [];
  for (const [id, b] of stageBefore) {
    const a = m.facts[id]?.stage ?? 0;
    if (a > b) (a === 3 ? grew.bloomed : a === 2 ? grew.budded : grew.sprouted).push(id);
    else if (a < b) slipped.push(id);
  }

  // ---- the lesson record ----
  const before = m.lessons[lesson.id] ? { ...m.lessons[lesson.id] } : null;
  const prev = before ?? { stars: 0, bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: 0, treasure: -1 };
  const passedNow = run.stars > 0;
  const treasure = run.finished ? mathTreasureFor(st.score, grown) : -1;
  const record: MathLessonRecord = {
    ...prev,
    stars: Math.max(prev.stars, run.stars),
    bestScore: Math.max(prev.bestScore, run.finished ? st.score : 0),
    bestFpm: Math.max(prev.bestFpm, run.finished ? st.fpm : 0),
    bestAcc: Math.max(prev.bestAcc, run.finished ? st.acc : 0),
    bestRide: Math.max(prev.bestRide, run.bestRide),
    attempts: prev.attempts + 1,
    finishes: prev.finishes + (run.finished ? 1 : 0),
    passes: prev.passes + (passedNow ? 1 : 0),
    lastAt: run.at,
    treasure: Math.max(prev.treasure, treasure),
  };
  m.lessons[lesson.id] = record;

  // ---- the placement trip: test out of every table, in order, that came back all right and mostly fast ----
  const testedOut: MathRegionId[] = [];
  if (lesson.id === PLACEMENT.id && run.finished) {
    for (const r of MATH_REGIONS) {
      const mine = run.results.filter(x => !x.intro && parseFact(x.id).b === r.table);
      const fast = mine.filter(x => x.ok && x.speed === 'fast').length;
      if (!mine.length || mine.some(x => !x.ok) || fast < Math.ceil(mine.length * 0.6)) break;
      const cp = r.lessons.at(-1)!;
      const was = m.lessons[cp.id];
      if ((was?.stars ?? 0) > 0) continue;
      m.lessons[cp.id] = { ...(was ?? { bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: run.at, treasure: -1 }), stars: 1, testedOut: true };
      testedOut.push(r.id);
    }
  }

  m.totals = { trips: m.totals.trips + 1, facts: m.totals.facts + st.asked, ms: m.totals.ms + st.ms };
  m.history.push({ at: run.at, lessonId: lesson.id, fpm: st.fpm, acc: st.acc, score: st.score, stars: run.stars, ride: run.bestRide, ms: st.ms });
  if (m.history.length > 300) m.history.splice(0, m.history.length - 300);

  // ---- the day: math time counts toward the same daily goal ----
  const d = (p.days[day] ??= { ms: 0, runs: 0 });
  const wasGoal = !!d.goal;
  d.ms += st.ms;
  d.runs++;
  if (!d.goal && d.ms >= p.settings.dailyGoalMin * 60000) d.goal = true;
  const goalJustHit = !wasGoal && !!d.goal;
  p.rideBest = Math.max(p.rideBest, run.bestRide);

  // ---- medals ----
  const medals: string[] = [];
  if (run.finished && st.asked >= 10) {
    if (st.misses === 0) medals.push('clean');
    else if (st.acc >= 0.95) medals.push('sharp');
  }
  if (before && run.bestRide > before.bestRide) medals.push('ride-record');
  if (run.bestRide > 0) medals.push(`ride-${RIDES[run.bestRide].id}`);
  if (st.bestFastRow >= 10) medals.push('quickdraw');
  if (grew.bloomed.length) medals.push('bloom');
  if (passedNow && prev.attempts === 0) medals.push('firsttry');
  if (run.stars === 3) medals.push('three');
  if (goalJustHit) medals.push('goal');

  // ---- the buddy's own progress: the same friendship, outfits, dances and stickers as typing ----
  const pal: PalProgress = (p.pals[p.buddy] ??= newPalProgress());
  const lvlBefore = levelFromXp(pal.xp);
  pal.runs++;
  if (run.stars === 3) pal.stars3++;
  const perfect = run.finished && st.misses === 0 && st.asked >= 10;
  if (perfect) { pal.perfect++; pal.perfectRow++; } else if (run.finished) pal.perfectRow = 0;
  if (run.finished && st.acc >= 0.97 && st.asked >= 10) pal.sharp++;
  pal.rideBest = Math.max(pal.rideBest, run.bestRide);
  if (run.napped && run.finished) pal.naps++;
  if (goalJustHit && !pal.goalDays.includes(day)) pal.goalDays.push(day);
  const newBestTreasure = treasure > pal.treasureBest;
  pal.treasureBest = Math.max(pal.treasureBest, treasure);
  if (run.finished) pal.dances++;
  const medalWins: MedalWin[] = [];
  for (const id of medals) {
    const was = pal.medals[id] ?? 0;
    pal.medals[id] = was + 1;
    const tier = medalTier(was + 1);
    if (AWARD[id]) medalWins.push({ ...AWARD[id], count: was + 1, tier, tierUp: tier > medalTier(was) });
  }
  pal.medalsTotal += medals.length;
  const gained = tripXp(st, run.stars, medals.length, run.finished, grown);
  pal.xp += gained;
  const lvlAfter = levelFromXp(pal.xp);
  pal.level = lvlAfter.level;
  const rewards = newBetween(lvlBefore.level, lvlAfter.level);
  for (const r of rewards) if (!pal.seen.includes('reward:' + r.id)) pal.seen.push('reward:' + r.id);
  const stickers: StickerDef[] = [];
  for (const s of STICKERS) {
    if (pal.stickers[s.id]) continue;
    if (s.check(pal, { grown, friend: p.buddy })) { pal.stickers[s.id] = run.at; stickers.push(s); pal.seen.push('sticker:' + s.id); }
  }

  let regionJustDone: MathRegionId | null = null;
  if (lesson.region !== 'start' && lesson.kind === 'check' && passedNow && !(before && before.stars > 0)) regionJustDone = lesson.region;

  return {
    profile: p, medals: medalWins, stickers, rewards, treasure, newBestTreasure,
    xp: { gained, before: lvlBefore, after: lvlAfter },
    before, record,
    newBestScore: !!before && run.finished && st.score > before.bestScore,
    newBestRide: !!before && run.bestRide > before.bestRide,
    goalJustHit, regionJustDone, grew, slipped, testedOut,
  };
}

/** Every fact id in round one's garden: the tables 0 to 10, times 0 to 10. */
export const GARDEN_IDS = Array.from({ length: 11 }, (_, b) => Array.from({ length: 11 }, (_, a) => factId({ a, b }))).flat();
