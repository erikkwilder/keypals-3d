import { describe, expect, it } from 'vitest';
import { AREAS, skillsOf } from '../math/skills/registry';
import { STRANDS } from '../math/course';
import { BUDDY_R, blocked, crossings, landRadius, pathZ, plotPlaces, plotRect, resolve, step, walkRadius, type Box, type Solid } from './gardenLayout';
import { mulberry32 } from '../engine/rng';

/** the garden's plots as the screen makes them: the four fact plots, then every live skill area */
const factBeds = [11, 11, 11, 10];
const areaBeds = AREAS.filter(a => a.live && !a.op).map(a => skillsOf(a.id).length);

function check(n: number, beds: number[]) {
  const places = plotPlaces(n), land = landRadius(places, beds), walk = walkRadius(land);
  const rects = places.map((q, i) => plotRect(q, beds[i]));
  // every plot, its sign posts and its path, on the land and inside where the buddy can walk
  for (const r of rects) for (const x of [r.x0, r.x1]) for (const z of [r.z0, r.z1]) expect(Math.hypot(x, z)).toBeLessThan(walk);
  // no two plots on top of each other
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j];
    expect(a.x1 <= b.x0 || b.x1 <= a.x0 || a.z1 <= b.z0 || b.z1 <= a.z0, `plots ${i} and ${j}`).toBe(true);
  }
  // the crossings between the rows go beside the front plots, never through them
  for (const x of crossings(places)) for (const [i, q] of places.entries()) if (q.row === 1) expect(x < rects[i].x0 || x > rects[i].x1).toBe(true);
  // the front row's beds stay off the back row's path
  for (const [i, q] of places.entries()) if (q.row === 1) expect(rects[i].z0).toBeGreaterThan(pathZ(0) + 1);
  return { places, land };
}

describe('the Fact Garden layout', () => {
  it('every plot that exists (four fact plots and every skill area) sits on the land, in two rows', () => {
    const n = STRANDS.length + areaBeds.length;
    expect(n).toBeGreaterThanOrEqual(7);
    const { places, land } = check(n, [...factBeds, ...areaBeds]);
    expect(new Set(places.map(q => q.row))).toEqual(new Set([0, 1]));
    // the four fact plots keep the back row
    expect(places.slice(0, 4).every(q => q.row === 0)).toBe(true);
    expect(land).toBeGreaterThanOrEqual(46);
  });
  it('more areas later make the rows longer and the island bigger, and they still all fit', () => {
    for (const n of [1, 4, 5, 8, 10, 13, 16]) check(n, Array.from({ length: n }, (_, i) => (i < 4 ? 11 : 6)));
    expect(landRadius(plotPlaces(16), Array(16).fill(11))).toBeGreaterThan(landRadius(plotPlaces(7), Array(7).fill(11)));
  });
});

describe('solid things in the garden', () => {
  const rocks: Solid[] = [{ x: 0, z: 0, r: 0.9 }, { x: 3, z: 0.5, r: 0.6 }, { x: 1.5, z: 3, r: 1.2 }, { x: -2.5, z: -2, r: 0.5 }];
  const beds: Box[] = [{ x0: -6, x1: -3.5, z0: 1, z1: 1.8 }];
  it('walking straight into a rock stops at its edge: never inside it', () => {
    const p = { x: -4, z: 0 };
    for (let i = 0; i < 120; i++) step(p, { x: 1, z: 0 }, 0.12, rocks, beds);
    expect(blocked(p, rocks, beds)).toBe(false);
    expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(0.9 + BUDDY_R - 1e-3);
  });
  it('walking into a rock at a slant slides along it and on past', () => {
    const p = { x: -3, z: -0.4 };
    for (let i = 0; i < 80; i++) step(p, { x: 1, z: 0 }, 0.12, [rocks[0]], []);
    expect(p.x).toBeGreaterThan(1.5);
    expect(blocked(p, [rocks[0]], [])).toBe(false);
  });
  it('wherever it walks and however fast, the buddy never ends up inside a rock or a bed', () => {
    const rng = mulberry32(42);
    const p = { x: -8, z: -6 };
    for (let i = 0; i < 4000; i++) {
      const a = rng() * Math.PI * 2;
      step(p, { x: Math.cos(a), z: Math.sin(a) }, rng() * 0.4, rocks, beds, BUDDY_R, 12);
      expect(blocked(p, rocks, beds), `step ${i} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`).toBe(false);
      expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(12 + 1e-6);
    }
  });
  it('a spot dropped inside a rock is pushed out of it', () => {
    expect(blocked(resolve({ x: 0.1, z: 0.05 }, rocks, beds), rocks, beds)).toBe(false);
    expect(blocked(resolve({ x: -4.5, z: 1.4 }, rocks, beds), rocks, beds)).toBe(false);
  });
});
