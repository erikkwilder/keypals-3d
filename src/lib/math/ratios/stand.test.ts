import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { SKILL, splitKey } from '../skills/registry';
import { BLENDER_MAX, applyStand, dailySeed, inRush, kindsFor, makeOrder, mixColor, orderMaker, orderScore, servedRight, standOf, starsFor, STAR_AT, type OrderKind } from './stand';

describe('Smoothie Stand', () => {
  it('makes orders at once whatever the random numbers, each one the recipe scaled and never more than the blender holds', () => {
    const all: OrderKind[] = ['scale', 'fill', 'percent'];
    for (const stuck of [0, 0.5, 0.999999]) for (let i = 0; i < 10; i++) makeOrder(() => stuck, i, all, { scale: 6, fill: 6, percent: 6 });
    for (const lv of [undefined, { scale: 1, fill: 1, percent: 1 }, { scale: 6, fill: 6, percent: 6 }]) {
      const next = orderMaker(42, all, lv);
      for (let i = 0; i < 400; i++) {
        const o = next();
        expect(o.want[0] + o.want[1]).toBeLessThanOrEqual(BLENDER_MAX);
        expect(o.want[0]).toBeGreaterThan(0); expect(o.want[1]).toBeGreaterThan(0);
        expect(o.fruits[0]).not.toBe(o.fruits[1]);
        expect(SKILL[splitKey(o.key).skill]?.subs.some(s => s.id === splitKey(o.key).sub)).toBe(true);
        if (o.kind === 'percent') { expect(o.want[0]).toBe((o.pct * o.scoops) / 100); expect(o.want[0] + o.want[1]).toBe(o.scoops); }
        else {
          const [a, b] = o.recipe;
          expect(o.want[0] * b).toBe(o.want[1] * a);
          expect(o.want).toEqual([o.cups * a, o.cups * b]);
          if (o.kind === 'fill') expect(o.start).toEqual([0, o.want[1]]);
        }
      }
    }
  });
  it('starts gentle: the first orders scale a recipe; a new player only scales', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2; i++) expect(makeOrder(rng, i, ['scale', 'fill', 'percent']).kind).toBe('scale');
    const p = newProfile('Mia', 'dino');
    expect(kindsFor(p)).toEqual(['scale']);
    const m = (p.math = mathOf(p));
    m.skills = { 'rt-pct:grid': { seen: 2, wrong: 0, stage: 1, last: 0, times: [], fastDays: [], step: 0, due: 0 } as never };
    expect(kindsFor(p)).toContain('percent');
  });
  it('serves right only with exactly the order in the blender; rush hours double, quick ones tip', () => {
    const o = makeOrder(mulberry32(3), 0, ['scale']);
    expect(servedRight(o, o.want)).toBe(true);
    expect(servedRight(o, [o.want[0], o.want[1] + 1])).toBe(false);
    expect(servedRight(o, [o.want[1], o.want[0]])).toBe(o.want[0] === o.want[1]);
    expect(orderScore(o, 0, 20_000, true)).toBe(2 * orderScore(o, 0, 20_000, false));
    expect(orderScore(o, 0, 3000, false)).toBeGreaterThan(orderScore(o, 0, 20_000, false));
    expect(inRush(40_000)).toBe(true); expect(inRush(10_000)).toBe(false);
  });
  it('a smoothie\'s colour mixes its fruit: the same recipe, bigger, is the same colour', () => {
    expect(mixColor([2, 3], ['straw', 'banana'])).toBe(mixColor([6, 9], ['straw', 'banana']));
    expect(mixColor([2, 3], ['straw', 'banana'])).not.toBe(mixColor([3, 2], ['straw', 'banana']));
  });
  it('a finished round keeps the best score and today\'s best, and pays out', () => {
    const at = Date.UTC(2026, 9, 30, 15);
    const out = applyStand(newProfile('Mia', 'dino'), { score: STAR_AT[1] + 10, served: 9, missed: 1, bestCombo: 5, tips: 3, ms: 120000, at, daily: true, answers: [] });
    expect(out.stars).toBe(2);
    expect(standOf(out.profile).best).toBe(STAR_AT[1] + 10);
    expect(standOf(out.profile).daily?.best).toBe(STAR_AT[1] + 10);
    expect(out.newBest).toBe(true);
    expect(starsFor(0)).toBe(0);
    expect(dailySeed(at)).toBe(dailySeed(at + 1000));
  });
});
