import { describe, expect, it } from 'vitest';
import { answerOf } from '../math/facts';
import { newBattle, play, type Pool, type Foe, type Member } from './battle';
import { newDuel, duelPlay, cur, guestPool } from './duel';
import { EVOLVED, GLIMMER, GLIMMERS, glimmersOf, RARITIES, type GlimmerId } from './glimmers';
import { advOf, applyBattle, foeFor, mathPool, NODE } from './state';
import { newProfile } from '../engine/profile';

const facts: { f: { a: number; b: number }; stage: number }[] = [];
for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) facts.push({ f: { a, b }, stage: 2 });
const pool: Pool = { subject: 'math', facts, open: false };
const foe = (): Foe => ({ glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'stone', grump: 900, max: 900, hit: 0 });
const battle = (team: Member[]) => { const b = newBattle({ pool, seed: 3, sparkMax: 30, role: 'heart', gear: null, team, foe: foe() }); b.frozen = true; return b; };
/** answer a card right */
function right(b: ReturnType<typeof battle>) {
  const c = b.cards.find(x => x.fact) ?? b.cards[0];
  b.frozen = true;
  const ev = play(b, c.id, { ok: true, value: answerOf(c.fact!), thinkMs: 2000, fact: c.fact });
  b.phase = 'pick'; b.block = null;
  return { c, ev };
}

describe('thirty Glimmers', () => {
  it('has 30, each with an evolved form, a power that says what it does, and a home (or is a Champion or Mythic)', () => {
    expect(GLIMMERS).toHaveLength(30);
    for (const g of GLIMMERS) {
      expect(EVOLVED[g.id], g.id).toBeTruthy();
      expect(g.power.text(1).length, g.id).toBeGreaterThan(10);
      expect(!!(g.home || g.champion || g.rarity === 'mythic'), g.id).toBe(true);
    }
    for (const r of RARITIES) expect(glimmersOf(r).length, r).toBeGreaterThan(0);
  });
  it('Sunny Snail: Sun cards cheer 2 more; grown up, they fill an extra Finale star too', () => {
    const b = battle([{ id: 'sunsnail', level: 1 }]);
    let got: number | null = null;
    for (let i = 0; i < 20 && got === null; i++) {
      const { c, ev } = right(b);
      if (c.element === 'sun') got = ev.filter(e => e.k === 'extra' && e.what === 'Warm Shell').reduce((t, e) => t + (e.k === 'extra' ? e.value : 0), 0);
      else expect(ev.some(e => e.k === 'extra' && e.what === 'Warm Shell')).toBe(false);
    }
    expect(got).toBe(2);
    const e = battle([{ id: 'sunsnail', level: 1, evolved: true }]);
    let star = 0;
    for (let i = 0; i < 20 && !star; i++) { const before = e.finale; const { c } = right(e); if (c.element === 'sun' && before === 0) star = e.finale - before; else e.finale = 0; }
    expect(star).toBeGreaterThanOrEqual(2);
  });
  it('Popcorn Puffling: only the first right answer pops', () => {
    const b = battle([{ id: 'popcornpuff', level: 1 }]);
    const first = right(b).ev.find(e => e.k === 'extra' && e.what === 'First Pop');
    const second = right(b).ev.find(e => e.k === 'extra' && e.what === 'First Pop');
    expect(first).toMatchObject({ value: 6 });
    expect(second).toBeUndefined();
  });
  it('Bubble Octopus: every 5th right answer blows a shield', () => {
    const b = battle([{ id: 'bubbleocto', level: 1 }]);
    const shields: number[] = [];
    for (let i = 1; i <= 10; i++) if (right(b).ev.some(e => e.k === 'bubble')) shields.push(i);
    expect(shields).toEqual([5, 10]);
  });
  it('Pinecone Pangolin blocks the first two rains; Pebble Tortoise one', () => {
    expect(battle([{ id: 'pinepango', level: 1 }]).free).toHaveLength(2);
    expect(battle([{ id: 'pebbletort', level: 1 }]).free).toHaveLength(1);
  });
  it('Geode Mole digs up shells when you win', () => {
    const run = (team: GlimmerId[]) => {
      const p = newProfile('Ava', 'dino');
      advOf(p).glimmers.geodemole = { level: 1, xp: 0, got: 1 };
      return applyBattle(p, { node: 'meadow-1', subject: 'math', won: true, perfect: false, foe: foeFor(p, NODE['meadow-1'], mathPool(p), 3), ms: 60000, answers: 6, right: 6, answered: [], team, crystal: false, treasureNose: false, at: Date.now(), seed: 3 }).shells;
    };
    expect(run(['geodemole']) - run([])).toBe(4);
  });
  it('new powers work in a duel too (+10 a right answer, extras on top)', () => {
    const side = (name: string, team: Member[]) => ({ name, buddy: 'dino' as const, kind: 'guest' as const, subject: 'math' as const, pool: guestPool('plus', 'math', []), role: 'heart' as const, gear: null, team, outfit: 'none', dance: 'x' });
    const d = newDuel(side('A', [{ id: 'popcornpuff', level: 1 }]), side('B', []), 'puddlepup', 5);
    const c = cur(d).b.cards[0];
    duelPlay(d, c.id, { ok: true, value: answerOf(c.fact!), thinkMs: 2000, fact: c.fact });
    expect(d.sides[0].b.foe.grump).toBe(100 - 10 - 6);
    expect(GLIMMER.popcornpuff.element).toBe('sun');
  });
});
