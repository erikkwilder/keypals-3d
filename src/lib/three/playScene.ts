// The Number Playground's 3D stage: your buddy standing on an island, in front of a camera that looks
// straight across the trail, so a spot on the screen maps to a spot on the ground. The games call
// hopTo() to send the buddy hopping to the place on the screen where a number goes, and cheer(),
// oops() and dance() as things happen.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import type { Island } from './island';
import type { FriendId } from '../art/cast';
import type { RegionId } from '../engine/course';

export type View = { top: number; bottom: number; left: number; right: number };
/** `span`: metres across the view at the buddy (a wide number line, or a small box); `feetAt`: where the
 *  buddy's feet go in the view, 0 at its top to 1 at its bottom. */
type Opts = { buddy: FriendId; outfit: string; region: RegionId; view: View; spot?: number; span?: number; feetAt?: number };

export class PlayScene implements Controller {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  view: View;
  private base: THREE.Vector3; private t: THREE.Vector3; private n: THREE.Vector3;
  /** where the buddy is along the trail (metres from the spot), and where it's hopping to */
  private u = 0; private from = 0; private to = 0; private hopT = 1; private hopLen = 0.6;
  private busyUntil = 0; private now = 0;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private ready = false;
  /** metres of trail the view spans across, at the buddy */
  span = 8;
  feetAt = 0.9;

  private constructor(island: Island, me: Character, opts: Opts) {
    this.island = island; this.me = me; this.view = opts.view;
    this.span = opts.span ?? 8; this.feetAt = opts.feetAt ?? 0.9;
    const f = island.trail.at(opts.spot ?? 30);
    this.base = f.p.clone(); this.t = f.t.clone().setY(0).normalize(); this.n = f.n.clone().setY(0).normalize();
    me.root.visible = false;
    stage.scene.add(me.root);
    me.play('idle', 0);
  }

  static async create(opts: Opts): Promise<PlayScene> {
    const [island, me] = await Promise.all([stage.getIsland(opts.region), Character.create(opts.buddy)]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    await me.loadMoves();
    return new PlayScene(island, me, opts);
  }

  /** The ground point under a spot on the screen (fractions of the window), as metres along the trail. */
  uAt(sx: number, sy: number): number {
    const cam = stage.camera;
    const ndc = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), 0.5).unproject(cam);
    const dir = ndc.sub(cam.position).normalize();
    // the vertical plane through the trail, facing the camera
    const t = this.base.clone().sub(cam.position).dot(this.n) / Math.min(-1e-4, dir.dot(this.n));
    const hit = cam.position.clone().addScaledVector(dir, t);
    return hit.sub(this.base).dot(this.t);
  }
  /** Where the buddy stands on the screen now (fractions of the window). */
  screenX(): number { const p = this.me.root.position.clone().project(stage.camera); return (p.x + 1) / 2; }

  /** Hop to the place under a screen x (fraction of the window); `now` puts it there at once. */
  hopToScreen(sx: number, now = false) {
    const u = this.uAt(sx, this.view.top + this.feetAt * (this.view.bottom - this.view.top));
    if (now) { this.from = this.to = u; this.hopT = 1; } else this.hopTo(u);
  }
  hopTo(u: number) {
    this.from = this.posU(); this.to = u; this.hopT = 0;
    this.hopLen = Math.min(1.1, 0.45 + Math.abs(u - this.from) * 0.12);
    const name = this.me.has('jump') ? 'jump' : 'idle';
    const a = this.me.play(name, 0.15); a?.reset();
  }
  private posU() { return this.hopT >= 1 ? this.to : this.from + (this.to - this.from) * this.ease(this.hopT); }
  private ease(k: number) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  /** A happy moment on the spot. */
  cheer() { this.play(['cheer', 'fistpump', 'jump'], 1.6); }
  /** A little stumble. */
  oops() { this.play(['stumble', 'idle'], 1.0); }
  /** The finish dance. */
  dance(id: string) { this.play([id, 'fistpump'], 5); }
  private play(names: string[], secs: number) {
    const name = names.find(n => this.me.has(n));
    if (!name) return;
    const a = this.me.play(name, 0.2); a?.reset();
    this.busyUntil = this.now + secs;
  }

  update(dt: number, t: number) {
    this.now = t;
    const me = this.me;
    if (this.hopT < 1) this.hopT = Math.min(1, this.hopT + dt / this.hopLen);
    const u = this.posU();
    const p = this.base.clone().addScaledVector(this.t, u);
    p.y = this.island.height(p.x, p.z);
    if (this.hopT < 1) p.y += Math.sin(this.hopT * Math.PI) * (0.35 + Math.abs(this.to - this.from) * 0.04);
    me.root.position.copy(p);
    // face the way it's hopping, then turn back to the camera
    const facing = this.hopT < 1 && Math.abs(this.to - this.from) > 0.2 ? Math.atan2(this.t.x * Math.sign(this.to - this.from), this.t.z * Math.sign(this.to - this.from)) : Math.atan2(this.n.x, this.n.z);
    me.root.rotation.y += (facing - me.root.rotation.y) * Math.min(1, dt * 10);
    if (this.hopT >= 1 && this.now > this.busyUntil && me.currentName !== 'idle') me.play('idle', 0.4);
    me.update(dt);
    if (!me.root.visible) me.root.visible = true;
    this.camera(dt);
  }

  /** Move the view (the play area moved or the window changed size). */
  setView(v: View) { this.view = v; }

  private camera(dt: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandW = Math.max(0.2, v.right - v.left);
    const d = Math.max(4, this.span / (bandW * 2 * tanH * cam.aspect));
    const feet = this.base.clone();
    const wantPos = feet.clone().add(new THREE.Vector3(0, 0.7, 0)).addScaledVector(this.n, d).add(new THREE.Vector3(0, d * 0.06, 0));
    const aim = feet.clone();
    // the trail's spot (the buddy's feet) lands at the middle of the view across, and at feetAt down it
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * (v.top + this.feetAt * (v.bottom - v.top));
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    if (!this.ready) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.ready = true; }
    const k = 1 - Math.exp(-dt * 4);
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }

  focus() { return this.base; }
  dispose() { this.me.dispose(); }
}
