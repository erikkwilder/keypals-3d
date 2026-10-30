import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { advOf } from '../adventure/state';
import { mergeProfile } from './merge';

/** a player both computers had, then each played on its own */
function start(): Profile {
  const p = newProfile('Mia', 'dino');
  p.updatedAt = 1000;
  p.lessons['village-1'] = { stars: 1, bestWpm: 8, bestAcc: 0.9, bestRide: 1, attempts: 2, passes: 1, lastAt: 900 };
  p.totals.runs = 5; p.totals.chars = 500;
  p.days['2026-10-28'] = { ms: 60000, runs: 2 };
  p.pals.dino = { ...p.pals.dino!, xp: 200, runs: 5 };
  p.book = { stickers: { 'runs-1': { at: 500, by: 'dino' } }, medals: { clean: 2 }, total: 2, fresh: ['runs-1'] };
  const a = advOf(p);
  a.shells = 100; a.battles = 3;
  a.glimmers = { puddlepup: { level: 2, xp: 5, got: 700 } };
  a.team = ['puddlepup', null];
  a.incubator = [{ id: 'e1', rarity: 'common', need: 20, have: 4, got: 800 }, null, null];
  a.nest = [];
  p.math = { home: 'math', facts: { '3x4': { stage: 2, seen: 4, right: 3, wrong: 1, times: [3000], fastDays: ['2026-10-27'], last: 950, due: 0, step: 0 } }, lessons: {}, history: [], totals: { trips: 2, facts: 40, ms: 120000 } };
  return p;
}
const copy = (p: Profile) => structuredClone(p);

describe('combining two computers', () => {
  it('adds what each computer earned since they last agreed, without counting anything twice', () => {
    const base = start();
    // the laptop: a lesson played, 30 shells earned, a sticker won
    const laptop = copy(base); laptop.updatedAt = 2000;
    laptop.lessons['village-1'].attempts = 3; laptop.lessons['village-1'].stars = 3;
    laptop.totals.runs = 6; laptop.days['2026-10-28'].ms = 120000;
    laptop.pals.dino!.xp = 260; advOf(laptop).shells = 130;
    laptop.book!.stickers['three-1'] = { at: 1900, by: 'dino' }; laptop.book!.medals.clean = 3; laptop.book!.total = 3;
    // the tablet, offline: two lessons, 90 shells spent on an egg, a battle won, a new Glimmer
    const tablet = copy(base); tablet.updatedAt = 1800;
    tablet.lessons['village-1'].attempts = 4; tablet.lessons['village-2'] = { stars: 2, bestWpm: 9, bestAcc: 0.95, bestRide: 2, attempts: 1, passes: 1, lastAt: 1700 };
    tablet.totals.runs = 7; tablet.days['2026-10-28'].ms = 90000;
    tablet.pals.dino!.xp = 300;
    const ta = advOf(tablet); ta.shells = 10; ta.battles = 4; ta.glimmers.embernewt = { level: 1, xp: 0, got: 1750 };
    tablet.book!.medals.clean = 4; tablet.book!.total = 4;

    const m = mergeProfile(laptop, tablet, base);
    expect(m.lessons['village-1'].stars).toBe(3);
    expect(m.lessons['village-1'].attempts).toBe(2 + 1 + 2);
    expect(m.lessons['village-2'].stars).toBe(2);
    expect(m.totals.runs).toBe(5 + 1 + 2);
    expect(m.days['2026-10-28'].ms).toBe(60000 + 60000 + 30000);
    expect(m.pals.dino!.xp).toBe(200 + 60 + 100);
    // shells: +30 on the laptop, -90 on the tablet
    expect(m.adventure!.shells).toBe(100 + 30 - 90);
    expect(m.adventure!.battles).toBe(4);
    expect(Object.keys(m.adventure!.glimmers).sort()).toEqual(['embernewt', 'puddlepup']);
    expect(Object.keys(m.book!.stickers).sort()).toEqual(['runs-1', 'three-1']);
    expect(m.book!.medals.clean).toBe(2 + 1 + 2);
    expect(m.book!.total).toBe(5);
    // this computer keeps its own id
    expect(m.id).toBe(laptop.id);
  });

  it('eggs: a hatched egg stays hatched, new eggs from both are kept, warmth adds up', () => {
    const base = start();
    const a = copy(base); a.updatedAt = 2000;
    // hatched e1 into a Glimmer on this one
    advOf(a).incubator = [null, null, null]; advOf(a).glimmers.sproutbun = { level: 1, xp: 0, got: 1900 };
    advOf(a).nest = [{ id: 'e3', rarity: 'rare', need: 45, have: 0, got: 1950 }];
    const b = copy(base); b.updatedAt = 1500;
    // warmed e1 by 6 and got a new egg e2 on the other
    advOf(b).incubator = [{ ...advOf(b).incubator[0]!, have: 10 }, { id: 'e2', rarity: 'uncommon', need: 30, have: 3, got: 1400 }, null];
    const m = mergeProfile(a, b, base);
    const ids = [...m.adventure!.incubator, ...m.adventure!.nest].filter(Boolean).map(e => e!.id).sort();
    expect(ids).toEqual(['e2', 'e3']);
    expect(m.adventure!.glimmers.sproutbun).toBeTruthy();

    // both warmed the same egg: the warmth adds up (and stops at what it needs)
    const c = copy(base); c.updatedAt = 3000; advOf(c).incubator[0]!.have = 9;
    const d = copy(base); d.updatedAt = 2500; advOf(d).incubator[0]!.have = 12;
    expect(mergeProfile(c, d, base).adventure!.incubator[0]!.have).toBe(4 + 5 + 8);
  });

  it('a fact takes its stage from whoever asked it last; the counts add up', () => {
    const base = start();
    const a = copy(base); a.updatedAt = 2000;
    Object.assign(a.math!.facts['3x4'], { stage: 3, seen: 6, right: 5, last: 1900 });
    const b = copy(base); b.updatedAt = 2100;
    Object.assign(b.math!.facts['3x4'], { stage: 1, seen: 5, wrong: 2, last: 2050, fastDays: [] });
    const m = mergeProfile(a, b, base);
    expect(m.math!.facts['3x4'].stage).toBe(1);
    expect(m.math!.facts['3x4'].seen).toBe(4 + 2 + 1);
    expect(m.math!.facts['3x4'].right).toBe(5);
    expect(m.math!.facts['3x4'].wrong).toBe(2);
  });

  it('ability estimates: the one with clearly more answers wins, else the newer; skill memory merges like facts', () => {
    const base = start();
    base.math!.ability = { 'fr-name': { t: 2, n: 10, at: 900 }, 'pv-add': { t: 3, n: 30, at: 900 } };
    base.math!.skills = { 'fr-name:4': { stage: 2, seen: 4, right: 3, wrong: 1, times: [5000], fastDays: [], last: 900, due: 0, step: 0 } };
    // the tablet played a long fraction trip (many answers); the laptop, later, a few on its own
    const tablet = copy(base); tablet.updatedAt = 2000;
    tablet.math!.ability!['fr-name'] = { t: 4.2, n: 40, at: 1900 };
    tablet.math!.ability!['pv-add'] = { t: 3.4, n: 34, at: 1900 };
    Object.assign(tablet.math!.skills!['fr-name:4'], { stage: 3, seen: 9, right: 8, last: 1900 });
    const laptop = copy(base); laptop.updatedAt = 2100;
    laptop.math!.ability!['fr-name'] = { t: 2.5, n: 12, at: 2050 };
    laptop.math!.ability!['pv-add'] = { t: 3.1, n: 32, at: 2050 };
    laptop.math!.ability!['dm-coins'] = { t: 1.8, n: 3, at: 2050 };
    const m = mergeProfile(laptop, tablet, base);
    expect(m.math!.ability!['fr-name']).toEqual({ t: 4.2, n: 40, at: 1900 }); // clearly more evidence
    expect(m.math!.ability!['pv-add']).toEqual({ t: 3.1, n: 32, at: 2050 }); // about the same: the newer
    expect(m.math!.ability!['dm-coins'].n).toBe(3); // only one side had it
    expect(m.math!.skills!['fr-name:4'].stage).toBe(3);
    expect(m.math!.skills!['fr-name:4'].seen).toBe(9);
    // and an old save with no estimates at all merges with a new one
    const old = copy(base); delete old.math!.ability; old.updatedAt = 900;
    expect(mergeProfile(old, laptop, null).math!.ability!['pv-add'].t).toBe(3.1);
  });

  it('choices come from the copy that changed last', () => {
    const base = start();
    const a = copy(base); a.updatedAt = 2000; a.settings.volume = 0.3; advOf(a).team = ['puddlepup', null];
    const b = copy(base); b.updatedAt = 2500; b.settings.dailyGoalMin = 15; b.name = 'Mia R';
    const m = mergeProfile(a, b, base);
    expect(m.name).toBe('Mia R');
    expect(m.settings.dailyGoalMin).toBe(15);
    expect(m.settings.volume).toBe(b.settings.volume);
  });

  it('with no shared copy, nothing is lost and nothing is doubled: counts take the higher', () => {
    const a = start(); a.updatedAt = 2000; advOf(a).shells = 120; a.totals.runs = 9;
    const b = start(); b.updatedAt = 1500; advOf(b).shells = 140; b.totals.runs = 7; b.book!.stickers['goal-1'] = { at: 1400, by: 'dino' };
    const m = mergeProfile(a, b, null);
    expect(m.adventure!.shells).toBe(140);
    expect(m.totals.runs).toBe(9);
    expect(m.book!.stickers['goal-1']).toBeTruthy();
  });

  it('a full nest turns extra eggs into shells, as the game does', () => {
    const base = start();
    const egg = (i: number) => ({ id: `n${i}`, rarity: 'common' as const, need: 20, have: 0, got: 1000 + i });
    const a = copy(base); a.updatedAt = 2000; advOf(a).nest = Array.from({ length: 6 }, (_, i) => egg(i));
    const b = copy(base); b.updatedAt = 1900; advOf(b).nest = Array.from({ length: 6 }, (_, i) => egg(i + 10));
    const m = mergeProfile(a, b, base);
    expect(m.adventure!.nest.length).toBe(9);
    expect(m.adventure!.shells).toBe(100 + 3 * 15);
  });

  it('a count the shared copy did not have yet started at zero (both computers earned shells)', () => {
    const base = newProfile('Ava', 'koala'); base.updatedAt = 1000;
    const a = copy(base); a.updatedAt = 2000; advOf(a).shells = 25; advOf(a).nest = [{ id: 'x1', rarity: 'common', need: 20, have: 0, got: 1 }];
    const b = copy(base); b.updatedAt = 1500; advOf(b).shells = 40; b.book = { stickers: { 'goal-1': { at: 1400, by: 'koala' } }, medals: {}, total: 0, fresh: [] };
    const m = mergeProfile(a, b, base);
    expect(m.adventure!.shells).toBe(65);
    expect(m.adventure!.nest.map(e => e.id)).toEqual(['x1']);
    expect(m.book!.stickers['goal-1']).toBeTruthy();
  });

  it('fields this file does not know yet still merge sensibly', () => {
    const base = start();
    const a = copy(base) as Profile & { future?: { count: number; tags: string[] } }; a.updatedAt = 2000; a.future = { count: 3, tags: ['x'] };
    const b = copy(base) as Profile & { future?: { count: number; tags: string[] } }; b.updatedAt = 1000; b.future = { count: 5, tags: ['y'] };
    const m = mergeProfile(a, b, base) as Profile & { future?: { count: number; tags: string[] } };
    expect(m.future!.count).toBe(5);
    expect(m.future!.tags.sort()).toEqual(['x', 'y']);
  });
});
