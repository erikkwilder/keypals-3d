// A ten frame and counters in two colours, for the beat lessons that add and take away on a frame (the first
// is Make Ten, math/beats/tenLesson.ts; written so that the teen-number lesson and grade 1's adding lessons can
// use it too: `frames` in the constructor's options gives a second frame, and places are counted across them).
//
// On the table: a flat tray with two rows of five places. A counter of the first colour (blue) sits in each
// place that was full when the tray came. Counters of the second colour (pink) come one after another, each
// into an empty place; one that finds no place stops in a row in front of the tray. So a number that is too
// small shows as a place still empty, and one that is too big as counters with no place. A yellow ring is a
// light on what the narrator is talking about (a row, every place, the empty places, one colour's counters, or
// the place being counted, which also gets its number). A red ring marks what is left over. In Make Ten the
// tray is a bun tray and the counters are buns with blue and pink icing: a brown bun with a coloured top.
//
// The same layout serves a wide screen and a phone: the tray is five places across, and the counters with no place
// stand in rows of five in front of it, so the camera can come close. The numeral on a place is a big tick.
import * as THREE from 'three';
import { stage } from './stage';
import { SceneWaits } from './sceneWaits';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { FrameWorld, Lit } from '../math/beats/tenLesson';
import { bSfx } from '../math/beats/sounds';
import { COUNT_WORDS, countWord } from '../content/voice';

/** the table top's height, in metres */
const TY = 0.48;
/** the board is 600 units across; this is its middle */
const MID_X = 300;
/** a place's size, in board units, and how many places a row has */
const C = 54, ROW = 5;
/** the frame's top edge, and the gap between the frame and the row of counters with no place */
const TOP = 96, FRONT_GAP = 18;
/** how far apart the rows of counters with no place are, in places */
const SPARE_ROW = 0.8;
/** the most counters shown with no place (two rows of five); a bigger number says so in words */
const MOST_SPARE = 10;
/** the two colours: the sum's first and second numbers are written in the same ones (BeatEpisode .t-a, .t-b) */
const INK = { a: 0x1f6fd1, b: 0xd63c7c };
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

type Move = { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number; done?: () => void };
type Counter = { g: THREE.Group; c: 'a' | 'b'; /** its place, or -1 when it has none */ place: number; shakeUntil: number };
type Tray = { g: THREE.Group; /** which counter is in each place */ at: (Counter | null)[]; /** the places that had no counter of the first colour, in order */ open: number[]; spare: Counter[]; counted: number };

export class FrameKit implements FrameWorld {
  readonly root = new THREE.Group();
  /** the count words it says as a place is filled by the child (a young child hears the count: rule 31) */
  readonly words = COUNT_WORDS.slice(0, 10).map(l => l.id);
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  /** a count word to be heard as a place is counted (the page sets it) */
  onWord: ((id: string) => void) | null = null;
  private now = 0;
  /** metres to a board unit (set in refit) */
  private s = 0.0032;
  private tall = innerWidth < innerHeight * 0.9;
  private frames: number;
  /** the tray on the table (null: none) */
  private tray: Tray | null = null;
  private marks: THREE.Mesh[] = [];
  private moves = new Map<THREE.Object3D, Move>();
  /** what the child's taps do now (null: nothing). The play-through driver reads this name */
  private job: { kind: 'fill' | 'find'; done: () => void } | null = null;
  private auto = 0;
  /** the written sum, which stays when the tray has gone (the end card shows it) */
  private sum: Pin | null = null;
  /** (waits on the scene's clock, as the movements are: never setTimeout, rule 34) */
  private waits = new SceneWaits();
  private geo: Record<string, THREE.BufferGeometry> = {};
  private mat: Record<string, THREE.Material> = {};

  constructor(private sc: EpisodeScene, o: { frames?: 1 | 2 } = {}) {
    this.frames = o.frames ?? 1;
    sc.root.add(this.root);
    if (this.tall) { sc.workZoom = 2.1; sc.tallShare = 0.5; } else { sc.closeUp(); sc.workZoom = 1.6; }
    sc.extraWork = () => (this.tray ? [this.tray.g, ...this.tray.spare.map(c => c.g)] : []);
  }

  async load() {
    this.mat.tray = new THREE.MeshStandardMaterial({ color: 0x8d97a6, metalness: 0.35, roughness: 0.5 });
    this.mat.place = new THREE.MeshStandardMaterial({ color: 0xdfe5ec, roughness: 0.8 });
    this.mat.bun = new THREE.MeshStandardMaterial({ color: 0xd9a05b, roughness: 0.75 });
    this.mat.a = new THREE.MeshStandardMaterial({ color: INK.a, roughness: 0.45 });
    this.mat.b = new THREE.MeshStandardMaterial({ color: INK.b, roughness: 0.45 });
    this.mat.mark = new THREE.MeshBasicMaterial({ color: 0xffc93d, transparent: true, opacity: 0.95, depthWrite: false });
    this.mat.bad = new THREE.MeshBasicMaterial({ color: 0xe0413a, transparent: true, opacity: 0.95, depthWrite: false });
  }
  /** the part of the board the camera frames: the tray, and the two rows in front of it for counters with no place */
  bounds() {
    const w = this.width() + 30;
    return { x: MID_X - w / 2, y: TOP - 16, w, h: this.depth() + FRONT_GAP + 2 * SPARE_ROW * C + 32 };
  }
  /** how deep the frames are together, in board units */
  private depth() { return this.frames === 2 && this.tall ? 4 * C + 24 : 2 * C; }
  refit() {
    const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100;
    // (made once: things already on the table keep theirs)
    if (this.geo.place) return;
    const c = C * this.s;
    this.geo.place = new THREE.BoxGeometry(c * 0.9, c * 0.05, c * 0.9);
    this.geo.bun = new THREE.SphereGeometry(c * 0.36, 24, 14);
    this.geo.top = new THREE.SphereGeometry(c * 0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    this.geo.mark = new THREE.TorusGeometry(c * 0.43, c * 0.045, 6, 36);
  }

  // ---------- the small tools every kit has ----------
  private wait(ms: number) { return this.waits.wait(ms); }
  private later(ms: number, fn: () => void) { this.waits.later(ms, fn); }
  private changed() { this.onChange?.(); }
  /** a word card on a point in the room (the same id again replaces it); the sum is kept with them */
  private pin(p: Pin) { this.pins = [...this.pins.filter(x => x.id !== p.id), p]; this.changed(); }
  private unpin(test: (p: Pin) => boolean) { this.pins = this.pins.filter(p => p.kind === 'sum' ? p === this.sum : !test(p)); this.changed(); }
  /** a point on the table, in board units */
  private P(x: number, y: number) { const p = this.sc.boardPoint(x, y); p.y = TY; return p; }
  /** where a point in the room is on the screen (the play-through driver reads this name) */
  private screenOf(p: THREE.Vector3) { const v = p.clone().project(stage.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }
  /** a thing moves to a place in `dur` seconds of the scene's time */
  private go(o: THREE.Object3D, to: THREE.Vector3, dur: number, o2: { delay?: number; arc?: number; done?: () => void } = {}) {
    this.moves.set(o, { from: o.position.clone(), to: to.clone(), t0: this.now + (o2.delay ?? 0), dur, arc: o2.arc ?? 0, done: o2.done });
  }
  /** how wide the frames are together, in board units (two frames stand side by side, or one under the other on a phone) */
  private width() { return this.frames === 2 && !this.tall ? 2 * ROW * C + 40 : ROW * C; }
  private places() { return this.frames * 10; }
  /** where a place is on the board: 0 to 4 a frame's top row from the left, 5 to 9 its bottom row */
  private placeXY(p: number): [number, number] {
    const f = Math.floor(p / 10), i = p % 10, side = this.frames === 2 && !this.tall;
    const x0 = MID_X - this.width() / 2 + (side ? f * (ROW * C + 40) : 0), y0 = TOP + (side ? 0 : f * (2 * C + 24));
    return [x0 + ((i % ROW) + 0.5) * C, y0 + (Math.floor(i / ROW) + 0.5) * C];
  }
  /** where the `j`th counter with no place stops, in front of the tray: rows of five */
  private spareXY(j: number): [number, number] {
    const y0 = TOP + this.depth() + FRONT_GAP;
    return [MID_X - (ROW * C) / 2 + ((j % ROW) + 0.5) * C, y0 + (Math.floor(j / ROW) + 0.5) * SPARE_ROW * C];
  }
  /** a place's point in the room, as the tray stands when it has come to rest */
  private placeAt(p: number) { const [x, y] = this.placeXY(p); return this.P(x, y); }
  /** a little above a place or a counter: where its number stands */
  private over(p: THREE.Vector3) { return p.clone().add(new THREE.Vector3(0, C * this.s * 0.75, 0)); }
  private empties() { const t = this.tray; return t ? t.at.map((c, p) => (c ? -1 : p)).filter(p => p >= 0) : []; }

  // ---------- making things ----------
  private makeTray(): Tray {
    const g = new THREE.Group(), c = C * this.s;
    for (let f = 0; f < this.frames; f++) {
      const [x0, y0] = this.placeXY(f * 10), [x1, y1] = this.placeXY(f * 10 + 9);
      const a = this.P(x0, y0), b = this.P(x1, y1);
      const base = new THREE.Mesh(new THREE.BoxGeometry(b.x - a.x + c * 1.16, c * 0.1, b.z - a.z + c * 1.16), this.mat.tray);
      base.position.set((a.x + b.x) / 2, TY + c * 0.05, (a.z + b.z) / 2); base.castShadow = true; base.receiveShadow = true;
      g.add(base);
    }
    for (let p = 0; p < this.places(); p++) {
      const m = new THREE.Mesh(this.geo.place, this.mat.place);
      m.position.copy(this.placeAt(p)); m.position.y = TY + c * 0.1; m.receiveShadow = true;
      g.add(m);
    }
    this.root.add(g);
    return { g, at: Array.from({ length: this.places() }, () => null), open: [], spare: [], counted: 0 };
  }
  /** a bun with coloured icing: `parent` is the tray (it rides with it) or the table */
  private makeCounter(c: 'a' | 'b', parent: THREE.Object3D): Counter {
    const g = new THREE.Group(), r = C * this.s;
    const body = new THREE.Mesh(this.geo.bun, this.mat.bun); body.scale.y = 0.6; body.position.y = r * 0.2; body.castShadow = true;
    const top = new THREE.Mesh(this.geo.top, this.mat[c]); top.scale.y = 0.75; top.position.y = r * 0.26;
    g.add(body, top);
    parent.add(g);
    return { g, c, place: -1, shakeUntil: 0 };
  }
  /** where a counter rests in a place, in the tray's own space */
  private restIn(p: number) { const at = this.placeAt(p); at.y = TY + C * this.s * 0.125; return at; }
  /** rings on these points of the tray or the table: yellow for what is being talked about, red for what is left over */
  private ring(parent: THREE.Object3D, at: THREE.Vector3, bad: boolean) {
    const m = new THREE.Mesh(this.geo.mark, bad ? this.mat.bad : this.mat.mark);
    m.rotation.x = -Math.PI / 2; m.position.copy(at); m.position.y = TY + C * this.s * 0.14; m.renderOrder = 5;
    parent.add(m); this.marks.push(m);
  }
  private unmark() { for (const m of this.marks) m.removeFromParent(); this.marks = []; }
  private ringPlaces(ps: number[], bad = false) { const t = this.tray; if (t) for (const p of ps) this.ring(t.g, this.placeAt(p), bad); }

  // ---------- what the script can ask for (FrameWorld) ----------
  async trayIn(n: number, over = 0) {
    // (the tray before lets go of the table at once and leaves by itself: with the voice off every picture of
    // a line comes at once, and the new tray must be whole)
    this.leave(0.7);
    const t = this.makeTray(); this.tray = t;
    for (let p = 0; p < Math.min(n, this.places()); p++) { const k = this.makeCounter('a', t.g); k.place = p; k.g.position.copy(this.restIn(p)); t.at[p] = k; }
    t.open = this.empties();
    const dur = Math.max(0.9, Math.min(over, 1.6));
    t.g.position.set(-2.2, 0, 0);
    this.go(t.g, new THREE.Vector3(0, 0, 0), dur, { done: () => bSfx.thunk() });
    this.changed();
    await this.wait(Math.max(dur, over) * 1000 + 60);
  }
  async fill(n: number, over = 0) {
    const t = this.tray; if (!t) return;
    const ps = this.empties().slice(0, n), gap = Math.max(0.12, Math.min(0.6, (over - 0.5) / Math.max(1, ps.length - 1)));
    ps.forEach((p, i) => {
      const k = this.makeCounter('a', t.g), to = this.restIn(p);
      k.place = p; t.at[p] = k;
      k.g.position.copy(to).add(new THREE.Vector3(0, 0.5, 0)); k.g.visible = false;
      this.later(i * gap * 1000, () => { k.g.visible = true; });
      this.go(k.g, to, 0.42, { delay: i * gap, done: () => bSfx.clack() });
    });
    t.open = this.empties();
    await this.wait(Math.max(0, ps.length - 1) * gap * 1000 + 480);
  }
  async more(n: number, over = 0, from: 'top' | 'bottom' = 'top') {
    const t = this.tray; if (!t) return;
    this.unmark(); this.unpin(p => p.id.startsWith('e'));
    const free = this.empties(), order = from === 'bottom' ? [...free.filter(p => p % 10 >= ROW), ...free.filter(p => p % 10 < ROW)] : free;
    const show = Math.max(0, Math.min(n, order.length + MOST_SPARE - t.spare.length));
    const gap = Math.max(0.22, Math.min(0.9, (over - 0.5) / Math.max(1, show - 1)));
    // (one counter alone may slide a little slower, to end with the words about it: 1.5 times at most)
    const slide = show === 1 ? Math.max(0.5, Math.min(0.75, over)) : 0.5;
    for (let j = 0; j < show; j++) {
      const p = order[j], k = this.makeCounter('b', p == null ? this.root : t.g);
      let to: THREE.Vector3;
      if (p != null) { k.place = p; t.at[p] = k; to = this.restIn(p); }
      else { const [x, y] = this.spareXY(t.spare.length); to = this.P(x, y); to.y = TY + C * this.s * 0.02; t.spare.push(k); }
      k.g.position.copy(to).add(new THREE.Vector3(1.6, 0, 0.3)); k.g.visible = false;
      this.later(j * gap * 1000, () => { k.g.visible = true; });
      this.go(k.g, to, slide, { delay: j * gap, arc: 0.07, done: () => bSfx.clack() });
    }
    // (a silly number is acted out up to a cap, and says the rest in words)
    if (n > show) this.pin({ id: 'many', text: `${n} buns`, kind: 'word', at: () => this.over(this.P(MID_X, TOP + this.depth() + FRONT_GAP + 2 * SPARE_ROW * C + 8)) });
    this.changed();
    await this.wait(Math.max(0, show - 1) * gap * 1000 + slide * 1000 + 60);
  }
  async moreOff() {
    const t = this.tray; if (!t) return;
    this.unmark(); this.unpin(() => true);
    const gone = [...t.at.filter((k): k is Counter => !!k && k.c === 'b'), ...t.spare];
    if (!gone.length) return;
    // (the places are empty at once, whatever is still sliding away)
    t.at = t.at.map(k => (k && k.c === 'b' ? null : k)); t.spare = []; t.counted = 0;
    for (const k of gone) this.go(k.g, k.g.position.clone().add(new THREE.Vector3(1.6, 0, 0.3)), 0.45, { done: () => k.g.removeFromParent() });
    await this.wait(500);
  }
  light(what: Lit) {
    this.unmark();
    const t = this.tray; if (!t || !what) return;
    const all = t.at.map((_, p) => p);
    this.ringPlaces(what === 'all' ? all : what === 'top' ? all.filter(p => p % 10 < ROW) : what === 'bottom' ? all.filter(p => p % 10 >= ROW)
      : what === 'empty' ? this.empties() : all.filter(p => t.at[p]?.c === what));
    bSfx.tink();
  }
  point(k: number) {
    const t = this.tray, p = t?.open[k - 1];
    if (!t || p == null) return;
    this.unmark(); this.ringPlaces([p]);
    this.pin({ id: `e${p}`, text: String(k), kind: 'tick', big: true, at: () => this.over(this.placeAt(p)) });
    bSfx.tick(Math.min(8, k));
  }
  async showLeft() {
    const t = this.tray; if (!t) return;
    this.unmark();
    this.ringPlaces(this.empties(), true);
    for (const k of t.spare) { this.ring(this.root, k.g.position, true); k.shakeUntil = this.now + 0.5; }
    bSfx.tick(0);
    await this.wait(500);
  }
  writeSum(a: number, b: number) {
    // (it stands where the tray's far edge is, and stays there when the tray has gone)
    const at = this.over(this.P(MID_X, TOP - 30)).add(new THREE.Vector3(0, 0.1, 0));
    this.sum = { id: 'sum', text: `${a} + ${b} = ${a + b}`, kind: 'sum', parts: [{ t: String(a), c: 'a' }, { t: '+' }, { t: String(b), c: 'b' }, { t: '=' }, { t: String(a + b) }], at: () => at };
    this.pin(this.sum);
  }
  /** the tray on the table lets go of it and slides away, with everything on it and beside it */
  private leave(over: number) {
    const t = this.tray; if (!t) return;
    this.tray = null; this.job = null; this.auto++;
    this.unmark(); this.unpin(() => true);
    const away = new THREE.Vector3(2.4, 0, 0);
    for (const o of [t.g, ...t.spare.map(k => k.g)]) this.go(o, o.position.clone().add(away), over, { done: () => o.removeFromParent() });
  }
  async clear(over = 0.8) {
    if (!this.tray) return;
    this.leave(Math.max(0.8, over));
    await this.wait(Math.max(0.8, over) * 1000 + 60);
  }
  clearForCard() { this.leave(0.6); }

  // ---------- the child's hands ----------
  /** the next number goes to a place the child (or "Show me") filled */
  private fillOne(p: number) {
    const t = this.tray; if (!t) return;
    const k = this.makeCounter('b', t.g), to = this.restIn(p), n = ++t.counted;
    k.place = p; t.at[p] = k;
    k.g.position.copy(to).add(new THREE.Vector3(0, 0.3, 0));
    this.go(k.g, to, 0.3, { done: () => bSfx.clack() });
    this.unmark(); this.ringPlaces([p]);
    this.pin({ id: `e${p}`, text: String(n), kind: 'tick', big: true, at: () => this.over(this.placeAt(p)) });
    bSfx.tick(Math.min(8, n));
    this.onWord?.(countWord(n));
  }
  tapFill() {
    return new Promise<void>(res => {
      this.unmark();
      if (this.tray) this.tray.counted = 0;
      this.job = { kind: 'fill', done: () => { this.job = null; this.changed(); this.later(450, res); } };
      this.changed();
    });
  }
  tapEmpty() {
    return new Promise<void>(res => {
      this.unmark();
      this.job = { kind: 'find', done: () => { this.job = null; this.changed(); this.later(450, res); } };
      this.changed();
    });
  }
  private found(p: number) { this.unmark(); this.ringPlaces([p]); bSfx.bell(); this.job?.done(); }
  finish() {
    const j = this.job;
    if (!j) return;
    if (j.kind === 'find') { const p = this.empties()[0]; if (p != null) this.found(p); else j.done(); return; }
    // (one place, then the next, until the tray is full; `auto` changes when the job ends or "Show me" is
    // asked again, which stops an older run)
    const run = ++this.auto;
    const step = () => {
      if (run !== this.auto || this.job !== j) return;
      const p = this.empties()[0];
      if (p != null) this.fillOne(p);
      if (!this.empties().length) j.done(); else this.later(700, step);
    };
    step();
  }
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    const t = this.tray;
    if (!this.job || !t || kind !== 'down') return false;
    let best = -1, bestD = Math.max(64, innerWidth * 0.05);
    for (let p = 0; p < t.at.length; p++) { const s = this.screenOf(this.placeAt(p)), d = Math.hypot(s.x - x, s.y - y); if (d < bestD) { best = p; bestD = d; } }
    if (best < 0) return false;
    const k = t.at[best];
    // (a touch that goes wrong does something: a place that has a bun shakes it, and nothing is counted)
    if (k) { k.shakeUntil = this.now + 0.5; bSfx.tick(0); return true; }
    if (this.job.kind === 'find') { this.found(best); return true; }
    this.auto++;
    this.fillOne(best);
    if (!this.empties().length) this.job.done();
    this.changed();
    return true;
  }
  /** where the hint hand shows (it bobs), and where a first touch should land: the first empty place */
  handPoint() { const p = this.tryPoint(); return p ? p.add(new THREE.Vector3(0, 0.03 + Math.sin(this.now * 5) * 0.012, 0)) : null; }
  tryPoint() { const p = this.job ? this.empties()[0] : null; return p == null ? null : this.placeAt(p).add(new THREE.Vector3(0, C * this.s * 0.15, 0)); }
  dragPath() { return null; }

  update(_dt: number, t: number) {
    this.now = t;
    this.waits.tick(t);
    for (const [o, m] of this.moves) {
      if (t < m.t0) continue;
      const k = clamp01((t - m.t0) / m.dur);
      o.position.lerpVectors(m.from, m.to, smooth(k));
      o.position.y += Math.sin(Math.PI * k) * m.arc;
      if (k >= 1) { this.moves.delete(o); m.done?.(); }
    }
    const tr = this.tray;
    if (tr) for (const k of [...tr.at, ...tr.spare]) if (k) k.g.rotation.z = k.shakeUntil > t ? Math.sin(t * 40) * 0.16 * (k.shakeUntil - t) : 0;
    const pulse = 1 + Math.sin(t * 6) * 0.06;
    for (const m of this.marks) m.scale.setScalar(pulse);
  }
  dispose() {
    this.auto++; this.waits.clear();
    this.root.removeFromParent();
    this.root.traverse(o => { const g = (o as THREE.Mesh).geometry; if (g && !Object.values(this.geo).includes(g)) g.dispose(); });
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of Object.values(this.mat)) m.dispose();
    this.sc.extraWork = () => [];
    this.sc.workZoom = 1; this.sc.tallShare = null;
  }
}
