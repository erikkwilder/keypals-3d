// Balance Beam in 3D: a see-through renderer of its own over the painted Star Lab rooftop (the game's
// stage is an island world; this game happens on a terrace). A golden seesaw on a fluted brass pivot with
// a glowing star: a violet plank with brass trim and a brass tray at each end. Mystery boxes and brass
// weights drop onto the trays with a bounce; the beam swings on a spring, tips as the puzzle's clock runs,
// and swings back level when the box is named. Named boxes show their number and fly onto the Star Stack
// beside it (it grows with every right answer in a row and tumbles on a miss). The Comet Cat watches from
// a cushion and cheers. Star dust everywhere.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import type { GlimmerId } from '../adventure/glimmers';

const PIVOT_Y = 1.05, ARM = 2.15, TILT = 0.3;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const bounce = (x: number) => { const k = Math.min(1, Math.max(0, x)); return k < 0.72 ? Math.pow(k / 0.72, 2) : 1 - Math.sin(((k - 0.72) / 0.28) * Math.PI) * 0.1; };
/** weights as brass pieces: tens, fives and ones, biggest first */
const piecesOf = (v: number) => { const out: number[] = []; let l = v; for (const w of [10, 5, 1]) while (l >= w) { out.push(w); l -= w; } return out; };
const SIZE: Record<number, { r: number; h: number }> = { 10: { r: 0.27, h: 0.4 }, 5: { r: 0.235, h: 0.34 }, 1: { r: 0.2, h: 0.28 } };
const BOX = 0.44;

type Item = { mesh: THREE.Object3D; kind: 'box' | 'weight'; value: number; at: THREE.Vector3; from: THREE.Vector3; t: number; delay: number; spin: number };
type Flyer = { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; arc: number; spin: number; fade: boolean; land?: () => void };
type Tumbler = { mesh: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; t: number };

export class BalanceScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private fx = new Fx();
  private beam = new THREE.Group();
  private items: Item[] = [];
  private flyers: Flyer[] = [];
  private tumblers: Tumbler[] = [];
  private stack: THREE.Object3D[] = [];
  private stackAt = new THREE.Vector3(3.35, 0.36, 0.25);
  private pal: GlimmerModel | null = null;
  private palAt = new THREE.Vector3(-3.35, 0, 0.35);
  private star!: THREE.Mesh;
  private mats: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private faces = new Map<string, THREE.Texture>();
  private boxMats = new Map<string, THREE.Material[]>();
  private weightMats = new Map<number, THREE.Material[]>();
  private boxGeo: THREE.BufferGeometry;
  private wGeo = new Map<number, THREE.BufferGeometry>();
  private angle = 0; private vel = 0; private target = 0;
  private shakeT = 0; private glowT = 0;
  private raf = 0; private last = 0; private t = 0;
  private w = 1; private h = 1;
  tall = false;
  private disposed = false;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // twilight on the terrace: warm lantern light from the front left, a violet sky above, a gold rim
    this.scene.add(new THREE.HemisphereLight(0xf3e8ff, 0x9a7a5a, 1.55));
    const sun = new THREE.DirectionalLight(0xffeccc, 2.4);
    sun.position.set(-3, 7, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 25 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xc9b0ff, 1.1); rim.position.set(3, 4, -5); this.scene.add(rim);
    const glow = new THREE.PointLight(0xffd36b, 3, 4, 2); glow.position.set(0, PIVOT_Y + 0.4, 0.6); this.scene.add(glow);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.22 }));
    catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true;
    this.scene.add(catcher);
    this.boxGeo = new RoundedBoxGeometry(BOX, BOX, BOX, 4, 0.06);
    this.geos.push(this.boxGeo);
    this.build();
    this.scene.add(this.beam, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement, pal: GlimmerId = 'cometcat'): Promise<BalanceScene> {
    const s = new BalanceScene(canvas);
    try {
      const m = await GlimmerModel.create(pal, 1.25);
      if (s.disposed) { m.dispose(); return s; }
      m.fx = s.fx; m.face = s.camera.position; m.play('appear'); m.appearThen = 'idle';
      s.pal = m; s.scene.add(m.root);
    } catch { /* (no friend: the game plays without one) */ }
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  private mat<T extends THREE.Material>(m: T): T { this.mats.push(m); return m; }
  private geo<T extends THREE.BufferGeometry>(g: T): T { this.geos.push(g); return g; }

  /** The pivot, the seesaw, the trays, and the Star Stack's pedestal. */
  private build() {
    const brass = this.mat(new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.85, roughness: 0.28 }));
    const violet = this.mat(new THREE.MeshPhysicalMaterial({ color: 0x5b36c4, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
    const cream = this.mat(new THREE.MeshStandardMaterial({ color: 0xf6eedd, roughness: 0.6 }));
    const shadowy = (m: THREE.Mesh) => { m.castShadow = true; m.receiveShadow = true; return m; };
    // the pivot: a round foot, a fluted column, a cradle, and a glowing star
    const foot = shadowy(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 48)), brass)); foot.position.y = 0.08;
    const step = shadowy(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.44, 0.52, 0.12, 48)), violet)); step.position.y = 0.22;
    // the fulcrum: a violet wedge with brass edges, from the step up to the pivot
    const tri = new THREE.Shape(); tri.moveTo(-0.5, 0); tri.lineTo(0.5, 0); tri.lineTo(0.07, PIVOT_Y - 0.28); tri.lineTo(-0.07, PIVOT_Y - 0.28); tri.closePath();
    const wedge = shadowy(new THREE.Mesh(this.geo(new THREE.ExtrudeGeometry(tri, { depth: 0.56, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2 }).translate(0, 0, -0.28)), violet)); wedge.position.y = 0.28;
    const trim = shadowy(new THREE.Mesh(this.geo(new THREE.ExtrudeGeometry(tri, { depth: 0.04, bevelEnabled: false }).scale(1.06, 1.02, 1).translate(0, 0, 0.3)), brass)); trim.position.y = 0.27;
    const trimB = trim.clone(); trimB.position.z = -0.64;
    const cradle = shadowy(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.12, 0.12, 0.8, 24).rotateX(Math.PI / 2)), brass)); cradle.position.y = PIVOT_Y - 0.02;
    void cream;
    this.scene.add(foot, step, wedge, trim, trimB, cradle);
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 + Math.PI / 2, rr = i % 2 ? 0.12 : 0.27; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i) starShape.lineTo(x, y); else starShape.moveTo(x, y); }
    this.star = new THREE.Mesh(this.geo(new THREE.ExtrudeGeometry(starShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 })), this.mat(new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffb92e, emissiveIntensity: 0.8, metalness: 0.4, roughness: 0.25 })));
    this.star.position.set(0, PIVOT_Y * 0.62, 0.38);
    this.scene.add(this.star);
    // the seesaw: a violet plank with brass edges, and a brass tray at each end
    this.beam.position.set(0, PIVOT_Y + 0.12, 0);
    const plank = shadowy(new THREE.Mesh(this.geo(new RoundedBoxGeometry(ARM * 2 + 0.9, 0.14, 0.95, 3, 0.05)), violet));
    const edge = (z: number) => { const e = shadowy(new THREE.Mesh(this.geo(new RoundedBoxGeometry(ARM * 2 + 0.95, 0.06, 0.07, 2, 0.02)), brass)); e.position.set(0, 0.06, z); return e; };
    this.beam.add(plank, edge(0.47), edge(-0.47));
    // a brass stop at each end (so nothing slides off until it really tips) with a knob on it
    for (const s of [-1, 1]) {
      const stop = shadowy(new THREE.Mesh(this.geo(new RoundedBoxGeometry(0.08, 0.26, 0.95, 2, 0.03)), brass)); stop.position.set(s * (ARM + 0.68), 0.13, 0);
      const knob = shadowy(new THREE.Mesh(this.geo(new THREE.SphereGeometry(0.08, 16, 12)), brass)); knob.position.set(s * (ARM + 0.68), 0.3, 0);
      this.beam.add(stop, knob);
    }
    // the Star Stack's pedestal
    const ped = shadowy(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.36, 0.44, 0.3, 32)), violet)); ped.position.set(this.stackAt.x, 0.15, this.stackAt.z);
    const pedTop = shadowy(new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.4, 0.38, 0.06, 32)), brass)); pedTop.position.set(this.stackAt.x, 0.33, this.stackAt.z);
    ped.name = 'ped'; pedTop.name = 'pedTop';
    this.scene.add(ped, pedTop);
  }

  // ---------- the pieces ----------
  private faceTex(text: string, kind: 'box' | 'weight', lit = false): THREE.Texture {
    const key = `${kind}:${text}:${lit}`;
    const have = this.faces.get(key);
    if (have) return have;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d')!;
    if (kind === 'box') {
      const rg = g.createRadialGradient(128, 110, 20, 128, 128, 180);
      rg.addColorStop(0, lit ? '#ffe9a8' : '#a77bff'); rg.addColorStop(0.6, lit ? '#f2b33a' : '#6b3fd6'); rg.addColorStop(1, lit ? '#c47a12' : '#3f1f96');
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
      g.strokeStyle = lit ? '#fff6d0' : '#ffd25e'; g.lineWidth = 16; g.strokeRect(10, 10, 236, 236);
    } else {
      g.fillStyle = '#e2b450'; g.fillRect(0, 0, 256, 256);
      const rg = g.createRadialGradient(128, 128, 30, 128, 128, 140); rg.addColorStop(0, 'rgba(255,240,190,.7)'); rg.addColorStop(1, 'rgba(160,100,20,.5)');
      g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `bold ${text.length > 2 ? 110 : text.length > 1 ? 140 : 170}px Georgia, serif`;
    g.lineWidth = 12; g.strokeStyle = kind === 'box' ? (lit ? '#7a3f00' : '#2a0f70') : '#7a4a10';
    g.fillStyle = kind === 'box' ? '#fff' : '#4a2a04';
    if (kind === 'box') g.strokeText(text, 128, 138);
    g.fillText(text, 128, 138);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    this.faces.set(key, t);
    return t;
  }
  private boxMaterials(text: string, lit: boolean): THREE.Material[] {
    const key = `${text}:${lit}`;
    let m = this.boxMats.get(key);
    if (!m) {
      const face = this.mat(new THREE.MeshPhysicalMaterial({ map: this.faceTex(text, 'box', lit), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, emissive: lit ? 0xffb02a : 0x4a22b0, emissiveIntensity: lit ? 0.45 : 0.18 }));
      const side = this.mat(new THREE.MeshPhysicalMaterial({ map: this.faceTex('', 'box', lit), roughness: 0.3, clearcoat: 1, emissive: lit ? 0xffb02a : 0x4a22b0, emissiveIntensity: lit ? 0.35 : 0.14 }));
      m = [side, side, face, side, face, side];
      this.boxMats.set(key, m);
    }
    return m;
  }
  private weightMesh(v: number): THREE.Mesh {
    let g = this.wGeo.get(v);
    const { r, h } = SIZE[v];
    if (!g) {
      const pts = [[0, 0], [r * 0.97, 0], [r, h * 0.06], [r, h * 0.66], [r * 0.9, h * 0.76], [r * 0.4, h * 0.8], [r * 0.34, h * 0.84], [r * 0.48, h * 0.93], [r * 0.44, h], [0, h * 1.02]];
      g = this.geo(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 32));
      this.wGeo.set(v, g);
    }
    let m = this.weightMats.get(v);
    if (!m) { m = [this.mat(new THREE.MeshStandardMaterial({ color: 0xd9a844, metalness: 0.8, roughness: 0.26 }))]; this.weightMats.set(v, m); }
    const mesh = new THREE.Mesh(g, m[0]);
    // its number on a little disc on the front
    const label = new THREE.Mesh(this.geo(new THREE.CircleGeometry(r * 0.62, 24)), this.mat(new THREE.MeshStandardMaterial({ map: this.faceTex(String(v), 'weight'), metalness: 0.4, roughness: 0.4 })));
    label.position.set(0, h * 0.36, r * 1.005);
    mesh.add(label);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  /** where things sit on the plank, from its outer end inward, two deep: boxes first (one layer), then
   *  weights (`cols` across, in layers stacked on each other) */
  private spot(side: -1 | 1, col: number, row: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(side * (ARM + 0.34 - col * 0.58), 0.07 + y, (row - 0.5) * 0.52);
  }

  /** Clear the beam and drop a new puzzle's boxes and weights onto it. */
  load(boxes: number, left: number, right: number) {
    for (const it of this.items) this.flyAway(it.mesh, true);
    this.items = [];
    const add = (mesh: THREE.Object3D, kind: Item['kind'], value: number, at: THREE.Vector3, delay: number) => {
      const from = at.clone().add(new THREE.Vector3(0, 2.4, 0));
      mesh.position.copy(from);
      this.beam.add(mesh);
      this.items.push({ mesh, kind, value, at, from, t: 0, delay, spin: (Math.random() - 0.5) * 3 });
    };
    // boxes first on the left, then the weights on top of them; the right side's weights
    for (let i = 0; i < boxes; i++) { const m = new THREE.Mesh(this.boxGeo, this.boxMaterials('?', false)); m.castShadow = true; m.receiveShadow = true; m.userData.box = true; add(m, 'box', 0, this.spot(-1, Math.floor(i / 2), i % 2, BOX / 2), i * 0.12); }
    const lw = piecesOf(left), rw = piecesOf(right), c0 = Math.ceil(boxes / 2);
    // (weights: the biggest at the bottom of each pile; two piles across on the left, three on the right)
    lw.forEach((v, i) => { const layer = Math.floor(i / 4), k = i % 4; add(this.weightMesh(v), 'weight', v, this.spot(-1, c0 + (k >> 1), k % 2, layer * 0.42), 0.25 + i * 0.08); });
    rw.forEach((v, i) => { const layer = Math.floor(i / 6), k = i % 6; add(this.weightMesh(v), 'weight', v, this.spot(1, k >> 1, k % 2, layer * 0.42), 0.1 + i * 0.07); });
    this.target = 0;
  }
  /** How far over the beam is (-1 left down .. 1 right down), as the puzzle's clock runs. */
  setTip(t: number) { this.target = Math.max(-1, Math.min(1, t)) * TILT; }
  /** Wrong: a jolt and a shake, and the Star Stack tumbles. */
  wrong() {
    this.shakeT = 0.45;
    this.vel += Math.sign(this.target || 1) * 0.6;
    this.pal?.play('sad');
    this.topple();
  }
  /** Named it: the boxes light up with their number, the beam swings level, star dust, and the boxes fly
   *  to the Star Stack (`stackBoxes` of them stay there: one for each right answer in a row). */
  solve(value: number, stack = true) {
    this.target = 0;
    this.vel += -this.angle * 2.2;
    this.glowT = 1;
    this.pal?.play('happy');
    const boxes = this.items.filter(i => i.kind === 'box');
    for (const b of boxes) (b.mesh as THREE.Mesh).material = this.boxMaterials(String(value), true);
    const world = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    for (const b of boxes) this.fx.emit({ at: world(b.mesh), count: 26, shape: ['star', 'spark'], color: [0xffe27a, 0xffffff, 0xc9a6ff], speed: [1, 2.6], up: 1.5, life: [0.6, 1.2], size: [0.06, 0.14], gravity: 1.4, drag: 0.8, spin: 3 });
    this.fx.emit({ at: new THREE.Vector3(0, PIVOT_Y + 0.4, 0.5), count: 30, shape: 'star', color: [0xffd36b, 0xffffff], speed: [1.5, 3], up: 2, life: [0.8, 1.4], size: [0.08, 0.16], gravity: 1, drag: 0.6, spin: 4 });
    // after a beat: the first box goes to the stack, the rest of the beam clears
    setTimeout(() => {
      if (this.disposed) return;
      const first = boxes[0];
      for (const it of this.items) if (it !== first || !stack) this.flyAway(it.mesh, true);
      if (first && stack) {
        const from = world(first.mesh);
        this.beam.remove(first.mesh); first.mesh.position.copy(from); this.scene.add(first.mesh);
        const to = this.stackAt.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.04, BOX / 2 + 0.03 + this.stack.length * BOX * 0.98, 0));
        const mesh = first.mesh;
        this.flyers.push({ mesh, from, to, t: 0, dur: 0.6, arc: 1.4, spin: 0, fade: false, land: () => {
          this.stack.push(mesh);
          this.fx.emit({ at: to.clone(), count: 14, shape: ['star', 'spark'], color: [0xffd36b, 0xffffff], speed: [0.6, 1.6], life: [0.4, 0.8], size: [0.05, 0.1] });
          if (this.stack.length % 5 === 0) this.fx.emit({ at: to.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 60, shape: ['star', 'heart', 'spark'], color: [0xffe27a, 0xff9fd0, 0xc9a6ff, 0xffffff], speed: [1.5, 3.5], up: 2.5, life: [0.8, 1.6], size: [0.08, 0.18], gravity: 1.2, drag: 0.6, spin: 4 });
        } });
      }
      this.items = [];
    }, 650);
  }
  /** Tipped all the way: everything slides off the low end. */
  crash() {
    const dir = Math.sign(this.angle || 1);
    for (const it of this.items) {
      const p = it.mesh.getWorldPosition(new THREE.Vector3());
      this.beam.remove(it.mesh); it.mesh.position.copy(p); this.scene.add(it.mesh);
      this.tumblers.push({ mesh: it.mesh, v: new THREE.Vector3(-dir * (1.6 + Math.random()), 0.6 + Math.random(), (Math.random() - 0.5) * 1.2), w: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), t: 0 });
    }
    this.items = [];
    this.shakeT = 0.5;
    this.pal?.play('sad');
    this.topple();
    this.target = 0;
  }
  /** The Star Stack falls over (a miss). */
  private topple() {
    for (const m of this.stack) this.tumblers.push({ mesh: m, v: new THREE.Vector3(0.8 + Math.random() * 1.4, 1 + Math.random(), (Math.random() - 0.3) * 1.5), w: new THREE.Vector3(Math.random() * 5, Math.random() * 5, Math.random() * 5), t: 0 });
    this.stack = [];
  }
  private flyAway(mesh: THREE.Object3D, fade: boolean) {
    const from = mesh.getWorldPosition(new THREE.Vector3());
    mesh.parent?.remove(mesh); mesh.position.copy(from); this.scene.add(mesh);
    this.flyers.push({ mesh, from, to: from.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.5, 2.5, -1.5)), t: 0, dur: 0.55, arc: 0.4, spin: 6, fade });
  }
  /** The whole thing is over: clear everything. */
  clear() { for (const it of this.items) this.flyAway(it.mesh, true); this.items = []; this.topple(); this.target = 0; }

  /** Where a spot above each end of the beam is on the screen (px in the canvas), for its label. */
  labelAt(side: -1 | 1): { x: number; y: number } {
    const p = new THREE.Vector3(side * (ARM - 0.3), -0.5, 0.6).applyMatrix4(this.beam.matrixWorld).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }
  /** Where the Star Stack's top is on the screen. */
  stackTop(): { x: number; y: number } {
    const p = this.stackAt.clone().add(new THREE.Vector3(0, BOX * (this.stack.length + 0.25), 0)).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h };
  }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.tall = aspect < 0.9;
    this.camera.aspect = aspect;
    this.camera.fov = this.tall ? 46 : 34;
    // fit the beam, the stack and the friend across the width (on a phone, the beam alone)
    const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const span = this.tall ? 3.05 : 4.1;
    const dist = span / Math.tan(half);
    const look = new THREE.Vector3(0, this.tall ? 1.15 : 1.0, 0);
    this.camera.position.copy(look).add(new THREE.Vector3(0, 0.42, 1).normalize().multiplyScalar(Math.max(this.tall ? 6.5 : 7.5, dist)));
    this.camera.lookAt(look.x, look.y - (this.tall ? 0.15 : 0.05), look.z);
    this.camera.updateProjectionMatrix();
    // on a phone the stack and the friend tuck in closer, in front
    this.stackAt.set(this.tall ? 1.55 : 3.35, 0.36, this.tall ? 1.35 : 0.25);
    this.palAt.set(this.tall ? -1.6 : -3.05, 0, this.tall ? 1.3 : 0.9);
    for (const n of ['ped', 'pedTop']) { const o = this.scene.getObjectByName(n); if (o) { o.position.x = this.stackAt.x; o.position.z = this.stackAt.z; } }
    this.stack.forEach((m, i) => m.position.set(this.stackAt.x, BOX / 2 + 0.03 + this.stackAt.y + i * BOX * 0.98 - 0.36, this.stackAt.z));
    for (const n of ['ped', 'pedTop']) { const o = this.scene.getObjectByName(n); if (o) o.scale.setScalar(this.tall ? 0.8 : 1); }
    this.fx.setScale(h, this.camera.fov);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    // the beam on a spring toward where the puzzle's clock has it, a little shake on a wrong answer
    this.vel += ((this.target - this.angle) * 38 - this.vel * 6.5) * dt;
    this.angle += this.vel * dt;
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.beam.rotation.z = -this.angle + Math.sin(this.shakeT * 55) * 0.035 * (this.shakeT / 0.45);
    this.glowT = Math.max(0, this.glowT - dt * 0.8);
    this.star.rotation.y = Math.sin(this.t * 1.3) * 0.35;
    (this.star.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + this.glowT * 1.5 + Math.sin(this.t * 3) * 0.1;
    for (const it of this.items) {
      if (it.delay > 0) { it.delay -= dt; continue; }
      const was = it.t;
      it.t = Math.min(1, it.t + dt / 0.5);
      it.mesh.position.lerpVectors(it.from, it.at, bounce(it.t));
      it.mesh.rotation.y = (1 - ease(it.t)) * it.spin;
      if (was < 0.72 && it.t >= 0.72) {
        const w = it.mesh.getWorldPosition(new THREE.Vector3());
        this.fx.emit({ at: w, count: 6, shape: 'spark', color: [0xffe28a, 0xffffff], speed: [0.4, 1], life: [0.25, 0.5], size: [0.04, 0.08] });
        this.vel += (it.at.x < 0 ? -1 : 1) * 0.06;
      }
    }
    for (const f of this.flyers) {
      f.t += dt / f.dur;
      const e = ease(f.t);
      f.mesh.position.lerpVectors(f.from, f.to, e);
      f.mesh.position.y += Math.sin(Math.min(1, f.t) * Math.PI) * f.arc;
      f.mesh.rotation.y += dt * f.spin;
      if (f.fade) f.mesh.scale.setScalar(Math.max(0.001, 1 - e));
      if (f.t >= 1) { f.land?.(); if (f.fade) f.mesh.parent?.remove(f.mesh); }
    }
    this.flyers = this.flyers.filter(f => f.t < 1);
    for (const tb of this.tumblers) {
      tb.t += dt; tb.v.y -= 9 * dt;
      tb.mesh.position.addScaledVector(tb.v, dt);
      tb.mesh.rotation.x += tb.w.x * dt; tb.mesh.rotation.z += tb.w.z * dt;
      if (tb.t > 0.8) tb.mesh.scale.setScalar(Math.max(0.001, 1 - (tb.t - 0.8) * 2.5));
    }
    for (const tb of this.tumblers.filter(x => x.t > 1.2)) tb.mesh.parent?.remove(tb.mesh);
    this.tumblers = this.tumblers.filter(x => x.t <= 1.2);
    // the stack sways a little as it grows
    this.stack.forEach((m, i) => { m.rotation.z = Math.sin(this.t * 2 + i * 0.6) * 0.02 * i; });
    if (this.pal) { this.pal.root.position.set(this.palAt.x, 0, this.palAt.z); this.pal.root.rotation.y = 0.5 * (this.tall ? 0.4 : 1); this.pal.update(dt, this.t); }
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.pal?.dispose();
    this.fx.dispose();
    this.faces.forEach(t => t.dispose());
    this.mats.forEach(m => m.dispose());
    this.geos.forEach(g => g.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
