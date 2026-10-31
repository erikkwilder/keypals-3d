import { describe, expect, it } from 'vitest';
import { separate, type Card } from './cardLayout';

const clash = (a: Card, b: Card) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
const moved = (cs: Card[], page: { w: number; h: number }) => separate(cs, page).map((o, i) => ({ ...cs[i], x: cs[i].x + o.dx, y: cs[i].y + o.dy }));

describe('word cards', () => {
  const page = { w: 1280, h: 720 };
  it('a thought under the narrator moves and the narrator stays', () => {
    const dock = { x: 240, y: 60, w: 800, h: 90, give: 0 }, thought = { x: 700, y: 120, w: 150, h: 50, give: 1 };
    const [a, b] = moved([dock, thought], page);
    expect(a.x).toBe(240); expect(a.y).toBe(60);
    expect(clash(a, b)).toBe(false);
  });
  it('a heavy count gives way less than a light word', () => {
    const count = { x: 600, y: 300, w: 100, h: 60, give: 0.2 }, word = { x: 640, y: 320, w: 110, h: 30, give: 1 };
    const o = separate([count, word], page);
    expect(Math.hypot(o[0].dx, o[0].dy)).toBeLessThan(Math.hypot(o[1].dx, o[1].dy));
  });
  it('cards never end up on each other, on a laptop or a phone, however they start', () => {
    let seed = 7;
    const r = (n: number) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * n; };
    for (const p of [page, { w: 390, h: 844 }]) for (let run = 0; run < 200; run++) {
      const cs: Card[] = [{ x: 0, y: 60, w: p.w, h: 90, give: 0 }];
      for (let i = 0; i < 6; i++) cs.push({ x: p.w * 0.2 + r(p.w * 0.5), y: 200 + r(250), w: 40 + r(90), h: 30 + r(24), give: i % 2 ? 1 : 0.3 });
      const out = moved(cs, p);
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(clash(out[i], out[j]), `run ${run}: ${i} and ${j}`).toBe(false);
    }
  });
});
