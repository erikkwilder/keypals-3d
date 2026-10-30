// Every generator on every rung: 200 items of every sub at rungs 1 to 6 make without throwing, and each
// one checks right with its own answer. Plus the things a picture or input needs to make sense, and a
// check that the rungs really differ.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { SKILLS } from './registry';
import { RUNGS, rungOf, type Item } from './types';

function sane(it: Item, where: string) {
  expect(it.prompt.length, where).toBeGreaterThan(0);
  expect(it.weight, where).toBeGreaterThanOrEqual(1);
  expect(it.weight, where).toBeLessThanOrEqual(5);
  const a = it.answer;
  // (negative answers only where the pad has its minus key: `signed`)
  if (a.kind === 'number') { expect(Number.isFinite(a.value), where).toBe(true); if (!it.signed && !it.skill.startsWith('al-')) expect(a.value, where).toBeGreaterThanOrEqual(0); expect(String(a.value).split('.')[1] ?? '', where).not.toMatch(/0000|9999/); }
  if (a.kind === 'fraction') { expect(a.d, where).toBeGreaterThan(0); expect(a.n, where).toBeGreaterThan(0); expect(Number.isInteger(a.n) && Number.isInteger(a.d), where).toBe(true); }
  if (a.kind === 'choice') expect(it.choices?.some(c => c.id === a.id), where).toBe(true);
  if (a.kind === 'point' && it.line) {
    expect(a.x, where).toBeGreaterThan(it.line.min);
    expect(a.x, where).toBeLessThan(it.line.max);
    const ticks = (a.x - it.line.min) / it.line.step;
    expect(Math.abs(ticks - Math.round(ticks)), where).toBeLessThan(1e-6);
  }
  for (const p of it.prompt) {
    if (p.t === 'pic' && p.pic.kind !== 'coins') { expect(p.pic.filled, where).toBeGreaterThan(0); expect(p.pic.filled, where).toBeLessThanOrEqual(p.pic.parts); }
    if (p.t === 'pic' && p.pic.kind === 'coins') expect(p.pic.coins.length, where).toBeGreaterThan(0);
    if (p.t === 'blocks') for (const v of [p.b.h, p.b.t, p.b.o]) { expect(Number.isInteger(v) && v >= 0, where).toBe(true); }
  }
  if (it.custom?.name === 'coins') expect((it.custom.spec as { coins: number[] }).coins).toContain(1);
}

describe('rungs: every generator, every sub, every rung', () => {
  it('makes 200 items that check right with their own answer', () => {
    let made = 0;
    for (const s of SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) {
      const rng = mulberry32(1000 + r * 97 + sub.id.length * 13 + s.id.length);
      for (let i = 0; i < 200; i++) {
        const where = `${s.id}:${sub.id} rung ${r} #${i}`;
        const it = s.make(rng, sub.id, r);
        expect(s.check(it, it.answer), where).toBe(true);
        expect(it.skill, where).toBe(s.id);
        if (!s.facts) expect(it.key, where).toBe(`${s.id}:${sub.id}`);
        sane(it, where);
        made++;
      }
    }
    expect(made).toBe(SKILLS.reduce((t, s) => t + s.subs.length, 0) * RUNGS * 200);
  }, 60_000); // (every area's every sub at every rung: it grows with each area)
  it('never loops: a stuck random source still makes a question at once, on every rung', () => {
    for (const v of [0, 0.37, 0.5, 0.999999]) for (const s of SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) {
      const it = s.make(() => v, sub.id, r);
      expect(s.check(it, it.answer), `${s.id}:${sub.id} rung ${r} @${v}`).toBe(true);
    }
  });
  it('the rungs really differ: the top rung asks things the bottom one never does', () => {
    for (const s of SKILLS.filter(x => !x.facts)) {
      const ids = (r: number) => { const rng = mulberry32(5 + r), out = new Set<string>(); for (const sub of s.subs) for (let i = 0; i < 150; i++) out.add(s.make(rng, sub.id, r).id); return out; };
      const low = ids(1), high = ids(6);
      const shared = [...high].filter(x => low.has(x)).length / high.size;
      expect(shared, s.id).toBeLessThan(0.5);
    }
  });
  it('old saves\' levels come in as rungs, and odd numbers are clamped', () => {
    expect(rungOf(1)).toBe(1); expect(rungOf(2)).toBe(2); expect(rungOf(0)).toBe(1); expect(rungOf(9)).toBe(6); expect(rungOf(3.4)).toBe(3); expect(rungOf(NaN)).toBe(1);
  });
});
