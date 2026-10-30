import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { GLASSES, JUG_MAX, labMatch, labNudge, labOrders } from './lab';
import { mixColor } from './stand';
import { PLAY_GAME } from '../playground';

describe('Smoothie Lab', () => {
  it('six glasses a round on every level, each one that fits the jug, made at once', () => {
    for (let lv = 1; lv <= 5; lv++) for (const stuck of [0, 0.5, 0.999999]) expect(labOrders(lv, () => stuck)).toHaveLength(GLASSES);
    for (let lv = 1; lv <= 5; lv++) for (const o of labOrders(lv, mulberry32(lv))) {
      expect(o.fruits[0]).not.toBe(o.fruits[1]);
      expect(o.ratio[0] + o.ratio[1]).toBeLessThanOrEqual(JUG_MAX);
      if (o.first !== undefined) { expect(o.first % o.ratio[0]).toBe(0); expect(o.first + (o.first / o.ratio[0]) * o.ratio[1]).toBeLessThanOrEqual(JUG_MAX); }
      if (o.pct !== undefined) expect((o.ratio[0] / (o.ratio[0] + o.ratio[1])) * 100).toBeCloseTo(o.pct, 6);
    }
    expect(PLAY_GAME.lab.levels).toHaveLength(5);
  });
  it('any mix in the same ratio matches (and is the same colour); a different one does not', () => {
    const o = { fruits: ['straw', 'banana'] as ['straw', 'banana'], ratio: [2, 3] as [number, number], card: 'recipe' as const };
    expect(labMatch(o, [2, 3])).toBe(true);
    expect(labMatch(o, [6, 9])).toBe(true);
    expect(labMatch(o, [3, 2])).toBe(false);
    expect(labMatch(o, [2, 0])).toBe(false);
    expect(mixColor([2, 3], o.fruits)).toBe(mixColor([6, 9], o.fruits));
    // a bigger jug needs the set amount of the first fruit
    expect(labMatch({ ...o, first: 6 }, [2, 3])).toBe(false);
    expect(labMatch({ ...o, first: 6 }, [6, 9])).toBe(true);
    expect(labNudge(o, [4, 3], ['strawberries', 'bananas'])).toMatch(/too much strawberries/);
    expect(labNudge(o, [1, 3], ['strawberries', 'bananas'])).toMatch(/Not enough strawberries/);
  });
});
