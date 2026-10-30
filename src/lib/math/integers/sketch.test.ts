// Star Sketch: every picture fits its grid, the first levels stay in the first quadrant, the mirror levels'
// halves really are mirrors of each other, and a wrong tap gets a hint that fits it.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { SKETCH_LEVELS, sketchHint, sketchRound, sketchTasks } from './sketch';
import { PLAY_GAME } from '../playground';

describe('Star Sketch', () => {
  it('is a Playground game with five levels', () => {
    expect(PLAY_GAME.sketch.levels.length).toBe(5);
    expect(SKETCH_LEVELS.length).toBe(5);
  });
  it('every picture is on its grid; levels 1 and 2 are first quadrant, 3 to 5 use all four', () => {
    SKETCH_LEVELS.forEach((L, i) => {
      for (const pic of L.pictures) {
        const pts = pic.strokes.flatMap(s => s.pts), g = pic.grid;
        for (const q of pts) { expect(q.x >= g.xMin && q.x <= g.xMax && q.y >= g.yMin && q.y <= g.yMax, `${pic.id}`).toBe(true); }
        if (i < 2) expect(pts.every(q => q.x >= 0 && q.y >= 0)).toBe(true);
        else expect(pts.some(q => q.x < 0) && pts.some(q => q.y < 0), pic.id).toBe(true);
        // no point twice in a stroke (each tap is one new star)
        for (const s of pic.strokes) expect(new Set(s.pts.map(q => `${q.x},${q.y}`)).size).toBe(s.pts.length);
      }
    });
  });
  it('on the mirror levels every point to plot is the mirror of one already drawn', () => {
    for (const L of SKETCH_LEVELS.filter(x => x.mirror)) for (const pic of L.pictures) {
      const { given, tasks } = sketchTasks(pic, L.mirror);
      expect(tasks.length).toBeGreaterThanOrEqual(3);
      for (const t of tasks) {
        expect(given.some(q => q.x === t.from!.x && q.y === t.from!.y), pic.id).toBe(true);
        expect(L.mirror === 'y' ? [-t.from!.x, t.from!.y] : [t.from!.x, -t.from!.y]).toEqual([t.at.x, t.at.y]);
      }
    }
  });
  it('a round is two different pictures of the level', () => {
    const r = sketchRound(3, mulberry32(4));
    expect(r.length).toBe(2); expect(r[0].id).not.toBe(r[1].id);
  });
  it('hints fit the slip', () => {
    const t = { at: { x: -3, y: 2 }, stroke: 0 };
    expect(sketchHint(t, { x: 2, y: -3 })).toMatch(/Swapped/);
    expect(sketchHint(t, { x: -3, y: 5 })).toMatch(/Across is right/);
    expect(sketchHint({ at: { x: -3, y: 2 }, stroke: 0, from: { x: 3, y: 2 }, axis: 'y' }, { x: 3, y: 2 })).toMatch(/already there/);
  });
});
