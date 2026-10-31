import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { LADDERS, rideName, rideVerb } from '../engine/rides';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const KITS = ['./sledKit.ts', './swimKit.ts'];

describe('six ways down the slope and six across the bay', () => {
  it('each speed step is its own ride or stroke, named for what the buddy does', () => {
    expect(LADDERS.slide.map(s => s.name)).toEqual(['Wobbly Sled', 'Saucer', 'Skis', 'Snowboard', 'Bobsled', 'Avalanche']);
    expect(LADDERS.swim.map(s => s.name)).toEqual(['Swim Ring', 'Arm Bands', 'Flippers', 'Goggles', 'Dolphin', 'Torpedo']);
  });
  it('every step has its own picture on the speed card', () => {
    for (const move of ['slide', 'swim']) for (let t = 0; t < 6; t++) expect(existsSync(new URL(`../../../public/icons/ride-${move}-${t}.webp`, import.meta.url))).toBe(true);
    // the small sled and swim pictures elsewhere show the wooden sled and the goggles, as they did before the cards were put in riding order
    expect(src('../art/icons.ts')).toMatch(/slide: iconUrl\('ride-slide-0'\), swim: iconUrl\('ride-swim-3'\)/);
    const old = src('../ui/Icon.svelte');
    expect(old).toMatch(/slide: iconUrl\('ride-slide-0'\), swim: iconUrl\('ride-swim-3'\)/);
  });
  it('a saved best ride is a step number, so old records still show (under the new name)', () => {
    expect(rideName(1, 'slide')).toBe('Saucer');
    expect(rideName(3, 'swim')).toBe('Goggles');
    expect(rideVerb(5, 'slide')).toBe('Avalanche');
    // out of range stays on the ladder
    expect(rideName(9, 'slide')).toBe('Avalanche');
    expect(rideName(-1, 'swim')).toBe('Swim Ring');
  });
  it('adds no lights mid-game (a new light recompiles every material and freezes the game)', () => {
    for (const k of [...KITS, './kitParts.ts']) expect(src(k)).not.toMatch(/new THREE\.\w*Light/);
  });
  it('has its gear ready before the first step-up, and a motion for every step', () => {
    expect(src('./runScene.ts')).toMatch(/void k\.ready\(\)/);
    for (const k of KITS) {
      const poses = /const poses: [^\n]*\n([\s\S]*?)\n {2}\];/.exec(src(k))?.[1] ?? '';
      // one pose for each step, each opened by its own comment
      expect(poses.match(/^ {4}\/\/ /gm)?.length).toBe(6);
    }
  });
  it('says what steps aside on each step, and always puts it back after', () => {
    for (const k of KITS) {
      const code = src(k);
      expect(/const HIDE: string\[\]\[\] = \[(.*)\];/.exec(code)?.[1].match(/\[/g)?.length).toBe(6);
      expect(code).toMatch(/rest\(/);
    }
    // the swim's first step has its hands on the ring, so "everything back" isn't the same as "step 0"
    expect(src('./swimKit.ts')).toMatch(/wornBack\(\)/);
    expect(src('./sledKit.ts')).toMatch(/const HIDE: string\[\]\[\] = \[\[\],/);
  });
  it('the rival rides its own kit, see-through', () => {
    const scene = src('./runScene.ts');
    expect(scene).toMatch(/swimKit\(this\.ghost, \{ ghost: this\.ghostMat \}\)/);
    expect(scene).toMatch(/sledKit\(this\.ghost, \{ sled: this\.ghostSled!, ghost: this\.ghostMat \}\)/);
  });
});
