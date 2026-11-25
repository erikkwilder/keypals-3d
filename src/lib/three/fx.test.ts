import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Fx, type Emit } from './fx';
import { calm, FEW } from './calm';

// (no page here: the sparkles are painted on a canvas as the effects start, so a stand-in canvas takes every
// stroke and keeps nothing)
vi.hoisted(() => {
  const pen: unknown = new Proxy(() => {}, { get: (_t, k) => (k === Symbol.toPrimitive ? () => 0 : pen), apply: () => pen, set: () => true });
  const page = globalThis as { window?: unknown; document?: unknown };
  page.window ??= globalThis;
  page.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => pen }) };
});

const dt = 1 / 60;
type Bit = { alive: boolean; x: number; y: number; z: number; rot: number };
const inAir = (fx: Fx) => (fx as unknown as { ps: Bit[] }).ps.filter(p => p.alive);
const where = (fx: Fx) => inAir(fx).map(p => [p.x, p.y, p.z, p.rot].join());
const bolt = (fx: Fx) => (fx as unknown as { bolts: { mesh: THREE.Mesh }[] }).bolts[0].mesh;
const burst = (): Emit => ({ at: new THREE.Vector3(1, 2, 3), count: 30, shape: ['star', 'spark'], speed: [2, 6], life: [0.5, 1.1], gravity: 3, spin: 4, grow: 1, flutter: 2, radius: 0.1 });
/** less motion on (or off) for one go, then off as the tests start */
function calmly<T>(on: boolean, f: () => T): T { calm.follow(() => on); try { return f(); } finally { calm.follow(() => false); } }

describe('sparkles with less motion (a burst on a hit, a catch, a plant grown, a crate cracking)', () => {
  it('without less motion, a burst is as ever: all of it, flying out', () => {
    const fx = new Fx();
    fx.emit(burst());
    expect(inAir(fx).length).toBe(30);
    const was = where(fx);
    for (let i = 0; i < 10; i++) fx.update(dt, i * dt);
    expect(where(fx).filter((p, i) => p !== was[i]).length).toBe(30);
  });

  it("with less motion, a burst makes a few sparkles that stay where they're made, and fade there on time", () => calmly(true, () => {
    const fx = new Fx();
    fx.emit(burst());
    expect(inAir(fx).length).toBe(FEW);
    const was = where(fx);
    for (let i = 0; i < 30; i++) fx.update(dt, i * dt);
    expect(where(fx)).toEqual(was);
    for (let i = 0; i < 40; i++) fx.update(dt, i * dt);
    expect(inAir(fx).length).toBe(0);
  }));

  it('turned on while sparkles are in the air, they stop where they are', () => {
    const fx = new Fx();
    fx.emit(burst());
    for (let i = 0; i < 5; i++) fx.update(dt, i * dt);
    calmly(true, () => {
      const was = where(fx);
      for (let i = 0; i < 10; i++) fx.update(dt, i * dt);
      expect(where(fx)).toEqual(was);
    });
  });
});

describe('lightning with less motion (a Grumble arriving, a power)', () => {
  const from = new THREE.Vector3(0, 3, 0), to = new THREE.Vector3(1, 0, 0);
  function watch(fx: Fx) {
    const m = bolt(fx), mat = m.material as THREE.MeshBasicMaterial, seen: { on: boolean; a: number }[] = [];
    for (let i = 0; i < 26; i++) { fx.update(dt, i * dt); seen.push({ on: m.visible, a: mat.opacity }); }
    return seen;
  }

  it('without less motion it flickers out, as ever', () => {
    const fx = new Fx();
    fx.lightning(from, to);
    const seen = watch(fx);
    const flips = seen.filter((s, i) => i && s.on !== seen[i - 1].on).length;
    expect(flips).toBeGreaterThanOrEqual(4);
  });

  it("with less motion it doesn't flicker or flash: it shows all its time, coming and going softly", () => calmly(true, () => {
    const fx = new Fx();
    fx.lightning(from, to);
    const seen = watch(fx);
    expect(seen.every(s => s.on)).toBe(true);
    expect(Math.max(...seen.map(s => s.a))).toBeLessThanOrEqual(0.5);
    for (let i = 1; i < seen.length; i++) expect(Math.abs(seen[i].a - seen[i - 1].a)).toBeLessThan(0.1);
  }));
});

describe('a power flying to the Grumble, with less motion', () => {
  function fly(on: boolean) {
    return calmly(on, () => {
      const fx = new Fx();
      let hitAt = -1, t = 0, trail = 0;
      fx.fly(new THREE.Vector3(0, 1, 0), new THREE.Vector3(3, 1, 0), { color: 0xffffff, size: 0.3, time: 0.45, arc: 0.8, trail: at => ({ at: at.clone(), count: 2, life: [2, 2] }), hit: () => { hitAt = t; } });
      for (let i = 0; i < 60 && hitAt < 0; i++) { t += dt; fx.update(dt, t); trail = Math.max(trail, inAir(fx).length); }
      return { hitAt, trail };
    });
  }

  it('it still flies and hits on time (the battle waits on it), with no trail behind it', () => {
    const full = fly(false), still = fly(true);
    expect(still.hitAt).toBeGreaterThan(0);
    expect(still.hitAt).toBe(full.hitAt);
    expect(full.trail).toBeGreaterThan(0);
    expect(still.trail).toBe(0);
  });
});
