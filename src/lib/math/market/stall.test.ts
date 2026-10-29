import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { STALL_LEVELS, changeDue, countUp, countUpText, nudge, stallGoods, stallLevel, stallShoppers, startPrices, SHOPPERS } from './stall';

describe('Market Stall', () => {
  it('starting prices sit in each level\'s range, on its steps, whatever the random numbers', () => {
    for (let level = 1; level <= STALL_LEVELS.length; level++) {
      const L = stallLevel(level);
      for (const stuck of [0, 0.5, 0.999999]) for (const c of startPrices(level, () => stuck)) {
        expect(c).toBeGreaterThanOrEqual(L.lo); expect(c).toBeLessThanOrEqual(L.hi); expect(c % L.step).toBe(0);
      }
    }
  });
  it('nudging stays in the range', () => {
    expect(nudge(1, 20, 1)).toBe(20);
    expect(nudge(1, 5, -1)).toBe(5);
    expect(nudge(4, 50, 1)).toBe(51);
  });
  it('every shopper leaves change to give (never a price at or over what they pay)', () => {
    for (let level = 1; level <= STALL_LEVELS.length; level++) {
      const L = stallLevel(level);
      for (let s = 0; s < 40; s++) {
        const rng = mulberry32(s);
        // the dearest prices a player can set
        const prices = [L.hi, L.hi, L.hi];
        const shoppers = stallShoppers(level, rng);
        expect(shoppers).toHaveLength(SHOPPERS);
        for (const b of shoppers) { expect(changeDue(level, prices, b)).toBeGreaterThan(0); if (L.two) expect(new Set(b).size).toBe(2); }
        expect(new Set(shoppers.flat()).size).toBe(3);
      }
    }
    for (const stuck of [0, 0.999999]) expect(stallShoppers(5, () => stuck)).toHaveLength(SHOPPERS);
    expect(stallGoods(mulberry32(1))).toHaveLength(3);
  });
  it('the count-up always lands on what was paid, in friendly steps', () => {
    for (const to of [25, 50, 100]) for (let from = 0; from < to; from++) {
      const steps = countUp(from, to);
      expect(steps.at(-1)?.at ?? from).toBe(to);
      expect(steps.reduce((t, s) => t + s.coin, from)).toBe(to);
      expect(steps.length).toBeLessThanOrEqual(10);
    }
    expect(countUpText(35, 50)).toBe('From 35¢: 40¢, 50¢.');
    expect(countUp(30, 100).map(s => s.coin)).toEqual([10, 10, 25, 25]);
  });
});
