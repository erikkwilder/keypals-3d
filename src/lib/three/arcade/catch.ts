// Glimmer Catch: Glimmers float down over a sunny meadow, each carrying a sum on a little sign. The buddy
// runs along the bottom with a butterfly net; catch the ones that make the number on the card. The
// meadow is a painting filling the screen; the buddy and the Glimmers are the real 3D ones, standing
// and falling on a flat field in front of it. The field is sized to the screen (narrow on a phone).
import * as THREE from 'three';
import { stage, type Controller } from '../stage';
import { Character } from '../character';
import { dressUp } from '../dress';
import { wearGear } from '../gear3d';
import { GlimmerModel } from '../glimmerModel';
import { Fx } from '../fx';
import type { Island } from '../island';
import type { FriendId } from '../../art/cast';
import type { GlimmerId } from '../../adventure/glimmers';
import type { Fact } from '../../math/facts';
import { factText } from '../../arcade/arcade';
import { arcadeIsland, daylight, disposeSprite, fontLoaded, paintedBackground, plaqueSprite, shadowCatcher } from './kit';

const KINDS: GlimmerId[] = ['popcornpuff', 'sproutbun', 'puddlepup', 'bubbleocto', 'mushmouse', 'frostjelly', 'sunsnail', 'rainbootfrog'];
const POOL = 12;
const FOV = 40;

export type Drop = { f: Fact; right: boolean; gold: boolean; x: number; secs: number };
type Falling = Drop & { g: GlimmerModel; label: THREE.Sprite; y: number; vy: number; born: number; state: 'fall' | 'caught' | 'bonk' | 'land'; k: number; turn: number; seed: number };

export class CatchScene implements Controller {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  paused = false;
  running = false;
  /** the field: half its width, the top (where Glimmers start) and the height of the net */
  field = { half: 6, top: 6, net: 1.35 };
  /** where the buddy is, and where it's heading */
  x = 0; goal = 0;
  private vx = 0;
  /** one reached the net: which, where on the screen (0..1), and how long it had been falling (seconds) */
  onCatch: ((d: Drop, at: { x: number; y: number }, age: number) => void) | null = null;
  private free: GlimmerModel[] = [];
  private gold: GlimmerModel | null = null;
  private falling: Falling[] = [];
  private fx = new Fx();
  private bg: { update(): void; dispose(): void };
  private floor: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private t = 0;
  private busyUntil = 0;
  private aspect = 0;
  private constructor(island: Island, me: Character, pool: GlimmerModel[], gold: GlimmerModel | null, bg: { update(): void; dispose(): void }) {
    this.island = island; this.me = me; this.free = pool; this.gold = gold; this.bg = bg;
    const root = island.root;
    this.sun = daylight(root, 9, new THREE.Vector3(3, 12, 8));
    this.floor = shadowCatcher(40, 10, 0.24);
    root.add(this.floor, me.root, this.fx.root);
    for (const g of [...pool, ...(gold ? [gold] : [])]) { g.root.visible = false; root.add(g.root); }
    if (gold) gold.fx = this.fx;
    me.root.visible = false;
    me.play('idle', 0);
  }

  static async create(o: { buddy: FriendId }): Promise<CatchScene> {
    await fontLoaded();
    const [me, bg, ...pool] = await Promise.all([
      Character.create(o.buddy), paintedBackground('arcade/bg-catch.webp', 0.4, 0.85),
      ...Array.from({ length: POOL }, (_, i) => GlimmerModel.create(KINDS[i % KINDS.length], 0.95)),
    ]);
    if (!me) throw new Error('character missing');
    const gold = await GlimmerModel.create('sparkmoth', 1.05, { evolved: true }).catch(() => null);
    await dressUp(me);
    await wearGear(me, 'hand', 'butterfly_net');
    void me.loadMoves();
    return new CatchScene(arcadeIsland(), me, pool, gold, bg);
  }

  // ---------- the game's side ----------
  /** Send a Glimmer down: it takes `secs` to reach the net. */
  drop(d: Drop) {
    const g = d.gold ? (this.gold && !this.falling.some(f => f.g === this.gold) ? this.gold : null) : this.free.splice(Math.floor(Math.random() * this.free.length), 1)[0];
    if (!g) return false;
    const label = plaqueSprite(factText(d.f), 0.55, d.gold ? { bg: ['#fff6c8', '#ffd84a'], ink: '#7a4a00', edge: '#fff4b0', glow: 'rgba(255,200,40,0.8)' } : { bg: ['#ffffff', '#efe8ff'], ink: '#2a1f45', edge: '#ffffff', glow: 'rgba(90,60,160,0.35)' });
    this.island.root.add(label);
    const y = this.field.top + 0.6;
    const x = Math.max(-this.field.half + 0.5, Math.min(this.field.half - 0.5, d.x * this.field.half));
    g.root.visible = true;
    g.root.scale.setScalar(1);
    g.root.rotation.set(0, (Math.random() - 0.5) * 0.8, 0);
    g.play('appear');
    this.falling.push({ ...d, x, g, label, y, vy: (y - this.field.net) / d.secs, born: this.t, state: 'fall', k: 0, turn: (Math.random() - 0.5) * 0.6, seed: Math.random() * 6 });
    return true;
  }
  /** Clear every Glimmer still falling (a new number): they float up and away. */
  clear() { for (const f of this.falling) if (f.state === 'fall') { f.state = 'land'; f.k = 0; f.vy = -2.5; } }
  /** How many are still falling. */
  get count() { return this.falling.filter(f => f.state === 'fall').length; }
  /** Steer: run toward a spot (-1..1 across the field) or nudge by a step. */
  runTo(x: number) { this.goal = Math.max(-1, Math.min(1, x)) * (this.field.half - 0.4); }
  nudge(dir: -1 | 1) { this.goal = Math.max(-this.field.half + 0.4, Math.min(this.field.half - 0.4, this.goal + dir * 1.6)); }
  hold(dir: -1 | 0 | 1) { this.holding = dir; }
  private holding: -1 | 0 | 1 = 0;
  /** The buddy on the screen (0..1 across), for the touch controls. */
  screenX(x: number) { const v = new THREE.Vector3(x, 0, 0).project(stage.camera); return (v.x + 1) / 2; }
  /** Screen spot (0..1) to field (-1..1). */
  fieldX(sx: number) {
    const cam = stage.camera, r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(sx * 2 - 1, 0), cam);
    const t = -r.ray.origin.z / r.ray.direction.z;
    return r.ray.origin.x + r.ray.direction.x * t;
  }

  /** A cheer for a golden one, a stumble for a wrong one. */
  react(kind: 'gold' | 'right' | 'wrong' | 'done') {
    const me = this.me;
    const name = kind === 'gold' ? (me.has('fistpump') ? 'fistpump' : 'jump') : kind === 'wrong' ? 'stumble' : kind === 'done' ? 'cheer' : '';
    if (!name || !me.has(name)) return;
    const a = me.play(name, 0.15);
    if (a) { a.reset(); a.setLoop(kind === 'done' ? THREE.LoopRepeat : THREE.LoopOnce, kind === 'done' ? Infinity : 1); a.clampWhenFinished = true; }
    this.busyUntil = this.t + (kind === 'done' ? 99 : kind === 'wrong' ? 0.9 : 1.2);
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.t = t;
    this.bg.update();
    this.fit();
    const me = this.me;
    if (!this.paused) {
      // the buddy runs toward the goal (arrows held move the goal along)
      if (this.holding) this.goal = Math.max(-this.field.half + 0.4, Math.min(this.field.half - 0.4, this.goal + this.holding * dt * 7.5));
      const d = this.goal - this.x;
      const want = Math.max(-8, Math.min(8, d * 9));
      this.vx += (want - this.vx) * Math.min(1, dt * 14);
      if (Math.abs(d) < 0.02 && Math.abs(this.vx) < 0.3) this.vx = 0;
      this.x += this.vx * dt;
      // glimmers
      for (const f of this.falling) this.step(f, dt, t);
      this.falling = this.falling.filter(f => {
        if (f.state === 'fall') return true;
        if (f.k < (f.state === 'land' ? 1.4 : 0.6)) return true;
        this.retire(f);
        return false;
      });
    }
    // the buddy: runs while moving, faces where it's going, faces you when still
    const moving = Math.abs(this.vx) > 0.6;
    if (t > this.busyUntil) {
      if (moving) { const a = me.play(Math.abs(this.vx) > 4 ? 'sprint' : 'run', 0.15); if (a) a.timeScale = Math.min(1.6, 0.7 + Math.abs(this.vx) / 8); }
      else if (this.running || me.currentName !== 'cheer') me.play('idle', 0.25);
    }
    const yaw = moving && t > this.busyUntil ? Math.sign(this.vx) * Math.PI * 0.42 : 0;
    me.root.rotation.y += (yaw - me.root.rotation.y) * Math.min(1, dt * 12);
    me.root.position.set(this.x, 0, 0.6);
    me.update(dt);
    me.root.visible = true;
    this.floor.position.set(0, 0, 0);
    this.sun.position.set(this.x + 3, 12, 8); this.sun.target.position.set(this.x, 0, 0);
    this.fx.update(dt, t);
  }
  private step(f: Falling, dt: number, t: number) {
    f.k += dt;
    const g = f.g;
    if (f.state === 'fall') {
      f.y -= f.vy * dt;
      const sway = Math.sin(t * 1.6 + f.seed) * 0.25;
      g.root.position.set(f.x + sway, f.y, 0);
      g.root.rotation.y += (Math.sin(t * 1.2 + f.seed) * 0.5 - g.root.rotation.y) * dt * 2;
      g.root.rotation.z = Math.sin(t * 2.2 + f.seed) * 0.12;
      // in reach of the net?
      const nx = this.x + Math.sign(this.vx || 1) * 0.15;
      if (f.y < this.field.net + 0.5 && f.y > this.field.net - 0.6 && Math.abs(g.root.position.x - nx) < 0.75) {
        f.state = f.right ? 'caught' : 'bonk'; f.k = 0;
        const at = g.root.position.clone().add(new THREE.Vector3(0, 0.4, 0));
        if (f.right) {
          this.fx.emit({ at, count: f.gold ? 70 : 30, shape: ['star', 'spark', 'heart'], color: f.gold ? [0xffd84a, 0xffffff, 0xffb81f] : [0xffe066, 0xffffff, 0xb388ff, 0x8fd3ff], speed: [1.5, f.gold ? 5 : 3.5], radius: 0.3, life: [0.5, 1.1], size: [0.12, 0.28], drag: 1.4, up: 0.4 });
          g.play('happy');
        } else {
          this.fx.emit({ at, count: 14, shape: ['star'], color: [0xffffff, 0xffe066], speed: [0.8, 1.6], radius: 0.2, life: [0.5, 0.9], size: [0.1, 0.18], drag: 1, up: 0.5 });
          g.play('hit');
        }
        const v = at.clone().project(stage.camera);
        this.onCatch?.(f, { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }, t - f.born);
      } else if (f.y < -0.2) { f.state = 'land'; f.k = 0; f.vy = 0; this.fx.emit({ at: new THREE.Vector3(g.root.position.x, 0.1, 0), count: 8, shape: ['petal', 'dot'], color: [0xffffff, 0xffd1e8], speed: [0.5, 1.4], up: 0.6, life: [0.4, 0.8], size: [0.08, 0.14], gravity: 2 }); }
    } else if (f.state === 'caught') {
      // into the net: shrink with a twirl toward the buddy
      const k = Math.min(1, f.k / 0.5);
      g.root.position.lerp(this.me.root.position.clone().add(new THREE.Vector3(0, 1.3, 0)), Math.min(1, dt * 10));
      g.root.scale.setScalar(Math.max(0.01, 1 - k));
      g.root.rotation.y += dt * 12;
    } else if (f.state === 'bonk') {
      // bounced off the net, a little dizzy, and floats off
      g.root.position.x += (g.root.position.x > this.x ? 1 : -1) * dt * 3;
      g.root.position.y += dt * 2.5 * (1 - f.k);
      g.root.rotation.z = Math.sin(f.k * 20) * 0.3;
      g.root.scale.setScalar(Math.max(0.01, 1 - f.k / 0.6));
    } else {
      // landed in the flowers (or cleared away): fade down
      if (f.vy < 0) g.root.position.y -= f.vy * dt; else g.root.position.y = Math.max(-0.3, g.root.position.y - dt * 0.4);
      g.root.scale.setScalar(Math.max(0.01, 1 - f.k / 1.4));
    }
    // the sign rides under the Glimmer (gone once it's caught)
    f.label.visible = f.state === 'fall';
    f.label.position.set(g.root.position.x, g.root.position.y - 0.36, 0.3);
    g.update(dt, t);
  }
  private retire(f: Falling) {
    disposeSprite(f.label); f.label.removeFromParent();
    f.g.root.visible = false;
    if (f.g !== this.gold) this.free.push(f.g);
  }
  /** Fit the camera to the screen: the field fills the width; the ground sits low on the screen. */
  private fit() {
    const cam = stage.camera, a = cam.aspect;
    if (cam.fov !== FOV) { cam.fov = FOV; cam.updateProjectionMatrix(); }
    if (a === this.aspect) return;
    this.aspect = a;
    const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const half = Math.max(2.4, Math.min(5.2, a * 3.3));
    const D = half / (tn * a);
    // the ground 84% of the way down the screen; the field's top just under the number card
    const ch = 0.68 * D * tn;
    cam.position.set(0, ch, D);
    cam.lookAt(0, ch, 0);
    this.field.half = half * 0.92;
    this.field.top = ch + (a < 0.8 ? 0.42 : 0.5) * D * tn;
    this.x = Math.max(-this.field.half, Math.min(this.field.half, this.x));
    this.goal = Math.max(-this.field.half, Math.min(this.field.half, this.goal));
    this.fx.setScale(innerHeight, FOV);
  }
  focus() { return this.me.root.position.clone(); }
  dispose() {
    for (const f of this.falling) { disposeSprite(f.label); f.label.removeFromParent(); }
    for (const g of this.free) g.dispose();
    this.gold?.dispose();
    for (const f of this.falling) if (f.g !== this.gold) f.g.dispose();
    this.me.dispose();
    this.bg.dispose();
    this.fx.dispose();
    this.floor.geometry.dispose(); (this.floor.material as THREE.Material).dispose();
    this.island.root.removeFromParent();
  }
}
