// Smoothie Stand: the ratios arcade game. Glimmer customers queue at a jungle smoothie stand, each with an
// order: a recipe ("2 strawberries for every 3 bananas") and a size ("3 cups!"), so the recipe is scaled;
// or a recipe with one fruit already in the blender ("6 bananas in: add the strawberries"); or a percent
// mix ("8 scoops, half mango"). Tap fruit into the blender, then Blend. A round is two minutes: right ones
// in a row build a combo, quick ones get a tip, two rush hours bring the customers faster for double
// points, and a customer who waits too long wanders off (only the combo is lost). Three stars by score, a
// best score, and a daily challenge (the same day, the same customers).
//
// What customers ask for grows with what the player has met: everyone scales a recipe; "one fruit is in"
// orders join once ratio tables are met, percent mixes once percents are. Every order is pitched by the
// player's ability on its skill. Each first try counts in skill memory for subs already met, and the
// round pays out like any practice.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { dailyBonus, settlePractice, treasureFor, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { pitchRung, TARGET, thetaOf } from '../skills/ability';
import { FRUIT, FRUITS, fruitWord, type Fruit } from '../skills/ratioPic';

export type OrderKind = 'scale' | 'fill' | 'percent';
export type Order = {
  kind: OrderKind;
  /** the two fruits and the recipe: a of the first for every b of the second */
  fruits: [Fruit, Fruit]; recipe: [number, number];
  /** cups (scale), or how much of the second fruit is in already (fill) */
  cups: number;
  /** percent mixes: scoops in all, and the first fruit's percent */
  scoops: number; pct: number;
  /** what goes in the blender (the first fruit, the second) */
  want: [number, number];
  /** already in the blender when it's this customer's turn (fill orders) */
  start: [number, number];
  key: string; points: number; patienceMs: number; rung: number;
};

export const GAME_ID = 'smoothie-stand';
export const ROUND_MS = 120_000;
/** the most fruit the blender holds */
export const BLENDER_MAX = 30;
export const STAR_AT = [500, 1300, 2300] as const;
const POINTS: Record<OrderKind, number> = { scale: 110, fill: 140, percent: 150 };
const PATIENCE: Record<OrderKind, number> = { scale: 34_000, fill: 38_000, percent: 40_000 };
/** served this soon after reaching the front: a tip */
export const QUICK_MS = 10_000;
export const TIP = 40;
/** the two rush hours: [from, to] in the round, in ms; customers come faster and points double */
export const RUSH: [number, number][] = [[35_000, 55_000], [85_000, 105_000]];
export const inRush = (ms: number) => RUSH.some(([a, b]) => ms >= a && ms < b);

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
/** pairs with nothing to share (2 : 3, not 2 : 4) */
const PAIRS: [number, number][] = [[1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2], [1, 4], [4, 1], [3, 4], [4, 3], [2, 5], [5, 2], [3, 5]];

/** The kinds of order this player can get: what their ratios memory has met. */
export function kindsFor(p: Profile): OrderKind[] {
  const mem = mathOf(p).skills ?? {};
  const met = (prefix: string) => Object.entries(mem).some(([k, s]) => k.startsWith(prefix) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  const out: OrderKind[] = ['scale'];
  if (met('rt-table:') || met('rt-ratio:words')) out.push('fill');
  if (met('rt-pct:') || met('rt-pctof:')) out.push('percent');
  return out;
}
/** How hard each kind is for this player (their ability on its skill), pitched for a timed game. */
export function levelsFor(p: Profile): Partial<Record<OrderKind, number>> {
  const m = mathOf(p), now = Date.now(), g = !!p.settings.grown, t = (s: string) => thetaOf(m, s, now, g);
  return { scale: t('rt-table'), fill: t('rt-table'), percent: t('rt-pctof') };
}

/** The i-th order of a round: the first two scale a small recipe, then everything the player has met, as
 *  hard as their level on it. Rungs: 1-2 small recipes, 1 or 2 cups (percent: halves of 4 to 10 scoops) ·
 *  3 recipes to 4, up to 3 cups (quarters and tenths) · 4-6 recipes to 5, up to 4 cups (fifths, 20 scoops).
 *  Never loops; never more than the blender holds. */
export function makeOrder(rng: Rng, i: number, kinds: readonly OrderKind[], levels?: Partial<Record<OrderKind, number>>): Order {
  const pool: OrderKind[] = i < 2 ? ['scale'] : kinds.filter(k => k !== 'scale' || rng() < 0.6);
  const kind: OrderKind = pick(rng, pool.length ? pool : ['scale']);
  const th = levels?.[kind], r = th === undefined ? 3 : pitchRung(th, TARGET.quick, rng);
  const fi = int(rng, 0, 5), fruits: [Fruit, Fruit] = [FRUITS[fi], FRUITS[(fi + int(rng, 1, 5)) % 6]];
  const maxPart = r <= 2 ? 3 : r === 3 ? 4 : 5;
  const recipe = pick(rng, PAIRS.filter(([a, b]) => a <= maxPart && b <= maxPart));
  const o = (want: [number, number], start: [number, number], cups: number, scoops = 0, pct = 0, key = 'rt-table:down'): Order =>
    ({ kind, fruits, recipe, cups, scoops, pct, want, start, key, points: POINTS[kind], patienceMs: PATIENCE[kind], rung: r });
  if (kind === 'percent') {
    // a percent of the scoops is the first fruit, the rest the second
    const opts: [number, number[]][] = r <= 2 ? [[50, [4, 6, 8, 10]]] : r === 3 ? [[50, [8, 12, 16]], [25, [4, 8, 12, 16]], [75, [4, 8, 12]], [10, [10, 20]]] : [[25, [8, 12, 16, 20]], [75, [8, 12, 16]], [20, [10, 15, 20]], [40, [10, 15, 20]], [60, [10, 15, 20]], [30, [10, 20]]];
    const [pct, sizes] = pick(rng, opts), scoops = pick(rng, sizes), a = (pct * scoops) / 100;
    return o([a, scoops - a], [0, 0], 0, scoops, pct, pct % 10 === 0 && pct !== 50 ? 'rt-pctof:tens' : 'rt-pctof:half');
  }
  const [a, b] = recipe, top = Math.max(1, Math.min(r <= 2 ? 2 : r === 3 ? 3 : 4, Math.floor(BLENDER_MAX / (a + b))));
  const cups = int(rng, kind === 'fill' ? 2 : 1, Math.max(kind === 'fill' ? 2 : 1, top));
  if (kind === 'fill') return o([cups * a, cups * b], [0, cups * b], cups, 0, 0, 'rt-table:up');
  return o([cups * a, cups * b], [0, 0], cups);
}

/** Whether the blender holds the order. */
export const servedRight = (o: Order, have: [number, number]) => have[0] === o.want[0] && have[1] === o.want[1];
/** The order as words for the bubble and the screen reader. */
export function orderText(o: Order): string {
  const [f, g] = o.fruits, [a, b] = o.recipe;
  if (o.kind === 'percent') return `${o.scoops} scoops, ${o.pct}% ${FRUIT[f].one}, the rest ${FRUIT[g].one}!`;
  const mix = `${a} ${fruitWord(f, a)} for every ${b} ${fruitWord(g, b)}`;
  if (o.kind === 'fill') return `${mix}. There are ${o.start[1]} ${fruitWord(g, o.start[1])} in: add the ${FRUIT[f].many}!`;
  return `${mix}, ${o.cups === 1 ? 'one cup' : `${o.cups} cups`}!`;
}
/** A gentle word after a slip: how to work it out. */
export function helpText(o: Order): string {
  const [f, g] = o.fruits, [a, b] = o.recipe;
  if (o.kind === 'percent') return `${o.pct}% of ${o.scoops} is ${o.want[0]}: ${o.want[0]} ${fruitWord(f, o.want[0])} and ${o.want[1]} ${fruitWord(g, o.want[1])}.`;
  if (o.kind === 'fill') return `${o.start[1]} ${FRUIT[g].many} is ${o.cups} lots of ${b}, so ${o.cups} lots of ${a}: ${o.want[0]} ${fruitWord(f, o.want[0])}.`;
  return `Each cup is ${a} and ${b}. ${o.cups} cups: ${o.want[0]} ${fruitWord(f, o.want[0])} and ${o.want[1]} ${fruitWord(g, o.want[1])}.`;
}

export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a right order: the combo, a tip when it's quick, double in a rush hour. */
export function orderScore(o: Order, combo: number, waitedMs: number, rush: boolean) {
  const base = Math.round(o.points * comboMult(combo)) + (waitedMs <= QUICK_MS ? TIP : 0);
  return rush ? base * 2 : base;
}
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `smoothie-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function orderMaker(seed: number, kinds: readonly OrderKind[], levels?: Partial<Record<OrderKind, number>>) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeOrder(rng, i++, kinds, levels);
}

export const standOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = standOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type StandRun = {
  score: number; served: number; missed: number; bestCombo: number; tips: number; ms: number; at: number; daily: boolean;
  answers: { key: string; ok: boolean; thinkMs: number; rung?: number }[];
};
export type StandOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyStand(p0: Profile, run: StandRun): StandOutcome {
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
  let newDaily = false, dailyBefore = 0;
  if (run.daily) {
    const k = dayKey(run.at);
    if (rec.daily?.key !== k) rec.daily = { key: k, best: 0 };
    dailyBefore = rec.daily.best;
    newDaily = run.score > rec.daily.best;
    rec.daily.best = Math.max(rec.daily.best, run.score);
  }
  const pal = buddyPal(p);
  pal.runs++;
  if (stars === 3) pal.stars3++;
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.served * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.served) * 2) * (p.settings.grown ? 0.8 : 1)) , treasure: treasureFor(run.score, STAR_AT[2]) });
  // today's challenge: the same bonus shells as the Arcade's for beating its goal, once a day
  const bonus = dailyBonus(p, run.daily, dailyBefore, run.score, STAR_AT[1]);
  return { ...done, ...bonus, profile: p, stars, newBest, newDaily, best: rec.best };
}

/** a smoothie's colour: the fruit's colours mixed by how much of each */
export function mixColor(have: [number, number], fruits: [Fruit, Fruit]): string {
  const total = have[0] + have[1];
  if (!total) return '#f4efe6';
  const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = fruits.map(f => rgb(FRUIT[f].color));
  const k = have[0] / total;
  // a little lighter than the fruit itself: a smoothie, with yogurt
  const c = x.map((v, i) => Math.round((v * k + y[i] * (1 - k)) * 0.82 + 255 * 0.18));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}
