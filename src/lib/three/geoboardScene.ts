// Shape Builder in 3D: a wooden geoboard on the crystal workshop's table, a grid of golden pegs, and
// glowing bands you stretch from peg to peg. Close the band and the shape fills with crystal; its corners
// light up. A see-through renderer of its own over the painted workshop.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { facetTexture, TILE_TINT } from './shapeTiles';
import type { P } from '../math/shapes/geo';

export const PEGS = 7;
const GAP = 0.42, BOARD = GAP * (PEGS - 1) + 0.5, PEG_H = 0.11, BAND_Y = 0.075;

export class GeoboardScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  private board = new THREE.Group();
  private pegs: THREE.Mesh[] = [];
  private band: THREE.Mesh | null = null;
  private fill: THREE.Mesh | null = null;
  private fx = new Fx();
  private raf = 0; private last = 0; private t = 0;
  private w = 1; private h = 1;
  private pmrem: THREE.PMREMGenerator;
  private disposed = false;
  private pulse = 0;
  tint: keyof typeof TILE_TINT = 'teal';

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    this.pmrem = new THREE.PMREMGenerator(r);
    this.scene.environment = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.5;
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 1.2));
    const sun = new THREE.DirectionalLight(0xffe8c8, 2.4);
    sun.position.set(-2, 6, 3); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 15 });
    this.scene.add(sun);
    this.scene.add(this.board, this.fx.root);
  }

  static async create(canvas: HTMLCanvasElement): Promise<GeoboardScene> {
    const s = new GeoboardScene(canvas);
    const wood = await loadTexture('learn/ep/tex-peaks.webp', { repeat: true });
    s.build(wood);
    s.resize();
    s.raf = requestAnimationFrame(s.frame);
    return s;
  }

  private build(wood: THREE.Texture | null) {
    if (wood) { wood.colorSpace = THREE.SRGBColorSpace; wood.repeat.set(1.5, 1.5); }
    const top = new THREE.MeshStandardMaterial({ map: wood, color: wood ? 0xffffff : 0xd9a066, roughness: 0.6 });
    const edge = new THREE.MeshStandardMaterial({ map: wood, color: 0xc08a50, roughness: 0.7 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BOARD, 0.12, BOARD), [edge, edge, top, edge, edge, edge]);
    slab.position.y = -0.06; slab.receiveShadow = true; slab.castShadow = true;
    this.board.add(slab);
    // a raised rim
    const rimM = new THREE.MeshStandardMaterial({ map: wood, color: 0xb67a40, roughness: 0.55 });
    for (const [w, d, x, z] of [[BOARD + 0.12, 0.06, 0, -BOARD / 2 - 0.03], [BOARD + 0.12, 0.06, 0, BOARD / 2 + 0.03], [0.06, BOARD, -BOARD / 2 - 0.03, 0], [0.06, BOARD, BOARD / 2 + 0.03, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), rimM); m.position.set(x, 0.0, z); m.castShadow = true; m.receiveShadow = true; this.board.add(m);
    }
    const pegM = new THREE.MeshPhysicalMaterial({ color: 0xffcf5a, metalness: 0.6, roughness: 0.25, clearcoat: 0.6 });
    const pegG = new THREE.CylinderGeometry(0.035, 0.04, PEG_H, 16); pegG.translate(0, PEG_H / 2, 0);
    const capG = new THREE.SphereGeometry(0.048, 16, 10);
    for (let j = 0; j < PEGS; j++) for (let i = 0; i < PEGS; i++) {
      const peg = new THREE.Mesh(pegG, pegM.clone());
      peg.position.copy(this.pegAt([i, j]));
      peg.castShadow = true;
      const cap = new THREE.Mesh(capG, peg.material); cap.position.y = PEG_H; peg.add(cap);
      this.board.add(peg); this.pegs.push(peg);
    }
  }
  /** a peg's place (grid i, j) on the board */
  pegAt([i, j]: P) { return new THREE.Vector3((i - (PEGS - 1) / 2) * GAP, 0, (j - (PEGS - 1) / 2) * GAP); }
  /** a place on the board on the canvas */
  toScreen(v: THREE.Vector3) { const p = v.clone().project(this.camera); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h }; }
  /** a peg's top on the canvas */
  pegScreen(p: P) { this.board.updateMatrixWorld(); return this.toScreen(this.board.localToWorld(this.pegAt(p).add(new THREE.Vector3(0, PEG_H + 0.05, 0)))); }
  /** a peg's place in the world (the board may sit off-centre) */
  private world(p: P, y: number) { this.board.updateMatrixWorld(); return this.board.localToWorld(this.pegAt(p).setY(y)); }
  /** The peg nearest a point on the canvas (within reach), or null. */
  pegNear(cx: number, cy: number): P | null {
    const r = this.canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top;
    let best: P | null = null, bd = Infinity;
    for (let j = 0; j < PEGS; j++) for (let i = 0; i < PEGS; i++) {
      const s = this.pegScreen([i, j]), d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = [i, j]; }
    }
    const reach = Math.max(26, (this.pegScreen([1, 3]).x - this.pegScreen([0, 3]).x) * 0.55);
    return bd < reach ? best : null;
  }

  /** Show the band through these pegs (closed: a shape, filled with crystal). */
  setBand(pts: P[], closed: boolean) {
    for (const m of [this.band, this.fill]) if (m) { m.removeFromParent(); m.geometry.dispose(); }
    this.band = this.fill = null;
    this.pegs.forEach(p => ((p.material as THREE.MeshPhysicalMaterial).emissive.setHex(0x000000)));
    for (const q of pts) { const k = q[1] * PEGS + q[0]; (this.pegs[k].material as THREE.MeshPhysicalMaterial).emissive.setHex(0xffa020); (this.pegs[k].material as THREE.MeshPhysicalMaterial).emissiveIntensity = 0.6; }
    if (pts.length < 2) return;
    const path = (closed ? [...pts, pts[0]] : pts).map(p => this.pegAt(p).setY(BAND_Y));
    const curve = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < path.length - 1; i++) curve.add(new THREE.LineCurve3(path[i], path[i + 1]));
    const c = new THREE.Color(TILE_TINT[this.tint]);
    this.band = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, (path.length - 1) * 8), 0.022, 8, false), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 }));
    this.band.castShadow = true;
    this.board.add(this.band);
    if (closed && pts.length >= 3) {
      const shape = new THREE.Shape(pts.map(p => { const v = this.pegAt(p); return new THREE.Vector2(v.x, -v.z); }));
      const g = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.01, bevelSegments: 2 });
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.8, uv.getY(i) * 0.8);
      this.fill = new THREE.Mesh(g, new THREE.MeshPhysicalMaterial({ color: c, map: facetTexture(), roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.3, emissive: c, emissiveIntensity: 0.12, transparent: true, opacity: 0.88 }));
      this.fill.position.y = 0.012;
      this.fill.receiveShadow = true;
      this.board.add(this.fill);
      this.pulse = 1;
    }
  }
  /** sparkles round the shape (a build done) */
  celebrate(pts: P[]) {
    for (const p of pts) this.fx.emit({ at: this.world(p, 0.15), count: 10, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0x9fe6ff], speed: [0.4, 1.2], up: 1.2, life: [0.5, 0.9], size: [0.03, 0.06], gravity: 1, drag: 1.2, spin: 3 });
  }
  pop(p: P) { this.fx.emit({ at: this.world(p, 0.16), count: 6, shape: 'spark', color: [0xffe28a, 0xffffff], speed: [0.2, 0.6], up: 0.6, life: [0.25, 0.45], size: [0.02, 0.04] }); }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // the board fills the middle: from above and in front, nearer on a phone
    const tall = aspect < 0.9;
    this.camera.fov = tall ? 44 : 32;
    // far enough back that the whole board shows (with room for the panels: beside it on a wide screen,
    // above and below it on a phone)
    const dist = tall ? 4.1 / Math.max(0.5, aspect) : 6.6;
    this.camera.position.set(0, dist * 0.86, dist * 0.52);
    this.camera.lookAt(0, 0, tall ? -0.05 : -0.08);
    this.camera.updateProjectionMatrix();
    this.board.position.set(tall ? 0 : -0.62 * Math.min(1.6, aspect / 1.4), 0, tall ? 0.18 : 0);
    this.fx.setScale(h, this.camera.fov);
  }

  private frame = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    if (this.band) (this.band.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(this.t * 3) * 0.15 + this.pulse * 0.6;
    if (this.fill) this.fill.scale.setScalar(1 + this.pulse * 0.02);
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.fx.dispose();
    this.board.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach(x => x.dispose()); } });
    this.scene.environment?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
