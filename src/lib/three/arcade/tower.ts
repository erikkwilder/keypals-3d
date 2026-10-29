// Tower Stack: build a tower of chunky toy blocks on a little floating island in the sky. Each block
// swings on the crane's rope, side to side, all the time (faster as the tower grows), with a sum on its
// front. The block is dim until it's answered right; then it lights up, and you drop it (a tap or the
// space bar) at the moment it's over the top of the tower. Dead centre is a Perfect, and a Glimmer moves
// in to that floor; off-centre, it hangs over and the tower sways more; too far off and it falls. Lean
// too far and the top of the tower topples. The tower sways like a real stack (a spring at its base,
// slower as it grows), and the buddy rides a hot air balloon beside it, rising as it grows.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { stage, type Controller } from '../stage';
import { Character } from '../character';
import { dressUp } from '../dress';
import { Fx } from '../fx';
import { loadGltf, loadTexture } from '../assets';
import type { Island } from '../island';
import type { FriendId } from '../../art/cast';
import { arcadeIsland, daylight, fontLoaded, paintedBackground } from './kit';

export const BW = 1.6, BH = 0.62, BD = 1.2;
const COLORS = [0xff6f91, 0xffc93d, 0x4fc3f7, 0x7ed957, 0xb388ff, 0xff9f43, 0x2ec4b6];
const INK = ['#8a1d3c', '#7a4a00', '#0b4f7a', '#2f6a12', '#4b2a8a', '#7a3a00', '#0c5a52'];
const FOV = 38;

type Block = { mesh: THREE.Group; x: number; y: number; face: THREE.Mesh; tex: THREE.CanvasTexture; color: number; resident?: THREE.Sprite };
/** the Glimmers who move in to Perfect floors */
const RESIDENTS = ['puddlepup', 'sproutbun', 'embernewt', 'fernfox', 'frostowl', 'sparkmoth', 'pebbletort', 'snowseal', 'sunsnail', 'mushmouse', 'bubbleocto', 'popcornpuff', 'rainbootfrog', 'mittenyeti', 'cactuskit', 'cometcat'];
type Loose = { mesh: THREE.Group; v: THREE.Vector3; w: number; age: number; tex: THREE.CanvasTexture | null };
export type Landed = { perfect: boolean; offset: number; slipped: boolean; toppled: number; height: number };

/** The number (or sum) painted on a block's front. */
function faceTex(text: string, ink: string) {
  const c = document.createElement('canvas'); c.width = 320; c.height = 128;
  const g = c.getContext('2d')!;
  g.font = `600 ${text.length > 4 ? 76 : 96}px Fredoka, Nunito, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = ink; g.strokeText(text, 160, 70);
  g.fillStyle = '#ffffff'; g.fillText(text, 160, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class TowerScene implements Controller {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  paused = false;
  /** the part of the screen the tower should use (fractions down the screen) */
  view = { top: 0.12, bottom: 0.7 };
  /** told when a dropped block has landed (or slipped off) */
  onLanded: ((r: Landed) => void) | null = null;
  private root: THREE.Group;
  private tower = new THREE.Group();
  private blocks: Block[] = [];
  private loose: Loose[] = [];
  private hanging: { mesh: THREE.Group; face: THREE.Mesh; body: THREE.Mesh; glow: THREE.Mesh; tex: THREE.CanvasTexture; color: number; ink: string; since: number; lit: boolean } | null = null;
  /** the crane's swing: where in it the block is, and how wide */
  private phase = 0;
  readonly swingAmp = BW * 0.85;
  private residentTex: (THREE.Texture | null)[] = [];
  private glowMat: THREE.MeshBasicMaterial;
  /** Glimmers living in the tower */
  residents = 0;
  private falling: { mesh: THREE.Group; face: THREE.Mesh; tex: THREE.CanvasTexture; color: number; ink: string; x0: number; x: number; y: number; vy: number; goalY: number; slip: number; answer: string } | null = null;
  private rope: THREE.Mesh;
  private hook: THREE.Mesh;
  private boxGeo: THREE.BufferGeometry; private faceGeo: THREE.PlaneGeometry; private blockTex: THREE.Texture | null;
  private mats = new Map<number, THREE.MeshStandardMaterial>();
  private balloon: THREE.Object3D | null;
  private basket = new THREE.Group();
  private fx = new Fx();
  private bg: { update(): void; dispose(): void };
  private sun: THREE.DirectionalLight;
  private theta = 0; private omega = 0;
  private t = 0;
  private camY = 3; private camReady = false;
  private shake = 0;
  private colorN = 0;
  private busyUntil = 0;
  /** how fast the swing grows with thinking (ms for "quick") */
  fastMs = 3000;
  private own: { dispose(): void }[] = [];
  private constructor(island: Island, me: Character, base: THREE.Object3D | null, balloon: THREE.Object3D | null, blockTex: THREE.Texture | null, bg: { update(): void; dispose(): void }) {
    this.island = island; this.me = me; this.balloon = balloon; this.blockTex = blockTex; this.bg = bg;
    this.root = island.root;
    this.sun = daylight(this.root, 7, new THREE.Vector3(5, 14, 9));
    this.root.add(this.tower, this.fx.root);
    if (base) this.root.add(base);
    this.boxGeo = new RoundedBoxGeometry(BW, BH, BD, 3, 0.09);
    this.faceGeo = new THREE.PlaneGeometry(BW * 0.86, BH * 0.86);
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0xc9a46b, roughness: 0.9 });
    this.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), ropeMat);
    this.hook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 8, 16, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: 0x8d97a6, metalness: 0.8, roughness: 0.35 }));
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false });
    this.own.push(this.boxGeo, this.faceGeo, this.rope.geometry, ropeMat, this.hook.geometry, this.hook.material as THREE.Material, this.glowMat);
    this.root.add(this.rope, this.hook);
    // the buddy in the balloon's basket (or on its own, if the balloon didn't load)
    this.root.add(this.basket);
    if (balloon) this.basket.add(balloon);
    this.basket.add(me.root);
    me.groundFeet = false;
    me.play('idle', 0);
    me.root.visible = false;
  }

  static async create(o: { buddy: FriendId }): Promise<TowerScene> {
    await fontLoaded();
    const [me, bg, isl, bal, tex, faces] = await Promise.all([
      Character.create(o.buddy), paintedBackground('arcade/bg-tower.webp', 0.5, 0.6),
      loadGltf('world/island.glb'), loadGltf('world/hot_air_balloon.glb'), loadTexture('arcade/block.webp', { color: true }),
      Promise.all(RESIDENTS.map(id => loadTexture(`game/glimmers/face/${id}.webp`, { color: true }))),
    ]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    void me.loadMoves();
    // the island the tower stands on: about four metres across, its grassy top at y = 0
    let base: THREE.Object3D | null = null;
    if (isl) {
      base = isl.scene.clone(true);
      const box = new THREE.Box3().setFromObject(base), size = box.getSize(new THREE.Vector3());
      const k = 4.2 / Math.max(size.x, size.z);
      base.scale.setScalar(k);
      base.position.y = -box.max.y * k + 0.05;
      base.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.receiveShadow = true; m.castShadow = true; } });
    }
    let balloon: THREE.Object3D | null = null;
    if (bal) {
      balloon = bal.scene.clone(true);
      const box = new THREE.Box3().setFromObject(balloon), size = box.getSize(new THREE.Vector3());
      const k = 3.3 / size.y;
      balloon.scale.setScalar(k);
      balloon.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
      balloon.traverse(m => { if ((m as THREE.Mesh).isMesh) m.castShadow = true; });
    }
    const sc = new TowerScene(arcadeIsland(), me, base, balloon, tex, bg);
    sc.residentTex = faces;
    return sc;
  }

  /** Blocks standing. */
  get height() { return this.blocks.length; }
  private topY() { return this.blocks.length ? this.blocks[this.blocks.length - 1].y + BH / 2 : 0; }
  private topX() { return this.blocks.length ? this.blocks[this.blocks.length - 1].x : 0; }
  private mat(color: number) {
    let m = this.mats.get(color);
    if (!m) { m = new THREE.MeshStandardMaterial({ map: this.blockTex, color, roughness: 0.45 }); this.mats.set(color, m); this.own.push(m); }
    return m;
  }
  /** a block not yet unlocked: its colour washed out to a pale grey */
  private dimMat(color: number) {
    const key = -1 - color;
    let m = this.mats.get(key);
    if (!m) { const c = new THREE.Color(color).lerp(new THREE.Color(0xb9bfcc), 0.72); m = new THREE.MeshStandardMaterial({ map: this.blockTex, color: c, roughness: 0.7 }); this.mats.set(key, m); this.own.push(m); }
    return m;
  }
  private makeBlock(text: string, color: number, ink: string) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(this.boxGeo, this.mat(color));
    body.castShadow = true; body.receiveShadow = true;
    const tex = faceTex(text, ink);
    const face = new THREE.Mesh(this.faceGeo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.5 }));
    face.position.z = BD / 2 + 0.006;
    g.add(body, face);
    return { g, face, tex };
  }

  /** A new block on the rope, dim, with this sum on its front. */
  hang(text: string) {
    const k = this.colorN++ % COLORS.length;
    const { g, face, tex } = this.makeBlock(text, COLORS[k], INK[k]);
    const body = g.children[0] as THREE.Mesh;
    body.material = this.dimMat(COLORS[k]);
    const glow = new THREE.Mesh(this.boxGeo, this.glowMat);
    glow.scale.set(1.12, 1.25, 1.12); glow.visible = false;
    g.add(glow);
    this.root.add(g);
    this.hanging = { mesh: g, face, body, glow, tex, color: COLORS[k], ink: INK[k], since: this.t, lit: false };
    g.scale.setScalar(0.01);
  }
  /** A new sum on the hanging block (after a wrong answer: it stays dim). */
  relabel(text: string) {
    const h = this.hanging;
    if (!h) return;
    const tex = faceTex(text, h.ink);
    h.tex.dispose(); h.tex = tex;
    (h.face.material as THREE.MeshStandardMaterial).map = tex; (h.face.material as THREE.MeshStandardMaterial).needsUpdate = true;
    h.mesh.scale.setScalar(0.85);
  }
  /** Answered right: the block lights up, and its answer shows on its front. */
  light(answer: string) {
    const h = this.hanging;
    if (!h || h.lit) return;
    h.lit = true;
    h.body.material = this.mat(h.color);
    h.glow.visible = true;
    this.relabel(answer);
    h.mesh.scale.setScalar(1.15);
    this.fx.emit({ at: h.mesh.position.clone(), count: 24, shape: ['star', 'spark'], color: [0xffe066, 0xffffff], speed: [1, 2.5], radius: 0.6, life: [0.4, 0.8], size: [0.1, 0.22], drag: 1.6 });
  }
  get unlocked() { return !!this.hanging?.lit; }
  /** How long one swing takes: slower for a little tower, quicker as it grows. */
  private period() { return Math.max(1.25, 2.6 - this.blocks.length * 0.075); }
  private swing() { return this.hanging ? this.swingAmp * Math.sin(this.phase) : 0; }
  /** Let go of a lit block: it drops straight down from where it is in its swing. */
  drop(): boolean {
    const h = this.hanging;
    if (!h || !h.lit || this.falling) return false;
    this.hanging = null;
    const x = h.mesh.position.x;
    h.glow.visible = false;
    this.falling = { mesh: h.mesh, face: h.face, tex: h.tex, color: h.color, ink: h.ink, x0: x, x, y: h.mesh.position.y, vy: 0, goalY: this.topY() + BH / 2, slip: 0, answer: '' };
    return true;
  }

  /** The buddy's reaction. */
  react(kind: 'perfect' | 'good' | 'oops' | 'topple' | 'done') {
    const me = this.me;
    const name = kind === 'perfect' ? (me.has('fistpump') ? 'fistpump' : 'cheer') : kind === 'good' ? 'jump' : kind === 'done' ? 'cheer' : 'wave';
    if (!me.has(name)) return;
    const a = me.play(name, 0.2);
    if (a) { a.reset(); if (kind !== 'done') { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; } }
    this.busyUntil = this.t + (kind === 'done' ? 99 : 1.6);
  }

  update(dt: number, t: number) {
    this.t = t;
    this.bg.update();
    if (!this.paused) this.physics(dt);
    // the hanging block: pops in, swings on its rope below the hook
    const topY = this.topY(), hangY = topY + 2.5;
    if (!this.paused) this.phase += dt * (Math.PI * 2) / this.period();
    if (this.hanging) {
      const h = this.hanging, x = this.topX() + this.swing();
      const s = h.mesh.scale.x; h.mesh.scale.setScalar(s < 1 ? Math.min(1, s + dt * 5) : Math.max(1, s - dt * 1.5));
      h.mesh.position.set(x, hangY, 0);
      h.mesh.rotation.z = -Math.cos(this.phase) * 0.1;
      if (h.lit) (h.glow.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 9) * 0.15;
    }
    const hx = this.hanging ? this.hanging.mesh.position.x : this.topX() + this.swing();
    const hookY = (this.hanging ? hangY : topY + 2.5) + BH / 2 + 0.12;
    this.hook.position.set(hx, hookY, 0); this.hook.rotation.z = Math.PI * 0.8;
    this.rope.scale.y = 30; this.rope.position.set(hx, hookY + 15.1, 0);
    // the tower sways about its base
    this.tower.rotation.z = this.theta;
    // the balloon rises with the tower, bobbing, beside it
    const narrow = stage.camera.aspect < 0.8;
    this.basket.position.set(narrow ? 2.05 : 2.7, Math.max(0.4, topY - 1.1) + Math.sin(t * 0.9) * 0.15, -0.4);
    this.basket.rotation.set(0, -0.35, Math.sin(t * 0.7) * 0.03);
    if (this.balloon) {
      // in the basket: only the top half shows over its rim
      this.me.root.position.set(0, 0.2, 0);
    } else this.me.root.position.set(0, 0, 0);
    this.me.root.rotation.y = -0.6;
    if (t > this.busyUntil && this.me.currentName !== 'idle') this.me.play('idle', 0.3);
    this.me.update(dt);
    this.me.root.visible = true;
    this.fx.update(dt, t);
    this.camera(dt, topY);
  }
  private physics(dt: number) {
    // sway: a spring at the base, softer as the tower grows, with a little breeze
    const n = this.blocks.length;
    const K = 26 / (1 + n * 0.22), C = 1.1;
    this.omega += (-K * this.theta - C * this.omega + Math.sin(this.t * 0.8) * 0.002 * n) * dt;
    this.theta += this.omega * dt;
    this.theta = Math.max(-0.12, Math.min(0.12, this.theta));
    // a dropped block
    const f = this.falling;
    if (f) {
      f.vy += 26 * dt;
      f.y -= f.vy * dt;
      // it glides out to where it lands as it drops
      f.x0 += (f.x - f.x0) * Math.min(1, dt * 9);
      f.mesh.position.set(f.x0, f.y, 0);
      if (f.y - BH / 2 <= f.goalY) this.land(f);
    }
    // blocks falling off, tumbling into the clouds
    for (const l of this.loose) {
      l.age += dt; l.v.y -= 22 * dt;
      l.mesh.position.addScaledVector(l.v, dt);
      l.mesh.rotation.z += l.w * dt;
    }
    this.loose = this.loose.filter(l => {
      if (l.age < 3) return true;
      l.mesh.removeFromParent(); l.tex?.dispose(); ((l.mesh.children[1] as THREE.Mesh)?.material as THREE.Material)?.dispose();
      return false;
    });
  }
  private land(f: NonNullable<TowerScene['falling']>) {
    this.falling = null;
    const below = this.topX();
    const off = f.x - below;
    const y = f.goalY + BH / 2;
    // squash and dust as it lands
    this.fx.emit({ at: new THREE.Vector3(f.x, f.goalY + 0.05, 0.2), count: 22, shape: ['dot', 'flake'], color: [0xffffff, 0xf3ead8], speed: [1, 2.6], up: 0.2, radius: 0.5, life: [0.4, 0.8], size: [0.1, 0.22], drag: 2, gravity: 1 });
    this.shake = Math.min(0.25, 0.08 + Math.abs(off) * 0.2);
    if (Math.abs(off) > BW * 0.5) {
      // slipped off the edge: a bump, then over it goes
      this.addLoose(f.mesh, new THREE.Vector3(Math.sign(off) * 2.2, 3, 1.2), -Math.sign(off) * 4, f.tex);
      this.omega += Math.sign(off) * 0.06;
      this.onLanded?.({ perfect: false, offset: off, slipped: true, toppled: 0, height: this.blocks.length });
      return;
    }
    // it stands (the answer is already on its front)
    const tex = f.tex;
    // into the tower (which sways about the base)
    f.mesh.position.set(f.x, y, 0);
    f.mesh.rotation.set(0, 0, 0);
    this.tower.add(f.mesh);
    const b: Block = { mesh: f.mesh, x: f.x, y, face: f.face, tex, color: f.color };
    f.mesh.scale.setScalar(1);
    this.blocks.push(b);
    b.mesh.scale.set(1.08, 0.82, 1.08);
    b.mesh.userData.squash = 0;
    const perfect = Math.abs(off) < 0.12;
    // an overhang sets the tower swaying: the further off, the more
    this.omega += off * 0.32 + (perfect ? 0 : Math.sign(off) * 0.03);
    if (perfect) {
      this.fx.emit({ at: new THREE.Vector3(f.x, y + 0.4, 0.4), count: 30, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xffb81f], speed: [1.5, 3.5], radius: 0.4, life: [0.5, 1], size: [0.12, 0.26], drag: 1.6, up: 0.6 });
      // a Glimmer moves in to this floor, peeking out from the corner
      const tx = this.residentTex[this.residents % Math.max(1, this.residentTex.length)];
      if (tx) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true }));
        sp.position.set((this.residents % 2 ? -1 : 1) * BW * 0.36, BH * 0.18, BD / 2 + 0.12);
        sp.scale.setScalar(0.01); sp.userData.grow = 0;
        f.mesh.add(sp);
        b.resident = sp;
      }
      this.residents++;
    }
    // too much leaning anywhere in the stack: the top part topples over
    const toppled = this.checkTopple();
    this.onLanded?.({ perfect, offset: off, slipped: false, toppled, height: this.blocks.length });
  }
  /** Does the stack above any block lean past that block's edge? Those blocks fall. */
  private checkTopple() {
    for (let i = 1; i < this.blocks.length; i++) {
      const above = this.blocks.slice(i);
      const com = above.reduce((s, b) => s + b.x, 0) / above.length;
      const d = com - this.blocks[i - 1].x;
      if (Math.abs(d) > BW * 0.5) {
        const dir = Math.sign(d);
        for (const b of above) {
          const w = b.mesh.getWorldPosition(new THREE.Vector3());
          this.tower.remove(b.mesh); this.root.add(b.mesh); b.mesh.position.copy(w);
          this.addLoose(b.mesh, new THREE.Vector3(dir * (1.2 + Math.random()), 1 + (b.y - this.blocks[i].y) * 0.4, 0.6 + Math.random()), -dir * (1.5 + Math.random() * 2), b.tex);
        }
        this.blocks.length = i;
        this.omega += dir * 0.1;
        return above.length;
      }
    }
    return 0;
  }
  private addLoose(mesh: THREE.Group, v: THREE.Vector3, w: number, tex: THREE.CanvasTexture | null) {
    if (mesh.parent !== this.root) { const p = mesh.getWorldPosition(new THREE.Vector3()); mesh.removeFromParent(); this.root.add(mesh); mesh.position.copy(p); }
    this.loose.push({ mesh, v, w, age: 0, tex });
  }
  /** Follow the top of the tower, the hanging block in the open part of the screen. */
  private camera(dt: number, topY: number) {
    const cam = stage.camera, a = cam.aspect;
    if (cam.fov !== FOV) { cam.fov = FOV; cam.updateProjectionMatrix(); }
    const tn = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const band = Math.max(0.25, this.view.bottom - this.view.top);
    // about eight metres of tower in the open band, and wide enough for the tower and the balloon
    const D = Math.max(6.4 / (band * 2 * tn), (a < 0.8 ? 3.1 : 4.3) / (tn * a));
    // the top of the tower 62% of the way down the band (the hanging block above it)
    const focus = Math.max(topY, 1.2);
    const sy = this.view.top + band * 0.62;
    const want = focus + (sy - 0.5) * 2 * D * tn;
    if (!this.camReady) { this.camY = want; this.camReady = true; }
    this.camY += (want - this.camY) * Math.min(1, dt * 2.5);
    const sh = this.shake; this.shake = Math.max(0, this.shake - dt * 0.8);
    cam.position.set((Math.random() - 0.5) * sh * 0.3 + 0.35, this.camY + (Math.random() - 0.5) * sh * 0.3 + 0.6, D);
    cam.lookAt(0.35, this.camY, 0);
    this.fx.setScale(innerHeight, FOV);
    // shadows follow the top
    this.sun.position.set(5, topY + 12, 9); this.sun.target.position.set(0, topY - 2, 0);
    // landed blocks spring back from their squash; residents pop in with a bounce
    for (const b of this.blocks) {
      const s = b.mesh.scale;
      if (s.y < 1) { s.y = Math.min(1, s.y + dt * 1.2); s.x = s.z = 1 + (1 - s.y) * 0.4; }
      const r = b.resident;
      if (r && r.userData.grow < 1) { r.userData.grow = Math.min(1, r.userData.grow + dt * 3); const g = r.userData.grow; r.scale.setScalar(0.5 * (g < 0.7 ? g / 0.7 * 1.15 : 1.15 - (g - 0.7) / 0.3 * 0.15)); }
    }
  }
  focus() { return new THREE.Vector3(0, this.topY(), 0); }
  dispose() {
    for (const b of this.blocks) { b.tex.dispose(); (b.face.material as THREE.Material).dispose(); b.resident?.material.dispose(); }
    for (const l of this.loose) l.tex?.dispose();
    this.hanging?.tex.dispose(); this.falling?.tex.dispose();
    this.me.dispose();
    this.bg.dispose();
    this.fx.dispose();
    this.own.forEach(o => o.dispose());
    this.root.removeFromParent();
  }
}
