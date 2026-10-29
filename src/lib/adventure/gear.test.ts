import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { answerOf } from '../math/facts';
import { newBattle, play, block, finale, FINALE_AT, type Pool, type Foe, type Battle } from './battle';
import { advOf, advView, applyBattle, NODE } from './state';
import { ITEMS, ITEM, SETS, buyGear, championPrize, gearView, kitOf, setsOn, wearGear, wornOf, startPerks } from './gear';

const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 3 }, { f: { a: 5, b: 5, op: '+' }, stage: 2 }, { f: { a: 6, b: 2, op: '+' }, stage: 1 }, { f: { a: 2, b: 2, op: '+' }, stage: 2 }], open: false };
const foe = (grump = 60): Foe => ({ glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump, max: grump, hit: 4 });
const setup = (kit: string[], g = 60) => newBattle({ pool, seed: 5, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(g), kit: kit as never });
/** answer the first card right, quickly or slowly */
function rightAnswer(b: Battle, fast = true) {
  const c = b.cards.find(x => x.fact)!;
  return play(b, c.id, { ok: true, value: answerOf(c.fact!), thinkMs: fast ? 900 : 9000 });
}
const settle = (b: Battle) => { if (b.phase === 'block') block(b, true, 500); };

describe('gear', () => {
  it('has three pieces for each slot, every rarity, and three sets of one piece per slot', () => {
    for (const s of ['hand', 'back', 'shoes']) expect(ITEMS.filter(i => i.slot === s)).toHaveLength(3);
    expect(new Set(ITEMS.map(i => i.rarity)).size).toBe(6);
    for (const s of Object.keys(SETS)) expect(new Set(ITEMS.filter(i => i.set === s).map(i => i.slot)).size).toBe(3);
    // the rarest only come from Champions, one per island
    expect(ITEMS.filter(i => i.price === null).map(i => i.champion).sort()).toEqual(['bay', 'meadow', 'treetops']);
  });
  it('is bought per buddy with shells and put straight on; old saves have none', () => {
    const p = newProfile('Ava', 'dino');
    expect(advView(p).gear).toEqual({});
    const a = advOf(p);
    expect(buyGear(a, 'dino', 'bubble_wand').ok).toBe(false);
    a.shells = 500;
    expect(buyGear(a, 'dino', 'bubble_wand')).toEqual({ ok: true });
    expect(a.shells).toBe(500 - ITEM.bubble_wand.price!);
    expect(gearView(a, 'dino').on.hand).toBe('bubble_wand');
    expect(gearView(a, 'cheetah').owned).toEqual([]);
    expect(buyGear(a, 'dino', 'bubble_wand').ok).toBe(false);
    expect(buyGear(a, 'dino', 'boombox').ok).toBe(false);
    expect(wearGear(a, 'dino', 'hand', null)).toBe(true);
    expect(wornOf(a, 'dino')).toEqual({});
    expect(wearGear(a, 'dino', 'back', 'bubble_wand')).toBe(false);
  });
  it('a full set adds its bonus to the battle kit', () => {
    const a = advOf(newProfile('Ava', 'dino'));
    a.shells = 2000;
    for (const id of ['bubble_wand', 'hero_cape', 'spring_shoes']) buyGear(a, 'dino', id);
    expect(setsOn(gearView(a, 'dino'))).toEqual(['playground']);
    expect(kitOf(a, 'dino')).toEqual(['bubble', 'cape', 'spring', 'playset']);
    wearGear(a, 'dino', 'shoes', null);
    expect(kitOf(a, 'dino')).toEqual(['bubble', 'cape']);
  });
  it('Champions give their piece to the buddy who beat them, once', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    expect(championPrize(a, 'dino', 'meadow')?.id).toBe('boombox');
    expect(championPrize(a, 'dino', 'meadow')).toBeNull();
    expect(gearView(a, 'dino').on.hand).toBe('boombox');
    const out = applyBattle(p, { node: 'treetops-5', subject: 'math', won: true, perfect: false, foe: { ...foe(), glimmer: 'bloomdrake', rarity: 'legendary', champion: true }, ms: 60000, answers: 9, right: 9, answered: [], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 3 });
    expect(out.gear?.id).toBe('rocket_pack');
    void NODE;
  });
});

describe('gear powers in battle', () => {
  it('Spring Shoes add energy, Fairy Wings start the Finale, the Sky set floats past the first mischief', () => {
    const b = setup(['spring', 'wings', 'skyset']);
    expect(b.sparkMax).toBe(24); expect(b.spark).toBe(24);
    expect(b.finale).toBe(2);
    expect(b.free.map(f => f.by)).toContain('Sky set');
    expect(startPerks(['spring', 'wings', 'skyset']).map(s => s.what)).toEqual(['Spring Shoes', 'Fairy Wings', 'Sky set']);
  });
  it('the Bubble Wand blows a shield on every 4th right answer', () => {
    const b = setup(['bubble'], 999);
    let shields = 0;
    for (let i = 0; i < 8; i++) { const ev = rightAnswer(b); shields += ev.filter(e => e.k === 'gear' && e.item === 'bubble_wand').length; settle(b); }
    expect(shields).toBe(2);
  });
  it('the Sky Kite adds 3 on every 3rd in a row; the Rocket Pack 2 on fast answers only', () => {
    const k = setup(['kite'], 999);
    const extras: number[] = [];
    for (let i = 0; i < 3; i++) { extras.push(...rightAnswer(k).filter(e => e.k === 'extra' && e.what === 'Sky Kite').map(e => (e as { value: number }).value)); settle(k); }
    expect(extras).toEqual([3]);
    const r = setup(['rocketpack'], 999);
    expect(rightAnswer(r, true).some(e => e.k === 'extra' && e.what === 'Rocket Pack' && e.value === 2)).toBe(true);
    settle(r);
    expect(rightAnswer(r, false).some(e => e.k === 'extra' && e.what === 'Rocket Pack')).toBe(false);
  });
  it('Rocket Sneakers fill an extra Finale star on a fast answer', () => {
    const b = setup(['zoom'], 999);
    rightAnswer(b, true);
    expect(b.finale).toBe(2);
  });
  it('the Hero Cape halves a hit that lands; Cloud Slippers heal on a block in time', () => {
    const b = setup(['cape'], 999);
    b.spark = 10;
    const c = b.cards.find(x => x.fact)!;
    play(b, c.id, { ok: false, value: 0, thinkMs: 1000 });
    const ev = block(b, false, 1000);
    expect(ev[0]).toMatchObject({ k: 'mischief', damage: 2 });
    expect(ev.some(e => e.k === 'gear' && e.item === 'hero_cape')).toBe(true);
    const s = setup(['cloudstep'], 999);
    s.spark = 10;
    play(s, s.cards.find(x => x.fact)!.id, { ok: false, value: 0, thinkMs: 1000 });
    expect(block(s, true, 500).some(e => e.k === 'heal' && e.what === 'Cloud Slippers')).toBe(true);
    expect(s.spark).toBe(12);
  });
  it('the Boombox makes the Finale twice as strong', () => {
    const plain = setup([], 999), loud = setup(['boombox'], 999);
    plain.finale = FINALE_AT; loud.finale = FINALE_AT;
    const a = finale(plain).find(e => e.k === 'finale') as { value: number };
    const b2 = finale(loud).find(e => e.k === 'finale') as { value: number };
    expect(b2.value).toBe(a.value * 2);
  });
});
