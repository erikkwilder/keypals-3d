// Balance Beam: the expressions and equations arcade game, on the Star Lab's rooftop. A golden seesaw
// stands on a star pivot; mystery boxes and brass weights drop onto its left end and weights onto its
// right. The boxes all weigh the same, and the seesaw only stays level if you say what one weighs: it
// starts to tip (faster on the later puzzles), and you type the weight of a box before it goes over.
// Right: the boxes light up with their number, the beam swings level, star dust bursts, and the boxes
// fly onto the Star Stack beside it (right ones in a row stack it higher, with a bonus every 5).
// Wrong: the beam jolts further over and the stack is knocked down. If it tips all the way, the boxes
// slide off and the next puzzle drops in. A round is 90 seconds: combos, a quick bonus, three stars, a
// best score and a daily challenge (the same day, the same puzzles).
//
// The puzzles grow with what the player has met and are pitched by ability (skills/ability.ts): a box
// and weights (□ + 3 = 8) for everyone; boxes on their own (3x = 12) once times equations are met; boxes
// and weights (2x + 3 = 11) once two-step equations are. Each first try counts in skill memory for subs
// already met, and the round pays out like any practice.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { pitchRung, TARGET, thetaOf } from '../skills/ability';
import { perRung } from '../skills/types';

export type PuzzleKind = 'add' | 'times' | 'two';
export type Puzzle = {
  kind: PuzzleKind;
  /** boxes and weights on the left, weights on the right; each box weighs `ans` */
  boxes: number; left: number; right: number; ans: number;
  /** the skill memory key it practises, its points and how long the beam takes to tip */
  key: string; points: number; tipMs: number;
  /** how hard it was pitched (1..6; 3 when there's no ability to go by) */
  rung: number;
};

export const GAME_ID = 'balance-beam';
export const ROUND_MS = 90_000;
/** score for one, two and three stars */
export const STAR_AT = [500, 1300, 2300] as const;
const POINTS: Record<PuzzleKind, number> = { add: 100, times: 120, two: 160 };
const TIP: Record<PuzzleKind, number> = { add: 17_000, times: 19_000, two: 25_000 };
/** right this soon after the puzzle lands: a quick bonus */
export const QUICK_MS = 6000;
export const QUICK_BONUS = 40;
/** every this many right in a row, the Star Stack pays a bonus */
export const STACK_EVERY = 5;
export const STACK_BONUS = 150;
/** a wrong answer tips the beam this much further (of the whole way) */
export const JOLT = 0.18;

const int = (rng: Rng, lo: number, hi: number) => (hi <= lo ? lo : Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1))));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
/** each kind's skill (its ability pitches the puzzle) and the memory key a first try counts for */
const SKILL_OF: Record<PuzzleKind, { skill: string; key: string }> = {
  add: { skill: 'al-missing', key: 'al-missing:balance' }, times: { skill: 'al-one', key: 'al-one:times' }, two: { skill: 'al-two', key: 'al-two:plus' },
};

/** The kinds of puzzle this player can get: what their algebra memory has met. */
export function kindsFor(p: Profile): PuzzleKind[] {
  const mem = mathOf(p).skills ?? {};
  const met = (prefix: string) => Object.entries(mem).some(([k, s]) => k.startsWith(prefix) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  const out: PuzzleKind[] = ['add'];
  if (met('al-one:times') || met('al-one:') || met('al-missing:times')) out.push('times');
  if (met('al-two:') || met('al-system:')) out.push('two');
  return out;
}
/** How hard each kind is for this player: their ability on its skill, as a rung pitched later. */
export function levelsFor(p: Profile): Partial<Record<PuzzleKind, number>> {
  const m = mathOf(p), now = Date.now(), g = !!p.settings.grown, t = (s: string) => thetaOf(m, s, now, g);
  return { add: t('al-missing'), times: t('al-one'), two: t('al-two') };
}

/** The i-th puzzle of a round: the first two are a box and weights, then everything the player has met,
 *  each pitched at about 90% right (a timed game). The rungs: 1 a box and up to 3, to 8 · 2 to 13 · 3 to
 *  20 · 4-6 bigger, and more boxes. The beam tips a little faster as the round goes on. Never loops. */
export function makePuzzle(rng: Rng, i: number, kinds: readonly PuzzleKind[], levels?: Partial<Record<PuzzleKind, number>>): Puzzle {
  const pool = i < 2 ? ['add' as const] : kinds.filter(k => k !== 'add' || rng() < 0.6);
  const kind: PuzzleKind = pick(rng, pool.length ? pool : ['add']);
  const th = levels?.[kind], r = th === undefined ? 3 : pitchRung(th, TARGET.quick, rng);
  let boxes = 1, left = 0, ans = 1;
  if (kind === 'add') { ans = int(rng, 1, perRung(r, [5, 8, 12, 15, 20, 25])); left = int(rng, 1, perRung(r, [3, 5, 9, 12, 15, 20])); }
  else if (kind === 'times') { boxes = int(rng, 2, perRung(r, [2, 3, 4, 5, 5, 6])); ans = int(rng, 1, perRung(r, [5, 6, 8, 9, 10, 12])); }
  else { boxes = int(rng, 2, perRung(r, [2, 2, 3, 3, 4, 5])); left = int(rng, 1, perRung(r, [3, 5, 6, 9, 10, 12])); ans = int(rng, 1, perRung(r, [5, 6, 8, 9, 10, 12])); }
  const speed = Math.max(0.7, 1 - Math.floor(i / 3) * 0.05);
  return { kind, boxes, left, right: boxes * ans + left, ans, key: SKILL_OF[kind].key, points: POINTS[kind] + (r >= 4 ? 20 : 0), tipMs: Math.round(TIP[kind] * speed), rung: r };
}
/** The puzzle as an equation: □ + 3 = 8, 3x = 12, 2x + 3 = 11. */
export function puzzleText(z: Puzzle): string {
  if (z.kind === 'add') return `□ + ${z.left} = ${z.right}`;
  return `${z.boxes}x${z.left ? ` + ${z.left}` : ''} = ${z.right}`;
}
/** How it's solved, for a gentle word after a slip. */
export function puzzleHow(z: Puzzle): string {
  const after = z.right - z.left;
  if (z.boxes === 1) return `Take ${z.left} off both sides: ${z.right} − ${z.left} = ${z.ans}.`;
  return `${z.left ? `Take ${z.left} off both sides: ${after}. ` : ''}Share ${after} between ${z.boxes} boxes: ${z.ans} each.`;
}

/** The combo multiplier for a puzzle solved with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a right puzzle (and the Star Stack bonus when the stack reaches a multiple of 5). */
export const puzzleScore = (z: Puzzle, combo: number, ms: number) => Math.round(z.points * comboMult(combo)) + (ms <= QUICK_MS ? QUICK_BONUS : 0) + ((combo + 1) % STACK_EVERY === 0 ? STACK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `balance-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** A round's puzzles come from one seed (the daily challenge's or a random one). */
export function puzzleMaker(seed: number, kinds: readonly PuzzleKind[], levels?: Partial<Record<PuzzleKind, number>>) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makePuzzle(rng, i++, kinds, levels);
}

export const beamOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = beamOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type BeamRun = {
  score: number; solved: number; tipped: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each puzzle's first try (and the rung it was pitched at) */
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type BeamOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyBeam(p0: Profile, run: BeamRun): BeamOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const mem = m.skills ?? {};
  const known = run.answers.filter(x => (mem[x.key]?.stage ?? 0) > 0 || (mem[x.key]?.seen ?? 0) > 0);
  if (known.length) noteSkillAnswers(m, known, run.at);
  const stars = starsFor(run.score);
  const rec = ((m.arcade ??= {})[GAME_ID] ??= { best: 0, stars: 0, plays: 0 });
  const newBest = run.score > rec.best;
  rec.best = Math.max(rec.best, run.score); rec.stars = Math.max(rec.stars, stars); rec.plays++;
  rec.bestCombo = Math.max(rec.bestCombo ?? 0, run.bestCombo);
  let newDaily = false;
  if (run.daily) {
    const k = dayKey(run.at);
    if (rec.daily?.key !== k) rec.daily = { key: k, best: 0 };
    newDaily = run.score > rec.daily.best;
    rec.daily.best = Math.max(rec.daily.best, run.score);
  }
  const pal = buddyPal(p);
  pal.runs++;
  if (stars === 3) pal.stars3++;
  // right answers warm the eggs like a trip's (an equation is worth a few facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.solved * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.solved) * 2) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
