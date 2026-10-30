// Blocking a counterattack in a math world: the quick one comes from the world's own area when it has
// questions with a whole-number answer (pitched easy, about 90% right, like a fact block), and is a fact
// when it hasn't; on the Sky Islands blocks stay facts. Negative numbers questions are blocks too: the
// block box has a minus key and Check for them.
import { describe, expect, it } from 'vitest';
import { newProfile, type Profile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import { SKILL, skillsOf } from '../math/skills/registry';
import { rungFor, TARGET } from '../math/skills/ability';
import { mulberry32 } from '../engine/rng';
import type { AreaId } from '../math/skills/types';
import { block, blockable, blockMs, newBattle, play, signedBlock, type Battle, type Pool } from './battle';
import { mathPool } from './state';

const AREAS: AreaId[] = ['fractions', 'place', 'decimals', 'measure', 'shapes', 'ratios', 'integers', 'algebra', 'data'];
/** a player who has met every question of an area (so its world's pool has all of them) */
function metAll(area: AreaId): Profile {
  const p = newProfile('Ava', 'dino'), m = (p.math = mathOf(p));
  noteSkillAnswers(m, skillsOf(area).flatMap(s => s.subs.map(sb => ({ key: `${s.id}:${sb.id}`, ok: true, thinkMs: 3000 }))), Date.now());
  return p;
}
const battle = (pool: Pool, seed: number) => newBattle({ pool, seed, sparkMax: 99, role: 'heart', gear: null, team: [], foe: { glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump: 400, max: 400, hit: 3 } });
/** play a card wrong, so the Grumble sends its counterattack */
function counter(b: Battle) {
  play(b, b.cards[0].id, { ok: false, value: -1, thinkMs: 1000 });
  expect(b.phase).toBe('block');
  return b.block!;
}
/** whether a key ever makes a question the block box can take */
const everPlain = (key: string) => {
  const [skill, sub] = key.split(':'), s = SKILL[skill], rng = mulberry32(5);
  for (let r = 1; r <= 6; r++) for (let i = 0; i < 25; i++) if (blockable(s.make(rng, sub, r))) return true;
  return false;
};

describe('blocks in a math world', () => {
  it('come from the world\'s own area, pitched easy, whenever it has plain whole-number questions', () => {
    for (const area of AREAS) {
      const pool = mathPool(metAll(area), area);
      expect(pool.subject === 'math' && pool.area).toBe(area);
      const plain = pool.subject === 'math' && pool.skills!.some(x => everPlain(x.key));
      let items = 0;
      for (let seed = 1; seed <= 24; seed++) {
        const bl = counter(battle(pool, seed));
        if (bl.item) {
          items++;
          expect(SKILL[bl.item.skill].area).toBe(area);
          expect(blockable(bl.item)).toBe(true);
          // pitched at the quick target (about 90% right), one step of jitter at most
          const th = pool.subject === 'math' ? pool.theta![bl.item.skill] : 0;
          expect(bl.item.rung!).toBeLessThanOrEqual(rungFor(th, TARGET.quick) + 1);
          expect(bl.limitMs).toBe(blockMs(bl.item));
        } else {
          expect(bl.fact).toBeTruthy();
          expect(bl.limitMs).toBe(5000);
        }
      }
      if (plain) expect(items, area).toBeGreaterThanOrEqual(20);
      else expect(items, area).toBe(0);
    }
  });
  it('every area with a world has some, negative numbers too', () => {
    for (const area of AREAS) expect(skillsOf(area).some(s => s.subs.some(sb => everPlain(`${s.id}:${sb.id}`))), area).toBe(true);
  });
  it('Below Zero Caves blocks are its own questions, some with a negative answer, all with the minus key and Check', () => {
    const pool = mathPool(metAll('integers'), 'integers');
    let neg = 0, items = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const bl = counter(battle(pool, seed));
      if (!bl.item) continue;
      items++;
      expect(SKILL[bl.item.skill].area).toBe('integers');
      expect(signedBlock(bl.item)).toBe(true);
      expect(bl.item.answer.kind === 'number' && Number.isInteger(bl.item.answer.value)).toBe(true);
      if (bl.item.answer.kind === 'number' && bl.item.answer.value < 0) neg++;
    }
    expect(items).toBeGreaterThanOrEqual(35);
    expect(neg).toBeGreaterThanOrEqual(8);
    // a negative answer blocks it when it's right
    const b = battle(pool, 2), bl = counter(b);
    block(b, true, 2000);
    expect(b.skillAnswers.at(-1)?.ok).toBe(true);
    expect(bl.item).toBeTruthy();
  });
  it('plain questions in the other worlds keep the instant send (no minus key)', () => {
    for (const area of AREAS.filter(a => a !== 'integers')) {
      const pool = mathPool(metAll(area), area);
      for (let seed = 1; seed <= 8; seed++) { const bl = counter(battle(pool, seed)); if (bl.item) expect(signedBlock(bl.item), area).toBe(false); }
    }
  });
  it('fall back to facts when the area\'s questions met so far have no plain number answer', () => {
    const p = metAll('shapes'), pool = mathPool(p, 'shapes');
    if (pool.subject !== 'math') throw new Error('math');
    const picky = pool.skills!.filter(x => !everPlain(x.key));
    expect(picky.length).toBeGreaterThan(0);
    for (let seed = 1; seed <= 10; seed++) {
      const bl = counter(battle({ ...pool, skills: picky }, seed));
      expect(bl.item).toBeUndefined();
      expect(bl.fact).toBeTruthy();
    }
  });
  it('a block answered goes into the skill memory and the ability with its rung', () => {
    const pool = mathPool(metAll('place'), 'place');
    const b = battle(pool, 3), bl = counter(b);
    expect(bl.item).toBeTruthy();
    block(b, true, 2500);
    expect(b.skillAnswers.at(-1)).toEqual({ key: bl.item!.key, ok: true, thinkMs: 2500, rung: bl.item!.rung });
  });
  it('on the Sky Islands (every kind of math) blocks are facts', () => {
    const p = metAll('place'), pool = mathPool(p);
    expect(pool.subject === 'math' && pool.area).toBeFalsy();
    for (let seed = 1; seed <= 10; seed++) {
      const bl = counter(battle(pool, seed));
      expect(bl.item).toBeUndefined();
      expect(bl.fact).toBeTruthy();
    }
  });
  it('a slower kind of question gives longer, never less than a fact\'s 5 seconds or more than 20', () => {
    for (const s of Object.values(SKILL).filter(x => !x.facts)) {
      const ms = blockMs({ skill: s.id } as never);
      expect(ms).toBeGreaterThanOrEqual(5000);
      expect(ms).toBeLessThanOrEqual(20000);
    }
    expect(blockMs()).toBe(5000);
  });
});
