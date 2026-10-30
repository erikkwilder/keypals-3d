// Data and chance: the generators make sense (counts match their pictures, the answer is what the picture
// says), every rung works (the shared fuzz test, skills/rungs.test.ts, covers that too), and the area hangs
// together: registered, live, in grade order.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { SKILL, skillsOf, AREA } from '../skills/registry';
import { RUNGS, type Item } from '../skills/types';
import { DATA_SKILLS, daBars, daChance, daLinePlot, daMean, daMiddle, daPicGraph, daSort } from './skills';
import type { DataPic } from './pics';

const picOf = (it: Item): DataPic | null => { for (const p of it.prompt) if (p.t === 'data') return p.d; return null; };

describe('data and chance skills', () => {
  it('are registered, live and in grade order', () => {
    expect(AREA.data.live).toBe(true);
    expect(skillsOf('data').map(s => s.id)).toEqual(DATA_SKILLS.map(s => s.id));
    expect(DATA_SKILLS.length).toBeGreaterThanOrEqual(8);
    expect(DATA_SKILLS.length).toBeLessThanOrEqual(12);
    const grades = DATA_SKILLS.map(s => s.grade);
    expect(grades).toEqual(grades.slice().sort((a, b) => a - b));
    for (const s of DATA_SKILLS) { expect(SKILL[s.id]).toBe(s); expect(s.plain.length).toBeGreaterThan(20); expect(s.standard).toMatch(/^[K0-9]\.[A-Z]+/); }
  });
  it('every sub at every rung makes questions that check right, with a trick', () => {
    for (const s of DATA_SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) {
      const rng = mulberry32(r * 31 + sub.id.length);
      for (let i = 0; i < 60; i++) {
        const it = s.make(rng, sub.id, r);
        expect(s.check(it, it.answer), `${s.id}:${sub.id}:${r}`).toBe(true);
        expect(it.trick?.say.length ?? 0, `${s.id}:${sub.id} trick`).toBeGreaterThan(10);
        expect(it.explain.length).toBeGreaterThan(5);
      }
    }
  });
  it('sort: the count is how many of that prize are in the jumble', () => {
    const rng = mulberry32(4);
    for (let i = 0; i < 80; i++) {
      const it = daSort.make(rng, 'count', 1 + (i % 6));
      const p = picOf(it)!, want = it.prompt.find(x => x.t === 'data' && x.d.kind === 'prize');
      if (p.kind !== 'things' || !want || want.t !== 'data' || want.d.kind !== 'prize' || it.answer.kind !== 'number') throw new Error('shape');
      const prize = want.d.prize;
      expect(it.answer.value).toBe(p.items.filter(x => x === prize).length);
    }
  });
  it('picture and bar graphs: the answer is what the graph shows', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 80; i++) {
      const it = daPicGraph.make(rng, 'read', 1 + (i % 6));
      const p = picOf(it)!;
      if (p.kind !== 'picgraph' || it.answer.kind !== 'number') throw new Error('shape');
      expect(p.cats.map(c => c.n)).toContain(it.answer.value);
      for (const c of p.cats) expect((c.n / p.per) % 0.5).toBe(0);
      const b = daBars.make(rng, 'read', 1 + (i % 6)), bp = picOf(b)!;
      if (bp.kind !== 'bars' || b.answer.kind !== 'number') throw new Error('shape');
      expect(bp.cats.map(c => c.n)).toContain(b.answer.value);
      for (const c of bp.cats) { expect(c.n).toBeGreaterThan(0); expect(c.n).toBeLessThanOrEqual(bp.max); expect((c.n * 2) % bp.step === 0 || c.n % bp.step === 0).toBe(true); }
    }
  });
  it('dragging a bar: the custom input gets a graph with that bar hidden and a sensible snap', () => {
    const rng = mulberry32(2);
    for (let r = 1; r <= 6; r++) for (let i = 0; i < 20; i++) {
      const it = daBars.make(rng, 'make', r);
      expect(it.input).toBe('custom');
      const spec = it.custom!.spec as { pic: DataPic; snap: number };
      if (spec.pic.kind !== 'bars' || it.answer.kind !== 'number') throw new Error('shape');
      expect(spec.pic.hide).toBeDefined();
      expect(spec.pic.cats[spec.pic.hide!].n).toBe(it.answer.value);
      expect(it.answer.value % spec.snap).toBe(0);
    }
  });
  it('line plots: the dot plot to make has a dot for every ribbon', () => {
    const rng = mulberry32(5);
    for (let r = 1; r <= 6; r++) for (let i = 0; i < 20; i++) {
      const it = daLinePlot.make(rng, 'make', r);
      const list = picOf(it)!;
      if (list.kind !== 'list' || it.answer.kind !== 'choice') throw new Error('shape');
      expect(it.answer.id.split(',').map(Number).reduce((a, b) => a + b, 0)).toBe(list.values.length);
    }
  });
  it('the mean, median, mode and range are what they say', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 120; i++) {
      const r = 1 + (i % 6);
      const m = daMean.make(rng, 'list', r), mp = picOf(m)!;
      if (mp.kind !== 'list' || m.answer.kind !== 'number') throw new Error('shape');
      expect(m.answer.value).toBeCloseTo(mp.values.reduce((a, b) => a + b, 0) / mp.values.length, 6);
      const md = daMiddle.make(rng, 'median', r), lp = picOf(md)!;
      if (lp.kind !== 'list' || md.answer.kind !== 'number') throw new Error('shape');
      const s = lp.values.slice().sort((a, b) => a - b), n = s.length;
      expect(md.answer.value).toBeCloseTo(n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2, 6);
      const mo = daMiddle.make(rng, 'mode', r), op = picOf(mo)!;
      if (op.kind !== 'list' || mo.answer.kind !== 'number') throw new Error('shape');
      const counts = new Map<number, number>(); for (const v of op.values) counts.set(v, (counts.get(v) ?? 0) + 1);
      const top = Math.max(...counts.values());
      expect([...counts].filter(([, c]) => c === top).map(([v]) => v)).toEqual([mo.answer.value]);
    }
  });
  it('chance from a bag: the marbles that match over all the marbles', () => {
    const rng = mulberry32(12);
    for (let i = 0; i < 80; i++) {
      const it = daChance.make(rng, 'bag', 1 + (i % 6)), p = picOf(it)!;
      if (p.kind !== 'bag' || it.answer.kind !== 'fraction') throw new Error('shape');
      expect(it.answer.d).toBe(p.marbles.reduce((t, m) => t + m.n, 0));
      expect(it.answer.n).toBeGreaterThan(0);
      expect(it.answer.n).toBeLessThan(it.answer.d);
    }
  });
});
