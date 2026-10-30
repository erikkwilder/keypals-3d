import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { noteSkillAnswers } from '../skills/progress';
import { applyBeam, beamOf, comboMult, dailySeed, kindsFor, levelsFor, makePuzzle, puzzleMaker, puzzleScore, puzzleText, QUICK_BONUS, STACK_BONUS, STAR_AT, starsFor } from './beam';

describe('Balance Beam', () => {
  it('every puzzle balances: the boxes and the weights with them weigh the other side', () => {
    const rng = mulberry32(4);
    for (const lv of [undefined, { add: -1, times: -1, two: -1 }, { add: 3, times: 3, two: 3 }, { add: 8, times: 8, two: 8 }]) for (let i = 0; i < 400; i++) {
      const z = makePuzzle(rng, i, ['add', 'times', 'two'], lv);
      expect(z.boxes * z.ans + z.left).toBe(z.right);
      expect(Number.isInteger(z.ans) && z.ans >= 1 && z.boxes >= 1 && z.boxes <= 6 && z.right <= 100).toBe(true);
      expect(z.rung >= 1 && z.rung <= 6).toBe(true);
      expect(puzzleText(z)).toMatch(/=/);
      expect(z.key).toMatch(/^al-/);
    }
  });
  it('starts with a box and weights, and grows with what the player has met', () => {
    const p = newProfile('Ava', 'dino');
    expect(kindsFor(p)).toEqual(['add']);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'al-one:times', ok: true, thinkMs: 3000 }, { key: 'al-two:plus', ok: true, thinkMs: 5000 }], Date.now());
    expect(kindsFor(p)).toEqual(['add', 'times', 'two']);
    const next = puzzleMaker(9, kindsFor(p), levelsFor(p));
    expect([next(), next()].every(z => z.kind === 'add')).toBe(true);
  });
  it('the same day gives everyone the same puzzles', () => {
    const at = Date.UTC(2026, 9, 29, 12);
    expect(dailySeed(at)).toBe(dailySeed(at + 3600_000));
    const a = puzzleMaker(dailySeed(at), ['add', 'times']), b = puzzleMaker(dailySeed(at), ['add', 'times']);
    for (let i = 0; i < 10; i++) expect(a()).toEqual(b());
  });
  it('scores: combos multiply, quick ones and every fifth in a row earn bonuses, stars by score', () => {
    const z = makePuzzle(mulberry32(1), 0, ['add']);
    expect(comboMult(0)).toBe(1); expect(comboMult(20)).toBe(3);
    expect(puzzleScore(z, 0, 1000)).toBe(z.points + QUICK_BONUS);
    expect(puzzleScore(z, 0, 9000)).toBe(z.points);
    expect(puzzleScore(z, 4, 9000)).toBe(Math.round(z.points * 2) + STACK_BONUS);
    expect(starsFor(0)).toBe(0); expect(starsFor(STAR_AT[0])).toBe(1); expect(starsFor(STAR_AT[2])).toBe(3);
  });
  it('a finished round keeps the best and today\'s best, and counts only the subs already met', () => {
    const p = newProfile('Ava', 'dino');
    const at = Date.now();
    const out = applyBeam(p, { score: 1400, solved: 9, tipped: 1, bestCombo: 6, ms: 90_000, at, daily: true, answers: [{ key: 'al-missing:balance', ok: true, thinkMs: 3000, rung: 2 }] });
    expect(out.stars).toBe(2);
    expect(out.newBest).toBe(true);
    const r = beamOf(out.profile);
    expect(r.best).toBe(1400); expect(r.bestCombo).toBe(6); expect(r.daily?.best).toBe(1400);
    // nothing met before: the answer doesn't count in memory
    expect(mathOf(out.profile).skills?.['al-missing:balance']).toBeUndefined();
    const again = applyBeam(out.profile, { score: 900, solved: 5, tipped: 2, bestCombo: 3, ms: 90_000, at, daily: false, answers: [] });
    expect(again.newBest).toBe(false);
    expect(beamOf(again.profile).plays).toBe(2);
  });
});
