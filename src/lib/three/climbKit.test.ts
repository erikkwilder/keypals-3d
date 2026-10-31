import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { LADDERS } from '../engine/rides';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('the six ways up the cliff', () => {
  it('each speed step is its own way of climbing, named for it, with its own picture on the speed card', () => {
    expect(LADDERS.climb.map(s => s.name)).toEqual(['Hold On', 'Rope Climber', 'Spring Boots', 'Grappling Hook', 'Jet Pack', 'Rocket Boots']);
    for (let t = 0; t < 6; t++) expect(existsSync(new URL(`../../../public/icons/ride-climb-${t}.webp`, import.meta.url))).toBe(true);
  });
  it('adds no lights mid-game (a new light recompiles every material and freezes the game)', () => {
    expect(src('./climbKit.ts')).not.toMatch(/new THREE\.\w*Light/);
  });
  it('has its gear ready before the first step-up, and its motion for every step', () => {
    expect(src('./runScene.ts')).toMatch(/k\.ready\(\)/);
    const poses = /const poses: [^\n]*\n([\s\S]*?)\n {2}\];/.exec(src('./climbKit.ts'))?.[1] ?? '';
    // one pose for each step, each opened by its own comment
    expect(poses.match(/^ {4}\/\/ /gm)?.length).toBe(6);
  });
});
