// Market Dash in 3D: a see-through renderer of its own over the painted market stall (the game's stage is
// an island world; this game happens at a counter). A wooden coin tray on the counter, where coins tapped
// from the bank drop in with a bounce and a clink (tap one in the tray to take it back), and up to three
// Glimmer shoppers behind it. Paid coins slide across to the shopper, who cheers.
import * as THREE from 'three';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { ELEMENT, GLIMMER, type GlimmerId } from '../adventure/glimmers';

const CUST_Z = -1.15;
/** coin radius (world units) against its value: the real coins' sizes */
const RADIUS: Record<number, number> = { 1: 0.25, 5: 0.27, 10: 0.23, 25: 0.31, 100: 0.33 };
const EDGE: Record<number, number> = { 1: 0xc8743c, 5: 0xc9ced6, 10: 0xd2d6de, 25: 0xc6ccd4, 100: 0xe7b631 };
const ART: Record<number, string> = { 1: 'penny', 5: 'nickel', 10: 'dime', 25: 'quarter', 100: 'dollar' };
const TRAY_W = 2.7, TRAY_D = 1.25, PER_ROW = 5;
type CoinM = { mesh: THREE.Mesh; value: number; at: THREE.Vector3; t: number; from: THREE.Vector3; spin: number; fly: { t: number; from: THREE.Vector3; to: THREE.Vector3 } | null };
type Cust = { model: GlimmerModel; slot: number; x: number; from: number; t: number; leaving: boolean };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
/** a drop with a little bounce at the end */
const bounce = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k < 0.72 ? Math.pow(k / 0.72, 2) : 1 - Math.sin(((k - 0.72) / 0.28) * Math.PI) * 0.12; };

export class MarketScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private tray = new THREE.Group();
  private fx = new Fx();
  private coins: CoinM[] = [];
  private flying: CoinM[] = [];
  private faces: Record<number, THREE.Texture | null> = {};
  private geo: Record<number, THREE.CylinderGeometry> = {};
  private mats: THREE.Material[] = [];
  private shakeT = 0;
  private cust: (Cust | null)[] = [null, null, null];
  private gone: Cust[] = [];
  private raf = 0;
  private last = 0;
  private t = 0;
  private ray = new THREE.Raycaster();
  private w = 1; private h = 1;
  tall = false;
  private slotX = [-1.8, 0, 1.8];
  private disposed = false;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // a sunny market: warm sun from the left, the sky above, a little gold bounce from the coins
    this.scene.add(new THREE.HemisphereLight(0xfff6e4, 0xb8864e, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.5);
    sun.position.set(-2.5, 7, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffd79a, 0.9); rim.position.set(3, 3, -4); this.scene.add(rim);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.24 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.09; catcher.receiveShadow = true;
    this.scene.add(catcher);
    this.buildTray();
    this.scene.add(this.tray, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement): Promise<MarketScene> {
    const s = new MarketScene(canvas);
    const vals = [1, 5, 10, 25, 100];
    const texs = await Promise.all(vals.map(v => loadTexture(`math/money/${ART[v]}.webp`, { color: true })));
    vals.forEach((v, i) => {
      s.faces[v] = texs[i];
      s.geo[v] = new THREE.CylinderGeometry(RADIUS[v], RADIUS[v], 0.045, 40);
    });
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  /** A wooden tray with a rim and a soft felt bottom. */
  private buildTray() {
    const wood = new THREE.MeshStandardMaterial({ color: 0xb07a43, roughness: 0.7 });
    const felt = new THREE.MeshStandardMaterial({ color: 0x2f7d5b, roughness: 0.95 });
    this.mats.push(wood, felt);
    const base = new THREE.Mesh(new THREE.BoxGeometry(TRAY_W + 0.2, 0.06, TRAY_D + 0.2), wood);
    base.position.y = -0.04; base.receiveShadow = true; base.castShadow = true;
    const bed = new THREE.Mesh(new THREE.BoxGeometry(TRAY_W, 0.02, TRAY_D), felt);
    bed.position.y = 0.0; bed.receiveShadow = true;
    this.tray.add(base, bed);
    const rim = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), wood); m.position.set(x, 0.04, z); m.castShadow = true; m.receiveShadow = true; this.tray.add(m); };
    rim(TRAY_W + 0.2, 0.1, 0, -(TRAY_D + 0.1) / 2); rim(TRAY_W + 0.2, 0.1, 0, (TRAY_D + 0.1) / 2);
    rim(0.1, TRAY_D, -(TRAY_W + 0.1) / 2, 0); rim(0.1, TRAY_D, (TRAY_W + 0.1) / 2, 0);
  }

  private spotFor(i: number) {
    const row = Math.floor(i / PER_ROW), col = i % PER_ROW;
    const jitter = ((i * 37) % 11) / 11 - 0.5;
    // rows of five across the middle; a fourth row lies on top of the first. Each coin sits a hair above
    // the one before, so where two overlap the newer one shows.
    return new THREE.Vector3((col - (PER_ROW - 1) / 2) * 0.5 + jitter * 0.04, 0.04 + i * 0.004, -0.38 + (row % 3) * 0.38 + jitter * 0.03);
  }

  /** A coin from the bank drops into the tray. */
  addCoin(value: number) {
    const face = this.faces[value] ?? null;
    const top = new THREE.MeshStandardMaterial({ map: face, color: face ? 0xffffff : EDGE[value], roughness: 0.38, metalness: 0.25, alphaTest: 0.4, transparent: false });
    const side = new THREE.MeshStandardMaterial({ color: EDGE[value], roughness: 0.32, metalness: 0.65 });
    const mesh = new THREE.Mesh(this.geo[value], [side, top, top]);
    mesh.castShadow = true;
    mesh.userData.coin = true;
    const at = this.spotFor(this.coins.length).add(this.tray.position);
    const from = at.clone().add(new THREE.Vector3(0, 1.6, 0.9));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.coins.push({ mesh, value, at, from, t: 0, spin: 6 + Math.random() * 4, fly: null });
  }
  /** Take back the coin under this point (px in the canvas); returns its value, or null. */
  takeAt(clientX: number, clientY: number): number | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.coins.map(c => c.mesh), false)[0];
    if (!hit) return null;
    const i = this.coins.findIndex(c => c.mesh === hit.object);
    return i < 0 ? null : this.removeAt(i);
  }
  /** Take back the last coin (Backspace). */
  takeLast(): number | null { return this.coins.length ? this.removeAt(this.coins.length - 1) : null; }
  private removeAt(i: number): number {
    const c = this.coins.splice(i, 1)[0];
    c.fly = { t: 0, from: c.mesh.position.clone(), to: c.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 1.6)) };
    this.flying.push(c);
    // the others slide into place
    this.coins.forEach((k, j) => { k.from = k.mesh.position.clone(); k.at = this.spotFor(j).add(this.tray.position); k.t = Math.min(k.t, 0.6); });
    return c.value;
  }
  /** Empty the tray (back to the bank). */
  clear() { while (this.coins.length) this.removeAt(this.coins.length - 1); }
  get total() { return this.coins.reduce((t, c) => t + c.value, 0); }
  get count() { return this.coins.length; }

  /** The coins slide across to the shopper at this slot. */
  pay(slot: number) {
    const c = this.cust[slot];
    const to = new THREE.Vector3(c ? c.x : 0, 0.5, CUST_Z + 0.25);
    this.coins.forEach((k, i) => { k.fly = { t: -i * 0.05, from: k.mesh.position.clone(), to }; this.flying.push(k); });
    this.coins = [];
  }
  /** Wrong amount: the tray gives a little shake. */
  shake() { this.shakeT = 0.45; }

  /** Put shoppers in the three places (null: empty). New ones walk in from the right; ones no longer
   *  there hop off. */
  setCustomers(ids: (GlimmerId | null)[], keys: (string | null)[]) {
    this.chain = this.chain.then(() => this.placeCustomers(ids, keys));
    return this.chain;
  }
  private chain: Promise<void> = Promise.resolve();
  private async placeCustomers(ids: (GlimmerId | null)[], keys: (string | null)[]) {
    for (let slot = 0; slot < 3; slot++) {
      const c = this.cust[slot], id = ids[slot], key = keys[slot];
      if (c && c.model.root.userData.key === key) continue;
      if (c) { c.leaving = true; c.t = 0; c.from = c.x; this.gone.push(c); this.cust[slot] = null; }
      if (!id) continue;
      const m = await GlimmerModel.create(id, this.tall ? 0.8 : 0.95);
      if (this.disposed) { m.dispose(); return; }
      m.root.userData.key = key;
      m.fx = this.fx;
      m.play('appear');
      m.appearThen = 'idle';
      m.face = this.camera.position;
      this.scene.add(m.root);
      this.cust[slot] = { model: m, slot, x: this.slotX[slot] + 4.5, from: this.slotX[slot] + 4.5, t: 0, leaving: false };
    }
  }
  /** A served shopper cheers (sparkles of its colour, and a few gold glints). */
  cheer(slot: number) {
    const c = this.cust[slot]; if (!c) return;
    c.model.play('happy');
    const col = ELEMENT[GLIMMER[c.model.id].element].color;
    this.fx.emit({ at: new THREE.Vector3(c.x, 0.7, CUST_Z), count: 42, shape: ['star', 'heart', 'spark'], color: [col, 0xffffff, 0xffd36b], speed: [1, 2.6], up: 1.4, life: [0.6, 1.2], size: [0.07, 0.15], gravity: 1.6, drag: 0.8, spin: 3 });
  }
  sad(slot: number) { this.cust[slot]?.model.play('sad'); }
  /** Where a shopper's head is on the screen (px in the canvas), for the order bubble. */
  headAt(slot: number): { x: number; y: number } | null {
    const c = this.cust[slot]; if (!c) return null;
    const p = new THREE.Vector3(c.x, c.model.height * (c.model.floats ? 1.5 : 1.12), CUST_Z).project(this.camera);
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
      this.slotX = [-1.15, 0, 1.15];
      this.camera.fov = 50;
      const at = new THREE.Vector3(0, 0, 0.55);
      this.tray.position.copy(at);
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      this.camera.position.copy(at).addScaledVector(new THREE.Vector3(0, 1.25, 1).normalize(), 1.55 / Math.tan(half));
      this.camera.lookAt(0, 0.4, -0.75);
    } else {
      this.slotX = [-1.85, 0, 1.85];
      this.camera.fov = 36;
      this.tray.position.set(0, 0, 0.45);
      this.camera.position.set(0, 3.9, 6.3);
      this.camera.lookAt(0, 0.2, -0.5);
    }
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
    for (const c of this.cust) if (c && !c.leaving && c.t >= 1) c.x = this.slotX[c.slot];
    this.coins.forEach((k, j) => { k.at = this.spotFor(j).add(this.tray.position); k.mesh.position.copy(k.at); k.t = 1; });
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.tray.rotation.z = Math.sin(this.shakeT * 50) * 0.03 * (this.shakeT / 0.45);
    for (const k of this.coins) {
      if (k.t < 1) {
        const was = k.t;
        k.t = Math.min(1, k.t + dt / 0.42);
        const e = bounce(k.t);
        k.mesh.position.lerpVectors(k.from, k.at, e);
        k.mesh.rotation.x = (1 - ease(k.t)) * k.spin;
        if (was < 0.72 && k.t >= 0.72) this.fx.emit({ at: k.at.clone().add(new THREE.Vector3(0, 0.05, 0)), count: 8, shape: 'spark', color: [0xffe28a, 0xffffff], speed: [0.4, 1.1], life: [0.25, 0.5], size: [0.04, 0.08] });
      } else {
        k.mesh.position.copy(k.at);
        k.mesh.rotation.x = 0;
      }
      k.mesh.position.x += this.tray.rotation.z * -0.4;
    }
    for (const k of this.flying) {
      const f = k.fly!; f.t += dt / 0.5;
      if (f.t < 0) continue;
      const e = ease(f.t);
      k.mesh.position.lerpVectors(f.from, f.to, e);
      k.mesh.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * 0.7;
      k.mesh.rotation.y += dt * 9;
      k.mesh.scale.setScalar(Math.max(0.001, 1 - e * 0.7));
    }
    for (const k of this.flying.filter(x => x.fly!.t >= 1)) {
      this.fx.emit({ at: k.fly!.to.clone(), count: 5, shape: 'spark', color: [0xffd36b, 0xffffff], speed: [0.5, 1.2], life: [0.3, 0.6], size: [0.05, 0.1] });
      this.scene.remove(k.mesh);
      (k.mesh.material as THREE.Material[]).forEach((m, i) => { if (i < 2) m.dispose(); });
    }
    this.flying = this.flying.filter(x => x.fly!.t < 1);
    for (const c of this.cust) {
      if (!c) continue;
      c.t = Math.min(1, c.t + dt / 0.9);
      c.x = c.from + (this.slotX[c.slot] - c.from) * ease(c.t);
      c.model.root.position.set(c.x, -0.09, CUST_Z);
      c.model.update(dt, this.t);
    }
    for (const c of this.gone) {
      c.t += dt / 0.8;
      const e = ease(c.t);
      c.model.root.position.set(c.x, -0.09 + Math.sin(Math.min(1, c.t) * Math.PI) * 0.45, CUST_Z - e * 1.6);
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
    for (const k of [...this.coins, ...this.flying]) (k.mesh.material as THREE.Material[]).forEach((m, i) => { if (i < 2) m.dispose(); });
    Object.values(this.geo).forEach(g => g.dispose());
    this.mats.forEach(m => m.dispose());
    this.tray.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
