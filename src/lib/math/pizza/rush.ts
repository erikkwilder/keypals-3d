// Pizza Rush: the fractions arcade game. Glimmers queue at the counter of a pizza shop with an order
// bubble ("3/4", "2/3", "1/2 + 1/4"); you cut the pizza (or it comes cut), tap the slices and serve.
// A round is two minutes: right orders in a row build a combo, quick ones earn a bonus, and a customer
// who waits too long just wanders off (nothing lost but the combo). Three stars by score, a best score,
// and a daily challenge (the same day, the same orders).
//
// The orders come from the fraction skills the player has met: everyone gets "tap the slices" and "cut
// it yourself"; equal fractions, adding and different bottoms join once their Meet lessons are done. Each
// first try counts in skill memory for subs already met (so it never brings in something new before its
// lesson does), and the round pays out like any practice; it doesn't open lessons.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';

export type OrderKind = 'tap' | 'cut' | 'equal' | 'add' | 'unlike';
export type Frac = { n: number; d: number };
export type Order = {
  kind: OrderKind;
  /** what the bubble says: fractions joined by + */
  parts: Frac[];
  /** how much pizza that is */
  want: Frac;
  /** how many slices the pizza comes cut into; null: whole, cut it yourself */
  slices: number | null;
  /** the skill memory key this order practises */
  key: string;
  points: number;
  /** how long the customer waits at the front */
  patienceMs: number;
};

export const GAME_ID = 'pizza-rush';
export const ROUND_MS = 120_000;
/** the cuts on offer (the cutter buttons) */
export const CUTS = [2, 3, 4, 6, 8, 12] as const;
/** score for one, two and three stars */
export const STAR_AT = [600, 1500, 2600] as const;
const POINTS: Record<OrderKind, number> = { tap: 100, cut: 120, equal: 140, add: 150, unlike: 180 };
const PATIENCE: Record<OrderKind, number> = { tap: 30_000, cut: 36_000, equal: 42_000, add: 42_000, unlike: 50_000 };
/** served this soon after reaching the front: a quick bonus */
export const QUICK_MS = 8000;
export const QUICK_BONUS = 40;

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const same = (a: Frac, b: Frac) => a.n * b.d === b.n * a.d;
export const fracText = (f: Frac) => `${f.n}/${f.d}`;
export const orderText = (o: Order) => o.parts.map(fracText).join(' + ');

/** The kinds of order this player can get: what their fraction memory has met. */
export function kindsFor(p: Profile): OrderKind[] {
  const mem = mathOf(p).skills ?? {};
  const met = (skill: string) => Object.entries(mem).some(([k, s]) => k.startsWith(`${skill}:`) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  const out: OrderKind[] = ['tap', 'cut'];
  if (met('fr-equal')) out.push('equal');
  if (met('fr-add')) out.push('add');
  if (met('fr-unlike')) out.push('unlike');
  return out;
}

/** The i-th order of a round: the first two are tap-the-slices with halves and quarters, then cutting
 *  comes in, then everything the player has met. Never loops. */
export function makeOrder(rng: Rng, i: number, kinds: readonly OrderKind[]): Order {
  const can = (k: OrderKind) => kinds.includes(k);
  const pool: OrderKind[] = i < 2 ? ['tap'] : i < 4 ? ['tap', 'cut'] : kinds.filter(k => k !== 'tap' || rng() < 0.6);
  const ok = pool.filter(can), kind: OrderKind = pick(rng, ok.length ? ok : ['tap']);
  const o = (parts: Frac[], want: Frac, slices: number | null, key: string): Order => ({ kind, parts, want, slices, key, points: POINTS[kind], patienceMs: PATIENCE[kind] });
  if (kind === 'tap' || kind === 'cut') {
    const d = i < 2 ? pick(rng, [2, 4, 4, 3]) : pick(rng, [2, 3, 4, 4, 6, 8]);
    const n = int(rng, 1, d - 1);
    return o([{ n, d }], { n, d }, kind === 'tap' ? d : null, kind === 'cut' && n === 1 ? 'fr-unit:one' : `fr-name:${d}`);
  }
  if (kind === 'equal') {
    // 2/4 on a pizza cut in 8: the slices are smaller, so it takes more of them
    const [d, k] = pick(rng, [[2, 2], [2, 3], [2, 4], [3, 2], [3, 4], [4, 2], [4, 3]] as const);
    const n = int(rng, 1, d - 1);
    return o([{ n, d }], { n, d }, d * k, `fr-equal:x${k}`);
  }
  if (kind === 'add') {
    const d = pick(rng, [3, 4, 4, 6, 8]);
    const a = int(rng, 1, d - 1), b = int(rng, 1, d - a);
    return o([{ n: a, d }, { n: b, d }], { n: a + b, d }, d, d <= 5 ? 'fr-add:small' : 'fr-add:mid');
  }
  // different bottoms: 1/2 + 1/4 on a pizza cut into quarters
  const [d1, d2] = pick(rng, [[2, 4], [2, 4], [2, 6], [2, 8], [3, 6], [4, 8], [3, 12], [4, 12]] as const);
  const m = d2 / d1, a = int(rng, 1, d1 - 1), b = int(rng, 1, d2 - a * m);
  return o([{ n: a, d: d1 }, { n: b, d: d2 }], { n: a * m + b, d: d2 }, d2, 'fr-unlike:fits');
}

/** Whether the slices picked from a pizza cut into `cut` are the order. */
export function servedRight(o: Order, cut: number, picked: number): boolean {
  return cut > 0 && picked > 0 && same({ n: picked, d: cut }, o.want);
}
/** The slices the order needs on this pizza (null if that cut can't make it). */
export function slicesNeeded(o: Order, cut: number): number | null {
  const x = (o.want.n * cut) / o.want.d;
  return Number.isInteger(x) && x > 0 ? x : null;
}
/** The cuts that can make the order. */
export const cutsFor = (o: Order) => CUTS.filter(c => slicesNeeded(o, c) !== null);
/** The order in its simplest form, for a gentle "that's the same as" line. */
export const simplest = (f: Frac): Frac => { const g = gcd(f.n, f.d) || 1; return { n: f.n / g, d: f.d / g }; };

/** The combo multiplier for an order served with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a right order. */
export const orderScore = (o: Order, combo: number, waitedMs: number) => Math.round(o.points * comboMult(combo)) + (waitedMs <= QUICK_MS ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `pizza-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** A round's orders come from one seed (the daily challenge's or a random one). */
export function orderMaker(seed: number, kinds: readonly OrderKind[]) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeOrder(rng, i++, kinds);
}

export const rushOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = rushOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type RushRun = {
  score: number; served: number; missed: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each order's first try */
  answers: { key: string; ok: boolean; thinkMs: number }[];
};
export type RushOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyRush(p0: Profile, run: RushRun): RushOutcome {
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
  // right answers warm the eggs like a trip's (a fraction is worth a couple of facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.served * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.served) * 2) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
