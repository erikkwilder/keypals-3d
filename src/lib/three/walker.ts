// The buddy walking the Adventure map: one small see-through canvas of its own that rides over the
// painted map (the game's big stage draws islands; this is one buddy, so it stays cheap on phones). Seen
// from the front and a little above, like the map's painting, it faces the way it goes: its back when it
// walks up the map, its face when it comes down. It walks, runs, stands about, hops at a fork and cheers
// at a find. The screen moves the canvas; this only draws the buddy in it.
import * as THREE from 'three';
import { Character } from './character';
import { dressUp } from './dress';
import { FRIEND, type FriendId } from '../art/cast';

export type Gait = 'idle' | 'walk' | 'run';
/** how far down the canvas the buddy's feet are (0 top, 1 bottom): the screen lines this up with the map */
export const FOOT_AT = 0.86;
/** how much of the canvas height the buddy fills */
const FILL = 0.55;
const PITCH = 0.42;

export class MapWalker {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  private me: Character | null = null;
  private shadow: THREE.Mesh;
  private height = 1.2;
  private yaw = 0;
  private want = 0;
  private gait: Gait = 'idle';
  private speedPx = 0;
  private idleT = 0;
  private hopT = -1;
  private cheerT = -1;
  private bumpT = -1;
  /** canvas pixels (CSS) for one metre, for matching the feet to the slide across the map */
  private pxPerM = 100;
  private cssH = 1;
  private skip = false;
  private acc = 0;
  private disposed = false;
  private own: { dispose(): void }[] = [];

  private constructor(private canvas: HTMLCanvasElement) {
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.setClearColor(0x000000, 0);
    this.renderer = r;
    // soft daylight like the paintings: sky from above, warm sun from the front left
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9a8a62, 2.1));
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.1); sun.position.set(-2, 4, 5); this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0xdfe9ff, 0.8); rim.position.set(3, 3, -4); this.scene.add(rim);
    // a soft round shadow under the feet
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d')!, grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(40,30,10,0.55)'); grad.addColorStop(0.6, 'rgba(40,30,10,0.25)'); grad.addColorStop(1, 'rgba(40,30,10,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
    const tex = this.keep(new THREE.CanvasTexture(cv));
    this.shadow = new THREE.Mesh(this.keep(new THREE.CircleGeometry(1, 24)), this.keep(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = 0.005;
    this.scene.add(this.shadow);
  }
  private keep<T extends { dispose(): void }>(x: T) { this.own.push(x); return x; }

  /** A walker for a buddy on a canvas (CSS size w by h). */
  static async create(canvas: HTMLCanvasElement, buddy: FriendId, w: number, h: number): Promise<MapWalker> {
    const s = new MapWalker(canvas);
    s.height = FRIEND[buddy]?.height ?? 1.2;
    s.resize(w, h);
    const me = await Character.create(buddy);
    if (s.disposed) { me?.dispose(); return s; }
    if (me) {
      s.me = me;
      me.play('idle', 0);
      s.scene.add(me.root);
      void dressUp(me);
    }
    return s;
  }

  /** The canvas's size on screen (CSS pixels). */
  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.cssH = h;
    // the buddy fills FILL of the height with its feet at FOOT_AT; a straight-on (orthographic) view, so
    // it's the same size wherever it walks
    const H = (this.height * Math.cos(PITCH)) / FILL, W = H * (w / Math.max(1, h));
    const c = this.camera;
    c.top = H * FOOT_AT; c.bottom = -H * (1 - FOOT_AT); c.left = -W / 2; c.right = W / 2;
    const D = 10;
    c.position.set(0, Math.sin(PITCH) * D, Math.cos(PITCH) * D);
    c.lookAt(0, 0, 0);
    c.updateProjectionMatrix();
    this.pxPerM = this.cssH / H;
    this.shadow.scale.setScalar(this.height * 0.3);
  }

  /** How it moves now: a gait, the way it heads on the map (screen x and y, y down), its speed in CSS
   *  pixels a second. */
  move(gait: Gait, dir: [number, number] | null, speedPx = 0) {
    this.gait = gait; this.speedPx = speedPx;
    if (dir && (dir[0] || dir[1])) this.want = Math.atan2(dir[0], dir[1]);
  }
  /** a little hop (at a fork) */
  hop() { if (this.hopT < 0) this.hopT = 0; }
  /** a happy cheer (a find, a win) */
  cheer() {
    this.cheerT = 0;
    const me = this.me;
    if (me && me.has('cheer')) { const a = me.play('cheer', 0.15); a?.reset(); }
    else this.hop();
  }
  /** a bump against a gate: a little shake */
  bump() { this.bumpT = 0; }

  /** Move on and draw (called every frame by the screen). Quieter frames while it just stands. */
  frame(dt: number) {
    const me = this.me;
    if (!me || this.disposed) return;
    const busy = this.gait !== 'idle' || this.hopT >= 0 || this.cheerT >= 0 || this.bumpT >= 0;
    // standing still: draw every other frame (its breathing is slow), half the work
    this.acc += dt;
    if (!busy) { this.skip = !this.skip; if (this.skip) return; }
    dt = Math.min(0.1, this.acc); this.acc = 0;
    // face the way it goes; after standing a moment, turn round to say hello
    if (this.gait === 'idle') { this.idleT += dt; if (this.idleT > 0.7) this.want = 0.25; } else this.idleT = 0;
    const d = Math.atan2(Math.sin(this.want - this.yaw), Math.cos(this.want - this.yaw));
    this.yaw += d * Math.min(1, dt * (this.gait === 'idle' ? 4 : 12));
    me.root.rotation.y = this.yaw;
    // the feet keep pace with the slide across the map
    if (this.cheerT >= 0) {
      this.cheerT += dt;
      if (this.cheerT > 1.6 || (me.currentName === 'cheer' && me.finished('cheer'))) { this.cheerT = -1; me.play('idle', 0.3); }
    } else if (this.gait === 'idle') me.play('idle', 0.25);
    else {
      const name = this.gait === 'run' && me.has('run') ? 'run' : 'walk';
      me.play(name, 0.2);
      const a = me.actions[name];
      if (a) a.timeScale = Math.max(0.6, Math.min(2.4, this.speedPx / this.pxPerM / (me.speedOf[name] || 1.5)));
    }
    // a hop: up and down with a little squash
    let y = 0, sq = 1;
    if (this.hopT >= 0) {
      this.hopT += dt;
      const k = this.hopT / 0.42;
      if (k >= 1) this.hopT = -1;
      else { y = Math.sin(k * Math.PI) * this.height * 0.2; sq = 1 + Math.sin(k * Math.PI * 2) * 0.05; }
    }
    let x = 0;
    if (this.bumpT >= 0) { this.bumpT += dt; x = Math.sin(this.bumpT * 40) * 0.04 * Math.max(0, 1 - this.bumpT / 0.35); if (this.bumpT > 0.35) this.bumpT = -1; }
    me.root.position.set(x, y, 0);
    me.root.scale.set(1 / sq, sq, 1 / sq);
    this.shadow.scale.setScalar(this.height * 0.3 * (1 - y / this.height));
    me.update(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    this.me?.dispose();
    for (const x of this.own) x.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
