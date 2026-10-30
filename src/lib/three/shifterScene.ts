// Shape Shifter in 3D: a see-through renderer of its own over the painted crystal terrace. Glossy crystal
// shapes (thick, bevelled, cut with facets) drift down the sky, turning slowly in the picture's plane so
// they stay easy to read, and rocking a little. A crystal basket glows at the bottom: a caught crystal
// flies into it in an arc and it flashes; a wrong one shatters into shards; one that falls past fades.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Fx } from './fx';
import { facetTexture, TILE_TINT } from './shapeTiles';
import type { FigHue } from '../math/shapes/fig';
import type { P } from '../math/shapes/geo';

type Crystal = {
  id: number; mesh: THREE.Mesh; x: number; y0: number; t0: number; fall: number;
  spin: number; rock: number; size: number;
  /** caught: flying to the basket; broken: shards; gone: fading past the bottom */
  state: 'fall' | 'caught' | 'broken' | 'gone'; st: number; from: THREE.Vector3;
};
type Shard = { mesh: THREE.Mesh; v: THREE.Vector3; spin: THREE.Vector3; t: number };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export class ShifterScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private fx = new Fx();
  private crystals = new Map<number, Crystal>();
  private shards: Shard[] = [];
  private mats = new Map<string, THREE.MeshPhysicalMaterial>();
  private basket = new THREE.Group();
  private glow!: THREE.Sprite;
  private halo: THREE.Texture | null = null;
  private haloTex() {
    if (this.halo) return this.halo;
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!, g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.35, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return (this.halo = new THREE.CanvasTexture(c));
  }
  private flash = 0;
  private raf = 0;
  private last = 0;
  t = 0;
  private w = 1; private h = 1;
  /** half the sky's width and height at the crystals' depth */
  private hw = 4; private hh = 3;
  private ray = new THREE.Raycaster();
  private disposed = false;
  private pmrem: THREE.PMREMGenerator;
  /** told when a crystal falls past the bottom */
  onFell: ((id: number) => void) | null = null;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // a bright mountain morning: sky light, warm sun, and a room's reflections for the crystal's shine
    this.pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb7a6e0, 1.3));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.2); sun.position.set(-3, 5, 6); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xcfe6ff, 1.1); rim.position.set(4, 2, -3); this.scene.add(rim);
    this.buildBasket();
    this.scene.add(this.basket, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement): Promise<ShifterScene> {
    const s = new ShifterScene(canvas);
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  private mat(tint: FigHue): THREE.MeshPhysicalMaterial {
    let m = this.mats.get(tint);
    if (!m) {
      const c = new THREE.Color(TILE_TINT[tint === 'pale' ? 'violet' : tint]);
      m = new THREE.MeshPhysicalMaterial({ color: c, map: facetTexture(), roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 0.35, iridescenceIOR: 1.35, emissive: c, emissiveIntensity: 0.3, transparent: true });
      this.mats.set(tint, m);
    }
    return m;
  }

  /** A crystal basket: a faceted bowl of pale crystal with a glow inside. */
  private buildBasket() {
    const pts = [[0, 0], [0.55, 0.02], [0.9, 0.2], [1.12, 0.55], [1.2, 0.72], [1.14, 0.74], [1.04, 0.58], [0.84, 0.3], [0.5, 0.14], [0, 0.12]].map(([a, b]) => new THREE.Vector2(a, b));
    const g = new THREE.LatheGeometry(pts, 10);
    g.computeVertexNormals();
    const m = new THREE.MeshPhysicalMaterial({ color: 0xd9ccff, map: facetTexture(), roughness: 0.08, clearcoat: 1, iridescence: 0.5, emissive: 0x9b7bf0, emissiveIntensity: 0.25, transparent: true, opacity: 0.92, flatShading: true });
    const bowl = new THREE.Mesh(g, m);
    this.basket.add(bowl);
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d')!, gr = x.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,248,210,1)'); gr.addColorStop(0.4, 'rgba(255,214,120,.55)'); gr.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
    this.glow.scale.setScalar(2.6); this.glow.position.y = 0.55;
    this.basket.add(this.glow);
  }

  /** A crystal drops in at `lane` (0..1 across), taking `fallMs` to cross the sky. */
  spawn(id: number, pts: P[], tint: FigHue, lane: number, fallMs: number, round = false) {
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, -y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: round ? 0.32 : 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 3, curveSegments: 12 });
    geo.translate(0, 0, -0.15);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * 0.6);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.mat(tint).clone());
    // a soft glow of its own colour behind it, so it shines against the bright sky
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.haloTex(), color: TILE_TINT[tint === 'pale' ? 'violet' : tint], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    halo.scale.setScalar(3.4); halo.position.z = -0.4; halo.renderOrder = -1;
    mesh.add(halo);
    const span = Math.max(...pts.map(([x, y]) => Math.hypot(x, y)));
    const size = Math.min(this.hw, this.hh) * 0.2 / Math.max(0.6, span);
    mesh.scale.setScalar(size);
    const x = (lane * 2 - 1) * this.hw * 0.82;
    mesh.position.set(x, this.hh + 1, 0);
    this.scene.add(mesh);
    this.crystals.set(id, { id, mesh, x, y0: this.hh + 1, t0: this.t, fall: fallMs / 1000, spin: (Math.random() - 0.5) * 1.4, rock: Math.random() * 6, size, state: 'fall', st: 0, from: new THREE.Vector3() });
  }

  /** The crystal under a point on the canvas (generous: little fingers), or null. */
  pickAt(cx: number, cy: number): number | null {
    const r = this.canvas.getBoundingClientRect();
    const x = cx - r.left, y = cy - r.top;
    let best: number | null = null, bd = Infinity;
    for (const c of this.crystals.values()) {
      if (c.state !== 'fall') continue;
      const p = c.mesh.position.clone().project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * this.w, sy = (-p.y * 0.5 + 0.5) * this.h;
      const d = Math.hypot(sx - x, sy - y);
      const reach = Math.max(54, this.pxPerUnit() * c.size * 1.25);
      if (d < reach && d < bd) { bd = d; best = c.id; }
    }
    return best;
  }
  private pxPerUnit() { return this.h / (2 * this.hh); }
  /** where a crystal is on the canvas (for a word by it) */
  screenOf(id: number): { x: number; y: number } | null {
    const c = this.crystals.get(id); if (!c) return null;
    const p = c.mesh.position.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  /** the basket on the canvas */
  basketAt() { const p = this.basket.position.clone().add(new THREE.Vector3(0, 0.6, 0)).project(this.camera); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h }; }

  /** Caught: it flies into the basket with sparkles. */
  catchIt(id: number) {
    const c = this.crystals.get(id); if (!c || c.state !== 'fall') return;
    c.state = 'caught'; c.st = 0; c.from.copy(c.mesh.position);
    const m = c.mesh.material as THREE.MeshPhysicalMaterial; m.emissiveIntensity = 0.6;
    this.fx.emit({ at: c.mesh.position.clone(), count: 22, shape: ['star', 'spark'], color: [0xffffff, 0xffe28a, 0xb9a0ff], speed: [1, 2.6], life: [0.35, 0.7], size: [0.08, 0.16], drag: 1.5, spin: 4 });
  }
  /** Wrong: it shatters into shards. */
  shatter(id: number) {
    const c = this.crystals.get(id); if (!c || c.state !== 'fall') return;
    c.state = 'broken';
    const mat = c.mesh.material as THREE.MeshPhysicalMaterial;
    this.scene.remove(c.mesh); c.mesh.geometry.dispose();
    for (let i = 0; i < 9; i++) {
      const s = c.size * (0.25 + Math.random() * 0.25);
      const g = new THREE.TetrahedronGeometry(s, 0);
      const m = new THREE.Mesh(g, mat);
      m.position.copy(c.mesh.position);
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
      this.shards.push({ mesh: m, v: new THREE.Vector3(Math.cos(a) * (1.5 + Math.random() * 2), Math.sin(a) * 2 + 2, (Math.random() - 0.5) * 2), spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, Math.random() * 9), t: 0 });
      this.scene.add(m);
    }
    this.fx.emit({ at: c.mesh.position.clone(), count: 14, shape: ['shard', 'dot'], color: [0xffffff, 0xe0d4ff], speed: [1, 2.4], life: [0.3, 0.6], size: [0.06, 0.12], gravity: 3 });
    this.crystals.delete(id);
  }
  /** a happy flash of the basket (a new rule, a big combo) */
  cheer() {
    this.flash = 1;
    this.fx.emit({ at: this.basket.position.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 40, shape: ['star', 'heart', 'spark'], color: [0xffe066, 0xffffff, 0xff9ad5, 0x9fe6ff, 0xb48cff], speed: [1.2, 3], up: 1.6, life: [0.6, 1.1], size: [0.08, 0.16], gravity: 1.4, drag: 0.8, spin: 3 });
  }
  /** everything off the sky */
  clear() {
    for (const c of this.crystals.values()) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); (c.mesh.material as THREE.Material).dispose(); }
    this.crystals.clear();
  }
  get count() { return this.crystals.size; }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 52 : 40;
    this.camera.position.set(0, 0, 12);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.hh = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 12;
    this.hw = this.hh * this.camera.aspect;
    // the basket sits at the bottom, a little in from the edge
    const bs = Math.min(this.hw, this.hh) * 0.34;
    this.basket.scale.setScalar(bs);
    this.basket.position.set(0, -this.hh + bs * 0.2, 0.5);
    this.fx.setScale(h, this.camera.fov);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    const bottom = -this.hh - 1.2, target = this.basket.position.clone().add(new THREE.Vector3(0, 0.5 * this.basket.scale.y, 0));
    for (const c of [...this.crystals.values()]) {
      const m = c.mesh;
      if (c.state === 'fall') {
        const k = (this.t - c.t0) / c.fall;
        m.position.y = c.y0 + (bottom - c.y0) * k;
        m.position.x = c.x + Math.sin(this.t * 0.9 + c.rock) * 0.12;
        m.rotation.z += c.spin * dt;
        m.rotation.x = Math.sin(this.t * 1.3 + c.rock) * 0.28;
        m.rotation.y = Math.cos(this.t * 1.1 + c.rock) * 0.28;
        if (m.position.y <= bottom + 0.4) { c.state = 'gone'; c.st = 0; this.onFell?.(c.id); }
      } else if (c.state === 'caught') {
        c.st += dt / 0.55;
        const e = ease(c.st);
        m.position.lerpVectors(c.from, target, e);
        m.position.y += Math.sin(Math.min(1, c.st) * Math.PI) * 1.4;
        m.rotation.z += dt * 10;
        m.scale.setScalar(Math.max(0.001, c.size * (1 - e * 0.65)));
        if (c.st >= 1) {
          this.flash = Math.max(this.flash, 0.6);
          this.fx.emit({ at: target.clone(), count: 10, shape: 'spark', color: [0xffe28a, 0xffffff], speed: [0.6, 1.6], up: 1.2, life: [0.3, 0.6], size: [0.06, 0.12] });
          this.scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose();
          this.crystals.delete(c.id);
        }
      } else if (c.state === 'gone') {
        c.st += dt / 0.4;
        const mm = m.material as THREE.MeshPhysicalMaterial; mm.opacity = Math.max(0, 1 - c.st);
        const halo = m.children[0] as THREE.Sprite | undefined; if (halo) halo.material.opacity = 0.55 * mm.opacity;
        if (c.st >= 1) { this.scene.remove(m); m.geometry.dispose(); mm.dispose(); this.crystals.delete(c.id); }
      }
    }
    for (const s of this.shards) {
      s.t += dt;
      s.v.y -= 9 * dt;
      s.mesh.position.addScaledVector(s.v, dt);
      s.mesh.rotation.x += s.spin.x * dt; s.mesh.rotation.y += s.spin.y * dt; s.mesh.rotation.z += s.spin.z * dt;
      s.mesh.scale.setScalar(Math.max(0.001, 1 - s.t / 0.9));
    }
    for (const s of this.shards.filter(x => x.t >= 0.9)) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); }
    this.shards = this.shards.filter(x => x.t < 0.9);
    // the basket glows and bobs; it flashes on a catch
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.glow.material.opacity = 0.45 + Math.sin(this.t * 2.4) * 0.08 + this.flash * 0.55;
    this.basket.rotation.y = this.t * 0.25;
    this.basket.children[0].scale.setScalar(1 + this.flash * 0.08);
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  /** How long the next crystal has been falling (for its answer's time). */
  ageOf(id: number) { const c = this.crystals.get(id); return c ? (this.t - c.t0) * 1000 : 0; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.clear();
    for (const s of this.shards) { this.scene.remove(s.mesh); s.mesh.geometry.dispose(); }
    this.fx.dispose();
    this.mats.forEach(m => m.dispose());
    this.basket.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
