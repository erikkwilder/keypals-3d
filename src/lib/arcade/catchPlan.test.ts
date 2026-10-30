// Glimmer Catch, played by a careful player: whole rounds on a wide screen and a phone, with the game's
// own way of letting Glimmers go (GlimmerCatch.svelte's spawn) and the scene's own catching (catch.ts:
// the sway, the net's reach and lead, the band round the net). The careful player looks at what's
// falling and only takes a path that stays clear of the wrong ones. It should never touch a wrong one,
// and still catch most of the right ones. Without the fair-play check (Glimmers let go anywhere) the
// same player gets cornered now and then, which is what Erik ran into.
import { describe, expect, it } from 'vitest';
import { carefulPath, fieldX, newFaller, NET, PLAN_DT, placeDrop, type Faller, type Field } from './catchPlan';
import { mulberry32 } from '../engine/rng';

/** the field catch.ts fits to a screen of this shape (FOV 40) */
function fieldFor(aspect: number): Field {
  const tn = Math.tan((40 / 2) * (Math.PI / 180));
  const half = Math.max(2.4, Math.min(5.2, aspect * 3.3));
  const D = half / (tn * aspect);
  const ch = 0.68 * D * tn;
  return { half: half * 0.92, top: ch + (aspect < 0.8 ? 0.42 : 0.5) * D * tn, net: 1.35 };
}

type Sim = Faller & { seed: number; done: boolean };
/** One 60-second round (with the time right answers add, rounds run about this long). */
function round(seed: number, f: Field, planned: boolean, who: 'careful' | 'straight' = 'careful') {
  const rng = mulberry32(seed);
  const DT = PLAN_DT;
  let t = 0, px = 0, spawnIn = 0.3, sinceRight = 0, lastX = 0, caught = 0, onTarget = 0;
  let fallers: Sim[] = [];
  let path: number[] = [];
  const out = { right: 0, caught: 0, wrong: 0, touched: 0 };
  const replan = () => { path = carefulPath(fallers.filter(g => !g.done), px, f); };
  while (t < 60) {
    const progress = t / 60;
    // let one go (GlimmerCatch.svelte's spawn)
    spawnIn -= DT;
    if (spawnIn <= 0) {
      const right = sinceRight >= 2 || rng() < 0.42;
      const gold = right && rng() < 0.08;
      const secs = 5.4 - 1.9 * progress + (gold ? 0.6 : 0);
      const live = fallers.filter(g => !g.done);
      let x: number | null;
      if (planned) x = placeDrop(rng, live, px, f, { right, secs }, lastX);
      else { x = rng() * 1.8 - 0.9; if (Math.abs(x - lastX) < 0.4) x = x > 0 ? x - 0.7 : x + 0.7; }
      if (x === null) spawnIn = 0.25;
      else {
        lastX = x;
        fallers.push({ ...newFaller(x, secs, right, f), seed: rng() * 6, done: false });
        sinceRight = right ? 0 : sinceRight + 1;
        if (right) out.right++; else out.wrong++;
        spawnIn = 1.35 - 0.5 * progress + rng() * 0.3;
        replan();
      }
    }
    // the careful player takes its next step along the path (a new path when it runs out); a child just
    // runs straight at the right one coming down soonest, a little slower, and waits under it
    let next: number | undefined;
    if (who === 'careful') { if (!path.length) replan(); next = path.shift(); }
    else {
      const r = fallers.filter(g => !g.done && g.right && g.y < f.top + 0.6 - g.vy * 0.4).sort((a, b) => a.y / a.vy - b.y / b.vy)[0];
      const lim = f.half - NET.edge;
      let to = r ? Math.max(-lim, Math.min(lim, r.x)) : px;
      // ...but steps out from under a wrong one about to come down on them, to the roomier side
      const over = fallers.find(g => !g.done && !g.right && (g.y - f.net) / g.vy < 1.5 && Math.abs(g.x - px) < 1.3);
      if (over && (!r || Math.abs(r.x - over.x) > 1.3)) to = over.x > px ? (over.x - 1.4 > -lim ? over.x - 1.4 : over.x + 1.4) : (over.x + 1.4 < lim ? over.x + 1.4 : over.x - 1.4);
      else if (over && r) to = px;
      next = px + Math.max(-4 * DT, Math.min(4 * DT, to - px));
    }
    const vx = next === undefined ? 0 : (next - px) / DT;
    if (next !== undefined) px = next;
    t += DT;
    // the Glimmers fall; one in the band near the net is caught (or bonks off), as in catch.ts
    let changed = false;
    for (const g of fallers) {
      if (g.done) continue;
      g.y -= g.vy * DT;
      const gx = g.x + Math.sin(t * 1.6 + g.seed) * NET.sway;
      const nx = px + Math.sign(vx || 1) * NET.lead;
      if (g.y < f.net + NET.above && g.y > f.net - NET.below && Math.abs(gx - nx) < NET.reach) {
        g.done = true; changed = true;
        if (g.right) { out.caught++; onTarget++; } else out.touched++;
        // four caught and the number changes: everything still falling floats away
        if (onTarget >= 4) { onTarget = 0; for (const h of fallers) h.done = true; }
      } else if (g.y < -0.2) { g.done = true; changed = true; }
    }
    if (changed) { fallers = fallers.filter(g => !g.done); if (who === 'careful') replan(); }
  }
  return out;
}

describe('Glimmer Catch: there is always a clear way to the right ones', () => {
  const screens: [string, Field][] = [['a wide screen', fieldFor(1440 / 900)], ['a laptop', fieldFor(1280 / 720)], ['a phone', fieldFor(390 / 844)]];
  for (const [name, f] of screens) {
    it(`a careful player never touches a wrong one on ${name}`, () => {
      const tot = { right: 0, caught: 0, wrong: 0, touched: 0 };
      for (let s = 1; s <= 12; s++) { const r = round(s * 7919, f, true); for (const k of Object.keys(tot) as (keyof typeof tot)[]) tot[k] += r[k]; }
      expect(tot.touched).toBe(0);
      // and the game still sends plenty, and most right ones get caught
      expect(tot.right + tot.wrong).toBeGreaterThan(12 * 30);
      expect(tot.caught / tot.right).toBeGreaterThan(0.7);
    });
  }
  it('without the check, the same careful player gets cornered sometimes (on a phone)', () => {
    const f = fieldFor(390 / 844);
    let touched = 0;
    for (let s = 1; s <= 12; s++) touched += round(s * 7919, f, false).touched;
    expect(touched).toBeGreaterThan(0);
  });
  it('a child running straight at the right ones (and stepping out from under wrong ones) bumps into far fewer', () => {
    let now = 0, before = 0;
    for (const f of [fieldFor(1440 / 900), fieldFor(390 / 844)]) {
      for (let s = 1; s <= 12; s++) { now += round(s * 7919, f, true, 'straight').touched; before += round(s * 7919, f, false, 'straight').touched; }
    }
    // about 20 bumps in 24 rounds now, against about 54 before
    expect(now).toBeLessThan(before / 2);
  });
  it('the plan puts Glimmers where the scene does', () => {
    expect(fieldX(1, 4)).toBe(3.5);
    expect(fieldX(-0.2, 4)).toBeCloseTo(-0.8);
  });
});
