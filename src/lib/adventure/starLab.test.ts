// The Star Lab: the expressions and equations world. It opens once the area is started, every battle card
// is one of its questions, its Grumbles send shooting stars, the Comet Cat is its Champion for now, and
// its own Glimmers wait (pending) for their 3D models.
import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import { SKILL } from '../math/skills/registry';
import { newBattle } from './battle';
import { advOf, currentNode, foeFor, ISLAND, mathPool, NODE, nodesOf, worldOpen } from './state';
import { GLIMMER, GLIMMERS } from './glimmers';
import { STAR_GLIMMERS } from './starGlimmers';
import { WORLD_PIN } from './worlds';

describe('Star Lab', () => {
  it('is a world of its own with six stops, opens once algebra is started, and every card is algebra', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(WORLD_PIN.stars.map).toBeTruthy();
    expect(nodesOf('stars').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a, 'stars')!.id).toBe('stars-0');
    expect(worldOpen(p, 'stars')).toBe(false);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'al-missing:add', ok: true, thinkMs: 3000 }, { key: 'al-pattern:next', ok: true, thinkMs: 4000 }], Date.now());
    expect(worldOpen(p, 'stars')).toBe(true);
    const pl = mathPool(p, 'algebra');
    expect(pl.subject === 'math' && pl.skills!.length > 0 && pl.skills!.every(s => s.key.startsWith('al-'))).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const b = newBattle({ pool: pl, seed, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['stars-0'], pl, seed), hit: 3 } });
      expect(b.cards.every(c => c.item && SKILL[c.item.skill].area === 'algebra')).toBe(true);
    }
  });
  it('a player who has met nothing yet still gets the first trip\'s questions', () => {
    const pl = mathPool(newProfile('Ava', 'dino'), 'algebra');
    expect(pl.subject === 'math' && pl.skills!.every(s => s.key.startsWith('al-missing:'))).toBe(true);
  });
  it('its Grumbles send shooting stars; the Comet Cat is its Champion; the natives turn up', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'algebra');
    expect(foeFor(p, NODE['stars-5'], pl, 1)).toMatchObject({ glimmer: 'cometcat', champion: true, mischief: { kind: 'zap' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 300; s++) { const f = foeFor(p, NODE['stars-1'], pl, s); expect(f.mischief?.name).toMatch(/shooting stars/i); seen.add(f.glimmer); }
    expect(ISLAND.stars.natives!.every(id => seen.has(id))).toBe(true);
  });
  it('its own Glimmers are written but pending: none of them is in the game until its model exists', () => {
    expect(STAR_GLIMMERS.length).toBe(4);
    expect(STAR_GLIMMERS.filter(g => g.champion).length).toBe(1);
    for (const g of STAR_GLIMMERS) {
      expect(g.pending).toBe(true);
      expect(GLIMMERS.some(x => x.id === g.id)).toBe(false);
      expect(g.power.text(1)).toMatch(/\w/);
    }
    for (const id of ISLAND.stars.natives!) expect(GLIMMER[id]).toBeTruthy();
  });
});
