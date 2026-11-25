import { readdirSync, readFileSync } from 'node:fs';
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

describe('sparkles that come all the time, with less motion (a torch, the motes, rain from a cloud)', () => {
  const torch = (): Emit => ({ at: new THREE.Vector3(0, 1, 0), count: 2, shape: ['dot', 'spark'], dir: new THREE.Vector3(0, 1, 0), spread: 0.25, speed: [0.5, 1.2], life: [0.6, 0.6], steady: true });
  it('without less motion they come as ever, frame after frame, as any sparkle does', () => {
    const a = new Fx(), b = new Fx();
    for (let i = 0; i < 30; i++) { a.emit(torch()); b.emit({ ...torch(), steady: undefined }); a.update(dt, i * dt); b.update(dt, i * dt); }
    expect(inAir(a).length).toBe(60);
    expect(inAir(b).length).toBe(60);
  });
  it('with less motion none come, so nothing pops in and out where they would be', () => calmly(true, () => {
    const fx = new Fx();
    for (let i = 0; i < 60; i++) { fx.emit(torch()); fx.update(dt, i * dt); }
    expect(inAir(fx).length).toBe(0);
  }));
  it('turned on, the ones in the air fade on time and no new ones come; turned off, they come again', () => {
    const fx = new Fx();
    for (let i = 0; i < 10; i++) { fx.emit(torch()); fx.update(dt, i * dt); }
    expect(inAir(fx).length).toBe(20);
    calmly(true, () => {
      fx.emit(torch());
      expect(inAir(fx).length).toBe(20);
      for (let i = 0; i < 40; i++) { fx.emit(torch()); fx.update(dt, i * dt); }
      expect(inAir(fx).length).toBe(0);
    });
    fx.emit(torch());
    expect(inAir(fx).length).toBe(2);
  });
  it('a burst made once still makes its few (a hit, a find, a cheer)', () => calmly(true, () => {
    const fx = new Fx();
    fx.emit(burst());
    expect(inAir(fx).length).toBe(FEW);
  }));
  it('every place that makes them again and again says so', () => {
    const dir = new URL('.', import.meta.url);
    const files = (readdirSync(dir, { recursive: true }) as string[]).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const src = (f: string) => readFileSync(new URL(f, dir), 'utf8');
    // (a chance each frame: the duel's ghosts and rain, the golden flower, the garden's watering, the Sky Island's pals,
    // visitors and golden butterfly, the island growing, its secrets, the Glimmer show)
    let rolled = 0;
    for (const f of files) for (const line of src(f).split('\n')) if (/Math\.random\(\) < dt/.test(line) && line.includes('.emit({')) { rolled++; const rest = line.slice(line.indexOf('Math.random() < dt')); expect(rest.slice(rest.indexOf('.emit({')), f).toMatch(/^\.emit\(\{ steady: true, /); }
    expect(rolled).toBeGreaterThanOrEqual(17);
    // (by a timer or every frame: torches, motes, a Glimmer's aura, the dust in a lesson's sunbeams, a pal's ripples, zzz and hops, the sled's spray and turbo)
    const timed: [string, string][] = [
      ['arena.ts', 'for (const f of a.fires) fx.emit({ steady: true, '],
      ['battleScene.ts', 'for (const f of this.fires) this.fx.emit({ steady: true, '],
      ['battleScene.ts', 'this.moteT = 0.12; this.fx.emit({ steady: true, '],
      ['duelScene.ts', 'this.moteT = 0.12; this.fx.emit({ steady: true, '],
      ['glimmerModel.ts', 'this.fx.emit({ steady: true, at: w.add('],
      ['glimmerShow.ts', "this.fx.emit({ steady: true, at: from, count: 1, shape: ['star', 'spark', 'dot']"],
      ['episodeScene.ts', 'this.fx.emit({ steady: true, at: new THREE.Vector3((Math.random() - 0.5) * 4, TY + 0.3'],
      ['islandScene.ts', 'p.zzz = 0.5; this.fx.emit({ steady: true, '],
      ['islandScene.ts', 'p.zzz = 0.9; this.fx.emit({ steady: true, '],
      ['islandScene.ts', 'if (Math.random() < 0.5) this.fx.emit({ steady: true, '],
      ['arcade/slalom.ts', 'this.spray(3 + Math.floor(this.speed / 12), 0, true)'],
      ['arcade/slalom.ts', "this.fx.emit({ at: w, count: n, steady, shape: ['dot', 'flake']"],
      ['arcade/slalom.ts', 'this.fx.emit({ steady: true, at: w, count: 3, '],
    ];
    for (const [f, bit] of timed) expect(src(f), f).toContain(bit);
  });
});
