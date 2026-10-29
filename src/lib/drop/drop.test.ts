import { describe, expect, it } from 'vitest';
import { CHAIN, DropGame, JAR, TOP, daySeed, pointsFor } from './engine';
import { dropOf, recordRound, familyBoard } from './save';
import { newProfile } from '../engine/profile';

const run = (g: DropGame, secs: number) => { const ev = []; for (let t = 0; t < secs; t += 1 / 60) ev.push(...g.step(1 / 60)); return ev; };

describe('Glimmer Drop', () => {
  it('has a chain of eleven that grows, and scores more for bigger merges', () => {
    expect(CHAIN).toHaveLength(11);
    for (let i = 1; i < CHAIN.length; i++) expect(CHAIN[i].r).toBeGreaterThan(CHAIN[i - 1].r);
    expect(pointsFor(1)).toBe(10);
    expect(pointsFor(10)).toBeGreaterThan(pointsFor(5));
  });
  it('a day\'s jar gives everyone the same eggs in the same order', () => {
    const a = new DropGame(daySeed('2026-10-30')), b = new DropGame(daySeed('2026-10-30'));
    const seqA: number[] = [], seqB: number[] = [];
    for (let i = 0; i < 12; i++) { seqA.push(a.hold); seqB.push(b.hold); a.drop(); b.drop(); run(a, 0.6); run(b, 0.6); }
    expect(seqA).toEqual(seqB);
    expect(daySeed('2026-10-30')).not.toBe(daySeed('2026-10-31'));
  });
  it('two of the same bump together and make the next one up', () => {
    const g = new DropGame(1);
    g.hold = 0; g.next = 0;
    g.setAim(JAR.w / 2); g.drop(); run(g, 1.2);
    g.hold = 0; g.setAim(JAR.w / 2); g.drop();
    const ev = run(g, 2);
    const m = ev.find(e => e.k === 'merge');
    expect(m).toBeTruthy();
    expect(g.balls.map(b => b.tier)).toEqual([1]);
    expect(g.score).toBe(pointsFor(1));
  });
  it('the jar\'s round bottom corners hold a Glimmer in the curve', () => {
    const g = new DropGame(2);
    g.hold = 0; g.setAim(0); g.drop();
    const r = CHAIN[0].r, C = JAR.corner;
    // dropped by the wall, it lands on the curve and rolls down it to the floor, never through the glass
    let worst = 0;
    for (let i = 0; i < 180; i++) {
      g.step(1 / 60);
      const b = g.balls[0].body.position;
      if (b.x < C && b.y > JAR.h - C) worst = Math.max(worst, Math.hypot(b.x - C, b.y - (JAR.h - C)) - (C - r));
    }
    expect(worst).toBeLessThan(2);
    const b = g.balls[0].body.position;
    expect(b.x).toBeGreaterThan(r);
    expect(Math.abs(b.y - (JAR.h - r))).toBeLessThan(2);
  });
  it('an egg cracks open just after it is dropped', () => {
    const g = new DropGame(2);
    g.drop();
    const ev = run(g, 0.5);
    expect(ev.some(e => e.k === 'crack')).toBe(true);
  });
  it('two of the biggest make a Glimmer party, and nothing is left', () => {
    const g = new DropGame(3);
    // stand two of the biggest side by side and let them touch
    (g as unknown as { add: (t: number, x: number, y: number, b: boolean) => unknown }).add(TOP, JAR.w / 2 - 125, JAR.h - 130, false);
    (g as unknown as { add: (t: number, x: number, y: number, b: boolean) => unknown }).add(TOP, JAR.w / 2 + 125, JAR.h - 130, false);
    const ev = run(g, 2);
    expect(ev.some(e => e.k === 'party')).toBe(true);
    expect(g.balls).toHaveLength(0);
  });
  it('filling the jar past the line ends the round (after a warning)', () => {
    const g = new DropGame(4);
    const ev = [];
    for (let i = 0; i < 160 && !g.done; i++) { g.hold = (i % 5); g.setAim(30 + ((i * 97) % (JAR.w - 60))); g.drop(); ev.push(...run(g, 0.5)); }
    expect(g.done).toBe(true);
    expect(ev.some(e => e.k === 'warn' && e.on)).toBe(true);
    expect(ev.some(e => e.k === 'full')).toBe(true);
  });
  it('wind comes after half a minute, with a warning first', () => {
    const g = new DropGame(5);
    const ev = run(g, 45);
    const w = ev.findIndex(e => e.k === 'gustWarn'), gu = ev.findIndex(e => e.k === 'gust');
    expect(w).toBeGreaterThanOrEqual(0);
    expect(gu).toBeGreaterThan(w);
  });
  it('remembers bests, the day\'s best and who\'s found which Glimmers, and ranks the family', () => {
    const a = newProfile('Ava', 'dino'), b = newProfile('Ben', 'koala');
    recordRound(a, { score: 1200, tier: 6, daily: true, day: '2026-10-30', ms: 90000, at: Date.now() });
    recordRound(a, { score: 800, tier: 4, daily: false, day: '2026-10-30', ms: 60000, at: Date.now() });
    recordRound(b, { score: 1500, tier: 7, daily: true, day: '2026-10-30', ms: 60000, at: Date.now() });
    expect(dropOf(a).best).toBe(1200);
    expect(dropOf(a).found).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(dropOf(a).daily).toEqual({ day: '2026-10-30', best: 1200 });
    const board = familyBoard([a, b], '2026-10-30');
    expect(board.map(r => r.name)).toEqual(['Ben', 'Ava']);
    expect(board[0].today).toBe(1500);
  });
});
