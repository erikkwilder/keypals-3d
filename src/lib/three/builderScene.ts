// Number Builder in 3D (and the Playground's Block Table): a wooden place value mat on the workbench of the
// crystal cave workshop, with three trays: hundreds, tens and ones. Blocks are made of real little cubes,
// each with the painted block face (a rod really is ten cubes, a flat ten by ten), so kids can count them.
// A block drops in with a bounce; tapping one lifts it off; ten ones on the mat slide together into a
// rod (and ten rods stack into a flat) with a flash. A Geode Mole helps from behind the mat. A renderer of
// its own over the painted workshop, like Pizza Rush's.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import type { GlimmerId } from '../adventure/glimmers';

export type Kind = 'h' | 't' | 'o';
const U = 0.15, GAP = 0.006;
/** the trays' middles along the mat (x), and the mat's size */
const COL: Record<Kind, number> = { h: -1.75, t: 0.35, o: 1.95 };
const MAT_W = 5.7, MAT_D = 2.25;
const COLOR: Record<Kind, number> = { h: 0x9fe0b4, t: 0xa9d8ff, o: 0xffe7a0 };

type Block = { kind: Kind; mesh: THREE.Mesh; at: THREE.Vector3; to: THREE.Vector3; vy: number; drop: number; leaving: number; flash: number };

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/** n x m x k little cubes merged into one block, each cube's faces showing the whole painted face */
function cubes(nx: number, ny: number, nz: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const s = U - GAP;
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    // only the cubes you can see (the outside of the block)
    if (x > 0 && x < nx - 1 && y > 0 && y < ny - 1 && z > 0 && z < nz - 1) continue;
    const g = new THREE.BoxGeometry(s, s, s);
    g.translate((x - (nx - 1) / 2) * U, (y - (ny - 1) / 2) * U, (z - (nz - 1) / 2) * U);
    parts.push(g);
  }
  const m = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return m;
}

export class BuilderScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private fx = new Fx();
  private geo: Record<Kind, THREE.BufferGeometry>;
  private mats: Record<Kind, THREE.MeshStandardMaterial>;
  private blocks: Block[] = [];
  private gone: Block[] = [];
  private mat = new THREE.Group();
  private helper: GlimmerModel | null = null;
  private raf = 0; private last = 0; private t = 0;
  private ray = new THREE.Raycaster();
  private w = 1; private h = 1;
  private shakeT = 0;
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
    // the workshop's light: warm lanterns from the left, cool crystal glow from behind
    this.scene.add(new THREE.HemisphereLight(0xfff2dc, 0x8a5a36, 1.45));
    const key = new THREE.DirectionalLight(0xffe6c0, 2.5);
    key.position.set(-3, 7, 4); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 4, bottom: -4, near: 0.5, far: 20 });
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fd0ff, 0.9); rim.position.set(3, 3, -5); this.scene.add(rim);
    this.geo = { o: cubes(1, 1, 1), t: cubes(1, 1, 10), h: cubes(10, 1, 10) };
    this.mats = {} as Record<Kind, THREE.MeshStandardMaterial>;
    for (const k of ['h', 't', 'o'] as Kind[]) this.mats[k] = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.32, metalness: 0, emissive: 0xffd36b, emissiveIntensity: 0 });
    this.scene.add(this.mat, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement, helper: GlimmerId | null = 'geodemole'): Promise<BuilderScene> {
    const s = new BuilderScene(canvas);
    const [fo, ft, fh, wood] = await Promise.all([loadTexture('math/place/face-one.webp', { color: true }), loadTexture('math/place/face-ten.webp', { color: true }), loadTexture('math/place/face-hundred.webp', { color: true }), loadTexture('learn/ep/tex-cave.webp', { repeat: true, color: true })]);
    s.mats.o.map = fo; s.mats.t.map = ft; s.mats.h.map = fh;
    for (const k of ['h', 't', 'o'] as Kind[]) s.mats[k].needsUpdate = true;
    s.buildMat(wood);
    if (helper) {
      const m = await GlimmerModel.create(helper, 0.95).catch(() => null);
      if (m && !s.disposed) { m.fx = s.fx; m.play('appear'); m.appearThen = 'idle'; m.face = s.camera.position; m.root.position.set(-0.15, 0, -1.75); s.scene.add(m.root); s.helper = m; }
    }
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  /** The mat: a wooden board with three felt trays and little rails between them. */
  private buildMat(wood: THREE.Texture | null) {
    if (wood) { wood.repeat.set(3, 1.2); wood.anisotropy = 4; }
    const woodMat = new THREE.MeshStandardMaterial({ map: wood, color: wood ? 0xffffff : 0xc8874a, roughness: 0.78 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(MAT_W, 0.12, MAT_D), woodMat);
    board.position.y = -0.06; board.receiveShadow = true; board.castShadow = true;
    this.mat.add(board);
    const widths: Record<Kind, number> = { h: 2.15, t: 1.85, o: 1.25 };
    for (const k of ['h', 't', 'o'] as Kind[]) {
      const felt = new THREE.Mesh(new THREE.BoxGeometry(widths[k], 0.02, MAT_D - 0.25), new THREE.MeshStandardMaterial({ color: COLOR[k], roughness: 0.95 }));
      felt.position.set(COL[k], 0.005, 0); felt.receiveShadow = true;
      this.mat.add(felt);
    }
    for (const x of [-0.65, 1.32]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, MAT_D - 0.1), woodMat);
      rail.position.set(x, 0.05, 0); rail.castShadow = true; rail.receiveShadow = true;
      this.mat.add(rail);
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.25 }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = -0.13; shadow.receiveShadow = true;
    this.scene.add(shadow);
  }

  /** Where the i-th block of a kind sits (the trays fill in a set pattern so they're easy to count). */
  private slot(kind: Kind, i: number): THREE.Vector3 {
    if (kind === 'h') return new THREE.Vector3(COL.h + i * 0.012, U / 2 + i * (U + 0.004), i * 0.012);
    if (kind === 't') return new THREE.Vector3(COL.t - 0.75 + (i % 9) * 0.188, U / 2 + Math.floor(i / 9) * U, 0);
    // ones: two columns of five in the middle, more columns either side for any over ten (until they trade)
    const c = Math.floor(i / 5) % 4, r = i % 5;
    return new THREE.Vector3(COL.o + [-0.14, 0.14, 0.42, -0.42][c], U / 2 + Math.floor(i / 20) * U, -0.62 + r * 0.31);
  }
  private count(kind: Kind) { return this.blocks.filter(b => b.kind === kind && b.leaving < 0).length; }

  /** A block drops in. */
  add(kind: Kind, from?: THREE.Vector3) {
    const i = this.count(kind);
    const to = this.slot(kind, i);
    const mesh = new THREE.Mesh(this.geo[kind], this.mats[kind].clone());
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.userData.block = true;
    const at = from ? from.clone() : to.clone().add(new THREE.Vector3(0, 1.4, 0));
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.blocks.push({ kind, mesh, at, to, vy: 0, drop: from ? 1 : 0, leaving: -1, flash: 0 });
  }
  /** The last block of a kind lifts off and is gone. */
  remove(kind: Kind): boolean {
    const list = this.blocks.filter(b => b.kind === kind && b.leaving < 0);
    const b = list.at(-1);
    if (!b) return false;
    b.leaving = 0;
    this.fx.emit({ at: b.mesh.position.clone(), count: 10, shape: ['dot', 'spark'], color: [COLOR[kind], 0xffffff], speed: [0.4, 1.2], up: 0.8, life: [0.3, 0.5], size: [0.03, 0.06], drag: 2 });
    return true;
  }
  /** Ten of a kind come together into the next one up (ten ones make a rod, ten rods a flat). */
  trade(kind: 'o' | 't') {
    const up: Kind = kind === 'o' ? 't' : 'h';
    const ten = this.blocks.filter(b => b.kind === kind && b.leaving < 0).slice(0, 10);
    if (ten.length < 10) return;
    const target = this.slot(up, this.count(up));
    // they slide together into the shape of the new block, flash, and become it
    ten.forEach((b, k) => {
      const off = kind === 'o' ? new THREE.Vector3(0, 0, (k - 4.5) * U) : new THREE.Vector3((k - 4.5) * U, 0, 0);
      b.to = target.clone().add(off).setY(target.y);
      b.leaving = -2;
    });
    setTimeout(() => {
      if (this.disposed) return;
      for (const b of ten) { this.scene.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); this.blocks.splice(this.blocks.indexOf(b), 1); }
      this.add(up, target.clone());
      const nb = this.blocks.at(-1)!; nb.flash = 1;
      this.fx.emit({ at: target.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 46, shape: ['star', 'spark', 'dot'], color: [COLOR[up], 0xffffff, 0xffd36b], speed: [1, 2.6], up: 1.4, life: [0.5, 1], size: [0.05, 0.12], drag: 1.2, spin: 3 });
      // the rest of that kind close up the gap
      this.relayout(kind);
    }, 650);
  }
  /** One block breaks into ten of the next one down (a rod into ten ones, a flat into ten rods). */
  split(kind: 't' | 'h') {
    const b = this.blocks.filter(x => x.kind === kind && x.leaving < 0).at(-1);
    if (!b) return;
    const from = b.mesh.position.clone();
    b.leaving = 0;
    const down: Kind = kind === 't' ? 'o' : 't';
    for (let k = 0; k < 10; k++) this.add(down, from.clone().add(kind === 't' ? new THREE.Vector3(0, 0.12, (k - 4.5) * U) : new THREE.Vector3((k - 4.5) * U, 0.12, 0)));
    this.fx.emit({ at: from.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 30, shape: ['spark', 'dot'], color: [COLOR[down], 0xffffff], speed: [0.8, 2], up: 1, life: [0.4, 0.8], size: [0.04, 0.09], drag: 1.5 });
  }
  /** Put every block of a kind back in its place in the pattern. */
  private relayout(kind: Kind) {
    this.blocks.filter(b => b.kind === kind && b.leaving < 0).forEach((b, i) => { b.to = this.slot(kind, i); });
  }
  /** Clear the mat and build a number straight away (the "10 more" orders start with one). */
  set(h: number, t: number, o: number) {
    for (const b of this.blocks) { this.scene.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); }
    this.blocks = [];
    for (let i = 0; i < h; i++) this.add('h');
    for (let i = 0; i < t; i++) this.add('t');
    for (let i = 0; i < o; i++) this.add('o');
    this.blocks.forEach((b, k) => { b.drop = -k * 0.03; });
  }
  /** Which kind of block is under a tap (null: none). */
  tap(x: number, y: number): Kind | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), this.camera);
    const hit = this.ray.intersectObjects(this.blocks.filter(b => b.leaving < 0).map(b => b.mesh), false)[0];
    return hit ? this.blocks.find(b => b.mesh === hit.object)?.kind ?? null : null;
  }
  /** A right build: every block glows and the helper cheers. */
  cheer() {
    for (const b of this.blocks) b.flash = 1;
    this.helper?.play('happy');
    this.fx.emit({ at: new THREE.Vector3(0, 0.6, 0), count: 70, shape: ['star', 'heart', 'spark'], color: [0xffd36b, 0x9fe0b4, 0xa9d8ff, 0xffffff], speed: [1.2, 3], up: 1.6, life: [0.6, 1.2], size: [0.06, 0.14], gravity: 1.4, drag: 0.8, spin: 3, spread: 2.4 });
  }
  /** Not quite: the mat gives a little shake and the helper looks worried. */
  shake() { this.shakeT = 0.4; this.helper?.play('sad'); }
  /** Where a tray's front edge is on the screen (px): its bin of blocks goes just below. */
  trayAt(kind: Kind): { x: number; y: number } {
    const p = new THREE.Vector3(COL[kind], -0.12, MAT_D / 2).project(this.camera);
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
      // a phone: back off until the mat fills the screen's width, looking down a little more
      this.camera.fov = 44;
      const half = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      const d = (MAT_W / 2 + 0.15) / Math.tan(half);
      this.camera.position.copy(new THREE.Vector3(0, 1.35, 1).normalize().multiplyScalar(d)).add(new THREE.Vector3(0, 0, 0.2));
      this.camera.lookAt(0, 0.1, -0.35);
      this.helper?.root.position.set(-0.15, 0, -1.6);
    } else {
      this.camera.fov = 34;
      this.camera.position.set(0, 4.6, 5.6);
      this.camera.lookAt(0, 0.15, -0.35);
      this.helper?.root.position.set(-0.15, 0, -1.75);
    }
    this.camera.updateProjectionMatrix();
    this.fx.setScale(h, this.camera.fov);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000); this.last = now; this.t += dt;
    for (const b of this.blocks) {
      if (b.leaving >= 0) continue;
      if (b.drop < 1) {
        // falling in, with a little bounce at the bottom
        b.drop = Math.min(1, b.drop + dt * 2.6);
        const k = Math.max(0, b.drop), y = b.to.y + (1 - ease(k)) * 1.4 + Math.sin(Math.min(1, k) * Math.PI) * 0.06 * (k > 0.7 ? 1 : 0);
        b.mesh.position.set(b.to.x, y, b.to.z);
      } else {
        b.mesh.position.lerp(b.to, 1 - Math.exp(-dt * (b.leaving === -2 ? 9 : 12)));
      }
      const m = b.mesh.material as THREE.MeshStandardMaterial;
      if (b.flash > 0) { b.flash = Math.max(0, b.flash - dt * 1.4); m.emissiveIntensity = b.flash * 0.55; }
      // squash on landing
      const land = b.drop >= 1 ? 0 : Math.max(0, (b.drop - 0.75) * 4);
      b.mesh.scale.set(1 + land * 0.06, 1 - land * 0.1, 1 + land * 0.06);
    }
    for (const b of this.blocks.filter(x => x.leaving >= 0)) {
      b.leaving += dt * 3;
      b.mesh.position.y += dt * 2.2;
      b.mesh.scale.setScalar(Math.max(0.01, 1 - b.leaving));
      if (b.leaving >= 1) { this.scene.remove(b.mesh); (b.mesh.material as THREE.Material).dispose(); this.blocks.splice(this.blocks.indexOf(b), 1); }
    }
    if (this.shakeT > 0) { this.shakeT = Math.max(0, this.shakeT - dt); this.mat.position.x = Math.sin(this.t * 60) * this.shakeT * 0.12; } else this.mat.position.x = 0;
    this.helper?.update(dt, this.t);
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.helper?.dispose();
    this.fx.dispose();
    for (const b of this.blocks) (b.mesh.material as THREE.Material).dispose();
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.block && !m.userData.glimmer) m.geometry?.dispose(); });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
