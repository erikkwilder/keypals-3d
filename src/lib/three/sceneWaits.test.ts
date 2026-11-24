// The lesson kits wait on the scene's clock, not the wall's (sceneWaits.ts says why). These tests hold the
// clock's behaviour, and hold every beat lesson's kit to using it: a setTimeout in a kit brings back the fault
// where, under 20 frames a second, the narrator says what the picture hasn't shown yet.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { SceneWaits } from './sceneWaits';

describe('waits counted on the scene\'s clock', () => {
  it('a wait ends when that much of the scene\'s time has passed, however slowly it passes', async () => {
    const w = new SceneWaits();
    let done = false;
    void w.wait(1000).then(() => { done = true; });
    // (frames a twentieth of a second of scene time apart, as on a slow computer: twenty of them make a second)
    let t = 500;
    for (let i = 0; i < 19; i++) { w.tick(t += 0.05); await Promise.resolve(); expect(done).toBe(false); }
    w.tick(t += 0.05); w.tick(t += 0.05);
    await Promise.resolve();
    expect(done).toBe(true);
  });
  it('the first tick only sets the clock: a wait made before the scene has drawn doesn\'t end at once', async () => {
    const w = new SceneWaits();
    let done = false;
    void w.wait(300).then(() => { done = true; });
    w.tick(9000);
    await Promise.resolve();
    expect(done).toBe(false);
    w.tick(9000.31);
    await Promise.resolve();
    expect(done).toBe(true);
  });
  it('nothing ends while the clock stands still (the page hidden or paused), and later() runs in the order asked', () => {
    const w = new SceneWaits(), ran: string[] = [];
    w.later(200, () => ran.push('a')); w.later(100, () => ran.push('b')); w.later(200, () => ran.push('c'));
    w.tick(10); w.tick(10); w.tick(10);
    expect(ran).toEqual([]);
    w.tick(10.15);
    expect(ran).toEqual(['b']);
    w.tick(10.25);
    expect(ran).toEqual(['b', 'a', 'c']);
    w.later(100, () => ran.push('d')); w.clear(); w.tick(11);
    expect(ran).toEqual(['b', 'a', 'c']);
  });
});

describe('every beat lesson\'s kit waits on the scene\'s clock', () => {
  // (the kits named in a beat lesson's `world`: math/beats/*Lesson.ts imports '../../three/<name>Kit')
  const beats = new URL('../math/beats/', import.meta.url), three = new URL('./', import.meta.url);
  const kits = [...new Set(readdirSync(beats).filter(f => /Lesson\.ts$/.test(f) && !/\.test\./.test(f))
    .flatMap(f => [...readFileSync(new URL(f, beats), 'utf8').matchAll(/three\/(\w+Kit)'/g)].map(m => m[1])))];
  it('finds the kits', () => { expect(kits.length).toBeGreaterThanOrEqual(4); });
  for (const k of kits) it(`${k}: no setTimeout or setInterval, and its update ticks the waits`, () => {
    const src = readFileSync(new URL(`${k}.ts`, three), 'utf8');
    expect(src).not.toMatch(/\bset(Timeout|Interval)\(/);
    expect(src).toMatch(/this\.waits\.tick\(t\)/);
  });
});
