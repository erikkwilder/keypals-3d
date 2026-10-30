import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { colourGap, CONTRAST, GLASSES, JUG_MAX, labMatch, labNudge, labOrders } from './lab';
import { mixColor } from './stand';
import { PLAY_GAME } from '../playground';

describe('Smoothie Lab', () => {
  it('six glasses a round on every level, each one that fits the jug, made at once', () => {
    for (let lv = 1; lv <= 5; lv++) for (const stuck of [0, 0.5, 0.999999]) expect(labOrders(lv, () => stuck)).toHaveLength(GLASSES);
    for (let lv = 1; lv <= 5; lv++) for (const o of labOrders(lv, mulberry32(lv))) {
      expect(o.fruits[0]).not.toBe(o.fruits[1]);
      expect(o.ratio[0] + o.ratio[1]).toBeLessThanOrEqual(JUG_MAX);
      if (o.first !== undefined) { expect(o.first % o.ratio[0]).toBe(0); expect(o.first + (o.first / o.ratio[0]) * o.ratio[1]).toBeLessThanOrEqual(JUG_MAX); }
      if (o.total !== undefined) { expect(o.total % (o.ratio[0] + o.ratio[1])).toBe(0); expect(o.total).toBeLessThanOrEqual(JUG_MAX); }
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
    expect(labNudge(o, [4, 3], ['strawberries', 'bananas'])).toMatch(/more bananas/);
    expect(labNudge(o, [1, 3], ['strawberries', 'bananas'])).toMatch(/more strawberries/);
    expect(labNudge(o, [5, 9], ['strawberries', 'bananas'])).toMatch(/^A bit more strawberries/);
    // a jug line: the same mix, the right size
    expect(labMatch({ ...o, total: 15 }, [2, 3])).toBe(false);
    expect(labMatch({ ...o, total: 15 }, [6, 9])).toBe(true);
    expect(labNudge({ ...o, total: 15 }, [2, 3], ['strawberries', 'bananas'])).toMatch(/fill the jug to the line, 15/);
  });
  it('most glasses need a bigger mix than the smallest one (1 : 3 won\'t do when it asks for 2 : 6)', () => {
    for (let seed = 1; seed <= 40; seed++) for (const lv of [1, 2, 4, 5]) {
      const os = labOrders(lv, mulberry32(seed));
      const need = os.filter(o => o.first !== undefined || o.total !== undefined);
      expect(need.length).toBeGreaterThanOrEqual(lv === 4 ? 6 : lv === 1 ? 4 : 5);
      for (const o of need) {
        // the smallest mix is wrong, a bigger equal one is right
        expect(labMatch(o, o.ratio)).toBe(false);
        const k = o.first !== undefined ? o.first / o.ratio[0] : o.total! / (o.ratio[0] + o.ratio[1]);
        expect(k).toBeGreaterThanOrEqual(2);
        expect(labMatch(o, [o.ratio[0] * k, o.ratio[1] * k])).toBe(true);
      }
    }
  });
  it('matching by colour: fruits far apart in colour, mixes easy to tell apart, any equal mix', () => {
    expect(CONTRAST.length).toBeGreaterThanOrEqual(6);
    for (let seed = 1; seed <= 30; seed++) for (const o of labOrders(3, mulberry32(seed))) {
      expect(o.card).toBe('none');
      expect(colourGap(mixColor([1, 0], o.fruits), mixColor([0, 1], o.fruits))).toBeGreaterThan(110);
      expect(o.ratio[0] === o.ratio[1] || o.ratio[0] * o.ratio[1] <= 3).toBe(true);
      expect(labMatch(o, [o.ratio[0] * 3, o.ratio[1] * 3])).toBe(true);
    }
  });
});
