import { describe, expect, it } from 'vitest';
import { AREAS, skillsOf } from '../math/skills/registry';
import { STRANDS } from '../math/course';
import { BED_L, BUDDY_R, PATH_Z, ROW, bedZ, blocked, clearLine, crossings, findRoute, landRadius, pathZ, plotPlaces, plotRect, resolve, routeLength, step, walkRadius, type Box, type Solid } from './gardenLayout';
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

describe("the buddy's way round the garden", () => {
  // the garden as the scene lays it out: the beds, a sign post at each bed's left end, the plot's big sign and its can
  const beds = [11, 11, 11, 10, 11, 9, 10, 12, 13, 12, 11, 11, 11];
  const places = plotPlaces(beds.length);
  const boxes: Box[] = [], solids: Solid[] = [];
  places.forEach((q, i) => {
    for (let j = 0; j < beds[i]; j++) {
      boxes.push({ x0: q.x - BED_L / 2 - 0.04, x1: q.x + BED_L / 2 + 0.04, z0: q.z + bedZ(j) - 0.41, z1: q.z + bedZ(j) + 0.41 });
      solids.push({ x: q.x - BED_L / 2 - 0.62, z: q.z + bedZ(j) + 0.1, r: 0.12 });
    }
    solids.push({ x: q.x - BED_L / 2 + 0.4 - 0.95, z: q.z + PATH_Z + 1.25, r: 0.1 }, { x: q.x - BED_L / 2 + 0.4 + 0.95, z: q.z + PATH_Z + 1.12, r: 0.1 });
    solids.push({ x: q.x + BED_L / 2 + 0.55, z: q.z + PATH_Z - 0.75, r: 0.22 });
  });
  const walkR = walkRadius(landRadius(places, beds));
  const right = (p: number, bed: number) => ({ x: places[p].x + BED_L / 2 + 0.75, z: places[p].z + bedZ(bed) });
  const signs = (p: number, bed: number) => ({ x: places[p].x - BED_L / 2 - 1.05, z: places[p].z + bedZ(bed) });
  const route = (from: { x: number; z: number }, to: { x: number; z: number }) => findRoute(from, resolve({ ...to }, solids, boxes), solids, boxes, BUDDY_R, walkR);
  /** walk a route the way the scene does (its size 0.25, 60 steps a second): does it get there, how far, and did it ever stall? */
  function walked(from: { x: number; z: number }, way: { x: number; z: number }[]) {
    const me = { ...from };
    let far = 0, stalls = 0;
    for (const q of way) {
      for (let n = 0; n < 4000; n++) {
        const dx = q.x - me.x, dz = q.z - me.z, len = Math.hypot(dx, dz);
        if (len < 0.05) break;
        const got = step(me, { x: dx / len, z: dz / len }, Math.min(len, 0.08), solids, boxes, 0.25, walkR);
        far += got;
        if (got < 0.008) stalls++;
      }
    }
    return { far, stalls, end: me };
  }
  const near = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

  it('one row over stays in the aisle: no run to the front of the garden and back', () => {
    const from = right(2, 3), to = right(2, 4), way = route(from, to);
    expect(way).toHaveLength(1);
    expect(routeLength(from, way)).toBeLessThan(ROW * 1.05);
    // however far along the aisle
    expect(routeLength(right(2, 1), route(right(2, 1), right(2, 9)))).toBeLessThan(8 * ROW * 1.05);
  });
  it('down the side with the signs it goes outside their posts, in a straight line', () => {
    const from = signs(2, 3), way = route(from, signs(2, 8));
    expect(routeLength(from, way) / (5 * ROW)).toBeLessThan(1.05);
    const r = walked(from, way);
    expect(r.stalls).toBe(0);
    expect(near(r.end, signs(2, 8))).toBeLessThan(0.1);
  });
  it('starting squeezed between a sign and its bed, it gets out and goes round, and never stalls', () => {
    const from = resolve({ x: places[2].x - BED_L / 2 - 0.34, z: places[2].z + bedZ(3) }, solids, boxes, 0.25);
    for (const bed of [4, 9]) {
      const to = signs(2, bed), way = route(from, to), r = walked(from, way);
      expect(near(r.end, to), `bed ${bed}`).toBeLessThan(0.1);
      expect(r.stalls, `bed ${bed}`).toBeLessThan(6);
      expect(r.far / near(from, to), `bed ${bed}`).toBeLessThan(2.2);
    }
  });
  it('from one end of a bed to the other it goes round the end of the row, the short way', () => {
    const from = right(2, 9), to = signs(2, 9), way = route(from, to);
    // (the plot's back end is nearer than its front: it goes that way)
    expect(routeLength(from, way)).toBeLessThan(near(from, to) + 2 * (ROW * 2.5));
    expect(walked(from, way).stalls).toBe(0);
  });
  it('every leg of a route is clear of beds, signs and everything else', () => {
    const rnd = mulberry32(11);
    for (let k = 0; k < 60; k++) {
      const a = Math.floor(rnd() * beds.length), b = Math.floor(rnd() * beds.length);
      const from = (rnd() < 0.5 ? right : signs)(a, Math.floor(rnd() * beds[a])), to = (rnd() < 0.5 ? right : signs)(b, Math.floor(rnd() * beds[b]));
      const way = route(from, to);
      way.forEach((q, i) => expect(clearLine(i ? way[i - 1] : from, q, solids, boxes, BUDDY_R, walkR, !i), `${JSON.stringify(from)} to ${JSON.stringify(to)}, leg ${i}`).toBe(true));
      // never a long way round: at most a bed's length or two longer than straight
      expect(routeLength(from, way)).toBeLessThan(near(from, to) * 1.05 + 2 * BED_L + 2 * 13 * ROW);
    }
  });
  it('finding a way is quick enough to do on a tap', () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) route(right(0, 10), signs(12, 10));
    expect((performance.now() - t0) / 20).toBeLessThan(50);
  });
  it('an end nobody can reach gives the spot itself, for the walk to slide toward', () => {
    const shut: Box[] = [{ x0: -3, x1: 3, z0: 1, z1: 1.4 }, { x0: -3, x1: 3, z0: 3.6, z1: 4 }, { x0: -3, x1: -2.6, z0: 1, z1: 4 }, { x0: 2.6, x1: 3, z0: 1, z1: 4 }];
    expect(findRoute({ x: 0, z: -6 }, { x: 0, z: 2.5 }, [], shut, BUDDY_R, 8)).toEqual([{ x: 0, z: 2.5 }]);
  });
});
