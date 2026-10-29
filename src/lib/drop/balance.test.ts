import { describe, expect, it } from 'vitest';
import { CHAIN, DropGame, JAR } from './engine';

type Bot = (g: DropGame, rnd: () => number) => number;
/** drop as fast as allowed, always in the same place */
const spamSame: Bot = () => JAR.w / 2;
/** drop as fast as allowed, anywhere */
const spamRandom: Bot = (_g, rnd) => 20 + rnd() * (JAR.w - 40);
/** a simple player: drop onto a Glimmer of the same kind near the top of the pile, else where the pile is lowest */
const sensible: Bot = (g) => {
  const r = CHAIN[g.hold].r;
  let best = JAR.w / 2, bestScore = -1e9;
  for (let x = r + 2; x <= JAR.w - r - 2; x += 12) {
    // the first ball the egg would land on, falling straight down at x
    let hit: { tier: number; top: number } | null = null;
    for (const b of g.balls) {
      const br = CHAIN[b.tier].r * b.grow, dx = Math.abs(b.body.position.x - x);
      if (dx > br + r) continue;
      const top = b.body.position.y - Math.sqrt(Math.max(0, (br + r) ** 2 - dx * dx));
      if (!hit || top < hit.top) hit = { tier: b.tier, top };
    }
    const surface = hit ? hit.top : JAR.h;
    const s = (hit && hit.tier === g.hold ? 600 : 0) + (hit && hit.tier < g.hold ? -80 : 0) + surface * 0.5;
    if (s > bestScore) { bestScore = s; best = x; }
  }
  return best;
};
function play(bot: Bot, seed: number, secs = 300) {
  const g = new DropGame(seed);
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  let drops = 0;
  for (let t = 0; t < secs && !g.done; t += 1 / 60) {
    if (g.canDrop()) { g.setAim(bot(g, rnd)); if (g.drop()) drops++; }
    g.step(1 / 60);
  }
  return { score: g.score, secs: g.t, drops, full: g.done, top: g.best.tier };
}
describe('Glimmer Drop balance', () => {
  it('rewards thinking: aiming for twins scores far more than dropping fast anywhere, and spam fills the jar', () => {
    const seeds = [11, 22, 33, 44, 55, 66];
    const avg = (bot: Bot) => { const rs = seeds.map(seed => play(bot, seed)); return { score: rs.reduce((a, r) => a + r.score, 0) / rs.length, allFull: rs.every(r => r.full) }; };
    const same = avg(spamSame), rand = avg(spamRandom), good = avg(sensible);
    expect(good.score).toBeGreaterThan(same.score * 1.5);
    expect(good.score).toBeGreaterThan(rand.score * 1.8);
    expect(same.allFull && rand.allFull).toBe(true);
  }, 180000);
  it('waits for the last egg to land before the next can drop', () => {
    const g = new DropGame(7);
    g.drop();
    expect(g.canDrop()).toBe(false);
    for (let i = 0; i < 20; i++) g.step(1 / 60);
    expect(g.readiness()).toBeLessThan(1);
    for (let i = 0; i < 120 && !g.canDrop(); i++) g.step(1 / 60);
    expect(g.canDrop()).toBe(true);
  });
});
