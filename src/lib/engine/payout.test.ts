// Every math area's own arcade game pays through the shared practice payout (settle.ts) the way the
// Arcade's fact games do: a three-star round finds treasure, earns shells and friendship in line with
// them, and a round that scores nothing still gets the finishing shells. No area pays double or nothing.
import { describe, expect, it } from 'vitest';
import { newProfile } from './profile';
import { treasureFor } from './settle';
import { ARCADE, applyArcade } from '../arcade/arcade';
import * as pizza from '../math/pizza/rush';
import * as builder from '../math/place/builder';
import * as dash from '../math/market/dash';
import * as clock from '../math/measure/rush';
import * as shifter from '../math/shapes/shifter';
import * as stand from '../math/ratios/stand';
import * as treasure from '../math/integers/treasure';
import * as showdown from '../math/data/showdown';
import * as beam from '../math/algebra/beam';

const at = Date.UTC(2026, 9, 20, 15);
const base = { ms: 90_000, at, daily: false, answers: [], bestCombo: 6 };
/** each area game's round at a score, played by a new player */
const GAMES: Record<string, { top: number; play: (score: number) => { stars: number; shells: number; treasure: number; xp: { gained: number } } }> = {
  pizza: { top: pizza.STAR_AT[2], play: score => pizza.applyRush(newProfile('A', 'dino'), { ...base, score, served: 12, missed: 1 }) },
  builder: { top: builder.STAR_AT[2], play: score => builder.applyBuild(newProfile('A', 'dino'), { ...base, score, built: 12 }) },
  market: { top: dash.STAR_AT[2], play: score => dash.applyDash(newProfile('A', 'dino'), { ...base, score, served: 12, missed: 1 }) },
  clockrush: { top: clock.STAR_AT[2], play: score => clock.applyRush(newProfile('A', 'dino'), { ...base, score, done: 12, missed: 1 }) },
  shifter: { top: shifter.STAR_AT[2], play: score => shifter.applyShifter(newProfile('A', 'dino'), { ...base, score, caught: 20, wrong: 1 }) },
  smoothie: { top: stand.STAR_AT[2], play: score => stand.applyStand(newProfile('A', 'dino'), { ...base, score, served: 12, missed: 1, tips: 2 }) },
  treasure: { top: treasure.STAR_AT[2], play: score => treasure.applyTreasure(newProfile('A', 'dino'), { ...base, score, found: 12, washed: 1 }) },
  showdown: { top: showdown.STAR_AT[2], play: score => showdown.applyShowdown(newProfile('A', 'dino'), { ...base, score, right: 12, missed: 1, bets: 2 }) },
  balance: { top: beam.STAR_AT[2], play: score => beam.applyBeam(newProfile('A', 'dino'), { ...base, score, solved: 12, tipped: 1 }) },
};

describe('the area games pay like the Arcade\'s fact games', () => {
  // the fact game's three-star round, for comparison
  const answered = Array.from({ length: 12 }, (_, i) => ({ f: { a: 2 + (i % 8), b: 3, op: '+' as const }, ok: true, thinkMs: 2500 }));
  const fact = applyArcade(newProfile('A', 'dino'), { id: 'catch', score: ARCADE.catch.stars[2], ms: 60_000, at, daily: false, answered });
  it('the fact game finds treasure at three stars', () => {
    expect(fact.stars).toBe(3);
    expect(fact.treasure).toBe(treasureFor(ARCADE.catch.stars[2], ARCADE.catch.stars[2]));
  });
  for (const [id, g] of Object.entries(GAMES)) {
    it(`${id}: three stars find the same treasure and about the same shells and friendship`, () => {
      const o = g.play(g.top);
      expect(o.stars).toBe(3);
      expect(o.treasure).toBe(fact.treasure);
      expect(o.shells).toBeGreaterThanOrEqual(fact.shells - 4);
      expect(o.shells).toBeLessThanOrEqual(fact.shells + 4);
      expect(o.xp.gained).toBeGreaterThan(fact.xp.gained * 0.6);
      expect(o.xp.gained).toBeLessThan(fact.xp.gained * 1.6);
    });
    it(`${id}: a round that scores nothing finds no treasure but still pays for finishing`, () => {
      const o = g.play(0);
      expect(o.stars).toBe(0);
      expect(o.treasure).toBe(-1);
      expect(o.shells).toBeGreaterThan(0);
    });
  }
});
