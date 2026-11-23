// The world of the counting lesson (math/beats/countLesson.ts): cookies on a baking tray on the kitchen
// table, a row in front where counted cookies go, and plates in front of that. A counted cookie moves into
// the row with its number standing on it, so the child can see which ones are done and which number came
// last. Plates slide in from the side, as many as a number says, and the cookies hop on one to a plate, so a
// wrong number shows a cookie with no plate or a plate left empty. A yellow ring marks the cookie being
// talked about. Cookies and plates use the kitchen's own cookie and plate pictures (public/learn/ep/).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stage } from './stage';
import { loadTexture } from './assets';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { CountWorld } from '../math/beats/countLesson';
import { countPath, numbersOn, slipped, type Slip } from '../math/beats/count';
import { bSfx } from '../math/beats/sounds';

const TY = 0.48;
/** board rows: the tray, the counted row, the plates */
const TRAY_Y = 132, ROW_Y = 205, PLATE_Y = 262, MID_X = 300;
/** cookie and plate sizes, in board units */
const CR = 18, PR = 23;
/** the most plates shown; a bigger number says so in words */
const MOST = 9;
/** where a mixed-up batch lies on the tray (-1..1 across and back), roughly left to right */
const MIXED_AT: [number, number][] = [[-0.92, 0.35], [-0.62, -0.55], [-0.3, 0.6], [-0.02, -0.3], [0.3, 0.7], [0.58, -0.5], [0.9, 0.3], [0.12, 0.1]];
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

type Move = { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; done?: () => void };
type Cookie = { g: THREE.Group; num: number; shakeUntil: number; plate: THREE.Object3D | null };

export class CountKit implements CountWorld {
  readonly root = new THREE.Group();
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  private now = 0;
  private s = 0.0032;
  private cookies: Cookie[] = [];
  private plateObjs: THREE.Group[] = [];
  private tray: THREE.Mesh | null = null;
  private marks: THREE.Mesh[] = [];
  private moves = new Map<THREE.Object3D, Move>();
  private counted = 0;
  private job: { done: () => void } | null = null;
  private auto = 0;
  private shakeUntil = 0;
  private geo: { cookie?: THREE.BufferGeometry; chip?: THREE.BufferGeometry; plate?: THREE.BufferGeometry; rim?: THREE.BufferGeometry; mark?: THREE.BufferGeometry } = {};
  private mat: { cookie?: THREE.Material; chip?: THREE.Material; plate?: THREE.Material[]; rim?: THREE.Material; mark?: THREE.MeshBasicMaterial; tray?: THREE.Material } = {};

  constructor(private sc: EpisodeScene) {
    sc.root.add(this.root);
    // (the friends and the corner props keep clear of the cookies and plates)
    sc.extraWork = () => [...(this.tray ? [this.tray] : []), ...this.cookies.map(c => c.g), ...this.plateObjs];
  }

  async load() {
    const [dough, plateTop, wood] = await Promise.all([loadTexture('learn/ep/tex-cookie.webp', { repeat: true }), loadTexture('learn/ep/tex-plate.webp'), loadTexture('world/planks.webp', { repeat: true })]);
    this.mat.cookie = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dough, roughness: 0.85 });
    this.mat.chip = new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfdf7ee, roughness: 0.35 });
    this.mat.plate = [white, new THREE.MeshStandardMaterial({ color: 0xffffff, map: plateTop, roughness: 0.35 }), white];
    this.mat.rim = new THREE.MeshStandardMaterial({ color: 0x6f9fd8, roughness: 0.4 });
    this.mat.mark = new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.95, depthWrite: false });
    this.mat.tray = new THREE.MeshStandardMaterial({ color: 0xc9925a, map: wood, roughness: 0.7 });
  }
  bounds() { return { x: 70, y: 70, w: 460, h: 230 }; }
  refit() {
    const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100;
    // (made once: cookies already on the table keep theirs)
    if (this.geo.cookie) return;
    const r = CR * this.s, R = PR * this.s;
    this.geo.cookie = new THREE.CylinderGeometry(r, r * 1.04, r * 0.34, 28);
    this.geo.chip = new THREE.SphereGeometry(r * 0.14, 8, 6);
    this.geo.plate = new THREE.CylinderGeometry(R, R * 0.78, R * 0.12, 32);
    this.geo.rim = new THREE.TorusGeometry(R * 0.94, R * 0.06, 6, 36);
    this.geo.mark = new THREE.TorusGeometry(r * 1.32, r * 0.13, 6, 36);
  }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
  private changed() { this.onChange?.(); }
  private pin(p: Pin) { this.pins = [...this.pins.filter(x => x.id !== p.id), p]; this.changed(); }
  private unpin(test: (p: Pin) => boolean) { this.pins = this.pins.filter(p => !test(p)); this.changed(); }
  /** a point on the table, in board units */
  private P(x: number, y: number) { const p = this.sc.boardPoint(x, y); p.y = TY; return p; }
  private rowX(i: number, n: number) { const sp = Math.min(58, 440 / Math.max(1, n)); return MID_X + (i - (n - 1) / 2) * sp; }
  private screenOf(p: THREE.Vector3) { const v = p.clone().project(stage.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }
  private go(o: THREE.Object3D, to: THREE.Vector3, dur: number, o2: { delay?: number; arc?: number; done?: () => void } = {}) {
    this.moves.set(o, { from: o.position.clone(), to: to.clone(), t0: this.now + (o2.delay ?? 0), dur, arc: o2.arc ?? 0, done: o2.done });
  }
  private topOf(c: Cookie) { return c.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, CR * this.s * 0.2, 0)); }

  // ---------- making things ----------
  private makeCookie(): Cookie {
    const g = new THREE.Group(), r = CR * this.s;
    const body = new THREE.Mesh(this.geo.cookie, this.mat.cookie); body.position.y = r * 0.17; body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + 0.3, d = (i % 3 === 0 ? 0.25 : 0.62) * r, chip = new THREE.Mesh(this.geo.chip, this.mat.chip);
      chip.position.set(Math.cos(a) * d, r * 0.34, Math.sin(a) * d); chip.scale.y = 0.55; g.add(chip);
    }
    g.rotation.y = Math.random() * Math.PI * 2;
    this.root.add(g);
    return { g, num: 0, shakeUntil: 0, plate: null };
  }
  private makePlate() {
    const g = new THREE.Group(), R = PR * this.s;
    const body = new THREE.Mesh(this.geo.plate, this.mat.plate); body.position.y = R * 0.06; body.receiveShadow = true; body.castShadow = true;
    const rim = new THREE.Mesh(this.geo.rim, this.mat.rim); rim.rotation.x = -Math.PI / 2; rim.position.y = R * 0.12;
    g.add(body, rim);
    this.root.add(g);
    return g;
  }
  private markOn(objs: THREE.Object3D[]) {
    this.unmark();
    for (const o of objs) { const m = new THREE.Mesh(this.geo.mark, this.mat.mark); m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = 5; o.add(m); this.marks.push(m); }
  }
  private unmark() { for (const m of this.marks) m.removeFromParent(); this.marks = []; }
  private numPin(c: Cookie, n: number, second = false) {
    const i = this.cookies.indexOf(c);
    this.pin({ id: `n${i}${second ? 'b' : ''}`, text: String(n), kind: 'tick', at: () => this.topOf(c).add(new THREE.Vector3(second ? CR * this.s * 1.1 : 0, 0.05, 0)) });
  }
  /** the row's places, for `n` things */
  private rowAt(i: number, n: number) { return this.P(this.rowX(i, n), ROW_Y); }
  /** cookies in the order they were counted (any not counted after, in their own order) */
  private inOrder() { return [...this.cookies].sort((a, b) => (a.num || 99) - (b.num || 99) || this.cookies.indexOf(a) - this.cookies.indexOf(b)); }

  // ---------- the film ----------
  async trayIn(n: number, o: { mixed?: boolean } = {}) {
    if (!this.tray) {
      const w = this.P(MID_X + 175, TRAY_Y).distanceTo(this.P(MID_X - 175, TRAY_Y)), d = this.P(MID_X, TRAY_Y + 52).distanceTo(this.P(MID_X, TRAY_Y - 52));
      this.tray = new THREE.Mesh(new RoundedBoxGeometry(w, 0.014, d, 2, 0.006), this.mat.tray);
      this.tray.receiveShadow = true;
      this.tray.position.copy(this.P(MID_X, TRAY_Y)).add(new THREE.Vector3(0, 0.007, 0));
      this.root.add(this.tray);
    }
    for (let i = 0; i < n; i++) {
      const c = this.makeCookie(), [u, v] = o.mixed ? MIXED_AT[i % MIXED_AT.length] : [(i - (n - 1) / 2) / 3, (i % 2 ? 0.25 : -0.2)];
      const to = this.P(MID_X + (o.mixed ? 150 * u : u * 3 * 58), TRAY_Y + 40 * v).add(new THREE.Vector3(0, 0.014, 0));
      c.g.position.copy(to).add(new THREE.Vector3(0, 0.6, 0));
      this.go(c.g, to, 0.45, { delay: i * 0.12, done: () => bSfx.clack() });
      this.cookies.push(c);
    }
    this.changed();
    await this.wait(n * 120 + 600);
  }
  async trayOut() {
    this.unmark(); this.unpin(() => true);
    const all: THREE.Object3D[] = [...this.cookies.map(c => c.g), ...this.plateObjs, ...(this.tray ? [this.tray] : [])];
    for (const o of all) this.go(o, o.position.clone().add(new THREE.Vector3(2.2, 0, 0)), 0.7);
    await this.wait(760);
    for (const o of all) { o.removeFromParent(); this.moves.delete(o); }
    if (this.tray) { this.tray.geometry.dispose(); this.tray = null; }
    this.cookies = []; this.plateObjs = []; this.counted = 0;
    this.changed();
  }
  /** one cookie counted: it moves over to the row and its number stands on it */
  private countOne(c: Cookie) {
    c.num = ++this.counted;
    this.go(c.g, this.rowAt(c.num - 1, this.cookies.length), 0.42, { arc: 0.06, done: () => bSfx.clack() });
    this.numPin(c, c.num);
    bSfx.tick(Math.min(8, c.num));
  }
  async demoCount() {
    for (const c of this.cookies) { if (c.num) continue; this.countOne(c); await this.wait(900); }
    await this.wait(300);
  }
  tapCount() {
    return new Promise<void>(res => {
      this.job = { done: () => { this.job = null; clearInterval(this.auto); this.changed(); setTimeout(res, 500); } };
      this.changed();
    });
  }
  finish() {
    if (!this.job) return;
    clearInterval(this.auto);
    this.auto = setInterval(() => {
      const c = this.cookies.find(x => !x.num);
      if (c) this.countOne(c);
      if (!this.cookies.some(x => !x.num)) this.job?.done();
    }, 420) as unknown as number;
  }
  async slipCount(_who: 'buddy' | 'pal', slip: Slip) {
    const n = this.cookies.length, path = countPath(n, slip), on = numbersOn(path, n);
    const seen = new Set<number>();
    for (let k = 0; k < path.length; k++) {
      const c = this.cookies[path[k]];
      this.numPin(c, k + 1, seen.has(path[k]));
      seen.add(path[k]);
      this.markOn([c.g]);
      bSfx.tick(Math.min(8, k + 1));
      await this.wait(700);
    }
    const odd = slipped(path, n);
    this.markOn(odd >= 0 ? [this.cookies[odd].g] : []);
    if (odd >= 0 && on[odd].length === 0) this.cookies[odd].shakeUntil = this.now + 0.8;
    await this.wait(500);
    return path.length;
  }
  async clearNumbers() {
    this.unmark();
    this.unpin(p => /^n\d/.test(p.id));
    for (const c of this.cookies) c.num = 0;
    this.counted = 0;
    await this.wait(250);
  }
  async pointCount() {
    const done = this.inOrder().filter(c => c.num);
    for (const c of done) { this.markOn([c.g]); bSfx.tick(Math.min(8, c.num)); await this.wait(620); }
  }
  async plates(n: number) {
    this.unmark();
    const show = Math.max(0, Math.min(n, MOST)), cs = this.inOrder(), N = Math.max(cs.length, show);
    cs.forEach((c, i) => this.go(c.g, this.rowAt(i, N), 0.4, { arc: 0.03 }));
    await this.wait(cs.some(c => c.g.position.distanceTo(this.rowAt(cs.indexOf(c), N)) > 0.01) ? 450 : 0);
    for (let j = 0; j < show; j++) {
      const p = this.makePlate(), to = this.P(this.rowX(j, N), PLATE_Y);
      p.position.copy(this.P(-60, PLATE_Y));
      this.go(p, to, 0.5, { delay: j * 0.12, done: () => bSfx.clack() });
      this.plateObjs.push(p);
    }
    if (n > MOST) this.pin({ id: 'many', text: `${n} plates`, kind: 'word', at: () => this.P(this.rowX(show - 1, N), PLATE_Y).add(new THREE.Vector3(0, 0.12, 0)) });
    await this.wait(show * 120 + 560);
    const on = Math.min(show, cs.length);
    for (let j = 0; j < on; j++) {
      const c = cs[j], p = this.plateObjs[j];
      c.plate = p;
      this.go(c.g, p.position.clone().add(new THREE.Vector3(0, PR * this.s * 0.12, 0)), 0.42, { delay: j * 0.2, arc: 0.1, done: () => bSfx.clack() });
    }
    await this.wait(on * 200 + 520);
    if (on < cs.length) { for (const c of cs.slice(on)) c.shakeUntil = this.now + 0.9; this.markOn(cs.slice(on).map(c => c.g)); bSfx.rattle(); }
    else if (show > cs.length) this.markOn(this.plateObjs.slice(cs.length));
    else bSfx.thunk();
    await this.wait(700);
  }
  async platesOff() {
    this.unmark(); this.unpin(p => p.id === 'many');
    const cs = this.inOrder();
    cs.forEach((c, i) => { c.plate = null; this.go(c.g, this.rowAt(i, cs.length), 0.42, { delay: i * 0.05, arc: 0.08 }); });
    const gone = this.plateObjs; this.plateObjs = [];
    for (const p of gone) this.go(p, p.position.clone().add(new THREE.Vector3(2.4, 0, 0)), 0.6, { delay: 0.2 });
    await this.wait(900);
    for (const p of gone) { p.removeFromParent(); this.moves.delete(p); }
  }
  async bump() {
    this.unmark(); this.unpin(() => true);
    for (const c of this.cookies) c.num = 0;
    this.counted = 0;
    this.shakeUntil = this.now + 0.45;
    bSfx.tip();
    this.sc.palDo('hop');
    const n = this.cookies.length;
    this.cookies.forEach((c, i) => {
      const a = (i / n) * Math.PI * 2 + 0.6;
      this.go(c.g, this.P(MID_X + Math.cos(a) * 120, TRAY_Y + 14 + Math.sin(a) * 50).add(new THREE.Vector3(0, 0.014, 0)), 0.7, { delay: 0.15 + i * 0.04, arc: 0.02 });
    });
    await this.wait(1300);
  }
  async recount() {
    const n = this.cookies.length, start = Math.min(3, n - 1);
    for (let k = 0; k < n; k++) {
      const c = this.cookies[(start + k) % n];
      c.num = k + 1;
      this.numPin(c, c.num);
      this.markOn([c.g]);
      bSfx.tick(Math.min(8, c.num));
      await this.wait(650);
    }
    this.counted = n;
  }
  async party() {
    this.unmark(); this.unpin(() => true);
    const cs = this.inOrder();
    cs.forEach((c, i) => {
      const off = new THREE.Vector3(-2.6, 0, 0), d = i * 0.14;
      this.go(c.g, c.g.position.clone().add(off), 0.9, { delay: d });
      if (c.plate) this.go(c.plate, c.plate.position.clone().add(off), 0.9, { delay: d });
    });
    this.sc.palDo('hop');
    await this.wait(cs.length * 140 + 1000);
  }

  // ---------- the child's hands ----------
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    if (!this.job || kind !== 'down') return false;
    let best: Cookie | null = null, bestD = Math.max(64, innerWidth * 0.05);
    for (const c of this.cookies) { const p = this.screenOf(this.topOf(c)), d = Math.hypot(p.x - x, p.y - y); if (d < bestD) { best = c; bestD = d; } }
    if (!best) return false;
    if (best.num) { best.shakeUntil = this.now + 0.5; bSfx.tick(0); return true; }
    this.countOne(best);
    if (!this.cookies.some(c => !c.num)) this.job.done();
    this.changed();
    return true;
  }
  private next() { return this.job ? this.cookies.find(c => !c.num) ?? null : null; }
  tryPoint() { const c = this.next(); return c ? this.topOf(c) : null; }
  handPoint() { const c = this.next(); return c ? this.topOf(c).add(new THREE.Vector3(0, -0.03 + Math.sin(this.now * 5) * 0.012, 0)) : null; }
  dragPath() { return null; }

  update(_dt: number, t: number) {
    this.now = t;
    for (const [o, m] of this.moves) {
      const k = clamp01((t - m.t0) / m.dur);
      if (t < m.t0) continue;
      o.position.lerpVectors(m.from, m.to, smooth(k));
      o.position.y += Math.sin(Math.PI * k) * m.arc;
      if (k >= 1) { this.moves.delete(o); m.done?.(); }
    }
    for (const c of this.cookies) c.g.rotation.z = c.shakeUntil > t ? Math.sin(t * 40) * 0.14 * (c.shakeUntil - t) : 0;
    this.root.position.x = this.shakeUntil > t ? Math.sin(t * 50) * 0.012 * (this.shakeUntil - t) / 0.45 : 0;
    const pulse = 1 + Math.sin(t * 6) * 0.07;
    for (const m of this.marks) m.scale.setScalar(pulse);
  }
  dispose() {
    clearInterval(this.auto);
    this.root.removeFromParent();
    this.tray?.geometry.dispose();
    for (const g of Object.values(this.geo)) g?.dispose();
    for (const m of Object.values(this.mat)) for (const x of [m].flat()) (x as THREE.Material | undefined)?.dispose();
    this.sc.extraWork = () => [];
  }
}
