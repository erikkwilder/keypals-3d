// Spinner Showdown: the Data and chance arcade game, at a game booth at the Chance Fair. Popcorn Puffling
// runs the booth. Before each challenge the big wheel spins to pick what kind of question comes next (its
// parts are the kinds: Count, Graphs, Chance...), so the spin decides what you're asked, never what you
// win. The questions are the area's own skills, pitched from the child's ability for a quick game (about
// 90% right). Right answers win prize tickets: more for harder ones, a combo for right ones in a row, and
// a bonus for quick ones. Tickets buy nothing: they're the score.
//
// Every fourth challenge is a Best Bet: the wheel shows its colours in unequal amounts, you pick the colour
// you think it lands on most, and tickets come for picking the most likely colour (the smart bet), whatever
// it then lands on. The wheel really spins, fairly, and each landing goes on a little bar graph of the
// round's spins, so over a round the graph grows toward what the chances say.
//
// Two minutes a round, three stars by tickets, a best score, and a daily challenge (the same day, the same
// wheel and questions for everyone). Each first try counts in skill memory for subs already met.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, treasureFor, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { makeAt, pitchRung, TARGET, thetaOf } from '../skills/ability';
import { SKILL } from '../skills/registry';
import type { Item } from '../skills/types';
import { COLORS, type ColorId } from './pics';

export const GAME_ID = 'spinner-showdown';
export const ROUND_MS = 120_000;
/** tickets for one, two and three stars */
export const STAR_AT = [450, 1200, 2200] as const;
/** answered this soon (or within the skill's own quick time): a quick bonus */
export const QUICK_BONUS = 30;
/** every this many challenges, a Best Bet */
export const BET_EVERY = 4;
export const BET_TICKETS = 120;

/** The kinds of question the wheel can land on, each a few memory keys (skill:sub) of the area. The slow
 *  inputs (tapping a whole line plot) stay in practice; dragging a bar and the chance line come along. */
export const KINDS = {
  count: { name: 'Count', color: 'yellow', keys: ['da-sort:count', 'da-sort:most', 'da-sort:total'] },
  graph: { name: 'Graphs', color: 'blue', keys: ['da-picgraph:read', 'da-picgraph:more', 'da-bars:read', 'da-bars:more', 'da-bars:make'] },
  likely: { name: 'Likely?', color: 'green', keys: ['da-likely:words', 'da-likely:best', 'da-likely:line'] },
  plot: { name: 'Plots', color: 'orange', keys: ['da-lineplot:read', 'da-lineplot:diff', 'da-plots:dot', 'da-plots:hist', 'da-plots:box'] },
  middle: { name: 'Middle', color: 'purple', keys: ['da-mean:level', 'da-mean:list', 'da-middle:median', 'da-middle:mode', 'da-middle:range'] },
  chance: { name: 'Chance', color: 'red', keys: ['da-chance:bag', 'da-chance:spinner', 'da-chance:die', 'da-expect:predict', 'da-both:count'] },
} as const satisfies Record<string, { name: string; color: ColorId; keys: readonly string[] }>;
export type KindId = keyof typeof KINDS;
export const KIND_IDS = Object.keys(KINDS) as KindId[];

const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const met = (mem: Record<string, { stage?: number; seen?: number }>, key: string) => { const s = mem[key]; return !!s && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0); };

/** What this player can be asked: the keys of each kind they've met (a kind with none is left off the
 *  wheel). Someone new to the area gets counting and "how likely" (the youngest ones), and a grown-up or
 *  an older child who has met the later skills gets those. */
export function poolFor(p: Profile): Partial<Record<KindId, string[]>> {
  const mem = mathOf(p).skills ?? {};
  const metSkill = (sk: string) => Object.keys(mem).some(k => k.startsWith(sk + ':') && met(mem, k));
  const out: Partial<Record<KindId, string[]>> = {};
  for (const k of KIND_IDS) {
    const keys = KINDS[k].keys.filter(key => metSkill(key.split(':')[0]));
    if (keys.length) out[k] = keys;
  }
  if (!Object.keys(out).length) { out.count = ['da-sort:count', 'da-sort:most']; out.likely = ['da-likely:words']; }
  return out;
}

/** How hard each skill is pitched for this player (a quick game: about 90% right). */
export function thetasFor(p: Profile): Record<string, number> {
  const m = mathOf(p), now = Date.now(), g = !!p.settings.grown;
  return Object.fromEntries(Object.keys(SKILL).filter(id => id.startsWith('da-')).map(id => [id, thetaOf(m, id, now, g)]));
}

export type Challenge =
  /** a question: the wheel lands on its kind first */
  | { kind: 'q'; on: KindId; item: Item; key: string; points: number }
  /** a Best Bet: the wheel's parts, and the colour(s) with the most parts */
  | { kind: 'bet'; parts: ColorId[]; best: ColorId[]; points: number };

/** The wheel for a Best Bet: 8 or 10 parts in two or three colours, one colour always the most (no ties). */
const BET_SPLITS: number[][] = [[5, 3], [6, 2], [4, 3, 1], [4, 2, 2], [5, 2, 1], [6, 4], [7, 3], [5, 3, 2], [4, 3, 3], [6, 2, 2]];
export function betWheel(rng: Rng): { parts: ColorId[]; best: ColorId[] } {
  const split = pick(rng, BET_SPLITS);
  // the colours, shuffled (one pass)
  const cols = [...COLORS];
  for (let i = cols.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rng() * (i + 1))); [cols[i], cols[j]] = [cols[j], cols[i]]; }
  const left = split.map((n, i) => [cols[i], n] as [ColorId, number]);
  const best = [left[0][0]];
  // spread them round the wheel: the colour with the most left next, never the same twice in a row
  const parts: ColorId[] = [];
  const total = split.reduce((t, x) => t + x, 0);
  for (let i = 0; i < total; i++) {
    const order = left.filter(x => x[1] > 0).sort((x, y) => y[1] - x[1]);
    const prev = parts[parts.length - 1];
    const c = order.find(x => x[0] !== prev) ?? order[0];
    parts.push(c[0]); c[1]--;
  }
  return { parts, best };
}

/** The i-th challenge of a round: every BET_EVERY-th a Best Bet, the rest questions from the kinds in the
 *  pool, each pitched at the player's level (about 90% right). Never loops. */
export function makeChallenge(rng: Rng, i: number, pool: Partial<Record<KindId, string[]>>, thetas: Record<string, number>): Challenge {
  if (i % BET_EVERY === BET_EVERY - 1) { const w = betWheel(rng); return { kind: 'bet', ...w, points: BET_TICKETS }; }
  const kinds = (Object.keys(pool) as KindId[]);
  const on = pick(rng, kinds);
  const key = pick(rng, pool[on]!);
  const [sk, sub] = key.split(':');
  const s = SKILL[sk];
  const th = thetas[sk];
  const rung = th === undefined ? 3 : pitchRung(th, TARGET.quick, rng);
  const item = makeAt(s, rng, sub, rung);
  return { kind: 'q', on, item, key, points: 60 + 25 * Math.max(1, Math.min(5, item.weight)) };
}
export function challengeMaker(seed: number, pool: Partial<Record<KindId, string[]>>, thetas: Record<string, number>) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeChallenge(rng, i++, pool, thetas);
}

/** The combo multiplier for a right answer with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Tickets for a right answer. */
export const ticketsFor = (points: number, combo: number, quick: boolean) => Math.round(points * comboMult(combo)) + (quick ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);
/** Where a fair spin of the wheel lands: each part as likely as the others. */
export const spinLand = (parts: readonly ColorId[], r: number) => Math.min(parts.length - 1, Math.floor(r * parts.length));

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `showdown-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export const showdownOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = showdownOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type ShowRun = {
  score: number; right: number; missed: number; bets: number; bestCombo: number; ms: number; at: number; daily: boolean;
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type ShowOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory and ability for the subs already met, the record, and the payout. */
export function applyShowdown(p0: Profile, run: ShowRun): ShowOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const mem = m.skills ?? {};
  const known = run.answers.filter(x => met(mem, x.key));
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
  // right answers warm the eggs like a trip's (a graph question is worth a couple of facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.right * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.right) * 2) * (p.settings.grown ? 0.8 : 1)) , treasure: treasureFor(run.score, STAR_AT[2]) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
