// Speed rides: how the crew travels while you type. The ride climbs mid-lesson when you
// type fast AND clean, and slips back if you slow down or start missing keys.

import { bonusFraction } from './scoring';

export type RideId = 'walk' | 'run' | 'skate' | 'bike' | 'car' | 'rocket';

/** Six rides: on foot, then faster on foot, then on wheels, and finally into the sky. */
export const RIDES: { id: RideId; name: string; verb: string }[] = [
  { id: 'walk', name: 'Walk', verb: 'Walking' },
  { id: 'run', name: 'Run', verb: 'Running' },
  { id: 'skate', name: 'Skateboard', verb: 'Skating' },
  { id: 'bike', name: 'Bike', verb: 'Pedaling' },
  { id: 'car', name: 'Car', verb: 'Driving' },
  { id: 'rocket', name: 'Rocket', verb: 'Blasting off' },
];
export const rideIndex = (id: RideId) => RIDES.findIndex(r => r.id === id);
/** How the buddy travels: the trail's rides, or the math courses' climb, sled and swim. */
export type Move = 'run' | 'climb' | 'slide' | 'swim';
/** The six speed steps of each way of moving, named for it (the trail keeps its rides). */
export const LADDERS: Record<Move, { name: string; verb: string }[]> = {
  run: RIDES,
  // (each is its own way up the cliff, with its own gear and motion: three/climbKit.ts)
  climb: [{ name: 'Hold On', verb: 'Holding on' }, { name: 'Rope Climber', verb: 'On the rope' }, { name: 'Spring Boots', verb: 'Bouncing up' }, { name: 'Grappling Hook', verb: 'Zipping up' }, { name: 'Jet Pack', verb: 'Flying up' }, { name: 'Rocket Boots', verb: 'Rocket boots' }],
  // (and each is its own ride down the slope or stroke across the bay: three/sledKit.ts and swimKit.ts)
  slide: [{ name: 'Wobbly Sled', verb: 'Wobbling' }, { name: 'Saucer', verb: 'Spinning' }, { name: 'Skis', verb: 'Skiing' }, { name: 'Snowboard', verb: 'Snowboarding' }, { name: 'Bobsled', verb: 'Bobsledding' }, { name: 'Avalanche', verb: 'Avalanche' }],
  swim: [{ name: 'Swim Ring', verb: 'Bobbing along' }, { name: 'Arm Bands', verb: 'Paddling' }, { name: 'Flippers', verb: 'Kicking' }, { name: 'Goggles', verb: 'Racing' }, { name: 'Dolphin', verb: 'Dolphin kick' }, { name: 'Torpedo', verb: 'Torpedo' }],
};
export const rideName = (tier: number, move: Move = 'run') => LADDERS[move][Math.max(0, Math.min(5, tier))].name;
export const rideVerb = (tier: number, move: Move = 'run') => LADDERS[move][Math.max(0, Math.min(5, tier))].verb;

/**
 * The live score each ride needs, spread over Animal Typing's animal ladder (sloth 6 ... rabbit 25 ...
 * lion 49 ... cheetah 84) so the same speeds earn the same kind of reward: a steady young typist rides
 * a skateboard or a bike, a fast one gets the car, and the rocket is a real stretch. Grown-ups need
 * about 1.6 times as much.
 */
export const RIDE_SCORE = {
  kids: [0, 8, 15, 24, 36, 52],
  grown: [0, 13, 24, 38, 58, 84],
};

export type RideEvent = { type: 'up' | 'down'; tier: number };

export class RideMeter {
  readonly th: number[];
  tier = 0;
  best = 0;
  energy = 0; // smoothed live score (recent speed with the clean-typing bonus)
  private okTimes: number[] = [];
  private recent: boolean[] = [];
  private lastT = 0;
  private lastKeyT = -1e9;
  private aboveSince: number | null = null;
  private belowSince: number | null = null;
  private strokes = 0;
  private streak = 0;
  private readonly grown: boolean;

  constructor(grown: boolean) {
    this.grown = grown;
    this.th = grown ? RIDE_SCORE.grown : RIDE_SCORE.kids;
  }

  push(ok: boolean, t: number) {
    this.strokes++;
    this.lastKeyT = t;
    this.recent.push(ok);
    if (this.recent.length > 20) this.recent.shift();
    if (ok) {
      this.streak++;
      this.okTimes.push(t);
      while (this.okTimes.length > 24) this.okTimes.shift();
    } else {
      // a slip ends the bonus streak and the ride stumbles a little
      this.streak = 0;
      this.energy *= 0.92;
    }
  }

  /** Recent speed in words a minute. */
  instant(t: number): number {
    const times = this.okTimes.filter(x => t - x < 9000);
    if (times.length < 4) return 0;
    const span = Math.max(1500, t - times[0]);
    const idle = t - this.lastKeyT;
    const idleFactor = idle < 1200 ? 1 : Math.max(0, 1 - (idle - 1200) / 2500);
    return ((times.length - 1) / 5) / (span / 60000) * idleFactor;
  }

  /** Live score: recent speed with the bonus the current clean streak earns. */
  liveScore(t: number): number {
    return this.instant(t) / (1 - bonusFraction(this.streak, this.grown));
  }

  /** The current clean streak's bonus level, 0 to 3, for the on-screen "time bonus" counter. */
  bonusLevel(): number {
    const f = bonusFraction(this.streak, this.grown), cap = bonusFraction(1e9, this.grown);
    return f <= 0 ? 0 : f < cap / 2 ? 1 : f < cap ? 2 : 3;
  }

  /** Call every frame. Returns an event when the ride changes. */
  update(t: number): RideEvent | null {
    const dt = Math.min(0.1, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    const target = this.liveScore(t);
    const k = 1 - Math.exp(-dt * (target > this.energy ? 2.2 : 1.6));
    this.energy += (target - this.energy) * k;
    if (this.strokes < 6) return null;

    const next = this.th[this.tier + 1];
    if (next !== undefined && this.energy >= next) {
      this.aboveSince ??= t;
      if (t - this.aboveSince >= 700) {
        this.tier++;
        this.aboveSince = null;
        this.belowSince = null;
        if (this.tier > this.best) this.best = this.tier;
        return { type: 'up', tier: this.tier };
      }
    } else this.aboveSince = null;

    if (this.tier > 0 && this.energy < this.th[this.tier] * 0.82) {
      this.belowSince ??= t;
      if (t - this.belowSince >= 1600) {
        this.tier--;
        this.belowSince = null;
        return { type: 'down', tier: this.tier };
      }
    } else this.belowSince = null;
    return null;
  }

  recentAccuracy(): number {
    return this.recent.length ? this.recent.filter(Boolean).length / this.recent.length : 1;
  }

  /** 0..1 progress toward the next ride. */
  progress(): number {
    const lo = this.th[this.tier], hi = this.th[this.tier + 1];
    if (hi === undefined) return 1;
    return Math.max(0, Math.min(1, (this.energy - lo) / (hi - lo)));
  }
}
