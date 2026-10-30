// Spinner Showdown's rules and Spin Lab's experiments: challenges come from the area's own skills (only
// what the player has met), every fourth is a Best Bet with one clear best colour, the wheel is fair, the
// score is kept, and the toy's experiments make sense.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { updateFact } from '../facts';
import { SKILL } from '../skills/registry';
import { BET_EVERY, KINDS, KIND_IDS, applyShowdown, betWheel, challengeMaker, dailySeed, poolFor, showdownOf, spinLand, starsFor, ticketsFor } from './showdown';
import { EXPERIMENTS, LAB_LEVELS, experiment, smartPick, trial } from './lab';

const T0 = Date.UTC(2026, 9, 29, 12);
function metAll() {
  const p = newProfile('t', 'dino');
  const m = (p.math = mathOf(p));
  m.skills = {};
  for (const k of KIND_IDS.flatMap(id => KINDS[id].keys)) m.skills[k] = updateFact(undefined, { ok: true, thinkMs: 4000, day: '2026-10-29', at: T0 });
  return p;
}

describe('Spinner Showdown', () => {
  it('every kind on the wheel is real keys of the data area', () => {
    for (const id of KIND_IDS) for (const key of KINDS[id].keys) {
      const [sk, sub] = key.split(':');
      expect(SKILL[sk]?.area, key).toBe('data');
      expect(SKILL[sk].subs.some(s => s.id === sub), key).toBe(true);
    }
  });
  it('someone new gets counting and how likely; someone who has met everything gets every kind', () => {
    expect(Object.keys(poolFor(newProfile('n', 'dino'))).sort()).toEqual(['count', 'likely']);
    expect(Object.keys(poolFor(metAll())).sort()).toEqual([...KIND_IDS].sort());
  });
  it('every fourth challenge is a Best Bet; the rest are questions from the pool that check right', () => {
    const p = metAll(), pool = poolFor(p);
    const keys = new Set(Object.values(pool).flat());
    const next = challengeMaker(42, pool, {});
    for (let i = 0; i < 80; i++) {
      const c = next();
      if (i % BET_EVERY === BET_EVERY - 1) { expect(c.kind).toBe('bet'); continue; }
      expect(c.kind).toBe('q');
      if (c.kind !== 'q') continue;
      expect(keys.has(c.key)).toBe(true);
      expect(KINDS[c.on].keys as readonly string[]).toContain(c.key);
      expect(SKILL[c.item.skill].check(c.item, c.item.answer)).toBe(true);
      expect(c.points).toBeGreaterThan(0);
    }
  });
  it('a Best Bet wheel has one colour with the most parts, never two side by side', () => {
    const rng = mulberry32(5);
    for (let i = 0; i < 300; i++) {
      const w = betWheel(rng);
      const counts = new Map<string, number>(); for (const c of w.parts) counts.set(c, (counts.get(c) ?? 0) + 1);
      const top = Math.max(...counts.values());
      expect([...counts].filter(([, n]) => n === top).map(([c]) => c)).toEqual(w.best);
      for (let k = 1; k < w.parts.length; k++) if (counts.size > 1 && top <= w.parts.length / 2) expect(w.parts[k]).not.toBe(w.parts[k - 1]);
    }
  });
  it('the wheel is fair: every part as likely', () => {
    const parts = betWheel(mulberry32(3)).parts, hits = parts.map(() => 0), rng = mulberry32(9);
    for (let i = 0; i < 20000; i++) hits[spinLand(parts, rng())]++;
    for (const h of hits) expect(Math.abs(h / 20000 - 1 / parts.length)).toBeLessThan(0.02);
  });
  it('the same day makes the same round; tickets grow with the combo', () => {
    expect(dailySeed(T0)).toBe(dailySeed(T0 + 3600_000));
    expect(dailySeed(T0)).not.toBe(dailySeed(T0 + 86400_000));
    const a = challengeMaker(dailySeed(T0), poolFor(metAll()), {}), b = challengeMaker(dailySeed(T0), poolFor(metAll()), {});
    for (let i = 0; i < 10; i++) expect(JSON.stringify(a())).toBe(JSON.stringify(b()));
    expect(ticketsFor(100, 4, false)).toBeGreaterThan(ticketsFor(100, 0, false));
    expect(ticketsFor(100, 0, true)).toBeGreaterThan(ticketsFor(100, 0, false));
    expect(starsFor(0)).toBe(0);
    expect(starsFor(5000)).toBe(3);
  });
  it('a finished round keeps the best score and today\'s best, and pays out', () => {
    const p = metAll();
    const out = applyShowdown(p, { score: 1500, right: 9, missed: 1, bets: 2, bestCombo: 5, ms: 120000, at: T0, daily: true, answers: [{ key: 'da-sort:count', ok: true, thinkMs: 3000, rung: 2 }] });
    const rec = showdownOf(out.profile);
    expect(rec.best).toBe(1500);
    expect(rec.daily?.best).toBe(1500);
    expect(out.stars).toBe(2);
    expect(out.newBest).toBe(true);
    const again = applyShowdown(out.profile, { score: 900, right: 5, missed: 1, bets: 1, bestCombo: 2, ms: 120000, at: T0, daily: false, answers: [] });
    expect(showdownOf(again.profile).best).toBe(1500);
    expect(showdownOf(again.profile).plays).toBe(2);
  });
});

describe('Spin Lab', () => {
  it('every level\'s experiments have a smart pick, and every trial lands on an outcome', () => {
    const rng = mulberry32(8);
    for (let lv = 1; lv <= LAB_LEVELS; lv++) for (let i = 0; i < EXPERIMENTS; i++) for (let k = 0; k < 20; k++) {
      const e = experiment(lv, i, rng);
      expect(e.outcomes.length).toBe(e.ways.length);
      expect(e.outcomes.some((_, j) => smartPick(e, j))).toBe(true);
      if (e.kind === 'spinner') expect(e.ways.reduce((t, x) => t + x, 0)).toBe(e.parts!.length);
      for (let n = 0; n < 30; n++) { const t = trial(e, rng); expect(t.k).toBeGreaterThanOrEqual(0); expect(t.k).toBeLessThan(e.outcomes.length); }
    }
  });
  it('two dice: 7 is the smart pick', () => {
    const e = experiment(4, 0, mulberry32(1));
    expect(e.kind).toBe('dice2');
    expect(e.outcomes.filter((_, j) => smartPick(e, j))).toEqual(['7']);
  });
});
