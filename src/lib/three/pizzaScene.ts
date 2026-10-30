// Pizza Rush in 3D: a small see-through renderer of its own over the painted pizza shop (the game's stage
// is an island world; this game happens at a counter). A pizza on a wooden peel at the front, whole or
// cut into slices you tap (a picked slice lifts and glows), and up to three Glimmer customers at the
// counter behind it. Served slices fly to the customer; then a fresh pizza drops onto the peel.
import * as THREE from 'three';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { ELEMENT, GLIMMER, type GlimmerId } from '../adventure/glimmers';
import { PIZZAS, PIZZA_KINDS, type PizzaKind } from '../math/pizza/rush';

const R = 1, H = 0.08, CUST_Z = -1.1;
type Slice = { mesh: THREE.Mesh; cap: THREE.MeshStandardMaterial; mid: number; picked: boolean; k: number; fly: { t: number; from: THREE.Vector3; to: THREE.Vector3 } | null };
type Cust = { model: GlimmerModel; slot: number; x: number; from: number; t: number; leaving: boolean };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class PizzaScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private pizza = new THREE.Group();
  private peel = new THREE.Group();
  private fx = new Fx();
  private top: THREE.Texture | null = null;
  /** each kind of pizza's painted top, once loaded (by its art) */
  private tops = new Map<string, THREE.Texture>();
  private kind: PizzaKind = 'pepperoni';
  private slices: Slice[] = [];
  private flying: Slice[] = [];
  /** the slices it's cut into (1: whole) */
  cutInto = 1;
  private gap = 0;
  private gapTo = 0;
  /** dropping in: 1 high up, 0 on the peel */
  private drop = 0;
  private spin = 0;
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
  /** the customer whose order is up: lit by a spotlight, stepped forward and bigger; the others wait
   *  back a little, smaller and paler */
  private active: number | null = null;
  private spot: THREE.Group;
  private spotX = 0; private spotK = 0;
  private lookX = 0;
  private camAim = new THREE.Vector3(0, 0.2, -0.5);

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // warm shop light: the oven's glow from the left, the sky from above
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb57a4a, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
    sun.position.set(-2.5, 7, 4); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xffc98a, 0.9); rim.position.set(3, 3, -4); this.scene.add(rim);
    // soft shadows on the painted counter
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.26 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.09; catcher.receiveShadow = true;
    this.scene.add(catcher);
    this.buildPeel();
    this.spot = this.buildSpot();
    this.scene.add(this.peel, this.pizza, this.fx.root, this.spot);
  }
  /** A warm spotlight: a pool of light on the counter and a soft beam from above. */
  private buildSpot() {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!;
    const grd = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,236,170,0.95)'); grd.addColorStop(0.55, 'rgba(255,214,110,0.45)'); grd.addColorStop(1, 'rgba(255,214,110,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.85, 40), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = -0.07;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.85, 3.2, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe6a0, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    beam.position.y = 1.5;
    // a warm glow behind them too: the pool is mostly hidden under the pizza for the middle customer
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.7); halo.position.set(0, 0.5, -0.3);
    g.add(pool, beam, halo);
    g.userData.pool = pool; g.userData.beam = beam; g.userData.halo = halo;
    return g;
  }
  /** Whose order is up now (null: nobody). */
  setActive(slot: number | null) { this.active = slot; }

  static async create(canvas: HTMLCanvasElement): Promise<PizzaScene> {
    const s = new PizzaScene(canvas);
    s.top = await s.loadTop(PIZZAS.pepperoni.art);
    // the other kinds load meanwhile, ready for the orders
    for (const k of PIZZA_KINDS) void s.loadTop(PIZZAS[k].art);
    s.setCut(1, false);
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  private buildPeel() {
    const wood = new THREE.MeshStandardMaterial({ color: 0xc8874a, roughness: 0.75 });
    const board = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.22, R * 1.22, 0.07, 72), wood);
    board.position.y = -0.045; board.receiveShadow = true; board.castShadow = true;
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xa96a34, roughness: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 1.22, 0.035, 10, 72), rimMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = -0.02; ring.castShadow = true;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.8), wood);
    handle.position.set(0, -0.05, R * 1.22 + 0.36); handle.castShadow = true;
    this.peel.add(board, ring, handle);
  }

  /** Cut the pizza into n slices (1: whole). `animate`: the slices spring apart. Clears the picked ones. */
  setCut(n: number, animate = true) {
    for (const s of this.slices) { this.pizza.remove(s.mesh); s.mesh.geometry.dispose(); s.cap.dispose(); }
    this.slices = [];
    this.cutInto = n;
    const side = new THREE.MeshStandardMaterial({ color: 0xd99b52, roughness: 0.7 });
    const turn = Math.PI / 2 + (n % 2 ? Math.PI / n : 0);
    for (let i = 0; i < n; i++) {
      const a0 = turn + (i * Math.PI * 2) / n, a1 = a0 + (Math.PI * 2) / n, mid = (a0 + a1) / 2;
      const shape = new THREE.Shape();
      const r = R - 0.03;
      if (n === 1) shape.absarc(0, 0, r, 0, Math.PI * 2, false);
      else { shape.moveTo(0, 0); shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r); shape.absarc(0, 0, r, a0, a1, false); shape.lineTo(0, 0); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: H - 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.025, bevelSegments: 3, curveSegments: Math.max(6, Math.round(72 / n)) });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0.02, 0);
      const cap = new THREE.MeshStandardMaterial({ map: this.top, color: this.top ? 0xffffff : 0xf2b24a, roughness: 0.62, emissive: 0xff9a2e, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(geo, [cap, side]);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData.slice = i;
      this.pizza.add(mesh);
      this.slices.push({ mesh, cap, mid, picked: false, k: 0, fly: null });
    }
    this.gap = animate ? 0 : n > 1 ? 0.035 : 0;
    this.gapTo = n > 1 ? 0.035 : 0;
    if (animate && n > 1) this.fx.emit({ at: new THREE.Vector3(0, 0.15, 0), count: 26, shape: ['dot', 'star'], color: [0xffffff, 0xffe39a], speed: [0.6, 1.6], up: 0.5, life: [0.3, 0.6], size: [0.04, 0.09], drag: 2, spread: 1 });
  }

  /** A kind of pizza's painted top, fitted to the slices' caps. */
  private async loadTop(art: string): Promise<THREE.Texture | null> {
    const have = this.tops.get(art);
    if (have) return have;
    const tex = await loadTexture(art);
    if (!tex || this.disposed) return null;
    if (this.tops.has(art)) return this.tops.get(art)!;
    // the caps' corners are in the slice's own units (-1..1 across the pizza)
    const t = tex.clone(); t.repeat.set(1 / (2 * R), 1 / (2 * R)); t.offset.set(0.5, 0.5); t.anisotropy = 4; t.needsUpdate = true;
    this.tops.set(art, t);
    return t;
  }

  /** A fresh pizza drops onto the peel, whole or already cut, of this kind (mushroom, a cookie pizza...). */
  newPizza(cut: number, kind: PizzaKind = 'pepperoni') {
    this.kind = kind;
    const art = PIZZAS[kind].art, t = this.tops.get(art);
    if (t) this.top = t;
    else void this.loadTop(art).then(x => {
      // still loading when it came up: it shows as soon as it's here
      if (!x || this.kind !== kind) return;
      this.top = x;
      for (const sl of this.slices) { sl.cap.map = x; sl.cap.color.set(0xffffff); sl.cap.needsUpdate = true; }
    });
    this.setCut(cut, false);
    this.drop = 1;
  }

  /** Tap: the slice under this screen point lifts (or drops back). Returns whether a slice was hit. */
  tap(clientX: number, clientY: number): boolean {
    const hit = this.sliceAt(clientX, clientY);
    if (!hit || this.cutInto <= 1) return !!hit;
    hit.picked = !hit.picked;
    return true;
  }
  /** Whether a screen point is on the pizza (for "cut it first" when it's whole). */
  onPizza(clientX: number, clientY: number) { return !!this.sliceAt(clientX, clientY); }
  private sliceAt(clientX: number, clientY: number): Slice | null {
    const rc = this.canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((clientX - rc.left) / rc.width) * 2 - 1, -((clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    const hits = this.ray.intersectObjects(this.slices.map(s => s.mesh), false);
    return hits.length ? this.slices.find(s => s.mesh === hits[0].object) ?? null : null;
  }
  get picked() { return this.slices.filter(s => s.picked).length; }
  unpickAll() { for (const s of this.slices) s.picked = false; }
  /** Wobble the pizza (a wrong serve). */
  shake() { this.spin = 1; }

  /** The picked slices fly to the customer at this slot (the next order brings a new pizza). */
  serve(slot: number) {
    const c = this.cust[slot];
    const to = new THREE.Vector3(c ? c.x : 0, 0.55, CUST_Z + 0.2);
    for (const s of this.slices.filter(x => x.picked)) {
      this.pizza.remove(s.mesh);
      this.scene.add(s.mesh);
      s.mesh.position.add(this.pizza.position);
      s.fly = { t: 0, from: s.mesh.position.clone(), to };
      this.flying.push(s);
    }
    this.slices = this.slices.filter(x => !x.picked);
  }

  /** Put customers in the three places (null: empty). New ones walk in from the right; ones no longer
   *  there walk off to the left. */
  setCustomers(ids: (GlimmerId | null)[], keys: (string | null)[]) {
    // one change at a time, in order (a model takes a moment to load)
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
  /** A served customer cheers (with sparkles of its colour). */
  cheer(slot: number) {
    const c = this.cust[slot]; if (!c) return;
    c.model.play('happy');
    const col = ELEMENT[GLIMMER[c.model.id].element].color;
    this.fx.emit({ at: new THREE.Vector3(c.x, 0.7, CUST_Z), count: 40, shape: ['star', 'heart', 'spark'], color: [col, 0xffffff, 0xffd36b], speed: [1, 2.6], up: 1.4, life: [0.6, 1.2], size: [0.07, 0.15], gravity: 1.6, drag: 0.8, spin: 3 });
  }
  /** A customer who waited too long, or got the wrong pizza, looks sad for a moment. */
  sad(slot: number) { this.cust[slot]?.model.play('sad'); }
  /** Where a customer's head is on the screen (px in the canvas), for its order bubble. */
  headAt(slot: number): { x: number; y: number } | null {
    const c = this.cust[slot]; if (!c) return null;
    const p = new THREE.Vector3(c.x, c.model.height * (c.model.floats ? 1.5 : 1.12), CUST_Z).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  /** Where the pizza sits on the screen (px), for the hint and the cutter. */
  pizzaAt(): { x: number; y: number; r: number } {
    const c = new THREE.Vector3(0, 0, 0).project(this.camera), e = new THREE.Vector3(R, 0, 0).project(this.camera);
    return { x: (c.x * 0.5 + 0.5) * this.w, y: (-c.y * 0.5 + 0.5) * this.h, r: Math.abs(e.x - c.x) * 0.5 * this.w };
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.tall = aspect < 0.9;
    this.camera.aspect = aspect;
    if (this.tall) {
      // a phone: the pizza fills the width at the bottom, the customers stand closer together above
      this.slotX = [-1.15, 0, 1.15];
      this.camera.fov = 50;
      const at = new THREE.Vector3(0, 0, 0.55);
      this.pizza.position.copy(at); this.peel.position.copy(at);
      // back off until the pizza (and a little room) fills the screen's width
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      this.camera.position.copy(at).addScaledVector(new THREE.Vector3(0, 1.25, 1).normalize(), 1.5 / Math.tan(half));
      this.camera.lookAt(0, 0.4, -0.75);
    } else {
      this.slotX = [-1.85, 0, 1.85];
      this.camera.fov = 36;
      this.pizza.position.set(0, 0, 0.75); this.peel.position.copy(this.pizza.position);
      this.camera.position.set(0, 3.9, 6.3);
      this.camera.lookAt(0, 0.2, -0.5);
    }
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
    for (const c of this.cust) if (c && !c.leaving && c.t >= 1) c.x = this.slotX[c.slot];
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    this.gap += (this.gapTo - this.gap) * Math.min(1, dt * 10);
    this.drop = Math.max(0, this.drop - dt * 2.6);
    this.spin = Math.max(0, this.spin - dt * 2.2);
    const dy = this.drop > 0 ? Math.pow(this.drop, 2) * 2.2 : 0;
    this.pizza.position.y = dy;
    this.pizza.rotation.y = Math.sin(this.spin * 14) * 0.08 * this.spin;
    for (const s of this.slices) {
      s.k += ((s.picked ? 1 : 0) - s.k) * Math.min(1, dt * 12);
      const out = this.gap + s.k * 0.2;
      s.mesh.position.set(Math.cos(s.mid) * out, s.k * 0.32 + Math.sin(this.t * 5 + s.mid * 3) * 0.02 * s.k, -Math.sin(s.mid) * out);
      s.mesh.rotation.set(0, 0, 0);
      s.cap.emissiveIntensity = s.k * 0.12;
    }
    for (const s of this.flying) {
      const f = s.fly!; f.t += dt / 0.55;
      const e = ease(f.t);
      s.mesh.position.lerpVectors(f.from, f.to, e);
      s.mesh.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * 0.9;
      s.mesh.scale.setScalar(1 - e * 0.75);
      s.mesh.rotation.y += dt * 6;
    }
    for (const s of this.flying.filter(x => x.fly!.t >= 1)) {
      this.fx.emit({ at: s.fly!.to.clone(), count: 6, shape: 'spark', color: [0xffd36b, 0xffffff], speed: [0.5, 1.2], life: [0.3, 0.6], size: [0.05, 0.1] });
      this.scene.remove(s.mesh); s.mesh.geometry.dispose(); s.cap.dispose();
    }
    this.flying = this.flying.filter(x => x.fly!.t < 1);
    for (const c of this.cust) {
      if (!c) continue;
      c.t = Math.min(1, c.t + dt / 0.9);
      c.x = c.from + (this.slotX[c.slot] - c.from) * ease(c.t);
      // the one whose order is up steps forward into the light, a little bigger; the others wait back
      const on = this.active === c.slot, any = this.active !== null;
      const k = (c.model.root.userData.onK ?? 0) + (((on ? 1 : any ? -1 : 0)) - (c.model.root.userData.onK ?? 0)) * Math.min(1, dt * 6);
      c.model.root.userData.onK = k;
      c.model.root.position.set(c.x, -0.09 + (on ? Math.abs(Math.sin(this.t * 4)) * 0.04 : 0), CUST_Z + k * (k > 0 ? 0.32 : 0.22));
      c.model.root.scale.setScalar(1 + k * (k > 0 ? 0.16 : 0.12));
      c.model.setGrey(Math.max(0, -k) * 0.45);
      c.model.update(dt, this.t);
    }
    // the spotlight slides to whoever's up; the camera turns a little toward them
    const ac = this.active !== null ? this.cust[this.active] : null;
    const wantK = ac ? 1 : 0;
    this.spotK += (wantK - this.spotK) * Math.min(1, dt * 6);
    if (ac) this.spotX += (ac.x - this.spotX) * Math.min(1, dt * 8);
    this.spot.position.set(this.spotX, 0, CUST_Z + 0.32);
    (this.spot.userData.pool.material as THREE.MeshBasicMaterial).opacity = this.spotK * (0.85 + Math.sin(this.t * 3) * 0.1);
    (this.spot.userData.beam.material as THREE.MeshBasicMaterial).opacity = this.spotK * 0.16;
    (this.spot.userData.halo.material as THREE.SpriteMaterial).opacity = this.spotK * (0.7 + Math.sin(this.t * 3) * 0.08);
    this.lookX += ((ac ? ac.x * (this.tall ? 0.15 : 0.22) : 0) - this.lookX) * Math.min(1, dt * 2.5);
    if (!this.tall) { this.camAim.set(this.lookX, 0.2, -0.5); this.camera.lookAt(this.camAim); }
    // a customer leaving hops off backwards and shrinks away (walking sideways crossed the others)
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
    for (const k of ['pool', 'beam', 'halo']) { const m = (this.spot.userData[k] as THREE.Mesh).material as THREE.MeshBasicMaterial; m.map?.dispose(); m.dispose(); }
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.glimmer) { m.geometry?.dispose(); } });
    for (const t of this.tops.values()) t.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
