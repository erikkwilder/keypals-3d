import { describe, expect, it, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import { newProfile, dayKey } from '../engine/profile';
import { mathOf } from '../math/progress';
import { ALL_GLIMMERS, EVOLVED, GLIMMER, GLIMMERS, GLIMMER_TOTAL, glimmersOf, ownChampion, RARITIES, type GlimmerId } from './glimmers';
import { LADDER_GLIMMERS } from './glimmers2';
import { advOf, foeFor, hatch, NODE, notePractice, type Egg } from './state';
import { COMING_WORLDS, ladderIds, bookOf, checkLadder, ctxOf, goalOf, isLadderEgg, ladderNeedsWrite, ladderPlan, placeSpecial, standing, worldSlots } from './ladder';
import { ladderOf, ladderView, noteSecret, seedLadder, windowsOf, nextOpening } from './ladderSave';
import type { Pool } from './battle';

const DAY = 86_400_000;
const at = (d: string) => new Date(`${d}T15:00:00`).getTime();
/** a player who joined on a day (and played nothing yet) */
function player(joined = '2026-09-07') { const p = newProfile('Kid', 'dino'); p.createdAt = at(joined); advOf(p); return p; }
/** play a day: practice minutes and right answers, the way settle.ts notes them */
function playDay(p: ReturnType<typeof player>, d: string, min = 45, right = 200) {
  p.days[d] = { ms: min * 60000, runs: 3 };
  notePractice(p, right, true, at(d));
}
/** every ladder Glimmer's model in for a test (they're all on their way today); put back after */
const wasPending = new Map(ALL_GLIMMERS.map(g => [g.id, g.pending]));
function ship(...ids: GlimmerId[]) { for (const g of ALL_GLIMMERS) if (!ids.length || ids.includes(g.id)) g.pending = false; }
afterEach(() => { for (const g of ALL_GLIMMERS) g.pending = wasPending.get(g.id); });

describe('the hundred', () => {
  it('every Glimmer has a source, and with the coming worlds\' places they add up to 100', () => {
    expect(GLIMMERS).toHaveLength(30);
    for (const g of GLIMMERS) expect(g.source ?? 'roll').toBe('roll');
    for (const g of LADDER_GLIMMERS) expect(['native', 'milestone', 'collection', 'season', 'secret', 'apex']).toContain(g.source);
    const count = (s: string) => ALL_GLIMMERS.filter(g => (g.source ?? 'roll') === s).length;
    const slots = COMING_WORLDS.reduce((t, w) => t + worldSlots(w.area), 0);
    expect(count('roll')).toBe(30);
    expect(count('native') + slots).toBe(35);
    // the first three worlds' 11 are here (glimmers2.ts); each newer world brings its own 4 (clockwork.ts...)
    expect(LADDER_GLIMMERS.filter(g => g.source === 'native')).toHaveLength(11);
    expect(count('milestone')).toBe(16);
    expect(count('collection')).toBe(5);
    expect(count('season')).toBe(6);
    expect(count('secret')).toBe(4);
    expect(count('apex')).toBe(4);
    expect(ALL_GLIMMERS.length + slots).toBe(GLIMMER_TOTAL);
    expect(new Set(ALL_GLIMMERS.map(g => g.id)).size).toBe(ALL_GLIMMERS.length);
    // the Book shows all 100 places
    const b = bookOf(player());
    expect(b.groups.flatMap(g => g.parts.flatMap(pt => pt.places))).toHaveLength(100);
    expect(b.groups.map(g => g.name)).toEqual(['Everywhere', 'Worlds', 'Milestones', 'Collections', 'Seasons', 'Secrets', 'Legends']);
  });
  it('the 46 new ones: a goal, a grown-up form, a painting and a face; the long goals legendary or mythic', () => {
    expect(LADDER_GLIMMERS).toHaveLength(46);
    for (const g of LADDER_GLIMMERS) {
      expect(goalOf(g.id), g.id).not.toBeNull();
      expect(EVOLVED[g.id].name.length).toBeGreaterThan(3);
      expect(EVOLVED[g.id].perk).toMatch(/\.$/);
      expect(g.power.text(1)).toMatch(/\.$/);
      expect(g.quirk.length).toBeGreaterThan(10);
      expect(existsSync(`public/game/glimmers/${g.id}.webp`), g.id).toBe(true);
      expect(existsSync(`public/game/glimmers/face/${g.id}.webp`), g.id).toBe(true);
    }
    for (const id of ['galaxynarwhal', 'eldertreeturtle', 'seasonstanuki', 'rocketroadrunner', 'starsageowl', 'nestdragon', 'prismpeacock', 'crownedlion', 'moonrabbit', 'rainbowunicorn', 'dragonkoi'] as GlimmerId[])
      expect(['legendary', 'mythic']).toContain(GLIMMER[id].rarity);
    for (const id of ['crownedlion', 'moonrabbit', 'rainbowunicorn', 'dragonkoi'] as GlimmerId[]) expect(GLIMMER[id].rarity).toBe('mythic');
    // every one has an outline for the Book's unmet cards
    for (const g of ALL_GLIMMERS) expect(existsSync(`public/game/glimmers/shape/${g.id}.webp`), g.id).toBe(true);
    // and every world's natives (the newer worlds' in their own files too) a goal, a grown-up form, a painting and a face
    for (const g of ALL_GLIMMERS.filter(x => x.source === 'native')) {
      expect(goalOf(g.id), g.id).not.toBeNull();
      expect(EVOLVED[g.id]?.perk, g.id).toMatch(/\.$/);
      expect(existsSync(`public/game/glimmers/${g.id}.webp`), g.id).toBe(true);
      expect(existsSync(`public/game/glimmers/face/${g.id}.webp`), g.id).toBe(true);
    }
    // and every kind of goal its special egg
    for (const k of ['native', 'milestone', 'collection', 'season', 'secret', 'apex']) expect(existsSync(`public/game/egg-${k}.webp`), k).toBe(true);
    // Counting Caves and Market Isle get Champions of their own
    expect(LADDER_GLIMMERS.filter(g => g.champion).map(g => g.champion).sort()).toEqual(['caves', 'market']);
  });
});

describe('goals read the save', () => {
  it('an older save gets credit: right answers from its facts, skills and typing; days from its practice', () => {
    const p = player();
    const m = (p.math = mathOf(p));
    m.facts['3x4'] = { stage: 3, seen: 900, right: 800, wrong: 100, times: [], fastDays: [], last: 0, due: 0, step: 0 };
    m.skills = { 'fr-name:1': { stage: 2, seen: 300, right: 250, wrong: 50, times: [], fastDays: [], last: 0, due: 0, step: 0 } };
    p.totals.chars = 5000; // a thousand typed words
    p.days = { '2026-09-08': { ms: 12 * 60000, runs: 2 }, '2026-09-09': { ms: 5 * 60000, runs: 1 }, '2026-09-10': { ms: 30 * 60000, runs: 3 } };
    p.book = { stickers: { 'secret-word': { at: 0, by: 'dino' } }, medals: {}, total: 0, fresh: [] };
    advOf(p).finds = { 'bay-hidden': '2026-09-10' };
    const L = seedLadder(p, advOf(p));
    expect(L.right).toBe(800 + 250 + 1000);
    expect(L.days).toBe(2); // the 5-minute day doesn't count
    expect(L.seasons['autumn-2026']).toBe(2);
    expect(L.secrets.sort()).toEqual(['trail', 'word']);
    // and the Book says so
    const x = ctxOf(p, at('2026-09-11'));
    expect(standing('fireflyfawn', x)).toMatchObject({ have: 1000, need: 1000, reached: true });
    expect(standing('lighthousepuffin', x)).toMatchObject({ have: 2050, need: 5000, reached: false });
    expect(standing('sunriserobin', x).hint).toBe('Comes to players who play 30 days: 2 so far.');
    expect(standing('whisperparrot', x).reached).toBe(true);
  });
  it('a day is 10 minutes of anything (battles too), counted once; right answers add up', () => {
    const p = player(), a = advOf(p), d = '2026-10-05';
    p.days[d] = { ms: 6 * 60000, runs: 1 };
    notePractice(p, 30, true, at(d));
    expect(ladderOf(p, a).days).toBe(0);
    a.day = { key: d, ms: 5 * 60000, answers: 10, right: 8 }; // a battle today
    notePractice(p, 20, true, at(d));
    notePractice(p, 20, true, at(d));
    expect(ladderOf(p, a)).toMatchObject({ days: 1, lastDay: d, right: 70 });
    expect(ladderOf(p, a).seasons['autumn-2026']).toBe(1);
  });
  it('typing speed, meeting Glimmers, growing them up and world wins', () => {
    const p = player(), a = advOf(p), now = at('2026-10-06');
    p.lessons['village-1'] = { stars: 3, bestWpm: 21.4, bestAcc: 0.97, bestRide: 2, attempts: 1, passes: 1, lastAt: now };
    GLIMMERS.slice(0, 25).forEach((g, i) => { a.glimmers[g.id] = { level: i < 3 ? 20 : 5, xp: 0, got: now, evolved: true }; });
    a.nodes['caves-0'] = 6; a.nodes['caves-1'] = 4; a.nodes['meadow-0'] = 9;
    const x = ctxOf(p, now);
    expect(standing('keycricket', x)).toMatchObject({ have: 20, need: 20, reached: true });
    expect(standing('zipbird', x)).toMatchObject({ have: 21, need: 35, reached: false });
    expect(standing('gemmagpie', x)).toMatchObject({ have: 25, reached: true });
    expect(standing('acornsprite', x)).toMatchObject({ have: 10, need: 10, reached: true });
    expect(standing('rainbowunicorn', x)).toMatchObject({ have: 3, need: 20 });
    // the crown: every island's and world's Champion grown up (6 here now, 6 more with the coming worlds)
    expect(standing('crownedlion', x)).toMatchObject({ need: 12 });
    // Counting Caves: 10 wins there brings its first native (sky wins don't count)
    expect(standing('abacuspillar', x)).toMatchObject({ have: 10, need: 10, reached: true });
    expect(standing('cartbeetle', x)).toMatchObject({ have: 10, need: 40, reached: false });
    expect(standing('crystalmammoth', x)).toMatchObject({ have: 0, need: 1 });
    expect(standing('cartbeetle', x).hint).toBe('Lives in Counting Caves. Win 40 battles there: 10 so far.');
  });
  it('strong math comes from the adaptive ability, with enough answers behind it', () => {
    const p = player(), m = (p.math = mathOf(p)), now = at('2026-10-06');
    m.ability = { 'add-facts': { t: 3.8, n: 60, at: now }, 'sub-facts': { t: 3.6, n: 12, at: now } };
    expect(standing('balancepanda', ctxOf(p, now))).toMatchObject({ have: 1, need: 2 });
    m.ability['sub-facts'] = { t: 3.6, n: 40, at: now };
    expect(standing('balancepanda', ctxOf(p, now))).toMatchObject({ have: 2, need: 2, reached: true });
    expect(standing('starsageowl', ctxOf(p, now)).need).toBeGreaterThanOrEqual(7);
  });
  it('the seasons: windows by date, New Year across the year\'s end, and the Keypals birthday after a year', () => {
    expect(windowsOf('2026-12-27')).toEqual(['winter-2026', 'newyear-2027']);
    expect(windowsOf('2027-01-05')).toEqual(['winter-2026', 'newyear-2027']);
    expect(windowsOf('2027-02-28')).toEqual(['winter-2026']);
    expect(windowsOf('2027-04-01')).toEqual(['spring-2027']);
    const born = at('2026-09-07');
    expect(windowsOf('2026-09-07', born)).toEqual(['autumn-2026']); // not on the day you join
    expect(windowsOf('2027-09-07', born)).toEqual(['autumn-2027', 'birthday-2027']);
    expect(windowsOf('2027-09-20', born)).toEqual(['autumn-2027', 'birthday-2027']);
    expect(windowsOf('2027-09-21', born)).toEqual(['autumn-2027']);
    expect(nextOpening('winter', '2026-10-01')).toBe('2026-12-01');
    expect(nextOpening('birthday', '2026-10-01', born)).toBe('2027-09-07');
  });
});

describe('the eggs', () => {
  it('random rolls never give ladder Glimmers: battles, eggs, the Grumbles you meet', () => {
    ship();
    for (const r of RARITIES) for (const g of glimmersOf(r)) expect(g.source ?? 'roll').toBe('roll');
    const p = player(), a = advOf(p);
    const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 1 }], open: false };
    for (let s = 1; s < 400; s++) {
      // every stop but a Champion's rolls its Grumble (a world's own Champion is met at its Champion stop: below)
      for (const n of ['meadow-0', 'treetops-3', 'bay-4', 'caves-1', 'market-3', 'falls-4']) expect(ladderIds()).not.toContain(foeFor(p, NODE[n], pool, s).glimmer);
      a.incubator[0] = { id: `e${s}`, rarity: RARITIES[s % 6], need: 1, have: 1, got: 0 };
      const h = hatch(p, 0, s)!;
      expect(ladderIds()).not.toContain(h.id);
    }
  });
  it('a pending one can\'t be earned: its goal is remembered, and its egg comes once it ships', () => {
    const p = player(), a = advOf(p);
    for (let i = 0; i < 6; i++) playDay(p, `2026-09-${String(8 + i).padStart(2, '0')}`); // 1,200 right answers
    const now = at('2026-09-14');
    expect(GLIMMER.fireflyfawn.pending).toBe(true);
    expect(ladderPlan(p, now).eggs.map(e => e.id)).not.toContain('fireflyfawn');
    checkLadder(p, now);
    expect(a.ladder!.waiting).toContain('fireflyfawn');
    expect([...a.incubator, ...a.nest].some(e => e?.glimmer)).toBe(false);
    // later its model ships: the egg comes at once, ready, and hatches into exactly that Glimmer
    ship('fireflyfawn');
    expect(ladderNeedsWrite(p, now + DAY)).toBe(true);
    const news = checkLadder(p, now + DAY);
    expect(news.map(n => n.id)).toEqual(['fireflyfawn']);
    expect(news[0].egg).toMatchObject({ glimmer: 'fireflyfawn', kind: 'milestone', rarity: 'rare' });
    expect(a.ladder!.waiting).not.toContain('fireflyfawn');
    const slot = a.incubator.findIndex(e => e?.glimmer === 'fireflyfawn');
    expect(isLadderEgg(a.incubator[slot]!)).toBe(true);
    const h = hatch(p, slot, 7)!;
    expect(h).toMatchObject({ id: 'fireflyfawn', isNew: true, special: 'milestone' });
    // once only
    expect(checkLadder(p, now + 2 * DAY)).toEqual([]);
    expect(ladderNeedsWrite(p, now + 2 * DAY)).toBe(false);
  });
  it('a special egg takes the least-warmed slot when all three are busy (that egg waits, warmth kept)', () => {
    const p = player(), a = advOf(p);
    a.incubator = [{ id: 'a', rarity: 'rare', need: 45, have: 40, got: 0 }, { id: 'b', rarity: 'common', need: 20, have: 2, got: 0 }, { id: 'c', rarity: 'epic', need: 70, have: 60, got: 0 }];
    const egg: Egg = { id: 'x', rarity: 'epic', need: 70, have: 70, got: 0, glimmer: 'meteorram', kind: 'milestone' };
    placeSpecial(a, egg);
    expect(a.incubator.map(e => e!.id)).toEqual(['a', 'x', 'c']);
    expect(a.nest[0]).toMatchObject({ id: 'b', have: 2 });
  });
  it('a season egg only comes inside its window, and comes back next year', () => {
    ship('snowglobepenguin');
    const p = player('2026-09-01'), a = advOf(p);
    for (const d of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-30']) playDay(p, d);
    expect(checkLadder(p, at('2026-11-30')).map(n => n.id)).not.toContain('snowglobepenguin');
    for (const d of ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']) playDay(p, d);
    expect(checkLadder(p, at('2026-12-04')).map(n => n.id)).not.toContain('snowglobepenguin');
    playDay(p, '2026-12-07');
    expect(checkLadder(p, at('2026-12-07')).map(n => n.id)).toContain('snowglobepenguin');
    const h = hatch(p, a.incubator.findIndex(e => e?.glimmer === 'snowglobepenguin'), 1)!;
    expect(h).toMatchObject({ id: 'snowglobepenguin', isNew: true });
    expect(checkLadder(p, at('2026-12-08'))).toEqual([]);
    // next winter: again (a second one is stardust)
    for (const d of ['2027-12-01', '2027-12-02', '2027-12-03', '2027-12-06', '2027-12-07']) playDay(p, d);
    expect(checkLadder(p, at('2027-12-07')).map(n => n.id)).toContain('snowglobepenguin');
    expect(hatch(p, a.incubator.findIndex(e => e?.glimmer === 'snowglobepenguin'), 1)).toMatchObject({ id: 'snowglobepenguin', isNew: false });
  });
  it('secrets: found once, their egg comes', () => {
    ship('bookworm');
    const p = player(), a = advOf(p);
    expect(noteSecret(p, a, 'hut')).toBe(true);
    expect(noteSecret(p, a, 'hut')).toBe(false);
    expect(checkLadder(p, at('2026-10-01')).map(n => n.id)).toEqual(['bookworm']);
  });
  it('a world\'s own Champion takes over its Champion battle once its model is in', () => {
    const p = player();
    const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 1 }], open: false };
    expect(ownChampion('caves')).toBeNull();
    expect(foeFor(p, NODE['caves-5'], pool, 1).glimmer).toBe('prismhorn');
    ship('crystalmammoth');
    expect(ownChampion('caves')).toBe('crystalmammoth');
    expect(foeFor(p, NODE['caves-5'], pool, 1).glimmer).toBe('crystalmammoth');
    expect(ownChampion('meadow')).toBe('lanternfox');
  });
  it('nothing to write: no update (looking is free)', () => {
    const p = player(), now = at('2026-10-01');
    expect(ladderNeedsWrite(p, now)).toBe(true); // the counters start
    checkLadder(p, now);
    expect(ladderNeedsWrite(p, now)).toBe(false);
    expect(ladderView(p, advOf(p)).days).toBe(0);
    expect(dayKey(now)).toBe('2026-10-01');
  });
});
