// The math game's part of a player's save, and what happens after every trip: the fact memory, lesson
// records, unlocking, and the same rewards as typing (the buddy's friendship, outfits and dances,
// medals, stickers, shells, eggs, the daily goal: engine/settle.ts). Pure functions over plain data, like
// engine/profile.ts.

import type { Profile, MedalWin, XpInfo } from '../engine/profile';
import { dayKey, buddyPal } from '../engine/profile';
import { newPalProgress, type PalProgress, type StickerDef } from '../engine/stickers';
import type { Reward } from '../engine/rewards';
import { settlePractice } from '../engine/settle';
import { mathComeback } from '../engine/achievements';
import { groupFacts, moveOf, MATH_LESSON, MATH_LESSONS, MATH_REGION, PLACEMENTS, regionsOf, type MathLesson, type MathRegionId } from './course';
import { factId, familyOf, isRuleFact, newStat, parseFact, seedPartner, updateFact, FAST_MS, type FactStat, type Op, type Stage } from './facts';
import { mathTreasureFor, type FactResult, type TripStats } from './meter';
import { factRung } from './course';
import { factAnswers, noteAbility, STRAND_SKILL, thetaOf } from './skills/ability';
import { applyPlacement, foundInStrand, placeStart, strandLadder, type Found } from './skills/placement';

export type MathLessonRecord = {
  stars: number; bestScore: number; bestFpm: number; bestAcc: number; bestRide: number;
  attempts: number; finishes: number; passes: number; lastAt: number;
  /** the best treasure step found on this trip */
  treasure?: number;
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
  /** the Learn lessons finished (lesson ids from math/learn.ts): their tricks show in battles */
  learned?: string[];
  /** the day each trick was learned (dayKey), for the quick check the next day */
  learnedOn?: Record<string, string>;
  /** what a lesson keeps about this child, by lesson id (a first guess: math/beats) */
  lessonNotes?: Record<string, Record<string, number>>;
  /** the tricks whose next-day quick check is done */
  checked?: string[];
  /** each fact's stage the last time the Fact Garden was opened, so new growth can pop in */
  gardenSeen?: Record<string, number>;
  /** the strand played last: +, −, × or ÷ (home's Play carries on there) */
  strand?: Op;
  /** the skill areas' memory (fractions and on), one record per skill and sub (`fr-name:4`), kept like
   *  the facts' own: sprout, bud, bloom, reviews (math/skills) */
  skills?: Record<string, FactStat>;
  /** how hard each skill's (and fact strand's) questions should be: an ability estimate in rungs, per
   *  skill id (`fr-name`, `mult-facts`), learned from every answer (math/skills/ability.ts); missing in
   *  older saves, which start from their memory */
  ability?: Record<string, import('./skills/ability').Ability>;
  /** the last Show What You Know, per area or strand: what it found, in words for grown-ups */
  placed?: Record<string, { at: number; comfortable: string[]; next: string[] }>;
  /** the Number Playground: best stars per level of each game */
  play?: Partial<Record<import('./playground').PlayGame, import('./playground').PlayRecord>>;
  /** the arcade games (Pizza Rush, by game id): best score and stars, plays, today's challenge best */
  arcade?: Record<string, ArcadeRecord>;
};
export type ArcadeRecord = { best: number; stars: number; plays: number; bestCombo?: number; daily?: { key: string; best: number }; /** a toy's builds done (Shape Builder) */ done?: string[] };

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

/** Regions open in order within their strand; each strand's first region is open from the start. */
export function mathRegionOpen(m: MathProgress, id: MathRegionId): boolean {
  const rs = regionsOf(MATH_REGION[id].op);
  const i = rs.findIndex(r => r.id === id);
  if (i <= 0) return true;
  const prev = rs[i - 1];
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
export function nextMathLesson(m: MathProgress, op: Op = m.strand ?? 'x'): MathLesson {
  for (const l of MATH_LESSONS) if (l.op === op && mathUnlocked(m, l) && !mathMovedOn(m, l)) return l;
  // the whole strand done: its last mix, which keeps the reviews coming
  return regionsOf(op).at(-1)!.lessons[2];
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
  /** Adventure eggs this trip warmed until they're ready to hatch */
  eggsReady?: import('../adventure/glimmers').Rarity[];
  /** Adventure shells this trip earned */
  shells?: number;
  buddies: import('../art/cast').FriendId[];
  medals: MedalWin[];
  stickers: StickerDef[];
  rewards: Reward[];
  /** the treasure this trip's score found (-1: none), and whether it's the player's best yet */
  treasure: number; newBestTreasure: boolean;
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
  /** a placement: what it found (comfortable with, next to grow) */
  placed?: Found;
};

/** Friendship XP for a trip, paced like a typing lesson's (a 20-fact trip earns about what 90 letters do). */
export function tripXp(st: TripStats, stars: number, medals: number, finished: boolean, grown: boolean) {
  return Math.round(st.asked * 2.2 * (0.5 + st.acc) * (grown ? 0.8 : 1) + stars * 10 + Math.min(medals, 5) * 4 + (finished ? 16 : 0)); // the finish bonus went up 6 when medals were pared down, to keep the pace
}

export function applyMathRun(p0: Profile, run: MathRunInput): MathOutcome {
  const lesson = MATH_LESSON[run.lessonId];
  const grown = !!p0.settings.grown;
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
  // a fact that blooms starts its family growing in the other operation: 3 + 5 plants 8 − 5 and 8 − 3,
  // 6 × 7 plants 42 ÷ 7 and 42 ÷ 6 (as sprouts; they still have to be asked to grow further)
  for (const id of stageBefore.keys()) {
    if ((m.facts[id]?.stage ?? 0) !== 3) continue;
    for (const fam of familyOf(parseFact(id))) { const fid = factId(fam); if (!m.facts[fid]?.stage) m.facts[fid] = { ...(m.facts[fid] ?? newStat()), stage: 1 }; }
  }
  // ---- how hard the questions should be: every first try moves the strand's ability; a placement sets it ----
  let placed: Found | undefined;
  const firsts = run.results.filter(r => !r.intro);
  if (lesson.region === 'start') {
    const ladder = strandLadder(lesson.op);
    const answers = firsts.map(r => { const rung = factRung(parseFact(r.id)); return { skill: STRAND_SKILL[lesson.op], rung, d: rung, ok: r.ok }; });
    if (run.finished && answers.length) {
      applyPlacement(m, ladder, answers, placeStart(mathOf(p0), ladder, run.at), run.at);
      placed = foundInStrand(m, lesson.op, run.at);
      m.placed = { ...(m.placed ?? {}), [lesson.op]: { at: run.at, ...placed } };
    }
  } else noteAbility(m, firsts.flatMap(r => factAnswers([{ f: parseFact(r.id), ok: r.ok, thinkMs: r.thinkMs }], run.at, fastMs, r.rung)), 'trip', grown);

  const grew = { bloomed: [] as string[], budded: [] as string[], sprouted: [] as string[] };
  const slipped: string[] = [];
  for (const [id, b] of stageBefore) {
    const a = m.facts[id]?.stage ?? 0;
    if (a > b) (a === 3 ? grew.bloomed : a === 2 ? grew.budded : grew.sprouted).push(id);
    else if (a < b) slipped.push(id);
  }

  // ---- the lesson record ----
  const before = m.lessons[lesson.id] ? { ...m.lessons[lesson.id] } : null;
  const prev = before ?? { stars: 0, bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: 0 };
  const passedNow = run.stars > 0;
  // the treasure the score found: the big picture on the results screen
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
    treasure: Math.max(prev.treasure ?? -1, treasure),
  };
  m.lessons[lesson.id] = record;
  m.strand = lesson.op;

  // ---- the placement trip: test out of the regions it covers, in order: each one whose facts came back all
  // right and mostly fast, or that it didn't ask but sits clearly below what the child showed (a rung past
  // its typical fact); the first that doesn't stops it ----
  const testedOut: MathRegionId[] = [];
  if (lesson.region === 'start' && run.finished) {
    const level = thetaOf(m, STRAND_SKILL[lesson.op], run.at);
    for (const r of regionsOf(lesson.op).filter(x => x.groups.some(g => lesson.groups.includes(g)))) {
      const ids = new Set(r.groups.flatMap(groupFacts).map(factId));
      const mine = run.results.filter(x => !x.intro && ids.has(x.id));
      const fast = mine.filter(x => x.ok && x.speed === 'fast').length;
      const rungs = r.groups.flatMap(groupFacts).filter(f => !isRuleFact(f)).map(factRung).sort((a, b) => a - b);
      const typical = rungs[Math.floor(rungs.length / 2)] ?? 1;
      const shown = mine.length > 0 && !mine.some(x => !x.ok) && fast >= Math.ceil(mine.length * 0.6);
      if (!shown && !(mine.length === 0 && level >= typical + 1)) break;
      const cp = r.lessons.at(-1)!;
      const was = m.lessons[cp.id];
      if ((was?.stars ?? 0) > 0) continue;
      m.lessons[cp.id] = { ...(was ?? { bestScore: 0, bestFpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, finishes: 0, passes: 0, lastAt: run.at }), stars: 1, testedOut: true };
      testedOut.push(r.id);
    }
  }

  m.totals = { trips: m.totals.trips + 1, facts: m.totals.facts + st.asked, ms: m.totals.ms + st.ms };
  m.history.push({ at: run.at, lessonId: lesson.id, fpm: st.fpm, acc: st.acc, score: st.score, stars: run.stars, ride: run.bestRide, ms: st.ms });
  if (m.history.length > 300) m.history.splice(0, m.history.length - 300);

  p.rideBest = Math.max(p.rideBest, run.bestRide);

  // ---- medals (reaching today's goal adds the goal medal) ----
  const medals: string[] = [];
  if (run.finished && st.asked >= 10 && st.misses === 0) medals.push('clean');
  if (before && run.bestRide > before.bestRide) medals.push('pb');
  if (st.bestFastRow >= 10) medals.push('quickdraw');
  if (grew.bloomed.length) medals.push('bloom');
  if (passedNow && prev.attempts === 0) medals.push('firsttry');
  if (run.stars === 3) medals.push('three');
  if (mathComeback(run.results, run.finished)) medals.push('comeback');

  // ---- the buddy's own counters (the stickers read them) ----
  const pal: PalProgress = buddyPal(p);
  pal.runs++;
  if (run.stars === 3) pal.stars3++;
  const perfect = run.finished && st.misses === 0 && st.asked >= 10;
  if (perfect) { pal.perfect++; pal.perfectRow++; } else if (run.finished) pal.perfectRow = 0;
  if (run.finished && st.acc >= 0.97 && st.asked >= 10) pal.sharp++;
  pal.rideBest = Math.max(pal.rideBest, run.bestRide);
  if (run.napped && run.finished) pal.naps++;

  // ---- the same ending as every practice game: math time counts toward the same daily goal, the same
  // friendship, outfits, dances and stickers as typing, and every right answer warms the eggs ----
  const done = settlePractice(p, { at: run.at, ms: st.ms, finished: run.finished, stars: run.stars, medals, right: run.results.filter(x => x.ok).length, xp: n => tripXp(st, run.stars, n, run.finished, grown), move: moveOf(lesson), treasure });

  let regionJustDone: MathRegionId | null = null;
  if (lesson.region !== 'start' && lesson.kind === 'check' && passedNow && !(before && before.stars > 0)) regionJustDone = lesson.region;

  return {
    eggsReady: done.eggsReady, shells: done.shells,
    buddies: done.buddies,
    profile: p, medals: done.medals, stickers: done.stickers, rewards: done.rewards,
    treasure: done.treasure, newBestTreasure: done.newBestTreasure,
    xp: done.xp,
    before, record,
    newBestScore: !!before && run.finished && st.score > before.bestScore,
    newBestRide: !!before && run.bestRide > before.bestRide,
    goalJustHit: done.goalJustHit, regionJustDone, grew, slipped, testedOut, placed,
  };
}

/** Every fact id in round one's garden: the tables 0 to 10, times 0 to 10. */
export const GARDEN_IDS = Array.from({ length: 11 }, (_, b) => Array.from({ length: 11 }, (_, a) => factId({ a, b }))).flat();
const r11 = Array.from({ length: 11 }, (_, i) => i);
/** Every fact id in each operation's garden: + and × as 11 by 11; − as take-away (0-10) by what's left
 *  (0-10); ÷ as divide-by (1-10) by the answer (0-10). */
export const GARDEN_BY_OP: Record<Op, string[]> = {
  x: GARDEN_IDS,
  '+': r11.flatMap(b => r11.map(a => factId({ a, b, op: '+' }))),
  '-': r11.flatMap(b => r11.map(d => factId({ a: b + d, b, op: '-' }))),
  '/': r11.slice(1).flatMap(b => r11.map(q => factId({ a: b * q, b, op: '/' }))),
};
/** Every fact in every garden. */
export const ALL_GARDEN_IDS = Object.values(GARDEN_BY_OP).flat();
