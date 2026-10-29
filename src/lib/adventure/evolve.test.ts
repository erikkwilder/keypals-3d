import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { answerOf } from '../math/facts';
import { newBattle, play, block, useGlow, glowLeft, type Pool, type Foe, type Member } from './battle';
import { advOf, applyBattle, foeFor, mathPool, NODE, teamOf } from './state';
import { canEvolve, evolve, glimmerArt, levelsToEvolve, readyToEvolve } from './evolve';
import { EVOLVED, GLIMMERS, glimmerName } from './glimmers';

const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 2 }, { f: { a: 5, b: 5, op: '+' }, stage: 2 }, { f: { a: 6, b: 2, op: '+' }, stage: 2 }, { f: { a: 2, b: 2, op: '+' }, stage: 2 }], open: false };
const foe = (grump = 80, element: Foe['element'] = 'leaf'): Foe => ({ glimmer: 'sproutbun', rarity: 'common', champion: false, element, grump, max: grump, hit: 3 });
const right = (c: { fact?: { a: number; b: number; op?: '+' | 'x' | '-' | '/' } }) => ({ ok: true, value: answerOf(c.fact!), thinkMs: 1500 });
const battle = (team: Member[], f = foe()) => newBattle({ pool, seed: 7, sparkMax: 30, role: 'steady', gear: null, team, foe: f });

describe('evolutions', () => {
  it('every Glimmer has a grown-up name and a perk', () => {
    for (const g of GLIMMERS) { expect(EVOLVED[g.id].name.length).toBeGreaterThan(3); expect(EVOLVED[g.id].perk).toMatch(/\.$/); }
    expect(glimmerName('puddlepup', true)).toBe('Tidal Pup');
    expect(glimmerArt('puddlepup', true)).toBe('game/glimmers/puddlepup-evo.webp');
  });
  it('can evolve at level 5, once, by choice', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    a.glimmers.puddlepup = { level: 4, xp: 0, got: 1 };
    expect(canEvolve(a, 'puddlepup')).toBe(false);
    expect(levelsToEvolve(a, 'puddlepup')).toBe(1);
    expect(evolve(p, 'puddlepup')).toBe(false);
    a.glimmers.puddlepup.level = 5;
    expect(readyToEvolve(a)).toEqual(['puddlepup']);
    expect(evolve(p, 'puddlepup')).toBe(true);
    expect(a.glimmers.puddlepup.evolved).toBe(true);
    expect(evolve(p, 'puddlepup')).toBe(false);
    a.team = ['puddlepup', null];
    expect(teamOf(a)).toEqual([{ id: 'puddlepup', level: 5, evolved: true }]);
  });
  it('old saves (no evolved field) still read as not evolved', () => {
    const p = newProfile('Old', 'dino');
    const a = advOf(p);
    a.glimmers.fernfox = { level: 9, xp: 3, got: 1 };
    a.team = ['fernfox', null];
    expect(teamOf(a)[0].evolved).toBe(false);
    expect(canEvolve(a, 'fernfox')).toBe(true);
  });
});

describe('the evolved Champion', () => {
  it("the third island's Champion comes grown up and joins you grown up; the first two do not", () => {
    const p = newProfile('Ava', 'dino');
    const pl = mathPool(p);
    expect(foeFor(p, NODE['meadow-5'], pl, 5).evolved).toBeFalsy();
    const f = foeFor(p, NODE['bay-5'], pl, 5);
    expect(f).toMatchObject({ glimmer: 'skywhale', evolved: true });
    applyBattle(p, { node: 'bay-5', subject: 'math', won: true, perfect: false, foe: f, ms: 120000, answers: 10, right: 9, answered: [], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 1 });
    expect(advOf(p).glimmers.skywhale?.evolved).toBe(true);
  });
});

describe('evolved powers in battle', () => {
  it('works as if four levels higher (Ember Newt: 4 cheer at level 1, 5 evolved)', () => {
    for (const [evolved, want] of [[false, 4], [true, 5]] as const) {
      const b = battle([{ id: 'embernewt', level: 1, evolved }]);
      const c = b.cards.find(x => x.fact && x.element !== 'sun')!;
      const ev = play(b, c.id, right(c));
      expect(ev.find(e => e.k === 'extra' && e.what === 'Ember puff')).toMatchObject({ value: want });
    }
  });
  it('Tidal Pup splashes 2 more on water cards', () => {
    const b = battle([{ id: 'puddlepup', level: 1, evolved: true }]);
    const c = b.cards.find(x => x.fact)!; c.element = 'tide';
    const ev = play(b, c.id, right(c));
    expect(ev.some(e => e.k === 'extra' && e.what === 'Tidal splash' && e.value === 2)).toBe(true);
  });
  it('Boulder Tortoise blocks the first two, Pebble Tortoise one', () => {
    expect(battle([{ id: 'pebbletort', level: 1 }]).free.length).toBe(1);
    expect(battle([{ id: 'pebbletort', level: 1, evolved: true }]).free.length).toBe(2);
  });
  it('Great Aurora Stag starts you with two Finale stars', () => {
    expect(battle([{ id: 'aurorastag', level: 1, evolved: true }]).finale).toBe(2);
    expect(battle([{ id: 'aurorastag', level: 1 }]).finale).toBe(0);
  });
  it('Forest Fox keeps your row twice; Sunbeam Moth gives Hint twice', () => {
    const b = battle([{ id: 'fernfox', level: 1, evolved: true }, { id: 'sparkmoth', level: 1, evolved: true }]);
    let kept = 0;
    for (let i = 0; i < 3; i++) {
      b.streak = 2; b.phase = 'pick';
      const c = b.cards.find(x => x.fact)!;
      if (play(b, c.id, { ok: false, value: 99, thinkMs: 2000 }).some(e => e.k === 'streakKept')) kept++;
      if ((b.phase as string) === 'block') block(b, true, 500);
    }
    expect(kept).toBe(2);
    expect(useGlow(b)).toBe(true); expect(glowLeft(b)).toBe(true);
    expect(useGlow(b)).toBe(true); expect(glowLeft(b)).toBe(false);
    expect(useGlow(b)).toBe(false);
  });
  it('Blizzard Seal: every block in time adds 2 cheer', () => {
    const b = battle([{ id: 'snowseal', level: 1, evolved: true }]);
    const c = b.cards.find(x => x.fact)!;
    play(b, c.id, { ok: false, value: 99, thinkMs: 2000 });
    const before = b.foe.grump;
    const ev = block(b, true, 800);
    expect(ev.some(e => e.k === 'extra' && e.what === 'Snow flurry')).toBe(true);
    expect(b.foe.grump).toBe(before - 2);
  });
});
