import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { newStat } from '../math/facts';
import { keyStage } from '../math/skills/progress';
import { deal, newBattle, play, grumpFor, itemCheer, type Foe, type Pool } from './battle';
import { advOf, applyBattle, mathPool, SKILL_MIX } from './state';
import { newDuel, duelPlay, ghostMove, cur, DUEL_BAR, DUEL_CARD, type SideSetup } from './duel';
import { applyVersus } from './versus';

const foe = (grump = 200): Foe => ({ glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump, max: grump, hit: 3 });
const FACTS = [{ f: { a: 3, b: 4, op: '+' as const }, stage: 2 }, { f: { a: 5, b: 2, op: '+' as const }, stage: 2 }];
const fracPool = (mix: number): Pool => ({
  subject: 'math', open: false, mix,
  facts: FACTS,
  skills: ['fr-name:2', 'fr-name:4', 'fr-compare:same-d', 'fr-equal:x2', 'fr-add:small'].map(key => ({ key, stage: 1 })),
});
const setup = (pool: Pool, seed = 5) => ({ pool, seed, sparkMax: 30, role: 'heart' as const, gear: null, team: [], foe: foe() });
/** a player who has met some fractions */
function fractionsPlayer() {
  const p = newProfile('Ava', 'dino');
  const m = (p.math = mathOf(p));
  m.skills = { 'fr-name:2': { ...newStat(), seen: 3, right: 3, stage: 2 }, 'fr-name:4': { ...newStat(), seen: 1, right: 1, stage: 1 } };
  return p;
}

describe('skill cards in battles', () => {
  it('a skill pool deals skill questions (all of them with mix 1), each worth more for harder ones', () => {
    const b = newBattle(setup(fracPool(1)));
    expect(b.cards.length).toBe(3);
    for (const c of b.cards) {
      expect(c.item).toBeTruthy();
      expect(c.fact).toBeUndefined();
      expect(c.value).toBe(itemCheer(c.item!));
    }
    expect(itemCheer({ weight: 1 } as never)).toBeLessThan(itemCheer({ weight: 4 } as never));
  });
  it('a pool with no skills deals exactly as before (no skill cards, same hands)', () => {
    const plain: Pool = { subject: 'math', open: false, facts: FACTS };
    const a = newBattle(setup(plain, 9)), b = newBattle(setup({ ...plain, skills: [], mix: 0 }, 9));
    expect(a.cards.map(c => c.fact)).toEqual(b.cards.map(c => c.fact));
    expect(a.cards.every(c => !c.item)).toBe(true);
  });
  it('a mixed pool deals both kinds, about as often as its mix', () => {
    let items = 0, all = 0;
    for (let seed = 1; seed <= 60; seed++) { const b = newBattle(setup(fracPool(SKILL_MIX), seed)); all += b.cards.length; items += b.cards.filter(c => c.item).length; }
    expect(items / all).toBeGreaterThan(0.2);
    expect(items / all).toBeLessThan(0.5);
  });
  it('the engine checks the answer by its skill: right cheers the card\'s value, wrong cheers nothing and comes back', () => {
    const b = newBattle(setup(fracPool(1)));
    const c = b.cards[0], before = b.foe.grump;
    const ev = play(b, c.id, { ok: true, value: 0, thinkMs: 3000, given: c.item!.answer });
    expect(ev[0]).toMatchObject({ k: 'cast', ok: true, value: c.value });
    expect(b.foe.grump).toBe(before - c.value!);
    expect(b.skillAnswers).toEqual([{ key: c.item!.key, ok: true, thinkMs: 3000, rung: c.item!.rung }]);
    // block whatever came, then miss one on purpose
    if (b.phase === 'block') { b.phase = 'pick'; b.block = null; }
    const c2 = b.cards[0], wrong = c2.item!.answer.kind === 'choice' ? { kind: 'choice' as const, id: 'nope' } : { kind: 'number' as const, value: -99 };
    const g2 = b.foe.grump;
    const ev2 = play(b, c2.id, { ok: true, value: 0, thinkMs: 3000, given: wrong });
    expect(ev2[0]).toMatchObject({ k: 'cast', ok: false, value: 0 });
    expect(b.foe.grump).toBe(g2);
    expect(b.missed).toContain(c2.item!.key);
  });
  it('a missed skill question comes back (a fresh one like it) in the next hand', () => {
    const b = newBattle(setup(fracPool(1)));
    b.missed.push('fr-equal:x2');
    deal(b);
    expect(b.cards[1].again).toBe(true);
    expect(b.cards[1].item?.key).toBe('fr-equal:x2');
  });
  it('the Grumble is sized for the cards it deals', () => {
    const facts = grumpFor({ subject: 'math', open: false, facts: FACTS }, false);
    const items = grumpFor(fracPool(1), false);
    expect(items).toBeGreaterThan(facts);
  });
});

describe('the battle pool', () => {
  it('an old save (no skills) gets a facts-only pool, as before', () => {
    const pool = mathPool(newProfile('Ava', 'dino'));
    expect(pool.subject === 'math' && pool.skills).toEqual([]);
    expect(pool.subject === 'math' && pool.mix).toBe(0);
  });
  it('fractions met so far mix into "all the math" battles', () => {
    const pool = mathPool(fractionsPlayer());
    if (pool.subject !== 'math') throw new Error('math');
    expect(pool.skills!.map(x => x.key).sort()).toEqual(['fr-name:2', 'fr-name:4']);
    expect(pool.mix).toBe(SKILL_MIX);
  });
  it('the grown-ups can choose fractions only: every card is a fraction, blocks stay facts, a newcomer starts with the first lesson', () => {
    const p = newProfile('Ava', 'dino');
    advOf(p).settings.focus = 'fractions';
    const pool = mathPool(p);
    if (pool.subject !== 'math') throw new Error('math');
    expect(pool.mix).toBe(1);
    expect(pool.skills!.length).toBeGreaterThan(0);
    expect(pool.skills!.every(x => x.key.startsWith('fr-name:'))).toBe(true);
    expect(pool.facts.length).toBeGreaterThan(0);
    const b = newBattle({ ...setup(pool), foe: foe() });
    expect(b.cards.every(c => c.item)).toBe(true);
  });
  it('battle answers count for the skill memory', () => {
    const p = fractionsPlayer();
    const out = applyBattle(p, { node: 'meadow-1', subject: 'math', won: false, perfect: false, foe: foe(), ms: 60000, answers: 1, right: 1, answered: [], skillAnswers: [{ key: 'fr-name:4', ok: true, thinkMs: 2000 }], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 3 });
    expect(keyStage(mathOf(out.profile), 'fr-name:4')).toBe(2);
  });
});

describe('skill cards in duels', () => {
  const side = (name: string, kind: SideSetup['kind'] = 'guest'): SideSetup => ({ name, buddy: 'dino', kind, subject: 'math', pool: fracPool(1), role: 'heart', gear: null, team: [], outfit: 'none', dance: 'dance_hiphop', ghost: kind === 'ghost' ? { acc: 1, thinkMs: 4000, big: 0 } : undefined });
  it('a right skill card fills the same DUEL_CARD as any other', () => {
    const d = newDuel(side('Mia'), side('Dad'), 'embernewt', 7);
    const c = cur(d).b.cards[0];
    duelPlay(d, c.id, { ok: true, value: 0, thinkMs: 3000, given: c.item!.answer });
    expect(d.sides[0].b.foe.grump).toBe(DUEL_BAR - DUEL_CARD);
  });
  it('a ghost answers skill cards (right when it is sure), and its answers count', () => {
    const d = newDuel(side('Ghosty', 'ghost'), side('Mia'), 'embernewt', 3);
    const mv = ghostMove(d)!;
    expect(mv.answer.given).toBeTruthy();
    expect(mv.typed.length).toBeGreaterThan(0);
    duelPlay(d, mv.cardId, mv.answer);
    expect(d.sides[0].b.foe.grump).toBe(DUEL_BAR - DUEL_CARD);
    const p = fractionsPlayer();
    applyVersus(p, { mode: 'duel', won: true, perfect: false, glimmer: 'embernewt', rarity: 'common', answers: 1, right: 1, thinkMs: 3000, big: 0, picks: 0, answered: [], skillAnswers: [{ key: 'fr-name:4', ok: true, thinkMs: 3000 }], ms: 30000, at: Date.now(), subject: 'math' } as never);
    expect(keyStage(mathOf(p), 'fr-name:4')).toBe(2);
  });
});
