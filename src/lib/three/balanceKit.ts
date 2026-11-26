// The world of Mystery Bags (math/beats/equationLesson.ts): a brass balance on the Star Lab's table with its
// pans on top of the beam, so nothing hangs over what's in them. Violet bags of star sand (all the same) and
// loose brass weights sit on the left pan, weights on the right. The beam tips by what is really on each pan:
// a bag weighs what the balance's own numbers say (x), so whatever the child does is weighed, not scripted.
// Weights taken off go into a pile on the table in front of their pan, with how many on it; a bag taken off
// goes to the side. A guess for one bag is tested by lifting the bags off and putting that many weights in
// each bag's place. Numbers stand on the things: x on each bag, the count of the loose weights, the count on
// the other side, each pile's count; the colours match the equation written at the end (bags, loose weights,
// the other side).
import * as THREE from 'three';
import { stage } from './stage';
import { SceneWaits } from './sceneWaits';
import type { EpisodeScene } from './episodeScene';
import type { Pin } from '../math/beats/types';
import type { EquationWorld } from '../math/beats/equationLesson';
import { xOf, type Eq, type Part } from '../math/beats/equation';
import { bSfx } from '../math/beats/sounds';

/** where things go, in board units: the middle, the pans' row, how far each pan is from the middle */
const MID = 300, PAN_Y = 215, ARM = 140, PR = 80;
/** heights above the table, in board units: the pivot, the pans' posts, and the most the beam turns */
const PIVOT = 46, POST = 16, TILT = 0.15;
/** a weight and a bag (on a phone the weights are a quarter bigger, and spaced to match: at the same size they
 *  were 12 px across at 390 px wide) */
const BR = 25, BH = 55;
const TALL = typeof innerWidth === 'number' && innerWidth < innerHeight;
const WR = TALL ? 12.5 : 10, WH = TALL ? 15 : 13;
/** how far apart weights stand: in a stack in a bag's place, loose on a pan, in a pile on the table; bags in a row */
const STACK = TALL ? 26 : 22, CELL = TALL ? 27 : 24, PCELL = TALL ? 27 : 22, BAGS = TALL ? 52 : 50;
/** the piles of weights taken off, in front of each pan; the bags taken off go to the side */
const PILE_Y = 335, PARK_X = 42;
/** the most weights shown in one bag's place (a bigger number says so on its card) */
const MOST = 12;
/** on a phone: how much bigger the things on the table are, and how steeply the camera looks down at them */
const TALL_ZOOM = 1.9, TALL_PITCH = 0.62, WIDE_PITCH = 0.58;
/** on a wide screen the things on the table are this much bigger against the friends (a weight was about 12 px
 *  across at 1440 px) */
const WIDE_ZOOM = 1.35;
/** A phone's table is only as wide as the two pans: bags taken off wait at the front, between the two piles of
 *  weights, not out to the left of the pans. That strip at the left made everything a fifth smaller (a weight
 *  was about 15 px across at 390 px), and the bags in it sat on the screen's edge. */
const BOUNDS = TALL ? { x: 72, y: 90, w: 456, h: 310 } : { x: 20, y: 90, w: 560, h: 240 };
/** how long a thing a line is talking about stays lit, in seconds */
const LIT = 0.75;
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));

type Where = 'L' | 'R' | 'pileL' | 'pileR' | 'park' | 'swap' | 'row' | 'held' | 'gone';
type Item = {
  kind: 'bag' | 'weight'; g: THREE.Group; where: Where; slot: number;
  /** a bag's place (bags), the bag whose place it fills ('swap'), or its pile on the pan (shared out) */
  i: number; grp: number;
  pos: THREE.Vector3; from: THREE.Vector3; t0: number; dur: number; landed: boolean;
  /** lit since this second (a line is talking about it), and see-through (the what-if of one bag alone) */
  lit?: number; ghost?: boolean;
};
/** what a line can light: every bag, one bag, the loose weights, everything on a side, the weights in one bag's place, the pile taken off the bags' side */
export type Lit = 'bags' | 'bag' | 'loose' | 'left' | 'right' | 'guess' | 'pileL' | 'pileR' | 'pile';
type Job = { from: 'left' | 'both'; done: () => void };

export class BalanceKit implements EquationWorld {
  readonly root = new THREE.Group();
  pins: Pin[] = [];
  onChange: (() => void) | null = null;
  private now = 0;
  private s = 0.0032;
  private e: Eq = { p: 2, q: 3, r: 11 };
  private x = 4;
  private items: Item[] = [];
  private scale = new THREE.Group();
  private beam = new THREE.Group();
  private pans: THREE.Group[] = [];
  private tilt = 0; private tiltV = 0;
  private parts = 0;
  private swapN = 0;
  /** while a balance is being set up, before the other side's first weight: its count isn't shown yet */
  private filling = false;
  /** how many bags carry their x yet, and whether the first shows a "?" (in the opening the x is written as it's said) */
  private named = Infinity; private asked = false;
  /** the pictures that go with a line (rule 37): the numbers lit now, what the bags' side comes to in a test, the
   *  what-if of one bag alone, a 0 where nothing has come off the other side yet, one written line over the balance */
  private hot = new Set<string>();
  private totalN: number | null = null;
  private tagN: number[] = [];
  private imagine = false;
  private zero = false;
  private line: { k: number; parts: Part[] } | null = null;
  private level!: THREE.Mesh;
  private rings: { full: THREE.Mesh; half: THREE.Mesh; t0: number }[] = [];
  private job: Job | null = null;
  private held: Item | null = null;
  private heldFrom: Where = 'L';
  private downAt = { x: 0, y: 0 };
  private ray = new THREE.Raycaster();
  private geo: Record<string, THREE.BufferGeometry> = {};
  private mat: Record<string, THREE.Material> = {};

  constructor(private sc: EpisodeScene) {
    sc.root.add(this.root);
    this.root.add(this.scale);
    // (the friends and the corner props keep clear of the balance)
    sc.extraWork = () => [this.scale];
    // (the camera in close, as for the fraction lessons: at the usual distance a bag was about 25 px across. On a
    // phone the friends' heads and the number keys leave a short band, so the things on the table are made bigger
    // there instead, with the scene's workZoom, and seen less steeply from above)
    // (on a wide screen it is seen from a little higher, WIDE_PITCH: from the usual low camera the raised pans sat
    // on the table's far edge against the friends, with bare table in front)
    if (innerWidth >= innerHeight) { sc.closeUp(); sc.widePitch = WIDE_PITCH; sc.workZoom = WIDE_ZOOM; } else { sc.workZoom = TALL_ZOOM; sc.tallPitch = TALL_PITCH; sc.tallShare = 0.5; }
  }

  async load() {
    const brass = new THREE.MeshStandardMaterial({ color: 0xd9ab45, metalness: 0.75, roughness: 0.32 });
    const violet = new THREE.MeshStandardMaterial({ color: 0x6b3fd6, metalness: 0.25, roughness: 0.45 });
    const sack = new THREE.MeshStandardMaterial({ color: 0x8a5cf0, roughness: 0.85, emissive: 0x3a1a8a, emissiveIntensity: 0.12 });
    const cord = new THREE.MeshStandardMaterial({ color: 0xffd36b, roughness: 0.6 });
    const star = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffc23d, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 });
    // (for the pictures that go with a line: a thing lit, a thing see-through, and the bright lines)
    const lit = (m: THREE.MeshStandardMaterial, c: number) => { const g = m.clone(); g.emissive.set(c); g.emissiveIntensity = 0.85; return g; };
    const ghost = (m: THREE.MeshStandardMaterial) => { const g = m.clone(); g.transparent = true; g.opacity = 0.24; g.depthWrite = false; return g; };
    const glow = new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true });
    this.mat = { brass, violet, sack, cord, star, brassL: lit(brass, 0xffb52e), sackL: lit(sack, 0xb48cff), brassG: ghost(brass), sackG: ghost(sack), cordG: ghost(cord), glow, glowL: glow.clone(), glowR: glow.clone() };
    const bag = [[0, 0], [16, 1.5], [23, 8], [BR, 20], [23, 33], [16, 42], [8, 47], [7, 49], [10, 52], [6, BH], [0, BH]].map(([r, y]) => new THREE.Vector2(r, y));
    this.geo = {
      weight: new THREE.CylinderGeometry(WR, WR * 1.04, WH, 24).translate(0, WH / 2, 0),
      knob: new THREE.CylinderGeometry(3.6, 4.4, 4, 14).translate(0, WH + 2, 0),
      bag: new THREE.LatheGeometry(bag, 28),
      tie: new THREE.TorusGeometry(7.6, 1.6, 8, 20).rotateX(Math.PI / 2).translate(0, 48, 0),
    };
    this.buildScale();
  }
  bounds() { return BOUNDS; }
  /** (the card's shot is close on the two friends: the balance, bigger than them, filled the front of it) */
  clearForCard() { this.root.visible = false; this.pins = []; this.changed(); }
  refit() {
    const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0);
    this.s = a.distanceTo(b) / 100;
    this.scale.scale.setScalar(this.s);
    this.scale.position.copy(this.sc.boardPoint(MID, PAN_Y));
    this.scale.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    for (const it of this.items) it.g.scale.setScalar(this.s);
  }

  // ---------- the balance ----------
  private buildScale() {
    const { brass, violet, star } = this.mat as Record<string, THREE.MeshStandardMaterial>;
    const add = (m: THREE.Mesh, to: THREE.Object3D = this.scale) => { m.castShadow = true; m.receiveShadow = true; to.add(m); return m; };
    add(new THREE.Mesh(new THREE.CylinderGeometry(34, 42, 7, 40), brass)).position.y = 3.5;
    add(new THREE.Mesh(new THREE.CylinderGeometry(35, 35, 3, 40), violet)).position.y = 8;
    add(new THREE.Mesh(new THREE.CylinderGeometry(4.5, 7, PIVOT, 18), brass)).position.y = PIVOT / 2 + 8;
    this.beam.position.y = PIVOT + 8;
    this.scale.add(this.beam);
    add(new THREE.Mesh(new THREE.BoxGeometry(ARM * 2 + 12, 7, 9), violet), this.beam);
    for (const sx of [-1, 1]) add(new THREE.Mesh(new THREE.SphereGeometry(6, 14, 10), brass), this.beam).position.x = sx * (ARM + 6);
    add(new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 24).rotateX(Math.PI / 2), brass), this.beam);
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 + Math.PI / 2, r = i % 2 ? 4.2 : 9.5; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 2.5, bevelEnabled: false }), star), this.beam).position.z = 6.5;
    // each pan: a shallow brass dish on a post that stands on the beam's end (the pans stay flat as it tips)
    for (let k = 0; k < 2; k++) {
      const pan = new THREE.Group();
      add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, POST, 12), brass), pan).position.y = -POST / 2;
      add(new THREE.Mesh(new THREE.CylinderGeometry(PR, PR * 0.9, 5, 48), brass), pan).position.y = 0;
      add(new THREE.Mesh(new THREE.TorusGeometry(PR, 2.4, 8, 48).rotateX(Math.PI / 2), brass), pan).position.y = 2.6;
      // (pictures that go with a line: a pan's whole rim lights for a moment, or the half of it nearer the middle
      // stays lit. They ride on the rim, outside everything on the pan, so nothing passes through anything)
      const full = new THREE.Mesh(new THREE.TorusGeometry(PR + 1, 4.2, 8, 48).rotateX(Math.PI / 2), k ? this.mat.glowR : this.mat.glowL);
      const half = new THREE.Mesh(new THREE.TorusGeometry(PR + 1, 4.2, 8, 32, Math.PI).rotateX(Math.PI / 2).rotateY(k ? -Math.PI / 2 : Math.PI / 2), this.mat.glow);
      full.position.y = half.position.y = 3.2; full.visible = half.visible = false;
      pan.add(full, half); this.rings.push({ full, half, t0: -9 });
      this.pans.push(pan); this.scale.add(pan);
    }
    // (a bright line along the front of both rims, at the height they hang at when the balance is level: a rim
    // above it or below it is a side that went up or down)
    // (as long as the two rims are wide and no longer: 12 further each way, its end met a bag parked beside the balance, seen at 1440)
    this.level = new THREE.Mesh(new THREE.BoxGeometry(ARM * 2 + PR * 2, 2.6, 2.6), this.mat.glow);
    this.level.position.set(0, PIVOT + 8 + POST + 2.6, PR + 8); this.level.visible = false;
    this.scale.add(this.level);
  }
  /** the top of a pan, in board units above the table, as the beam is now */
  private panH(side: 0 | 1) { return PIVOT + 8 + POST + (side ? 1 : -1) * Math.sin(this.tilt) * ARM + 2.5; }
  /** a point at board (x, y), h board units above the table */
  private at(x: number, y: number, h: number) { return this.sc.boardPoint(x, y).add(new THREE.Vector3(0, h * this.s, 0)); }
  private screenOf(p: THREE.Vector3) { const v = p.clone().project(stage.camera); return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight }; }
  /** what each side weighs now: only what has landed counts, so the beam moves as each weight lands or lifts */
  private sides() {
    let l = 0, r = 0;
    for (const it of this.items) {
      if (!it.landed) continue;
      if (it.where === 'L') l += it.kind === 'bag' ? this.x : 1;
      else if (it.where === 'swap') l += 1;
      else if (it.where === 'R') r += 1;
    }
    return { l, r };
  }

  // ---------- where each thing goes ----------
  private spot(it: Item): THREE.Vector3 {
    const panX = (side: 0 | 1) => MID + (side ? ARM : -ARM);
    const stack = (k: number) => ({ dx: ((k % 2) - 0.5) * STACK, dy: ((Math.floor(k / 2) % 2) - 0.5) * STACK, h: Math.floor(k / 4) * WH });
    switch (it.where) {
      case 'L': case 'swap': {
        // (up to 3 bags in a row at the back; 4 go in two rows of 2, and the loose weights sit further forward)
        const nb = this.e.p, two = nb > 3;
        const bx = (i: number) => two ? ((i % 2) - 0.5) * 54 : (i - (nb - 1) / 2) * BAGS, by = (i: number) => two ? (i < 2 ? -50 : -2) : -30;
        if (it.kind === 'bag') return this.at(panX(0) + bx(it.i), PAN_Y + by(it.i), this.panH(0));
        if (it.where === 'swap') { const st = stack(it.slot); return this.at(panX(0) + bx(it.i) + st.dx, PAN_Y + by(it.i) + st.dy, this.panH(0) + st.h); }
        const per = 5, cell = CELL, k = it.slot % 15, layer = Math.floor(it.slot / 15);
        return this.at(panX(0) + ((k % per) - 2) * cell, PAN_Y + (two ? 38 : 14) + Math.floor(k / per) * cell, this.panH(0) + layer * WH);
      }
      case 'R': {
        // (4 piles stand in two rows of 2: in one row the outer ones went past the pan's rim)
        if (this.parts && it.grp >= 0) {
          const st = stack(it.slot), four = this.parts > 3;
          const gx = four ? ((it.grp % 2) - 0.5) * 56 : (it.grp - (this.parts - 1) / 2) * (this.parts > 2 ? 50 : 60), gy = four ? (it.grp < 2 ? -28 : 28) : 0;
          return this.at(panX(1) + gx + st.dx, PAN_Y + gy + st.dy, this.panH(1) + st.h);
        }
        const per = 5, cell = CELL, k = it.slot % 15, layer = Math.floor(it.slot / 15);
        return this.at(panX(1) + ((k % per) - 2) * cell, PAN_Y + (Math.floor(k / per) - 1) * cell, this.panH(1) + layer * WH);
      }
      case 'pileL': case 'pileR': {
        const cx = MID + (it.where === 'pileR' ? ARM : -ARM), per = 6, cell = PCELL, k = it.slot % 18, layer = Math.floor(it.slot / 18);
        return this.at(cx + ((k % per) - 2.5) * cell, PILE_Y + Math.floor(k / per) * cell - PCELL, layer * WH);
      }
      // (on a phone: a row at the very front, in front of both piles, so a big pile never reaches the bags)
      // (62 in front of the piles' middle, not 56: the third row of a pile of 14 reached into the nearest bag by 2, seen at 390)
      case 'park': return TALL ? this.at(MID + (it.i - (this.e.p - 1) / 2) * 52, PILE_Y + 62, 0) : this.at(PARK_X, PAN_Y - 30 + it.i * 58, 0);
      case 'row': { const n = this.items.filter(o => o.where === 'row').length; return this.at(MID + (it.i - (n - 1) / 2) * 78, PILE_Y - 10, 0); }
      case 'held': return it.pos.clone();
      default: return it.from.clone().add(new THREE.Vector3(0, 120 * this.s, 0));
    }
  }
  /** move a thing somewhere, in an arc over everything between */
  private send(it: Item, where: Where, delay = 0, dur = 0.55) {
    it.from = it.pos.clone(); it.where = where; it.t0 = this.now + delay; it.dur = dur; it.landed = false;
    if (where !== 'swap' && where !== 'gone' && where !== 'row' && where !== 'park' && it.kind === 'weight') it.slot = this.freeSlot(where, it);
  }
  private freeSlot(where: Where, me: Item) {
    const used = new Set(this.items.filter(o => o !== me && o.where === where && o.kind === 'weight' && o.grp < 0).map(o => o.slot));
    let k = 0; while (used.has(k)) k++; return k;
  }
  private make(kind: 'bag' | 'weight', where: Where, i = 0, delay = 0): Item {
    const g = new THREE.Group();
    const m = kind === 'bag' ? [new THREE.Mesh(this.geo.bag, this.mat.sack), new THREE.Mesh(this.geo.tie, this.mat.cord)] : [new THREE.Mesh(this.geo.weight, this.mat.brass), new THREE.Mesh(this.geo.knob, this.mat.brass)];
    for (const x of m) { x.castShadow = true; x.receiveShadow = true; g.add(x); }
    g.scale.setScalar(this.s);
    const it: Item = { kind, g, where, slot: 0, i, grp: -1, pos: new THREE.Vector3(), from: new THREE.Vector3(), t0: this.now + delay, dur: 0.5, landed: false };
    if (kind === 'weight' && where !== 'swap') it.slot = this.freeSlot(where, it);
    this.items.push(it);
    const to = this.spot(it);
    it.pos.copy(to).add(new THREE.Vector3(0, 0.5, 0)); it.from.copy(it.pos);
    g.position.copy(it.pos); g.visible = false;
    this.root.add(g);
    return it;
  }
  /** (waits on the scene's clock, as the movements are: sceneWaits.ts) */
  private waits = new SceneWaits();
  private wait(ms: number) { return this.waits.wait(ms); }
  private later(ms: number, fn: () => void) { this.waits.later(ms, fn); }
  private of(where: Where, kind: 'bag' | 'weight' = 'weight') { return this.items.filter(o => o.where === where && o.kind === kind); }
  private changed() { this.pinAll(); this.onChange?.(); }

  // ---------- the numbers on things ----------
  private pinAll() {
    const keep = this.pins.filter(p => (p.kind === 'sum' && !p.id.startsWith('line')) || p.id.startsWith('why'));
    const out: Pin[] = [...keep];
    const bags = this.items.filter(o => o.kind === 'bag' && o.where !== 'gone');
    bags.forEach((b, k) => {
      // (in the opening a bag has no x until the words say it's written: first a "?" on one bag, the question)
      const text = b.i < this.named ? (b.g.userData.tag as string | undefined) ?? 'x' : this.asked && b.i === 0 ? '?' : null;
      if (text != null && !b.ghost) out.push({ id: `tag${k}`, text, kind: 'tick', big: true, c: 'b', hot: this.hot.has(`bag${b.i}`), at: () => b.pos.clone().add(new THREE.Vector3(0, BH * 0.45 * this.s, BR * 1.05 * this.s)) });
    });
    const count = (id: string, where: Where, c: Pin['c'], at: () => THREE.Vector3, hide0 = true, text?: string) => {
      const n = this.of(where).filter(o => o.grp < 0).length;
      if (n || !hide0) out.push({ id, text: text ?? String(n), kind: 'tick', big: true, c, hot: this.hot.has(id), at });
    };
    if (!this.imagine) count('loose', 'L', 'a', () => this.at(MID - ARM, PAN_Y + PR + 6, this.panH(0)));
    // (the other side's count shows 0 while the bags are still there, but not on a balance that stands empty)
    const empty = !this.items.some(o => o.where === 'L' || o.where === 'swap');
    if (!this.parts) count('right', 'R', 'c', () => this.at(MID + ARM, PAN_Y + PR + 6, this.panH(1)), empty || this.filling, this.imagine ? '?' : undefined);
    // (on a phone each pile's count stands behind its outer end, inside the screen's edge)
    count('pileL', 'pileL', 'ink', () => TALL ? this.at(MID - ARM - 60, PILE_Y - 46, 8) : this.at(MID - ARM + 92, PILE_Y - 10, 8));
    count('pileR', 'pileR', 'ink', () => TALL ? this.at(MID + ARM + 60, PILE_Y - 46, 8) : this.at(MID + ARM + 92, PILE_Y - 10, 8), !this.zero);
    if (this.swapN) for (let i = 0; i < this.e.p; i++) out.push({ id: `swap${i}`, text: String(this.swapN), kind: 'tick', big: true, c: 'b', hot: this.hot.has(`swap${i}`), at: () => this.spot({ ...this.of('swap')[0], i, slot: 0, where: 'swap' } as Item).add(new THREE.Vector3(0, (Math.ceil(Math.min(this.swapN, MOST) / 4) * WH + 22) * this.s, 0)) });
    if (this.parts) for (let gi = 0; gi < this.parts; gi++) {
      const n = this.items.filter(o => o.where === 'R' && o.grp === gi).length;
      if (n) out.push({ id: `pile${gi}`, text: String(n), kind: 'tick', big: true, c: 'c', hot: this.hot.has(`pile${gi}`), at: () => this.spot({ where: 'R', grp: gi, slot: 0, kind: 'weight' } as Item).add(new THREE.Vector3(0, (Math.ceil(n / 4) * WH + 20) * this.s, 0)) });
    }
    // (what the bags' side comes to with a guess in the bags' places: over their numbers, so it can be set against the other side's)
    if (this.totalN != null && this.swapN) { const n = this.totalN; out.push({ id: 'total', text: String(n), kind: 'tick', big: true, c: 'ink', hot: true, at: () => this.at(MID - ARM, PAN_Y - 30, this.panH(0) + Math.ceil(Math.min(this.swapN, MOST) / 4) * WH + 22 + 58) }); }
    // (one written line over the balance while the balance shows what it says; the part being said is lit)
    if (this.line) { const l = this.line; out.push({ id: `line${l.k}`, text: l.parts.map(p => p.t).join(' '), kind: 'sum', parts: l.parts, at: () => this.at(MID, PAN_Y, TALL ? 165 : 178) }); }
    this.pins = out;
  }

  // ---------- what the script asks for ----------
  async scaleIn(e: Eq) { await this.bagsOn(e); await this.looseOn(); await this.fillRight(); }
  /** a new balance, told as it is set out: its bags go onto the bags' side (each with its x), then its loose weights */
  async bagsOn(e: Eq) {
    for (const it of this.items) it.g.removeFromParent();
    this.items = []; this.parts = 0; this.swapN = 0; this.plain();
    this.e = e; this.x = xOf(e); this.filling = true; this.named = Infinity; this.asked = false;
    for (let i = 0; i < e.p; i++) this.make('bag', 'L', i, i * 0.12);
    this.changed();
    await this.wait(650 + e.p * 120);
  }
  async looseOn() {
    for (let i = 0; i < this.e.q; i++) this.make('weight', 'L', 0, i * 0.1);
    this.changed();
    await this.wait(600 + this.e.q * 100);
  }
  async fillRight() {
    this.filling = false;
    // the other side fills one weight at a time, and the balance comes level only at the last
    for (let i = 0; i < this.e.r; i++) { this.make('weight', 'R', 0, 0); this.changed(); await this.wait(i < this.e.r - 3 ? 150 : 380); }
    await this.wait(900);
  }

  // ---------- the pictures that go with a line (Teller.sayWith): what the words say, shown as they're said ----------
  /** nothing lit, nothing imagined: the balance as it really is */
  private plain() {
    this.totalN = null; this.zero = false; this.imagine = false; this.line = null; this.hot.clear();
    this.level.visible = false;
    for (const r of this.rings) r.half.visible = false;
    for (const it of this.items) { it.ghost = false; it.lit = undefined; this.dress(it); }
  }
  /** a thing as it is now: lit, see-through, or plain */
  private dress(it: Item) {
    const k = it.ghost ? 'G' : it.lit != null ? 'L' : '', m = this.mat;
    const [body, top] = it.g.children as THREE.Mesh[];
    if (it.kind === 'bag') { body.material = m[`sack${k}`]; top.material = k === 'G' ? m.cordG : m.cord; } else body.material = top.material = m[`brass${k}`];
    body.castShadow = top.castShadow = !it.ghost;
  }
  async bagsOut(e: Eq) {
    for (const it of this.items) it.g.removeFromParent();
    this.items = []; this.parts = 0; this.swapN = 0; this.plain();
    this.e = e; this.x = xOf(e); this.filling = true; this.named = 0; this.asked = false;
    for (let i = 0; i < e.p; i++) this.make('bag', 'row', i, i * 0.45);
    this.changed();
    await this.wait(600 + e.p * 450);
  }
  askBag() { this.asked = true; return this.light('bag', 0); }
  async loadLeft() {
    this.of('row', 'bag').forEach((b, k) => this.send(b, 'L', k * 0.15, 0.7));
    this.changed();
    await this.wait(1000);
    for (let i = 0; i < this.e.q; i++) this.make('weight', 'L', 0, i * 0.25);
    this.changed();
    await this.wait(500 + this.e.q * 250);
  }
  async writeX() {
    for (let i = 0; i < this.e.p; i++) { this.named = i + 1; bSfx.tick(i); this.hot.add(`bag${i}`); this.changed(); await this.wait(450); }
    for (let i = 0; i < this.e.p; i++) this.hot.delete(`bag${i}`);
    this.changed();
  }
  async light(what: Lit, i = 0) {
    const on = (it: Item) => it.where === 'gone' ? false
      : what === 'bags' ? it.kind === 'bag'
      : what === 'bag' ? it.kind === 'bag' && it.i === i
      : what === 'loose' ? it.kind === 'weight' && it.where === 'L'
      : what === 'left' ? it.where === 'L' || it.where === 'swap'
      : what === 'right' ? it.where === 'R'
      : what === 'guess' ? it.where === 'swap' && it.i === i
      : what === 'pile' ? it.where === 'R' && it.grp === i
      : it.where === what;
    const ids = new Set<string>();
    for (const it of this.items) if (on(it)) {
      it.lit = this.now; this.dress(it);
      ids.add(it.kind === 'bag' ? `bag${it.i}` : it.where === 'L' ? 'loose' : it.where === 'R' ? (it.grp >= 0 ? `pile${it.grp}` : 'right') : it.where === 'swap' ? `swap${it.i}` : it.where === 'pileR' ? 'pileR' : 'pileL');
    }
    if (what === 'left' || what === 'right') this.rings[what === 'left' ? 0 : 1].t0 = this.now;
    for (const id of ids) this.hot.add(id);
    this.changed();
    await this.wait(LIT * 1000);
    for (const id of ids) this.hot.delete(id);
    this.changed();
  }
  levelLine(on: boolean) { this.level.visible = on; }
  total(n: number | null) { this.totalN = n; this.changed(); }
  alone(on: boolean) {
    this.imagine = on;
    for (const it of this.items) { it.ghost = on && !(it.kind === 'bag' && it.i === 0); this.dress(it); }
    this.changed();
  }
  noneOff() { this.zero = true; this.changed(); }
  half(side: 'left' | 'both' | null) { this.rings[0].half.visible = side != null; this.rings[1].half.visible = side === 'both'; }
  writeLine(k: number | null, parts: Part[] = [], hot = -1) {
    this.line = k == null ? null : { k, parts: parts.map((p, j) => ({ ...p, hot: j === hot })) };
    this.changed();
  }
  async offBoth() {
    for (const w of this.of('L')) { this.send(w, 'pileL'); this.changed(); await this.wait(160); }
    await this.takeRight(this.e.q);
  }
  async scaleOut() {
    this.job = null; this.parts = 0; this.swapN = 0; this.plain();
    this.items.forEach((it, k) => this.send(it, 'gone', k * 0.015, 0.5));
    this.changed();
    await this.wait(900);
    for (const it of this.items) it.g.removeFromParent();
    this.items = [];
    this.changed();
  }
  async swapIn(n: number) {
    this.swapN = n;
    this.of('L', 'bag').forEach((b, k) => this.send(b, 'park', k * 0.08, 0.6));
    this.changed();
    await this.wait(800);
    const shown = Math.min(n, MOST);
    for (let i = 0; i < this.e.p; i++) for (let k = 0; k < shown; k++) { const w = this.make('weight', 'swap', i, 0.05 * k + i * 0.15); w.slot = k; }
    this.changed();
    await this.wait(900 + shown * 60 + this.e.p * 150);
    await this.wait(900);
  }
  async swapBack() {
    this.of('swap').forEach((w, k) => this.send(w, 'gone', k * 0.01, 0.45));
    this.swapN = 0; this.totalN = null; this.level.visible = false;
    this.changed();
    await this.wait(500);
    this.items = this.items.filter(o => { if (o.where === 'gone') { o.g.removeFromParent(); return false; } return true; });
    this.of('park', 'bag').forEach((b, k) => this.send(b, 'L', k * 0.08, 0.6));
    this.changed();
    await this.wait(1100);
  }
  takeOff(from: 'left' | 'both') {
    return new Promise<void>(res => { this.job = { from, done: res }; this.changed(); });
  }
  async takeRight(n: number) {
    const k = Math.min(n, this.of('R').length);
    for (const w of this.of('R').slice(this.of('R').length - k)) { this.send(w, 'pileR'); this.changed(); await this.wait(160); }
    await this.wait(1100);
  }
  async setRight(n: number) {
    let have = this.of('R').length;
    while (have > n) { this.send(this.of('R').at(-1)!, 'pileR'); have--; this.changed(); await this.wait(150); }
    while (have < n) { const p = this.of('pileR').at(-1); if (p) this.send(p, 'R'); else this.make('weight', 'R'); have++; this.changed(); await this.wait(150); }
    await this.wait(1000);
  }
  async share(n: number) {
    const bags = this.of('L', 'bag');
    if (bags.length) this.send(bags[bags.length - 1], 'park', 0, 0.7);
    this.half(null);
    this.changed();
    await this.wait(500);
    const k = Math.min(n, this.of('R').length);
    for (const w of this.of('R').slice(this.of('R').length - k)) { this.send(w, 'pileR'); this.changed(); await this.wait(140); }
    await this.wait(1200);
  }
  /** the other side's weights move into equal piles on its pan (`calm`: they stay counted as they move, so the
   *  balance doesn't swing while a plan is only being pictured) */
  async piles(parts: number, calm = false) {
    if (this.parts === parts) return;
    this.parts = parts;
    const ws = this.of('R');
    ws.forEach((w, k) => { w.grp = k % parts; w.slot = Math.floor(k / parts); w.from = w.pos.clone(); w.t0 = this.now + k * 0.05; w.dur = 0.5; w.landed = calm; });
    this.changed();
    await this.wait(1200 + ws.length * 50);
  }
  /** the buddy's plan, before it's tried: what would come off turns see-through (all but one bag, all but one pile) */
  keep(what: 'bag' | 'pile') {
    for (const it of this.items) if (what === 'bag' ? it.kind === 'bag' && it.where === 'L' && it.i > 0 : it.where === 'R' && it.grp > 0) { it.ghost = true; this.dress(it); }
    this.changed();
  }
  async shareOut(parts: number) {
    // the other side's weights move into equal piles on its pan, one pile for each bag (unless a line's picture has made them already)
    await this.piles(parts);
    const ws = this.of('R');
    // then all but one pile come off, and all but one bag with them: it stays level
    const bags = this.of('L', 'bag');
    bags.slice(1).forEach((b, k) => this.send(b, 'park', k * 0.1, 0.7));
    ws.filter(w => w.grp > 0).forEach((w, k) => { w.grp = -1; this.send(w, 'pileR', 0.3 + k * 0.04); });
    this.changed();
    await this.wait(1700);
  }
  /** the buddy's way, each half as it is said: all but one bag come off; then all but a part of the other side
   *  (the piles the plan showed see-through, if it was pictured). The loose weights stay */
  async buddyShare(part?: 'bags' | 'weights') {
    if (part !== 'weights') {
      this.of('L', 'bag').slice(1).forEach((b, k) => { b.ghost = false; this.dress(b); this.send(b, 'park', k * 0.1, 0.7); });
      this.changed();
      await this.wait(part ? 1000 : 700);
    }
    if (part !== 'bags') {
      const ws = this.of('R'), keep = this.e.r / this.e.p;
      for (const w of this.parts ? ws.filter(o => o.grp > 0) : ws.slice(keep)) { w.grp = -1; w.ghost = false; this.dress(w); this.send(w, 'pileR'); this.changed(); await this.wait(70); }
      await this.wait(1300);
    }
  }
  async reset(to: 'start' | 'bags') {
    this.parts = 0; this.swapN = 0; this.plain();
    for (const it of this.items) it.grp = -1;
    for (const b of this.items.filter(o => o.kind === 'bag' && o.where !== 'L')) this.send(b, 'L', 0, 0.6);
    const loose = to === 'start' ? this.e.q : 0, right = to === 'start' ? this.e.r : this.e.r - this.e.q;
    const move = (from: Where, into: Where, want: number) => {
      let have = this.of(into).length;
      while (have > want) { this.send(this.of(into).at(-1)!, from); have--; }
      while (have < want) { const p = this.of(from).at(-1); if (p) this.send(p, into); else this.make('weight', into); have++; }
    };
    move('pileL', 'L', loose); move('pileR', 'R', right);
    this.changed();
    await this.wait(1300);
  }
  writeSteps(lines: { parts: Part[]; why: string }[]) {
    const n = lines.length;
    // (one under the other, each with its words under it, over the empty balance. They are spaced in screen
    // pixels, from the size the player draws a written line at (.row1: 30 px on a narrow screen, else 5.4% of the
    // height between 34 and 54), so they never overlap at any size)
    const font = () => innerWidth < 760 ? 30 : Math.min(54, Math.max(34, innerHeight * 0.054));
    const row = () => font() * 1.1 + 22 + 34;
    // (on a phone the stack stands further forward, on the empty front of the table: over the balance it ran up
    // under the words at the top, seen at 390x844)
    const base = () => innerWidth < 760 ? PILE_Y + 70 : PAN_Y + 30;
    const up = (px: number) => { const a = this.screenOf(this.at(MID, base(), 0)), b = this.screenOf(this.at(MID, base(), 100)); return (px * 100) / Math.max(1, a.y - b.y); };
    const out: Pin[] = lines.flatMap((l, k): Pin[] => [
      { id: `sum${k}`, text: l.parts.map(p => p.t).join(' '), kind: 'sum', parts: l.parts, at: () => this.at(MID, base(), up(34 + (n - 1 - k) * row())) },
      { id: `why${k}`, text: l.why, kind: 'word', at: () => this.at(MID, base(), up(16 + (n - 1 - k) * row())) },
    ]);
    this.line = null;
    this.pins = [...this.pins.filter(p => p.kind !== 'sum' && !p.id.startsWith('why')), ...out];
    this.onChange?.();
  }
  clearSteps() { this.pins = this.pins.filter(p => p.kind !== 'sum' && !p.id.startsWith('why')); this.onChange?.(); }
  async tags(weights: number[]) {
    for (const it of this.items) it.g.removeFromParent();
    this.items = []; this.parts = 0; this.swapN = 0; this.plain(); this.named = Infinity;
    weights.forEach((_, i) => { const b = this.make('bag', 'row', i, i * 0.2); b.g.userData.tag = 'x'; });
    this.tagN = weights;
    this.changed();
    await this.wait(1400);
  }
  /** each tag's x turns into its bag's number, one after the other, as the words say it is written */
  async writeTags() {
    const bags = this.items.filter(o => o.where === 'row');
    for (const [i, b] of bags.entries()) { b.g.userData.tag = String(this.tagN[i]); bSfx.tick(i); this.hot.add(`bag${b.i}`); this.changed(); await this.wait(450); }
    await this.wait(300);
    for (const b of bags) this.hot.delete(`bag${b.i}`);
    this.changed();
  }
  finish() {
    const j = this.job; if (!j) return;
    for (const w of this.of('L')) this.send(w, 'pileL');
    if (j.from === 'both') {
      const want = this.of('L', 'bag').length * this.x;
      let have = this.of('R').length;
      while (have > want) { this.send(this.of('R').at(-1)!, 'pileR'); have--; }
      while (have < want) { const p = this.of('pileR').at(-1); if (p) this.send(p, 'R'); else this.make('weight', 'R'); have++; }
    }
    this.changed();
    this.job = null;
    this.later(900, () => j.done());
  }

  // ---------- the child's hands ----------
  private draggable(): Item[] {
    const j = this.job; if (!j) return [];
    const l = this.of('L');
    if (j.from === 'left') return l;
    return [...l, ...this.of('R'), ...this.of('pileR'), ...this.of('pileL')];
  }
  /** the weight a hint points at, and where it should go */
  private hint(): { it: Item; to: THREE.Vector3 } | null {
    const j = this.job; if (!j || this.held) return null;
    const l = this.of('L');
    if (l.length) return { it: l[0], to: this.at(MID - ARM, PILE_Y, 0) };
    if (j.from !== 'both') return null;
    const want = this.of('L', 'bag').length * this.x, r = this.of('R');
    if (r.length > want) return { it: r[r.length - 1], to: this.at(MID + ARM, PILE_Y, 0) };
    const p = this.of('pileR')[0];
    return p && r.length < want ? { it: p, to: this.at(MID + ARM, PAN_Y, this.panH(1)) } : null;
  }
  tryPoint() { return this.hint()?.it.pos.clone() ?? null; }
  handPoint() { const h = this.hint(); if (!h) return null; const k = smooth(clamp01(((this.now * 0.45) % 1) * 1.3)); return h.it.pos.clone().lerp(h.to, k); }
  dragPath() { const h = this.hint(); return h ? { a: this.screenOf(h.it.pos), b: this.screenOf(h.to) } : null; }
  private onTable(x: number, y: number) {
    this.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), stage.camera);
    const h = this.sc.boardPoint(0, 0).y + 90 * this.s, hit = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -h), hit) ? hit : null;
  }
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    const j = this.job;
    if (!j) return false;
    if (kind === 'down') {
      let best: Item | null = null, bd = Math.max(46, innerWidth * 0.035);
      for (const it of this.draggable()) { const p = this.screenOf(it.pos), d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = it; } }
      if (!best) return false;
      this.held = best; this.heldFrom = best.where; best.where = 'held'; best.landed = false; this.downAt = { x, y };
      bSfx.tick(1);
      this.changed();
      return true;
    }
    const it = this.held;
    if (!it) return false;
    if (kind === 'move') { const p = this.onTable(x, y); if (p) it.pos.lerp(p, 0.6); return true; }
    // let go: onto a pan if it's over one (and that's allowed), else into the pile of the side it came from
    this.held = null;
    const near = (side: 0 | 1) => { const c = this.screenOf(this.at(MID + (side ? ARM : -ARM), PAN_Y, this.panH(side))), e = this.screenOf(this.at(MID + (side ? ARM : -ARM) + PR, PAN_Y, this.panH(side))); return Math.hypot(c.x - x, c.y - y) < Math.hypot(e.x - c.x, e.y - c.y) * 1.1; };
    const tapped = Math.hypot(x - this.downAt.x, y - this.downAt.y) < 10;
    const fromPan = this.heldFrom === 'L' || this.heldFrom === 'R';
    let to: Where = this.heldFrom === 'L' ? 'pileL' : this.heldFrom === 'R' ? 'pileR' : this.heldFrom;
    if (!tapped && j.from === 'both' && !fromPan) { if (near(1)) to = 'R'; else if (near(0)) to = 'L'; }
    if (!tapped && fromPan && near(this.heldFrom === 'L' ? 0 : 1)) to = this.heldFrom;
    if (tapped && !fromPan && j.from === 'both') to = this.heldFrom === 'pileL' ? 'L' : 'R';
    it.where = this.heldFrom;
    this.send(it, to, 0, 0.35);
    this.changed();
    // done: no loose weights on the bags' side (and, for both sides, level)
    this.later(420, () => {
      if (this.job !== j) return;
      const { l, r } = this.sides();
      const left = this.of('L').length === 0 && !this.held;
      if (left && (j.from === 'left' || l === r)) { this.job = null; this.changed(); this.later(500, () => j.done()); }
    });
    return true;
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    this.waits.tick(t);
    const { l, r } = this.sides();
    // the beam swings on a spring toward what's really on each side
    const want = TILT * Math.max(-1, Math.min(1, (l - r) / 2.5));
    this.tiltV += ((want - this.tilt) * 40 - this.tiltV * 9) * Math.min(dt, 0.05);
    this.tilt += this.tiltV * Math.min(dt, 0.05);
    this.beam.rotation.z = this.tilt;
    this.pans.forEach((p, k) => { p.position.set((k ? 1 : -1) * ARM, this.panH(k as 0 | 1) - 2.5, 0); });
    for (const r of this.rings) { const k = (t - r.t0) / LIT; r.full.visible = k >= 0 && k < 1; (r.full.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * clamp01(k)); }
    let landedNow = false;
    for (const it of this.items) {
      if (it.where === 'held') { it.g.position.copy(it.pos); it.g.visible = true; continue; }
      const k = (t - it.t0) / it.dur;
      if (k < 0) { it.g.visible = it.where !== 'gone' && it.landed; continue; }
      it.g.visible = true;
      const to = this.spot(it);
      if (k >= 1) {
        it.pos.copy(to);
        if (!it.landed) { it.landed = true; if (it.where !== 'gone') { bSfx.clack(); landedNow = true; } else it.g.visible = false; }
      } else {
        const e = smooth(k);
        it.pos.copy(it.from).lerp(to, e);
        it.pos.y += Math.sin(Math.PI * e) * (it.kind === 'bag' ? 90 : 60) * this.s;
      }
      it.g.position.copy(it.pos);
      if (it.lit != null && t - it.lit > LIT) { it.lit = undefined; this.dress(it); }
      if (it.where === 'gone') it.g.scale.setScalar(this.s * (1 - clamp01(k)));
    }
    if (landedNow) this.onChange?.();
  }

  dispose() {
    this.waits.clear();
    this.sc.workZoom = 1; this.sc.tallPitch = null; this.sc.tallShare = null; this.sc.widePitch = null;
    for (const it of this.items) it.g.removeFromParent();
    this.items = [];
    this.root.removeFromParent();
    this.scale.removeFromParent();
    this.scale.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of Object.values(this.mat)) m.dispose();
    this.sc.extraWork = () => [];
  }
}
