import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { applyBuild, builtRight, dailySeed, kindsFor, makeOrder, orderMaker, orderScore, starsFor, tidy, toBlocks, valueOf, STAR_AT, type BuildKind } from './builder';

describe('Number Builder', () => {
  it('starts everyone on two-digit numbers, and adds kinds as their lessons are met', () => {
    const p = newProfile('Ava', 'dino');
    expect(kindsFor(p)).toEqual(['two']);
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'pv-hundreds:read', ok: true, thinkMs: 4000 }, { key: 'pv-skip:10', ok: true, thinkMs: 3000 }], Date.now());
    expect(kindsFor(p)).toEqual(['two', 'three', 'more']);
  });
  it('makes valid orders of every kind, never looping, the first three gentle', () => {
    const all: BuildKind[] = ['two', 'three', 'words', 'expanded', 'more'];
    const rng = mulberry32(4);
    for (let i = 0; i < 400; i++) {
      const o = makeOrder(rng, i, all);
      expect(o.target).toBeGreaterThan(0); expect(o.target).toBeLessThan(1000);
      expect(o.start).toBeGreaterThanOrEqual(0);
      if (i < 3) { expect(o.kind).toBe('two'); expect(o.target).toBeLessThan(50); }
      if (o.kind === 'more') expect(Math.abs(o.target - o.start)).toBeOneOf([10, 100]);
      // taking away never needs a hundred broken into tens
      if (o.kind === 'more' && o.target < o.start) expect(toBlocks(o.start)[o.start - o.target === 10 ? 't' : 'h']).toBeGreaterThan(0);
      expect(builtRight(o, toBlocks(o.target))).toBe(true);
    }
    for (const v of [0, 0.5, 0.9999]) for (let i = 0; i < 6; i++) expect(makeOrder(() => v, i, all).target).toBeGreaterThan(0);
  });
  it('counts any mix of blocks worth the number, and trades ten ones for a ten', () => {
    const o = makeOrder(mulberry32(1), 0, ['two']);
    expect(builtRight(o, { h: 0, t: Math.floor(o.target / 10) - 1, o: (o.target % 10) + 10 })).toBe(true);
    expect(tidy({ h: 1, t: 9, o: 12 })).toEqual({ b: { h: 2, t: 0, o: 2 }, tens: 1, hundreds: 1 });
    expect(valueOf(tidy({ h: 0, t: 3, o: 25 }).b)).toBe(55);
  });
  it('scores combos and quick builds, and gives stars by score', () => {
    const o = makeOrder(mulberry32(2), 0, ['two']);
    expect(orderScore(o, 0, 20_000)).toBe(100);
    expect(orderScore(o, 4, 3000)).toBe(200 + 40);
    expect(starsFor(STAR_AT[1])).toBe(2);
    expect(dailySeed(Date.UTC(2026, 10, 2, 12))).toBe(dailySeed(Date.UTC(2026, 10, 2, 13)));
    const a = orderMaker(9, ['two', 'three']), b = orderMaker(9, ['two', 'three']);
    for (let i = 0; i < 10; i++) expect(a().target).toBe(b().target);
  });
  it('pays out like practice, keeps the best and today\'s best, and only notes met skills', () => {
    const p = newProfile('Ava', 'dino');
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'pv-tens:read', ok: true, thinkMs: 4000 }], Date.now());
    const out = applyBuild(p, { score: 1800, built: 12, bestCombo: 6, ms: 100_000, at: Date.now(), daily: true, answers: [{ key: 'pv-tens:read', ok: true, thinkMs: 5000 }, { key: 'pv-hundreds:read', ok: true, thinkMs: 5000 }] });
    expect(out.stars).toBe(2);
    expect(out.newBest).toBe(true); expect(out.newDaily).toBe(true);
    const m = mathOf(out.profile);
    expect(m.arcade!['number-builder'].best).toBe(1800);
    expect(m.skills!['pv-tens:read'].seen).toBe(2);
    expect(m.skills!['pv-hundreds:read']).toBeUndefined();
    expect(out.shells).toBeGreaterThan(0);
  });
});
