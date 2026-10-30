import { describe, expect, it } from 'vitest';
import { dayKey, newProfile, type Profile } from '../engine/profile';
import { mulberry32 } from '../engine/rng';
import { advOf, advView } from '../adventure/state';
import { GLIMMER, GLIMMERS, type GlimmerId } from '../adventure/glimmers';
import { ITEM, ITEMS } from './catalog';
import {
  GIFT_SHELLS_DAY, GROWTH, MAX_OUT, STARTER, VISIT_GAP, VISITS_A_DAY, buy, buyAndPlace, checkVisitor, familyOf, fits, freeSpot, growthOf, heartNews,
  invitesOf, islandOf, islandView, leaveHeart, move, outOf, place, putAway, seeHearts, setOut, stageOf, storedOf, visitDue, visitorNow, whereToMeet,
} from './save';

const T0 = new Date('2026-10-29T09:00:00').getTime();
const H = 3600_000;
function player(name = 'Mia', shells = 1000): Profile {
  const p = newProfile(name, 'dino');
  advOf(p).shells = shells;
  return p;
}
const own = (p: Profile, ...ids: GlimmerId[]) => { const a = advOf(p); for (const id of ids) a.glimmers[id] = { level: 3, xp: 0, got: T0 }; };

describe('the island starts with a cottage, a tree, a path and two bushes', () => {
  it('places the starter kit once, inside the island', () => {
    const p = player();
    const s = islandOf(p, T0);
    expect(Object.keys(s.placed).length).toBe(Object.values(STARTER).reduce((a, b) => a + b, 0));
    for (const pl of Object.values(s.placed)) expect(fits({ ...s, placed: {} }, GROWTH[0].r, ITEM[pl.item], pl.x, pl.z, pl.rot)).toBe(true);
    // nothing in storage, and the starter doesn't invite visitors by itself (what you build does)
    expect(storedOf(s, 'cottage')).toBe(0);
    expect(Object.values(invitesOf(s)).every(n => n === 0)).toBe(true);
    islandOf(p, T0 + 1000);
    expect(Object.keys(p.island!.placed).length).toBe(8);
  });
});

describe('buying, placing, moving and putting away', () => {
  it('spends shells to buy into storage, and placing takes it out', () => {
    const p = player('Mia', 100);
    expect(buy(p, 'flowers')).toEqual({ ok: true });
    expect(advView(p).shells).toBe(100 - ITEM.flowers.price);
    expect(storedOf(islandOf(p), 'flowers')).toBe(1);
    const spot = freeSpot(islandOf(p), growthOf(p).r, ITEM.flowers, 0, { x: 2, z: 2 })!;
    const r = place(p, 'flowers', spot.x, spot.z, 0, T0);
    expect(r.ok).toBe(true);
    expect(storedOf(islandOf(p), 'flowers')).toBe(0);
    // no more in storage: placing again doesn't work
    expect(place(p, 'flowers', spot.x + 1, spot.z, 0, T0).ok).toBe(false);
  });
  it('never spends shells it does not have, and gifts are not for sale', () => {
    const p = player('Mia', 50);
    const r = buy(p, 'lookout');
    expect(r.ok).toBe(false);
    expect(advView(p).shells).toBe(50);
    expect(buy(p, 'gem-sun').ok).toBe(false);
    expect(ITEMS.filter(i => !i.gift).every(i => i.price > 0)).toBe(true);
  });
  it('buyAndPlace spends nothing when the thing does not fit', () => {
    const p = player('Mia', 500);
    islandOf(p, T0);
    // on top of the cottage
    expect(buyAndPlace(p, 'pond', 0, -3, 0, T0).ok).toBe(false);
    expect(advView(p).shells).toBe(500);
    // off the edge of the island
    expect(buyAndPlace(p, 'pond', 6, 6, 0, T0).ok).toBe(false);
    expect(advView(p).shells).toBe(500);
    const ok = buyAndPlace(p, 'pond', 2, 1, 0, T0);
    expect(ok.ok).toBe(true);
    expect(advView(p).shells).toBe(500 - ITEM.pond.price);
  });
  it('moves and turns things only where they fit, and puts them back in storage', () => {
    const p = player();
    const r = buyAndPlace(p, 'bench', 2, 1, 0, T0);
    if (!r.ok) throw new Error(r.why);
    const uid = r.uid!;
    // a bench is 2 by 1: turned, it's 1 by 2
    expect(move(p, uid, 3, 0, 1, T0 + 1).ok).toBe(true);
    expect(p.island!.placed[uid]).toMatchObject({ x: 3, z: 0, rot: 1 });
    expect(move(p, uid, 0, -3, 0, T0 + 2).ok).toBe(false); // the cottage is there
    expect(putAway(p, uid).ok).toBe(true);
    expect(p.island!.placed[uid]).toBeUndefined();
    expect(storedOf(islandOf(p), 'bench')).toBe(1);
  });
});

describe('the island grows with the Glimmers met', () => {
  it('follows the collection goals', () => {
    expect(stageOf(0)).toBe(0);
    expect(stageOf(2)).toBe(0);
    expect(stageOf(3)).toBe(1);
    expect(stageOf(24)).toBe(3);
    expect(stageOf(25)).toBe(4);
    expect(stageOf(50)).toBe(5);
    expect(stageOf(100)).toBe(GROWTH.length - 1);
    const p = player();
    expect(growthOf(p)).toMatchObject({ stage: 0, r: GROWTH[0].r, next: GROWTH[1] });
    own(p, ...GLIMMERS.slice(0, 8).map(g => g.id));
    expect(growthOf(p)).toMatchObject({ stage: 2, met: 8, r: GROWTH[2].r });
  });
  it('a bigger island has room further out', () => {
    const p = player();
    expect(buyAndPlace(p, 'flowers', 5, 0, 0, T0).ok).toBe(false);
    own(p, ...GLIMMERS.slice(0, 3).map(g => g.id));
    expect(buyAndPlace(p, 'flowers', 5, 0, 0, T0).ok).toBe(true);
  });
});

describe('the Glimmers who live there', () => {
  it('puts out the team first, at most eight, only Glimmers you have', () => {
    const p = player();
    own(p, ...GLIMMERS.slice(0, 12).map(g => g.id));
    advOf(p).team = ['frostowl', null];
    const out = outOf(p);
    expect(out.length).toBe(MAX_OUT);
    expect(out[0]).toBe('frostowl');
    setOut(p, ['puddlepup', 'skywhale' as GlimmerId]);
    expect(outOf(p)).toEqual(['puddlepup']);
  });
});

describe('visitors come because of what is built', () => {
  it('nobody comes to an island with nothing that invites them', () => {
    const p = player();
    islandOf(p, T0);
    for (let i = 0; i < 10; i++) expect(checkVisitor(p, T0 + i * VISIT_GAP)).toBeNull();
  });
  it('a habitat brings visitors of its element, and only Glimmers with a model', () => {
    const p = player();
    buyAndPlace(p, 'icepool', 2, 1, 0, T0);
    expect(visitDue(islandOf(p), T0)).toBe(true);
    const seen = new Set<GlimmerId>();
    for (let i = 0; i < 40; i++) {
      const q = structuredClone(p);
      const v = checkVisitor(q, T0 + i * 7, mulberry32(i + 1))!;
      expect(v).not.toBeNull();
      expect(GLIMMER[v.id].element).toBe('frost');
      expect(GLIMMER[v.id].pending).toBeFalsy();
      seen.add(v.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });
  it('a visit never gives the Glimmer, and says where to meet one not met yet', () => {
    const p = player();
    buyAndPlace(p, 'tidepond', 2, 1, 0, T0);
    const before = Object.keys(advView(p).glimmers).length;
    const v = checkVisitor(p, T0, mulberry32(3))!;
    expect(v.met).toBe(false);
    expect(Object.keys(advView(p).glimmers).length).toBe(before);
    expect(advView(p).glimmers[v.id]).toBeUndefined();
    // a Glimmer from the bay says so; the brief's example
    expect(whereToMeet(p, 'frostjelly')).toBe('Meet it in Cloudwhale Bay.');
    // a Champion and a ladder Glimmer use the ladder's own words
    expect(whereToMeet(p, 'skywhale')).toMatch(/Champion of Cloudwhale Bay/);
    expect(whereToMeet(p, 'gemmagpie' as GlimmerId)).toMatch(/met 25 Glimmers/);
  });
  it('Glimmers living on the island do not visit it', () => {
    const p = player();
    const frost = GLIMMERS.filter(g => g.element === 'frost').map(g => g.id);
    own(p, ...frost);
    setOut(p, frost.slice(0, 8));
    buyAndPlace(p, 'icepool', 2, 1, 0, T0);
    for (let i = 0; i < 20; i++) { const v = checkVisitor(structuredClone(p), T0, mulberry32(i + 7)); if (v) expect(outOf(p)).not.toContain(v.id); }
  });
  it('comes now and then: not too soon after the last, and a few a day at most', () => {
    const p = player();
    buyAndPlace(p, 'sundais', 2, 1, 0, T0);
    expect(checkVisitor(p, T0)).not.toBeNull();
    expect(checkVisitor(p, T0 + H)).toBeNull();
    expect(visitorNow(islandOf(p), T0 + 10 * 60_000)).not.toBeNull(); // still here a little later
    expect(visitorNow(islandOf(p), T0 + H)).toBeNull(); // gone home again
    expect(checkVisitor(p, T0 + VISIT_GAP)).not.toBeNull();
    expect(checkVisitor(p, T0 + 2 * VISIT_GAP)).not.toBeNull();
    // that's three today (9:00, 12:00, 15:00)
    expect(checkVisitor(p, T0 + 3 * VISIT_GAP)).toBeNull();
    expect(islandOf(p).visits.filter(v => dayKey(v.at) === dayKey(T0)).length).toBe(VISITS_A_DAY);
    // tomorrow, again
    expect(checkVisitor(p, T0 + 24 * H)).not.toBeNull();
  });
});

describe('gifts stay small', () => {
  it('a postcard the first time, then a crystal or a few shells, never past the day\'s limit', () => {
    const p = player('Mia', 1000);
    buyAndPlace(p, 'sundais', 2, 1, 0, T0);
    const after = advView(p).shells;
    let shellGifts = 0;
    // day after day, many visitors (the clock jumps on so every visit is due)
    for (let d = 0; d < 15; d++) {
      const day0 = advView(p).shells;
      for (let i = 0; i < VISITS_A_DAY + 2; i++) {
        const v = checkVisitor(p, T0 + d * 24 * H + i * VISIT_GAP, mulberry32(d * 31 + i));
        if (!v) continue;
        if (v.gift.kind === 'shells') { shellGifts++; expect(v.gift.n).toBeGreaterThan(0); expect(v.gift.n).toBeLessThanOrEqual(3); }
        if (v.gift.kind === 'deco') expect(ITEM[v.gift.item].gift).toBe(true);
      }
      expect(advView(p).shells - day0).toBeLessThanOrEqual(GIFT_SHELLS_DAY);
    }
    expect(shellGifts).toBeGreaterThan(0);
    // 15 days of visitors give at most 75 shells: less than a habitat costs
    expect(advView(p).shells - after).toBeLessThanOrEqual(15 * GIFT_SHELLS_DAY);
    // each Glimmer's postcard comes once
    const s = islandOf(p);
    expect(new Set(s.postcards).size).toBe(s.postcards.length);
    expect(s.visits.filter(v => v.gift.kind === 'postcard').length).toBe(s.postcards.length);
  });
});

describe('family visits', () => {
  it('lists everyone else on the computer but class players', () => {
    const mia = player('Mia'), leo = player('Leo'), kid = player('Class kid');
    expect(familyOf([mia, leo, kid], mia.id, p => p.id === kid.id).map(p => p.name)).toEqual(['Leo']);
  });
  it('looking round changes nothing; a heart is the only thing left, once a day', () => {
    const mia = player('Mia'), leo = player('Leo');
    buyAndPlace(leo, 'pond', 2, 1, 0, T0);
    const before = structuredClone(leo);
    const view = islandView(leo);
    view.placed = {}; // a look is a copy
    expect(leo).toEqual(before);
    // someone who never opened their island shows the starter kit, but nothing is written
    const kid = player('Kai');
    expect(Object.keys(islandView(kid).placed).length).toBe(8);
    expect(kid.island).toBeUndefined();
    expect(leaveHeart(leo, mia, T0)).toBe(true);
    expect(leaveHeart(leo, mia, T0 + H)).toBe(false);
    expect(leaveHeart(leo, leo, T0)).toBe(false);
    expect(leo.island!.placed).toEqual(before.island!.placed);
    expect(leo.island!.owned).toEqual(before.island!.owned);
    expect(advView(leo).shells).toBe(advView(before).shells);
    expect(heartNews(islandOf(leo))!.text).toBe('Mia visited and left a heart');
    seeHearts(leo);
    expect(heartNews(islandOf(leo))).toBeNull();
    expect(leaveHeart(leo, mia, T0 + 24 * H)).toBe(true);
    leaveHeart(leo, kid, T0 + 25 * H);
    expect(heartNews(islandOf(leo))!.text).toBe('Kai and Mia visited and left hearts');
  });
});
