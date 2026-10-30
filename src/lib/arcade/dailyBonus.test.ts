// Today's challenge pays the same everywhere: the Arcade's fact games paid 25 bonus shells for beating the
// goal and the math areas' own games paid nothing. Now every area game pays the same 25, the first time
// today's goal (the two-star score) is beaten, and never in a free round.
import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { advView } from '../adventure/state';
import { DAILY_SHELLS } from '../engine/settle';
import { DAILY_SHELLS as ARCADE_DAILY } from './arcade';
import * as pizza from '../math/pizza/rush';
import * as builder from '../math/place/builder';
import * as market from '../math/market/dash';
import * as clock from '../math/measure/rush';
import * as shifter from '../math/shapes/shifter';
import * as stand from '../math/ratios/stand';
import * as treasure from '../math/integers/treasure';
import * as showdown from '../math/data/showdown';
import * as beam from '../math/algebra/beam';

type Out = { profile: Profile; dailyBeat?: boolean; dailyShells?: number };
type Game = { name: string; goal: number; apply: (p: Profile, run: never) => Out };
const GAMES: Game[] = [
  { name: 'Pizza Rush', goal: pizza.STAR_AT[1], apply: pizza.applyRush as never },
  { name: 'Number Builder', goal: builder.STAR_AT[1], apply: builder.applyBuild as never },
  { name: 'Market Dash', goal: market.STAR_AT[1], apply: market.applyDash as never },
  { name: 'Clock Rush', goal: clock.STAR_AT[1], apply: clock.applyRush as never },
  { name: 'Shape Shifter', goal: shifter.STAR_AT[1], apply: shifter.applyShifter as never },
  { name: 'Smoothie Stand', goal: stand.STAR_AT[1], apply: stand.applyStand as never },
  { name: 'Treasure Grid', goal: treasure.STAR_AT[1], apply: treasure.applyTreasure as never },
  { name: 'Spinner Showdown', goal: showdown.STAR_AT[1], apply: showdown.applyShowdown as never },
  { name: 'Balance Beam', goal: beam.STAR_AT[1], apply: beam.applyBeam as never },
];
/** a round with every count any of the games reads */
const run = (score: number, daily: boolean, at: number) => ({ score, daily, at, ms: 100_000, bestCombo: 3, answers: [], served: 8, missed: 1, done: 8, built: 8, caught: 12, wrong: 1, tips: 0, found: 6, washed: 0, right: 8, bets: 1, solved: 8, tipped: 0 }) as never;
const shells = (p: Profile) => advView(p).shells;

describe("today's challenge pays the same bonus in every game", () => {
  it('the same 25 shells as the Arcade', () => expect(DAILY_SHELLS).toBe(ARCADE_DAILY));
  for (const g of GAMES) {
    it(`${g.name}: ${DAILY_SHELLS} bonus shells for beating the goal, once a day, never in a free round`, () => {
      const day = new Date(2026, 9, 30, 10).getTime();
      const p0 = newProfile('Ava', 'dino');
      // under the goal: no bonus
      const a = g.apply(p0, run(g.goal - 1, true, day));
      expect(a.dailyBeat).toBe(false);
      expect(a.dailyShells).toBe(0);
      // beating it: the bonus, on top of the round's own shells
      const free = g.apply(a.profile, run(g.goal + 50, false, day + 1000));
      expect(free.dailyShells).toBe(0);
      const b = g.apply(a.profile, run(g.goal + 50, true, day + 1000));
      expect(b.dailyBeat).toBe(true);
      expect(b.dailyShells).toBe(DAILY_SHELLS);
      expect(shells(b.profile) - shells(free.profile)).toBe(DAILY_SHELLS);
      // again today: no more bonus; tomorrow: again
      const c = g.apply(b.profile, run(g.goal + 300, true, day + 2000));
      expect(c.dailyShells).toBe(0);
      const d = g.apply(c.profile, run(g.goal + 10, true, day + 86_400_000));
      expect(d.dailyShells).toBe(DAILY_SHELLS);
    });
  }
});
