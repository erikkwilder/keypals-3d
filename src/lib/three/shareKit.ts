// The world of Fair Shares (math/beats/shareLesson.ts): a chocolate bar of squares on the workshop table, a long
// plate for each friend, and a knife. A tap on the bar brings the knife down on the nearest line between squares,
// and the pieces part. Serving slides each piece onto its own plate, all starting from the same left edge, so
// pieces stand up side by side like towers: a longer piece stands taller, and its length stands on it.
// (Lying in rows they were hard to compare: the camera looks along the table, so depth is squashed.)
// Someone else's bar (the buddy's, Pebble's) comes in darker, so it's never mistaken for the child's.
// Everything is placed in board units (the episode table's own) and turned into the room every frame, so the
// picture keeps its shape at any screen size.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stage } from './stage';
import { loadTexture } from './assets';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { ShareWorld } from '../math/beats/shareLesson';
import { fairCuts, piecesOf } from '../math/beats/share';
import { bSfx } from '../math/beats/sounds';

/** where things sit on the board: the bar's row, the first plate's row, the gap between plates, the parting at a cut */
// (the bar near the front and big, so every square is an easy target: the bounds wrap the bar, the plates and the
// buddy's pieces beside them closely, because the camera frames the bounds, and empty board only makes everything smaller)
const BAR_Y = 105, ROW0 = 192, ROW_GAP = 38, PART = 8, CX = 300, COL_X = 357, PLATE_X = 116, PLATE_GAP = 62, COL_GAP = 46;
const MILK = 0x9a6542, DARK = 0x5a3524;
/** a phone held upright: the plates go under the bar's middle and someone else's pieces stand in the bar's row,
 *  behind the plates, so everything is only as wide as the bar and the bar fills the screen's width (each square
 *  about 40 px across at 390 px, was 31); the table's things are made bigger and seen a little less from above */
const TALL_PLATE_X = 207, TALL_ZOOM = 1.4, TALL_PITCH = 0.8;
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

/** a square's place in board units: x, y on the board, and how high off the table */
type At = { x: number; y: number; up: number; st?: number };
type Sq = { m: THREE.Mesh; from: At; to: At; t0: number; dur: number; arc: number; gone?: boolean };
type Bar = { n: number; sq: number; lines: number[]; squares: Sq[]; mine: boolean; mode: 'bar' | 'rows' | 'column' | 'under'; out?: boolean; keep?: number;
  /** a piece given away: it stands on top of the piece on another plate */ given?: { from: number; to: number } };
type Job = { kind: 'cut'; pieces: number; done: (lines: number[]) => void } | { kind: 'tap'; hint: number; done: (line: number) => void };
/** a square on its way into a mouth: the piece keeps its shape (`off`, from its middle) and shrinks as it goes */
type Fly = { m: THREE.Mesh; from: THREE.Vector3; off: THREE.Vector3; sc0: THREE.Vector3; to: () => THREE.Vector3; t0: number; dur: number };

export class ShareKit implements ShareWorld {
  readonly root = new THREE.Group();
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  private now = 0;
  private s = 0.0032;
  private geo: THREE.BufferGeometry | null = null;
  private tex: THREE.Texture | null = null;
  private mats = new Map<number, THREE.Material>();
  private bar: Bar | null = null;
  private other: Bar | null = null;
  private trays: { m: THREE.Mesh; born: number; row: number }[] = [];
  private trayMat = new THREE.MeshStandardMaterial({ color: 0xf6f1e7, roughness: 0.35, metalness: 0.02 });
  private knife = new THREE.Group();
  private knifeAt = { x: CX, y: BAR_Y, t0: -9, seen: -9 };
  private job: Job | null = null;
  private flies: Fly[] = [];
  private ray = new THREE.Raycaster();
  private meBox: THREE.Box3 | null = null;
  private tall = innerWidth < innerHeight * 0.9;
  private plateX = this.tall ? TALL_PLATE_X : PLATE_X;

  constructor(private sc: EpisodeScene) {
    sc.root.add(this.root);
    if (this.tall) { sc.workZoom = TALL_ZOOM; sc.tallPitch = TALL_PITCH; }
    // (the friends and the corner props keep clear of the table's middle; on a phone not of a bar lying flat
    // to be cut: it hides nothing, and stepping aside for it sent them out to the screen's sides, which pulled the
    // camera back and made each square 33 px across instead of 40)
    sc.extraWork = () => this.flatBar() ? [] : [this.root];
  }

  async load() {
    this.tex = await loadTexture('learn/frac/choc-top.webp');
    this.geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.14);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.004), new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 0.85, roughness: 0.2 }));
    const handle = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.07, 0.02, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.7 }));
    blade.position.y = 0.055; handle.position.y = 0.145;
    this.knife.add(blade, handle);
    this.knife.visible = false;
    this.root.add(this.knife);
  }
  bounds() { return this.tall ? { x: 137, y: 80, w: 326, h: 145 } : { x: 85, y: 80, w: 430, h: 145 }; }
  /** on a phone, the child's bar while it lies flat to be cut (the camera frames just it then) */
  private flatBar() { const b = this.bar; return this.tall && b && b.mine && b.mode === 'bar' && !b.out ? b : null; }
  /** where someone else's piece p stands to be compared: beside the plates, or on a phone behind plate p */
  /** where a piece laid for comparing stands: beside the plates; on a phone on the free plate's place, or behind the plates */
  private underAt() {
    if (!this.tall) return { x: COL_X, y: ROW0 };
    return this.trays.length < 4 ? { x: this.plateX + this.trays.length * PLATE_GAP, y: ROW0 } : { x: this.plateX + 1.5 * PLATE_GAP, y: BAR_Y };
  }
  private colAt(p: number) { return this.tall ? { x: this.plateX + p * PLATE_GAP, y: BAR_Y } : { x: COL_X + p * COL_GAP, y: ROW0 }; }
  refit() { const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100; }

  private wait(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
  private changed() { this.onChange?.(); }
  private pin(p: Pin) { this.pins = [...this.pins.filter(x => x.id !== p.id), p]; this.changed(); }
  private unpin(test: (p: Pin) => boolean) { this.pins = this.pins.filter(p => !test(p)); this.changed(); }
  private mat(color: number) {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshPhysicalMaterial({ color, map: this.tex, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3 }); this.mats.set(color, m); }
    return m;
  }
  private world(a: At) { return this.sc.boardPoint(a.x, a.y, a.up); }

  // ---------- where every square of a bar belongs ----------
  private left(b: Bar) { return CX - (b.n * b.sq) / 2; }
  private rowY(p: number) { return ROW0 + p * ROW_GAP; }
  private trayTop() { return 0.006; }
  private starts(b: Bar) { const ps = piecesOf(b.n, b.lines), out: number[] = []; let at = 0; for (const p of ps) { out.push(at); at += p; } return { ps, out }; }
  private pieceOf(b: Bar, j: number) { const { out } = this.starts(b); let p = 0; while (p + 1 < out.length && out[p + 1] <= j) p++; return p; }
  private place(b: Bar, j: number): At {
    const h = (b.sq * 0.34 * this.s) / 2;
    if (b.mode === 'bar') {
      const before = b.lines.filter(g => g <= j).length;
      return { x: this.left(b) + (j + 0.5) * b.sq + (before - b.lines.length / 2) * PART + (b.out ? 520 : 0), y: BAR_Y, up: h };
    }
    // standing up: each piece a tower of its squares, on its plate (or on the table to the right)
    const p = this.pieceOf(b, j), k = j - this.starts(b).out[p], tall = (k + 0.5) * b.sq * this.s + 0.004;
    // ('under': the first `b.keep` pieces stand one on top of the other at the comparing place, the rest go away)
    if (b.mode === 'under') {
      if (p >= (b.keep ?? 1)) return { x: this.left(b) + (j + 0.5) * b.sq + 520, y: BAR_Y, up: h };
      const c = this.underAt();
      return { x: c.x, y: c.y, up: tall + (p ? this.starts(b).out[p] * b.sq * this.s + 0.002 : 0), st: 1 };
    }
    const g = b.mode === 'rows' && b.given?.from === p ? b.given : null;
    const c = b.mode === 'column' ? this.colAt(p) : { x: this.plateX + (g ? g.to : p) * PLATE_GAP, y: ROW0 };
    const on = g ? this.starts(b).ps[g.to] * b.sq * this.s * 0.94 + 0.002 : 0;
    return { x: c.x + (b.out ? 520 : 0), y: c.y, up: tall + on + (b.mode === 'rows' && p < this.trays.length ? this.trayTop() : 0), st: 1 };
  }
  /** every square of the bar to its place, each piece a moment after the one before (`stagger` ms) */
  private relayout(b: Bar, dur = 0.45, stagger = 0, arc = 0) {
    b.squares.forEach((q, j) => {
      const cur = this.at(q), to = this.place(b, j), p = this.pieceOf(b, j);
      q.from = cur; q.to = to; q.t0 = this.now + (p * stagger) / 1000; q.dur = dur; q.arc = arc;
    });
  }
  private at(q: Sq): At {
    const k = smooth(clamp01((this.now - q.t0) / q.dur));
    const st = (q.from.st ?? 0) + ((q.to.st ?? 0) - (q.from.st ?? 0)) * k;
    return { x: q.from.x + (q.to.x - q.from.x) * k, y: q.from.y + (q.to.y - q.from.y) * k, up: q.from.up + (q.to.up - q.from.up) * k + Math.sin(Math.PI * k) * q.arc, st };
  }
  private makeBar(n: number, mine: boolean): Bar {
    const sq = Math.min(40, 380 / n), b: Bar = { n, sq, lines: [], squares: [], mine, mode: 'bar' };
    for (let j = 0; j < n; j++) {
      const m = new THREE.Mesh(this.geo!, this.mat(mine ? MILK : DARK));
      m.castShadow = true; m.receiveShadow = true;
      this.root.add(m);
      const to = this.place(b, j), from = { ...to, x: to.x + 520 };
      b.squares.push({ m, from, to, t0: this.now + j * 0.02, dur: 0.7, arc: 0 });
    }
    return b;
  }
  private drop(b: Bar | null) { for (const q of b?.squares ?? []) q.m.removeFromParent(); }
  /** the pieces' places on the screen: the middle of each, a little above it */
  private pieceTop(b: Bar, p: number, side = 0) {
    const { ps, out } = this.starts(b), qs = b.squares.slice(out[p], out[p] + ps[p]);
    const a = this.at(qs[0]), z = this.at(qs[qs.length - 1]);
    const stacked = b.given && (p === b.given.from || p === b.given.to);
    if (stacked && side) return this.world({ x: a.x + b.sq * 1.3, y: a.y, up: (a.up + z.up) / 2 });
    // (every other piece's cards a step higher, so the cards of two pieces side by side never land on each other)
    const step = p % 2 ? b.sq * 0.75 : 0;
    if ((a.st ?? 0) > 0.5) return this.world({ x: a.x + (side < 0 ? -b.sq * 0.3 : side > 0 ? b.sq * 0.3 : 0), y: a.y, up: z.up + ((side < 0 ? b.sq * 1.6 : b.sq * 0.9) + step) * this.s });
    // (on the bar: a size card over the middle of its piece, every other one in front of the bar instead of behind it)
    if (side > 0) return this.world({ x: (a.x + z.x) / 2, y: p % 2 ? a.y + b.sq * 1.15 : a.y - b.sq * 0.35, up: a.up + b.sq * 0.4 * this.s });
    return this.world({ x: side < 0 ? a.x : (a.x + z.x) / 2, y: a.y - b.sq * 0.2, up: a.up + b.sq * 0.4 * this.s });
  }
  private sizePins(b: Bar, on: boolean) {
    const tag = b.mine ? 'size' : 'osize';
    this.unpin(p => p.id.startsWith(`${tag}-`));
    if (!on) return;
    piecesOf(b.n, b.lines).forEach((len, p) => this.pin({ id: `${tag}-${p}`, text: `${len} square${len === 1 ? '' : 's'}`, kind: 'tick', c: 'ink', at: () => this.pieceTop(b, p, 1) }));
  }

  // ---------- the film ----------
  async barIn(squares: number) {
    this.pins = []; this.changed();
    this.drop(this.bar); this.drop(this.other); this.other = null;
    this.dropTrays();
    this.bar = this.makeBar(squares, true);
    bSfx.clack();
    await this.wait(900);
    const b = this.bar;
    // (on a phone the bar is as wide as the screen, so its number stands behind its middle)
    this.pin({ id: 'count', text: `${squares} squares`, kind: 'count', at: () => this.tall ? this.world({ x: CX, y: BAR_Y - b.sq * 1.4, up: b.sq * 0.6 * this.s }) : this.world({ x: this.left(b) - b.sq * 1.8, y: BAR_Y, up: b.sq * 0.6 * this.s }) });
  }
  async plates(n: number, owners?: string[]) {
    this.dropTrays();
    owners?.forEach((who, p) => this.pin({ id: `owner-${p}`, text: who, kind: 'tick', c: 'ink', at: () => this.world({ x: this.plateX + p * PLATE_GAP, y: ROW0 + (PLATE_GAP - 8) * 0.62, up: 0.01 }) }));
    for (let p = 0; p < n; p++) {
      const len = PLATE_GAP - 8;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.42, 1, 32), this.trayMat);
      m.receiveShadow = true;
      (m.userData as { len?: number }).len = len;
      this.root.add(m);
      this.trays.push({ m, born: this.now + p * 0.18, row: p });
    }
    bSfx.clack();
    await this.wait(400 + n * 180);
  }
  private dropTrays() { for (const t of this.trays) { t.m.removeFromParent(); t.m.geometry.dispose(); } this.trays = []; this.unpin(p => p.id.startsWith('owner-')); }
  async give(from: number, to: number) {
    const b = this.bar!;
    this.sizePins(b, false);
    b.given = { from, to };
    // (up in a high arc, so it goes over the piece it lands on, never through it)
    this.relayout(b, 0.9, 0, 0.22);
    await this.wait(1100);
    bSfx.clack();
  }
  total(text: string | null) {
    this.unpin(p => p.id === 'total');
    const b = this.bar, g = b?.given;
    if (text && b && g) this.pin({ id: 'total', text, kind: 'word', at: () => this.pieceTop(b, g.from, 0) });
  }

  cut(pieces: number) {
    this.unpin(p => p.id === 'count');
    return new Promise<number[]>(res => { this.job = { kind: 'cut', pieces, done: res }; this.changed(); });
  }
  tapCut(hint: number) {
    this.unpin(p => p.id === 'count');
    return new Promise<number>(res => { this.job = { kind: 'tap', hint, done: res }; this.changed(); });
  }
  /** the knife comes down on line g of a bar, and its pieces part */
  private chop(b: Bar, g: number) {
    if (b.lines.includes(g)) return;
    this.knifeAt = { x: this.left(b) + g * b.sq, y: BAR_Y, t0: this.now, seen: this.now };
    b.lines = [...b.lines, g].sort((x, y) => x - y);
    setTimeout(() => { this.relayout(b, 0.22); bSfx.clack(); this.changed(); }, 140);
  }
  private cutLine(g: number) {
    const j = this.job, b = this.bar; if (!j || !b || b.lines.includes(g)) return;
    this.chop(b, g);
    if (j.kind === 'tap') { this.job = null; setTimeout(() => { this.sizePins(b, true); j.done(g); }, 420); }
    else if (b.lines.length >= j.pieces - 1) { const lines = [...b.lines]; this.job = null; setTimeout(() => j.done(lines), 520); }
    this.changed();
  }
  async uncut(line: number) {
    const b = this.bar!;
    b.lines = b.lines.filter(g => g !== line);
    this.relayout(b, 0.35);
    this.sizePins(b, b.lines.length > 0);
    await this.wait(450);
  }
  async serve() {
    const b = this.bar!, n = piecesOf(b.n, b.lines).length;
    b.mode = 'rows';
    this.sizePins(b, false);
    this.relayout(b, 0.6, 260, 0.05);
    await this.wait(n * 260 + 700);
    this.sizePins(b, true);
    bSfx.tick(2);
    await this.wait(400);
  }
  async join() {
    const b = this.bar!;
    this.sizePins(b, false); this.unpin(p => p.id.startsWith('name-'));
    b.lines = []; b.mode = 'bar';
    this.relayout(b, 0.6, 120, 0.05);
    await this.wait(1100);
  }
  label(mine: string | null, other?: string) {
    this.unpin(p => p.id.startsWith('name-'));
    if (mine && this.bar) { const b = this.bar; piecesOf(b.n, b.lines).forEach((_, p) => this.pin({ id: `name-m${p}`, text: mine, kind: 'word', at: () => this.pieceTop(b, p, -1) })); }
    if (other && this.other) { const o = this.other; this.pin({ id: 'name-o0', text: other, kind: 'word', at: () => this.pieceTop(o, o.mode === 'under' ? (o.keep ?? 1) - 1 : 0, -1) }); }
  }
  async otherBar(lines: number[]) {
    this.drop(this.other);
    const o = (this.other = this.makeBar(this.bar!.n, false));
    await this.wait(900);
    for (const g of lines) { this.chop(o, g); await this.wait(380); }
    await this.wait(300);
  }
  async testOther() {
    const o = this.other!;
    o.mode = 'column';
    this.relayout(o, 0.6, 260, 0.05);
    await this.wait(piecesOf(o.n, o.lines).length * 260 + 700);
    this.sizePins(o, true);
    await this.wait(300);
  }
  async besides(b: number, k = 1) {
    this.drop(this.other);
    const o = (this.other = this.makeBar(this.bar!.n, false));
    await this.wait(900);
    for (const g of fairCuts(o.n, b) ?? []) { this.chop(o, g); await this.wait(Math.max(160, 900 / b)); }
    await this.wait(300);
    o.mode = 'under'; o.keep = k;
    this.relayout(o, 0.7, 250, 0.12);
    await this.wait(900 + k * 250);
    this.sizePins(o, false);
    const len = (o.n / b) * k;
    this.pin({ id: 'osize-0', text: `${len} square${len === 1 ? '' : 's'}`, kind: 'tick', c: 'ink', at: () => this.pieceTop(o, k - 1, 1) });
    // (pieces stacked: the child's stack says how many squares it has too, so the two can be compared)
    const me = this.bar, g = me?.given;
    if (k > 1 && me && g) {
      const { ps, out } = this.starts(me), all = ps[g.to] + ps[g.from];
      // (left of the stack, halfway up: the thirds' names stand on its right)
      const at = () => { const lo = this.at(me.squares[out[g.to]]), hi = this.at(me.squares[out[g.from] + ps[g.from] - 1]); return this.world({ x: lo.x - me.sq * 1.4, y: lo.y, up: (lo.up + hi.up) / 2 }); };
      this.pin({ id: 'size-stack', text: `${all} squares`, kind: 'tick', c: 'ink', at });
    }
    // (the rest of that bar is put away, so nothing of it waits off to the side)
    for (const q of o.squares.slice(len)) { q.gone = true; q.m.removeFromParent(); }
    await this.wait(300);
  }
  async clearOther() {
    const o = this.other; if (!o) return;
    this.sizePins(o, false); this.unpin(p => p.id === 'name-o0' || p.id === 'size-stack');
    o.out = true; this.relayout(o, 0.6, 60);
    await this.wait(800);
    this.drop(o); if (this.other === o) this.other = null;
  }
  /** the buddy's mouth: found once and kept in its Head bone's own space, so it turns and tips with the head (the Glimmer has mouthAt) */
  private mouthInHead: THREE.Vector3 | null | undefined;
  private born: number | null = null;
  private buddyMouth() {
    const me = this.sc.me, head = me.bones.Head;
    const box = (this.meBox ??= new THREE.Box3().setFromObject(me.root)), tall = box.max.y - box.min.y;
    if (!head) return me.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, tall * 0.8, tall * 0.1));
    if (this.mouthInHead === undefined) this.mouthInHead = this.findMouth(head, tall);
    if (this.mouthInHead) return this.mouthInHead.clone().applyMatrix4(head.matrixWorld);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(me.root.getWorldQuaternion(new THREE.Quaternion()));
    return head.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, tall * 0.13).add(new THREE.Vector3(0, tall * 0.05, 0));
  }
  /**
   * In front of the head bone the way the buddy faces and a little up is where the camera sees its mouth, but that
   * point is inside a long snout (the dino's), so a piece flying there vanished into the face, and it didn't move
   * when the head tipped. So once, while the buddy stands still near the start: look from the camera through that
   * point, take the first spot on the buddy seen there, a touch nearer the camera, and keep it in the head's space.
   */
  private findMouth(head: THREE.Bone, tall: number) {
    const me = this.sc.me, fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(me.root.getWorldQuaternion(new THREE.Quaternion()));
    const at = head.getWorldPosition(new THREE.Vector3()).addScaledVector(fwd, tall * 0.13).add(new THREE.Vector3(0, tall * 0.05, 0));
    const cam = stage.camera.getWorldPosition(new THREE.Vector3()), dir = at.clone().sub(cam).normalize(), far = cam.distanceTo(at);
    const ray = new THREE.Raycaster(cam, dir, 0, far + tall * 0.3);
    ray.camera = stage.camera;
    const hit = ray.intersectObject(me.root, true)[0];
    const p = hit && hit.distance < far ? hit.point.clone().addScaledVector(dir, -tall * 0.03) : at;
    return head.worldToLocal(p);
  }
  async eat() {
    const b = this.bar!, { ps, out } = this.starts(b);
    this.unpin(p => !p.id.startsWith('owner-'));
    const mouths = [() => this.buddyMouth(), () => this.sc.pal.mouthAt()];
    for (let p = 0; p < Math.min(2, ps.length); p++) {
      if (b.given?.from === p) continue;
      if (p === 1) this.sc.palDo('act');
      const qs = b.squares.slice(out[p], out[p] + ps[p]), mid = new THREE.Vector3();
      for (const q of qs) mid.add(q.m.position);
      mid.divideScalar(qs.length);
      for (const q of qs) { q.gone = true; this.flies.push({ m: q.m, from: mid.clone(), off: q.m.position.clone().sub(mid), sc0: q.m.scale.clone(), to: mouths[p], t0: this.now, dur: 0.8 }); }
      await this.wait(850);
      bSfx.gulp();
      if (p === 1) this.sc.palDo('happy'); else this.sc.nod();
      this.sc.fx.emit({ at: mouths[p](), count: 10, shape: ['spark'], color: [0xc79a6a, 0xffffff], speed: [0.3, 0.7], life: [0.25, 0.5], size: [0.012, 0.03], gravity: 1.2 });
      await this.wait(500);
    }
  }
  async barOut() {
    this.pins = []; this.changed();
    for (const b of [this.bar, this.other]) if (b) { b.out = true; this.relayout(b, 0.7, 40); }
    await this.wait(900);
    this.drop(this.bar); this.drop(this.other); this.bar = this.other = null;
    this.dropTrays();
  }
  finish() {
    const j = this.job, b = this.bar; if (!j || !b) return;
    if (j.kind === 'tap') { this.cutLine(j.hint); return; }
    // the fair cuts that are left, or the middle of the longest piece when the cuts so far can't be fair
    const go = () => {
      if (this.job !== j) return;
      const want = (fairCuts(b.n, j.pieces) ?? []).filter(g => !b.lines.includes(g));
      const fallback = () => { const { ps, out } = this.starts(b); const p = ps.indexOf(Math.max(...ps)); return out[p] + Math.max(1, Math.floor(ps[p] / 2)); };
      this.cutLine(want.length && b.lines.every(g => (fairCuts(b.n, j.pieces) ?? []).includes(g)) ? want[0] : fallback());
      if (this.job === j) setTimeout(go, 420);
    };
    go();
  }

  // ---------- the child's hand ----------
  private screenOf(p: THREE.Vector3) { const v = p.clone().project(stage.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }
  /** a tap on the bar: the nearest line between squares (null: not on the bar) */
  private lineAt(x: number, y: number): number | null {
    const b = this.bar; if (!b || b.mode !== 'bar') return null;
    this.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), stage.camera);
    const top = this.world({ x: CX, y: BAR_Y, up: b.sq * 0.34 * this.s });
    const hit = this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -top.y), new THREE.Vector3());
    if (!hit) return null;
    const o = this.sc.boardPoint(0, 0), ax = this.sc.boardPoint(100, 0), az = this.sc.boardPoint(0, 100);
    const bx = ((hit.x - o.x) / (ax.x - o.x)) * 100, by = ((hit.z - o.z) / (az.z - o.z)) * 100;
    if (Math.abs(by - BAR_Y) > b.sq * 1.4) return null;
    const u = (bx - this.left(b)) / b.sq;
    if (u < -0.6 || u > b.n + 0.6) return null;
    return Math.max(1, Math.min(b.n - 1, Math.round(u)));
  }
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    if (kind !== 'down' || !this.job) return false;
    const g = this.lineAt(x, y);
    if (g == null) return false;
    this.cutLine(g);
    return true;
  }
  /** the finger rests on the bar near its left end: it shows where to tap, never which line */
  handPoint() {
    const b = this.bar; if (!this.job || !b) return null;
    return this.world({ x: this.left(b) + b.sq * 0.5, y: BAR_Y, up: b.sq * 0.5 * this.s + Math.abs(Math.sin(this.now * 3)) * 0.02 });
  }
  dragPath() { return null; }
  tryPoint() { const b = this.bar; return this.job && b ? this.world({ x: this.left(b) + b.sq * 0.5, y: BAR_Y, up: 0 }) : null; }

  update(dt: number, t: number) {
    this.now = t; this.born ??= t;
    // (the buddy's mouth, found while it stands still a few seconds in)
    if (this.mouthInHead === undefined && t - this.born > 5 && this.sc.me.bones.Head) this.buddyMouth();
    const s = this.s;
    // (on a phone the camera frames just the bar while the child cuts it, so each square is a big target:
    // about 45 px across at 390 px for a bar of 8; the plates are still in the picture, under it)
    const fb = this.flatBar();
    this.sc.frameBox = fb ? { x: this.left(fb) - 3, y: BAR_Y - fb.sq / 2, w: fb.n * fb.sq + 6, h: fb.sq } : null;
    for (const b of [this.bar, this.other]) for (const q of b?.squares ?? []) {
      if (q.gone && !this.flies.some(f => f.m === q.m)) { q.m.visible = false; continue; }
      if (this.flies.some(f => f.m === q.m)) continue;
      const a = this.at(q);
      q.m.visible = t >= q.t0 - 0.001 || q.from.x === q.to.x;
      q.m.position.copy(this.world(a));
      const st = a.st ?? 0, flat = b!.sq * 0.34 * s, full = b!.sq * s * 0.94;
      q.m.scale.set(full, flat + (full - flat) * st, full + (flat - full) * st);
    }
    // the plates pop in, one after another, each under its row
    for (const tr of this.trays) {
      const b = this.bar; if (!b) break;
      const k = clamp01((t - tr.born) / 0.3), len = (tr.m.userData as { len: number }).len;
      tr.m.visible = k > 0;
      tr.m.position.copy(this.world({ x: this.plateX + tr.row * PLATE_GAP, y: ROW0, up: 0.004 }));
      tr.m.scale.set(len * s * smooth(k), 0.008, len * s * smooth(k));
    }
    // the knife: down and up at the line, then away after a moment
    const kk = t - this.knifeAt.t0;
    this.knife.visible = t - this.knifeAt.seen < 1.2;
    if (this.knife.visible && this.bar) {
      const p = this.world({ x: this.knifeAt.x, y: this.knifeAt.y, up: 0 });
      const down = kk < 0.14 ? kk / 0.14 : kk < 0.4 ? 1 - (kk - 0.14) / 0.26 : 0;
      this.knife.position.set(p.x, p.y + 0.06 - smooth(clamp01(down)) * 0.06, p.z);
      this.knife.scale.setScalar(s / 0.0032);
    }
    // pieces flying to a mouth
    // (bite-sized by the time it reaches the mouth, then it shrinks away right there, inside it)
    this.flies = this.flies.filter(f => {
      const k = (t - f.t0) / f.dur, to = f.to(), h = (t - f.t0 - f.dur) / 0.45;
      if (h >= 1) { f.m.visible = false; return false; }
      const e = smooth(clamp01(k)), sz = k < 1 ? 1 - 0.5 * e : 0.5 * (1 - h);
      f.m.position.lerpVectors(f.from, to, e).addScaledVector(f.off, sz);
      if (k < 1) f.m.position.y += Math.sin(Math.PI * k) * 0.08;
      f.m.scale.copy(f.sc0).multiplyScalar(sz);
      return true;
    });
    void dt;
  }

  dispose() {
    this.drop(this.bar); this.drop(this.other); this.dropTrays();
    this.root.removeFromParent();
    this.geo?.dispose();
    this.trayMat.dispose();
    for (const m of this.mats.values()) m.dispose();
    this.knife.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.sc.extraWork = () => [];
    this.sc.workZoom = 1; this.sc.tallPitch = null; this.sc.frameBox = null;
  }
}
