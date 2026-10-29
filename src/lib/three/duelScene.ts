// The Family Duel's stage (and Rival Ghosts'): the battle arena, with a grumpy Glimmer under its storm
// cloud at the back in the middle, one player's buddy and Glimmers on the left and the other's on the
// right. A glowing ring on the ground shows whose turn it is. Three right in a row sends a little painted
// rain cloud across to the other side. A ghost (a recording of how someone plays) stands in a soft blue
// glow, see-through, with its own textures showing. The winner gets the Glimmer: its cloud bursts and it
// hops over to them while the other side waves "good game".
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { loadTexture } from './assets';
import { Fx } from './fx';
import { GrumpyGlimmer } from './grumpyGlimmer';
import { GlimmerModel } from './glimmerModel';
import { CAST } from './battleScene';
import { dressUp } from './dress';
import type { Dress, Slot } from '../adventure/gear';
import { animateArena, buildArena, disposeArena, type Arena } from './arena';
import type { Island } from './island';
import type { View } from './runScene';
import type { FriendId } from '../art/cast';
import type { RegionId } from '../engine/course';
import { ELEMENT, GLIMMER, RARITY, type Element, type GlimmerId } from '../adventure/glimmers';

const UP = new THREE.Vector3(0, 1, 0);
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
export type DuelSideLook = { buddy: FriendId; outfit: string; dance: string; team: { id: GlimmerId; evolved?: boolean }[]; ghost: boolean; worn?: Partial<Record<Slot, string>>; dress?: Dress };
type Opts = { region: RegionId; sides: [DuelSideLook, DuelSideLook]; glimmer: GlimmerId; view: View };
export type Spot = 'p0' | 'p1' | 'glimmer' | 'p0t0' | 'p0t1' | 'p1t0' | 'p1t1';
/** the two sides' colours: sky blue on the left, coral on the right */
export const SIDE_COLOR = [0x4fb4ff, 0xff7a6b];

type SideRig = { me: Character; team: (GlimmerModel | null)[]; at: THREE.Vector3; ghost: boolean; busyUntil: number; dance: string };

/** Make a model look like a ghost: see-through, tinted blue, glowing softly, its painted textures kept. */
function ghostify(root: THREE.Object3D) {
  root.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const one = (mat: THREE.Material) => {
      const c = mat.clone() as THREE.MeshStandardMaterial;
      c.onBeforeCompile = mat.onBeforeCompile; c.customProgramCacheKey = mat.customProgramCacheKey;
      c.transparent = true; c.opacity = 0.62; c.depthWrite = true;
      if (c.color) c.color.multiply(new THREE.Color(0xb8dcff));
      if ('emissive' in c && c.emissive) { c.emissive = new THREE.Color(0x3d8cff); c.emissiveIntensity = 0.55; }
      return c;
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
    m.castShadow = false;
  });
}

/** A soft glowing disc for the ground under whoever's turn it is. */
function ringTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 30, 128, 128, 126);
  grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.62, 'rgba(255,255,255,0.15)'); grad.addColorStop(0.8, 'rgba(255,255,255,0.95)'); grad.addColorStop(0.9, 'rgba(255,255,255,0.4)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  // little stars round the ring
  g.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const x = 128 + Math.cos(a) * 104, y = 128 + Math.sin(a) * 104; g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 3 : 8, aa = (k / 10) * Math.PI * 2; g.lineTo(x + Math.cos(aa) * r, y + Math.sin(aa) * r); } g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class DuelScene implements Controller {
  fps = 60;
  readonly island: Island;
  view: View;
  readonly fx = new Fx();
  readonly grumble: GrumpyGlimmer;
  readonly sides: [SideRig, SideRig];
  private opts: Opts;
  private arena: Arena | null = null;
  private C: THREE.Vector3; private n: THREE.Vector3; private right: THREE.Vector3;
  private glimmerAt: THREE.Vector3;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private shot: 'wide' | 'side0' | 'side1' | 'win' = 'wide'; private shotUntil = 0;
  private now = 0; private shake = 0; private enterT = 0; private moteT = 0;
  private turn: 0 | 1 = 0;
  private ring: THREE.Mesh;
  private rainClouds: (THREE.Group | null)[] = [null, null];
  private stormTex: (THREE.Texture | null)[] = [];
  private winner: 0 | 1 | null = null; private tie = false; private walkT = 0; private walkFrom = new THREE.Vector3(); private walkTo = new THREE.Vector3();
  private compact = false;

  private constructor(island: Island, sides: [SideRig, SideRig], grumble: GrumpyGlimmer, opts: Opts) {
    this.island = island; this.sides = sides; this.grumble = grumble; this.opts = opts; this.view = opts.view;
    const f = island.trail.at(8);
    this.C = f.p.clone(); this.n = f.n.clone().setY(0).normalize();
    this.right = new THREE.Vector3().crossVectors(this.n.clone().negate(), UP).normalize();
    this.compact = stage.camera.aspect < 0.85;
    const sep = this.compact ? 1.15 : 1.85;
    const ground = (v: THREE.Vector3) => { v.y = island.height(v.x, v.z); return v; };
    sides[0].at = ground(this.C.clone().addScaledVector(this.right, -sep).addScaledVector(this.n, 0.3));
    sides[1].at = ground(this.C.clone().addScaledVector(this.right, sep).addScaledVector(this.n, 0.3));
    this.glimmerAt = ground(this.C.clone().addScaledVector(this.n, this.compact ? -0.9 : -1.0));
    grumble.fx = this.fx;
    grumble.root.position.copy(this.glimmerAt);
    stage.scene.add(this.fx.root, grumble.root);
    sides.forEach((s, i) => {
      const out = i === 0 ? -1 : 1;
      stage.scene.add(s.me.root);
      s.me.root.visible = false;
      s.me.play('idle', 0);
      // each side's Glimmers stand beside and behind their buddy, on the outside
      const spots = this.compact
        ? [s.at.clone().addScaledVector(this.right, out * 0.55).addScaledVector(this.n, -0.75), s.at.clone().addScaledVector(this.right, out * 0.05).addScaledVector(this.n, -1.25)]
        : [s.at.clone().addScaledVector(this.right, out * 0.95).addScaledVector(this.n, 0.25), s.at.clone().addScaledVector(this.right, out * 0.6).addScaledVector(this.n, -0.95)];
      s.team.forEach((g, k) => { if (!g) return; const p = ground(spots[k]); g.root.position.copy(p); g.face = this.glimmerAt.clone(); stage.scene.add(g.root); });
    });
    // whose turn: a glowing ring on the ground
    const rm = new THREE.MeshBasicMaterial({ map: ringTexture(), color: SIDE_COLOR[0], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.ring = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), rm);
    this.ring.rotation.x = -Math.PI / 2; this.ring.renderOrder = 1;
    stage.scene.add(this.ring);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
  }

  /** Start loading the arena early (the setup screen calls this), so the duel opens without a wait:
   *  the island is the slow part the first time, then it's kept. */
  static warm(region: RegionId) {
    void stage.getIsland(region).catch(() => null);
    for (const t of ['game/storm1.webp', 'game/storm2.webp', 'game/arena-floor.webp']) void loadTexture(t);
  }

  static async create(opts: Opts): Promise<DuelScene> {
    // everything loads side by side: the island, both players and their teams, the Glimmer, the clouds
    const islandP = stage.getIsland(opts.region);
    const stormP = Promise.all([loadTexture('game/storm1.webp'), loadTexture('game/storm2.webp')]);
    const grumbleP = GrumpyGlimmer.create(opts.glimmer, true);
    const rigs = await Promise.all(opts.sides.map(async s => {
      const [me, ...team] = await Promise.all([Character.create(s.buddy), ...s.team.slice(0, 2).map(t => GlimmerModel.create(t.id, GLIMMER[t.id].rarity === 'legendary' || GLIMMER[t.id].rarity === 'mythic' ? 0.8 : 0.62, { evolved: t.evolved }).catch(() => null))]);
      if (!me) throw new Error('character missing');
      // each side's own look (another player's save, or a ghost's copy)
      await dressUp(me, s.dress ?? { hat: s.outfit, on: s.worn ?? {}, nudge: {} });
      await me.loadMoves();
      if (s.ghost) { ghostify(me.root); team.forEach(g => g && ghostify(g.root)); }
      return { me, team: team as (GlimmerModel | null)[], at: new THREE.Vector3(), ghost: s.ghost, busyUntil: 0, dance: s.dance } as SideRig;
    }));
    // champion-sized, so the one in the middle reads clearly from both sides
    const [island, grumble, storm] = await Promise.all([islandP, grumbleP, stormP]);
    const sc = new DuelScene(island, rigs as [SideRig, SideRig], grumble, opts);
    sc.stormTex = storm;
    sc.arena = await buildArena(island, sc.C, sc.n, sc.right);
    stage.scene.add(sc.arena.group);
    return sc;
  }

  // ---------- where things are ----------
  private hand(i: 0 | 1) { return this.sides[i].at.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(this.right, i === 0 ? 0.35 : -0.35); }
  screenOf(which: Spot, dy = 0): { x: number; y: number } {
    let p: THREE.Vector3;
    if (which === 'p0' || which === 'p1') p = this.sides[which === 'p0' ? 0 : 1].at.clone().add(new THREE.Vector3(0, 1.3 + dy, 0));
    else if (which === 'glimmer') p = this.grumble.root.position.clone().add(new THREE.Vector3(0, this.grumble.topY + 0.15 + dy * 0.3, 0));
    else { const s = this.sides[which[1] === '0' ? 0 : 1], g = s.team[which[3] === '0' ? 0 : 1]; p = (g?.root.position.clone() ?? s.at.clone()).add(new THREE.Vector3(0, 0.9 + dy, 0)); }
    const v = p.project(stage.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  // ---------- moves ----------
  private play(i: 0 | 1, name: string, secs: number, fallback = 'cheer') {
    const s = this.sides[i];
    const nm = s.me.has(name) ? name : fallback;
    const a = s.me.play(nm, 0.2); a?.reset();
    s.busyUntil = this.now + secs;
  }
  /** Whose turn it is: the ring moves under them and the Glimmer turns to watch. */
  setTurn(i: 0 | 1) {
    this.turn = i;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(SIDE_COLOR[i]);
    this.fx.emit({ at: this.sides[i].at.clone().add(new THREE.Vector3(0, 0.1, 0)), count: 26, shape: ['star', 'dot'], color: [SIDE_COLOR[i], 0xffffff], dir: UP, spread: 0.6, speed: [0.6, 1.8], radius: 0.5, life: [0.6, 1.1], size: [0.1, 0.2], drag: 1.5 });
  }
  setMood(fraction: number) { this.grumble.mood = Math.max(0, Math.min(1, fraction)); }

  /** A side casts a power at the Glimmer. Resolves when it hits. */
  async cast(i: 0 | 1, element: Element, o: { perfect: boolean; super: boolean; ok: boolean; big: number }): Promise<void> {
    if (!o.ok) {
      this.play(i, 'stumble', 1.1, 'idle');
      await sleep(350);
      this.fx.emit({ at: this.hand(i), count: 18, shape: 'dot', color: 0xb8b8c8, speed: [0.3, 1], life: [0.5, 0.9], size: [0.1, 0.22], up: 0.6, drag: 2 });
      return;
    }
    this.play(i, Math.random() < 0.5 ? 'fistpump' : 'cheer', 1.2, 'jump');
    await sleep(380);
    const from = this.hand(i), to = this.grumble.centre, c = CAST[element];
    const k = Math.min(1.6, 0.6 + o.big);
    await new Promise<void>(res => this.fx.fly(from, to, {
      color: c.color, size: 0.55 * k, time: 0.55, arc: c.arc,
      trail: at => c.trail(at, k),
      hit: () => {
        for (const e of c.impact(to, k)) this.fx.emit(e);
        if (o.super) this.fx.emit({ at: to, count: 24, shape: 'spark', color: [0xffffff, ELEMENT[element].color], speed: [3, 6], life: [0.3, 0.6], size: [0.2, 0.4], drag: 3 });
        if (o.perfect) this.fx.emit({ at: to, count: 60, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xff9ad5, 0x9fe6ff], speed: [3, 8], life: [0.6, 1.2], size: [0.18, 0.36], drag: 1.5, gravity: 1 });
        this.grumble.hit(Math.min(1, 0.4 + o.big));
        this.shake = 0.15 + o.big * 0.2;
        res();
      },
    }));
  }
  /** A side's Glimmer (slot 0/1) or buddy (-1) adds a little extra cheer. */
  async extra(i: 0 | 1, slot: number, element: Element): Promise<void> {
    const g = slot >= 0 ? this.sides[i].team[slot] : null;
    if (g) g.play('act'); else this.play(i, 'jump', 0.8, 'fistpump');
    await sleep(220);
    const from = g ? g.root.position.clone().add(new THREE.Vector3(0, g.height * 0.7, 0)) : this.hand(i);
    const c = CAST[element], to = this.grumble.centre;
    await new Promise<void>(res => this.fx.fly(from, to, { color: c.color, size: 0.3, time: 0.45, arc: 0.8, trail: at => c.trail(at, 0.4), hit: () => { for (const e of c.impact(to, 0.35)) this.fx.emit(e); this.grumble.hit(0.25); res(); } }));
  }
  /** Frost Owl readies an ice shield for the next rain cloud. */
  freeze(i: 0 | 1, slot: number) {
    this.sides[i].team[slot]?.play('act');
    this.fx.emit({ at: this.sides[i].at.clone().add(new THREE.Vector3(0, 0.9, 0)), count: 40, shape: ['shard', 'flake'], color: [0xbff0ff, 0xffffff, 0x7fd6ff], speed: [0.6, 1.8], radius: 0.6, life: [1, 1.6], size: [0.12, 0.26], drag: 2, spin: 3 });
  }
  dazzle() {
    const top = this.grumble.centre.add(new THREE.Vector3(0, 0.6 * this.grumble.height, 0));
    this.fx.emit({ at: top, count: 14, shape: 'star', color: [0xffe066, 0xffffff], speed: [0.6, 1.2], radius: 0.3, life: [0.9, 1.4], size: [0.14, 0.22], drag: 1.5, spin: 4 });
  }
  aurora() {
    for (let k = 0; k < 5; k++) this.fx.beam(this.C.clone().addScaledVector(this.right, (k - 2) * 1.4).addScaledVector(this.n, -2.5), [0x6fffc8, 0x5bd8ff, 0xb48cff, 0x6fffc8, 0xff8ad8][k], { radius: 0.6, height: 12, life: 2.6, peak: 0.7 });
  }

  /** A little painted rain cloud flies from one side and waits over the other. */
  async sendRain(from: 0 | 1, to: 0 | 1): Promise<void> {
    this.play(from, 'fistpump', 0.9, 'jump');
    const g = new THREE.Group();
    [[0, 0, 1], [-0.3, -0.05, 0.75], [0.32, -0.04, 0.8]].forEach(([x, y, w], k) => {
      const t = this.stormTex[k % 2];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: 0x9aa2bc, transparent: true, depthWrite: false, opacity: t ? 1 : 0 }));
      s.scale.set(0.95 * w, 0.95 * w * 0.48, 1); s.position.set(x * 0.95, y * 0.45, k * -0.02); s.renderOrder = 2; g.add(s);
    });
    const start = this.hand(from).add(new THREE.Vector3(0, 0.4, 0));
    const end = this.sides[to].at.clone().add(new THREE.Vector3(0, 2.0, 0));
    g.position.copy(start); g.scale.setScalar(0.3);
    stage.scene.add(g);
    this.rainClouds[to]?.removeFromParent();
    this.rainClouds[to] = g;
    const t0 = performance.now();
    await new Promise<void>(res => {
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / 900), e = 1 - Math.pow(1 - k, 3);
        g.position.lerpVectors(start, end, e); g.position.y += Math.sin(k * Math.PI) * 1.0;
        g.scale.setScalar(0.3 + e * 0.7);
        if (k < 1) requestAnimationFrame(tick); else res();
      };
      tick();
    });
  }
  /** The rain cloud over a side: blocked (a shield, and it pops into sparkles) or it rains on them. */
  async rainResult(i: 0 | 1, blocked: boolean, shield = 0x7fe0ff): Promise<void> {
    const g = this.rainClouds[i];
    const target = this.sides[i].at.clone().add(new THREE.Vector3(0, 0.75, 0));
    if (blocked) {
      this.fx.shieldAt(target, 1.0, shield, false);
      await sleep(250);
      if (g) this.fx.emit({ at: g.position.clone(), count: 40, shape: ['star', 'dot', 'spark'], color: [0xffffff, 0x9fe6ff, 0xffe066], speed: [1.5, 4], life: [0.5, 1], size: [0.12, 0.26], drag: 2 });
    } else {
      if (g) this.fx.emit({ at: g.position.clone().add(new THREE.Vector3(0, -0.15, 0)), count: 70, shape: 'drop', color: [0x9fd0ff, 0xd6ecff], dir: new THREE.Vector3(0, -1, 0), spread: 0.15, speed: [3, 5], radius: 0.45, life: [0.4, 0.7], size: [0.08, 0.13], gravity: 6 });
      await sleep(350);
      this.play(i, 'stumble', 1.2, 'idle');
      this.shake = 0.2;
    }
    await sleep(300);
    g?.removeFromParent(); g?.traverse(o => (o as THREE.Sprite).material?.dispose?.());
    this.rainClouds[i] = null;
  }

  /** The Finale: a side's buddy dances under the lights, then a rainbow wave flies at the Glimmer. */
  async finale(i: 0 | 1): Promise<void> {
    this.shot = i === 0 ? 'side0' : 'side1'; this.shotUntil = this.now + 3.2;
    const s = this.sides[i];
    this.play(i, s.dance, 3.2, 'fistpump');
    const top = s.at.clone();
    [0xff7ab8, 0x7fd6ff, 0xffd166].forEach((c, k) => setTimeout(() => this.fx.beam(top.clone().addScaledVector(this.right, (k - 1) * 0.8).addScaledVector(this.n, -0.6), c, { radius: 0.5, height: 9, life: 2.6, peak: 0.8 }), k * 160));
    for (let k = 0; k < 6; k++) setTimeout(() => this.fx.emit({ at: top.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 14, shape: ['note', 'star', 'heart'], color: [0xff7ab8, 0xffd166, 0x7fd6ff, 0xb48cff], speed: [0.8, 1.8], up: 1.6, radius: 0.5, life: [1.2, 1.8], size: [0.16, 0.28], drag: 1, gravity: -0.3, spin: 2 }), k * 420);
    await sleep(2700);
    this.shot = 'wide';
    const cols = [0xff6fa8, 0xffb44d, 0xffe066, 0x6fe3a0, 0x5bb6ff, 0xa98cff];
    await new Promise<void>(res => {
      cols.forEach((c, k) => setTimeout(() => this.fx.fly(this.hand(i).add(new THREE.Vector3(0, 0.3 + k * 0.05, 0)), this.grumble.centre, {
        color: c, size: 0.7, time: 0.55, arc: 0.4 + k * 0.25,
        trail: at => ({ at, count: 3, shape: ['star', 'dot'], color: c, speed: [0.1, 0.5], life: [0.4, 0.7], size: [0.15, 0.25] }),
        hit: () => { this.fx.emit({ at: this.grumble.centre, count: 30, shape: ['star', 'spark', 'heart'], color: c, speed: [2, 6], life: [0.5, 1.1], size: [0.18, 0.34], drag: 1.6 }); this.grumble.hit(0.7); this.shake = 0.25; if (k === cols.length - 1) res(); },
      }), k * 90));
    });
  }

  /** Someone cheered it right up: the cloud bursts, its colours come back, and it hops over to the
   *  winner, who cheers, while the other side waves. A tie: both cheer and it stays in the middle,
   *  happy with both of them. */
  async win(i: 0 | 1, tie = false): Promise<void> {
    this.grumble.mood = 0;
    await sleep(400);
    const at = this.grumble.centre;
    this.grumble.burst();
    this.fx.emit({ at, count: 110, shape: ['star', 'dot', 'spark', 'heart'], color: [0xff6fa8, 0xffb44d, 0xffe066, 0x6fe3a0, 0x5bb6ff, 0xa98cff, 0xffffff], speed: [1.5, 6], life: [0.8, 1.8], size: [0.15, 0.35], drag: 1.4, gravity: 0.6, spin: 3 });
    const rc = RARITY[GLIMMER[this.opts.glimmer].rarity].color;
    this.fx.beam(this.glimmerAt.clone(), rc, { radius: 1.0, height: 16, life: 3.4, peak: 1 });
    this.play(i, 'cheer', 2.6, 'jump');
    this.play((1 - i) as 0 | 1, tie ? 'cheer' : 'wave', 2.6, tie ? 'jump' : 'cheer');
    this.winner = i; this.tie = tie;
    await sleep(1100);
    if (tie) { this.grumble.glimmer.play('happy'); await sleep(1500); return; }
    // hop over to the winner
    this.walkFrom.copy(this.grumble.root.position);
    this.walkTo.copy(this.sides[i].at).addScaledVector(this.right, i === 0 ? 0.85 : -0.85).addScaledVector(this.n, -0.35);
    this.walkTo.y = this.island.height(this.walkTo.x, this.walkTo.z);
    this.walkT = 0.0001;
    this.shot = 'win'; this.shotUntil = this.now + 99;
    await sleep(1500);
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    const camPos = stage.camera.position;
    this.sides.forEach((s, i) => {
      s.me.root.position.copy(s.at);
      // face the Glimmer, turned toward you; on a win, the loser turns to the winner
      const target = this.winner !== null && !this.tie && this.winner !== i ? this.sides[this.winner].at : this.grumble.root.position;
      const toG = target.clone().sub(s.at); toG.y = 0;
      const toCam = camPos.clone().sub(s.at); toCam.y = 0;
      const look = toG.normalize().multiplyScalar(0.6).add(toCam.normalize().multiplyScalar(0.45));
      s.me.root.rotation.set(0, Math.atan2(look.x, look.z), 0);
      if (this.now > s.busyUntil && s.me.currentName !== 'idle') s.me.play('idle', 0.4);
      s.me.update(dt);
      if (!s.me.root.visible) s.me.root.visible = true;
      for (const g of s.team) { if (g) { g.face = this.grumble.root.position.clone(); g.update(dt, t); } }
      // a ghost leaves a soft trail of blue light
      if (s.ghost && Math.random() < dt * 14) this.fx.emit({ at: s.at.clone().add(new THREE.Vector3(0, 0.3 + Math.random() * 0.9, 0)), count: 1, shape: 'dot', color: [0x9fd8ff, 0xd6ecff], speed: [0.05, 0.25], up: 0.6, radius: 0.35, life: [0.8, 1.4], size: [0.05, 0.1], drag: 0.6, gravity: -0.2 });
    });
    // the ring under whoever's turn it is
    const rs = this.sides[this.turn].at;
    this.ring.position.set(rs.x, this.island.height(rs.x, rs.z) + 0.07, rs.z);
    this.ring.rotation.z = t * 0.5;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = this.winner !== null ? 0 : 0.75 + Math.sin(t * 3) * 0.2;
    // the Glimmer watches whoever's turn it is
    const watch = this.winner !== null ? camPos.clone() : this.sides[this.turn].at.clone().lerp(camPos, 0.35);
    this.grumble.lookAt.copy(watch);
    if (this.enterT < 1.6) {
      const was = this.enterT; this.enterT += dt;
      const k = Math.min(1, this.enterT / 1.3), e = 1 - Math.pow(1 - k, 3);
      this.grumble.cloudLift = (1 - e) * 5;
      if (was < 1.2 && this.enterT >= 1.2) { const c = this.grumble.root.position.clone().add(new THREE.Vector3(0, this.grumble.height * 1.2, 0)); this.fx.lightning(c, this.glimmerAt.clone().add(new THREE.Vector3(0.35, 0.05, 0.2)), 0xfff1a0, 0.05); this.grumble.hit(0.4); this.shake = 0.22; }
    }
    if (this.walkT > 0 && this.walkT < 1) {
      const was = this.walkT; this.walkT = Math.min(1, this.walkT + dt / 1.4);
      const p = this.walkFrom.clone().lerp(this.walkTo, this.walkT);
      p.y = this.island.height(p.x, p.z) + Math.abs(Math.sin(this.walkT * Math.PI * 3)) * 0.25;
      this.grumble.root.position.copy(p);
      if (Math.floor(was * 3) !== Math.floor(this.walkT * 3)) this.grumble.glimmer.play('hop');
      if (this.walkT >= 1) this.grumble.glimmer.play('happy');
    }
    this.grumble.update(dt, t);
    if (this.arena) animateArena(this.arena, this.fx, t);
    this.moteT -= dt;
    if (this.moteT < 0) { this.moteT = 0.12; this.fx.emit({ at: this.C.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 1, shape: 'dot', color: [0xfff2b0, 0xffffff, 0xcfe8ff], speed: [0.1, 0.3], up: 3, radius: 3.4, life: [3, 5], size: [0.05, 0.1], drag: 0.2, gravity: -0.05 }); }
    // rain clouds bob and drip while they wait
    for (const g of this.rainClouds) if (g) { g.position.y += Math.sin(t * 2) * 0.002; if (Math.random() < dt * 8) this.fx.emit({ at: g.position.clone().add(new THREE.Vector3(0, -0.15, 0)), count: 1, shape: 'drop', color: 0xb8dcff, dir: new THREE.Vector3(0, -1, 0), spread: 0.1, speed: [2, 3], radius: 0.3, life: [0.3, 0.5], size: [0.06, 0.1], gravity: 5 }); }
    this.fx.update(dt, t);
    this.camera(dt, t);
  }

  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandW = Math.max(0.2, v.right - v.left), bandH = Math.max(0.2, v.bottom - v.top);
    if ((this.shot === 'side0' || this.shot === 'side1') && this.now > this.shotUntil) this.shot = 'wide';
    let focus: THREE.Vector3, span: number;
    if (this.shot === 'side0' || this.shot === 'side1') { focus = this.sides[this.shot === 'side0' ? 0 : 1].at.clone().add(new THREE.Vector3(0, 0.75, 0)); span = this.compact ? 2.6 : 3.4; }
    else if (this.shot === 'win' && this.winner !== null) { focus = this.sides[this.winner].at.clone().lerp(this.walkTo, 0.5).add(new THREE.Vector3(0, 0.8, 0)); span = this.compact ? 3.6 : 6.2; }
    else { focus = this.C.clone().addScaledVector(this.n, -0.2).add(new THREE.Vector3(0, 0.95, 0)); span = this.compact ? 4.4 : 7.4; }
    const d = Math.max(span / (bandW * 2 * tanH * cam.aspect), (span / 2.2) / (bandH * 2 * tanH));
    const sway = Math.sin(t * 0.25) * 0.1;
    const dir = this.n.clone().applyAxisAngle(UP, sway);
    const wantPos = focus.clone().addScaledVector(dir, d).add(new THREE.Vector3(0, d * 0.22 + 0.25, 0));
    const aim = focus.clone();
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * ((v.top + v.bottom) / 2);
    const rgt = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), UP).normalize();
    aim.addScaledVector(rgt, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    if (!this.camReady) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.camReady = true; }
    const k = 1 - Math.exp(-dt * (this.shot === 'wide' ? 2.5 : 3.2));
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.4); cam.position.x += (Math.random() - 0.5) * this.shake * 0.25; cam.position.y += (Math.random() - 0.5) * this.shake * 0.2; }
    cam.lookAt(this.camAim);
  }

  focus() { return this.C; }
  dispose() {
    for (const s of this.sides) { s.me.dispose(); for (const g of s.team) g?.dispose(); }
    this.grumble.dispose(); this.fx.dispose();
    for (const g of this.rainClouds) g?.removeFromParent();
    this.ring.removeFromParent(); (this.ring.material as THREE.MeshBasicMaterial).map?.dispose(); (this.ring.material as THREE.Material).dispose(); this.ring.geometry.dispose();
    if (this.arena) disposeArena(this.arena);
  }
}
