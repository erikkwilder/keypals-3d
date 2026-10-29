// Market Dash: the money arcade game. Glimmer shoppers queue at a stall on the floating bazaar, each
// wanting something with a price tag. Some pay exactly ("35¢ please!": tap coins into the tray to make
// 35¢); some hand over a coin or a dollar and wait for their change (you make the change). A round is two
// minutes: right ones in a row build a combo, quick ones earn a bonus, and a shopper who waits too long
// wanders off (only the combo is lost). Three stars by score, a best score, and a daily challenge (the
// same day, the same shoppers).
//
// What shoppers ask for grows with what the player has met: everyone pays exactly up to 50¢; change from
// 50¢, then amounts to a dollar and change from a dollar, join once their lessons are met. Each first try
// counts in skill memory for subs already met, and the round pays out like any practice; it doesn't open
// lessons.
import { mulberry32, type Rng } from '../../engine/rng';
import { buddyPal, dayKey, type Profile } from '../../engine/profile';
import { settlePractice, type Settled } from '../../engine/settle';
import { mathOf, type ArcadeRecord } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { fewest, moneyText } from '../skills/decimals';

export type OrderKind = 'exact' | 'exact-big' | 'change' | 'change-big';
export type Good = 'apple' | 'cupcake' | 'lollipop' | 'balloons' | 'boat' | 'flowers';
export const GOODS: Record<Good, { name: string; a: string }> = {
  apple: { name: 'an apple', a: 'apple' }, cupcake: { name: 'a cupcake', a: 'cupcake' }, lollipop: { name: 'a lollipop', a: 'lollipop' },
  balloons: { name: 'balloons', a: 'balloons' }, boat: { name: 'a toy boat', a: 'boat' }, flowers: { name: 'flowers', a: 'flowers' },
};
export type Order = {
  kind: OrderKind; good: Good;
  /** the price in cents */
  price: number;
  /** what the shopper hands over (cents); null: they want to pay exactly, and you make the price */
  paid: number | null;
  /** what goes in the tray: the price, or the change */
  want: number;
  /** the skill memory key this order practises */
  key: string;
  points: number;
  /** how long the shopper waits at the front */
  patienceMs: number;
};

export const GAME_ID = 'market-dash';
export const ROUND_MS = 120_000;
/** the coins in the bank, biggest first */
export const BANK = [25, 10, 5, 1] as const;
/** score for one, two and three stars */
export const STAR_AT = [500, 1300, 2300] as const;
const POINTS: Record<OrderKind, number> = { exact: 100, 'exact-big': 130, change: 150, 'change-big': 180 };
const PATIENCE: Record<OrderKind, number> = { exact: 32_000, 'exact-big': 40_000, change: 42_000, 'change-big': 50_000 };
/** served this soon after reaching the front: a quick bonus */
export const QUICK_MS = 9000;
export const QUICK_BONUS = 40;

const int = (rng: Rng, lo: number, hi: number) => Math.min(hi, lo + Math.floor(rng() * (hi - lo + 1)));
const pick = <T>(rng: Rng, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
const GOOD_IDS = Object.keys(GOODS) as Good[];

/** The kinds of order this player can get: what their money memory has met. */
export function kindsFor(p: Profile): OrderKind[] {
  const mem = mathOf(p).skills ?? {};
  const met = (prefix: string) => Object.entries(mem).some(([k, s]) => k.startsWith(prefix) && ((s.stage ?? 0) > 0 || (s.seen ?? 0) > 0));
  const out: OrderKind[] = ['exact'];
  if (met('dm-change:')) out.push('change');
  if (met('dm-make:to-100') || met('dm-coins:quarters')) out.push('exact-big');
  if (met('dm-change:to-100') || met('dm-change:dollars')) out.push('change-big');
  return out;
}

/** The i-th order of a round: the first two pay exactly with friendly prices, then everything the
 *  player has met. Never loops. */
export function makeOrder(rng: Rng, i: number, kinds: readonly OrderKind[]): Order {
  const can = (k: OrderKind) => kinds.includes(k);
  const pool: OrderKind[] = i < 2 ? ['exact'] : kinds.filter(k => k !== 'exact' || rng() < 0.7);
  const ok = pool.filter(can), kind: OrderKind = pick(rng, ok.length ? ok : ['exact']);
  const good = pick(rng, GOOD_IDS);
  const o = (price: number, paid: number | null, key: string): Order => ({ kind, good, price, paid, want: paid === null ? price : paid - price, key, points: POINTS[kind], patienceMs: PATIENCE[kind] });
  if (kind === 'exact') {
    // friendly at first (steps of 5), then any amount up to 50¢
    const price = i < 4 ? 5 * int(rng, 2, 10) : int(rng, 6, 50);
    return o(price, null, 'dm-make:to-50');
  }
  if (kind === 'exact-big') return o(int(rng, 51, 99), null, 'dm-make:to-100');
  if (kind === 'change') return o(5 * int(rng, 2, 9), 50, 'dm-change:to-50');
  return o(i < 6 ? 5 * int(rng, 6, 19) : int(rng, 26, 95), 100, 'dm-change:to-100');
}

/** Whether the coins in the tray are the order. */
export const servedRight = (o: Order, tray: number) => tray === o.want;
/** The order in words for the bubble: "35¢" or "paid 50¢ for 35¢". */
export const orderText = (o: Order) => (o.paid === null ? `${moneyText(o.price)} please!` : `Here's ${moneyText(o.paid)} for ${moneyText(o.price)}`);
/** One way to make what the tray needs (for a gentle hint after a slip). */
export const oneWay = (o: Order) => fewest(o.want).map(c => moneyText(c)).join(' + ');

/** The combo multiplier for an order served with `combo` right ones before it in a row. */
export const comboMult = (combo: number) => 1 + Math.min(combo, 8) * 0.25;
/** Points for a right order. */
export const orderScore = (o: Order, combo: number, waitedMs: number) => Math.round(o.points * comboMult(combo)) + (waitedMs <= QUICK_MS ? QUICK_BONUS : 0);
export const starsFor = (score: number): 0 | 1 | 2 | 3 => (score >= STAR_AT[2] ? 3 : score >= STAR_AT[1] ? 2 : score >= STAR_AT[0] ? 1 : 0);

/** Today's challenge: the same seed for everyone on this day. */
export function dailySeed(at: number): number {
  let h = 2166136261;
  for (const c of `market-${dayKey(at)}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
/** A round's orders come from one seed (the daily challenge's or a random one). */
export function orderMaker(seed: number, kinds: readonly OrderKind[]) {
  const rng = mulberry32(seed);
  let i = 0;
  return () => makeOrder(rng, i++, kinds);
}

export const dashOf = (p: Profile): ArcadeRecord => mathOf(p).arcade?.[GAME_ID] ?? { best: 0, stars: 0, plays: 0 };
export const dailyBestOf = (p: Profile, at = Date.now()) => { const d = dashOf(p).daily; return d && d.key === dayKey(at) ? d.best : 0; };

export type DashRun = {
  score: number; served: number; missed: number; bestCombo: number; ms: number; at: number; daily: boolean;
  /** each order's first try */
  answers: { key: string; ok: boolean; thinkMs: number }[];
};
export type DashOutcome = Settled & { profile: Profile; stars: 0 | 1 | 2 | 3; newBest: boolean; newDaily: boolean; best: number };

/** A finished round: skill memory for the subs already met, the record, and the practice payout. */
export function applyDash(p0: Profile, run: DashRun): DashOutcome {
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
  // right answers warm the eggs like a trip's (making an amount is worth a couple of facts)
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars, medals: stars === 3 ? ['three'] : [], right: Math.round(run.served * 2.5), xp: () => Math.round((25 + stars * 12 + Math.min(12, run.served) * 2) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, stars, newBest, newDaily, best: rec.best };
}
