// The world of the crate lesson (math/beats/crateLesson.ts): a crate on the table, crystal cubes, and the
// three measures of the crate as real lines in the room, standing on its edges with their numbers. The
// crate is a frame with clear walls, turned a little, so length, width and height are all in view at once;
// shut, it has wooden walls and a lid. Cubes are cut at Prism Hornback's horn and fly in, a count ticking up
// on the crate. Everything inside the crate is a child of it, so when it tips over, the lines, numbers and
// cubes all go with it. It sits on the shared episode table like the measuring things do (three/measureKit.ts).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stage } from './stage';
import { loadTexture } from './assets';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { CrateWorld, Face } from '../math/beats/crateLesson';
import { firstRow, layer, pourOrder, rowBack, seenOnly, sumParts, volume, type Dims, type Slot } from '../math/beats/crate';
import { bSfx } from '../math/beats/sounds';

const TY = 0.48;
/** how long the cracked cube takes to reach Prism's mouth, in seconds */
const EAT_FLY = 0.8;
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const out3 = (k: number) => 1 - Math.pow(1 - k, 3);
const backOut = (k: number) => { const s = 1.7; k -= 1; return k * k * ((s + 1) * k + s) + 1; };
/** the three lines' colours: length, width, height */
const INK = { l: 0x2c7be5, w: 0xe23d82, h: 0xefa100 };
const PINC = { l: 'a', w: 'b', h: 'c' } as const;
/** the crate's turn on the table, so its front and its right side both show */
const YAW = -0.52;
/** how far off the crate's edges the lines stand */
const OFF = 0.034;
/** the layers' colours, one after another, so layers read as layers */
const TINT = [0x7f8cff, 0x35c9bd, 0xb78bff, 0x4fb2ff, 0x7be0a6];

type Cube = { m: THREE.Mesh; slot: Slot | null; from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; land?: () => void; leaving: number };
type Job =
  | { kind: 'trace'; axis: 'l' | 'w' | 'h'; step: number; done: () => void }
  | { kind: 'sweep'; axis: 'w' | 'h'; step: number; done: () => void }
  | { kind: 'face'; done: (f: Face) => void };

export class CrateKit implements CrateWorld {
  readonly root = new THREE.Group();
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  private now = 0;
  private s = 0.0032;
  private d: Dims = { l: 5, w: 3, h: 2 };
  private c = 0.13;
  /** on the table, turned; then tipped; the frame, lines and cubes are in `body` */
  private crate: THREE.Group | null = null;
  private body = new THREE.Group();
  private walls: THREE.Mesh[] = [];
  private glass = 1;
  private glassTo = 1;
  private lid: THREE.Mesh | null = null;
  private lidAt = 0; private lidTo = 0;
  private lines: Partial<Record<'l' | 'w' | 'h', THREE.Group>> = {};
  private lineK: Record<'l' | 'w' | 'h', number> = { l: 0, w: 0, h: 0 };
  private roller: THREE.Mesh | null = null;
  private rollFrom = 0; private rollTo = 0; private rollT = 0;
  private cubes: Cube[] = [];
  /** more cubes than fit: the count stands higher */
  private over = false;
  private ghosts: THREE.Mesh[] = [];
  private ghostMat: THREE.MeshBasicMaterial | null = null;
  private ghostUntil = 0;
  private geo: THREE.BufferGeometry | null = null;
  /** each cube's face: a clear edge, so a block of them still reads as cubes you could count */
  private face: THREE.Texture | null = null;
  private mats = new Map<number, THREE.Material>();
  private wood: THREE.Texture | null = null;
  private shakeUntil = 0; private shakeK = 0;
  private lifted = 0; private liftTo = 0;
  /** the hook */
  private rope: THREE.Mesh | null = null;
  private hookY = 3; private hookTo = 3; private hookCarry = false;
  private tipK = 0; private tipTo = 0;
  private cracked: THREE.Group | null = null;
  /** the whole cube left in the corner to guess by */
  private unit: { m: THREE.Object3D; to: THREE.Vector3 } | null = null;
  private crackedGo = -1;
  private job: Job | null = null;
  private count = 0;
  private held = false;
  private grab = { x: 0, y: 0, step: 0 };
  private faceFlash: { m: THREE.Mesh; until: number } | null = null;
  private ray = new THREE.Raycaster();

  constructor(private sc: EpisodeScene) {
    sc.root.add(this.root);
    // (the friends and the corner props keep clear of the crate)
    sc.extraWork = () => (this.crate ? [this.crate] : []);
  }

  async load() {
    this.wood = await loadTexture('world/planks.webp', { repeat: true });
    this.geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.07);
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128);
    const glow = g.createLinearGradient(0, 0, 128, 128); glow.addColorStop(0, 'rgba(255,255,255,1)'); glow.addColorStop(1, 'rgba(205,205,225,1)');
    g.fillStyle = glow; g.fillRect(8, 8, 112, 112);
    g.strokeStyle = 'rgba(40,30,90,.5)'; g.lineWidth = 9; g.strokeRect(4, 4, 120, 120);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 4; g.strokeRect(14, 14, 100, 100);
    const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4;
    this.face = tx;
  }
  bounds() { return { x: 70, y: 70, w: 460, h: 230 }; }
  refit() { const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100; }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
  private changed() { this.onChange?.(); }
  private pin(p: Pin) { this.pins = [...this.pins.filter(x => x.id !== p.id), p]; this.changed(); }
  private unpin(test: (p: Pin) => boolean) { this.pins = this.pins.filter(p => !test(p)); this.changed(); }
  private mat(color: number) {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshPhysicalMaterial({ color, map: this.face, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, emissive: color, emissiveIntensity: 0.06 }); this.mats.set(color, m); }
    return m;
  }

  // ---------- the crate ----------
  private dropCrate() {
    if (!this.crate) return;
    this.crate.removeFromParent();
    this.crate.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry !== this.geo) { m.geometry.dispose(); for (const mt of [m.material].flat()) if (!this.isShared(mt)) mt.dispose(); } });
    this.crate = null; this.cubes = []; this.walls = []; this.lid = null; this.lines = {}; this.roller = null;
    this.ghosts = []; this.over = false;
  }
  /** a mesh's material, in both of its looks (the stage swaps in a cheaper one on a weak computer) */
  private matsOf(m: THREE.Mesh) { return [m.material, (m.userData as { fullMat?: THREE.Material }).fullMat].flat().filter(Boolean) as THREE.Material[]; }
  private isShared(mt: THREE.Material) { return [...this.mats.values()].includes(mt) || mt === this.ghostMat; }
  private buildCrate(d: Dims, shut: boolean) {
    this.dropCrate();
    this.d = d; this.tipK = this.tipTo = 0; this.lifted = this.liftTo = 0;
    const k = this.s / 0.0032, c = (this.c = Math.min(0.155 * k, (0.98 * k) / d.l, (0.66 * k) / d.h));
    const L = d.l * c, W = d.w * c, H = d.h * c, b = 0.016;
    const crate = new THREE.Group(), body = new THREE.Group();
    crate.position.copy(this.sc.boardPoint(300, 195)); crate.position.y = TY;
    crate.rotation.y = YAW;
    crate.add(body); this.body = body;
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.7, roughness: 0.32 });
    const bar = (w: number, h: number, dp: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), brass); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; body.add(m); };
    for (const z of [-1, 1]) for (const y of [0, H + b]) bar(L + b * 2, b, b, 0, y + b / 2 - b / 2, z * (W / 2 + b / 2));
    for (const x of [-1, 1]) for (const y of [0, H + b]) bar(b, b, W + b * 2, x * (L / 2 + b / 2), y, 0);
    for (const x of [-1, 1]) for (const z of [-1, 1]) bar(b, H + b, b, x * (L / 2 + b / 2), (H + b) / 2, z * (W / 2 + b / 2));
    // the floor
    const fm = new THREE.MeshStandardMaterial({ color: 0xc9b89a, map: this.wood, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(L, 0.01, W), fm);
    floor.position.y = 0.002; floor.receiveShadow = true; floor.castShadow = true;
    body.add(floor);
    // the walls: clear, or wood when shut (they fade between the two)
    const wm = (new THREE.MeshStandardMaterial({ color: 0xd8b98a, map: this.wood, roughness: 0.75, transparent: true, opacity: shut ? 1 : 0.1, depthWrite: shut }));
    this.glass = this.glassTo = shut ? 0 : 1;
    const wall = (w: number, h: number, x: number, z: number, ry: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); m.position.set(x, h / 2 + b / 2, z); m.rotation.y = ry; m.material = wm; (m.material as THREE.Material).side = THREE.DoubleSide; m.renderOrder = 4; body.add(m); this.walls.push(m); };
    wall(L, H, 0, W / 2, 0); wall(L, H, 0, -W / 2, Math.PI); wall(W, H, L / 2, 0, Math.PI / 2); wall(W, H, -L / 2, 0, -Math.PI / 2);
    // the lid
    const lid = (this.lid = new THREE.Mesh(new THREE.BoxGeometry(L + b * 3, 0.018, W + b * 3), new THREE.MeshStandardMaterial({ color: 0xd8b98a, map: this.wood, roughness: 0.7, transparent: true })));
    lid.position.y = H + 0.02; lid.castShadow = true;
    lid.visible = shut;
    this.lidAt = this.lidTo = shut ? 1 : 0;
    body.add(lid);
    this.root.add(crate);
    this.crate = crate;
    // the three lines, drawn by nothing yet
    for (const a of ['l', 'w', 'h'] as const) { this.lines[a] = this.makeLine(a); this.lineK[a] = 0; body.add(this.lines[a]!); }
    // ghost cubes share one see-through look
    this.ghostMat ??= new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false });
  }
  /** a line along one edge, from the near bottom corner: a rod that grows, with a tick at each cube */
  private makeLine(a: 'l' | 'w' | 'h') {
    const g = new THREE.Group(), n = this.d[a], len = n * this.c, ink = new THREE.MeshStandardMaterial({ color: INK[a], emissive: INK[a], emissiveIntensity: 0.35, roughness: 0.5 });
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 12).translate(0, 0.5, 0), ink);
    rod.castShadow = true;
    g.add(rod);
    g.userData.rod = rod;
    g.userData.len = len;
    for (let i = 0; i <= n; i++) {
      const t = new THREE.Mesh(new THREE.SphereGeometry(i === 0 || i === n ? 0.02 : 0.016, 12, 8), ink);
      t.position.y = i * this.c; t.visible = false;
      g.add(t);
      (g.userData.ticks ??= []).push(t);
    }
    const start = this.lineStart(a);
    g.position.copy(start);
    if (a === 'l') g.rotation.z = Math.PI / 2;
    if (a === 'w') g.rotation.x = -Math.PI / 2;
    rod.scale.y = 0.0001;
    return g;
  }
  /** where each line starts: the near bottom corner of the crate, just off its edge */
  private lineStart(a: 'l' | 'w' | 'h') {
    const { d, c } = this, L = d.l * c, W = d.w * c;
    if (a === 'l') return new THREE.Vector3(L / 2, 0.01, W / 2 + OFF);
    if (a === 'w') return new THREE.Vector3(L / 2 + OFF, 0.01, W / 2);
    return new THREE.Vector3(L / 2 + OFF, 0, W / 2 + OFF);
  }
  /** a point `k` cubes along a line, in the crate's own space, a little out from the edge by `out` */
  private linePoint(a: 'l' | 'w' | 'h', k: number, out = 0) {
    const p = this.lineStart(a);
    if (a === 'l') { p.x -= k * this.c; p.z += out; }
    else if (a === 'w') { p.z -= k * this.c; p.x += out; }
    else { p.y += k * this.c; p.x += out * 0.7; p.z += out * 0.7; }
    return p;
  }
  private world(p: THREE.Vector3) { this.body.updateWorldMatrix(true, false); return this.body.localToWorld(p.clone()); }
  private setLine(a: 'l' | 'w' | 'h', k: number) {
    const g = this.lines[a]; if (!g) return;
    this.lineK[a] = k;
    const rod = g.userData.rod as THREE.Mesh;
    rod.scale.y = Math.max(0.0001, k * this.c);
    (g.userData.ticks as THREE.Mesh[]).forEach((t, i) => { t.visible = i <= k + 1e-6; });
  }
  private edgePin(a: 'l' | 'w' | 'h') {
    this.pin({ id: `edge-${a}`, text: String(this.d[a]), kind: 'edge', c: PINC[a], at: () => this.edgeAt(a) });
  }
  /** where an edge's number stands: clear of its line, of the other numbers and of the cubes, on a crate
   *  standing as it came or tipped on its end */
  private edgeAt(a: 'l' | 'w' | 'h') {
    const n = this.d[a], up = this.tipK > 0.5;
    if (a === 'l') return this.world(this.linePoint(a, n / 2, up ? 0.13 : 0.11));
    if (a === 'w') return up ? this.world(this.linePoint(a, n / 2)).add(new THREE.Vector3(0.11, 0.02, 0.1)) : this.world(this.linePoint(a, n / 2, 0.16));
    return up ? this.world(this.linePoint(a, n / 2)).add(new THREE.Vector3(-0.05, 0.02, 0.15)) : this.world(this.linePoint(a, n + 0.42));
  }
  private slotPos(s: Slot) {
    const { d, c } = this;
    return new THREE.Vector3((s.x + 0.5 - d.l / 2) * c, (s.y + 0.5) * c + 0.008, (s.z + 0.5 - d.w / 2) * c);
  }
  private tint(y: number) { return TINT[y % TINT.length]; }
  private cubeAt(s: Slot | null, color: number) {
    const m = new THREE.Mesh(this.geo!, this.mat(color));
    m.castShadow = true; m.receiveShadow = true;
    m.scale.setScalar(this.c * 0.95);
    return m;
  }
  /** Prism Hornback's horn, in the crate's space: where cubes are cut */
  private horn() {
    const p = this.sc.pal.root.position.clone().add(new THREE.Vector3(0, this.sc.pal.height * this.sc.pal.root.scale.y * 0.75, 0.1));
    return this.body.worldToLocal(p);
  }
  private countPin(n: number, word = '') {
    this.count = n;
    if (!n) { this.unpin(p => p.id === 'count'); return; }
    this.pin({ id: 'count', text: word || String(n), kind: 'count', at: () => this.overCrate() });
  }
  private overCrate() {
    const { d, c } = this;
    const up = this.tipK > 0.5 ? d.l * c : (d.h + (this.over ? 2 : 0)) * c;
    return (this.crate?.position.clone() ?? new THREE.Vector3(0, TY, 0)).add(new THREE.Vector3(0, up + 0.12, -0.02));
  }
  private addCube(slot: Slot, from: THREE.Vector3, delay: number, dur: number, arc: number, land?: () => void, color?: number) {
    const m = this.cubeAt(slot, color ?? this.tint(slot.y));
    const to = this.slotPos(slot);
    m.position.copy(from); m.visible = false;
    this.body.add(m);
    const cube: Cube = { m, slot, from: from.clone(), to, t0: this.now + delay, dur, arc, land, leaving: 0 };
    this.cubes.push(cube);
    return cube;
  }

  // ---------- the film ----------
  async crateIn(d: Dims, o: { shut?: boolean; lines?: boolean } = {}) {
    this.clearPins();
    this.buildCrate(d, !!o.shut);
    if (o.lines) for (const a of ['l', 'w', 'h'] as const) this.setLine(a, d[a]);
    // down on the hook
    bSfx.bell();
    this.hookCarry = true;
    this.hookY = 1.9; this.hookTo = 0;
    this.ensureRope();
    await this.wait(1250);
    bSfx.thunk();
    this.hookCarry = false;
    this.hookTo = 3;
    if (o.lines) for (const a of ['l', 'w', 'h'] as const) this.edgePin(a);
    await this.wait(350);
  }
  async crateOut() {
    this.clearPins();
    this.ensureRope();
    this.hookY = 3; this.hookTo = 0;
    bSfx.bell();
    await this.wait(700);
    this.hookCarry = true;
    this.hookTo = 3;
    await this.wait(1300);
    this.hookCarry = false;
    this.dropCrate();
  }
  private ensureRope() {
    if (this.rope) return;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 8).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x8a6a3c, roughness: 0.9 }));
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 18), new THREE.MeshStandardMaterial({ color: 0x777788, metalness: 0.7, roughness: 0.4 }));
    m.add(hook); hook.position.y = -0.0; (m.userData as { hook?: THREE.Mesh }).hook = hook;
    this.root.add(m);
    this.rope = m;
  }
  async loneCube() {
    const from = this.horn();
    bSfx.tink();
    this.sc.palDo('act');
    const cube = this.addCube({ x: 2, y: 0, z: 1 }, from, 0, 0.55, 0.3, () => bSfx.clack());
    await this.wait(1300);
    // a shake: it rattles, and cracks
    await this.rattle();
    bSfx.crack();
    this.sc.fx.emit({ at: this.world(cube.to), count: 18, shape: ['spark', 'star'], color: [0xffffff, 0xbcd0ff], speed: [0.5, 1.4], life: [0.3, 0.7], size: [0.02, 0.05], up: 0.8, drag: 2, spin: 4 });
    // the two halves hop out onto the table, and stay there
    const at = this.world(cube.to);
    cube.m.removeFromParent();
    this.cubes = this.cubes.filter(c => c !== cube);
    const g = new THREE.Group(), mat = this.mat(0x8f93c4), c = this.c * 0.95;
    for (const [sx, tilt] of [[-1, 0.28], [1, -0.32]] as const) {
      const h = new THREE.Mesh(new THREE.BoxGeometry(c * 0.48, c * 0.9, c * 0.9), mat);
      h.position.set(sx * c * 0.3, c * 0.42, 0); h.rotation.z = tilt; h.castShadow = true; g.add(h);
    }
    g.position.copy(at);
    this.root.add(g);
    this.cracked = g;
    g.userData.from = at.clone();
    g.userData.to = new THREE.Vector3(0.58 * (this.s / 0.0032), TY, this.crate!.position.z + 0.3);
    g.userData.t0 = this.now;
    await this.wait(900);
  }
  /** a whole cube stays in the corner while the child guesses: the only way to tell how many will fit */
  async unitCube() {
    const from = this.horn();
    bSfx.tink();
    const unit = this.addCube({ x: 0, y: 0, z: 0 }, from, 0, 0.5, 0.28, () => bSfx.clack());
    this.unit = unit;
    await this.wait(620);
    this.pin({ id: 'one', text: '1 cube', kind: 'word', at: () => this.world(unit.to).add(new THREE.Vector3(0, this.c * 1.05, 0)) });
  }
  async pour(n: number) {
    if (this.unit) { const u = this.unit; this.unit = null; u.m.removeFromParent(); this.cubes = this.cubes.filter(c => c !== u); this.unpin(p => p.id === 'one'); }
    // (cubes that don't fit stand up out of the top, so "too many" can be seen at a glance)
    const order = pourOrder({ ...this.d, h: this.d.h + 2 }), v = volume(this.d), shown = Math.min(n, order.length);
    const gap = Math.min(0.09, 2.4 / Math.max(1, shown));
    const from = this.horn();
    this.over = n > v;
    this.countPin(0);
    for (let i = 0; i < shown; i++) this.addCube(order[i], from, i * gap, 0.42, 0.22, () => { bSfx.clack(); this.countPin(this.count + 1); });
    bSfx.tink();
    await this.wait(Math.max(300, shown * gap * 1000 + 480));
    if (n > shown) this.countPin(n);
    if (n > v) this.pin({ id: 'left', text: `${n - v} too many`, kind: 'word', at: () => this.overCrate().add(new THREE.Vector3(0.42, -0.14, 0)) });
  }
  async pourSeen() {
    const slots = seenOnly(this.d), gap = Math.min(0.05, 2 / slots.length), from = this.horn();
    this.countPin(0);
    bSfx.tink();
    slots.forEach((s, i) => this.addCube(s, from, i * gap, 0.4, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }));
    await this.wait(slots.length * gap * 1000 + 480);
  }
  async rattle() {
    this.shakeUntil = this.now + 1.1; this.shakeK = 1;
    bSfx.rattle();
    this.pin({ id: 'rattle', text: 'rattle rattle!', kind: 'word', at: () => this.overCrate().add(new THREE.Vector3(0.34, -0.06, 0)) });
    await this.wait(1150);
    this.unpin(p => p.id === 'rattle');
  }
  async gaps() {
    const have = new Set(this.cubes.map(c => c.slot && this.slotKey(c.slot)));
    for (const s of pourOrder(this.d)) {
      if (have.has(this.slotKey(s))) continue;
      const m = new THREE.Mesh(this.geo!, this.ghostMat!);
      m.position.copy(this.slotPos(s)); m.scale.setScalar(this.c * 0.86); m.renderOrder = 3;
      this.body.add(m); this.ghosts.push(m);
    }
    this.ghostUntil = this.now + 1.7;
    this.pin({ id: 'empty', text: 'still empty', kind: 'word', at: () => this.overCrate().add(new THREE.Vector3(-0.36, -0.08, 0)) });
    await this.wait(1500);
    this.unpin(p => p.id === 'empty');
  }
  private slotKey(s: Slot) { return `${s.x},${s.y},${s.z}`; }
  async thunk() {
    this.shakeUntil = this.now + 0.5; this.shakeK = 0.35;
    bSfx.thunk();
    if (this.lid) { this.lid.visible = true; this.lidTo = 1; }
    this.sc.burst(this.overCrate(), 0.7);
    await this.wait(750);
  }
  async clear() {
    this.unpin(p => p.id === 'count' || p.id === 'left' || p.id === 'hollow' || p.kind === 'tick');
    this.lidTo = 0;
    const all = this.cubes;
    for (const [i, c] of all.entries()) c.leaving = this.now + Math.min(0.5, i * 0.012);
    this.liftTo = 0; this.over = false;
    for (const m of this.ghosts) { m.removeFromParent(); }
    this.ghosts = [];
    await this.wait(all.length ? 620 : 100);
    this.count = 0;
  }

  // ---------- the child's hands ----------
  private screenOf(p: THREE.Vector3) { const v = p.clone().project(stage.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }
  /** a line's two ends on the screen, for reading a drag along it */
  private lineScreen(a: 'l' | 'w' | 'h') {
    const n = this.d[a], p0 = this.screenOf(this.world(this.linePoint(a, 0))), p1 = this.screenOf(this.world(this.linePoint(a, n)));
    return { p0, p1, dx: p1.x - p0.x, dy: p1.y - p0.y, len: Math.hypot(p1.x - p0.x, p1.y - p0.y) };
  }
  trace(axis: 'l' | 'w' | 'h') {
    return new Promise<void>(res => {
      const g = this.geo!;
      if (!this.roller) { const m = new THREE.Mesh(g, this.mat(0xffd86b)); m.castShadow = true; this.body.add(m); this.roller = m; }
      this.roller.visible = true; this.roller.scale.setScalar(this.c * 0.8); this.roller.rotation.set(0, 0, 0);
      this.rollFrom = this.rollTo = 0; this.rollT = 0;
      this.job = { kind: 'trace', axis, step: 0, done: res };
      this.placeRoller(axis, 0);
      this.changed();
    });
  }
  /** the rolling cube sits on the table just off the edge, turning a quarter for each step */
  private placeRoller(a: 'l' | 'w' | 'h', k: number) {
    const m = this.roller; if (!m) return;
    const c = this.c * 0.8, f = k - Math.floor(k), ang = (f * Math.PI) / 2;
    const p = this.linePoint(a, k, a === 'h' ? 0.05 : c / 2 + 0.012);
    const lift = (Math.SQRT2 * Math.sin(ang + Math.PI / 4) - 1) * (c / 2);
    if (a === 'h') { m.position.copy(p); m.rotation.set(0, 0, 0); m.position.y = k * this.c + c / 2 - c * 0.2; return; }
    m.position.set(p.x, c / 2 + lift + 0.002, p.z);
    if (a === 'l') m.rotation.set(0, 0, ang); else m.rotation.set(-ang, 0, 0);
  }
  private spawnRow() {
    this.countPin(0);
    const from = this.horn(), s = firstRow(this.d), gap = 0.1;
    bSfx.tink();
    s.forEach((x, i) => this.addCube(x, from, i * gap, 0.42, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }));
    return s.length * gap * 1000 + 460;
  }
  async row() { await this.wait(this.spawnRow()); }
  sweep(axis: 'w' | 'h') {
    return new Promise<void>(res => { this.job = { kind: 'sweep', axis, step: 0, done: res }; this.unpin(p => p.id === `edge-${axis}`); this.markTick(axis, 0); this.changed(); });
  }
  /** Number the steps of a sweep on its line: rows, then layers, each counting everything so far. */
  private markTick(axis: 'w' | 'h', step: number) {
    const per = axis === 'w' ? this.d.l : this.d.l * this.d.w, n = per * (step + 1);
    this.pin({ id: `tick-${axis}-${step}`, text: String(n), kind: 'tick', c: PINC[axis], at: () => this.world(this.linePoint(axis, step + 1, axis === 'h' ? 0.07 : 0.06)) });
  }
  private stepSweep(j: Extract<Job, { kind: 'sweep' }>, to: number) {
    const { d } = this;
    while (j.step < to) {
      j.step++;
      const made = j.axis === 'w' ? rowBack(d, j.step) : layer(d, j.step);
      const up = j.axis === 'h';
      for (const s of made) {
        const from = this.slotPos(up ? { ...s, y: s.y - 1 } : { ...s, z: s.z + 1 });
        this.addCube(s, from, 0, 0.2, 0);
      }
      this.countPin(this.cubes.filter(c => !c.leaving).length);
      this.markTick(j.axis, j.step);
      bSfx.tick(j.step);
    }
    while (j.step > to) {
      const y = j.step, gone = this.cubes.filter(c => c.slot && !c.leaving && (j.axis === 'w' ? d.w - 1 - c.slot.z === y : c.slot.y === y));
      for (const c of gone) c.leaving = this.now;
      this.unpin(p => p.id === `tick-${j.axis}-${y}`);
      j.step--;
      this.countPin(this.cubes.filter(c => !c.leaving).length);
    }
  }
  private endJob() {
    const j = this.job; if (!j || j.kind === 'face') return;
    this.job = null; this.held = false;
    if (j.kind === 'trace') { if (this.roller) this.roller.visible = false; this.setLine(j.axis, this.d[j.axis]); this.edgePin(j.axis); this.unpin(p => p.id === 'roll'); }
    else {
      const { d } = this, floor = d.l * d.w;
      this.countPin(this.count, j.axis === 'w' ? `${d.l} × ${d.w} = ${floor}` : `${floor} × ${d.h} = ${floor * d.h}`);
      this.unpin(p => p.kind === 'tick');
      this.edgePin(j.axis);
    }
    this.sc.nod(); this.sc.palDo('hop');
    this.changed();
    j.done();
  }
  /** "Show me": the job finishes itself, slowly enough to watch. */
  finish() {
    const j = this.job; if (!j) return;
    if (j.kind === 'face') { this.job = null; j.done('top'); this.changed(); return; }
    const n = j.kind === 'trace' ? this.d[j.axis] : j.axis === 'w' ? this.d.w - 1 : this.d.h - 1, gap = 320;
    const go = () => {
      if (this.job !== j) return;
      if (j.kind === 'trace') { j.step = Math.min(n, j.step + 1); this.rollTo = j.step; this.setLine(j.axis, j.step); bSfx.tick(j.step); this.rollPin(j); }
      else this.stepSweep(j, Math.min(n, j.step + 1));
      if (j.step >= n) setTimeout(() => this.endJob(), 420); else setTimeout(go, gap);
    };
    go();
  }
  private rollPin(j: Extract<Job, { kind: 'trace' }>) {
    const a = j.axis;
    this.pin({ id: 'roll', text: String(j.step), kind: 'edge', c: PINC[a], at: () => this.world(this.linePoint(a, this.rollFrom, a === 'h' ? 0.1 : 0.14)) });
  }
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    const j = this.job;
    if (!j) return false;
    if (j.kind === 'face') {
      if (kind !== 'down') return false;
      const f = this.faceAt(x, y);
      if (!f) return false;
      this.job = null;
      j.done(f);
      this.changed();
      return true;
    }
    if (kind === 'down') {
      const near = this.screenOf(this.tryPoint()!);
      if (Math.hypot(near.x - x, near.y - y) > Math.max(120, innerWidth * 0.09)) return false;
      this.held = true; this.grab = { x, y, step: j.step };
      return true;
    }
    if (kind === 'move' && this.held) {
      const n = j.kind === 'trace' ? this.d[j.axis] : j.axis === 'w' ? this.d.w - 1 : this.d.h - 1;
      const a = j.axis, ls = this.lineScreen(a), tot = this.d[a];
      const along = ((x - this.grab.x) * ls.dx + (y - this.grab.y) * ls.dy) / (ls.len * ls.len);
      const k = Math.max(0, Math.min(n, this.grab.step + along * tot));
      if (j.kind === 'trace') {
        const to = Math.round(k * 4) / 4, st = Math.floor(to + 1e-6);
        this.rollTo = to;
        this.setLine(a, to);
        if (st !== j.step) { j.step = st; bSfx.tick(st); this.rollPin(j); }
        if (st >= n) this.endJob();
      } else {
        this.stepSweep(j, Math.round(k));
        if (j.step >= n) this.endJob();
      }
      return true;
    }
    if (kind === 'up' && this.held) { this.held = false; return true; }
    return false;
  }
  private dragHint(): { a: THREE.Vector3; b: THREE.Vector3 } | null {
    const j = this.job;
    if (!j || j.kind === 'face') return null;
    if (j.kind === 'trace') { const n = this.d[j.axis]; return { a: this.world(this.linePoint(j.axis, this.rollFrom, 0.05)), b: this.world(this.linePoint(j.axis, n, 0.05)) }; }
    const { d } = this, n = j.axis === 'w' ? d.w - 1 : d.h - 1;
    const top = (y: number, z: number) => this.world(this.slotPos({ x: d.l - 1, y, z }).add(new THREE.Vector3(0, this.c * 0.55, 0)));
    return j.axis === 'w' ? { a: top(0, d.w - 1 - j.step), b: top(0, d.w - 1 - n) } : { a: top(j.step, d.w - 1), b: top(n + 0.6, d.w - 1) };
  }
  tryPoint() { const h = this.dragHint(); return h ? h.a : this.job?.kind === 'face' ? this.overCrate() : null; }
  /** where the drag goes, on the screen (null: nothing to drag, or the child's hand is already on it) */
  dragPath() {
    const h = this.held ? null : this.dragHint();
    return h ? { a: this.screenOf(h.a), b: this.screenOf(h.b) } : null;
  }
  handPoint() {
    if (this.held) return null;
    if (this.job?.kind === 'face') return this.overCrate().add(new THREE.Vector3(0, -0.14, 0));
    const h = this.dragHint(); if (!h) return null;
    const k = (this.now * 0.45) % 1;
    return h.a.clone().lerp(h.b, smooth(clamp01(k * 1.3)));
  }
  pickFace() { return new Promise<Face>(res => { this.job = { kind: 'face', done: res }; this.changed(); }); }
  /** which face of the crate a tap landed on */
  private faceAt(x: number, y: number): Face | null {
    const { d, c } = this, L = d.l * c, W = d.w * c, H = d.h * c;
    this.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), stage.camera);
    this.body.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.body.matrixWorld).invert();
    const r = this.ray.ray.clone().applyMatrix4(inv), box = new THREE.Box3(new THREE.Vector3(-L / 2, 0, -W / 2), new THREE.Vector3(L / 2, H, W / 2)).expandByScalar(0.02);
    const hit = r.intersectBox(box, new THREE.Vector3());
    if (!hit) return null;
    const e = 0.03;
    if (hit.y > H - e) return 'top';
    if (hit.z > W / 2 - e) return 'front';
    if (hit.x > L / 2 - e) return 'side';
    return 'top';
  }
  async showFace(f: Face) {
    const { d, c } = this, L = d.l * c, W = d.w * c, H = d.h * c, e = 0.024;
    const [w, h, label] = f === 'top' ? [L, W, `${d.l} × ${d.w}`] : f === 'front' ? [L, H, `${d.l} × ${d.h}`] : [W, H, `${d.w} × ${d.h}`];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: f === 'side' ? 0xff8fb3 : 0x9be7c4, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    if (f === 'top') { m.rotation.x = -Math.PI / 2; m.position.set(0, H + e, 0); }
    if (f === 'front') m.position.set(0, H / 2, W / 2 + e);
    if (f === 'side') { m.rotation.y = Math.PI / 2; m.position.set(L / 2 + e, H / 2, 0); }
    m.renderOrder = 6;
    this.body.add(m);
    this.pin({ id: 'face', text: label, kind: 'word', at: () => this.world(m.position.clone()) });
    this.faceFlash = { m, until: this.now + 1.3 };
    await this.wait(1300);
    this.unpin(p => p.id === 'face');
  }
  /** the first layer of the buddy's crate, on the floor or standing against the front */
  async layerOn(f: Face) {
    const { d } = this, s = f === 'front' ? pourOrder(d).filter(x => x.z === d.w - 1) : layer(d, 0), from = this.horn();
    this.chosen = f;
    this.countPin(0);
    bSfx.tink();
    s.forEach((x, i) => this.addCube(x, from, i * 0.09, 0.42, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }));
    await this.wait(s.length * 90 + 520);
  }
  private chosen: Face = 'top';
  async twoCubes() {
    const { d } = this, f = this.chosen, spots = f === 'front' ? pourOrder(d).filter(x => x.z === d.w - 2).slice(0, 2) : layer(d, 1).slice(0, 2), from = this.horn();
    const two = spots.map((s, i) => this.addCube(s, from, i * 0.12, 0.42, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }));
    await this.wait(760);
    await this.rattle();
    for (const c of two) c.leaving = this.now;
    this.countPin(this.count - 2);
    await this.wait(380);
  }
  async secondLayer() {
    const { d } = this, f = this.chosen, have = new Set(this.cubes.filter(c => !c.leaving).map(c => c.slot && this.slotKey(c.slot)));
    const rest = pourOrder(d).filter(s => !have.has(this.slotKey(s))), from = this.horn();
    rest.forEach((s, i) => this.addCube(s, from, i * 0.09, 0.42, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }, f === 'front' ? this.tint(1) : undefined));
    await this.wait(rest.length * 90 + 520);
  }
  async topUp(n: number) {
    const { d } = this, floor = d.l * d.w, v = volume(d), extra = Math.max(0, n - floor), from = this.horn();
    if (!extra) { this.sc.shrug(); await this.wait(900); return; }
    const up = pourOrder({ ...d, h: d.h + 2 }).slice(floor, Math.min(n, floor * (d.h + 2)));
    this.over = n > v;
    const gap = Math.min(0.07, 1.6 / up.length);
    const made = up.map((s, i) => this.addCube(s, from, i * gap, 0.42, 0.2, () => { bSfx.clack(); this.countPin(this.count + 1); }));
    await this.wait(up.length * gap * 1000 + 500);
    if (n < v) await this.rattle();
    else if (n > v) { this.pin({ id: 'left', text: `${n - v} too many`, kind: 'word', at: () => this.overCrate().add(new THREE.Vector3(0.42, -0.14, 0)) }); await this.wait(1300); this.unpin(p => p.id === 'left'); }
    for (const c of made) c.leaving = this.now;
    this.over = false;
    this.countPin(floor, `${d.l} × ${d.w} = ${floor}`);
    await this.wait(420);
  }
  writeSum(d: Dims, under?: string[], inks?: ('a' | 'b' | 'c')[]) {
    this.pin({ id: 'sum', text: '', kind: 'sum', parts: sumParts(d, inks), under, at: () => this.overCrate() });
    this.unpin(p => p.id === 'count');
  }
  clearSum() { this.unpin(p => p.id === 'sum' || p.kind === 'tick'); }
  async tip() {
    this.tipTo = 1;
    this.lidTo = 0;
    bSfx.tip();
    this.sc.palDo('hop');
    await this.wait(1300);
    this.shakeUntil = this.now + 0.3; this.shakeK = 0.3;
  }
  async recount() {
    // the crate on its end: the old length is the height now, so the layers are the cubes with one x
    const { d } = this;
    const per = d.w * d.h;
    for (let x = d.l - 1, k = 1; x >= 0; x--, k++) {
      for (const c of this.cubes) if (c.slot?.x === x) c.m.material = this.mat(this.tint(k));
      this.countPin(per * k);
      bSfx.tick(k);
      await this.wait(330);
    }
  }
  async peek(on: boolean) { this.glassTo = on ? 1 : 0; if (this.lid) this.lidTo = on ? 0 : 1; await this.wait(520); }
  /** The top layer lifts off and the near walls go see-through: the crate is hollow, and you can see it. */
  async liftTop() {
    this.liftTo = 1; bSfx.tink();
    await this.wait(800);
    const { d } = this;
    for (const c of this.cubes) if (c.slot && c.slot.y !== d.h - 1 && (c.slot.z === d.w - 1 || c.slot.x === d.l - 1)) c.m.material = this.seeThrough(this.tint(c.slot.y));
    this.pin({ id: 'hollow', text: 'hollow!', kind: 'word', at: () => this.world(new THREE.Vector3(0, this.c * 1.4, 0)) });
    await this.wait(1300);
  }
  private seeThrough(color: number) {
    const key = color + 1;
    let m = this.mats.get(key);
    if (!m) { m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.26, depthWrite: false }); this.mats.set(key, m); }
    return m;
  }
  async eatCracked() {
    const g = this.cracked; if (!g) return;
    this.crackedGo = this.now;
    // Prism leans out for it, the cube hops up to its mouth and goes in, and then it chews
    this.sc.palDo('act');
    await this.wait(EAT_FLY * 1000);
    g.removeFromParent();
    this.cracked = null;
    bSfx.gulp();
    this.sc.palDo('eat');
    this.sc.fx.emit({ at: this.sc.pal.mouthAt(), count: 12, shape: ['spark'], color: [0xbcd0ff, 0xffffff], speed: [0.3, 0.8], life: [0.25, 0.5], size: [0.015, 0.035], gravity: 1.2 });
    await this.wait(800);
    this.sc.palDo('happy');
    await this.wait(700);
  }
  clearPins() { this.pins = []; this.changed(); }

  // ---------- still pictures of every state (dev/epOverlap.ts checks nothing passes through anything) ----------
  readonly poses = ['first crate, empty', 'first crate, full', 'first crate, stood on end', 'first crate, spilling over', 'the shut crate', "the buddy's crate, full"];
  pose(name: string) {
    this.dropCrate(); this.job = null;
    const crates: Record<string, [Dims, boolean]> = { 'the shut crate': [{ l: 6, w: 3, h: 4 }, true], "the buddy's crate, full": [{ l: 5, w: 2, h: 2 }, false] };
    const [d, shut] = crates[name] ?? [{ l: 5, w: 3, h: 2 }, false];
    this.buildCrate(d, shut);
    this.hookCarry = false; this.hookY = this.hookTo = 3;
    for (const a of ['l', 'w', 'h'] as const) this.setLine(a, d[a]);
    if (!/empty|shut/.test(name)) for (const s of pourOrder(d)) this.addCube(s, this.slotPos(s), -9, 0.01, 0);
    if (name.includes('spilling')) for (const s of pourOrder({ ...d, h: d.h + 2 }).slice(volume(d))) this.addCube(s, this.slotPos(s), -9, 0.01, 0);
    if (name.includes('stood')) this.tipK = this.tipTo = 0.999999;
  }
  /** what's on the table now, for the overlap check */
  things(): { name: string; obj: THREE.Object3D }[] {
    return this.crate ? [{ name: 'crate', obj: this.crate }] : [];
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    const c = this.crate;
    // a drawn line follows the hand gently
    if (this.job?.kind === 'trace') {
      this.rollFrom += (this.rollTo - this.rollFrom) * Math.min(1, dt * 14);
      this.placeRoller(this.job.axis, this.rollFrom);
    }
    // the hook and the crate on it
    this.hookY += (this.hookTo - this.hookY) * Math.min(1, dt * 3.2);
    if (c) {
      const H = (this.tipK > 0.5 ? this.d.l : this.d.h) * this.c;
      const base = this.hookCarry ? Math.max(0, this.hookY) : 0;
      c.position.y = TY + base;
      if (this.rope) {
        const top = TY + base + H + 0.04, far = this.hookCarry ? top : TY + Math.max(H + 0.04, this.hookY + H + 0.04), len = 6;
        this.rope.position.set(c.position.x, far, c.position.z);
        this.rope.scale.y = len;
        const hk = this.rope.userData.hook as THREE.Mesh; hk.scale.y = 1 / len;
        this.rope.visible = this.hookY < 2.6 || this.hookCarry;
      }
      // shaken
      const sk = this.shakeUntil > t ? clamp01((this.shakeUntil - t) * 3) * this.shakeK : 0;
      this.body.position.x = sk ? Math.sin(t * 61) * 0.012 * sk : 0;
      c.rotation.z = sk ? Math.sin(t * 47) * 0.018 * sk : 0;
      // tipping over its near right edge, then sliding back to the middle
      this.tipK += (this.tipTo - this.tipK) * Math.min(1, dt * 3.4);
      if (this.tipTo === 0 && this.tipK < 1e-4) this.tipK = 0;
      const a = -smooth(this.tipK) * Math.PI / 2, L = this.d.l * this.c, H0 = this.d.h * this.c, hx = L / 2;
      this.body.rotation.z = a;
      const ca = Math.cos(a), sa = Math.sin(a);
      this.body.position.y = -(hx * sa) + smooth(this.tipK) * 0.046;
      this.body.position.x += hx - hx * ca - smooth(this.tipK) * (L / 2 + H0 / 2);
    }
    // the cubes
    this.liftTo += 0;
    this.lifted += (this.liftTo - this.lifted) * Math.min(1, dt * 5);
    const sk = this.shakeUntil > t ? this.shakeK : 0;
    const topY = this.d.h - 1;
    for (let i = this.cubes.length - 1; i >= 0; i--) {
      const q = this.cubes[i], m = q.m;
      const k = clamp01((t - q.t0) / q.dur);
      if (t < q.t0) { m.visible = false; continue; }
      m.visible = true;
      m.position.lerpVectors(q.from, q.to, out3(k));
      m.position.y += Math.sin(k * Math.PI) * q.arc;
      if (q.slot?.y === topY && this.lifted > 0.001) m.position.y += this.lifted * this.c * 2.4;
      if (k >= 1 && q.land) { const f = q.land; q.land = undefined; f(); }
      if (k >= 1 && sk && q.slot) { m.position.x += Math.sin(t * 71 + i) * 0.006 * sk; m.position.y += Math.abs(Math.sin(t * 53 + i * 1.7)) * 0.012 * sk; m.rotation.z = Math.sin(t * 40 + i) * 0.05 * sk; } else m.rotation.z = 0;
      let sz = this.c * 0.95 * (k < 1 ? 0.6 + 0.4 * backOut(k) : 1);
      if (q.leaving && t > q.leaving) {
        const lk = clamp01((t - q.leaving) / 0.28);
        sz *= 1 - smooth(lk);
        if (lk >= 1) { m.removeFromParent(); this.cubes.splice(i, 1); continue; }
      }
      m.scale.setScalar(Math.max(0.0001, sz));
    }
    // the empty places: a soft pulse, then gone
    if (this.ghostMat) {
      const left = this.ghostUntil - t;
      this.ghostMat.opacity = left > 0 ? Math.min(0.5, left * 2, (1.7 - left) * 2) * (0.75 + Math.sin(t * 7) * 0.25) : 0;
      if (left <= 0 && this.ghosts.length) { for (const m of this.ghosts) m.removeFromParent(); this.ghosts = []; }
    }
    // the walls between wood and clear
    this.glass += (this.glassTo - this.glass) * Math.min(1, dt * 6);
    for (const m of this.walls) for (const mt of this.matsOf(m)) { mt.opacity = 1 - this.glass * 0.9; mt.depthWrite = this.glass < 0.1; }
    if (this.lid) {
      this.lidAt += (this.lidTo - this.lidAt) * Math.min(1, dt * 7);
      this.lid.position.y = this.d.h * this.c + 0.02 + (1 - this.lidAt) * 0.25;
      for (const mt of this.matsOf(this.lid)) mt.opacity = this.lidAt;
      this.lid.visible = this.lidAt > 0.02;
    }
    // the cracked cube hops off the crate onto the table, then later into Prism
    const g = this.cracked;
    if (g) {
      if (this.crackedGo < 0) {
        const k = clamp01((t - (g.userData.t0 as number)) / 0.5);
        g.position.lerpVectors(g.userData.from as THREE.Vector3, g.userData.to as THREE.Vector3, smooth(k));
        g.position.y += Math.sin(k * Math.PI) * 0.22;
      } else {
        // up in an arc, bite-sized by the time it reaches the mouth, and gone inside it
        const k = clamp01((t - this.crackedGo) / EAT_FLY), to = this.sc.pal.mouthAt();
        g.position.lerpVectors(g.userData.to as THREE.Vector3, to, smooth(k));
        g.position.y += Math.sin(k * Math.PI) * 0.16;
        g.scale.setScalar(k < 0.8 ? 1 - k * 0.5 : 0.6 * (1 - (k - 0.8) / 0.2));
      }
    }
    if (this.faceFlash && t > this.faceFlash.until) { const f = this.faceFlash.m; f.removeFromParent(); f.geometry.dispose(); (f.material as THREE.Material).dispose(); this.faceFlash = null; }
  }

  dispose() {
    this.dropCrate();
    this.cracked?.removeFromParent();
    this.rope?.removeFromParent();
    this.root.removeFromParent();
    this.geo?.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.ghostMat?.dispose();
    this.sc.extraWork = () => [];
  }
}
