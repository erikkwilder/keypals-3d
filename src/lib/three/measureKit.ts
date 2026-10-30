// The measuring things on a Learn episode's table (math/measure/episodes.ts): a brass clock standing on
// its easel with hands you can drag, a wooden ruler with a pencil and a crayon you slide along it, a
// kitchen scale with a sack of carrots to lift onto its pan, a glass jug you fill by dragging the water
// up, and a garden bed you tile with grass (and a fence round it). They sit on the shared episode table
// (three/episodeScene.ts: the buddy, the Glimmer, the light and the camera are its), placed with its
// board-to-table mapping, and take the kid's pointer before the table does. Each thing eases to what the
// next picture says (the needle swings, the water rises, the hands turn the right way round).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { stage } from './stage';
import { loadTexture } from './assets';
import type { EpisodeScene } from './episodeScene';
import type { KitState, MTask } from '../math/measure/episodes';
import type { Face } from '../math/skills/measure';
import { mSfx } from '../math/measure/sounds';

const TY = 0.48;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (k: number) => k * k * (3 - 2 * k);
const fontUi = () => (getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'Fredoka, sans-serif');
const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...o });
const brass = () => std(0xd9a441, { metalness: 0.75, roughness: 0.3 });
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!; draw(g);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; return m; }
/** a glowing ring lying flat (a spot to touch or a place to go) */
function glowRing(r: number, color = 0xffd75e) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 3;
  return m;
}

type Pin = { id: string; at: () => THREE.Vector3; text: string; kind: 'num' | 'tag' | 'gold' };
type Drag = { kind: 'hour' | 'minute' | 'item' | 'sack' | 'water' | 'tile'; plane: THREE.Plane; item?: number; offset?: number };

export class MeasureKit {
  readonly root = new THREE.Group();
  /** what the table shows now */
  state: KitState = {};
  /** told when something the page shows changes (pins, a task done) */
  onChange: (() => void) | null = null;
  /** words pinned to the things (numbers counted on the clock, a ruler's reading, a fence's sides) */
  pins: Pin[] = [];
  /** free play for a turn: the clock's hands or the jug's water can be moved by the kid */
  free: 'clock' | 'pour' | 'bench' | null = null;
  /** the measuring bench (a toy): every thing out at once, the scale and the jug at the back, the ruler in front */
  bench = false;
  /** the long hand's step while setting the clock on a turn (minutes) */
  freeSnap = 5;
  private s = 0.002;
  private now = 0;
  private ray = new THREE.Raycaster();
  private drag: Drag | null = null;
  private task: MTask | null = null;
  private taskDone: (() => void) | null = null;
  private taskLeft: number[] = [];
  private hintFrom = new THREE.Vector3(); private hintTo = new THREE.Vector3();
  private grass: THREE.Texture | null = null;
  private wood: THREE.Texture | null = null;
  // the clock
  private clock: THREE.Group | null = null;
  private face: THREE.Mesh | null = null;
  private faceKind: Face | null = null;
  private hourHand = new THREE.Group(); private minHand = new THREE.Group();
  private clockR = 0.27;
  private tall = false;
  private clockT = 0; private clockShow = 0;
  private numSpots: THREE.Mesh[] = [];
  // the ruler
  private ruler: THREE.Group | null = null;
  private rulerKey = '';
  private items: { g: THREE.Group; from: number; show: number; len: number }[] = [];
  private markSpot: THREE.Mesh | null = null;
  private rulerU = 0.04;
  // the scale and the jug
  private scale: THREE.Group | null = null;
  private needle = new THREE.Group();
  private needleShow = 0;
  private sack: THREE.Group | null = null;
  private sackOn = 0; private sackGoal = 0;
  private jug: THREE.Group | null = null;
  private water: THREE.Mesh | null = null;
  private waterShow = 0;
  private jugH = 0.3;
  // the garden
  private garden: THREE.Group | null = null;
  private gardenKey = '';
  private tiles: THREE.Mesh[] = [];
  private tileShown = 0;
  private cellSpots: THREE.Mesh[] = [];
  private pile: THREE.Group | null = null;
  private fence: THREE.Group | null = null;
  private sideSpots: THREE.Mesh[] = [];
  private held: THREE.Mesh | null = null;

  constructor(private sc: EpisodeScene) { sc.root.add(this.root); }

  async load() {
    const [grass, wood] = await Promise.all([loadTexture('math/measure/grass.webp', { repeat: true }), loadTexture('world/planks.webp', { repeat: true })]);
    this.grass = grass; this.wood = wood;
  }
  /** the table's part for the work (board units): the same for every step, so the camera stays put */
  bounds() { return { x: 70, y: 70, w: 460, h: 230 }; }
  /** call after the scene fits the bounds */
  refit() { const a = this.sc.boardPoint(0, 0), b = this.sc.boardPoint(100, 0); this.s = (b.x - a.x) / 100; }
  private at(x: number, y: number, lift = 0) { return this.sc.boardPoint(x, y, lift); }

  // ---------- what's on the table ----------
  /** Show this table (things come and go; values ease to the new ones). */
  set(st: KitState) {
    this.state = st;
    const both = !!st.scale && !!st.jug;
    // the clock
    if (st.clock) {
      if (!this.clock) this.buildClock();
      if (this.faceKind !== st.clock.face) this.paintFace(st.clock.face);
      this.clockT = this.nearest(st.clock.t, this.clockT);
    } else if (this.clock) { this.drop(this.clock); this.clock = null; this.faceKind = null; }
    // the ruler and its things
    if (st.ruler) {
      const key = `${st.ruler.unit}${st.ruler.len}:${st.ruler.items.map(i => i.thing + (i.to - i.from)).join(',')}`;
      if (key !== this.rulerKey) { if (this.ruler) this.drop(this.ruler); this.buildRuler(st.ruler); this.rulerKey = key; }
      st.ruler.items.forEach((it, i) => { if (this.items[i]) this.items[i].from = it.from; });
    } else if (this.ruler) { this.drop(this.ruler); this.ruler = null; this.rulerKey = ''; this.items = []; }
    // the scale
    if (st.scale) {
      if (!this.scale) this.buildScale(this.bench ? 150 : both ? 165 : 300, this.bench ? 150 : 205);
      this.sackGoal = st.scale.load ? 1 : 0;
      this.paintDial(st.scale);
    } else if (this.scale) { this.drop(this.scale); this.scale = null; if (this.sack) { this.drop(this.sack); this.sack = null; } }
    // the jug
    if (st.jug) { if (!this.jug) this.buildJug(this.bench ? 455 : both ? 440 : 300, st.jug, this.bench ? 150 : 205); }
    else if (this.jug) { this.drop(this.jug); this.jug = null; this.water = null; }
    // the garden
    if (st.garden) {
      const key = `${st.garden.w}x${st.garden.h}`;
      if (key !== this.gardenKey) { if (this.garden) this.drop(this.garden); this.buildGarden(st.garden.w, st.garden.h); this.gardenKey = key; this.tileShown = 0; }
      this.showTiles(st.garden.tiles);
      if (this.fence) this.fence.visible = st.garden.fence;
    } else if (this.garden) { this.drop(this.garden); this.garden = null; this.gardenKey = ''; this.tiles = []; }
    if (!this.task) this.pins = this.pins.filter(p => p.kind === 'gold');
    this.onChange?.();
  }
  /** Clear every word pinned on the table. */
  clearPins() { this.pins = []; this.onChange?.(); }
  private drop(g: THREE.Object3D) { g.removeFromParent(); g.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); for (const mt of [m.material].flat()) { const mm = mt as THREE.MeshStandardMaterial; if (mm.map && (mm.map as THREE.CanvasTexture).isCanvasTexture) mm.map.dispose(); mm.dispose(); } } }); }
  /** the same time on a 12-hour clock, nearest to where the hands are (so they turn the short way) */
  private nearest(t: number, from: number) { let x = t; while (x - from > 360) x -= 720; while (from - x > 360) x += 720; return x; }

  // ---------- the clock ----------
  private buildClock() {
    const R = 0.27, g = new THREE.Group();
    this.clockR = R;
    const tilt = new THREE.Group();
    // the brass rim, the dark wood back and the face
    const rim = mesh(new THREE.TorusGeometry(R * 1.06, R * 0.11, 20, 72), std(0xf0b94e, { metalness: 0.55, roughness: 0.32 })); rim.scale.z = 0.75; tilt.add(rim);
    const back = mesh(new THREE.CylinderGeometry(R * 1.08, R * 1.08, R * 0.12, 48).rotateX(Math.PI / 2), std(0x6b4220, { roughness: 0.6 })); back.position.z = -R * 0.07; tilt.add(back);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const rv = mesh(new THREE.SphereGeometry(R * 0.035, 10, 8), brass()); rv.position.set(Math.sin(a) * R * 1.04, Math.cos(a) * R * 1.04, R * 0.07); tilt.add(rv); }
    this.face = mesh(new THREE.CircleGeometry(R, 64), new THREE.MeshStandardMaterial({ roughness: 0.7 }), false);
    this.face.position.z = 0.002; tilt.add(this.face);
    // the hands: the short dark one for the hour, the long red one for the minutes
    const handGeo = (len: number, w: number) => { const sh = new THREE.Shape(); sh.moveTo(-w * 0.5, -len * 0.18); sh.lineTo(w * 0.5, -len * 0.18); sh.lineTo(w * 0.32, len * 0.86); sh.lineTo(0, len); sh.lineTo(-w * 0.32, len * 0.86); sh.closePath(); return new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 2 }); };
    this.hourHand = new THREE.Group(); this.hourHand.add(mesh(handGeo(R * 0.55, R * 0.11), std(0x2c3e66, { metalness: 0.3, roughness: 0.35 }))); this.hourHand.position.z = 0.012;
    this.minHand = new THREE.Group(); this.minHand.add(mesh(handGeo(R * 0.86, R * 0.075), std(0xe0503a, { metalness: 0.2, roughness: 0.35 }))); this.minHand.position.z = 0.024;
    const cap = mesh(new THREE.CylinderGeometry(R * 0.07, R * 0.07, 0.02, 24).rotateX(Math.PI / 2), brass()); cap.position.z = 0.036;
    tilt.add(this.hourHand, this.minHand, cap);
    tilt.position.y = R * 1.16;
    // a little brass stand: two legs and a foot
    const legM = brass();
    for (const sx of [-1, 1]) { const leg = mesh(new THREE.CylinderGeometry(0.012, 0.016, R * 1.0, 10), legM); leg.position.set(sx * R * 0.45, R * 0.42, -R * 0.12); leg.rotation.z = sx * 0.28; g.add(leg); }
    const foot = mesh(new RoundedBoxGeometry(R * 1.5, 0.03, R * 0.5, 3, 0.012), std(0x7a4a24, { roughness: 0.55 })); foot.position.y = 0.015; g.add(foot);
    g.add(tilt);
    g.userData.tilt = tilt;
    g.position.copy(this.at(300, 190));
    if (this.tall) { g.scale.setScalar(0.92); g.position.copy(this.at(300, 245)); }
    this.clock = g; this.root.add(g);
    this.clockShow = this.clockT;
    // the twelve number spots (a "tap the numbers" step): glowing rings on the face
    this.numSpots = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1, a = (n / 12) * Math.PI * 2;
      const sp = new THREE.Mesh(new THREE.RingGeometry(R * 0.1, R * 0.135, 32), new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.9, depthWrite: false }));
      sp.position.set(Math.sin(a) * R * 0.74, Math.cos(a) * R * 0.74, 0.03); sp.visible = false; sp.userData.n = n; sp.renderOrder = 4;
      tilt.add(sp); return sp;
    });
  }
  private paintFace(face: Face) {
    if (!this.face) return;
    this.faceKind = face;
    const tex = canvasTex(1024, 1024, g => {
      const c = 512, r = 512;
      const grd = g.createRadialGradient(c, c * 0.9, r * 0.1, c, c, r); grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.85, '#f6e8c8'); grd.addColorStop(1, '#e7cf9c');
      g.fillStyle = grd; g.fillRect(0, 0, 1024, 1024);
      g.strokeStyle = '#c9a25a'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, r * 0.97, 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
        g.strokeStyle = big ? '#3a2410' : '#8f7650'; g.lineWidth = big ? 14 : 6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(c + Math.sin(a) * r * (big ? 0.8 : 0.85), c - Math.cos(a) * r * (big ? 0.8 : 0.85)); g.lineTo(c + Math.sin(a) * r * 0.91, c - Math.cos(a) * r * 0.91); g.stroke();
      }
      g.fillStyle = '#2f2010'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `600 112px ${fontUi()}`;
      for (let n = 1; n <= 12; n++) {
        if (face === 'none' || (face === 'quarters' && n % 3)) continue;
        const a = (n / 12) * Math.PI * 2; g.fillText(String(n), c + Math.sin(a) * r * 0.64, c - Math.cos(a) * r * 0.64 + 6);
      }
    });
    const mat = this.face.material as THREE.MeshStandardMaterial;
    mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true;
  }
  /** where the clock's hands point now (minutes past 12) */
  get clockNow() { return ((Math.round(this.clockT) % 720) + 720) % 720; }
  /** set the clock outright (a turn's free play) */
  setClock(t: number) { this.clockT = this.nearest(t, this.clockT); }
  private faceGroup() { return this.clock?.userData.tilt as THREE.Group | undefined; }
  /** a point on the clock's face (x, y in face units of R) in the world */
  private facePoint(x: number, y: number, z = 0.04) { const f = this.faceGroup(); return f ? f.localToWorld(new THREE.Vector3(x * this.clockR, y * this.clockR, z)) : new THREE.Vector3(); }
  /** the tip of a hand, in the world */
  private handTip(which: 'hour' | 'minute') { const t = this.clockShow, a = which === 'hour' ? (t / 720) * Math.PI * 2 : ((t % 60) / 60) * Math.PI * 2, l = which === 'hour' ? 0.45 : 0.72; return this.facePoint(Math.sin(a) * l, Math.cos(a) * l); }
  /** where a number sits on the face (for the words of a counting step) */
  numPoint(n: number, out = 1.32) { const a = (n / 12) * Math.PI * 2; return this.facePoint(Math.sin(a) * out, Math.cos(a) * out); }

  // ---------- the ruler ----------
  private buildRuler(r: NonNullable<KitState['ruler']>) {
    const g = new THREE.Group();
    const L = 440 * this.s, W = 66 * this.s, H = 0.016;
    this.rulerL = L;
    const margin = 20 * this.s, u = (L - margin * 2) / r.len;
    this.rulerU = u;
    const tex = canvasTex(2048, 256, c => {
      const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#f6d48e'); gr.addColorStop(1, '#e2ae5c'); c.fillStyle = gr; c.fillRect(0, 0, 2048, 256);
      c.globalAlpha = 0.18; c.strokeStyle = '#9a6a2c'; for (let i = 0; i < 18; i++) { c.lineWidth = 2 + (i % 3); c.beginPath(); c.moveTo(0, 10 + i * 14); c.bezierCurveTo(600, i * 13, 1400, 20 + i * 15, 2048, 8 + i * 14); c.stroke(); }
      c.globalAlpha = 1;
      const px = (v: number) => (margin + v * u) / L * 2048;
      c.fillStyle = '#3a220a'; c.strokeStyle = '#3a220a'; c.textAlign = 'center'; c.font = `600 80px ${fontUi()}`;
      for (let i = 0; i <= r.len * 2; i++) {
        const v = i / 2, whole = i % 2 === 0;
        c.lineWidth = whole ? 7 : 4; c.beginPath(); c.moveTo(px(v), 0); c.lineTo(px(v), whole ? 96 : 54); c.stroke();
        if (whole) c.fillText(String(v), px(v), 196);
      }
      c.font = `700 52px ${fontUi()}`; c.textAlign = 'right'; c.fillText(r.unit, 2030, 230);
    });
    const top = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), side = std(0xc98f45);
    const body = mesh(new RoundedBoxGeometry(L, H, W, 2, 0.004), [side, side, top, side, side, side] as unknown as THREE.Material);
    body.position.y = H / 2;
    g.add(body);
    g.position.copy(this.at(300, this.bench ? 268 : 238));
    this.ruler = g; this.root.add(g);
    // the things lying above it: a crayon and a pencil, made in 3D at their exact lengths
    this.items = r.items.map((it, i) => {
      const len = (it.to - it.from) * u;
      const t = it.thing === 'pencil' ? pencil(len, 7 * this.s) : crayon(len, 8.5 * this.s);
      t.position.set(0, 0, -W / 2 - (i + 0.65) * 34 * this.s);
      // a bigger, unseen box round it, so a finger can grab it easily
      const grab = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.05), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      grab.position.set(len / 2, 0.02, 0); t.add(grab);
      g.add(t);
      return { g: t, from: it.from, show: it.from, len: it.to - it.from };
    });
  }
  /** the x on the ruler (in its group) of a reading */
  private rulerL = 1;
  private rulerX(v: number) { return -this.rulerL / 2 + 20 * this.s + v * this.rulerU; }
  markPoint(v: number) { return this.ruler ? this.ruler.localToWorld(new THREE.Vector3(this.rulerX(v), 0.03, 30 * this.s * 0.2)) : new THREE.Vector3(); }

  // ---------- the scale ----------
  private buildScale(x: number, y = 205) {
    const g = new THREE.Group();
    const body = mesh(new RoundedBoxGeometry(0.3, 0.26, 0.2, 4, 0.05), std(0x8fd3b0, { roughness: 0.45 }));
    body.position.y = 0.13; g.add(body);
    const front = mesh(new RoundedBoxGeometry(0.31, 0.06, 0.205, 3, 0.02), std(0xfff3dc, { roughness: 0.5 })); front.position.y = 0.03; g.add(front);
    // the dial: a white face with its numbers (repainted for each question), a red needle
    const dial = mesh(new THREE.CircleGeometry(0.095, 48), new THREE.MeshStandardMaterial({ roughness: 0.5 }), false);
    dial.position.set(0, 0.15, 0.102); g.add(dial);
    const ring = mesh(new THREE.TorusGeometry(0.1, 0.012, 12, 48), std(0xc8ced8, { metalness: 0.7, roughness: 0.3 })); ring.position.copy(dial.position); g.add(ring);
    this.needle = new THREE.Group();
    const nd = mesh(new THREE.BoxGeometry(0.006, 0.08, 0.004), std(0xe0283f)); nd.position.y = 0.036; this.needle.add(nd);
    this.needle.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16).rotateX(Math.PI / 2), std(0xe0283f)));
    this.needle.position.set(0, 0.15, 0.108); g.add(this.needle);
    g.userData.dial = dial;
    // the pan on top
    const pan = mesh(new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.16, 0.02], [0.165, 0.03]].map(([a, b]) => new THREE.Vector2(a, b)), 40), std(0xd9dde6, { metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide }));
    pan.position.y = 0.27; g.add(pan);
    const stem = mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.02, 12), std(0xb8bec8, { metalness: 0.7, roughness: 0.3 })); stem.position.y = 0.265; g.add(stem);
    g.position.copy(this.at(x, y));
    g.rotation.y = x < 300 ? 0.18 : 0;
    g.scale.setScalar(1.45);
    if (this.tall) g.scale.setScalar(1.1);
    this.scale = g; this.root.add(g);
    // the sack of carrots, waiting beside it
    const sack = new THREE.Group();
    const bag = mesh(new THREE.SphereGeometry(0.075, 20, 14), std(0xc9a46a, { roughness: 0.95 })); bag.scale.set(1.15, 0.95, 0.95); bag.position.y = 0.068; sack.add(bag);
    const neck = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.04, 14), std(0xb48d55, { roughness: 0.95 })); neck.position.y = 0.135; sack.add(neck);
    const tie = mesh(new THREE.TorusGeometry(0.032, 0.007, 8, 20).rotateX(Math.PI / 2), std(0x8a3a2a)); tie.position.y = 0.125; sack.add(tie);
    // carrots poking out of the top, with their green tops
    for (let i = 0; i < 3; i++) {
      const a = i * 2.1, c = new THREE.Group();
      const root = mesh(new THREE.ConeGeometry(0.016, 0.09, 10).rotateX(Math.PI), std(0xf07a1c, { roughness: 0.6 })); c.add(root);
      for (let j = 0; j < 3; j++) { const leaf = mesh(new THREE.ConeGeometry(0.007, 0.06, 5), std(0x4caf50)); leaf.position.set(Math.sin(j * 2.1) * 0.006, 0.07, Math.cos(j * 2.1) * 0.006); leaf.rotation.set(Math.sin(j) * 0.4, 0, Math.cos(j * 2) * 0.4); c.add(leaf); }
      c.position.set(Math.sin(a) * 0.022, 0.17, Math.cos(a) * 0.022); c.rotation.set(Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35); sack.add(c);
    }
    const grab = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); grab.position.y = 0.09; sack.add(grab);
    sack.scale.setScalar(1.45);
    this.sack = sack; this.root.add(sack);
    this.sackOn = 0;
  }
  private sackHome() { return this.bench ? this.at(285, 165) : this.at((this.scale?.position ? this.boardX(this.scale.position.x) : 165) - 105, 250); }
  private sackPan() { return this.scale ? this.scale.localToWorld(new THREE.Vector3(0, 0.275, 0)) : new THREE.Vector3(); }
  private boardX(wx: number) { const o = this.sc.boardPoint(300, 0).x; return 300 + (wx - o) / this.s; }
  private dialKey = '';
  private paintDial(sc: NonNullable<KitState['scale']>) {
    const key = `${sc.max}/${sc.step}/${sc.label}${sc.unit}`;
    if (key === this.dialKey || !this.scale) return;
    this.dialKey = key;
    const dial = this.scale.userData.dial as THREE.Mesh;
    const tex = canvasTex(512, 512, g => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 512);
      const c = 256, R = 230, deg = (v: number) => (-150 + (v / sc.max) * 300) * Math.PI / 180;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let v = 0; v <= sc.max + 1e-9; v += sc.step) {
        const a = deg(v), big = Math.abs(v / sc.label - Math.round(v / sc.label)) < 1e-6;
        g.strokeStyle = '#2b2f40'; g.lineWidth = big ? 10 : 5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(c + Math.sin(a) * R * (big ? 0.78 : 0.85), c - Math.cos(a) * R * (big ? 0.78 : 0.85)); g.lineTo(c + Math.sin(a) * R * 0.95, c - Math.cos(a) * R * 0.95); g.stroke();
        if (big) { g.fillStyle = '#23283a'; g.font = `600 ${String(v).length > 3 ? 46 : 56}px ${fontUi()}`; g.fillText(String(v), c + Math.sin(a) * R * 0.58, c - Math.cos(a) * R * 0.58); }
      }
      g.fillStyle = '#5a6070'; g.font = `600 52px ${fontUi()}`; g.fillText(sc.unit, c, c + 120);
    });
    const mat = dial.material as THREE.MeshStandardMaterial; mat.map?.dispose(); mat.map = tex; mat.needsUpdate = true;
  }
  /** the needle's angle for a value */
  private needleAngle(v: number) { const sc = this.state.scale; return sc ? -(-150 + (v / sc.max) * 300) * Math.PI / 180 : 0; }
  dialPoint() { return this.scale ? this.scale.localToWorld(new THREE.Vector3(0, 0.27, 0.12)) : new THREE.Vector3(); }

  // ---------- the jug ----------
  private buildJug(x: number, j: NonNullable<KitState['jug']>, y = 205) {
    const g = new THREE.Group();
    const R = 0.1, H = 0.3; this.jugH = H;
    const glass = new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const body = mesh(new THREE.LatheGeometry([[0, 0], [R, 0], [R + 0.004, 0.01], [R + 0.004, H], [R - 0.004, H], [R - 0.004, 0.02], [0, 0.02]].map(([a, b]) => new THREE.Vector2(a, b)), 48), glass, false);
    body.renderOrder = 5; g.add(body);
    const handle = mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 24, Math.PI), glass, false); handle.rotation.z = -Math.PI / 2; handle.position.set(R + 0.005, H * 0.55, 0); g.add(handle);
    const spout = mesh(new THREE.ConeGeometry(0.03, 0.05, 12, 1, true).rotateZ(Math.PI / 2), glass, false); spout.position.set(-R - 0.01, H - 0.02, 0); g.add(spout);
    // the water: a cylinder whose height follows the level
    this.water = mesh(new THREE.CylinderGeometry(R - 0.008, R - 0.008, 1, 40).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x2f8fe8, emissive: 0x0a3a7a, emissiveIntensity: 0.25, roughness: 0.15, transparent: true, opacity: 0.82, depthWrite: false }), false);
    this.water.position.y = 0.02; this.water.scale.y = 0.0001; this.water.renderOrder = 4; g.add(this.water);
    // the marks, painted on the front of the glass (a curved strip facing the kid)
    const tex = canvasTex(256, 512, c => {
      c.clearRect(0, 0, 256, 512);
      const y = (v: number) => 512 - 24 - (v / j.max) * (512 - 60);
      c.textBaseline = 'middle'; c.font = `600 44px ${fontUi()}`;
      for (let v = j.step; v <= j.max + 1e-9; v += j.step) {
        const big = Math.abs(v / j.label - Math.round(v / j.label)) < 1e-6;
        c.strokeStyle = '#1b4a78'; c.lineWidth = big ? 9 : 6; c.lineCap = 'round';
        c.beginPath(); c.moveTo(16, y(v)); c.lineTo(big ? 92 : 62, y(v)); c.stroke();
        if (big) { c.lineWidth = 8; c.strokeStyle = '#ffffff'; c.strokeText(String(v), 102, y(v)); c.fillStyle = '#1b4a78'; c.fillText(String(v), 102, y(v)); }
      }
      c.font = `700 40px ${fontUi()}`; c.lineWidth = 8; c.strokeStyle = '#fff'; c.strokeText(j.unit, 150, 486); c.fillStyle = '#1b4a78'; c.fillText(j.unit, 150, 486);
    });
    const strip = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.006, R + 0.006, H - 0.02, 32, 1, true, -0.55, 1.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    strip.position.y = 0.02 + (H - 0.02) / 2; strip.renderOrder = 6; g.add(strip);
    g.position.copy(this.at(x, y));
    g.rotation.y = x > 300 ? -0.15 : 0;
    g.scale.setScalar(1.45);
    if (this.tall) g.scale.setScalar(1.1);
    this.jug = g; this.root.add(g);
    this.waterShow = 0;
  }
  private levelY(v: number) { const j = this.state.jug; return j ? 0.02 + (24 / 512) * (this.jugH - 0.02) + (v / j.max) * (this.jugH - 0.02) * (1 - 60 / 512) : 0.02; }
  waterPoint() { const j = this.state.jug; return this.jug && j ? this.jug.localToWorld(new THREE.Vector3(0, this.levelY(this.waterShow) + 0.02, 0.1)) : new THREE.Vector3(); }
  /** the jug's level now (a turn's free play) */
  get jugNow() { return this.state.jug?.value ?? 0; }

  // ---------- the garden ----------
  private cell = 0.1;
  private gw = 4; private gh = 3;
  private buildGarden(w: number, h: number) {
    const g = new THREE.Group();
    const c = Math.min(72, 330 / w, 190 / h) * this.s; this.cell = c; this.gw = w; this.gh = h;
    const soil = mesh(new RoundedBoxGeometry(w * c + 0.04, 0.03, h * c + 0.04, 2, 0.01), std(0x7a5236, { roughness: 0.95 }));
    soil.position.y = 0.015; g.add(soil);
    // faint lines for the squares
    const lines = new THREE.Group();
    const lm = new THREE.MeshBasicMaterial({ color: 0xe8c690, transparent: true, opacity: 0.55 });
    for (let i = 0; i <= w; i++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.004, h * c).rotateX(-Math.PI / 2), lm); l.position.set(-w * c / 2 + i * c, 0.031, 0); lines.add(l); }
    for (let j = 0; j <= h; j++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(w * c, 0.004).rotateX(-Math.PI / 2), lm); l.position.set(0, 0.031, -h * c / 2 + j * c); lines.add(l); }
    g.add(lines);
    const tm = [std(0x5a8f3a), std(0x5a8f3a), new THREE.MeshStandardMaterial({ map: this.grass, roughness: 0.9 }), std(0x4c7a30), std(0x5a8f3a), std(0x5a8f3a)];
    const tgeo = new RoundedBoxGeometry(c * 0.94, 0.03, c * 0.94, 2, 0.006);
    this.tiles = Array.from({ length: w * h }, () => { const t = mesh(tgeo, tm as unknown as THREE.Material); t.visible = false; g.add(t); return t; });
    this.cellSpots = Array.from({ length: w * h }, (_, i) => { const sp = glowRing(c * 0.42); sp.position.copy(this.cellPos(i)).setY(0.034); sp.visible = false; g.add(sp); return sp; });
    // a pile of tiles at the front right
    const pile = new THREE.Group();
    for (let i = 0; i < 4; i++) { const t = mesh(tgeo, tm as unknown as THREE.Material); t.position.set(0, 0.015 + i * 0.032, 0); t.rotation.y = i * 0.15; pile.add(t); }
    pile.position.set(w * c / 2 + c * 0.9, 0, h * c / 2 - c * 0.3);
    this.pile = pile; g.add(pile);
    // the fence: posts and rails all the way round
    const fence = new THREE.Group(), wood = std(0xc58a4a, { roughness: 0.7 });
    const W2 = w * c / 2 + 0.025, H2 = h * c / 2 + 0.025;
    for (let i = 0; i <= w; i++) for (const z of [-H2, H2]) { const p = mesh(new THREE.BoxGeometry(0.014, 0.07, 0.014), wood); p.position.set(-w * c / 2 + i * c, 0.035, z); fence.add(p); }
    for (let j = 0; j <= h; j++) for (const x of [-W2, W2]) { const p = mesh(new THREE.BoxGeometry(0.014, 0.07, 0.014), wood); p.position.set(x, 0.035, -h * c / 2 + j * c); fence.add(p); }
    for (const z of [-H2, H2]) for (const y of [0.03, 0.055]) { const r = mesh(new THREE.BoxGeometry(w * c + 0.05, 0.008, 0.008), wood); r.position.set(0, y, z); fence.add(r); }
    for (const x of [-W2, W2]) for (const y of [0.03, 0.055]) { const r = mesh(new THREE.BoxGeometry(0.008, 0.008, h * c + 0.05), wood); r.position.set(x, y, 0); fence.add(r); }
    fence.visible = false; this.fence = fence; g.add(fence);
    // the four sides to tap (top, right, bottom, left)
    this.sideSpots = [[0, -H2, w], [W2, 0, h], [0, H2, w], [-W2, 0, h]].map(([x, z, n], i) => {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(i % 2 ? 0.03 : n * c, 0.012, i % 2 ? n * c : 0.03), new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.85, depthWrite: false }));
      sp.position.set(x, 0.08, z); sp.visible = false; sp.userData.side = i; g.add(sp); return sp;
    });
    g.position.copy(this.at(285, 185));
    this.garden = g; this.root.add(g);
  }
  private cellPos(i: number) { const c = this.cell, x = i % this.gw, y = Math.floor(i / this.gw); return new THREE.Vector3(-this.gw * c / 2 + (x + 0.5) * c, 0.045, -this.gh * c / 2 + (y + 0.5) * c); }
  private showTiles(n: number) {
    for (let i = 0; i < this.tiles.length; i++) {
      const t = this.tiles[i], on = i < n;
      if (on && !t.visible) { t.visible = true; t.userData.born = this.now + (i - this.tileShown) * 0.07; t.position.copy(this.cellPos(i)); }
      if (!on) t.visible = false;
    }
    this.tileShown = n;
  }
  sidePoint(i: number) { const sp = this.sideSpots[i]; return sp ? sp.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(i === 1 ? 0.07 : i === 3 ? -0.07 : 0, 0.03, i === 0 ? -0.03 : i === 2 ? 0.05 : 0)) : new THREE.Vector3(); }

  /** The bench's readings now: each thing on the ruler (from, to), the scale's needle, the jug. */
  readings() {
    return {
      items: this.items.map(it => ({ from: it.from, to: it.from + it.len, len: it.len })),
      weight: this.state.scale?.load ? this.state.scale.value : 0,
      water: this.state.jug?.value ?? 0,
    };
  }
  itemPoint(i: number) { const it = this.items[i]; return it ? it.g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(it.len * this.rulerU * (i ? 0.78 : 0.22), 0.05 + i * 0.03, -0.02)) : new THREE.Vector3(); }
  /** set the things on the ruler to new lengths, and the sack to a new weight (the bench's "something else") */
  restock(lens: number[], weight: number) {
    const r = this.state.ruler; if (!r) return;
    this.rulerKey = '';
    const st: KitState = { ...this.state, ruler: { ...r, items: r.items.map((it, i) => ({ ...it, from: it.from, to: it.from + (lens[i] ?? it.to - it.from) })) } };
    if (st.scale) st.scale = { ...st.scale, value: weight };
    this.set(st);
  }

  /** over the work, a little above it (where the shortcut shows) */
  overPoint(): THREE.Vector3 {
    if (this.clock) return this.at(300, 322, 0.03);
    if (this.ruler) return this.ruler.localToWorld(new THREE.Vector3(0, 0.2, -0.12));
    if (this.garden) return this.garden.localToWorld(new THREE.Vector3(0, 0.2, -this.gh * this.cell / 2 - 0.06));
    if (this.scale || this.jug) return this.at(300, 320, 0.03);
    return this.at(300, 150, 0.3);
  }

  // ---------- the kid's hands ----------
  /** Arm a step's job: resolves once it's done (the kid's part, and the rest following). */
  arm(t: MTask): Promise<void> {
    this.task = t;
    this.pins = this.pins.filter(p => p.kind === 'gold');
    return new Promise(res => {
      this.taskDone = () => { this.task = null; this.taskDone = null; this.hideSpots(); res(); };
      if (t.kind === 'nums') { this.taskLeft = [...t.nums]; this.numSpots.forEach(sp => (sp.visible = t.nums.includes(sp.userData.n))); }
      if (t.kind === 'mark') { this.markSpot = glowRing(18 * this.s); this.markSpot.position.copy(this.ruler!.worldToLocal(this.markPoint(t.at))).setY(0.02); this.ruler!.add(this.markSpot); }
      if (t.kind === 'tiles') this.cellSpots.forEach((sp, i) => (sp.visible = i >= this.tileShown && i < t.to));
      if (t.kind === 'sides') { this.taskLeft = [0, 1, 2, 3]; this.sideSpots.forEach(sp => (sp.visible = true)); }
      this.onChange?.();
    });
  }
  private hideSpots() {
    this.numSpots.forEach(sp => (sp.visible = false));
    this.cellSpots.forEach(sp => (sp.visible = false));
    this.sideSpots.forEach(sp => (sp.visible = false));
    if (this.markSpot) { this.markSpot.removeFromParent(); this.markSpot.geometry.dispose(); this.markSpot = null; }
  }
  get armed() { return !!this.task; }
  /** how many of the kid's moves are left (for the page's words) */
  get left() { const t = this.task; return !t ? 0 : t.kind === 'nums' || t.kind === 'sides' ? this.taskLeft.length : 1; }
  /** Do the rest by itself ("Show me", or the rest following the kid's first moves). */
  finish() {
    const t = this.task; if (!t) return;
    if (t.kind === 'hand') this.clockT = this.nearest(t.to, this.clockT);
    if (t.kind === 'nums') { for (const n of this.taskLeft) this.revealNum(n); this.taskLeft = []; }
    if (t.kind === 'slide') { this.items[t.item].from = t.to; }
    if (t.kind === 'mark') this.pins.push({ id: 'mark', at: () => this.markPoint(t.at).add(new THREE.Vector3(0, 0.07, 0)), text: t.label, kind: 'gold' });
    if (t.kind === 'load') { this.sackGoal = 1; mSfx.thud(); }
    if (t.kind === 'pour') { if (this.state.jug) this.state = { ...this.state, jug: { ...this.state.jug, value: t.to } }; mSfx.pour(); }
    if (t.kind === 'tiles') this.showTiles(t.to);
    if (t.kind === 'sides') { for (const i of this.taskLeft) this.revealSide(i); this.taskLeft = []; }
    const done = this.taskDone;
    setTimeout(() => done?.(), t.kind === 'tiles' ? 900 : 700);
  }
  private revealNum(n: number) { this.pins.push({ id: `n${n}`, at: () => this.numPoint(n), text: String(n * 5), kind: 'gold' }); this.numSpots[n - 1].visible = false; mSfx.tick(); this.onChange?.(); }
  private revealSide(i: number) { const g = this.state.garden; if (!g) return; this.pins.push({ id: `s${i}`, at: () => this.sidePoint(i), text: String(i % 2 ? g.h : g.w), kind: 'gold' }); this.sideSpots[i].visible = false; this.onChange?.(); }

  /** Where the kid should touch first (for "Try it"), and where it goes (for the helping hand). */
  tryPoint(): THREE.Vector3 | null {
    const t = this.task;
    if (this.free === 'clock') return this.handTip('minute');
    if (this.free === 'pour') return this.waterPoint();
    if (this.free === 'bench') return null;
    if (!t) return null;
    switch (t.kind) {
      case 'hand': return this.handTip(t.hand);
      case 'nums': return this.taskLeft.length ? this.facePoint(Math.sin((this.taskLeft[0] / 12) * Math.PI * 2) * 0.74, Math.cos((this.taskLeft[0] / 12) * Math.PI * 2) * 0.74) : null;
      case 'slide': return this.items[t.item] ? this.items[t.item].g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(this.items[t.item].len * this.rulerU * 0.5, 0.03, 0)) : null;
      case 'mark': return this.markPoint(t.at);
      case 'load': return this.sack ? this.sack.position.clone().add(new THREE.Vector3(0, 0.12, 0)) : null;
      case 'pour': return this.waterPoint();
      case 'tiles': return this.pile ? this.pile.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.12, 0)) : null;
      case 'sides': return this.taskLeft.length ? this.sidePoint(this.taskLeft[0]) : null;
      default: return null;
    }
  }
  /** The helping hand: from the first thing to touch to where it goes, over and over. */
  handPoint(): THREE.Vector3 | null {
    const from = this.tryPoint(); if (!from) return null;
    const t = this.task, k = smooth(Math.min(1, ((this.now % 2.2) / 2.2) * 1.4));
    let to: THREE.Vector3 | null = null;
    if (t?.kind === 'hand') { const a = t.hand === 'hour' ? (t.to / 720) * Math.PI * 2 : ((t.to % 60) / 60) * Math.PI * 2, l = t.hand === 'hour' ? 0.45 : 0.72; to = this.facePoint(Math.sin(a) * l, Math.cos(a) * l); }
    if (t?.kind === 'slide') to = from.clone().add(new THREE.Vector3((t.to - this.items[t.item].from) * this.rulerU, 0, 0));
    if (t?.kind === 'load') to = this.sackPan().add(new THREE.Vector3(0, 0.08, 0));
    if (t?.kind === 'pour' && this.jug) to = this.jug.localToWorld(new THREE.Vector3(0, this.levelY(t.to) + 0.02, 0.1));
    if (t?.kind === 'tiles' && this.garden) { const i = this.tileShown; to = this.garden.localToWorld(this.cellPos(i).clone()); }
    return to ? from.clone().lerp(to, k) : from;
  }

  /** Pointer events from the page (screen pixels). True when the kit used it. */
  private px = { x: 0, y: 0 };
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    this.px = { x, y };
    this.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), stage.camera);
    if (kind === 'up') { const was = !!this.drag; this.dropDrag(); return was; }
    if (kind === 'move') { if (!this.drag) return false; this.moveDrag(); return true; }
    const t = this.task;
    const free = this.free;
    // the clock: a hand (a step's, or any while setting it on a turn)
    if (this.clock && (t?.kind === 'hand' || free === 'clock')) {
      const f = this.faceGroup()!, n = new THREE.Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()));
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, f.getWorldPosition(new THREE.Vector3()));
      const p = this.ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (p) {
        const l = f.worldToLocal(p.clone()), d = Math.hypot(l.x, l.y) / this.clockR;
        if (d < 1.15) {
          const deg = ((Math.atan2(l.x, l.y) * 180) / Math.PI + 360) % 360;
          const hd = ((this.clockShow / 720) * 360) % 360, md = ((this.clockShow % 60) / 60) * 360;
          const gap = (a: number, b: number) => { const q = Math.abs(a - b) % 360; return Math.min(q, 360 - q); };
          const which: 'hour' | 'minute' = t?.kind === 'hand' ? t.hand : gap(deg, hd) < 25 && (d < 0.55 || gap(deg, hd) + 8 < gap(deg, md)) ? 'hour' : 'minute';
          this.drag = { kind: which, plane };
          this.moveDrag();
          return true;
        }
      }
    }
    if (t?.kind === 'nums' && this.clock) {
      const hit = this.ray.intersectObjects(this.numSpots.filter(s => s.visible), false)[0];
      const f = this.faceGroup()!, n = new THREE.Vector3(0, 0, 1).applyQuaternion(f.getWorldQuaternion(new THREE.Quaternion()));
      const p = hit ? null : this.ray.ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, f.getWorldPosition(new THREE.Vector3())), new THREE.Vector3());
      let num = hit?.object.userData.n as number | undefined;
      if (!num && p) { const l = f.worldToLocal(p); const near = this.numSpots.filter(s => s.visible).sort((a, b) => a.position.distanceTo(l) - b.position.distanceTo(l))[0]; if (near && near.position.distanceTo(l) < this.clockR * 0.25) num = near.userData.n; }
      // the numbers are counted in order: the next one glows brightest, but any glowing one counts
      if (num && this.taskLeft.includes(num)) {
        const next = this.taskLeft.shift()!;
        this.revealNum(next);
        this.sc.bounce?.();
        if (!this.taskLeft.length) this.finish();
        return true;
      }
    }
    if (t?.kind === 'slide' && this.items[t.item]) {
      const it = this.items[t.item];
      const hit = this.ray.intersectObject(it.g, true)[0];
      if (hit) { const plane = new THREE.Plane(UP, -(TY + 0.02)); const p = this.ray.ray.intersectPlane(plane, new THREE.Vector3()); if (p) { this.drag = { kind: 'item', plane, item: t.item, offset: this.ruler!.worldToLocal(p.clone()).x - this.rulerX(it.from) }; return true; } }
    }
    if (t?.kind === 'mark' && this.ruler) {
      const p = this.ray.ray.intersectPlane(new THREE.Plane(UP, -(TY + 0.02)), new THREE.Vector3());
      if (p && p.distanceTo(this.markPoint(t.at)) < 0.07) { mSfx.chime(); this.finish(); return true; }
    }
    if (t?.kind === 'load' && this.sack) {
      const hit = this.ray.intersectObject(this.sack, true)[0];
      if (hit) { this.drag = { kind: 'sack', plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.sack.position.z) }; return true; }
    }
    if (free === 'bench') {
      for (let i = 0; i < this.items.length; i++) {
        const it = this.items[i];
        if (this.ray.intersectObject(it.g, true)[0]) { const plane = new THREE.Plane(UP, -(TY + 0.02)); const p = this.ray.ray.intersectPlane(plane, new THREE.Vector3()); if (p) { this.drag = { kind: 'item', plane, item: i, offset: this.ruler!.worldToLocal(p.clone()).x - this.rulerX(it.from) }; mSfx.tick(); return true; } }
      }
      if (this.sack && this.ray.intersectObject(this.sack, true)[0]) { this.drag = { kind: 'sack', plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.sack.position.z) }; return true; }
    }
    if ((t?.kind === 'pour' || free === 'pour' || free === 'bench') && this.jug) {
      const hit = this.ray.intersectObject(this.jug, true)[0];
      if (hit) { const n = stage.camera.getWorldDirection(new THREE.Vector3()).negate(); this.drag = { kind: 'water', plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, this.jug.localToWorld(new THREE.Vector3(0, 0, 0.1))) }; this.moveDrag(); return true; }
    }
    if (t?.kind === 'tiles' && this.pile && this.garden) {
      const hit = this.ray.intersectObject(this.pile, true)[0];
      if (hit) {
        const tile = this.tiles[this.tileShown]; if (!tile) return false;
        tile.visible = true; tile.userData.born = -9; this.held = tile;
        this.drag = { kind: 'tile', plane: new THREE.Plane(UP, -(TY + 0.07)) };
        this.moveDrag(); return true;
      }
    }
    if (t?.kind === 'sides') {
      const hit = this.ray.intersectObjects(this.sideSpots.filter(s => s.visible), false)[0];
      const side = hit?.object.userData.side as number | undefined;
      if (side !== undefined) { this.taskLeft = this.taskLeft.filter(i => i !== side); this.revealSide(side); mSfx.tick(); if (!this.taskLeft.length) this.finish(); return true; }
    }
    return false;
  }
  private moveDrag() {
    const d = this.drag; if (!d) return;
    const p = this.ray.ray.intersectPlane(d.plane, new THREE.Vector3()); if (!p) return;
    if (d.kind === 'hour' || d.kind === 'minute') {
      const f = this.faceGroup()!, l = f.worldToLocal(p.clone());
      const deg = ((Math.atan2(l.x, l.y) * 180) / Math.PI + 360) % 360;
      const t = this.task, cur = this.clockNow, h = Math.floor(cur / 60), mm = cur % 60;
      let next = cur;
      if (d.kind === 'minute') {
        const snap = t?.kind === 'hand' ? (t.to % 5 ? 1 : 5) : this.freeSnap;
        const m2 = (Math.round(deg / 6 / snap) * snap) % 60;
        if (m2 !== mm) { let hh = h; if (mm - m2 > 30) hh = (hh + 1) % 12; else if (m2 - mm > 30) hh = (hh + 11) % 12; next = hh * 60 + m2; }
      } else {
        const hh = Math.floor(((deg - (mm / 60) * 30 + 15 + 360) % 360) / 30) % 12;
        if (hh !== h) next = hh * 60 + mm;
      }
      if (next !== cur) { this.clockT += ((next - cur + 1080) % 720) - 360; mSfx.tick(); this.onChange?.(); }
      if (t?.kind === 'hand' && this.clockNow === ((t.to % 720) + 720) % 720) { this.dropDrag(); mSfx.chime(); this.finish(); }
      return;
    }
    if (d.kind === 'item' && this.ruler) {
      const it = this.items[d.item!], l = this.ruler.worldToLocal(p.clone()).x - (d.offset ?? 0);
      const v = Math.max(0, Math.min(this.state.ruler!.len - it.len, Math.round(((l + this.rulerL / 2 - 20 * this.s) / this.rulerU) * 2) / 2));
      if (v !== it.from) { it.from = v; mSfx.tick(); this.onChange?.(); }
      const t = this.task;
      if (t?.kind === 'slide' && v === t.to) { this.dropDrag(); mSfx.chime(); this.finish(); }
      return;
    }
    if (d.kind === 'sack' && this.sack) {
      this.sack.position.set(p.x, Math.max(TY, p.y - 0.06), this.sack.position.z);
      // over the pan (on the page): it drops in
      const pan = this.toScreen(this.sackPan().add(new THREE.Vector3(0, 0.06, 0)));
      if (this.free !== 'bench' && Math.hypot(pan.x - this.px.x, pan.y - this.px.y) < Math.max(40, innerHeight * 0.06)) { this.dropDrag(); this.finish(); }
      return;
    }
    if (d.kind === 'water' && this.jug && this.state.jug) {
      // (on the page: where the finger is between the jug's empty line and its full one)
      const j = this.state.jug, V = THREE.Vector3;
      const lo = this.toScreen(this.jug.localToWorld(new V(0, this.levelY(0), 0.1))), hi = this.toScreen(this.jug.localToWorld(new V(0, this.levelY(j.max), 0.1)));
      const k = (lo.y - this.px.y) / Math.max(1, lo.y - hi.y);
      const v = Math.max(0, Math.min(j.max, Math.round((k * j.max) / j.step) * j.step));
      if (v !== j.value) { if (v > j.value) mSfx.pour(true); else mSfx.tick(); this.state = { ...this.state, jug: { ...j, value: v } }; this.onChange?.(); }
      const t = this.task;
      if (t?.kind === 'pour' && v === t.to) { this.dropDrag(); mSfx.chime(); this.finish(); }
      return;
    }
    if (d.kind === 'tile' && this.held && this.garden) {
      const l = this.garden.worldToLocal(p.clone()); this.held.position.set(l.x, 0.09, l.z);
    }
  }
  private dropDrag() {
    const d = this.drag; this.drag = null;
    if (d?.kind === 'tile' && this.held && this.garden) {
      const tile = this.held; this.held = null;
      const i = this.tileShown, home = this.cellPos(i);
      const t = this.task;
      // near any glowing square: it goes into the next one in order
      if (tile.position.distanceTo(home) < this.cell * 1.6 || this.cellSpots.some(sp => sp.visible && sp.position.distanceTo(tile.position) < this.cell * 0.7)) {
        tile.position.copy(home); this.cellSpots[i].visible = false; this.tileShown = i + 1; mSfx.thud();
        this.sc.bounce?.();
        if (t?.kind === 'tiles') {
          const placed = this.tileShown - (this.state.garden?.tiles ?? 0);
          if (this.tileShown >= t.to || placed >= t.by) this.finish();
        }
      } else { tile.visible = false; }
      this.onChange?.();
    }
    if (d?.kind === 'sack' && this.sack && this.free === 'bench') {
      const pan = this.toScreen(this.sackPan().add(new THREE.Vector3(0, 0.06, 0)));
      const on = Math.hypot(pan.x - this.px.x, pan.y - this.px.y) < Math.max(60, innerHeight * 0.09);
      this.sackGoal = on ? 1 : 0; this.sackOn = on ? 0.6 : 0.4; if (on) mSfx.thud();
      if (this.state.scale) this.state = { ...this.state, scale: { ...this.state.scale, load: on } };
      this.onChange?.();
    }
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    const cam = stage.camera;
    // on a tall screen (a phone) the friends stand close together: the things come a little smaller and
    // nearer the kid, so they sit between the friends instead of in front of them
    const tall = (innerWidth || 1) / (innerHeight || 1) < 0.9;
    if (tall !== this.tall) {
      this.tall = tall;
      if (this.clock) { this.clock.scale.setScalar(tall ? 0.92 : 1); this.clock.position.copy(this.at(300, tall ? 245 : 190)); }
      for (const g of [this.scale, this.jug]) if (g) g.scale.setScalar(tall ? 1.1 : 1.45);
    }
    // the clock leans back to face the kid, and its hands turn smoothly to the time
    if (this.clock) {
      const f = this.faceGroup()!, c = f.getWorldPosition(new THREE.Vector3()), v = cam.position.clone().sub(c);
      const tilt = Math.atan2(v.y, Math.hypot(v.x, v.z)) * 0.85;
      f.rotation.x += (-tilt - f.rotation.x) * Math.min(1, dt * 6);
      this.clock.rotation.y = Math.atan2(v.x, v.z) * 0.6;
      this.clockShow += (this.clockT - this.clockShow) * Math.min(1, dt * (this.drag ? 18 : 3.2));
      this.hourHand.rotation.z = -(this.clockShow / 720) * Math.PI * 2;
      this.minHand.rotation.z = -((this.clockShow % 60) / 60) * Math.PI * 2;
      const pulse = 0.55 + Math.sin(t * 6) * 0.35;
      for (const sp of this.numSpots) if (sp.visible) (sp.material as THREE.MeshBasicMaterial).opacity = sp.userData.n === this.taskLeft[0] ? 0.95 : pulse * 0.6;
    }
    // the ruler's things glide to where they lie
    if (this.ruler) for (const it of this.items) { it.show += (it.from - it.show) * Math.min(1, dt * (this.drag ? 20 : 5)); it.g.position.x = this.rulerX(it.show); }
    if (this.markSpot) { const k = 1 + Math.sin(t * 5) * 0.15; this.markSpot.scale.set(k, 1, k); }
    // the sack: on the pan or at home; the needle swings to it (with a little wobble)
    if (this.scale && this.sack && this.drag?.kind !== 'sack') {
      this.sackOn += (this.sackGoal - this.sackOn) * Math.min(1, dt * 4);
      const home = this.sackHome(), pan = this.sackPan();
      this.sack.position.lerpVectors(home, pan, smooth(Math.min(1, this.sackOn)));
      this.sack.position.y += Math.sin(Math.PI * Math.min(1, this.sackOn)) * 0.12;
    }
    if (this.scale && this.state.scale) {
      const goal = this.state.scale.load ? this.state.scale.value * smooth(Math.min(1, this.sackOn)) : 0;
      const prev = this.needleShow;
      this.needleShow += (goal - this.needleShow) * Math.min(1, dt * 5);
      this.needle.rotation.z = this.needleAngle(this.needleShow) + Math.sin(t * 9) * Math.max(0, Math.abs(goal - prev) / (this.state.scale.max || 1)) * 0.6;
    }
    // the water rises (or falls) to its level
    if (this.jug && this.water && this.state.jug) {
      this.waterShow += (this.state.jug.value - this.waterShow) * Math.min(1, dt * (this.drag ? 12 : 4));
      const h = this.levelY(this.waterShow) - 0.02;
      this.water.scale.y = Math.max(0.0001, h);
      this.water.visible = h > 0.002;
    }
    // tiles drop in from above
    for (const tile of this.tiles) if (tile.visible && tile !== this.held && tile.userData.born > 0) {
      const k = Math.min(1, Math.max(0, (t - tile.userData.born) / 0.35));
      tile.position.y = 0.045 + (1 - smooth(k)) * 0.15;
      tile.scale.setScalar(0.6 + 0.4 * smooth(k));
    }
    for (const sp of this.cellSpots) if (sp.visible) (sp.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 5) * 0.35;
    for (const sp of this.sideSpots) if (sp.visible) (sp.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 5) * 0.35;
  }
  dispose() { this.drop(this.root); this.pins = []; }
  /** a 3D point on the page (pixels), for checking */
  toScreen(v: THREE.Vector3) { const p = v.clone().project(stage.camera); return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight }; }
}

// ---------- a pencil and a crayon, made at an exact length (metres), lying along x from 0 ----------
function pencil(L: number, r = 0.012) {
  const g = new THREE.Group();
  const tip = Math.min(L * 0.16, 0.05), era = Math.min(L * 0.1, 0.025), fer = Math.min(L * 0.06, 0.014), body = L - tip - era - fer;
  const yel = std(0xf7c531, { roughness: 0.45 });
  const b = mesh(new THREE.CylinderGeometry(r, r, body, 6).rotateZ(Math.PI / 2), yel); b.position.x = era + fer + body / 2; g.add(b);
  const wood = mesh(new THREE.CylinderGeometry(0.0001, r, tip * 0.75, 6).rotateZ(Math.PI / 2), std(0xe8c08a)); wood.position.x = L - tip * 0.625; wood.rotation.x = 0; g.add(wood);
  const lead = mesh(new THREE.CylinderGeometry(0.0001, r * 0.32, tip * 0.25, 8).rotateZ(Math.PI / 2), std(0x333333)); lead.position.x = L - tip * 0.125; g.add(lead);
  const f = mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, fer, 12).rotateZ(Math.PI / 2), std(0xc0c6cf, { metalness: 0.8, roughness: 0.3 })); f.position.x = era + fer / 2; g.add(f);
  const e = mesh(new THREE.CylinderGeometry(r, r, era, 12).rotateZ(Math.PI / 2), std(0xf28aa8, { roughness: 0.7 })); e.position.x = era / 2; g.add(e);
  g.position.y = r; g.rotation.x = Math.PI / 6;
  const out = new THREE.Group(); out.add(g); out.position.y = 0; return out;
}
function crayon(L: number, r = 0.014) {
  const g = new THREE.Group();
  const tip = Math.min(L * 0.14, 0.04), body = L - tip;
  const red = std(0xe2382f, { roughness: 0.5 });
  const b = mesh(new THREE.CylinderGeometry(r, r, body, 16).rotateZ(Math.PI / 2), red); b.position.x = body / 2; g.add(b);
  const wrap = mesh(new THREE.CylinderGeometry(r * 1.03, r * 1.03, body * 0.6, 16).rotateZ(Math.PI / 2), std(0xfbe3c4, { roughness: 0.8 })); wrap.position.x = body * 0.45; g.add(wrap);
  for (const k of [0.17, 0.73]) { const band = mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.05, 0.004, 16).rotateZ(Math.PI / 2), std(0x8a1a14)); band.position.x = body * k; g.add(band); }
  const t = mesh(new THREE.CylinderGeometry(r * 0.25, r, tip, 16).rotateZ(-Math.PI / 2), red); t.position.x = body + tip / 2; g.add(t);
  g.position.y = r;
  const out = new THREE.Group(); out.add(g); return out;
}
