import { describe, expect, it } from 'vitest';
import { newProfile, dayKey } from '../engine/profile';
import { answerOf } from '../math/facts';
import { newBattle, play, block, finale, deal, openFact, sparkFor, FINALE_AT, type Pool, type Foe } from './battle';
import { advOf, applyBattle, buy, currentNode, foeFor, hatch, mathPool, NODE, NODES, nodeOpen, notePractice, playLeft, reachStop, typingPool, collectStop, practiceDone } from './state';
import { GLIMMERS, GLIMMER } from './glimmers';

const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 3 }, { f: { a: 5, b: 5, op: '+' }, stage: 2 }, { f: { a: 6, b: 2, op: '+' }, stage: 1 }, { f: { a: 2, b: 2, op: '+' }, stage: 2 }], open: false };
const foe = (grump = 30): Foe => ({ glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump, max: grump, hit: 3 });
const right = (f: { a: number; b: number; op?: '+' | 'x' | '-' | '/' }) => ({ ok: true, value: answerOf(f), thinkMs: 1500 });

describe('the Cheer Duel', () => {
  it('cheers by the number you make, and an exact landing is a Perfect Cheer', () => {
    const b = newBattle({ pool, seed: 1, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(7) });
    const card = b.cards.find(c => c.fact && answerOf(c.fact) === 7) ?? (b.cards[0].fact = { a: 3, b: 4, op: '+' }, b.cards[0]);
    const ev = play(b, card.id, right(card.fact!));
    expect(ev.some(e => e.k === 'won' && e.perfect)).toBe(true);
    expect(b.phase).toBe('won');
  });
  it('a miss cheers nothing and breaks the streak; the Grumble then makes mischief to block', () => {
    const b = newBattle({ pool, seed: 2, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(40) });
    b.streak = 2;
    const c = b.cards.find(x => x.fact)!;
    play(b, c.id, { ok: false, value: 99, thinkMs: 2000 });
    expect(b.foe.grump).toBe(40);
    expect(b.streak).toBe(0);
    expect(b.phase).toBe('block');
    const ev = block(b, true, 1000);
    expect(ev[0]).toMatchObject({ k: 'mischief', result: 'full', damage: 0 });
    expect(b.phase).toBe('pick');
  });
  it('a slow block holds off half, a missed block none; Spark at zero loses', () => {
    const b = newBattle({ pool, seed: 3, sparkMax: 4, role: 'heart', gear: null, team: [], foe: { ...foe(99), hit: 4 } });
    play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 });
    block(b, true, 9000);
    expect(b.spark).toBe(2);
    play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 });
    const ev = block(b, false, 1000);
    expect(ev.some(e => e.k === 'lost')).toBe(true);
  });
  it('Glimmer extras come after your number and never spoil an exact plan', () => {
    const b = newBattle({ pool, seed: 4, sparkMax: 20, role: 'steady', gear: null, team: [{ id: 'embernewt', level: 1 }], foe: foe(20) });
    const c = b.cards.find(x => x.fact)!;
    const ev = play(b, c.id, right(c.fact!));
    const cast = ev.find(e => e.k === 'cast')!;
    const ember = ev.find(e => e.k === 'extra');
    expect(cast).toMatchObject({ value: answerOf(c.fact!) });
    expect(ember).toMatchObject({ what: 'Ember puff', value: 4 });
    expect(b.foe.grump).toBe(20 - answerOf(c.fact!) - 4);
  });
  it('Pebble Shell and Hover take the first mischiefs; five right fills the Finale', () => {
    const b = newBattle({ pool, seed: 5, sparkMax: 20, role: 'steady', gear: 'hover', team: [{ id: 'pebbletort', level: 1 }], foe: foe(500) });
    for (let i = 0; i < 2; i++) { const c = b.cards.find(x => x.fact)!; const ev = play(b, c.id, right(c.fact!)); expect(ev.find(e => e.k === 'mischief')).toMatchObject({ result: 'skip' }); }
    for (let i = 0; i < 3; i++) { const c = b.cards.find(x => x.fact)!; play(b, c.id, right(c.fact!)); if (b.phase === 'block') block(b, true, 100); }
    expect(b.finale).toBe(FINALE_AT);
    const ev = finale(b);
    expect(ev[0]).toMatchObject({ k: 'finale', value: 150 });
  });
  it('open cards make the fact you choose', () => {
    expect(openFact({ a: 6, op: 'x', max: 10 }, 4)).toEqual({ a: 6, b: 4 });
    const p = newProfile('Ava', 'dino');
    const m = (p.math = { home: 'math', facts: {} as Record<string, import('../math/facts').FactStat>, lessons: {}, history: [], totals: { trips: 0, facts: 0, ms: 0 } });
    for (let a = 2; a <= 9; a++) m.facts[`${a}x3`] = { stage: 2, seen: 3, right: 3, wrong: 0, times: [], fastDays: [], last: 0, due: 0, step: 0 };
    const pl = mathPool(p);
    expect(pl.subject === 'math' && pl.open).toBe(true);
    const b = newBattle({ pool: pl, seed: 9, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(80) });
    for (let i = 0; i < 20 && !b.cards.some(c => c.open); i++) deal(b);
    expect(b.cards.some(c => c.open)).toBe(true);
  });
  it('a new player gets easy plus facts; a typist gets words from the keys learned', () => {
    const p = newProfile('Ava', 'dino');
    const m = mathPool(p);
    expect(m.subject === 'math' && m.facts.length).toBeGreaterThan(4);
    const t = typingPool(p);
    expect(t.subject === 'typing' && t.words.length).toBeGreaterThan(8);
    expect(sparkFor(1, 'heart')).toBe(19);
  });
});

describe('Adventure', () => {
  it('the map runs battle, battle, practice stop, ..., Champion; practice stops finish after a practice session', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    expect(currentNode(a)!.id).toBe('meadow-0');
    a.nodes['meadow-0'] = 1; a.nodes['meadow-1'] = 1;
    expect(currentNode(a)!.kind).toBe('practice');
    expect(nodeOpen(a, NODE['meadow-3'])).toBe(false);
    reachStop(a, 'meadow-2');
    notePractice(p, 10);
    expect(practiceDone(a, 'meadow-2')).toBe(true);
    expect(collectStop(p, 'meadow-2')!.shells).toBe(20);
    expect(nodeOpen(a, NODE['meadow-3'])).toBe(true);
    a.settings.rule = 'open';
    expect(nodeOpen(a, NODE['meadow-4'])).toBe(false);
    expect(NODES.filter(n => n.kind === 'champion').map(n => GLIMMER[n.island === 'meadow' ? 'lanternfox' : n.island === 'treetops' ? 'bloomdrake' : 'skywhale'].rarity)).toEqual(['legendary', 'legendary', 'legendary']);
  });
  it('winning cheers the Glimmer onto your team, pays shells, and may drop an egg', () => {
    const p = newProfile('Ava', 'dino');
    const pl = mathPool(p);
    const f = foeFor(p, NODE['meadow-5'], pl, 5);
    expect(f.glimmer).toBe('lanternfox');
    const out = applyBattle(p, { node: 'meadow-5', subject: 'math', won: true, perfect: false, foe: f, ms: 120000, answers: 10, right: 9, answered: [{ f: { a: 3, b: 4, op: '+' }, ok: true, thinkMs: 1200 }], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 1 });
    expect(out.met).toMatchObject({ id: 'lanternfox', isNew: true });
    expect(out.islandDone).toBe('meadow');
    expect(out.egg).not.toBeNull();
    expect(out.shells).toBeGreaterThanOrEqual(62);
    expect(advOf(p).team[0]).toBe('lanternfox');
    expect(p.math!.facts['3+4'].seen).toBe(1);
    expect(p.pals.dino!.xp).toBe(165);
  });
  it('eggs warm with practice and hatch; a second one of a kind becomes stardust', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    a.incubator[0] = { id: 'e1', rarity: 'common', need: 20, have: 0, got: 0 };
    a.nest.push({ id: 'e2', rarity: 'common', need: 20, have: 0, got: 0 });
    expect(notePractice(p, 12)).toEqual([]);
    expect(notePractice(p, 12)).toEqual(['common']);
    const h = hatch(p, 0, 3)!;
    expect(h.isNew).toBe(true);
    expect(a.incubator[0]!.id).toBe('e2');
    for (const g of GLIMMERS.filter(g => g.rarity === 'common')) a.glimmers[g.id] = { level: 1, xp: 0, got: 0 };
    a.incubator[0]!.have = 20;
    const h2 = hatch(p, 0, 4)!;
    expect(h2.isNew).toBe(false);
    expect(a.glimmers[h2.id]!.xp + a.glimmers[h2.id]!.level).toBeGreaterThan(1);
  });
  it('the shop sells eggs for shells', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    expect(buy(p, 'egg-common').ok).toBe(false);
    a.shells = 100;
    expect(buy(p, 'egg-common')).toMatchObject({ ok: true, where: 'incubator' });
    expect(a.shells).toBe(40);
  });
  it('Balanced: 10 free minutes, then practice earns play time; Practice first waits for the goal', () => {
    const p = newProfile('Ava', 'dino');
    const now = Date.now(), a = advOf(p);
    expect(playLeft(p, now)).toMatchObject({ open: true, left: 10 });
    a.day = { key: dayKey(now), ms: 10 * 60000, answers: 0, right: 0 };
    expect(playLeft(p, now).open).toBe(false);
    p.days[dayKey(now)] = { ms: 6 * 60000, runs: 2 };
    expect(playLeft(p, now)).toMatchObject({ open: true, left: 6 });
    a.settings.rule = 'practiceFirst';
    expect(playLeft(p, now).open).toBe(false);
    p.days[dayKey(now)].goal = true;
    expect(playLeft(p, now).open).toBe(true);
    a.settings.rule = 'open'; a.settings.capMin = 5;
    expect(playLeft(p, now).open).toBe(false);
  });
});
