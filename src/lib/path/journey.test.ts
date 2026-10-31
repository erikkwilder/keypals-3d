// Journey mode: the trail shows My path's items, in My path's order, on one progress; each stretch fits on
// its world's map; who starts in which mode; and a grown-up's or teacher's Path only keeping a child on it.
import { describe, expect, it } from 'vitest';
import { migrate, newProfile, type Profile } from '../engine/profile';
import { finishLesson } from '../math/learn';
import { mathOf } from '../math/progress';
import { advOf, advView, NODE, nodesOf, type WorldId } from '../adventure/state';
import { trailsOf } from '../adventure/trails';
import { WORLD_PINS } from '../adventure/worlds';
import { mergeProfile } from '../state/merge';
import { pathOf } from './units';
import { nextOnPath, noteBattleLost, notePath, pathSave, pathStates, unitState } from './progress';
import { doorFor, pathHolds, rulesFor, setHomeRules } from './rules';
import { pathRun } from './launch';
import { unitFromAssignment } from './classPath';
import { mayRepeat, pathNext } from './next';
import { battleNode, journeyFor, journeyHere, journeyOf, modeFor, modeOf, routeOf, setMode, stopsOf, stretchesOf, STRETCH_MAX, unitWorld, type Stop } from './journey';

const NOW = Date.now();
const kid = () => newProfile('Maria', 'dino');
/** a stop as My path's item: the two stops of a practice trip are its two ticks, so they read as one */
const asItems = (st: Stop[]) => st.map(s => s.item.ref).filter((r, i, all) => r !== all[i - 1]);
const shownItems = (p: Profile, id: string) => unitState(p, pathOf('math').find(u => u.id === id)!, { now: NOW }).items.filter(i => i.skip !== 'nothing').map(i => i.ref);
function played(p: Profile, id: string, stars: number, finishes: number) {
  const m = (p.math = mathOf(p));
  m.lessons[id] = { stars, bestScore: 10, bestFpm: 10, bestAcc: 0.9, bestRide: 1, attempts: finishes, finishes, passes: stars ? 1 : 0, lastAt: NOW };
}
const fractions = () => pathOf('math').find(u => u.id === 'math:G3-U5')!;
/** a child on a unit: everything before it done, as a teacher's grade would put them there */
function onUnit(p: Profile, grade: number) { setHomeRules(p, { grade }); return journeyOf(p, NOW)!; }

describe('the stops are My path\'s items', () => {
  it('in every unit, the same items in the same order, for a new player', () => {
    const p = kid();
    for (const u of pathOf('math')) expect(asItems(stopsOf(unitState(p, u, { now: NOW }))), u.id).toEqual(shownItems(p, u.id));
  });
  it('and for a child part way through a unit', () => {
    const p = kid(), u = fractions();
    const trips = u.items.filter(i => i.ref.startsWith('trip:')).slice(0, 2);
    for (const t of trips) played(p, t.ref.split(':')[1], 2, 1);
    const s = unitState(p, u, { now: NOW });
    expect(asItems(stopsOf(s))).toEqual(shownItems(p, u.id));
    expect(s.done).toBeGreaterThan(0);
  });
  it('a lesson\'s practice trip is a camp, then a training ground, and it is one item', () => {
    const st = stopsOf(unitState(kid(), fractions(), { now: NOW }));
    const camp = st.findIndex(s => s.kind === 'try');
    expect(st[camp + 1].kind).toBe('practice');
    expect(st[camp + 1].item.ref).toBe(st[camp].item.ref);
  });
  it('has the stops of a day in order: warm-up, Learn, Try it, Practice, a game or battle, then a quick check', () => {
    const st = stopsOf(unitState(kid(), fractions(), { now: NOW }));
    const day2 = st.filter(s => s.day === 2).map(s => s.kind);
    expect(day2.filter(k => k !== 'warmup')).toEqual(['learn', 'try', 'practice', 'battle', 'quick']);
    expect(st[st.length - 1].kind).toBe('champion');
  });
  it('has one lit stop, the same thing My path says is next', () => {
    const p = kid();
    for (const g of [0, 3, 5, 8]) {
      const j = onUnit(p, g), n = nextOnPath(p, 'math', NOW, g)!;
      expect(j.stops.filter(s => s.lit)).toHaveLength(1);
      expect(j.lit!.item.ref).toBe(n.item.ref);
      expect(j.state.unit.id).toBe(n.unit.unit.id);
    }
  });
});

describe('one progress', () => {
  it('a step done on the path shows done on the trail, and is never asked for again', () => {
    const p = kid(), u = fractions();
    const trip = u.items.find(i => i.ref.startsWith('trip:'))!, id = trip.ref.split(':')[1];
    const before = stopsOf(unitState(p, u, { now: NOW })).filter(s => s.item.ref === trip.ref);
    expect(before.map(s => s.done)).toEqual([false, false]);
    played(p, id, 2, 1);
    const after = stopsOf(unitState(p, u, { now: NOW })).filter(s => s.item.ref === trip.ref);
    expect(after.map(s => s.done)).toEqual([true, true]);
    expect(unitState(p, u, { now: NOW }).items.find(i => i.ref === trip.ref)!.done).toBe(true);
    expect(stopsOf(unitState(p, u, { now: NOW })).find(s => s.lit)!.item.ref).not.toBe(trip.ref);
  });
  it('a step done on the trail shows on My path: one go lights the Practice, a star does both', () => {
    const p = kid(), u = fractions();
    const trip = u.items.find(i => i.ref.startsWith('trip:'))!, id = trip.ref.split(':')[1];
    played(p, id, 0, 1); // the Try it played to the end, no star
    const st = stopsOf(unitState(p, u, { now: NOW })).filter(s => s.item.ref === trip.ref);
    expect(st.map(s => s.done)).toEqual([true, false]);
    expect(unitState(p, u, { now: NOW }).items.find(i => i.ref === trip.ref)!.done).toBe(false);
    played(p, id, 0, 2); // finished twice: moved on
    expect(unitState(p, u, { now: NOW }).items.find(i => i.ref === trip.ref)!.done).toBe(true);
  });
  it('a stamped tick on My path stays done on the trail', () => {
    const p = kid(), u = fractions();
    const ep = u.items.find(i => i.ref.startsWith('ep:'))!;
    finishLesson(p, ep.ref.slice(3), NOW);
    notePath(p, NOW);
    expect(stopsOf(unitState(p, u, { now: NOW })).find(s => s.item.ref === ep.ref)!.done).toBe(true);
  });
  it('doing well never takes the day\'s battle or game away: a lesson finished today keeps its play today, on both', () => {
    const p = kid(), u = fractions();
    const day2 = u.items.filter(i => i.day === 2), id = day2.find(i => i.ref.startsWith('trip:'))!.ref.split(':')[1];
    const lesson = day2.find(i => i.ref.startsWith('trip:'))!.lesson!;
    played(p, id, 3, 1);
    const m = (p.math = mathOf(p));
    m.lessons[`${id}-qc`] = { stars: 3, bestScore: 10, bestFpm: 10, bestAcc: 1, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: NOW };
    const battle = u.items.find(i => i.kind === 'battle' && i.lesson === lesson)!;
    const today = unitState(p, u, { now: NOW });
    expect(today.lessons.find(l => l.id === lesson)!.ticks.done || today.lessons.find(l => l.id === lesson)!.ticks.known).toBeTruthy();
    expect(today.items.find(i => i.ref === battle.ref)!.skip).toBeUndefined();
    expect(stopsOf(today).some(s => s.item.ref === battle.ref)).toBe(true);
    // (the next day it's behind them: a lesson done before doesn't hold the unit open)
    expect(unitState(p, u, { now: NOW + 86400000 }).items.find(i => i.ref === battle.ref)!.skip).toBe('nothing');
  });
  it('a one-lesson unit done well in one go still has today\'s game before the path moves on', () => {
    const p = kid(), u = pathOf('math').find(x => x.id === 'math:GK-U3')!;
    const trip = u.items.find(i => i.ref.startsWith('trip:'))!, id = trip.ref.split(':')[1];
    played(p, id, 3, 1);
    const m = (p.math = mathOf(p));
    m.lessons[`${id}-qc`] = { stars: 3, bestScore: 10, bestFpm: 10, bestAcc: 1, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: NOW };
    const st = pathStates(p, 'math', NOW).find(s => s.unit.id === u.id)!;
    expect(st.status).toBe('current');
    expect(st.next!.kind).toBe('game');
    expect(pathStates(p, 'math', NOW + 86400000).find(s => s.unit.id === u.id)!.status).not.toBe('current');
  });
  it('a lesson shown known already is passed on the trail too', () => {
    const p = kid(), u = fractions();
    const id = u.lessons![0];
    const m = (p.math = mathOf(p));
    for (const t of u.items.filter(i => i.ref.startsWith('quick:') && i.lesson === id)) m.lessons[t.ref.split(':')[1]] = { stars: 3, bestScore: 10, bestFpm: 10, bestAcc: 1, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: NOW };
    const s = unitState(p, u, { now: NOW }), st = stopsOf(s);
    expect(st.filter(x => x.item.lesson === id).every(x => x.done)).toBe(true);
    expect(st.find(x => x.lit)!.item.ref).toBe(s.next!.ref);
  });
});

describe('the trail on the maps', () => {
  it('every world has a main route of at least six points, on both pictures', () => {
    for (const w of WORLD_PINS.filter(x => x.map)) {
      const r = routeOf(w.id as WorldId), tr = trailsOf(w.id as WorldId);
      expect(r.length, w.id).toBeGreaterThanOrEqual(STRETCH_MAX);
      for (const id of r) { expect(tr.point[id].at.wide, id).toBeTruthy(); expect(tr.point[id].at.tall, id).toBeTruthy(); }
      expect(r[0]).toBe(nodesOf(w.id as WorldId)[0].id);
      expect(NODE[r[r.length - 1]].kind).toBe('champion');
    }
  });
  it('no stretch has more stops than read clearly, and no stop is left out', () => {
    const p = kid();
    for (const u of pathOf('math')) {
      const st = stopsOf(unitState(p, u, { now: NOW })), pages = stretchesOf(st);
      expect(pages.flat().map(s => s.id), u.id).toEqual(st.map(s => s.id));
      for (const q of pages) expect(q.length, u.id).toBeLessThanOrEqual(STRETCH_MAX);
    }
  });
  it('every stretch of every unit sits on its own points, and the last ends on the Champion\'s spot', () => {
    for (const u of pathOf('math')) {
      const first = kid(), base = unitState(first, u, { now: NOW });
      const pages = stretchesOf(stopsOf(base));
      for (let k = 0; k < pages.length; k++) {
        // the stretch with the lit stop: everything before this page done
        const s = { ...base, items: base.items.map(i => (pages.slice(0, k).flat().some(x => x.item.ref === i.ref) ? { ...i, done: true } : i)) };
        const j = journeyFor(s);
        const here = j.stretch.map(x => x.at);
        expect(new Set(here).size, `${u.id} ${k}`).toBe(here.length);
        for (const a of here) expect(trailsOf(j.world).point[a], `${u.id} ${k}`).toBeTruthy();
        if (k === pages.length - 1) expect(NODE[here[here.length - 1]]?.kind, u.id).toBe('champion');
      }
    }
  });
  it('the buddy can walk from where it stands to the lit stop, on the route, and no further', () => {
    const p = kid(), j = journeyFor(unitState(p, fractions(), { now: NOW }));
    const r = routeOf(j.world), i = r.indexOf(j.lit!.at);
    expect(j.start).toBe(r[0]);
    expect(i).toBeGreaterThan(0); // a real walk to the first stop
    expect([...j.walk.shut]).toEqual(r.slice(i + 1));
  });
  it('a unit\'s world is the one its battles happen in, and every world has a map', () => {
    for (const u of pathOf('math')) {
      const b = u.items.find(i => i.ref.startsWith('battle:'));
      if (b) expect(unitWorld(u)).toBe(b.ref.split(':')[1]);
      expect(WORLD_PINS.find(w => w.id === unitWorld(u))?.map, u.id).toBeTruthy();
    }
  });
  it('a battle stop is a battle that is open, never a Champion or a practice stop', () => {
    const p = kid(), a = advOf(p);
    expect(battleNode(a, 'falls').id).toBe('falls-0');
    a.nodes['falls-0'] = 1;
    expect(battleNode(advView(p), 'falls').id).toBe('falls-1');
    a.nodes['falls-1'] = 2; // the practice stop waits: the last open battle again
    expect(battleNode(advView(p), 'falls').id).toBe('falls-1');
    for (const n of nodesOf('falls')) a.nodes[n.id] = 1;
    expect(NODE[battleNode(advView(p), 'falls').id].kind).toBe('battle');
  });
});

describe('a teacher\'s unit on the trail', () => {
  const given = { id: 'a1', title: 'Fractions this week', unit: 'math:G3-U5', subject: 'math', items: ['ep:frac-one-piece', 'skill:fr-name', 'trip:les-g3-one-piece', 'battle:falls', 'game:pizza', 'ep:frac-parts', 'skill:fr-compare', 'check'] };
  it('shows the teacher\'s items in the teacher\'s order, in its own world, a few at a time', () => {
    const u = unitFromAssignment(given), s = unitState(kid(), u, { now: NOW, since: NOW - 1000 }), j = journeyFor(s, 'Ms Lee');
    expect(unitWorld(u)).toBe('falls');
    expect(j.stops.map(x => x.item.ref)).toEqual(given.items);
    expect(j.teacher).toBe('Ms Lee');
    expect(j.stretch.length).toBeLessThanOrEqual(STRETCH_MAX);
    expect(j.pages).toBe(2);
    expect(j.lit!.item.ref).toBe(s.next!.ref);
  });
  it('a teacher\'s own list with no unit behind it finds a world from its battle, or the Sky Islands', () => {
    expect(unitWorld(unitFromAssignment({ id: 'a2', title: 'Mix', items: ['battle:caves', 'skill:fr-name'] }))).toBe('caves');
    expect(unitWorld(unitFromAssignment({ id: 'a3', title: 'Mix', items: ['skill:fr-name'] }))).toBe('sky');
  });
});

describe('who is on which mode', () => {
  const oldSave = () => migrate({ version: 1, activeId: 'a1', profiles: [{ id: 'a1', name: 'Old', buddy: 'dino', createdAt: new Date(2026, 3, 2).getTime(), adventure: { shells: 120, nodes: { 'meadow-0': 2 }, seen: ['intro', 'map1'], battles: 2, wins: 2 } }] }).profiles[0];
  it('a new player starts in Journey', () => { expect(modeOf(kid())).toBe('journey'); });
  it('an old player keeps Free play until they tap Journey, and loses nothing', () => {
    const p = oldSave();
    expect(modeOf(p)).toBe('free');
    expect(advOf(p).shells).toBe(120);
    expect(advOf(p).nodes['meadow-0']).toBe(2);
    setMode(p, 'journey');
    expect(modeOf(p)).toBe('journey');
    setMode(p, 'free');
    expect(modeOf(p)).toBe('free');
  });
  it('an old player with no Adventure at all is on Free play too', () => {
    const p = oldSave();
    delete (p as Partial<Profile>).adventure;
    expect(modeOf(p)).toBe('free');
  });
  it('the choice rides in the save and joins across two computers', () => {
    const a = oldSave(), b = oldSave();
    setMode(a, 'journey');
    a.updatedAt = 2000; b.updatedAt = 1000;
    expect(modeOf(mergeProfile(a, b, null))).toBe('journey');
    expect(modeOf(migrate({ version: 1, activeId: a.id, profiles: [JSON.parse(JSON.stringify(a))] }).profiles[0])).toBe('journey');
  });
  it('Path only keeps a child on the trail, whatever they chose, and gives their choice back after', () => {
    const p = oldSave();
    setHomeRules(p, { keep: 'only' });
    const r = rulesFor(p, [], NOW);
    expect(pathHolds(p, r, NOW)).toBe(true);
    expect(modeFor(p, true)).toBe('journey');
    expect(modeOf(p)).toBe('free');
    setHomeRules(p, { keep: 'off' });
    expect(modeFor(p, pathHolds(p, rulesFor(p, [], NOW), NOW))).toBe('free');
  });
  it('under Path only Free play is a door that names who set it, and the trail is the way in', () => {
    const p = oldSave();
    setHomeRules(p, { keep: 'only' });
    const home = rulesFor(p, [], NOW), cls = rulesFor(p, [{ keep: 'only' }], NOW);
    expect(doorFor('adventure', '', p, home, NOW)).toMatchObject({ kind: 'path', keep: 'only', from: 'home' });
    expect(doorFor('adventure', '', p, cls, NOW)).toMatchObject({ kind: 'path', keep: 'only', from: 'class' });
    expect(doorFor('adventure', '', p, home, NOW, 0, { work: journeyHere(p, 'math') })).toBeNull();
    // (Typing's Adventure has no trail: it stays behind the door)
    expect(doorFor('adventure', '', p, home, NOW, 0, { work: journeyHere(p, 'typing') })).not.toBeNull();
  });
  it('typing has no Journey', () => { expect(journeyHere(kid(), 'typing')).toBe(false); expect(journeyHere(kid(), 'math')).toBe(true); });
});

describe('the end cards', () => {
  const run = (activity: string, trail: boolean, ref = 'game:pizza:1', unit = 'math:G3-U5') => { pathRun.cur = { ref, subject: 'math', unit, activity, trail }; };
  it('a game or battle started from the path offers the next thing; anything else nothing', () => {
    const p = kid();
    run('game:pizza', false);
    expect(pathNext(p, 'game:pizza')).toMatchObject({ item: { ref: expect.any(String) } });
    expect(pathNext(p, 'game:pizza')!.trail).toBeUndefined();
    expect(pathNext(p, 'game:market')).toBeNull();
    pathRun.cur = null;
  });
  it('from the trail it leads back to the trail, with the lit stop named, even when that is the same step', () => {
    const p = kid(), j = journeyOf(p, NOW)!;
    run(`lesson:x`, true, j.lit!.item.ref, j.state.unit.id);
    expect(pathNext(p, 'lesson:x')).toMatchObject({ trail: true, name: j.lit!.name });
    pathRun.cur = null;
  });
  it('Play again goes from a card when a child is held to the path, or on the trail', () => {
    const p = kid();
    run('battle:falls', false);
    expect(mayRepeat(p, 'battle:falls')).toBe(true);
    run('battle:falls', true);
    expect(mayRepeat(p, 'battle:falls')).toBe(false);
    run('battle:falls', false);
    setHomeRules(p, { keep: 'only' });
    expect(mayRepeat(p, 'battle:falls')).toBe(false);
    pathRun.cur = null;
  });
  it('the path\'s states are unchanged by any of this', () => {
    const p = kid(), before = JSON.stringify(pathStates(p, 'math', NOW).map(s => [s.unit.id, s.status, s.done]));
    journeyOf(p, NOW);
    expect(JSON.stringify(pathStates(p, 'math', NOW).map(s => [s.unit.id, s.status, s.done]))).toBe(before);
  });
});

describe('a battle on the path', () => {
  it('counts as done after two losses, so a stop is never a wall', () => {
    const p = { path: { done: {}, cur: 1 } } as unknown as Profile;
    expect(noteBattleLost(p, 'G3-U5', 'battle:falls:1')).toBe(false);
    expect(pathSave(p).done?.['G3-U5/battle:falls:1']).toBeUndefined();
    expect(noteBattleLost(p, 'G3-U5', 'battle:falls:1')).toBe(true);
    expect(pathSave(p).done?.['G3-U5/battle:falls:1']).toBeDefined();
  });
  it('keeps what was stamped before', () => {
    const p = { path: { done: { 'x/y': 5 }, cur: 1 } } as unknown as Profile;
    noteBattleLost(p, 'G3-U5', 'battle:falls:1'); noteBattleLost(p, 'G3-U5', 'battle:falls:1');
    expect(pathSave(p).done?.['x/y']).toBe(5);
  });
});
