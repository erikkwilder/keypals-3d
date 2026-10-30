// Treasure Grid in 3D: a see-through renderer of its own over the painted treasure cove (the game's stage
// is an island world; this game happens on one beach). A sandy dig pit in a driftwood frame lies on the
// beach with the treasure map's grid drawn in the sand (the axes as thick ropes, every line numbered).
// Tap a crossing and a gold ring marks it; dig, and sand flies: the painted chest pops up out of the sand
// in a burst of gold, or a sonar ping ripples out, red when close, blue when far. The tide
// creeps in over the map from the sea behind. Your buddy stands at the pit's corner, turning to watch
// each dig and cheering at every chest. A walk's flag stands on its start; a mirror's gem floats on the
// point to flip, over a glowing axis.
import * as THREE from 'three';
import { Fx } from './fx';
import { loadTexture } from './assets';
import { Character } from './character';
import { dressUp } from './dress';
import { FRIEND, type FriendId } from '../art/cast';
import type { GridSpec } from '../math/skills/types';
import type { Clue, Pt } from '../math/integers/treasure';

/** a map square, in world units */
const C = 0.5;
/** the margin round the grid for its numbers, in squares */
const MARGIN = 0.9;
const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
const backOut = (k: number) => { const s = 1.7; k = Math.min(1, Math.max(0, k)) - 1; return k * k * ((s + 1) * k + s) + 1; };
export type View = { top: number; bottom: number; left: number; right: number };
type Ping = { mesh: THREE.Mesh; t: number; delay: number };
type Hole = { mesh: THREE.Mesh; t: number };

export class TreasureScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  private fx = new Fx();
  private board = new THREE.Group();
  private sand: THREE.Mesh | null = null;
  private frame = new THREE.Group();
  private spec: GridSpec = { xMin: 0, xMax: 8, yMin: 0, yMax: 8 };
  private water: THREE.Mesh;
  private foam: THREE.Mesh;
  private tideK = 0; private tideShown = 0;
  private cursor: THREE.Mesh; private hoverRing: THREE.Mesh;
  private flag = new THREE.Group(); private gem: THREE.Mesh; private axisGlow: THREE.Mesh;
  private chest = new THREE.Group(); private chestT = -1;
  private pings: Ping[] = []; private holes: Hole[] = [];
  private me: Character | null = null;
  private meYaw = 0; private meYawGoal = 0; private busyUntil = 0;
  private mats: THREE.Material[] = [];
  private view: View = { top: 0.16, bottom: 0.84, left: 0.02, right: 0.98 };
  private raf = 0; private last = 0; private t = 0;
  private w = 1; private h = 1;
  tall = false;
  private ray = new THREE.Raycaster();
  private disposed = false;

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // a sunny beach: warm sun from the left, the sky above, a sandy bounce from below
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0xd9b27a, 1.6));
    const sun = new THREE.DirectionalLight(0xfff0d0, 2.4);
    sun.position.set(-4, 9, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 0.5, far: 30 });
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xbfe4ff, 0.7); rim.position.set(4, 3, -6); this.scene.add(rim);
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.2 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = -0.13; catcher.receiveShadow = true;
    this.scene.add(catcher);

    // the tide: clear blue water with a line of foam at its front
    const wm = new THREE.MeshStandardMaterial({ color: 0x35b5e2, transparent: true, opacity: 0.5, roughness: 0.15, metalness: 0.05, emissive: 0x0a4f7a, emissiveIntensity: 0.25 });
    const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false });
    this.mats.push(wm, fm);
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), wm);
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), fm);
    this.water.renderOrder = 2; this.foam.renderOrder = 3;

    // the marks: the chosen crossing (gold) and the one under the finger (faint)
    const gold = new THREE.MeshBasicMaterial({ color: 0xffc93a, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    const faint = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
    this.mats.push(gold, faint);
    this.cursor = new THREE.Mesh(new THREE.RingGeometry(C * 0.26, C * 0.4, 40).rotateX(-Math.PI / 2), gold);
    this.hoverRing = new THREE.Mesh(new THREE.RingGeometry(C * 0.22, C * 0.3, 32).rotateX(-Math.PI / 2), faint);
    this.cursor.visible = this.hoverRing.visible = false;
    this.cursor.renderOrder = this.hoverRing.renderOrder = 4;

    // a walk's flag: a pole and a red pennant
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.7, 10), this.mat(new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.7 })));
    pole.position.y = 0.35; pole.castShadow = true;
    const pen = new THREE.Shape(); pen.moveTo(0, 0); pen.lineTo(0.32, -0.09); pen.lineTo(0, -0.18); pen.lineTo(0, 0);
    const pennant = new THREE.Mesh(new THREE.ShapeGeometry(pen), this.mat(new THREE.MeshStandardMaterial({ color: 0xe8413a, roughness: 0.5, side: THREE.DoubleSide })));
    pennant.position.set(0.01, 0.69, 0); pennant.castShadow = true;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), this.mat(new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.6, roughness: 0.3 })));
    knob.position.y = 0.72;
    this.flag.add(pole, pennant, knob);
    this.flag.visible = false;
    // a mirror's gem, and the axis it flips over
    this.gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.13, 0), this.mat(new THREE.MeshStandardMaterial({ color: 0x9fe6ff, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2, emissive: 0x3aa8e0, emissiveIntensity: 0.6 })));
    this.gem.castShadow = true; this.gem.visible = false;
    this.axisGlow = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 0.06), this.mat(new THREE.MeshBasicMaterial({ color: 0x7fe0ff, transparent: true, opacity: 0.85, depthWrite: false })));
    this.axisGlow.visible = false;
    this.board.add(this.frame, this.water, this.foam, this.cursor, this.hoverRing, this.flag, this.gem, this.axisGlow, this.chest);
    this.scene.add(this.board, this.fx.root);
  }

  private mat<T extends THREE.Material>(m: T): T { this.mats.push(m); return m; }

  static async create(canvas: HTMLCanvasElement, buddy: FriendId): Promise<TreasureScene> {
    const s = new TreasureScene(canvas);
    s.buildChest(await loadTexture('math/integers/tile.webp').catch(() => null));
    s.setBoard(s.spec);
    s.resize();
    s.raf = requestAnimationFrame(s.tick);
    // the buddy comes when it has loaded (the game can start before)
    void Character.create(buddy).then(async me => {
      if (!me || s.disposed) return;
      await dressUp(me);
      if (s.disposed) return;
      s.me = me;
      me.root.scale.multiplyScalar(1.25);
      me.root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
      s.scene.add(me.root);
      me.play('idle', 0);
      s.placeBuddy();
      void me.loadMoves();
    }).catch(() => {});
    return s;
  }

  // ---------- the map ----------
  private get cx() { return (this.spec.xMin + this.spec.xMax) / 2; }
  private get cy() { return (this.spec.yMin + this.spec.yMax) / 2; }
  private get size() { return { w: (this.spec.xMax - this.spec.xMin + MARGIN * 2) * C, d: (this.spec.yMax - this.spec.yMin + MARGIN * 2) * C }; }
  /** a map crossing in the world */
  at(p: Pt, lift = 0): THREE.Vector3 { return new THREE.Vector3((p.x - this.cx) * C, lift, -(p.y - this.cy) * C); }

  /** Draw the map for a grid: the sand, its lines and numbers, and the driftwood frame. */
  setBoard(spec: GridSpec) {
    this.spec = spec;
    const { w, d } = this.size;
    // the sand with the map on it, drawn once on a canvas (sharp enough to read every number)
    const nx = spec.xMax - spec.xMin, ny = spec.yMax - spec.yMin, P = 112;
    const cv = document.createElement('canvas');
    cv.width = Math.round((nx + MARGIN * 2) * P); cv.height = Math.round((ny + MARGIN * 2) * P);
    const g = cv.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, cv.height);
    grad.addColorStop(0, '#f3ddab'); grad.addColorStop(1, '#ebcd92');
    g.fillStyle = grad; g.fillRect(0, 0, cv.width, cv.height);
    // grains of sand
    for (let i = 0; i < cv.width * cv.height / 90; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(160,110,50,0.10)' : 'rgba(255,255,240,0.35)';
      g.fillRect(Math.random() * cv.width, Math.random() * cv.height, 2 + Math.random() * 2, 2 + Math.random() * 2);
    }
    const X = (x: number) => (x - spec.xMin + MARGIN) * P, Y = (y: number) => (spec.yMax - y + MARGIN) * P;
    g.lineCap = 'round';
    for (let x = spec.xMin; x <= spec.xMax; x++) { if (x === 0) continue; g.strokeStyle = 'rgba(120,80,35,0.38)'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(x), Y(spec.yMax)); g.lineTo(X(x), Y(spec.yMin)); g.stroke(); }
    for (let y = spec.yMin; y <= spec.yMax; y++) { if (y === 0) continue; g.strokeStyle = 'rgba(120,80,35,0.38)'; g.lineWidth = 4; g.beginPath(); g.moveTo(X(spec.xMin), Y(y)); g.lineTo(X(spec.xMax), Y(y)); g.stroke(); }
    // the axes: thick rope lines with a darker twist, and arrow tips where they go on
    const rope = (x0: number, y0: number, x1: number, y1: number) => {
      g.strokeStyle = '#7a4a1e'; g.lineWidth = 13; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.strokeStyle = '#c99a5a'; g.lineWidth = 6; g.setLineDash([14, 12]); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
    };
    const ax = spec.xMin <= 0 && spec.xMax >= 0 ? 0 : spec.xMin, ay = spec.yMin <= 0 && spec.yMax >= 0 ? 0 : spec.yMin;
    rope(X(spec.xMin) - P * 0.35, Y(ay), X(spec.xMax) + P * 0.35, Y(ay));
    rope(X(ax), Y(spec.yMin) + P * 0.35, X(ax), Y(spec.yMax) - P * 0.35);
    const tip = (x: number, y: number, ang: number) => { g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = '#7a4a1e'; g.beginPath(); g.moveTo(16, 0); g.lineTo(-12, -14); g.lineTo(-12, 14); g.closePath(); g.fill(); g.restore(); };
    tip(X(spec.xMax) + P * 0.45, Y(ay), 0); tip(X(ax), Y(spec.yMax) - P * 0.45, -Math.PI / 2);
    if (spec.xMin < 0) tip(X(spec.xMin) - P * 0.45, Y(ay), Math.PI);
    if (spec.yMin < 0) tip(X(ax), Y(spec.yMin) + P * 0.45, Math.PI / 2);
    // the numbers along the axes, each with a soft white edge
    g.font = `700 ${Math.round(P * 0.38)}px "Fredoka", "Baloo 2", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const label = (s: string, x: number, y: number, col = '#5b3416') => { g.strokeStyle = 'rgba(255,248,230,0.95)'; g.lineWidth = 9; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
    const txt = (n: number) => (n < 0 ? `−${-n}` : String(n));
    for (let x = spec.xMin; x <= spec.xMax; x++) if (x !== ax || ax !== 0) label(txt(x), X(x) + (x === 0 ? -P * 0.26 : 0), Y(ay) + P * 0.42, x < 0 ? '#1f5f9e' : '#5b3416');
    for (let y = spec.yMin; y <= spec.yMax; y++) if (y !== 0 || ay !== 0) { if (y === ay && ax === spec.xMin && y === spec.yMin) continue; label(txt(y), X(ax) - P * 0.42, Y(y), y < 0 ? '#1f5f9e' : '#5b3416'); }
    if (ax === 0 && ay === 0) label('0', X(0) - P * 0.3, Y(0) + P * 0.36);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    if (this.sand) {
      this.board.remove(this.sand); this.sand.geometry.dispose();
      // (only the top, with the map drawn on it, is the sand's own; the sides are shared and kept)
      const top = (this.sand.material as THREE.MeshStandardMaterial[])[2]; top.map?.dispose(); top.dispose();
    }
    this.sand = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), [
      this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b57a, roughness: 0.95 })), this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b57a, roughness: 0.95 })),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92 }), this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b57a })),
      this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b57a })), this.mat(new THREE.MeshStandardMaterial({ color: 0xd8b57a })),
    ]);
    this.sand.position.y = -0.05; this.sand.receiveShadow = true;
    this.board.add(this.sand);
    // driftwood round the edge, with posts at the corners
    this.frame.clear();
    const wood = this.mat(new THREE.MeshStandardMaterial({ color: 0xa8784a, roughness: 0.85 }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }));
    const plank = (pw: number, pd: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.16, pd), wood); m.position.set(x, 0, z); m.castShadow = true; m.receiveShadow = true; this.frame.add(m); };
    plank(w + 0.36, 0.18, 0, -d / 2 - 0.09); plank(w + 0.36, 0.18, 0, d / 2 + 0.09); plank(0.18, d, -w / 2 - 0.09, 0); plank(0.18, d, w / 2 + 0.09, 0);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.42, 12), dark);
      post.position.set(sx * (w / 2 + 0.09), 0.13, sz * (d / 2 + 0.09)); post.castShadow = true; this.frame.add(post);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.mat(new THREE.MeshStandardMaterial({ color: 0xffd36b, metalness: 0.5, roughness: 0.35 })));
      cap.position.set(sx * (w / 2 + 0.09), 0.36, sz * (d / 2 + 0.09)); this.frame.add(cap);
    }
    // shells and a starfish on the frame
    const shell = this.mat(new THREE.MeshStandardMaterial({ color: 0xffd6c9, roughness: 0.5 }));
    for (const [x, z, s] of [[-w / 2 + 0.4, d / 2 + 0.1, 0.07], [w / 2 - 0.6, d / 2 + 0.1, 0.06], [w / 2 + 0.09, -d / 4, 0.065]] as [number, number, number][]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shell); m.position.set(x, 0.08, z); m.scale.set(1, 0.6, 1.2); this.frame.add(m);
    }
    this.water.scale.set(w, 1, 0.001); this.water.position.set(0, 0.012, -d / 2);
    this.foam.scale.set(w, 1, 0.06);
    this.placeBuddy();
    this.resize();
  }

  // ---------- the buddy ----------
  private placeBuddy() {
    if (!this.me) return;
    const { w, d } = this.size;
    // beside the pit's front corner on a wide screen; behind the pit, by the sea, on a phone
    if (this.tall) this.me.root.position.set(w * 0.28, 0, -d / 2 - 0.55);
    else this.me.root.position.set(-w / 2 - 0.75, 0, d / 2 - 0.9);
    this.meYawGoal = this.tall ? 0 : 0.5;
  }
  private act(name: string, len: number) {
    const me = this.me; if (!me || !me.has(name)) return;
    const a = me.play(name, 0.2);
    if (a) { a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    this.busyUntil = this.t + len;
  }
  /** The buddy turns to look at a crossing. */
  private lookAt(p: Pt) {
    if (!this.me) return;
    const v = this.at(p).sub(this.me.root.position);
    this.meYawGoal = Math.atan2(v.x, v.z);
  }
  cheer() { this.act(this.me?.has('fistpump') ? 'fistpump' : 'jump', 1.8); }
  sad() { this.act(this.me?.has('defeated') ? 'defeated' : 'stumble', 1.6); }

  // ---------- the clue's things on the map ----------
  setClue(c: Clue | null) {
    this.flag.visible = !!c && c.kind === 'walk';
    if (c?.kind === 'walk') this.flag.position.copy(this.at(c.from!));
    this.gem.visible = !!c && c.kind === 'flip';
    this.axisGlow.visible = !!c && c.kind === 'flip';
    if (c?.kind === 'flip') {
      this.gem.position.copy(this.at(c.from!, 0.32));
      const { w, d } = this.size;
      if (c.axis === 'x') { this.axisGlow.scale.set(w - C * 0.6, 1, 1); this.axisGlow.rotation.y = 0; this.axisGlow.position.copy(this.at({ x: this.cx, y: 0 }, 0.03)); }
      else { this.axisGlow.scale.set(d - C * 0.6, 1, 1); this.axisGlow.rotation.y = Math.PI / 2; this.axisGlow.position.copy(this.at({ x: 0, y: this.cy }, 0.03)); }
    }
    if (c) { this.tideK = 0; this.lookAt(c.kind === 'point' ? c.at : c.from!); }
  }
  /** How far the tide has come in (0 none, 1 the whole map). */
  tide(k: number) { this.tideK = Math.max(0, Math.min(1, k)); }

  /** The crossing under a point on the screen (null: off the map). */
  pick(clientX: number, clientY: number): Pt | null {
    const r = this.canvas.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), this.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return null;
    const x = Math.round(hit.x / C + this.cx), y = Math.round(-hit.z / C + this.cy);
    // a little past the edge still counts (a fat finger), further doesn't
    if (Math.abs(hit.x / C + this.cx - x) > 0.6 || Math.abs(-hit.z / C + this.cy - y) > 0.6) return null;
    if (x < this.spec.xMin || x > this.spec.xMax || y < this.spec.yMin || y > this.spec.yMax) return null;
    return { x, y };
  }
  select(p: Pt | null) { this.cursor.visible = !!p; if (p) this.cursor.position.copy(this.at(p, 0.025)); }
  hover(p: Pt | null) { this.hoverRing.visible = !!p; if (p) this.hoverRing.position.copy(this.at(p, 0.02)); }
  /** Where a crossing is on the screen (px in the canvas). */
  screenOf(p: Pt, lift = 0): { x: number; y: number } {
    const v = this.at(p, lift).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * this.w, y: (-v.y * 0.5 + 0.5) * this.h };
  }

  // ---------- digging ----------
  /** Dig here: sand flies; the chest comes up when it's `found`, else a sonar ping of this heat (0 far, 1 close). */
  dig(p: Pt, found: boolean, heat = 0) {
    const at = this.at(p, 0.04);
    this.lookAt(p);
    this.fx.emit({ at, count: 34, shape: ['pebble', 'dot'], color: [0xe9c88a, 0xd4a862, 0xfff1cf], speed: [0.8, 2.2], up: 1.6, spread: 0.8, life: [0.4, 0.8], size: [0.03, 0.07], gravity: 6, drag: 0.6 });
    if (found) {
      this.chest.position.copy(this.at(p, 0)); this.chest.visible = true; this.chestT = 0;
      setTimeout(() => {
        if (this.disposed) return;
        this.fx.emit({ at: this.at(p, 0.35), count: 60, shape: ['star', 'spark', 'dot'], color: [0xffd36b, 0xfff1a8, 0xffffff, 0x9fe6ff], speed: [1.2, 3.2], up: 2.4, life: [0.6, 1.3], size: [0.05, 0.13], gravity: 3, drag: 0.7, spin: 4 });
        this.fx.beam(this.at(p, 0), 0xffe08a, { radius: 0.3, height: 2.2, life: 1.1, peak: 0.8 });
      }, 380);
      this.cheer();
      return;
    }
    // a hole left in the sand, and the sonar rings
    const hole = new THREE.Mesh(new THREE.CircleGeometry(C * 0.24, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9a6a36, transparent: true, opacity: 0.7, depthWrite: false }));
    hole.position.copy(this.at(p, 0.008)); hole.renderOrder = 1;
    this.board.add(hole); this.holes.push({ mesh: hole, t: 0 });
    const col = new THREE.Color(0x4ab0ff).lerp(new THREE.Color(0xff5a3c), heat);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
      ring.position.copy(this.at(p, 0.03)); ring.scale.setScalar(0.001); ring.renderOrder = 5;
      this.board.add(ring); this.pings.push({ mesh: ring, t: 0, delay: i * 0.22 });
    }
    if (heat < 0.3) this.sad();
  }
  /** The tide washed the chest away: a splash over the spot. */
  washed(p: Pt) {
    this.fx.emit({ at: this.at(p, 0.1), count: 40, shape: ['drop', 'dot'], color: [0x9fe6ff, 0xffffff, 0x35b5e2], speed: [1, 2.6], up: 2, life: [0.5, 0.9], size: [0.05, 0.1], gravity: 5, drag: 0.5 });
    this.sad();
  }
  /** Ready for the next clue: the chest sinks, the holes fill in, the tide goes out. */
  clear() {
    this.chestT = this.chest.visible ? Math.max(this.chestT, 1) : -1;
    this.tideK = 0;
    for (const h of this.holes) h.t = Math.max(h.t, 2.5);
  }

  /** The chest: the painted treasure chest (the game's own picture, math/integers/tile.webp) standing up
   *  out of the sand as a card that always faces you, so it looks exactly as painted. */
  private buildChest(tex: THREE.Texture | null) {
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(this.mat(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: tex ? 0xffffff : 0xc9883a })));
    sp.center.set(0.5, 0.08);
    sp.scale.set(1.5, 1.41, 1);
    sp.renderOrder = 6;
    this.chestSprite = sp;
    this.chest.add(sp);
    this.chest.visible = false;
  }
  private chestSprite: THREE.Sprite | null = null;

  // ---------- the camera ----------
  setView(v: View) { this.view = v; this.fit(); }
  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    const wasTall = this.tall;
    this.tall = w / h < 0.9;
    if (wasTall !== this.tall) this.placeBuddy();
    this.fx.setScale(h, this.camera.fov);
    this.fit();
  }
  /** Set the camera so the whole pit fits the view's box, as big as it can, centred in it. */
  private fit() {
    const cam = this.camera, { w, d } = this.size;
    cam.aspect = this.w / this.h; cam.fov = this.tall ? 46 : 38;
    cam.clearViewOffset();
    const pitch = THREE.MathUtils.degToRad(this.tall ? 70 : 52);
    const dir = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].flatMap(([sx, sz]) => [new THREE.Vector3(sx * (w / 2 + 0.2), 0.18, sz * (d / 2 + 0.2)), new THREE.Vector3(sx * (w / 2 + 0.2), -0.1, sz * (d / 2 + 0.2))]);
    const box = () => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const c of corners) { const p = c.clone().project(cam); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); } return { x0, x1, y0, y1 }; };
    const vw = (this.view.right - this.view.left) * 2, vh = (this.view.bottom - this.view.top) * 2;
    let lo = 2, hi = 60;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      cam.position.copy(dir).multiplyScalar(mid); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      const b = box();
      if (b.x1 - b.x0 <= vw && b.y1 - b.y0 <= vh) hi = mid; else lo = mid;
    }
    cam.position.copy(dir).multiplyScalar(hi); cam.lookAt(0, 0, 0); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    // shift the picture so the pit sits in the middle of the view's box
    const b = box();
    const want = { x: (this.view.left + this.view.right) - 1, y: 1 - (this.view.top + this.view.bottom) };
    const off = { x: ((b.x0 + b.x1) / 2 - want.x) * 0.5 * this.w, y: -((b.y0 + b.y1) / 2 - want.y) * 0.5 * this.h };
    cam.setViewOffset(this.w, this.h, off.x, off.y, this.w, this.h);
    cam.updateProjectionMatrix();
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, this.last ? (now - this.last) / 1000 : 0.016);
    this.last = now; this.t += dt;
    const { w, d } = this.size;
    // the tide eases toward where it should be, with a little swell
    this.tideShown += (this.tideK - this.tideShown) * Math.min(1, dt * (this.tideK < this.tideShown ? 2.5 : 5));
    const reach = Math.max(0.001, this.tideShown * d + Math.sin(this.t * 1.6) * 0.03 * (this.tideShown > 0.01 ? 1 : 0));
    this.water.scale.set(w, 1, reach);
    this.water.visible = this.foam.visible = this.tideShown > 0.005;
    this.foam.position.set(0, 0.016, -d / 2 + reach);
    (this.foam.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(this.t * 3) * 0.25;
    // the marks breathe
    const s = 1 + Math.sin(this.t * 5) * 0.08;
    this.cursor.scale.setScalar(s);
    this.gem.rotation.y += dt * 1.5; this.gem.position.y = 0.32 + Math.sin(this.t * 2.2) * 0.04;
    this.flag.rotation.y = Math.sin(this.t * 1.3) * 0.15;
    // the chest: pops up out of the sand with a bounce and a little wobble; later it sinks away
    if (this.chestT >= 0 && this.chestSprite) {
      this.chestT += dt;
      const k = this.chestT < 1.6 ? backOut(this.chestT / 0.45) : 1 - ease((this.chestT - 1.6) / 0.45);
      this.chestSprite.scale.set(1.5 * Math.max(0.01, k), 1.41 * Math.max(0.01, k) * (1 + Math.sin(this.chestT * 9) * 0.04 * Math.max(0, 1 - this.chestT)), 1);
      this.chest.position.y = Math.max(0, Math.sin(Math.min(1, this.chestT / 0.45) * Math.PI)) * 0.25;
      this.chestSprite.material.rotation = Math.sin(this.chestT * 7) * 0.08 * Math.max(0, 1 - this.chestT / 1.2);
      if (this.chestT > 2.05) { this.chest.visible = false; this.chestT = -1; }
    }
    for (const p of this.pings) {
      p.t += dt;
      const k = Math.max(0, (p.t - p.delay) / 1.1);
      p.mesh.scale.setScalar(Math.max(0.001, k * C * 3.2));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }
    for (const p of this.pings.filter(x => x.t - x.delay > 1.1)) { this.board.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); }
    this.pings = this.pings.filter(x => x.t - x.delay <= 1.1);
    for (const h of this.holes) { h.t += dt; (h.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - Math.max(0, (h.t - 2.5) / 0.6)); }
    for (const h of this.holes.filter(x => x.t > 3.1)) { this.board.remove(h.mesh); h.mesh.geometry.dispose(); (h.mesh.material as THREE.Material).dispose(); }
    this.holes = this.holes.filter(x => x.t <= 3.1);
    if (this.me) {
      if (this.t > this.busyUntil && this.me.currentName !== 'idle') this.me.play('idle', 0.4);
      this.meYaw += (this.meYawGoal - this.meYaw) * Math.min(1, dt * 4);
      this.me.root.rotation.y = this.meYaw;
      this.me.update(dt);
    }
    this.fx.update(dt, this.t);
    this.renderer.render(this.scene, this.camera);
  };

  /** the buddy's height on the screen, for the HUD to keep clear of it */
  get buddyHeight() { return this.me ? FRIEND[this.me.id].height * 1.25 : 0; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.me?.dispose();
    this.fx.dispose();
    this.scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach(x => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); }); } });
    this.mats.forEach(m => m.dispose());
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
