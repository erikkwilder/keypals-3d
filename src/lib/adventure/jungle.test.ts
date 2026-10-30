// Juice Jungle, the ratios and percents world: its own six stops, open once the area is started, every
// battle card a ratio or a percent, juice showers from its Grumbles, and its own Glimmers written but kept
// out of the game until their models are made.
import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import { newBattle } from './battle';
import { advOf, currentNode, foeFor, ISLAND, mathPool, NODE, nodesOf, worldOpen } from './state';
import { GLIMMER, GLIMMERS } from './glimmers';
import { JUNGLE_GLIMMERS } from './jungleGlimmers';
import { WORLD_PIN } from './worlds';
import { trailsOf } from './trails';
import { STATION } from '../audio/stations';

describe('Juice Jungle', () => {
  it('is a world of its own with six stops and a painted map, and opens once ratios are started', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(nodesOf('jungle').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a, 'jungle')!.id).toBe('jungle-0');
    expect(worldOpen(p, 'jungle')).toBe(false);
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'rt-ratio:pic', ok: true, thinkMs: 4000 }], Date.now());
    expect(worldOpen(p, 'jungle')).toBe(true);
    const pin = WORLD_PIN.jungle;
    expect(pin.area).toBe('ratios');
    expect(pin.map?.wide).toBe('game/map-jungle-wide.webp');
    expect(pin.art?.src).toBe('game/world-jungle.webp');
    expect(STATION[pin.station!].tracks.length).toBeGreaterThan(0);
    for (const n of nodesOf('jungle')) expect(trailsOf('jungle').point[n.id]?.kind).toBe('stop');
  });
  it('every battle card is a ratios or percents question', () => {
    const p = newProfile('Ava', 'dino');
    noteSkillAnswers((p.math = mathOf(p)), [{ key: 'rt-ratio:pic', ok: true, thinkMs: 4000 }, { key: 'rt-pct:grid', ok: true, thinkMs: 4000 }], Date.now());
    const pl = mathPool(p, 'ratios');
    expect(pl.subject === 'math' && pl.mix).toBe(1);
    expect(pl.subject === 'math' && pl.skills!.length).toBeGreaterThan(0);
    expect(pl.subject === 'math' && pl.skills!.every(s => s.key.startsWith('rt-'))).toBe(true);
    for (const seed of [3, 8, 21]) {
      const b = newBattle({ pool: pl, seed, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['jungle-0'], pl, seed), hit: 3 } });
      expect(b.cards.length).toBeGreaterThan(0);
      expect(b.cards.every(c => c.item?.skill.startsWith('rt-'))).toBe(true);
    }
  });
  it('its Grumbles send juice showers and live there; the Champion is the Pinecone Pangolin', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'ratios');
    expect(foeFor(p, NODE['jungle-5'], pl, 1)).toMatchObject({ glimmer: 'pinepango', champion: true, mischief: { kind: 'rain' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = foeFor(p, NODE['jungle-1'], pl, s); expect(f.mischief?.name).toMatch(/juice/); seen.add(f.glimmer); }
    expect(ISLAND.jungle.natives!.every(id => seen.has(id))).toBe(true);
  });
  it('its own Glimmers (three natives and a Champion) are natives of the world, on their way until their models come', () => {
    expect(JUNGLE_GLIMMERS.length).toBe(4);
    expect(JUNGLE_GLIMMERS.filter(g => g.champion)).toEqual([expect.objectContaining({ id: 'mangojaguar', champion: 'jungle' })]);
    for (const g of JUNGLE_GLIMMERS) {
      expect(g).toMatchObject({ source: 'native', world: 'jungle', pending: true });
      // in the Glimmer Book (GLIMMER), never in a random roll (GLIMMERS)
      expect(GLIMMERS.some(x => x.id === g.id)).toBe(false);
      expect(GLIMMER[g.id]).toBe(g);
      expect(g.power.text(1).length).toBeGreaterThan(10);
      expect(g.quirk.length).toBeGreaterThan(10);
    }
    // until then the world's battles use Glimmers that are in the game
    for (const id of [...ISLAND.jungle.natives!, ISLAND.jungle.champion]) expect(GLIMMER[id]).toBeDefined();
  });
});
