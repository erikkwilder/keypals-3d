// The world of the counting lesson (math/beats/countLesson.ts): cookies on a baking tray on the kitchen
// table, and a row in front of it where counted cookies go. A counted cookie moves into the row with its
// number standing on it, so the child can see which ones are done and which number came last. Plates slide
// in from the front, as many as a number says, each one under a cookie in the row as the cookie hops up, so
// a wrong number shows a cookie with no plate or a plate left empty. A yellow ring marks the cookie being
// counted; a red ring marks the cookie or plate that shows a problem. Everything is big, so a five-year-old
// can see each cookie and tap it on a phone. Cookies and plates use the kitchen's own cookie and plate
// pictures (public/learn/ep/).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stage } from './stage';
import { loadTexture } from './assets';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { CountWorld } from '../math/beats/countLesson';
import { countPath, slipped, type Slip } from '../math/beats/count';
import { bSfx } from '../math/beats/sounds';
import { countWord } from '../content/voice';

const TY = 0.48;
const MID_X = 300;
/** cookie and plate sizes, in board units */
const CR = 28, PR = 34;
/** the most plates shown; a bigger number says so in words */
const MOST = 8;
/** Where things go, in board units. A wide screen has one long row in front of a wide tray, and the plates
 *  come into the row under the cookies. A phone is narrow, so to keep the cookies big its tray is deeper and
 *  its row goes in lines of up to 4; the plates of a line slide in from the side under its cookies, which
 *  jump up and wait in the air until their plates are under them. */
type Layout = {
  trayY: number; trayW: number; trayD: number; rowY: number;
  /** most cookies in one line of the row; the row's width; the gap from one line to the next */
  cols: number; rowW: number; lineGap: number;
  bounds: { x: number; y: number; w: number; h: number };
  /** where a mixed-up batch lies on the tray (across and back from its middle), roughly in reading order */
  mixed: [number, number][];
  /** a tidy batch on the tray: the step across, and how far each one sits back or forward */
  tidy: [number, number];
  /** the ring after the bump: half across, half back */
  ring: [number, number];
};
const WIDE: Layout = {
  trayY: 105, trayW: 420, trayD: 160, rowY: 228, cols: 8, rowW: 580, lineGap: 0,
  bounds: { x: 0, y: 20, w: 600, h: 255 },
  mixed: [[-165, 30], [-118, -38], [-62, 36], [-12, -32], [44, 40], [92, -40], [150, 28], [168, -36]],
  tidy: [80, 22], ring: [160, 50],
};
const TALL: Layout = {
  trayY: 95, trayW: 290, trayD: 150, rowY: 214, cols: 4, rowW: 290, lineGap: 76,
  bounds: { x: 150, y: 15, w: 300, h: 318 },
  mixed: [[-106, -30], [-36, -38], [36, -28], [106, -36], [-102, 34], [-34, 28], [38, 38], [104, 30]],
  tidy: [58, 30], ring: [112, 44],
};
/** On a phone the things on the table are made this much bigger: the friends' heads above and the number
 *  keys below leave a short band for the picture, so at the usual size a cookie was about 24 px across */
const TALL_ZOOM = 2.8;
/** ...and seen less steeply from above, so the table's depth takes less of that band and the cookies are wider */
const TALL_PITCH = 0.52;
/** A number on a cookie that lies on the tray stands this far out from the middle of the batch (back ones
 *  further back, front ones further forward, round the circle outward), still on the cookie: two cookies side
 *  by side in a mixed-up batch then never have their numbers on top of each other */
const LBL_OUT = CR * 0.62;
/** a second number on the same cookie (touched twice) stands this many cookie-halves above the first */
const SECOND_UP = 1.25;
/** Sprout Bunny leans over to each cookie it counts: this share of the way across, at most this far (metres),
 *  and never nearer the buddy than this */
const LEAN = 0.5, LEAN_MOST = 0.34, LEAN_CLEAR = 0.72;
/** ...and bends down over the cookies this far (metres); further on a phone, where its head is just under the
 *  narrator's words, so the thought it has after counting stays clear of them */
const BEND = { wide: 0.03, tall: 0.1 };
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

type Move = { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; done?: () => void };
/** `out`: on the tray, which way from the middle of the batch its number stands (across, back); null in the row */
type Cookie = { g: THREE.Group; num: number; shakeUntil: number; plate: THREE.Object3D | null; out: [number, number] | null };

export class CountKit implements CountWorld {
  readonly root = new THREE.Group();
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  /** a count word to be heard as a cookie is counted (the page sets it) */
  onWord: ((id: string) => void) | null = null;
  private now = 0;
  private s = 0.0032;
  /** the layout, chosen once by the screen's shape */
  private L: Layout = innerWidth < innerHeight * 0.9 ? TALL : WIDE;
  private cookies: Cookie[] = [];
  private plateObjs: THREE.Group[] = [];
  private tray: THREE.Mesh | null = null;
  private marks: THREE.Mesh[] = [];
  private moves = new Map<THREE.Object3D, Move>();
  private counted = 0;
  /** what the child's taps do now: count a cookie and move it to the front, count it where it sits, or find
   *  the cookie a friend's count went wrong on */
  private job: { kind: 'count' | 'here'; done: () => void } | { kind: 'slip'; done: (r: 'yes' | 'no' | 'shown') => void } | null = null;
  /** the cookie a friend's count went wrong on (touched twice, or never), until the numbers are cleared */
  private odd: Cookie | null = null;
  private auto = 0;
  private shakeUntil = 0;
  /** after the bump: where each cookie sits in the ring on the tray (they go back there after plates) */
  private ring: [number, number][] | null = null;
  /** Sprout Bunny leaning over to the cookie it is counting: the cookie, how far across it is now, how far
   *  down (0-1), and when its little hop to this cookie began */
  private lean = { to: null as THREE.Vector3 | null, x: 0, down: 0, at: -9 };
  private geo: { cookie?: THREE.BufferGeometry; chip?: THREE.BufferGeometry; plate?: THREE.BufferGeometry; rim?: THREE.BufferGeometry; mark?: THREE.BufferGeometry; ring?: THREE.BufferGeometry } = {};
  private mat: { cookie?: THREE.Material; chip?: THREE.Material; plate?: THREE.Material[]; rim?: THREE.Material; mark?: THREE.MeshBasicMaterial; bad?: THREE.MeshBasicMaterial; tray?: THREE.Material } = {};

  constructor(private sc: EpisodeScene) {
    sc.root.add(this.root);
    // (on a wide screen the camera comes in close, like the fraction lessons', so a cookie is big enough to
    // see and tap; on a phone that would stand the friends further back and push the camera away)
    if (this.L === WIDE) sc.closeUp(); else { sc.workZoom = TALL_ZOOM; sc.tallPitch = TALL_PITCH; }
    // (the friends and the corner props keep clear of the cookies and plates)
    sc.extraWork = () => [...(this.tray ? [this.tray] : []), ...this.cookies.map(c => c.g), ...this.plateObjs];
  }

  async load() {
    const [dough, plateTop] = await Promise.all([loadTexture('learn/ep/tex-cookie.webp', { repeat: true }), loadTexture('learn/ep/tex-plate.webp')]);
    this.mat.cookie = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dough, roughness: 0.85 });
    this.mat.chip = new THREE.MeshStandardMaterial({ color: 0x4a2a17, roughness: 0.55 });
    const white = new THREE.MeshStandardMaterial({ color: 0xfdf7ee, roughness: 0.35 });
    this.mat.plate = [white, new THREE.MeshStandardMaterial({ color: 0xffffff, map: plateTop, roughness: 0.35 }), white];
    this.mat.rim = new THREE.MeshStandardMaterial({ color: 0x6f9fd8, roughness: 0.4 });
    this.mat.mark = new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.95, depthWrite: false });
    this.mat.bad = new THREE.MeshBasicMaterial({ color: 0xe0413a, transparent: true, opacity: 0.95, depthWrite: false });
    // (a metal baking sheet: light grey, so it stands out from the wooden table and the brown cookies)
    this.mat.tray = new THREE.MeshStandardMaterial({ color: 0xc4cad2, metalness: 0.35, roughness: 0.42 });
  }
  bounds() { return this.L.bounds; }
  refit() {
    const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100;
    // (made once: cookies already on the table keep theirs)
    if (this.geo.cookie) return;
    const r = CR * this.s, R = PR * this.s;
    this.geo.cookie = new THREE.CylinderGeometry(r, r * 1.04, r * 0.34, 28);
    this.geo.chip = new THREE.SphereGeometry(r * 0.14, 8, 6);
    this.geo.plate = new THREE.CylinderGeometry(R, R * 0.78, R * 0.12, 32);
    this.geo.rim = new THREE.TorusGeometry(R * 0.94, R * 0.06, 6, 36);
    this.geo.mark = new THREE.TorusGeometry(r * 1.3, r * 0.12, 6, 36);
    this.geo.ring = new THREE.TorusGeometry(R * 1.12, r * 0.12, 6, 36);
  }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
  private changed() { this.onChange?.(); }
  private pin(p: Pin) { this.pins = [...this.pins.filter(x => x.id !== p.id), p]; this.changed(); }
  private unpin(test: (p: Pin) => boolean) { this.pins = this.pins.filter(p => !test(p)); this.changed(); }
  /** a point on the table, in board units */
  private P(x: number, y: number) { const p = this.sc.boardPoint(x, y); p.y = TY; return p; }
  /** the `i`th place of the row, for `n` things (in lines of up to `cols`, as even as they can be) */
  private slot(i: number, n: number): [number, number] {
    const L = this.L, lines = Math.ceil(Math.max(1, n) / L.cols), per = Math.ceil(Math.max(1, n) / lines);
    const line = Math.floor(i / per), k = i % per, inLine = Math.min(per, n - line * per);
    const sp = Math.min(PR * 2 + 22, L.rowW / per);
    return [MID_X + (k - (inLine - 1) / 2) * sp, L.rowY + line * L.lineGap];
  }
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
    return { g, num: 0, shakeUntil: 0, plate: null, out: null };
  }
  private makePlate() {
    const g = new THREE.Group(), R = PR * this.s;
    const body = new THREE.Mesh(this.geo.plate, this.mat.plate); body.position.y = R * 0.06; body.receiveShadow = true; body.castShadow = true;
    const rim = new THREE.Mesh(this.geo.rim, this.mat.rim); rim.rotation.x = -Math.PI / 2; rim.position.y = R * 0.12;
    g.add(body, rim);
    this.root.add(g);
    return g;
  }
  /** a ring round each of these: yellow for the one being counted, red for one that shows a problem (a
   *  plate's ring is wider, to go round the plate) */
  private markOn(objs: THREE.Object3D[], bad = false) {
    this.unmark();
    for (const o of objs) {
      const m = new THREE.Mesh(this.plateObjs.includes(o as THREE.Group) ? this.geo.ring : this.geo.mark, bad ? this.mat.bad : this.mat.mark);
      m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.renderOrder = 5; o.add(m); this.marks.push(m);
    }
  }
  private unmark() { for (const m of this.marks) m.removeFromParent(); this.marks = []; }
  private numPin(c: Cookie, n: number, second = false) {
    const i = this.cookies.indexOf(c);
    this.pin({ id: `n${i}${second ? 'b' : ''}`, text: String(n), kind: 'tick', big: true, at: () => this.labelAt(c, second) });
  }
  /** where a cookie's number stands: on top of it; on the tray a little outward from the batch's middle (see
   *  LBL_OUT); a second number on the same cookie stands on top of the first, so both read as this cookie's */
  private labelAt(c: Cookie, second: boolean) {
    const p = this.topOf(c).add(new THREE.Vector3(0, 0.05, 0));
    // (a phone's row in two lines: the back line's numbers stand back, the front line's forward, so a number
    // in one line never touches the one in front of or behind it)
    let out = c.out;
    if (!out && this.L.lineGap && Math.max(this.cookies.length, this.plateObjs.length) > this.L.cols) {
      const z0 = this.P(MID_X, this.L.rowY).z, z1 = this.P(MID_X, this.L.rowY + this.L.lineGap).z, z = c.g.position.z;
      out = [0, (z - (z0 + z1) / 2) * (z1 - z0) > 0 ? 1 : -1];
    }
    if (out) { const o = this.P(MID_X + out[0] * LBL_OUT, 100 + out[1] * LBL_OUT).sub(this.P(MID_X, 100)); p.x += o.x; p.z += o.z; }
    if (second) p.y += CR * this.s * SECOND_UP;
    return p;
  }
  /** the row's places, for `n` things */
  private rowAt(i: number, n: number) { const [x, y] = this.slot(i, n); return this.P(x, y); }
  /** cookies in the order they were counted (any not counted after, in their own order) */
  private inOrder() { return [...this.cookies].sort((a, b) => (a.num || 99) - (b.num || 99) || this.cookies.indexOf(a) - this.cookies.indexOf(b)); }

  // ---------- the film ----------
  async trayIn(n: number, o: { mixed?: boolean } = {}) {
    if (!this.tray) {
      const L = this.L, w = this.P(MID_X + L.trayW / 2, L.trayY).distanceTo(this.P(MID_X - L.trayW / 2, L.trayY)), d = this.P(MID_X, L.trayY + L.trayD / 2).distanceTo(this.P(MID_X, L.trayY - L.trayD / 2));
      this.tray = new THREE.Mesh(new RoundedBoxGeometry(w, 0.014, d, 2, 0.006), this.mat.tray);
      this.tray.receiveShadow = true;
      this.tray.position.copy(this.P(MID_X, this.L.trayY)).add(new THREE.Vector3(0, 0.007, 0));
      this.root.add(this.tray);
    }
    const [step, back] = this.L.tidy;
    const spots = o.mixed ? this.L.mixed.slice(0, n) : Array.from({ length: n }, (_, i): [number, number] => [(i - (n - 1) / 2) * step, i % 2 ? back : -back]);
    const mid = spots.reduce((a, p) => a + p[0], 0) / Math.max(1, n);
    for (let i = 0; i < n; i++) {
      const c = this.makeCookie(), [u, v] = spots[i % spots.length];
      const to = this.P(MID_X + u - mid, this.L.trayY + v).add(new THREE.Vector3(0, 0.014, 0));
      c.g.position.copy(to).add(new THREE.Vector3(0, 0.6, 0));
      c.out = [0, v < 0 ? -1 : 1];
      this.go(c.g, to, 0.45, { delay: i * 0.12, done: () => bSfx.clack() });
      this.cookies.push(c);
    }
    this.changed();
    await this.wait(n * 120 + 600);
  }
  async trayOut() {
    this.unmark(); this.unpin(() => true); this.lean.to = null;
    const all: THREE.Object3D[] = [...this.cookies.map(c => c.g), ...this.plateObjs, ...(this.tray ? [this.tray] : [])];
    for (const o of all) this.go(o, o.position.clone().add(new THREE.Vector3(2.2, 0, 0)), 0.7);
    await this.wait(760);
    for (const o of all) { o.removeFromParent(); this.moves.delete(o); }
    if (this.tray) { this.tray.geometry.dispose(); this.tray = null; }
    this.cookies = []; this.plateObjs = []; this.counted = 0; this.ring = null;
    this.changed();
  }
  /** one cookie counted: it moves over to the row and its number stands on it */
  private countOne(c: Cookie) {
    c.num = ++this.counted; c.out = null;
    this.go(c.g, this.rowAt(c.num - 1, this.cookies.length), 0.45, { arc: 0.1, done: () => bSfx.clack() });
    this.numPin(c, c.num);
    bSfx.tick(Math.min(8, c.num));
    this.onWord?.(countWord(c.num));
  }
  /** one cookie counted where it sits (after the bump): its number stands on it, and it stays put */
  private countHere(c: Cookie) {
    c.num = ++this.counted;
    this.numPin(c, c.num);
    this.markOn([c.g]);
    bSfx.tick(Math.min(8, c.num));
    this.onWord?.(countWord(c.num));
  }
  async demoCount() {
    for (const c of this.cookies) { if (c.num) continue; this.countOne(c); await this.wait(900); }
    await this.wait(300);
  }
  private tapJob(kind: 'count' | 'here') {
    return new Promise<void>(res => {
      this.job = { kind, done: () => { this.job = null; clearInterval(this.auto); this.changed(); setTimeout(res, 500); } };
      this.changed();
    });
  }
  tapCount() { return this.tapJob('count'); }
  tapHere() { return this.tapJob('here'); }
  tapSlip() {
    return new Promise<'yes' | 'no' | 'shown'>(res => {
      this.unmark();
      this.job = { kind: 'slip', done: r => { this.job = null; this.changed(); setTimeout(() => res(r), 350); } };
      this.changed();
    });
  }
  async showSlip() {
    this.markOn(this.odd ? [this.odd.g] : [], true);
    if (this.odd) this.odd.shakeUntil = this.now + 0.6;
    await this.wait(500);
  }
  finish() {
    const j = this.job;
    if (!j) return;
    if (j.kind === 'slip') { j.done('shown'); return; }
    clearInterval(this.auto);
    this.auto = setInterval(() => {
      const c = this.cookies.find(x => !x.num);
      if (c) { if (j.kind === 'here') this.countHere(c); else this.countOne(c); }
      if (!this.cookies.some(x => !x.num)) j.done();
    }, 620) as unknown as number;
  }
  async slipCount(who: 'buddy' | 'pal', slip: Slip) {
    const n = this.cookies.length, path = countPath(n, slip);
    const seen = new Set<number>();
    for (let k = 0; k < path.length; k++) {
      const c = this.cookies[path[k]];
      this.numPin(c, k + 1, seen.has(path[k]));
      // (each friend goes to the cookie it counts: Sprout Bunny leans over to it with a little hop, the buddy
      // points at it, so the numbers come from what they do)
      if (who === 'pal') { this.lean.to = this.topOf(c); this.lean.at = this.now; } else this.sc.point(this.topOf(c), 0.75);
      seen.add(path[k]);
      this.markOn([c.g]);
      bSfx.tick(Math.min(8, k + 1));
      await this.wait(560);
    }
    // (which cookie it went wrong on is for the child to find: tapSlip. Nothing rings it yet)
    const odd = slipped(path, n);
    this.odd = odd >= 0 ? this.cookies[odd] : null;
    this.unmark();
    await this.wait(500);
    return path.length;
  }
  async clearNumbers() {
    this.unmark(); this.lean.to = null; this.odd = null;
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
    cs.forEach((c, i) => { c.out = null; this.go(c.g, this.rowAt(i, N), 0.4, { arc: 0.1 }); });
    await this.wait(cs.some(c => c.g.position.distanceTo(this.rowAt(cs.indexOf(c), N)) > 0.01) ? 450 : 0);
    const lift = new THREE.Vector3(0, PR * this.s * 0.12, 0), lines = this.L.cols < 8;
    for (let j = 0; j < show; j++) {
      const [x, y] = this.slot(j, N), p = this.makePlate(), c = cs[j];
      this.plateObjs.push(p);
      if (lines) {
        // (a phone: the cookies jump up and wait, the plates of each line slide in together from the left
        // under them, and each cookie comes down onto its plate)
        const to = this.P(x, y);
        p.position.copy(this.P(x - 380, y));
        this.go(p, to, 0.9, { delay: 0.3, done: j ? undefined : () => bSfx.clack() });
        if (c) {
          c.plate = p;
          this.go(c.g, c.g.position.clone().add(new THREE.Vector3(0, 0.16, 0)), 0.28);
          setTimeout(() => this.go(c.g, to.clone().add(lift), 0.3, { done: () => bSfx.clack() }), 1250 + j * 70);
        }
      } else {
        // (each plate slides in from the front to its place in the row; the cookie there hops up as it comes,
        // and lands on it, so no plate goes through a cookie)
        const to = this.P(x, y), d = j * 0.22;
        p.position.copy(this.P(x, y + 170));
        this.go(p, to, 0.5, { delay: d, done: () => bSfx.clack() });
        if (c) { c.plate = p; this.go(c.g, to.clone().add(lift).setY(c.g.position.y + lift.y), 0.5, { delay: d + 0.08, arc: 0.12 }); }
      }
    }
    if (n > MOST) { const [x, y] = this.slot(show - 1, N); this.pin({ id: 'many', text: `${n} plates`, kind: 'word', at: () => this.P(x, y).add(new THREE.Vector3(0, 0.14, 0)) }); }
    await this.wait(lines ? 1250 + show * 70 + 700 : show * 220 + 800);
    const on = Math.min(show, cs.length);
    if (on < cs.length) { for (const c of cs.slice(on)) c.shakeUntil = this.now + 0.9; this.markOn(cs.slice(on).map(c => c.g), true); bSfx.rattle(); }
    else if (show > cs.length) this.markOn(this.plateObjs.slice(cs.length), true);
    else bSfx.thunk();
    await this.wait(700);
  }
  async platesOff() {
    this.unmark(); this.unpin(p => p.id === 'many');
    // (each cookie hops off its plate as the plate slides out to the front; then the row closes up)
    const cs = this.inOrder(), gone = this.plateObjs; this.plateObjs = [];
    const N = Math.max(cs.length, gone.length);
    if (this.L.cols < 8) {
      // (a phone: the cookies jump up off their plates, the plates slide out to the right under them, and the
      // cookies come down where they were)
      cs.forEach((c, i) => { if (!c.plate) return; const at = this.rowAt(i, N); this.go(c.g, at.clone().add(new THREE.Vector3(0, 0.16, 0)), 0.28); setTimeout(() => this.go(c.g, at, 0.3), 1150); c.plate = null; });
      for (const p of gone) this.go(p, p.position.clone().add(new THREE.Vector3(380 * this.s, 0, 0)), 0.8, { delay: 0.3 });
      await this.wait(1500);
    } else {
      cs.forEach(c => { if (c.plate) this.go(c.g, c.g.position.clone().setY(TY), 0.45, { arc: 0.12 }); c.plate = null; });
      gone.forEach((p, j) => { const [x, y] = this.slot(j, N); this.go(p, this.P(x, y + 170), 0.5, { delay: 0.05 }); });
      await this.wait(600);
    }
    // (bumped cookies go back to their places in the ring)
    cs.forEach((c, i) => { if (this.ring) c.out = this.ringOut(this.cookies.indexOf(c)); this.go(c.g, this.ring ? this.ringAt(this.cookies.indexOf(c)) : this.rowAt(i, cs.length), 0.4, { delay: i * 0.04, arc: 0.1 }); });
    await this.wait(this.ring ? 800 : 500);
    for (const p of gone) { p.removeFromParent(); this.moves.delete(p); }
  }
  async bump() {
    this.unmark(); this.unpin(() => true);
    for (const c of this.cookies) c.num = 0;
    this.counted = 0;
    this.shakeUntil = this.now + 0.45;
    bSfx.tip();
    this.sc.palDo('hop');
    // (a ring on the tray, the cookies spaced evenly along it, so none touch; they go up over the tray's edge)
    this.ring = this.ringSpots(this.cookies.length, this.L.ring[0], this.L.ring[1]);
    this.cookies.forEach((c, i) => { c.out = this.ringOut(i); this.go(c.g, this.ringAt(i), 0.7, { delay: 0.15 + i * 0.04, arc: 0.05 }); });
    await this.wait(1300);
  }
  /** outward from the circle's middle, at the `i`th place */
  private ringOut(i: number): [number, number] { const q = this.ring![i], [a, b] = this.L.ring, x = q[0] / (a * a), y = q[1] / (b * b), l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
  private ringAt(i: number) { const q = this.ring![i]; return this.P(MID_X + q[0], this.L.trayY + q[1]).add(new THREE.Vector3(0, 0.014, 0)); }
  /** `n` places evenly spaced along an oval (a, b: half across, half back), starting at the front */
  private ringSpots(n: number, a: number, b: number): [number, number][] {
    const pts: [number, number, number][] = [];
    let len = 0, prev: [number, number] = [0, b];
    for (let k = 0; k <= 720; k++) { const t = Math.PI / 2 + (k / 720) * Math.PI * 2, p: [number, number] = [Math.cos(t) * a, Math.sin(t) * b]; len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); pts.push([p[0], p[1], len]); prev = p; }
    return Array.from({ length: n }, (_, i) => { const want = (i / n) * len, q = pts.find(p => p[2] >= want) ?? pts[0]; return [q[0], q[1]]; });
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
    const j = this.job;
    if (j.kind === 'slip') {
      // (the right one answers; another one shakes, and the narrator says what that cookie has)
      if (best === this.odd) { bSfx.thunk(); j.done('yes'); } else { best.shakeUntil = this.now + 0.5; bSfx.tick(0); j.done('no'); }
      return true;
    }
    if (best.num) { best.shakeUntil = this.now + 0.5; bSfx.tick(0); return true; }
    if (j.kind === 'here') this.countHere(best); else this.countOne(best);
    if (!this.cookies.some(c => !c.num)) j.done();
    this.changed();
    return true;
  }
  /** where the finger's hint rests: the next cookie to count; while the child looks for a friend's slip, the
   *  middle of the tray (it shows where to tap, never which cookie) */
  private next() { return this.job && this.job.kind !== 'slip' ? this.cookies.find(c => !c.num) ?? null : null; }
  private trayMid() { return this.P(MID_X, this.L.trayY).add(new THREE.Vector3(0, 0.03, 0)); }
  tryPoint() { if (this.job?.kind === 'slip') return this.trayMid(); const c = this.next(); return c ? this.topOf(c) : null; }
  handPoint() {
    if (this.job?.kind === 'slip') return this.trayMid().add(new THREE.Vector3(0, Math.sin(this.now * 5) * 0.012, 0));
    const c = this.next(); return c ? this.topOf(c).add(new THREE.Vector3(0, -0.03 + Math.sin(this.now * 5) * 0.012, 0)) : null;
  }
  dragPath() { return null; }

  update(dt: number, t: number) {
    this.now = t;
    // Sprout Bunny leaning over to the cookie it counts (the scene has just put it in its own place for this
    // frame): across toward the cookie, behind the table as before, never into the buddy, a little lower
    const pal = this.sc.pal.root.position, ln = this.lean;
    let want = 0;
    if (ln.to) {
      want = Math.max(-LEAN_MOST, Math.min(LEAN_MOST, (ln.to.x - pal.x) * LEAN));
      const bx = this.sc.me.root.position.x;
      want = bx < pal.x ? Math.max(want, Math.min(0, bx + LEAN_CLEAR - pal.x)) : Math.min(want, Math.max(0, bx - LEAN_CLEAR - pal.x));
    }
    const e = Math.min(1, dt * 9);
    ln.x += (want - ln.x) * e; ln.down += ((ln.to ? 1 : 0) - ln.down) * e;
    if (Math.abs(ln.x) > 1e-4 || ln.down > 1e-3) { pal.x += ln.x; pal.y += Math.sin(Math.PI * clamp01((t - ln.at) / 0.3)) * 0.05 - (this.L === TALL ? BEND.tall : BEND.wide) * ln.down; }
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
    this.sc.workZoom = 1; this.sc.tallPitch = null;
  }
}
