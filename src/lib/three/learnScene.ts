// Learn's 3D stage: your buddy (the real one, dressed in what it wears) on the island, standing in a box
// on the screen (beside the lesson's board on a wide screen, above it on a phone), turned a little toward
// the board. It acts the lesson out: points at the board while it explains, nods along as things move,
// cheers when you get one, shrugs kindly when you don't, waves hello, and dances at the end.
//
// Over a math trip, a lesson borrows the stage (stage.swap) and gives it back when it closes: the trip's
// own things are hidden meanwhile and come back just as they were.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import { reach } from './ik';
import type { Island } from './island';
import { FRIEND, type FriendId } from '../art/cast';
import type { RegionId } from '../engine/course';

export type View = { top: number; bottom: number; left: number; right: number };

/** What a Learn screen can ask of the 3D buddy. */
export type LearnBuddy = {
  /** the box on screen the buddy stands in (its feet near the bottom) */
  area(el: HTMLElement | null): void;
  /** the thing it points at (the lesson's board) */
  board(el: HTMLElement | null): void;
  /** point at the board for a moment while it explains */
  point(secs?: number): void;
  /** a little nod: "see?" */
  nod(): void;
  cheer(): void;
  /** a kind shrug: "not quite, try again" */
  shrug(): void;
  wave(): void;
  dance(id: string): void;
};

type Opts = { buddy: FriendId; region: RegionId; view: View; spot?: number };
const smooth = (k: number) => k * k * (3 - 2 * k);

export class LearnScene implements Controller, LearnBuddy {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  view: View;
  /** what to point at, in screen fractions */
  private target = { x: 0.7, y: 0.45 };
  private areaEl: HTMLElement | null = null;
  private boardEl: HTMLElement | null = null;
  private base: THREE.Vector3; private n: THREE.Vector3; private right: THREE.Vector3;
  private now = 0; private busyUntil = 0;
  /** gesture timers: when each started and how long it lasts */
  private pointAt = -9; private pointFor = 0;
  private shrugAt = -9; private nodAt = -9;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private ready = false;
  private readonly H: number;
  private hidden: THREE.Object3D[] = [];

  private constructor(island: Island, me: Character, opts: Opts) {
    this.island = island; this.me = me; this.view = opts.view;
    this.H = FRIEND[opts.buddy].height ?? 1.2;
    const f = island.trail.at(opts.spot ?? 26);
    this.base = f.p.clone();
    this.n = f.n.clone().setY(0).normalize();
    this.right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), this.n).normalize();
    me.root.visible = false;
    me.root.rotation.y = Math.atan2(this.n.x, this.n.z);
    stage.scene.add(me.root);
    me.play('idle', 0);
  }

  static async create(opts: Opts): Promise<LearnScene> {
    const [island, me] = await Promise.all([stage.getIsland(opts.region), Character.create(opts.buddy)]);
    if (!me) throw new Error('character missing');
    await Promise.all([dressUp(me), me.loadMoves()]);
    return new LearnScene(island, me, opts);
  }

  // ---------- where things are on the screen ----------
  area(el: HTMLElement | null) { this.areaEl = el; this.fit(); }
  board(el: HTMLElement | null) { this.boardEl = el; this.fit(); }
  /** Read the boxes again (they move when the window changes or a phone scrolls). */
  fit() {
    const W = innerWidth || 1, Hh = innerHeight || 1;
    const a = this.areaEl?.getBoundingClientRect();
    if (a && a.width > 4 && a.height > 4) this.view = { top: a.top / Hh, bottom: a.bottom / Hh, left: a.left / W, right: a.right / W };
    const b = this.boardEl?.getBoundingClientRect();
    if (b && b.width > 4) {
      // the nearest part of the board: its left middle beside the buddy, its top middle under it
      const beside = b.left > (a?.right ?? 0) - 8;
      this.target = beside ? { x: (b.left + Math.min(80, b.width * 0.18)) / W, y: (b.top + b.height * 0.42) / Hh } : { x: (b.left + b.width * 0.5) / W, y: (b.top + 30) / Hh };
    }
  }

  // ---------- what it does ----------
  point(secs = 1.8) { if (this.now - this.pointAt > this.pointFor) { this.pointAt = this.now; this.pointFor = secs; } else this.pointFor = this.now - this.pointAt + secs; }
  nod() { this.nodAt = this.now; }
  /** (the fist pump first: the big cheer turns its back to you halfway through) */
  cheer() { this.pointFor = 0; this.play(['fistpump', 'jump', 'cheer'], 1.8); }
  shrug() { this.pointFor = 0; this.shrugAt = this.now; }
  wave() { this.play(['wave1', 'wave'], 2.2); }
  dance(id: string) { this.pointFor = 0; this.play([id, 'dance_happyhands', 'fistpump'], 6); }
  private play(names: string[], secs: number) {
    const name = names.find(n => this.me.has(n));
    if (!name) return;
    const a = this.me.play(name, 0.2); a?.reset();
    this.busyUntil = this.now + secs;
  }

  /** Hide what the trip left on the stage (its buddy, its ride) while a lesson borrows it. */
  hideOthers() {
    this.hidden = stage.scene.children.filter(o => o.visible && o !== this.me.root && o !== this.island.root && !(o as THREE.Light).isLight);
    for (const o of this.hidden) o.visible = false;
  }
  showOthers() { for (const o of this.hidden) o.visible = true; this.hidden = []; }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    const me = this.me;
    // the boxes move (a phone scrolls, the window changes): read them again every frame, it's cheap
    this.fit();
    const p = this.base.clone();
    p.y = this.island.height(p.x, p.z);
    me.root.position.copy(p);
    // face the camera, turned a little toward the board
    const toward = this.target.x > (this.view.left + this.view.right) / 2 ? 1 : this.target.y > this.view.bottom ? 0 : -1;
    // (`right` is the screen's right as the camera sees it)
    const face = this.n.clone().addScaledVector(this.right, 0.45 * toward).normalize();
    const yaw = Math.atan2(face.x, face.z);
    // turn the short way round (a turn across ±180° would spin it to face away)
    const dy = Math.atan2(Math.sin(yaw - me.root.rotation.y), Math.cos(yaw - me.root.rotation.y));
    me.root.rotation.y += dy * Math.min(1, dt * 6);
    if (this.now > this.busyUntil && me.currentName !== 'idle') me.play('idle', 0.4);
    me.update(dt);
    me.root.updateMatrixWorld(true);
    if (this.now > this.busyUntil) this.gestures();
    if (!me.root.visible) me.root.visible = true;
    this.camera(dt);
  }

  /** Point, shrug and nod on top of standing still (the arms reach with the same bones as the rides). */
  private gestures() {
    const B = this.me.bones, H = this.H;
    // pointing: the arm on the board's side reaches out toward it, then eases back
    const pk = this.pointFor > 0 ? Math.min(1, (this.now - this.pointAt) / 0.35, Math.max(0, (this.pointAt + this.pointFor - this.now) / 0.45)) : 0;
    if (pk > 0.01) {
      // the buddy faces the camera, so its left arm is on the screen's right
      const left = this.target.x >= (this.view.left + this.view.right) / 2 || this.target.y > this.view.bottom;
      const S = left ? 'Left' : 'Right';
      const arm = B[`${S}Arm`], fore = B[`${S}ForeArm`], hand = B[`${S}Hand`];
      if (arm && fore && hand) {
        const sh = arm.getWorldPosition(new THREE.Vector3());
        const want = this.worldAt(this.target.x, this.target.y, sh);
        const dir = want.sub(sh).normalize();
        const len = sh.distanceTo(fore.getWorldPosition(new THREE.Vector3())) + fore.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
        const tgt = sh.clone().addScaledVector(dir, len * 0.97);
        reach(arm, fore, hand, tgt, new THREE.Vector3(0, -1, 0), smooth(pk));
      }
    }
    // shrugging: both hands out and up a little, palms to the sky, the head tipped
    const sk = this.now - this.shrugAt < 1.3 ? Math.sin(((this.now - this.shrugAt) / 1.3) * Math.PI) : 0;
    if (sk > 0.01) {
      const fwd = this.me.root.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
      const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), fwd).normalize();
      for (const [S, s] of [['Left', 1], ['Right', -1]] as const) {
        const arm = B[`${S}Arm`], fore = B[`${S}ForeArm`], hand = B[`${S}Hand`];
        if (!arm || !fore || !hand) continue;
        const sh = arm.getWorldPosition(new THREE.Vector3());
        const tgt = sh.clone().addScaledVector(side, s * H * 0.26).addScaledVector(fwd, H * 0.16).add(new THREE.Vector3(0, -H * 0.1, 0));
        reach(arm, fore, hand, tgt, new THREE.Vector3(0, -1, 0).addScaledVector(fwd, -0.5), smooth(sk));
      }
      if (B.Head) { B.Head.rotateZ(0.22 * sk); B.Head.updateMatrixWorld(true); }
    }
    // nodding: "see?"
    const nk = this.now - this.nodAt < 0.6 ? Math.sin(((this.now - this.nodAt) / 0.6) * Math.PI * 2) : 0;
    if (Math.abs(nk) > 0.01 && B.Head) { B.Head.rotateX(0.16 * nk); B.Head.updateMatrixWorld(true); }
  }

  /** The point at a spot on the screen, at the buddy's own depth from the camera. */
  private worldAt(sx: number, sy: number, near: THREE.Vector3): THREE.Vector3 {
    const cam = stage.camera;
    const p = new THREE.Vector3(sx * 2 - 1, -(sy * 2 - 1), 0.5).unproject(cam);
    const dir = p.sub(cam.position).normalize();
    const camDir = cam.getWorldDirection(new THREE.Vector3());
    const depth = near.clone().sub(cam.position).dot(camDir);
    return cam.position.clone().addScaledVector(dir, depth / Math.max(1e-3, dir.dot(camDir)));
  }

  /** The buddy fills most of its box's height, feet near the bottom, in the middle across. */
  private camera(dt: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.12, v.bottom - v.top);
    const d = Math.max(2.2, (this.H * 1.4) / (bandH * 2 * tanH));
    const feet = this.base.clone(); feet.y = this.island.height(feet.x, feet.z);
    const wantPos = feet.clone().add(new THREE.Vector3(0, this.H * 0.55, 0)).addScaledVector(this.n, d).add(new THREE.Vector3(0, d * 0.05, 0));
    const aim = feet.clone();
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * (v.top + 0.93 * (v.bottom - v.top));
    const r = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    aim.addScaledVector(r, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    if (!this.ready) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.ready = true; }
    const k = 1 - Math.exp(-dt * 5);
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }

  focus() { return this.base; }
  dispose() { this.showOthers(); this.me.root.removeFromParent(); this.me.dispose(); }
}
