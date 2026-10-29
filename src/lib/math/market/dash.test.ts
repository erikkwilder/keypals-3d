import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { applyDash, dailySeed, dashOf, kindsFor, makeOrder, orderMaker, servedRight, starsFor, STAR_AT, type OrderKind } from './dash';

describe('Market Dash', () => {
  it('makes orders at once whatever the random numbers, with sensible amounts', () => {
    const all: OrderKind[] = ['exact', 'exact-big', 'change', 'change-big'];
    for (const stuck of [0, 0.5, 0.999999]) for (let i = 0; i < 10; i++) makeOrder(() => stuck, i, all);
    const next = orderMaker(42, all);
    for (let i = 0; i < 300; i++) {
      const o = next();
      expect(o.want).toBeGreaterThan(0);
      if (o.paid === null) { expect(o.want).toBe(o.price); expect(o.price).toBeLessThan(100); }
      else { expect(o.paid).toBeGreaterThan(o.price); expect(o.want).toBe(o.paid - o.price); }
      expect(o.key).toMatch(/^dm-(make|change):/);
    }
  });
  it('starts gentle: the first orders pay exactly, in steps of five', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2; i++) { const o = makeOrder(rng, i, ['exact', 'change']); expect(o.kind).toBe('exact'); expect(o.price % 5).toBe(0); }
  });
  it('a new player gets exact payments only; change joins once it is met', () => {
    const p = newProfile('Mia', 'dino');
    expect(kindsFor(p)).toEqual(['exact']);
    const m = (p.math = mathOf(p));
    m.skills = { 'dm-change:to-50': { seen: 2, wrong: 0, stage: 1, last: 0, times: [], fastDays: [], step: 0, due: 0 } as never };
    expect(kindsFor(p)).toContain('change');
  });
  it('serves right only with the exact amount in the tray', () => {
    const o = makeOrder(mulberry32(3), 0, ['exact']);
    expect(servedRight(o, o.want)).toBe(true);
    expect(servedRight(o, o.want + 1)).toBe(false);
  });
  it('a finished round keeps the best score and today\'s best, and pays out', () => {
    const at = Date.UTC(2026, 9, 30, 15);
    const out = applyDash(newProfile('Mia', 'dino'), { score: STAR_AT[1] + 10, served: 9, missed: 1, bestCombo: 5, ms: 120000, at, daily: true, answers: [] });
    expect(out.stars).toBe(2);
    expect(dashOf(out.profile).best).toBe(STAR_AT[1] + 10);
    expect(dashOf(out.profile).daily?.best).toBe(STAR_AT[1] + 10);
    expect(out.newBest).toBe(true);
    expect(starsFor(0)).toBe(0);
    expect(dailySeed(at)).toBe(dailySeed(at + 1000));
  });
});
