import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { leftTotal, scaleChoices, scaleHow, scalePuzzles, SCALE_LEVELS, SHELF, tiltOf } from './scale';
import { PLAY_GAME } from '../playground';

describe('Balance Scale (the Star Lab toy)', () => {
  it('every level makes five puzzles the shelf can balance, never the same box twice in a row', () => {
    const rng = mulberry32(3);
    for (let lv = 1; lv <= SCALE_LEVELS.length; lv++) for (let k = 0; k < 50; k++) {
      const ps = scalePuzzles(lv, rng);
      expect(ps.length).toBe(5);
      ps.forEach((z, i) => {
        expect(z.boxes).toBe(SCALE_LEVELS[lv - 1].boxes);
        expect(z.w).toBeGreaterThanOrEqual(1);
        expect(leftTotal(z)).toBeLessThanOrEqual(14 * Math.max(...SHELF));
        if (i) expect(z.w).not.toBe(ps[i - 1].w);
        const cs = scaleChoices(z, rng);
        expect(cs).toContain(z.w); expect(new Set(cs).size).toBe(cs.length); expect(cs.length).toBe(3);
        expect(scaleHow(z)).toContain(String(z.w));
      });
    }
    expect(PLAY_GAME.scale.levels.length).toBe(SCALE_LEVELS.length);
  });
  it('hangs toward the heavier side and is level only when both weigh the same', () => {
    expect(tiltOf(8, 8)).toBe(0);
    expect(tiltOf(8, 3)).toBeGreaterThan(0);
    expect(tiltOf(8, 12)).toBeLessThan(0);
    expect(Math.abs(tiltOf(30, 0))).toBeLessThanOrEqual(1);
  });
});
