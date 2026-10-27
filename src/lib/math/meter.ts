// Speed in the math game: facts a minute. The same six rides as typing, climbing with facts a minute
// times accuracy (cubed, so guessing doesn't pay), a score for stars, and a treasure for the score.
//
// Facts a minute counts answering time only: from a fact appearing to its answer being in (a miss
// includes typing the right answer back). A new fact's first showing, with its trick, isn't timed.
// Times Tables Rock Stars' speeds line up with the rides: 6 a minute is its first status, 20 is
// "Rock Star" (the bike to car), 30 is "Rock Legend" (the rocket).

import type { RideEvent } from '../engine/rides';
import type { Speed } from './facts';

/** Effective facts a minute each ride needs (walk, run, skateboard, bike, car, rocket). */
export const MATH_RIDE = { kids: [0, 8, 12, 16, 22, 30], grown: [0, 13, 19, 26, 35, 48] };
/** The score each treasure needs, pebble to rainbow star. */
export const MATH_TREASURE = { kids: [1, 5, 8, 11, 14, 17, 20, 24, 28, 33], grown: [2, 8, 13, 18, 22, 27, 32, 38, 45, 53] };

export function mathTreasureFor(score: number, grown: boolean): number {
  const th = grown ? MATH_TREASURE.grown : MATH_TREASURE.kids;
  let t = -1;
  th.forEach((v, i) => { if (score >= v) t = i; });
  return t;
}

/** One answered fact. */
export type FactResult = {
  id: string;
  /** right first time */
  ok: boolean;
  speed: Speed;
  /** fact shown to first digit (ms) */
  thinkMs: number;
  /** fact shown to the answer being in, including a retype after a miss (ms) */
  ms: number;
  /** a new fact's first showing, with its trick: not scored */
  intro: boolean;
};

export type TripStats = {
  asked: number; right: number; misses: number; fast: number; slow: number;
  acc: number; fpm: number; score: number; ms: number; bestFastRow: number;
};

export function tripStats(rs: FactResult[]): TripStats {
  const scored = rs.filter(r => !r.intro);
  const right = scored.filter(r => r.ok).length;
  const ms = scored.reduce((a, r) => a + r.ms, 0);
  const acc = scored.length ? right / scored.length : 1;
  const fpm = ms > 0 ? right / (ms / 60000) : 0;
  let row = 0, bestFastRow = 0;
  for (const r of scored) { row = r.speed === 'fast' ? row + 1 : 0; bestFastRow = Math.max(bestFastRow, row); }
  return {
    asked: scored.length, right, misses: scored.length - right,
    fast: scored.filter(r => r.speed === 'fast').length, slow: scored.filter(r => r.speed === 'slow').length,
    acc, fpm: Math.round(fpm * 10) / 10, score: Math.round(fpm * acc), ms, bestFastRow,
  };
}

/** Three stars at the goal score, two at 60%, one at 30%; under 85% right can't get the third. */
export function mathStars(st: TripStats, goal: number, finished: boolean): 0 | 1 | 2 | 3 {
  if (!finished || st.asked < 5) return 0;
  const r = st.score / goal;
  const s = r >= 1 ? 3 : r >= 0.6 ? 2 : r >= 0.3 ? 1 : 0;
  return s === 3 && st.acc < 0.85 ? 2 : s;
}
export const mathGoal = (goal: number, grown: boolean, easy = false) => Math.round(goal * (grown ? 1.6 : 1) * (easy && !grown ? 2 / 3 : 1));

/**
 * The live ride. It moves on answers, not keys: each answer updates the speed of the last six facts
 * and the accuracy of the last ten; while a fact is being thought about for a long time it eases off,
 * so a slow answer means strolling for a bit. A ride climbs straight away when earned and slips back
 * only after a few seconds below.
 */
export class FactMeter {
  readonly th: number[];
  tier = 0;
  best = 0;
  energy = 0;
  private recent: { ok: boolean; ms: number }[] = [];
  private shownAt = 0;
  private lastT = 0;
  private belowSince: number | null = null;
  private readonly calm: boolean;

  constructor(grown: boolean, calm = false) {
    this.th = grown ? MATH_RIDE.grown : MATH_RIDE.kids;
    this.calm = calm;
  }

  /** A fact appeared. */
  shown(t: number) { this.shownAt = t; }

  /** A scored fact was answered. */
  push(ok: boolean, ms: number) {
    this.recent.push({ ok, ms });
    if (this.recent.length > 10) this.recent.shift();
  }

  /** Effective facts a minute right now. */
  live(t: number): number {
    const last = this.recent.slice(-6);
    if (last.length < 2) return 0;
    const ms = last.reduce((a, r) => a + r.ms, 0);
    const fpm = last.filter(r => r.ok).length / (ms / 60000);
    const acc = this.recent.filter(r => r.ok).length / this.recent.length;
    const waiting = t - this.shownAt;
    const ease = waiting < 5000 ? 1 : Math.max(0.5, 1 - (waiting - 5000) / 14000);
    return fpm * acc ** 3 * ease;
  }

  update(t: number): RideEvent | null {
    const dt = Math.min(0.1, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;
    if (this.calm) return null;
    const target = this.live(t);
    this.energy += (target - this.energy) * (1 - Math.exp(-dt * (target > this.energy ? 3 : 1.2)));
    if (this.recent.length < 3) return null;
    const next = this.th[this.tier + 1];
    if (next !== undefined && this.energy >= next) {
      this.tier++;
      this.belowSince = null;
      this.best = Math.max(this.best, this.tier);
      return { type: 'up', tier: this.tier };
    }
    if (this.tier > 0 && this.energy < this.th[this.tier] * 0.8) {
      this.belowSince ??= t;
      if (t - this.belowSince >= 2500) { this.tier--; this.belowSince = null; return { type: 'down', tier: this.tier }; }
    } else this.belowSince = null;
    return null;
  }

  progress(): number {
    const lo = this.th[this.tier], hi = this.th[this.tier + 1];
    if (hi === undefined) return 1;
    return Math.max(0, Math.min(1, (this.energy - lo) / (hi - lo)));
  }
}
