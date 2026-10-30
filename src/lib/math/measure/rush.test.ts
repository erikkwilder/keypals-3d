import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { applyRush, dailySeed, makeOrder, orderMaker, orderScore, rightAnswer, rushOf, skillsFor, starsFor, STAR_AT } from './rush';
import { clockMins } from '../skills/measure';

describe('Clock Rush', () => {
  it('starts everyone on o\'clock, and brings in the time skills they have met', () => {
    const p = newProfile('Kid', 'dino');
    expect(skillsFor(p)).toEqual(['ms-hour']);
    p.math = { ...mathOf(p), skills: { 'ms-five:read': { stage: 1, seen: 3 } as never } };
    expect(skillsFor(p)).toContain('ms-five');
  });
  it('makes every kind of order, each answerable, the first two gentle o\'clock ones', () => {
    const rng = mulberry32(3), kinds = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const o = makeOrder(rng, i % 40, ['ms-hour', 'ms-five', 'ms-minute', 'ms-elapsed'], { 'ms-hour': 3, 'ms-five': 3, 'ms-minute': 3, 'ms-elapsed': 3 });
      kinds.add(o.kind);
      expect(rightAnswer(o, o.item.answer)).toBe(true);
      if (i % 40 < 2) expect(o.item.skill).toBe('ms-hour');
      if (o.kind === 'catch') {
        expect(o.clocks).toHaveLength(o.item.choices!.length);
        const right = o.clocks!.find(c => c.id === (o.item.answer as { id: string }).id)!;
        expect(clockMins(right.h, right.m)).toBe(clockMins(o.target![0], o.target![1]));
        expect(new Set(o.clocks!.map(c => clockMins(c.h, c.m))).size).toBe(o.clocks!.length);
      }
      if (o.kind === 'set') expect(o.item.custom?.name).toBe('clock');
      if (o.kind === 'train') expect(o.item.skill).toBe('ms-elapsed');
    }
    expect([...kinds].sort()).toEqual(['catch', 'read', 'set', 'train']);
  });
  it("today's challenge is the same clocks for everyone", () => {
    const a = orderMaker(dailySeed(Date.UTC(2026, 9, 30, 12)), ['ms-hour', 'ms-five']), b = orderMaker(dailySeed(Date.UTC(2026, 9, 30, 12)), ['ms-hour', 'ms-five']);
    for (let i = 0; i < 10; i++) expect(a().item.id).toBe(b().item.id);
  });
  it('scores combos and quick ones, gives stars, and keeps the best', () => {
    const o = makeOrder(mulberry32(1), 0, ['ms-hour']);
    expect(orderScore(o, 4, 2000)).toBeGreaterThan(orderScore(o, 0, 9000));
    expect(starsFor(STAR_AT[0])).toBe(1); expect(starsFor(STAR_AT[2])).toBe(3); expect(starsFor(0)).toBe(0);
    const p = newProfile('Kid', 'dino');
    const out = applyRush(p, { score: STAR_AT[1] + 10, done: 12, missed: 2, bestCombo: 5, ms: 100_000, at: Date.now(), daily: true, answers: [] });
    expect(out.stars).toBe(2); expect(out.newBest).toBe(true);
    expect(rushOf(out.profile).best).toBe(STAR_AT[1] + 10);
    expect(rushOf(out.profile).daily?.best).toBe(STAR_AT[1] + 10);
  });
});
