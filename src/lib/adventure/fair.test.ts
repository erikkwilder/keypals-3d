// The Chance Fair: a world of its own for Data and chance. It opens once the area is started, every battle
// card is a data question, its Grumbles send gusts of confetti, and its own Glimmers wait (pending) for
// their 3D models, so they never turn up anywhere yet.
import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { newBattle } from './battle';
import { advOf, currentNode, foeFor, mathPool, NODE, nodesOf, worldOpen, ISLAND } from './state';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import { GLIMMER, GLIMMERS } from './glimmers';
import { FAIR_GLIMMERS } from './fairGlimmers';
import { WORLD_PIN, stationOf } from './worlds';
import { trailsOf } from './trails';
import { SKILL } from '../math/skills/registry';

describe('the Chance Fair', () => {
  it('is a world of its own with six stops on its painted map, and opens once data and chance is started', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(WORLD_PIN.fair.map).toBeTruthy();
    expect(nodesOf('fair').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a, 'fair')!.id).toBe('fair-0');
    for (const n of nodesOf('fair')) expect(trailsOf('fair').point[n.id]?.kind).toBe('stop');
    expect(worldOpen(p, 'fair')).toBe(false);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'da-sort:count', ok: true, thinkMs: 3000 }], Date.now());
    expect(worldOpen(p, 'fair')).toBe(true);
    expect(stationOf('fair')).toBe('world');
  });
  it('every battle card is a data and chance question', () => {
    const p = newProfile('Ava', 'dino');
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'da-sort:count', ok: true, thinkMs: 3000 }, { key: 'da-bars:read', ok: true, thinkMs: 5000 }, { key: 'da-chance:bag', ok: true, thinkMs: 6000 }, { key: 'fr-name:4', ok: true, thinkMs: 3000 }], Date.now());
    const pl = mathPool(p, 'data');
    expect(pl.subject === 'math' && pl.skills!.length > 0 && pl.skills!.every(s => SKILL[s.key.split(':')[0]].area === 'data')).toBe(true);
    for (let seed = 1; seed <= 20; seed++) {
      const b = newBattle({ pool: pl, seed, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['fair-0'], pl, seed), hit: 3 } });
      expect(b.cards.every(c => c.item && SKILL[c.item.skill].area === 'data')).toBe(true);
    }
  });
  it('its Grumbles send confetti; the Champion guards the prize tent; only Glimmers with models turn up', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'data');
    expect(foeFor(p, NODE['fair-5'], pl, 1)).toMatchObject({ glimmer: ISLAND.fair.champion, champion: true, mischief: { kind: 'gust' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = foeFor(p, NODE['fair-1'], pl, s); expect(f.mischief?.name).toMatch(/confetti/); seen.add(f.glimmer); expect(GLIMMER[f.glimmer as keyof typeof GLIMMER]).toBeTruthy(); }
    expect(ISLAND.fair.natives!.some(id => seen.has(id))).toBe(true);
  });
  it('its own Glimmers are written and painted, and pending: none of them is in the game yet', () => {
    expect(FAIR_GLIMMERS.length).toBe(4);
    expect(FAIR_GLIMMERS.filter(g => g.champion).length).toBe(1);
    for (const g of FAIR_GLIMMERS) {
      expect(g.pending).toBe(true);
      expect(GLIMMERS.some(x => x.id === g.id)).toBe(false);
      expect(g.power.text(1).length).toBeGreaterThan(10);
      expect(g.quirk.length).toBeGreaterThan(10);
      expect(g.evolved.name.length).toBeGreaterThan(3);
    }
  });
});
