// Simulated learners: does the adaptive engine find a child's level, keep them at about 80% right, place
// them well in a short Show What You Know, and follow them as they grow? Each simulated child has a true
// ability T (in rungs) and answers a question at rung r right with the model's own chance,
// p = 1 / (1 + exp(-(1.4 * (T - r) + 1.39))), quickly. The engine never sees T: it only sees answers.
import { describe, expect, it } from 'vitest';
import { mulberry32, type Rng } from '../../engine/rng';
import { expected, learn, pitchRung, START_T, TARGET, type Ability } from './ability';
import { Streak } from './picker';
import { applyPlacement, PLACE_SKILL_N, Staircase, skillLadder, type Rung } from './placement';
import type { AbilityHome } from './ability';

const T0 = Date.UTC(2026, 10, 2, 16);
const answer = (rng: Rng, T: number, rung: number) => rng() < expected(T, rung);

/** A practice run: `n` questions pitched by the engine (with a trip's streak), from a start estimate. */
function practise(rng: Rng, T: (i: number) => number, n: number, start: number, prior: Ability | undefined = undefined) {
  let ab: Ability | undefined = prior;
  const streak = new Streak();
  const trace: { theta: number; T: number; rung: number; ok: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const theta = ab ? ab.t : start;
    const rung = pitchRung(theta, TARGET.practice, rng, streak.bump);
    const ok = answer(rng, T(i), rung);
    ab = learn(ab, start, { rung, ok, thinkMs: 1000, fastMs: 6000, at: T0, source: 'trip' });
    streak.answer(ok);
    trace.push({ theta: ab.t, T: T(i), rung, ok });
  }
  return trace;
}

describe('adaptive practice, with simulated learners', () => {
  it('finds a learner\'s level: after 40 answers the mean error is under 0.6 rungs', () => {
    const rng = mulberry32(11);
    let err = 0;
    const N = 600;
    for (let k = 0; k < N; k++) {
      const T = 1 + 5 * rng();
      const tr = practise(rng, () => T, 40, START_T);
      err += Math.abs(tr[39].theta - T);
    }
    const mean = err / N;
    console.log(`[sim] mean |theta - T| after 40 answers, T uniform 1..6, start ${START_T}: ${mean.toFixed(3)}`);
    expect(mean).toBeLessThan(0.6);
  });

  it('keeps every learner at 75-85% right, whatever their level (once it has found them: answers 41 to 160)', () => {
    const rng = mulberry32(12);
    const rates: [number, number][] = [];
    for (let T = 1; T <= 6.001; T += 0.5) {
      let right = 0, asked = 0;
      for (let k = 0; k < 200; k++) {
        const tr = practise(rng, () => T, 160, START_T);
        for (const x of tr.slice(40)) { asked++; if (x.ok) right++; }
      }
      rates.push([T, right / asked]);
    }
    console.log(`[sim] success by true level: ${rates.map(([T, r]) => `T=${T.toFixed(1)}: ${(r * 100).toFixed(1)}%`).join(', ')}`);
    for (const [T, r] of rates) { expect(r, `T=${T}`).toBeGreaterThanOrEqual(0.75); expect(r, `T=${T}`).toBeLessThanOrEqual(0.85); }
  });

  it('follows a learner who grows one rung over 100 answers, about 25 answers behind', () => {
    const rng = mulberry32(13);
    let lagSum = 0, n = 0;
    const N = 500;
    for (let k = 0; k < N; k++) {
      const T0r = 1.5 + 3 * rng();
      // already well known to the game (60 answers behind the estimate), then growing steadily
      const known: Ability = { t: T0r, n: 60, at: T0 };
      const tr = practise(rng, i => T0r + Math.min(1, i / 100), 140, T0r, known);
      // how far behind: the gap during the climb's second half, in answers (the climb is 0.01 rung an answer)
      for (let i = 50; i < 100; i++) { lagSum += (tr[i].T - tr[i].theta) / 0.01; n++; }
    }
    const lag = lagSum / n;
    console.log(`[sim] a learner growing 1 rung over 100 answers is followed about ${lag.toFixed(1)} answers behind`);
    expect(lag).toBeLessThan(30);
    expect(lag).toBeGreaterThan(0);
  });
});

/** A placement on a ladder for a learner with true ability T_s on each skill; returns the estimates. */
function place(rng: Rng, ladder: Rung[], truth: Record<string, number>, n = PLACE_SKILL_N) {
  const st = new Staircase(ladder, 3, n, rng);
  let pr;
  while ((pr = st.next())) st.answer(answer(rng, truth[pr.skill], pr.rung));
  const h: AbilityHome = {};
  applyPlacement(h, ladder, st.answers, 3, T0);
  return { h, asked: st.answers.length };
}

describe('Show What You Know, with simulated learners', () => {
  it('one skill: 16 questions land within one rung of the truth for at least 90% of learners', () => {
    const rng = mulberry32(21);
    const ladder: Rung[] = [{ skill: 'fr-name', base: 0 }];
    let within = 0;
    const N = 1000;
    for (let k = 0; k < N; k++) {
      const T = 1 + 5 * rng();
      const { h, asked } = place(rng, ladder, { 'fr-name': T });
      expect(asked).toBe(PLACE_SKILL_N);
      if (Math.abs(h.ability!['fr-name'].t - T) <= 1) within++;
    }
    console.log(`[sim] one-skill placement within one rung: ${((within / N) * 100).toFixed(1)}%`);
    expect(within / N).toBeGreaterThanOrEqual(0.9);
  });

  for (const area of ['fractions', 'place', 'decimals'] as const) {
    it(`a whole area (${area}): every skill the learner is working on lands within one rung for at least 90%`, () => {
      const rng = mulberry32(22 + area.length);
      const ladder = skillLadder(area);
      const top = Math.max(...ladder.map(x => x.base)) + 6;
      let within = 0, total = 0;
      for (let k = 0; k < 600; k++) {
        // a learner at level L on the area's ladder, each skill a little off the ladder (SD 0.3)
        const L = 1 + (top - 1) * rng();
        const truth: Record<string, number> = {};
        for (const x of ladder) truth[x.skill] = L - x.base + 0.3 * (rng() + rng() + rng() - 1.5) * 2;
        const { h } = place(rng, ladder, truth);
        for (const x of ladder) {
          const T = truth[x.skill];
          if (T < 1 || T > 6) continue; // skills they're past, or not ready for: starts high, or at the edge
          total++;
          if (Math.abs(h.ability![x.skill].t - T) <= 1) within++;
        }
      }
      console.log(`[sim] ${area} placement, skills in reach, within one rung: ${((within / total) * 100).toFixed(1)}% of ${total}`);
      expect(within / total).toBeGreaterThanOrEqual(0.9);
    });
  }
});
