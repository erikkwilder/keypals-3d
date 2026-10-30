import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { advOf, currentNode, islandsOf, NODE, NODES, nodeOpen, nodesOf, reachStop, notePractice, collectStop, type WorldId } from './state';
import { buildTrails, findId, legLength, legPoints, parallel, simplePlan, stopOnTrails, trailsOf, WORLDS_WITH_TRAILS, type MapKind } from './trails';
import { ctxOf, locked, pickTrail, reachable, route, startPoint } from './walk';
import { applyBonus, collectHidden, findDone, openChest, revealHidden, saveWalk } from './finds';
import { WORLD_PIN, WORLD_PINS } from './worlds';

const KINDS: MapKind[] = ['wide', 'tall'];
const sizeOf = (w: WorldId, k: MapKind) => WORLD_PIN[w].map!.size[k];
/** every world with a map of its own (a plan placed by eye, or the simple path) */
const OPEN = WORLD_PINS.filter(w => w.map).map(w => w.id as WorldId);
/** a save with every stop of a world won and every hidden spot found */
function allDone(world: WorldId) {
  const p = newProfile('Ava', 'dino'), a = advOf(p);
  for (const n of nodesOf(world)) a.nodes[n.id] = 1;
  a.hidden = islandsOf(world).map(i => findId(i.id, 'hidden'));
  return p;
}

describe('the trails on the Adventure maps', () => {
  it('every world that is open has trails, and every stop of it is on them', () => {
    expect([...WORLDS_WITH_TRAILS].sort()).toEqual(['caves', 'clockwork', 'falls', 'frost', 'jungle', 'market', 'peaks', 'sky']);
    for (const w of OPEN) {
      const tr = trailsOf(w);
      for (const n of nodesOf(w)) expect(tr.point[n.id]?.kind).toBe('stop');
      // and nothing on a map is off the picture
      for (const p of tr.points) for (const k of KINDS) { const [x, y] = p.at[k]; expect(x > 0 && x < 100 && y > 0 && y < 100).toBe(true); }
      for (const e of tr.edges) for (const k of KINDS) expect(legLength(tr, e, k, sizeOf(w, k))).toBeGreaterThan(20);
    }
  });
  it('every stop and find can be reached from the start once everything is done', () => {
    for (const w of OPEN) for (const k of KINDS) {
      const p = allDone(w), c = ctxOf(w, k, sizeOf(w, k), advOf(p));
      const seen = reachable(c, nodesOf(w)[0].id);
      for (const pt of trailsOf(w).points) expect(seen.has(pt.id), `${w} ${k} ${pt.id}`).toBe(true);
    }
  });
  it('each island has a chest, a Bonus Round and a hidden spot on side trails', () => {
    for (const w of WORLDS_WITH_TRAILS) for (const isl of islandsOf(w)) {
      const tr = trailsOf(w);
      for (const f of ['chest', 'bonus', 'hidden'] as const) { expect(tr.point[findId(isl.id, f)]?.kind).toBe(f); expect(tr.out[findId(isl.id, f)].length).toBe(1); }
      expect(tr.out[findId(isl.id, 'hidden')][0].hidden).toBe(true);
    }
  });
  it('the trail splits into two routes, each with its own battle, and they meet again before the Champion', () => {
    for (const w of WORLDS_WITH_TRAILS) for (const isl of islandsOf(w)) {
      const p = allDone(w), c = ctxOf(w, 'wide', sizeOf(w, 'wide'), advOf(p)), tr = trailsOf(w);
      const s2 = `${isl.id}-2`, s3 = `${isl.id}-3`, s4 = `${isl.id}-4`, champ = `${isl.id}-5`;
      // two ways from the practice stop to the Champion: one through each battle, never through the other
      const without = (skip: string) => {
        const seen = new Set([s2, skip]), todo = [s2];
        while (todo.length) { const q = todo.pop()!; for (const e of tr.out[q]) { const o = e.a === q ? e.b : e.a; if (!seen.has(o)) { seen.add(o); todo.push(o); } } }
        return seen.has(champ);
      };
      expect(without(s3), `${isl.id} the route past stop 4`).toBe(true);
      expect(without(s4), `${isl.id} the route past stop 3`).toBe(true);
      expect(tr.out[s2].filter(e => !['bonus', 'chest', 'hidden'].some(f => e.b.endsWith(f))).length).toBe(3);
      void c;
    }
  });
  it('either branch battle can come first; the Champion waits for both', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(parallel('meadow-3', 'meadow-4')).toBe(true);
    expect(parallel('meadow-3', 'treetops-4')).toBe(false);
    a.nodes['meadow-0'] = 1; a.nodes['meadow-1'] = 1;
    reachStop(a, 'meadow-2'); notePractice(p, 5); collectStop(p, 'meadow-2');
    expect(nodeOpen(a, NODE['meadow-3'])).toBe(true);
    expect(nodeOpen(a, NODE['meadow-4'])).toBe(true);
    a.nodes['meadow-4'] = 1;
    expect(nodeOpen(a, NODE['meadow-5'])).toBe(false);
    expect(currentNode(a)!.id).toBe('meadow-3');
    a.nodes['meadow-3'] = 1;
    expect(nodeOpen(a, NODE['meadow-5'])).toBe(true);
  });
});

describe('a world with no trails placed yet', () => {
  it('walks a simple path through its stops, at their places on the maps', () => {
    for (const w of OPEN) {
      const tr = buildTrails(w, simplePlan(w)), stops = nodesOf(w);
      expect(tr.points.map(p => p.id)).toEqual(stops.map(n => n.id));
      expect(tr.edges).toHaveLength(stops.length - 1);
      for (const k of KINDS) {
        for (const e of tr.edges) expect(legLength(tr, e, k, sizeOf(w, k))).toBeGreaterThan(20);
        const p = allDone(w), c = { ...ctxOf(w, k, sizeOf(w, k), advOf(p)), tr };
        expect(reachable(c, stops[0].id).size).toBe(stops.length);
      }
    }
    // the Sky Islands' three islands are joined end to end
    const sky = buildTrails('sky', simplePlan('sky'));
    expect(sky.edges.some(e => e.a === 'meadow-5' && e.b === 'treetops-0')).toBe(true);
  });
  it('a new player there can walk to the first stops, with a gate before the Champion', () => {
    const p = newProfile('Ava', 'dino'), tr = buildTrails('peaks', simplePlan('peaks'));
    const c = { ...ctxOf('peaks', 'wide', sizeOf('peaks', 'wide'), advOf(p)), tr };
    expect(reachable(c, 'peaks-0').has('peaks-0')).toBe(true);
    expect(locked(c, 'peaks-5')).toBe(true);
  });
});

describe('walking the trails', () => {
  it('a new player can walk from the first battle to the chest, and up to a gate before the next stop', () => {
    const p = newProfile('Ava', 'dino'), c = ctxOf('sky', 'wide', sizeOf('sky', 'wide'), advOf(p));
    expect([...reachable(c, 'meadow-0')].sort()).toEqual(['meadow-0', 'meadow-chest']);
    expect(locked(c, 'meadow-1')).toBe(true);
    const r = route(c, 'meadow-0', 'meadow-1')!;
    expect(r.length).toBe(1);
    expect(r[0].stop).toBeLessThan(r[0].len);
    expect(r[0].stop).toBeGreaterThan(r[0].len * 0.5);
    expect(route(c, 'meadow-0', 'meadow-chest')!.map(l => l.to)).toEqual(['meadow-chest']);
  });
  it('tap-to-walk finds the shortest way along the trails, past stops and round the branches', () => {
    const p = allDone('sky'), c = ctxOf('sky', 'wide', sizeOf('sky', 'wide'), advOf(p));
    const r = route(c, 'meadow-0', 'bay-5')!;
    expect(r[0].from).toBe('meadow-0');
    expect(r[r.length - 1].to).toBe('bay-5');
    for (let i = 1; i < r.length; i++) expect(r[i].from).toBe(r[i - 1].to);
    expect(r.every(l => l.stop === l.len)).toBe(true);
    // back the other way works too
    expect(route(c, 'bay-5', 'meadow-chest')!.at(-1)!.to).toBe('meadow-chest');
  });
  it('a push picks the trail heading that way, forward or back', () => {
    const p = allDone('falls'), c = ctxOf('falls', 'wide', sizeOf('falls', 'wide'), advOf(p));
    // stop 1 is up and to the right of stop 0 on the wide map; the chest is to its left
    expect(pickTrail(c, 'falls-0', [0.7, -0.7])!.b).toBe('falls-1');
    expect(pickTrail(c, 'falls-0', [-1, 0])!.b).toBe('falls-chest');
    expect(pickTrail(c, 'falls-1', [-0.7, 0.7])!.a).toBe('falls-0');
  });
  it('a hidden spot\'s trail opens once you have walked close to it', () => {
    const p = allDone('sky'), a = advOf(p);
    a.hidden = [];
    const c = ctxOf('sky', 'tall', sizeOf('sky', 'tall'), a);
    expect(reachable(c, 'meadow-0').has('meadow-hidden')).toBe(false);
    expect(revealHidden(p, 'meadow')).toBe(true);
    expect(reachable(c, 'meadow-0').has('meadow-hidden')).toBe(true);
  });
  it('the buddy starts where it stood, so it is back at its stop after a battle', () => {
    const p = allDone('caves'), a = advOf(p);
    const c = ctxOf('caves', 'wide', sizeOf('caves', 'wide'), a);
    saveWalk(p, 'caves', 'caves-3');
    expect(startPoint(c, 'caves')).toBe('caves-3');
    // a place it can't stand (a gate shut since): the next stop instead
    const q = newProfile('Bo', 'dino'), b = advOf(q);
    saveWalk(q, 'caves', 'caves-4');
    expect(startPoint(ctxOf('caves', 'wide', sizeOf('caves', 'wide'), b), 'caves')).toBe('caves-0');
  });
});

describe('older saves on the new trails', () => {
  it('every old stop id is a stop on the trails, and the progress reads the same', () => {
    for (const n of NODES) expect(stopOnTrails(trailsOf(OPEN.find(w => nodesOf(w).includes(n))!).world, n.id)).toBe(n.id);
    // an older save part way through: battles won up to the old fourth stop of Treetop Hollow
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    for (const id of ['meadow-0', 'meadow-1', 'meadow-2', 'meadow-3', 'meadow-4', 'meadow-5', 'treetops-0', 'treetops-1', 'treetops-2', 'treetops-3']) a.nodes[id] = 1;
    a.stopAt = { 'meadow-2': 0, 'treetops-2': 1 }; a.practiceSessions = 2;
    expect(currentNode(a)!.id).toBe('treetops-4');
    expect(nodeOpen(a, NODE['treetops-4'])).toBe(true);
    expect(nodeOpen(a, NODE['treetops-5'])).toBe(false);
    const c = ctxOf('sky', 'wide', sizeOf('sky', 'wide'), a);
    // no place saved yet: it starts on its next stop, and everything it had done can be walked to
    expect(startPoint(c, 'sky')).toBe('treetops-4');
    const seen = reachable(c, 'meadow-0');
    for (const id of Object.keys(a.nodes)) expect(seen.has(id)).toBe(true);
    expect(seen.has('treetops-5')).toBe(false);
  });
});

describe('finds on the trails', () => {
  it('a chest opens once a day: shells, and the first one ever has an egg', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p), now = Date.now();
    const f = openChest(p, 'meadow', now)!;
    expect(f.shells).toBeGreaterThanOrEqual(10);
    expect(f.egg).not.toBeNull();
    expect(a.shells).toBe(f.shells);
    expect(openChest(p, 'meadow', now)).toBeNull();
    expect(findDone(a, 'meadow-chest', now)).toBe(true);
    expect(openChest(p, 'meadow', now + 86400000 * 1.01)).not.toBeNull();
  });
  it('a hidden spot gives a jewel the first time, a little after that', () => {
    const p = newProfile('Ava', 'dino'), now = Date.now();
    const f = collectHidden(p, 'falls', now)!;
    expect(f).toMatchObject({ first: true, shells: 30 });
    expect(['ruby', 'diamond']).toContain(f.treasure);
    expect(collectHidden(p, 'falls', now)).toBeNull();
    expect(collectHidden(p, 'falls', now + 86400000 * 1.01)!.first).toBe(false);
  });
  it('a Bonus Round pays its stars like practice, then the chest, once a day per island', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p), now = Date.now();
    const run = { island: 'meadow' as const, at: now, ms: 60000, right: 5, answers: 5, answered: [{ f: { a: 3, b: 4, op: '+' as const }, ok: true, thinkMs: 1500 }], skillAnswers: [] };
    const out = applyBonus(p, run)!;
    expect(out.stars).toBe(3);
    expect(out.settled.shells).toBeGreaterThan(0);
    expect(out.chest.shells).toBe(25);
    expect(a.shells).toBe(out.settled.shells + out.chest.shells + (out.chest.eggFull ? 0 : 0));
    expect(p.math!.facts['3+4'].seen).toBe(1);
    expect(a.practiceSessions).toBe(1);
    expect(applyBonus(p, run)).toBeNull();
    expect(applyBonus(p, { ...run, island: 'treetops' })).not.toBeNull();
  });
});

// (legPoints is used by the screen to draw the trails; it always runs end to end)
it('a trail drawn from either end is the same line', () => {
  const tr = trailsOf('market'), e = tr.edges[3];
  expect(legPoints(tr, e, e.b, 'tall')).toEqual(legPoints(tr, e, e.a, 'tall').slice().reverse());
});
