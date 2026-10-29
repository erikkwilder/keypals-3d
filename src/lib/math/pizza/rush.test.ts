import { describe, expect, it } from 'vitest';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { SKILL } from '../skills/registry';
import { applyRush, cutsFor, dailySeed, kindsFor, makeOrder, orderMaker, orderScore, same, servedRight, slicesNeeded, starsFor, type OrderKind } from './rush';

const ALL: OrderKind[] = ['tap', 'cut', 'equal', 'add', 'unlike'];

describe('Pizza Rush orders', () => {
  it('never loop, and every order can be made: its slices, its sum, its skill key', () => {
    for (const c of [0, 0.37, 0.5, 0.999999]) {
      for (let i = 0; i < 30; i++) {
        const o = makeOrder(() => c, i, ALL);
        const sum = o.parts.reduce((t, f) => ({ n: t.n * f.d + f.n * t.d, d: t.d * f.d }), { n: 0, d: 1 });
        expect(same(sum, o.want), JSON.stringify(o)).toBe(true);
        expect(o.want.n).toBeGreaterThan(0);
        expect(o.want.n).toBeLessThanOrEqual(o.want.d);
        if (o.slices) expect(slicesNeeded(o, o.slices)).not.toBe(null);
        expect(cutsFor(o).length).toBeGreaterThan(0);
        const [skill, sub] = o.key.split(':');
        expect(SKILL[skill]?.subs.some(s => s.id === sub), o.key).toBe(true);
      }
    }
    // a seeded round runs on and on without trouble
    const next = orderMaker(42, ALL);
    for (let i = 0; i < 200; i++) next();
  });
  it('start with tap-the-slices halves, thirds and quarters, and only bring in what the player has met', () => {
    for (let s = 1; s < 40; s++) {
      const next = orderMaker(s, ['tap', 'cut']);
      const first = [next(), next()];
      expect(first.every(o => o.kind === 'tap' && o.want.d <= 4)).toBe(true);
      for (let i = 0; i < 20; i++) expect(['tap', 'cut']).toContain(next().kind);
    }
    const p = newProfile('Ava', 'dino');
    expect(kindsFor(p)).toEqual(['tap', 'cut']);
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'fr-add:small', ok: true, thinkMs: 4000 }], Date.now());
    expect(kindsFor(p)).toEqual(['tap', 'cut', 'add']);
  });
  it('a right order is the same amount of pizza, however it is cut', () => {
    const o = makeOrder(() => 0, 0, ['tap']);
    expect(o).toMatchObject({ kind: 'tap', slices: 2, want: { n: 1, d: 2 } });
    expect(servedRight(o, 2, 1)).toBe(true);
    expect(servedRight(o, 8, 4)).toBe(true);
    expect(servedRight(o, 8, 3)).toBe(false);
    expect(servedRight(o, 4, 0)).toBe(false);
    expect(cutsFor({ ...o, want: { n: 2, d: 3 } })).toEqual([3, 6, 12]);
  });
  it('combos and quick serves score more; stars by score; the daily seed is the same all day', () => {
    const o = makeOrder(() => 0, 0, ['tap']);
    expect(orderScore(o, 0, 20000)).toBe(100);
    expect(orderScore(o, 4, 2000)).toBe(240);
    expect(orderScore(o, 50, 20000)).toBe(300);
    expect([starsFor(0), starsFor(600), starsFor(1600), starsFor(9999)]).toEqual([0, 1, 2, 3]);
    const morning = new Date(2026, 9, 29, 8).getTime(), night = new Date(2026, 9, 29, 21).getTime(), next = new Date(2026, 9, 30, 8).getTime();
    expect(dailySeed(morning)).toBe(dailySeed(night));
    expect(dailySeed(morning)).not.toBe(dailySeed(next));
  });
});

describe('a Pizza Rush round', () => {
  it('counts first tries only for subs already met, keeps the best and the daily best, pays out, opens nothing', () => {
    const p0 = newProfile('Ava', 'dino');
    noteSkillAnswers((p0.math = mathOf(p0)), [{ key: 'fr-name:4', ok: true, thinkMs: 4000 }], Date.now());
    const at = Date.now();
    const run = { score: 1700, served: 9, missed: 1, bestCombo: 6, ms: 120000, at, daily: true, answers: [{ key: 'fr-name:4', ok: true, thinkMs: 3000 }, { key: 'fr-add:mid', ok: true, thinkMs: 5000 }] };
    const out = applyRush(p0, run);
    const m = mathOf(out.profile);
    expect(m.skills!['fr-name:4'].seen).toBe(2);
    expect(m.skills!['fr-add:mid']).toBeUndefined();
    expect(out).toMatchObject({ stars: 2, newBest: true, newDaily: true, best: 1700 });
    expect(m.arcade!['pizza-rush']).toMatchObject({ best: 1700, stars: 2, plays: 1, bestCombo: 6 });
    expect(out.shells).toBeGreaterThan(0);
    expect(Object.keys(m.lessons)).toEqual(Object.keys(mathOf(p0).lessons));
    const again = applyRush(out.profile, { ...run, score: 900 });
    expect(again).toMatchObject({ newBest: false, newDaily: false, best: 1700 });
    expect(mathOf(again.profile).arcade!['pizza-rush'].plays).toBe(2);
  });
});
