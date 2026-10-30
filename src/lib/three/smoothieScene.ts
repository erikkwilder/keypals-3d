// Smoothie Stand in 3D: a see-through renderer of its own over the painted jungle stand (the game happens
// at a counter, not on an island). A blender stands on the counter: tapped fruit drops into its glass jug
// with a bounce and a plop, piling up in rings; Blend spins them into a smoothie the colour of its mix, which
// pours into a glass that slides across to the customer, who cheers. Up to three Glimmer customers wait
// behind the counter. Fruit are the Learn episodes' own 3D fruit (fruitShapes.ts).
import * as THREE from 'three';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { fruitExtraMat, fruitGeo, fruitMats } from './fruitShapes';
import { ELEMENT, GLIMMER, type GlimmerId } from '../adventure/glimmers';
import type { Fruit } from '../math/skills/ratioPic';

const CUST_Z = -1.6;
const JAR_Y = 0.42, JAR_H = 1.3, JAR_R = 0.56;
/** a fruit's size in the jug */
const FS = 0.13;
type FruitM = { g: THREE.Group; f: Fruit; at: THREE.Vector3; from: THREE.Vector3; t: number; spin: number; out: number };
type Cust = { model: GlimmerModel; slot: number; x: number; from: number; t: number; leaving: boolean };
type Cup = { g: THREE.Group; liquid: THREE.Mesh; t: number; from: THREE.Vector3; to: THREE.Vector3 };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const bounce = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k < 0.72 ? Math.pow(k / 0.72, 2) : 1 - Math.sin(((k - 0.72) / 0.28) * Math.PI) * 0.1; };
const lathe = (pts: number[][], n = 40) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);

export class SmoothieScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private blender = new THREE.Group();
  private jug = new THREE.Group();
  private liquid!: THREE.Mesh;
  private liquidMat!: THREE.MeshPhysicalMaterial;
  private fx = new Fx();
  private fruit: FruitM[] = [];
  private mats = new Map<string, THREE.Material>();
  private geos = new Map<string, { main: THREE.BufferGeometry; extra: THREE.BufferGeometry | null }>();
  private cust: (Cust | null)[] = [null, null, null];
  private gone: Cust[] = [];
  private cups: Cup[] = [];
  private raf = 0; private last = 0; private t = 0;
  private w = 1; private h = 1;
  tall = false;
  private slotX = [-2.1, 0, 2.1];
  private disposed = false;
  /** the blend: when it started, how full it gets, and what happens after */
  private blendT = -1; private level = 0; private shakeT = 0; private drainT = -1;
  private onBlended: (() => void) | null = null;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // a sunny jungle afternoon: warm sun from the left, sky above, leafy bounce from below
    this.scene.add(new THREE.HemisphereLight(0xfff4dc, 0x7a9a4a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
    sun.position.set(-3, 7, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffd79a, 1.0); rim.position.set(3, 3, -4); this.scene.add(rim);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.01; catcher.receiveShadow = true;
    this.scene.add(catcher);
    this.buildBlender();
    this.scene.add(this.blender, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement): Promise<SmoothieScene> {
    const s = new SmoothieScene(canvas);
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  private mat(key: string, make: () => THREE.Material) { let m = this.mats.get(key); if (!m) { m = make(); this.mats.set(key, m); } return m; }

  /** A chunky copper blender: a base with a dial and buttons, a glass jug with a handle and a lid. */
  private buildBlender() {
    const copper = new THREE.MeshPhysicalMaterial({ color: 0xd9773a, metalness: 0.55, roughness: 0.28, clearcoat: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x3b3340, roughness: 0.4 });
    const base = new THREE.Mesh(lathe([[0, 0], [0.62, 0], [0.66, 0.06], [0.6, 0.38], [0.52, 0.42], [0, 0.42]]), copper);
    base.castShadow = true; base.receiveShadow = true;
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfff6e8, roughness: 0.3 }));
    dial.position.set(0, 0.2, 0.62);
    const btns = [0xff6b8a, 0x4fcf9f, 0xffd36b].map((c, i) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 10), new THREE.MeshStandardMaterial({ color: c, roughness: 0.3, emissive: c, emissiveIntensity: 0.25 })); b.position.set(-0.22 + i * 0.22, 0.08, 0.6); b.scale.z = 0.6; return b; });
    this.blender.add(base, dial, ...btns);
    // the jug: thick clear glass, a handle, a lid, and the smoothie inside it
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.04, transmission: 0.55, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
    const jugGeo = lathe([[JAR_R * 0.78, 0], [JAR_R * 0.84, 0.03], [JAR_R, JAR_H * 0.92], [JAR_R * 1.04, JAR_H], [JAR_R * 0.98, JAR_H], [JAR_R * 0.94, JAR_H * 0.92], [JAR_R * 0.78, 0.04]]);
    const jug = new THREE.Mesh(jugGeo, glass);
    jug.renderOrder = 5;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 24, Math.PI), glass);
    handle.rotation.z = -Math.PI / 2; handle.position.set(JAR_R + 0.04, JAR_H * 0.55, 0);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(JAR_R * 1.06, JAR_R * 1.06, 0.08, 32), dark);
    lid.position.y = JAR_H + 0.04; lid.castShadow = true;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 16), dark); knob.position.y = JAR_H + 0.12;
    this.liquidMat = new THREE.MeshPhysicalMaterial({ color: 0xffb0c4, roughness: 0.45, clearcoat: 0.4, emissive: 0xffffff, emissiveIntensity: 0.05 });
    this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(JAR_R * 0.95, JAR_R * 0.8, 1, 32).translate(0, 0.5, 0), this.liquidMat);
    this.liquid.position.y = 0.04; this.liquid.scale.y = 0.001; this.liquid.visible = false;
    this.jug.add(this.liquid, jug, handle, lid, knob);
    this.jug.position.y = JAR_Y;
    this.blender.add(this.jug);
  }

  /** where fruit number i rests in the jug: rings of six, each ring a little higher and turned */
  private spotFor(i: number) {
    const layer = Math.floor(i / 6), k = i % 6, a = (k / 6) * Math.PI * 2 + layer * 0.55;
    const rr = JAR_R * (0.5 + (layer % 2) * 0.08);
    return new THREE.Vector3(Math.cos(a) * rr, JAR_Y + 0.13 + layer * 0.2 + (k % 2) * 0.04, Math.sin(a) * rr);
  }
  private fruitMesh(f: Fruit) {
    let g = this.geos.get(f);
    if (!g) { g = fruitGeo(f); this.geos.set(f, g); }
    const grp = new THREE.Group();
    const m = new THREE.Mesh(g.main, fruitMats(f, 'a', false, (k, mk) => this.mat(k, mk)));
    m.castShadow = true; grp.add(m);
    if (g.extra) grp.add(new THREE.Mesh(g.extra, fruitExtraMat(f, (k, mk) => this.mat(k, mk))));
    grp.scale.setScalar(FS);
    return grp;
  }

  /** A fruit drops into the jug. */
  addFruit(f: Fruit) {
    if (this.blendT >= 0) return;
    const g = this.fruitMesh(f);
    const at = this.spotFor(this.fruit.length);
    const from = at.clone().add(new THREE.Vector3(0, 1.6, 0.3));
    g.position.copy(from); g.rotation.set(Math.random() * 6, Math.random() * 6, 0);
    this.blender.add(g);
    this.fruit.push({ g, f, at, from, t: 0, spin: 4 + Math.random() * 4, out: -1 });
  }
  /** Take the last one of this fruit back out (or the last of any). */
  takeFruit(f?: Fruit): boolean {
    if (this.blendT >= 0) return false;
    let i = -1;
    for (let k = this.fruit.length - 1; k >= 0; k--) if (!f || this.fruit[k].f === f) { i = k; break; }
    if (i < 0) return false;
    const x = this.fruit.splice(i, 1)[0];
    x.out = 0; x.from = x.g.position.clone(); this.leaving.push(x);
    this.fruit.forEach((k, j) => { k.from = k.g.position.clone(); k.at = this.spotFor(j); k.t = Math.min(k.t, 0.5); });
    return true;
  }
  private leaving: FruitM[] = [];
  /** Empty the jug. */
  clear() { while (this.takeFruit()) { /* one at a time */ } this.liquid.visible = false; this.liquid.scale.y = 0.001; this.blendT = -1; this.drainT = -1; }
  /** Fill the jug with these straight away (an order that starts with some fruit in). */
  fill(f: Fruit, n: number) { for (let i = 0; i < n; i++) { this.addFruit(f); const k = this.fruit[this.fruit.length - 1]; k.t = 0.6 + i * 0.02; } }
  get count() { return this.fruit.length; }

  /** Blend it: the fruit whirls into a smoothie of this colour; `ok`: it pours into a glass for the customer
   *  at `slot` (then `done`), else the jug sputters and the fruit stays. */
  blend(color: string, ok: boolean, slot: number | null, done: () => void) {
    if (this.blendT >= 0) return;
    if (!ok) { this.shakeT = 0.6; this.fx.emit({ at: this.blender.localToWorld(new THREE.Vector3(0, JAR_Y + JAR_H * 0.6, 0)), count: 10, shape: 'dot', color: [0xffffff, 0xd9d4cc], speed: [0.4, 1], life: [0.3, 0.6], size: [0.04, 0.08], up: 0.6 }); done(); return; }
    this.blendT = 0;
    this.level = Math.min(0.9, 0.25 + this.fruit.length * 0.028);
    this.liquidMat.color.set(color); this.liquidMat.emissive.set(color); this.liquidMat.emissiveIntensity = 0.32;
    this.liquid.visible = true; this.liquid.scale.y = 0.001;
    this.onBlended = () => { this.pour(color, slot); done(); };
  }
  /** a glass of the smoothie slides across to the customer */
  private pour(color: string, slot: number | null) {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(lathe([[0.16, 0], [0.2, 0.02], [0.24, 0.62], [0.23, 0.62], [0.19, 0.03], [0.16, 0.02]]), new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.05, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.17, 0.5, 24).translate(0, 0.27, 0), new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.4, emissive: color, emissiveIntensity: 0.12 }));
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x4fc3f7, roughness: 0.4 }));
    straw.position.set(0.06, 0.6, 0); straw.rotation.z = -0.3;
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshPhysicalMaterial({ color: 0xe3263c, roughness: 0.3, clearcoat: 0.8 }));
    berry.position.set(-0.2, 0.64, 0);
    g.add(liquid, glass, straw, berry);
    for (const m of [liquid, straw, berry]) m.castShadow = true;
    const from = this.blender.localToWorld(new THREE.Vector3(this.tall ? 1.1 : -1.15, 0, 0.25));
    const c = slot !== null ? this.cust[slot] : null;
    const to = new THREE.Vector3(c ? c.x : 0, 0, CUST_Z + 0.55);
    g.position.copy(from); g.scale.setScalar(0.001);
    this.scene.add(g);
    this.cups.push({ g, liquid, t: -0.15, from, to });
    this.drainT = 0;
  }

  /** Put customers in the three places (null: empty). New ones walk in; ones no longer there hop off. */
  setCustomers(ids: (GlimmerId | null)[], keys: (string | null)[]) { this.chain = this.chain.then(() => this.placeCustomers(ids, keys)); return this.chain; }
  private chain: Promise<void> = Promise.resolve();
  private async placeCustomers(ids: (GlimmerId | null)[], keys: (string | null)[]) {
    for (let slot = 0; slot < 3; slot++) {
      const c = this.cust[slot], id = ids[slot], key = keys[slot];
      if (c && c.model.root.userData.key === key) continue;
      if (c) { c.leaving = true; c.t = 0; c.from = c.x; this.gone.push(c); this.cust[slot] = null; }
      if (!id) continue;
      const m = await GlimmerModel.create(id, this.tall ? 0.8 : 0.95);
      if (this.disposed) { m.dispose(); return; }
      m.root.userData.key = key; m.fx = this.fx; m.play('appear'); m.appearThen = 'idle'; m.face = this.camera.position;
      this.scene.add(m.root);
      const enter = slot === 0 ? -4.5 : 4.5;
      this.cust[slot] = { model: m, slot, x: this.slotX[slot] + enter, from: this.slotX[slot] + enter, t: 0, leaving: false };
    }
  }
  cheer(slot: number) {
    const c = this.cust[slot]; if (!c) return;
    c.model.play('happy');
    const col = ELEMENT[GLIMMER[c.model.id].element].color;
    this.fx.emit({ at: new THREE.Vector3(c.x, 0.8, CUST_Z), count: 46, shape: ['star', 'heart', 'spark'], color: [col, 0xffffff, 0xffd36b, 0xff8fb0], speed: [1, 2.6], up: 1.4, life: [0.6, 1.2], size: [0.07, 0.15], gravity: 1.6, drag: 0.8, spin: 3 });
  }
  sad(slot: number) { this.cust[slot]?.model.play('sad'); }
  /** a burst of fruity sparkles over the blender (a rush hour starting, a big combo) */
  sparkle() { this.fx.emit({ at: this.blender.localToWorld(new THREE.Vector3(0, JAR_Y + JAR_H + 0.3, 0)), count: 40, shape: ['star', 'spark', 'heart'], color: [0xff8fb0, 0xffd36b, 0x8cc63f, 0xffffff], speed: [1.2, 2.8], up: 1.8, life: [0.6, 1.2], size: [0.06, 0.14], gravity: 1.4, drag: 0.7, spin: 3 }); }
  /** Where a customer's head is on the screen (px in the canvas), for the order bubble. */
  headAt(slot: number): { x: number; y: number } | null {
    const c = this.cust[slot]; if (!c) return null;
    const p = new THREE.Vector3(c.x, c.model.height * (c.model.floats ? 1.5 : 1.12), CUST_Z).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  /** Where the top of the jug is on the screen (for the fruit counts beside it). */
  jugAt(): { x: number; y: number } {
    const p = this.blender.localToWorld(new THREE.Vector3(0, JAR_Y + JAR_H, 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.tall = aspect < 0.9;
    this.camera.aspect = aspect;
    if (this.tall) {
      this.slotX = [-1.25, 0, 1.25];
      this.camera.fov = 50;
      this.blender.position.set(0, 0, 1.55); this.blender.scale.setScalar(0.62);
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      this.camera.position.set(0, 0.4, 0.9).addScaledVector(new THREE.Vector3(0, 1.4, 1).normalize(), 1.7 / Math.tan(half));
      this.camera.lookAt(0, 0.7, -0.6);
    } else {
      // the blender stands at the right end of the counter, the customers along the rest of it
      this.slotX = [-2.45, -0.75, 0.95];
      this.camera.fov = 36;
      this.blender.position.set(2.3, 0, 1.05); this.blender.scale.setScalar(0.66);
      this.camera.position.set(0, 4.1, 6.6);
      this.camera.lookAt(0, 0.55, -0.6);
    }
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
    for (const c of this.cust) if (c && !c.leaving && c.t >= 1) c.x = this.slotX[c.slot];
    this.fruit.forEach((k, j) => { k.at = this.spotFor(j); k.g.position.copy(k.at); k.t = 1; });
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    // the jug shakes on a wrong blend, and rattles while it blends
    this.shakeT = Math.max(0, this.shakeT - dt);
    const rattle = this.blendT >= 0 && this.blendT < 1.1 ? 0.025 : 0;
    this.jug.rotation.z = Math.sin(this.t * 60) * (this.shakeT * 0.08 + rattle);
    this.jug.position.x = Math.sin(this.t * 47) * rattle * 0.6;
    for (const k of this.fruit) {
      if (this.blendT >= 0) {
        // whirl round the middle, faster and faster, shrinking into the smoothie
        const e = Math.min(1, this.blendT / 0.9);
        const a = Math.atan2(k.at.z, k.at.x) + this.blendT * this.blendT * 14;
        const rr = JAR_R * 0.5 * (1 - e * 0.6);
        k.g.position.set(Math.cos(a) * rr, k.at.y - e * 0.3, Math.sin(a) * rr);
        k.g.rotation.y += dt * 20; k.g.scale.setScalar(FS * Math.max(0.001, 1 - e));
        continue;
      }
      if (k.t < 1) {
        const was = k.t;
        k.t = Math.min(1, k.t + dt / 0.45);
        k.g.position.lerpVectors(k.from, k.at, bounce(k.t));
        k.g.rotation.x = (1 - ease(k.t)) * k.spin;
        if (was < 0.72 && k.t >= 0.72) this.fx.emit({ at: this.blender.localToWorld(k.at.clone()), count: 6, shape: 'dot', color: [0xffffff, 0xffe8f0], speed: [0.3, 0.8], life: [0.2, 0.4], size: [0.03, 0.05] });
      } else { k.g.position.copy(k.at); }
    }
    for (const k of this.leaving) {
      k.out += dt / 0.35;
      k.g.position.lerpVectors(k.from, k.from.clone().add(new THREE.Vector3(0, 1.2, 0.8)), ease(k.out));
      k.g.scale.setScalar(FS * Math.max(0.001, 1 - k.out));
    }
    for (const k of this.leaving.filter(x => x.out >= 1)) this.blender.remove(k.g);
    this.leaving = this.leaving.filter(x => x.out < 1);
    if (this.blendT >= 0) {
      const was = this.blendT;
      this.blendT += dt;
      // the smoothie rises as the fruit goes
      this.liquid.scale.y = Math.max(0.001, JAR_H * this.level * ease(this.blendT / 1.0));
      if (was < 0.4 && this.blendT >= 0.4) this.fx.emit({ at: this.blender.localToWorld(new THREE.Vector3(0, JAR_Y + JAR_H * 0.7, 0)), count: 14, shape: 'dot', color: [this.liquidMat.color.getHex(), 0xffffff], speed: [0.4, 1.2], life: [0.3, 0.6], size: [0.04, 0.08], up: 1 });
      if (was < 1.25 && this.blendT >= 1.25) {
        for (const k of this.fruit) this.blender.remove(k.g);
        this.fruit = [];
        const cb = this.onBlended; this.onBlended = null; cb?.();
      }
    }
    if (this.drainT >= 0) {
      this.drainT += dt;
      this.liquid.scale.y = Math.max(0.001, JAR_H * this.level * (1 - ease(this.drainT / 0.5)));
      if (this.drainT >= 0.5) { this.drainT = -1; this.liquid.visible = false; this.blendT = -1; }
    }
    for (const c of this.cups) {
      c.t += dt / 1.1;
      const k = Math.max(0, c.t);
      if (k < 0.3) { c.g.position.copy(c.from); c.g.scale.setScalar(Math.max(0.001, ease(k / 0.3))); }
      else { const e = ease((k - 0.3) / 0.7); c.g.position.lerpVectors(c.from, c.to, e); c.g.position.y = Math.sin(e * Math.PI) * 0.35; c.g.scale.setScalar(1 - Math.max(0, e - 0.7) * 2.5); }
    }
    for (const c of this.cups.filter(x => x.t >= 1)) { this.fx.emit({ at: c.to.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 12, shape: 'spark', color: [0xffd36b, 0xffffff], speed: [0.5, 1.4], life: [0.3, 0.6], size: [0.05, 0.1] }); this.scene.remove(c.g); }
    this.cups = this.cups.filter(x => x.t < 1);
    for (const c of this.cust) {
      if (!c) continue;
      c.t = Math.min(1, c.t + dt / 0.9);
      c.x = c.from + (this.slotX[c.slot] - c.from) * ease(c.t);
      c.model.root.position.set(c.x, 0, CUST_Z);
      c.model.update(dt, this.t);
    }
    for (const c of this.gone) {
      c.t += dt / 0.8;
      const e = ease(c.t);
      c.model.root.position.set(c.x, Math.sin(Math.min(1, c.t) * Math.PI) * 0.45, CUST_Z - e * 1.6);
      c.model.root.scale.setScalar(Math.max(0.001, 1 - e));
      c.model.update(dt, this.t);
    }
    for (const c of this.gone.filter(x => x.t >= 1)) c.model.dispose();
    this.gone = this.gone.filter(x => x.t < 1);
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const c of [...this.cust, ...this.gone]) c?.model.dispose();
    this.fx.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mt of [m.material].flat()) (mt as THREE.Material).dispose(); } });
    for (const m of this.mats.values()) m.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
