import { describe, expect, it } from 'vitest';
import { newProfile, dayKey } from '../engine/profile';
import { answerOf, factId, type Fact } from '../math/facts';
import { mathOf } from '../math/progress';
import { teamStats } from '../engine/team';
import { ARCADE, ARCADE_GAMES, FactDeck, applyArcade, arcadeTreasure, dailyGame, dailyGoal, dailySeed, distractors, seeded, starsFor, type ArcadeRun } from './arcade';

const facts: { f: Fact; stage: number; w?: number }[] = [];
for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) facts.push({ f: { a, b }, stage: 1, w: a === 7 && b === 8 ? 1 : 0 });

describe('Arcade', () => {
  it('has three games with rising star scores', () => {
    expect(ARCADE_GAMES.map(g => g.id)).toEqual(['slalom', 'catch', 'tower']);
    for (const g of ARCADE_GAMES) { expect(g.stars[0]).toBeLessThan(g.stars[1]); expect(g.stars[1]).toBeLessThan(g.stars[2]); }
    expect(starsFor('slalom', 0)).toBe(0);
    expect(starsFor('slalom', ARCADE.slalom.stars[2])).toBe(3);
  });
  it('deals the shaky facts more often and never the same one twice in a row', () => {
    const deck = new FactDeck(facts, seeded(5));
    let prev = '', seven8 = 0;
    for (let i = 0; i < 2000; i++) { const f = deck.next(); const id = factId(f); expect(id).not.toBe(prev); prev = id; if (id === '7x8') seven8++; }
    // 1 of 64 facts, three times as likely: about 3/66 of the draws (well above an even 1/64)
    expect(seven8 / 2000).toBeGreaterThan(1.8 / 64);
  });
  it('makes believable wrong answers, never the right one', () => {
    const r = seeded(9);
    for (const x of facts) { const d = distractors(x.f, 2, r); expect(d).toHaveLength(2); expect(d).not.toContain(answerOf(x.f)); expect(new Set(d).size).toBe(2); d.forEach(v => expect(v).toBeGreaterThanOrEqual(0)); }
    const plus = distractors({ a: 1, b: 1, op: '+' }, 2, r);
    expect(plus).not.toContain(2);
  });
  it('gives the same daily game and course to everyone on a day, and the games take turns', () => {
    expect(dailyGame('2026-10-30')).toBe(dailyGame('2026-10-30'));
    expect(dailySeed('slalom', '2026-10-30')).toBe(dailySeed('slalom', '2026-10-30'));
    expect(dailySeed('slalom', '2026-10-30')).not.toBe(dailySeed('slalom', '2026-10-31'));
    const seen = new Set(Array.from({ length: 30 }, (_, i) => dailyGame(`2026-11-${String(i + 1).padStart(2, '0')}`)));
    expect(seen.size).toBe(3);
  });
  it('a round feeds the fact memory, keeps the best score, pays out like practice and never opens lessons', () => {
    const p = newProfile('Ava', 'dino');
    const at = Date.now();
    const run: ArcadeRun = { id: 'slalom', score: ARCADE.slalom.stars[1] + 10, ms: 75000, at, daily: false,
      answered: [{ f: { a: 7, b: 8 }, ok: true, thinkMs: 2000 }, { f: { a: 6, b: 4 }, ok: false, thinkMs: 3000 }] };
    const out = applyArcade(p, run);
    expect(out.stars).toBe(2);
    expect(out.profile.arcade?.slalom).toMatchObject({ best: run.score, stars: 2, plays: 1 });
    const m = mathOf(out.profile);
    expect(m.facts['7x8'].right).toBe(1);
    expect(m.facts['6x4'].wrong).toBe(1);
    expect(out.shells).toBeGreaterThan(0);
    expect(out.xp.gained).toBeGreaterThan(0);
    expect(out.treasure).toBe(arcadeTreasure('slalom', run.score));
    // lessons untouched
    expect(Object.keys(out.profile.lessons)).toHaveLength(0);
    expect(Object.keys(m.lessons)).toHaveLength(0);
    // a worse round keeps the best
    const again = applyArcade(out.profile, { ...run, score: 100 });
    expect(again.best).toBe(run.score);
    expect(again.newBest).toBe(false);
    // and the stars count toward new buddies ("stars in any game")
    expect(teamStats(again.profile).stars).toBe(2);
  });
  it('the daily challenge pays its bonus once a day', () => {
    const p = newProfile('Ava', 'dino');
    const at = Date.now();
    const run: ArcadeRun = { id: 'catch', score: dailyGoal('catch') + 1, ms: 60000, at, daily: true, answered: [] };
    const a = applyArcade(p, run);
    expect(a.dailyBeat).toBe(true);
    expect(a.dailyShells).toBeGreaterThan(0);
    expect(a.profile.arcade?.catch?.daily).toEqual({ day: dayKey(at), best: run.score });
    const b = applyArcade(a.profile, { ...run, score: run.score + 50 });
    expect(b.dailyBeat).toBe(false);
    expect(b.dailyShells).toBe(0);
  });
});
