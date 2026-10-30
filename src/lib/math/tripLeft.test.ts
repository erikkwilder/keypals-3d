import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import { MATH_LESSONS } from './course';
import { TripPicker } from './picker';
import { SKILL_LESSONS } from './skills/course';
import { SkillTripPicker } from './skills/picker';

// The buddy's place on the trail follows answered / (answered + left), so `left` has to be exactly right:
// with no more misses, the trip asks exactly that many more, and it's 0 just when the trip is over.
type Trip = { served: unknown[]; left: number; next(): unknown; answer(ok: boolean): void };
function check(make: (seed: number) => Trip, label: string) {
  for (let seed = 1; seed <= 60; seed++) {
    const r = mulberry32(seed * 13);
    const p = make(seed);
    // misses only in the first part of the trip (none at all, a few, or lots)
    const missUntil = Math.floor(r() * 30), missRate = r() * 0.7;
    let asked = 0, promise = -1, leftAfter = -1;
    for (;;) {
      // the trip is over just when nothing was left
      if (!p.next()) { expect(leftAfter, `${label} ${seed}`).toBe(0); break; }
      expect(leftAfter, `${label} ${seed} at ${asked}`).not.toBe(0);
      asked++;
      p.answer(asked > missUntil || r() > missRate);
      leftAfter = p.left;
      // no more misses from here: exactly this many more questions
      if (asked >= missUntil && promise < 0) promise = p.served.length + leftAfter;
    }
    if (promise >= 0) expect(p.served.length, `${label} ${seed}`).toBe(promise);
  }
}

describe('how many questions a trip has left', () => {
  it('fact trips', () => {
    for (const l of MATH_LESSONS.filter((_, i) => i % 7 === 0)) check(seed => new TripPicker({ lesson: l, facts: {}, now: Date.now(), seed }), l.id);
  });
  it('skill trips', () => {
    for (const l of SKILL_LESSONS.filter((_, i) => i % 5 === 0)) check(seed => new SkillTripPicker({ lesson: l, mem: {}, now: Date.now(), seed }), l.id);
  });
});
