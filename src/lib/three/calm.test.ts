import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { DecorClock, HeldClock, IdleHold, LAND, SETTLE, calm, easeTo, moveOver, shakeOf } from './calm';

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

describe("a Glimmer's own clock (the Grumble's, its cloud's and the team's in a battle)", () => {
  it("without less motion it is the stage's time, frame for frame, standing there or moving", () => {
    const c = new HeldClock();
    let t = 3.21;
    for (const [d, busy] of [[1 / 60, false], [1 / 30, true], [0.05, false], [0.0123, false]] as const) {
      t += d;
      expect(c.step(d, t, busy, false)).toBe(d);
      expect(c.t).toBe(t);
    }
  });

  it('with less motion, while it only stands there, it stands still (from its first frame, at the stage\'s time)', () => {
    const c = new HeldClock();
    let t = 10;
    expect(c.step(dt, (t += dt), false, true)).toBe(0);
    expect(c.t).toBe(t);
    const held = c.t;
    for (let i = 0; i < 90; i++) expect(c.step(dt, (t += dt), false, true)).toBe(0);
    expect(c.t).toBe(held);
  });

  it('a move runs on it as ever; back to standing, it runs on while the fade finishes, then holds', () => {
    const c = new HeldClock();
    let t = 0;
    c.step(dt, (t += dt), false, true);
    const before = c.t;
    for (let i = 0; i < 10; i++) expect(c.step(dt, (t += dt), true, true)).toBe(dt);
    expect(c.t).toBeCloseTo(before + 10 * dt, 9);
    let ran = 0;
    for (let i = 0; i < 60; i++) ran += c.step(dt, (t += dt), false, true);
    expect(ran).toBeGreaterThanOrEqual(SETTLE - 1e-9);
    expect(ran).toBeLessThanOrEqual(SETTLE + dt + 1e-9);
    const held = c.t;
    expect(c.step(dt, (t += dt), false, true)).toBe(0);
    expect(c.t).toBe(held);
  });

  it('turned off, it goes on from where it held, with no jump', () => {
    const c = new HeldClock();
    let t = 100;
    for (let i = 0; i < 40; i++) c.step(dt, (t += dt), false, true);
    const held = c.t;
    // (the stage went on for over a second meanwhile)
    expect(t - held).toBeGreaterThan(1);
    expect(c.step(dt, (t += dt), false, false)).toBe(dt);
    expect(c.t).toBeCloseTo(held + dt, 9);
    c.step(dt, (t += dt), false, false);
    expect(c.t).toBeCloseTo(held + 2 * dt, 9);
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

describe('turned on while the title plays, it counts at once', () => {
  it("a dance played now and then for its own sake ends at once; one that shows something plays to its end", () => {
    // (a dance until 8 s, at 3 s)
    expect(moveOver(3, 8, true, true)).toBe(true);
    expect(moveOver(3, 8, false, true)).toBe(false);
    expect(moveOver(8.01, 8, false, true)).toBe(true);
  });

  it('without less motion every dance plays to its end, as ever', () => {
    for (const forFun of [true, false]) {
      expect(moveOver(3, 8, forFun, false)).toBe(false);
      expect(moveOver(8, 8, forFun, false)).toBe(false);
      expect(moveOver(8.01, 8, forFun, false)).toBe(true);
    }
  });

  it('a title buddy mid-dance stands still within a second of less motion coming on', () => {
    const h = new IdleHold();
    let t = 0, dancing = true, after = 0;
    for (let i = 0; i < 300; i++) {
      t += dt;
      const on = t >= 2;
      if (dancing && moveOver(t, 8, true, on)) dancing = false;
      const d = h.step(dt, dancing, on);
      if (on) after += d;
    }
    // the fade back to standing, then it holds: not the 6 s left of the dance
    expect(after).toBeLessThan(SETTLE + 2 * dt);
  });

  const k = 1 - Math.exp(-dt * 3);

  it("without less motion the camera eases exactly as before, frame for frame", () => {
    const a = new Vector3(0.4, 1.2, 3), b = a.clone(), want = new Vector3(1, 0.5, -2);
    for (let i = 0; i < 120; i++) {
      easeTo(a, want, k, false); b.lerp(want, k);
      expect(a.equals(b)).toBe(true);
    }
  });

  it("with less motion, when the title's sway stops, the camera stands still within a fraction of a second", () => {
    // it trails its sway by about 3.6 cm; the sway stops where it is
    const at = new Vector3(0.036, 0, 0), want = new Vector3(0, 0, 0);
    let frames = 0;
    while (!at.equals(want) && frames < 300) { easeTo(at, want, k, true); frames++; }
    expect(frames * dt).toBeLessThan(0.3);
    easeTo(at, want, k, true);
    expect(at.equals(want)).toBe(true);
  });

  it('with less motion, a move that shows something (to the buddy just picked) eases as before, but for its last bit', () => {
    const at = new Vector3(), as = new Vector3(), want = new Vector3(1.2, 0, 0.3);
    for (let i = 0; i < 200 && as.distanceTo(want) >= LAND; i++) {
      easeTo(at, want, k, true); as.lerp(want, k);
      if (as.distanceTo(want) >= LAND) expect(at.equals(as)).toBe(true);
    }
    easeTo(at, want, k, true);
    expect(at.equals(want)).toBe(true);
  });
});

describe('shakes (the camera on a hit, the mat, the beam, the tray, the crate on a wrong answer)', () => {
  it('without less motion a shake is as big as ever', () => {
    for (const k of [0, 0.1, 0.35, 1]) expect(shakeOf(k)).toBe(k);
  });

  it("with less motion there's no shake, whatever its size (its timer, and what waits on it, run as ever)", () => {
    calm.follow(() => true);
    for (const k of [0, 0.1, 0.35, 1]) expect(shakeOf(k)).toBe(0);
    calm.follow(() => false);
  });
});

// (these scenes need a page and its 3D to run, so this reads them: each idle loop is set from the clock)
describe("the Sky Island's and the garden's idle loops go by the decorative clock (still with less motion)", () => {
  const scene = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8').split('\n');
  const line = (lines: string[], has: string) => {
    const found = lines.filter(x => x.includes(has));
    expect(found.length, has).toBe(1);
    return found[0];
  };

  it('the Sky Island: the floating things, the butterflies, the heart and the wish, the present, the whole-island sway', () => {
    const s = scene('./islandScene.ts');
    for (const has of ['for (const f of this.floaters) f.o.position.y', 'b.sp + b.ph, p = new THREE.Vector3(Math.cos(tt * 0.6) * b.rad', 'b.l.rotation.z = -flap',
      'p.heart.position.copy', 'p.wish.position.copy', 'v.present.rotation.y', 'c.yaw = Math.sin']) expect(line(s, has), has).toContain('stage.decorT');
    // the marker and the ghost show where a thing goes: they pulse as ever
    expect(line(s, 'if (this.ghost) { this.ghost.obj.position.y')).not.toContain('decorT');
  });

  it("the garden: the plants in the wind, the drops, the butterflies, the golden flower's sway", () => {
    const s = scene('./gardenScene.ts');
    for (const has of ['this.u.uT.value =', 'this.drops!.mesh.setMatrixAt', 'this.butterflyFly(', 'top.rotation.y = Math.sin']) expect(line(s, has), has).toContain('stage.decorT');
    // the ring round what's picked shows it: it turns as ever
    expect(line(s, 'if (this.ring.visible)')).not.toContain('decorT');
  });
});
