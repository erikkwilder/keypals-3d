// Market Stall, the Playground's money toy: no clock. You keep a little stall with three goods. First you
// price them (the − and + buttons, within the level's range); then six shoppers come, each buys one thing
// (two, on the last level) and pays with a quarter, two quarters or a dollar bill, and you give the change
// by tapping coins into the tray. A slip only costs stars, and a second slip shows the count-up.
import type { Rng } from '../../engine/rng';
import { shuffle } from '../../engine/rng';
import { moneyText } from '../skills/decimals';
import type { Good } from './dash';

export type StallLevel = {
  /** what every shopper pays with, in cents */
  pay: 25 | 50 | 100;
  /** the prices you can set */
  lo: number; hi: number; step: 1 | 5;
  /** shoppers buy two things (add them, then make change) */
  two?: boolean;
};
export const STALL_LEVELS: StallLevel[] = [
  { pay: 25, lo: 5, hi: 20, step: 5 },
  { pay: 50, lo: 5, hi: 45, step: 5 },
  { pay: 100, lo: 25, hi: 95, step: 5 },
  { pay: 100, lo: 11, hi: 99, step: 1 },
  { pay: 100, lo: 10, hi: 45, step: 5, two: true },
];
export const stallLevel = (level: number) => STALL_LEVELS[Math.max(0, Math.min(STALL_LEVELS.length - 1, level - 1))];
/** how many shoppers come in a round */
export const SHOPPERS = 6;
/** the goods on the stall: three of the market's six */
export const stallGoods = (rng: Rng): Good[] => shuffle(rng, ['apple', 'cupcake', 'lollipop', 'balloons', 'boat', 'flowers'] as Good[]).slice(0, 3);

const snap = (L: StallLevel, c: number) => Math.max(L.lo, Math.min(L.hi, Math.round(c / L.step) * L.step));
/** Starting prices: three different ones spread over the range (you can change them). */
export function startPrices(level: number, rng: Rng): number[] {
  const L = stallLevel(level), span = L.hi - L.lo;
  return [0.15, 0.5, 0.85].map((f, i) => snap(L, L.lo + span * f + (rng() - 0.5) * span * 0.2 + i * 0.001));
}
/** A price one step up or down, kept in the range. */
export const nudge = (level: number, price: number, dir: 1 | -1) => { const L = stallLevel(level); return snap(L, price + dir * L.step); };

/** The round's shoppers: which of the three goods each buys (two different ones on the last level).
 *  Every good gets bought at least once. Never loops. */
export function stallShoppers(level: number, rng: Rng, n = SHOPPERS): number[][] {
  const L = stallLevel(level);
  const firsts = [...shuffle(rng, [0, 1, 2]), ...Array.from({ length: Math.max(0, n - 3) }, () => Math.min(2, Math.floor(rng() * 3)))].slice(0, n);
  return firsts.map((a, i) => (L.two ? [a, (a + 1 + (i % 2)) % 3] : [a]));
}
/** What a shopper owes for what they bought. */
export const owed = (prices: number[], buys: number[]) => buys.reduce((t, i) => t + prices[i], 0);
/** The change due. */
export const changeDue = (level: number, prices: number[], buys: number[]) => stallLevel(level).pay - owed(prices, buys);

/** The shopkeeper's count-up from the price to what was paid: pennies to the next 5, a nickel to the next
 *  10, dimes (and a nickel) to the next 25, then quarters, and the biggest coin that fits for whatever is
 *  left. Each step moves closer, so it always ends. */
export function countUp(from: number, to: number): { coin: number; at: number }[] {
  const out: { coin: number; at: number }[] = [];
  let at = from;
  const step = (c: number) => { at += c; out.push({ coin: c, at }); };
  while (at % 5 && at < to) step(1);
  const next25 = Math.min(to, Math.ceil(at / 25) * 25);
  if (at % 10 && at + 5 <= next25) step(5);
  while (at + 10 <= next25) step(10);
  if (at + 5 <= next25) step(5);
  while (at + 25 <= to) step(25);
  for (const c of [10, 5, 1]) while (at + c <= to) step(c);
  return out;
}
/** The count-up in words: "From 35¢: 40¢, 50¢." */
export const countUpText = (from: number, to: number) => `From ${moneyText(from)}: ${countUp(from, to).map(s => moneyText(s.at)).join(', ')}.`;
