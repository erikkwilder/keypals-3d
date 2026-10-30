// Clockwork Isle: the Measurement and time world. It opens once the area is started, its stops sit on its
// own painted maps, every battle card is a measuring question, and its own Glimmers wait for their models.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { newProfile } from '../engine/profile';
import { mathOf } from '../math/progress';
import { SKILL, splitKey } from '../math/skills/registry';
import { ISLAND, NODE, foeFor, islandsOf, mathPool, nodesOf, worldOpen } from './state';
import { WORLD_PIN } from './worlds';
import { SPOTS } from './mapSpots';
import { GLIMMER, GLIMMERS } from './glimmers';
import { CLOCKWORK_GLIMMERS } from './clockwork';
import { STATION } from '../audio/stations';
import type { Pool } from './battle';

type MathPool = Extract<Pool, { subject: 'math' }>;

const pub = (f: string) => existsSync(new URL(`../../../public/${f}`, import.meta.url));

describe('Clockwork Isle', () => {
  it('is a world of its own with a painted map, wide and tall, and six stops on it', () => {
    const w = WORLD_PIN.clockwork;
    expect(w.area).toBe('measure');
    expect(w.map && pub(w.map.wide) && pub(w.map.tall)).toBe(true);
    expect(islandsOf('clockwork').map(i => i.id)).toEqual(['clockwork']);
    expect(nodesOf('clockwork').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    for (const n of nodesOf('clockwork')) for (const k of ['wide', 'tall'] as const) { const s = SPOTS[k][n.id]; expect(s, `${k} ${n.id}`).toBeTruthy(); expect(s[0]).toBeGreaterThan(0); expect(s[1]).toBeLessThan(100); }
  });
  it('opens once a measuring question has been answered', () => {
    const p = newProfile('Kid', 'dino');
    expect(worldOpen(p, 'clockwork')).toBe(false);
    p.math = { ...mathOf(p), skills: { 'ms-hour:oclock': { stage: 1, seen: 2 } as never } };
    expect(worldOpen(p, 'clockwork')).toBe(true);
  });
  it('deals only measuring questions in its battles', () => {
    const p = newProfile('Kid', 'dino');
    const pool = mathPool(p, ISLAND.clockwork.area) as MathPool;
    expect(pool.mix).toBe(1);
    expect(pool.skills!.length).toBeGreaterThan(0);
    for (const s of pool.skills!) expect(SKILL[splitKey(s.key).skill].area).toBe('measure');
    const st = (stage: number) => ({ stage, seen: 3, times: [2000, 3000] }) as never;
    p.math = { ...mathOf(p), skills: { 'ms-hour:oclock': st(2), 'ms-ruler:read': st(1), 'dm-coins:small': st(3) } };
    const pool2 = mathPool(p, 'measure') as MathPool;
    expect(pool2.skills!.map(s => s.key).sort()).toEqual(['ms-hour:oclock', 'ms-ruler:read']);
  });
  it('has a Champion at the clock tower and cuckoo clocks for weather', () => {
    const p = newProfile('Kid', 'dino'), pool = mathPool(p, 'measure');
    expect(foeFor(p, NODE['clockwork-5'], pool, 1)).toMatchObject({ glimmer: ISLAND.clockwork.champion, champion: true, mischief: { kind: 'zap' } });
    for (let s = 1; s <= 60; s++) expect(foeFor(p, NODE['clockwork-1'], pool, s).mischief?.name).toMatch(/cuckoo/);
    for (const g of ISLAND.clockwork.natives!) expect(GLIMMER[g], g).toBeTruthy();
  });
  it('writes its own three Glimmers and Champion, kept out until their models are made', () => {
    expect(CLOCKWORK_GLIMMERS.map(g => g.rarity)).toEqual(['common', 'uncommon', 'rare', 'legendary']);
    expect(CLOCKWORK_GLIMMERS.filter(g => g.champion)).toHaveLength(1);
    const ids = new Set<string>(GLIMMERS.map(g => g.id));
    for (const g of CLOCKWORK_GLIMMERS) { expect(g.pending).toBe(true); expect(ids.has(g.id), g.id).toBe(false); expect(g.power.text(1).length).toBeGreaterThan(10); }
  });
  it('plays the Storybook station (with its Magical Mysterious Clockwork) while the choice is Auto', () => {
    // (Adventure hands the world's station to startMusic, which plays it only while the choice is Auto)
    expect(WORLD_PIN.clockwork.station).toBe('storybook');
    expect(WORLD_PIN.sky.station).toBeUndefined();
    expect(STATION.storybook.tracks.some(t => /clockwork/i.test(t.title))).toBe(true);
  });
});
