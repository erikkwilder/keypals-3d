// The Arcade's plaza: the painted terrace fills the screen and the real 3D buddy stands on it, waving
// you in. The camera is set so the buddy's feet land on a chosen spot on the screen at a chosen size
// (the cabinets are on the page, over the picture), so it works on any screen shape.
import * as THREE from 'three';
import { stage, type Controller } from '../stage';
import { Character } from '../character';
import { dressUp } from '../dress';
import { FRIEND, type FriendId } from '../../art/cast';
import type { Island } from '../island';
import { arcadeIsland, daylight, paintedBackground, shadowCatcher } from './kit';

export type Spot = { x: number; y: number; h: number };

export class PlazaScene implements Controller {
  fps = 30;
  readonly island: Island;
  readonly me: Character;
  /** where the buddy's feet go on the screen (0..1 across and down) and how tall it looks (a share of the screen's height) */
  spot: Spot = { x: 0.16, y: 0.9, h: 0.45 };
  private bg: { update(): void; dispose(): void };
  private sun: THREE.DirectionalLight;
  private floor: THREE.Mesh;
  private yaw = 0; private yawGoal = 0;
  private nextMove = 4;
  private busyUntil = 0;
  private t = 0;
  private constructor(island: Island, me: Character, bg: { update(): void; dispose(): void }) {
    this.island = island; this.me = me; this.bg = bg;
    this.sun = daylight(island.root, 4);
    this.floor = shadowCatcher(12, 12, 0.26);
    island.root.add(this.floor, me.root);
    me.root.visible = false;
    me.play('idle', 0);
  }

  static async create(buddy: FriendId, picture = 'arcade/bg-plaza.webp'): Promise<PlazaScene> {
    const [me, bg] = await Promise.all([Character.create(buddy), paintedBackground(picture, 0.5, 0.75)]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    const sc = new PlazaScene(arcadeIsland(), me, bg);
    void me.loadMoves();
    return sc;
  }

  /** A wave hello. */
  greet() { this.act('wave', 2.4); }
  /** A happy fist pump (a game picked). */
  cheer() { this.act(this.me.has('fistpump') ? 'fistpump' : 'jump', 1.8); }
  /** Turn a little toward a spot across the screen (0..1), or back to the front (null). */
  look(x: number | null) { this.yawGoal = x == null ? 0 : Math.max(-0.7, Math.min(0.7, (x - this.spot.x) * 1.4)); }
  private act(name: string, len: number) {
    if (!this.me.has(name)) return;
    const a = this.me.play(name, 0.25);
    if (a) { a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
    this.busyUntil = this.t + len;
  }

  update(dt: number, t: number) {
    this.t = t;
    this.bg.update();
    this.fit();
    if (t > this.busyUntil && this.me.currentName !== 'idle') this.me.play('idle', 0.4);
    if (t > this.nextMove) { this.nextMove = t + 7 + Math.random() * 6; if (t > this.busyUntil) this.act(Math.random() < 0.5 ? 'wave1' : 'wave', 2.4); }
    this.yaw += (this.yawGoal - this.yaw) * Math.min(1, dt * 4);
    this.me.root.rotation.y = this.yaw;
    this.me.update(dt);
    this.me.root.visible = true;
  }
  /** Set the camera so the feet land on the spot at the size wanted. */
  private fit() {
    const cam = stage.camera, fov = 30;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.position.set(0, 0, 0);
    cam.rotation.set(-0.2, 0, 0);
    cam.updateMatrixWorld(true);
    const r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(this.spot.x * 2 - 1, -(this.spot.y * 2 - 1)), cam);
    const dir = r.ray.direction;
    const H = FRIEND[this.me.id].height * 1.05;
    const dist = H / (2 * this.spot.h * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
    const ch = dist * Math.max(0.05, -dir.y);
    cam.position.set(0, ch, 0);
    cam.updateMatrixWorld(true);
    const feet = dir.clone().multiplyScalar(dist).add(new THREE.Vector3(0, ch, 0));
    feet.y = 0;
    this.me.root.position.copy(feet);
    this.floor.position.set(feet.x, 0, feet.z);
    this.sun.position.copy(feet).add(new THREE.Vector3(2.5, 6, 4));
    this.sun.target.position.copy(feet);
  }
  focus() { return this.me.root.position.clone(); }
  dispose() {
    this.me.dispose();
    this.bg.dispose();
    this.floor.geometry.dispose(); (this.floor.material as THREE.Material).dispose();
    this.island.root.removeFromParent();
  }
}
