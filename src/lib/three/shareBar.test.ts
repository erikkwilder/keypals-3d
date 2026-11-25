// Fair Shares' bar is one bar with lines on it until the knife cuts it (shareBar.ts). Erik, 2026-11-25: "it should
// look more like one chocolate bar with lines on it, not separate pieces from the start."
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ROUND, squareSize } from './shareBar';

describe("Fair Shares' chocolate bar", () => {
  it('lying in the bar, each square fills its place along it: neighbours touch, no gap', () => {
    const [x, y, z] = squareSize(40, 0);
    expect(x).toBe(40);
    expect(y).toBeLessThan(x); // (a flat bar)
    expect(z).toBeGreaterThan(30);
  });
  it("standing in a piece's tower on its plate, each square fills its place up it: one piece, no gap", () => {
    const [x, y, z] = squareSize(40, 1);
    expect(y).toBe(40);
    expect(z).toBeLessThan(y);
    expect(x).toBeGreaterThan(30);
  });
  it('the edges are only a little round, so two squares meet in a thin line (under a tenth of a square)', () => {
    expect(2 * ROUND).toBeLessThan(0.11);
  });
  it('the kit sizes every square this way, and a piece stacked on another stands on its full height', () => {
    const kit = readFileSync(new URL('./shareKit.ts', import.meta.url), 'utf8');
    expect(kit).toContain('q.m.scale.set(...squareSize(b!.sq * s, a.st ?? 0));');
    expect(kit).toContain('new RoundedBoxGeometry(1, 1, 1, 2, ROUND)');
    expect(kit).toContain('const on = g ? this.starts(b).ps[g.to] * b.sq * this.s + 0.002 : 0;');
    expect(kit).not.toMatch(/\* 0\.94/);
  });
});
