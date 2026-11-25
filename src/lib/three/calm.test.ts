import { describe, expect, it } from 'vitest';
import { DecorClock, IdleHold, SETTLE, calm } from './calm';

const dt = 1 / 30;

describe('less motion in the 3D world: where it asks', () => {
  it('asks the app shell every time, so turning it on or off counts at once', () => {
    let reduced = false;
    calm.follow(() => reduced);
    expect(calm.on).toBe(false);
    reduced = true;
    expect(calm.on).toBe(true);
    reduced = false;
    expect(calm.on).toBe(false);
    calm.follow(() => false);
  });
});

describe("the decorative clock (the island's idle loops, the title's camera sway)", () => {
  it("without less motion it keeps the stage's time, frame for frame", () => {
    const c = new DecorClock();
    let t = 0;
    for (const d of [1 / 60, 1 / 30, 0.05, 1 / 60, 0.0123]) {
      t += d;
      expect(c.step(d, false)).toBe(d);
      expect(c.t).toBe(t);
    }
  });

  it('with less motion it stands still', () => {
    const c = new DecorClock();
    for (let i = 0; i < 30; i++) c.step(dt, false);
    const held = c.t;
    for (let i = 0; i < 90; i++) expect(c.step(dt, true)).toBe(0);
    expect(c.t).toBe(held);
  });

  it('turned off again, it goes on from where it stood, with no jump', () => {
    const c = new DecorClock();
    for (let i = 0; i < 30; i++) c.step(dt, false);
    const held = c.t;
    for (let i = 0; i < 90; i++) c.step(dt, true);
    c.step(dt, false);
    expect(c.t).toBeCloseTo(held + dt, 12);
  });
});

describe("a buddy's moves (the title, the Shop, the Wardrobe, Home's buddy)", () => {
  it('without less motion every frame runs, standing or moving', () => {
    const h = new IdleHold();
    for (let i = 0; i < 200; i++) expect(h.step(dt, false, false)).toBe(dt);
    for (let i = 0; i < 20; i++) expect(h.step(dt, true, false)).toBe(dt);
    for (let i = 0; i < 20; i++) expect(h.step(dt, false, false)).toBe(dt);
  });

  it('with less motion, a buddy that only stands there holds its pose from the first frame', () => {
    const h = new IdleHold();
    for (let i = 0; i < 120; i++) expect(h.step(dt, false, true)).toBe(0);
  });

  it('with less motion, a move that shows something (a wave on a pick, a tickle) plays all the way', () => {
    const h = new IdleHold();
    let ran = 0;
    for (let i = 0; i < 45; i++) ran += h.step(dt, true, true);
    expect(ran).toBeCloseTo(45 * dt, 10);
  });

  it('after the move, the fade back to standing finishes, then the pose holds', () => {
    const h = new IdleHold();
    for (let i = 0; i < 45; i++) h.step(dt, true, true);
    let after = 0;
    for (let i = 0; i < 100 && h.step(dt, false, true) > 0; i++) after += dt;
    expect(after).toBeGreaterThanOrEqual(SETTLE - 1e-9);
    expect(after).toBeLessThan(SETTLE + 2 * dt);
    for (let i = 0; i < 60; i++) expect(h.step(dt, false, true)).toBe(0);
  });

  it('turned on while a buddy stands there, it lets the moment settle, then holds; turned off, it moves again', () => {
    const h = new IdleHold();
    for (let i = 0; i < 30; i++) h.step(dt, false, false);
    let after = 0;
    for (let i = 0; i < 100 && h.step(dt, false, true) > 0; i++) after += dt;
    expect(after).toBeLessThan(SETTLE + 2 * dt);
    expect(h.step(dt, false, true)).toBe(0);
    expect(h.step(dt, false, false)).toBe(dt);
  });
});
