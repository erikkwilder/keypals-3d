// The Cheer Duel's stage: a round stone arena on the island trail, glowing crystal pillars and element
// banners round its back, a ruined arch behind. Your buddy stands on the left with up to two Glimmers;
// the Grumble floats on the right. The screen calls the moves (cast a power, a Glimmer's extra, mischief
// and a block, the Finale, the cheer-up) and gets back promises that resolve at the moment of impact, so
// numbers and sounds land with the hits.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { makeOutfit } from './outfits3d';
import { loadGltf, loadTexture } from './assets';
import { Fx, type Emit } from './fx';
import { GrumpyGlimmer } from './grumpyGlimmer';
import { GlimmerModel } from './glimmerModel';
import type { Island } from './island';
import type { View } from './runScene';
import type { FriendId } from '../art/cast';
import type { RegionId } from '../engine/course';
import { ELEMENT, ELEMENTS, GLIMMER, RARITY, type Element, type GlimmerId, type Rarity } from '../adventure/glimmers';
import type { MischiefKind } from '../adventure/battle';

const UP = new THREE.Vector3(0, 1, 0);
type Opts = { buddy: FriendId; outfit: string; dance: string; region: RegionId; team: GlimmerId[]; foe: { glimmer: GlimmerId; rarity: Rarity; champion: boolean }; view: View };
const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export class BattleScene implements Controller {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  view: View;
  readonly fx = new Fx();
  readonly grumble: GrumpyGlimmer;
  team: (GlimmerModel | null)[] = [];
  private opts: Opts;
  private arena = new THREE.Group();
  private C: THREE.Vector3; private n: THREE.Vector3; private right: THREE.Vector3;
  private buddyAt: THREE.Vector3; private foeAt: THREE.Vector3; private foeFloat: number;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  /** camera moments: 'wide' normal, 'buddy' close on the buddy (Finale), 'reveal' on the new Glimmer */
  private shot: 'wide' | 'buddy' | 'reveal' | 'push' = 'wide'; private shotUntil = 0;
  private now = 0;
  private busyUntil = 0;
  private banners: THREE.Mesh[] = [];
  private fires: THREE.Vector3[] = [];
  private shake = 0;
  private revealed: GlimmerModel | null = null;
  private foeGone = false; private foeLeave = 0;
  private hover = 0;
  private lights: THREE.PointLight[] = [];
  private moteT = 0;
  /** the Grumble drifts down out of the sky at the start (seconds since) */
  private enterT = 0;
  private compact = false;

  private constructor(island: Island, me: Character, grumble: GrumpyGlimmer, team: (GlimmerModel | null)[], opts: Opts) {
    this.island = island; this.me = me; this.grumble = grumble; this.team = team; this.opts = opts; this.view = opts.view;
    const f = island.trail.at(8);
    this.C = f.p.clone(); this.n = f.n.clone().setY(0).normalize();
    this.right = new THREE.Vector3().crossVectors(this.n.clone().negate(), UP).normalize();
    // a tall phone screen: everyone closer together, so they can be big
    this.compact = stage.camera.aspect < 0.85;
    const sep = this.compact ? 1.05 : 1.6;
    this.buddyAt = this.C.clone().addScaledVector(this.right, -sep).addScaledVector(this.n, 0.35);
    this.buddyAt.y = island.height(this.buddyAt.x, this.buddyAt.z);
    const champ = opts.foe.champion;
    this.foeAt = this.C.clone().addScaledVector(this.right, champ ? sep + 0.4 : sep).addScaledVector(this.n, this.compact ? -0.6 : -0.05);
    this.foeAt.y = island.height(this.foeAt.x, this.foeAt.z);
    this.foeFloat = 0;
    grumble.fx = this.fx;
    stage.scene.add(this.arena, this.fx.root, me.root, grumble.root);
    me.root.visible = false;
    me.play('idle', 0);
    grumble.root.position.copy(this.foeAt);
    // team: one in front, one behind, to the buddy's left
    const spots = this.compact
      ? [this.buddyAt.clone().addScaledVector(this.right, -0.7).addScaledVector(this.n, -0.75), this.buddyAt.clone().addScaledVector(this.right, 0.4).addScaledVector(this.n, -1.15)]
      : [this.buddyAt.clone().addScaledVector(this.right, -1.0).addScaledVector(this.n, 0.4), this.buddyAt.clone().addScaledVector(this.right, -0.7).addScaledVector(this.n, -0.95)];
    team.forEach((g, i) => { if (!g) return; const s = spots[i]; s.y = island.height(s.x, s.z); g.root.position.copy(s); stage.scene.add(g.root); g.face = this.foeAt.clone(); });
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
  }

  static async create(opts: Opts): Promise<BattleScene> {
    const [island, me, ...team] = await Promise.all([
      stage.getIsland(opts.region), Character.create(opts.buddy),
      ...opts.team.slice(0, 2).map(id => GlimmerModel.create(id, GLIMMER[id].rarity === 'legendary' || GLIMMER[id].rarity === 'mythic' ? 0.8 : 0.62).catch(() => null)),
    ]);
    if (!me) throw new Error('character missing');
    if (opts.outfit && opts.outfit !== 'none') me.wear(opts.outfit, makeOutfit);
    await me.loadMoves();
    const grumble = await GrumpyGlimmer.create(opts.foe.glimmer, opts.foe.champion);
    const sc = new BattleScene(island, me, grumble, team as (GlimmerModel | null)[], opts);
    await sc.buildArena();
    return sc;
  }

  // ---------- the arena ----------
  private drape(geo: THREE.BufferGeometry, lift = 0.03) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) + this.C.x, z = pos.getZ(i) + this.C.z; pos.setY(i, this.island.height(x, z) - this.C.y + lift); }
    geo.computeVertexNormals();
  }
  private async buildArena() {
    const R = 3.4;
    const [floorTex, rockTex, arch, ruin] = await Promise.all([loadTexture('game/arena-floor.webp', { color: true }), loadTexture('world/rock.webp', { repeat: true, color: true }), loadGltf('world/rock_arch.glb'), loadGltf('world/ruin.glb')]);
    // the floor: the round paving, draped over the ground
    const floorGeo = new THREE.CircleGeometry(R, 96, 0, Math.PI * 2);
    floorGeo.rotateX(-Math.PI / 2);
    this.drape(floorGeo, 0.04);
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, color: floorTex ? 0xffffff : 0xd8b98a, roughness: 0.95 }));
    floor.receiveShadow = true;
    floor.position.copy(this.C);
    this.arena.add(floor);
    // a ring of low stones round the edge, lower at the front so nothing hides the duel
    const stoneMat = new THREE.MeshStandardMaterial({ map: rockTex, color: rockTex ? 0xf2e6d4 : 0xbfa98a, roughness: 0.9 });
    if (rockTex) { rockTex.repeat.set(0.6, 0.4); }
    const block = new THREE.BoxGeometry(0.62, 0.34, 0.42, 3, 2, 2);
    { const p = block.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 + (Math.sin(x * 9 + z * 7) + Math.cos(y * 11 + x * 5)) * 0.04; p.setXYZ(i, x * k, y * k, z * k); } block.computeVertexNormals(); }
    const N = 30;
    const rim = new THREE.InstancedMesh(block, stoneMat, N);
    const o = new THREE.Object3D();
    const facing = Math.atan2(this.n.x, this.n.z);
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.sin(a + facing), 0, Math.cos(a + facing));
      const front = Math.max(0, dir.dot(this.n));
      const at = this.C.clone().addScaledVector(dir, R + 0.18);
      at.y = this.island.height(at.x, at.z) + 0.1 - front * 0.14;
      o.position.copy(at); o.rotation.set(0, a + facing, (Math.random() - 0.5) * 0.08); o.scale.set(1, 1 - front * 0.45, 1); o.updateMatrix();
      rim.setMatrixAt(i, o.matrix);
    }
    rim.castShadow = true; rim.receiveShadow = true;
    this.arena.add(rim);
    // stone pillars with fire bowls, and painted element banners on wooden poles, round the back
    const [postTex, ...bannerTex] = await Promise.all([loadTexture('world/post.webp', { repeat: true, color: true }), ...ELEMENTS.map(el => loadTexture(`game/banner-${el}.webp`))]);
    if (postTex) postTex.repeat.set(1, 3);
    const woodMat = new THREE.MeshStandardMaterial({ map: postTex, color: postTex ? 0xffffff : 0x8a6440, roughness: 0.85 });
    const pillarGeo = new THREE.CylinderGeometry(0.17, 0.22, 1.5, 14, 4);
    const bowlGeo = new THREE.CylinderGeometry(0.34, 0.2, 0.26, 18, 1);
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: 0xff5a14, emissiveIntensity: 1.2, roughness: 0.9 });
    [-1.05, 1.05].forEach((off, i) => {
      const a = facing + Math.PI + off;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const at = this.C.clone().addScaledVector(dir, R + 0.5); at.y = this.island.height(at.x, at.z);
      const pillar = new THREE.Mesh(pillarGeo, stoneMat); pillar.position.copy(at).y += 0.75; pillar.castShadow = true; this.arena.add(pillar);
      const bowl = new THREE.Mesh(bowlGeo, stoneMat); bowl.position.copy(at).y += 1.62; bowl.castShadow = true; this.arena.add(bowl);
      const coals = new THREE.Mesh(new THREE.CircleGeometry(0.3, 18), coalMat); coals.rotation.x = -Math.PI / 2; coals.position.copy(at).y += 1.74; this.arena.add(coals);
      const fire = at.clone().add(new THREE.Vector3(0, 1.78, 0));
      this.fires.push(fire);
      const l = new THREE.PointLight(0xff9a3a, 7, 8, 2); l.position.copy(fire).y += 0.3; this.arena.add(l); this.lights.push(l);
      void i;
    });
    ELEMENTS.forEach((el, i) => {
      const b = facing + Math.PI + (i - 2) * 0.42;
      const bd = new THREE.Vector3(Math.sin(b), 0, Math.cos(b));
      const bp = this.C.clone().addScaledVector(bd, R + 0.95); bp.y = this.island.height(bp.x, bp.z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 3.0, 10), woodMat); pole.position.copy(bp).y += 1.5; pole.castShadow = true; this.arena.add(pole);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffc94a, metalness: 0.8, roughness: 0.3 })); knob.position.copy(bp).y += 3.05; this.arena.add(knob);
      const tex = bannerTex[i];
      const img = tex?.image as { width: number; height: number } | undefined;
      const hgt = 1.45, wdt = img ? hgt * (img.width / img.height) : 0.62;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(wdt, hgt, 8, 12), new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : ELEMENT[el].color, side: THREE.DoubleSide, roughness: 0.8, transparent: true, alphaTest: 0.4 }));
      cloth.geometry.translate(0, -hgt / 2, 0);
      cloth.position.copy(bp).addScaledVector(bd, -0.08).y += 2.85;
      cloth.rotation.y = b + Math.PI;
      cloth.castShadow = true;
      this.arena.add(cloth); this.banners.push(cloth);
    });
    // the ruined arch behind
    const backDir = this.n.clone().negate();
    const place = (g: typeof arch, h: number, at: THREE.Vector3, turn: number) => {
      if (!g) return;
      const m = g.scene.clone(true), box = new THREE.Box3().setFromObject(m), k = h / Math.max(1e-4, box.getSize(new THREE.Vector3()).y);
      m.scale.setScalar(k); m.position.copy(at); m.position.y = this.island.height(at.x, at.z) - box.min.y * k - 0.05; m.rotation.y = turn;
      m.traverse(x => { const mm = x as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
      this.arena.add(m);
    };
    place(arch, 3.6, this.C.clone().addScaledVector(backDir, R + 2.6).addScaledVector(this.right, -0.8), facing);
    place(ruin, 2.2, this.C.clone().addScaledVector(backDir, R + 2.2).addScaledVector(this.right, 3.4), facing + 0.6);
  }

  // ---------- where things are ----------
  private hand() { return this.buddyAt.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(this.right, 0.35); }
  private foeCentre() { return this.grumble.centre; }
  /** A point on screen (fractions of the window) for a thing: for floating numbers. */
  screenOf(which: 'buddy' | 'foe' | 'team0' | 'team1' | 'reveal', dy = 0): { x: number; y: number } {
    const p = which === 'buddy' ? this.buddyAt.clone().add(new THREE.Vector3(0, 1.3 + dy, 0))
      : which === 'foe' ? this.grumble.root.position.clone().add(new THREE.Vector3(0, this.grumble.topY + 0.15 + dy * 0.3, 0))
      : which === 'reveal' ? this.foeAt.clone().add(new THREE.Vector3(0, 1 + dy, 0))
      : (this.team[which === 'team0' ? 0 : 1]?.root.position.clone() ?? this.buddyAt.clone()).add(new THREE.Vector3(0, 0.9 + dy, 0));
    const v = p.project(stage.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  // ---------- moves ----------
  private play(name: string, secs: number, fallback = 'cheer') {
    const n = this.me.has(name) ? name : fallback;
    const a = this.me.play(n, 0.2); a?.reset();
    this.busyUntil = this.now + secs;
  }

  /** Your buddy casts a power. Resolves when it hits. */
  async cast(element: Element, value: number, o: { perfect: boolean; super: boolean; ok: boolean; big: number }): Promise<void> {
    if (!o.ok) {
      this.play('stumble', 1.1, 'idle');
      await sleep(350);
      this.fx.emit({ at: this.hand(), count: 18, shape: 'dot', color: 0xb8b8c8, speed: [0.3, 1], life: [0.5, 0.9], size: [0.1, 0.22], up: 0.6, drag: 2 });
      return;
    }
    this.play(Math.random() < 0.5 ? 'fistpump' : 'cheer', 1.2, 'jump');
    this.shot = 'push'; this.shotUntil = this.now + 1.1;
    await sleep(380);
    const from = this.hand(), to = this.foeCentre();
    const c = CAST[element];
    const k = Math.min(1.6, 0.6 + o.big);
    await new Promise<void>(res => this.fx.fly(from, to, {
      color: c.color, size: 0.55 * k, time: 0.55, arc: c.arc,
      trail: at => c.trail(at, k),
      hit: () => {
        for (const e of c.impact(to, k)) this.fx.emit(e);
        if (o.super) this.fx.emit({ at: to, count: 24, shape: 'spark', color: [0xffffff, ELEMENT[element].color], speed: [3, 6], life: [0.3, 0.6], size: [0.2, 0.4], drag: 3 });
        if (o.perfect) this.fx.emit({ at: to, count: 60, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xff9ad5, 0x9fe6ff], speed: [3, 8], life: [0.6, 1.2], size: [0.18, 0.36], drag: 1.5, gravity: 1 });
        this.grumble.hit(Math.min(1, 0.4 + o.big));
        this.shake = 0.18 + o.big * 0.25;
        res();
      },
    }));
  }

  /** A Glimmer (or the buddy's role, or outfit) adds a little extra cheer. `slot` -1 = the buddy. */
  async extra(slot: number, element: Element): Promise<void> {
    const g = slot >= 0 ? this.team[slot] : null;
    if (g) g.play('act');
    else this.play('jump', 0.8, 'fistpump');
    await sleep(220);
    const from = g ? g.root.position.clone().add(new THREE.Vector3(0, g.height * 0.7, 0)) : this.hand();
    const c = CAST[element];
    await new Promise<void>(res => this.fx.fly(from, this.foeCentre(), { color: c.color, size: 0.3, time: 0.45, arc: 0.8, trail: at => c.trail(at, 0.4), hit: () => { for (const e of c.impact(this.foeCentre(), 0.35)) this.fx.emit(e); this.grumble.hit(0.25); res(); } }));
  }

  /** Healing sparkles round the buddy (`slot`: who did it). */
  heal(slot: number) {
    const g = slot >= 0 ? this.team[slot] : null;
    g?.play('hop');
    this.fx.emit({ at: this.buddyAt.clone().add(new THREE.Vector3(0, 0.6, 0)), count: 26, shape: ['heart', 'star', 'dot'], color: [0x6ff0a0, 0xc6ffd8, 0xffe58a], speed: [0.4, 1.2], up: 2.5, radius: 0.35, life: [0.9, 1.5], size: [0.1, 0.2], drag: 1.2, gravity: -0.6 });
  }
  /** The Grumble freezes for a turn. */
  freeze(slot: number) {
    this.team[slot]?.play('act');
    this.fx.emit({ at: this.foeCentre(), count: 40, shape: ['shard', 'flake'], color: [0xbff0ff, 0xffffff, 0x7fd6ff], speed: [0.8, 2.5], radius: 0.5 * this.grumble.height, life: [1, 1.8], size: [0.15, 0.3], drag: 2, spin: 3 });
  }
  /** Dazzled by a strong element: stars round its head. */
  dazzle() {
    const top = this.foeCentre().add(new THREE.Vector3(0, 0.6 * this.grumble.height, 0));
    this.fx.emit({ at: top, count: 14, shape: 'star', color: [0xffe066, 0xffffff], speed: [0.6, 1.2], radius: 0.3, life: [0.9, 1.4], size: [0.14, 0.22], drag: 1.5, spin: 4 });
  }
  /** Aurora: northern lights fill the sky above the arena. */
  aurora() {
    for (let i = 0; i < 5; i++) this.fx.beam(this.C.clone().addScaledVector(this.right, (i - 2) * 1.4).addScaledVector(this.n, -2.5), [0x6fffc8, 0x5bd8ff, 0xb48cff, 0x6fffc8, 0xff8ad8][i], { radius: 0.6, height: 12, life: 2.6, peak: 0.7 });
  }

  /** The Grumble gets ready for mischief (the block prompt is up). */
  windup() { this.grumble.attack(); }

  /** The mischief lands: blocked fully, half, not at all, or skipped (frozen, a shell, hovering). */
  async mischief(kind: MischiefKind, result: 'full' | 'half' | 'none' | 'skip', why = ''): Promise<void> {
    const target = this.buddyAt.clone().add(new THREE.Vector3(0, 0.75, 0));
    if (result === 'skip') {
      if (why === 'frozen') { this.freeze(0); this.grumble.hit(0.2); await sleep(500); return; }
      if (why === 'Hover') { this.hover = 1.2; }
      this.fx.shieldAt(target, 1.0, why === 'Pebble Shell' ? 0xd6b48a : 0x9fe6ff, false);
      await sleep(400);
      return;
    }
    this.grumble.attack();
    await sleep(420);
    const from = this.foeCentre();
    const shield = result !== 'none';
    if (shield) this.fx.shieldAt(target, 1.0, result === 'full' ? 0x7fe0ff : 0xffd27a, result === 'half');
    if (kind === 'zap') {
      this.fx.lightning(from, shield ? target.clone().addScaledVector(this.right, -0.0).add(new THREE.Vector3(0.4, 0.3, 0)) : target, 0xfff1a0, 0.05);
      this.fx.emit({ at: target, count: 30, shape: 'spark', color: [0xfff1a0, 0xffffff], speed: [2, 5], life: [0.2, 0.5], size: [0.1, 0.25], drag: 4 });
    } else {
      const look: Record<Exclude<MischiefKind, 'zap'>, Emit> = {
        rain: { at: target.clone().add(new THREE.Vector3(0, 1.4, 0)), count: 60, shape: 'drop', color: [0x9fd0ff, 0xd6ecff], dir: new THREE.Vector3(0, -1, 0), spread: 0.15, speed: [3, 5], radius: 0.5, life: [0.4, 0.7], size: [0.08, 0.13], gravity: 6 },
        snow: { at: from, count: 40, shape: ['dot', 'flake'], color: [0xffffff, 0xd9f4ff], dir: target.clone().sub(from), spread: 0.15, speed: [5, 7], life: [0.5, 0.7], size: [0.12, 0.24], drag: 0.5 },
        pebbles: { at: from, count: 22, shape: 'pebble', color: [0xc9a27a, 0x9a7a5a, 0xd8c0a0], dir: target.clone().sub(from).add(new THREE.Vector3(0, 1.4, 0)), spread: 0.2, speed: [5, 6.5], life: [0.6, 0.8], size: [0.12, 0.2], gravity: 7, spin: 5 },
        gust: { at: from.clone().addScaledVector(this.right, 0.5), count: 50, shape: ['leaf', 'spark', 'dot'], color: [0xd8ffe0, 0x9fe6a0, 0xffffff], dir: target.clone().sub(from), spread: 0.25, speed: [6, 9], life: [0.5, 0.8], size: [0.1, 0.2], spin: 6, flutter: 3 },
      };
      if (kind === 'rain') this.cloudlet(target.clone().add(new THREE.Vector3(0, 1.5, 0)));
      this.fx.emit(look[kind]);
    }
    await sleep(kind === 'zap' ? 150 : 420);
    if (result === 'none') {
      this.play('stumble', 1.2, 'idle');
      this.fx.emit({ at: target, count: 24, shape: 'dot', color: [0x9aa3c8, 0xcfd6f0], speed: [1, 2.5], life: [0.4, 0.8], size: [0.15, 0.3], drag: 2 });
      this.shake = 0.3;
    } else if (result === 'full') {
      this.fx.emit({ at: target, count: 30, shape: ['ring', 'spark'], color: [0x7fe0ff, 0xffffff], speed: [1.5, 3.5], life: [0.3, 0.6], size: [0.15, 0.3], drag: 3 });
    } else {
      this.fx.emit({ at: target, count: 20, shape: 'shard', color: [0xffd27a, 0xffffff], speed: [1.5, 3], life: [0.4, 0.7], size: [0.1, 0.2], gravity: 4, spin: 6 });
      this.shake = 0.14;
    }
  }
  /** A little dark raincloud over the buddy for a moment. */
  private cloudlet(at: THREE.Vector3) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a7086, roughness: 1, transparent: true, opacity: 0.95 });
    for (const [x, y, r] of [[0, 0, 0.32], [-0.3, -0.05, 0.24], [0.3, -0.04, 0.25], [0.1, 0.18, 0.22]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat); m.position.set(x, y, 0); g.add(m); }
    g.position.copy(at); g.scale.setScalar(0.01);
    stage.scene.add(g);
    const t0 = performance.now();
    const tick = () => {
      const k = (performance.now() - t0) / 1400;
      g.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.8 ? Math.max(0.01, (1 - k) / 0.2) : 1);
      if (k < 1) requestAnimationFrame(tick); else { g.removeFromParent(); g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); mat.dispose(); }
    };
    tick();
  }

  /** The Finale: your buddy's dance under the lights, then a wave of every colour. */
  async finale(): Promise<void> {
    this.shot = 'buddy'; this.shotUntil = this.now + 3.2;
    this.play(this.opts.dance, 3.2, 'fistpump');
    const top = this.buddyAt.clone();
    [0xff7ab8, 0x7fd6ff, 0xffd166].forEach((c, i) => setTimeout(() => this.fx.beam(top.clone().addScaledVector(this.right, (i - 1) * 0.9).addScaledVector(this.n, -0.6), c, { radius: 0.55, height: 9, life: 2.6, peak: 0.8 }), i * 160));
    for (let i = 0; i < 6; i++) setTimeout(() => this.fx.emit({ at: top.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 14, shape: ['note', 'star', 'heart'], color: [0xff7ab8, 0xffd166, 0x7fd6ff, 0xb48cff], speed: [0.8, 1.8], up: 1.6, radius: 0.5, life: [1.2, 1.8], size: [0.16, 0.28], drag: 1, gravity: -0.3, spin: 2 }), i * 420);
    await sleep(2700);
    this.shot = 'wide';
    const cols = [0xff6fa8, 0xffb44d, 0xffe066, 0x6fe3a0, 0x5bb6ff, 0xa98cff];
    await new Promise<void>(res => {
      cols.forEach((c, i) => setTimeout(() => this.fx.fly(this.hand().add(new THREE.Vector3(0, 0.3 + i * 0.05, 0)), this.foeCentre(), {
        color: c, size: 0.7, time: 0.55, arc: 0.4 + i * 0.25,
        trail: at => ({ at, count: 3, shape: ['star', 'dot'], color: c, speed: [0.1, 0.5], life: [0.4, 0.7], size: [0.15, 0.25] }),
        hit: () => { this.fx.emit({ at: this.foeCentre(), count: 30, shape: ['star', 'spark', 'heart'], color: c, speed: [2, 6], life: [0.5, 1.1], size: [0.18, 0.34], drag: 1.6 }); this.grumble.hit(0.7); this.shake = 0.25; if (i === cols.length - 1) res(); },
      }), i * 90));
    });
  }

  setGrump(fraction: number) { this.grumble.mood = Math.max(0, Math.min(1, fraction)); }

  /** Cheered right up: the storm cloud bursts, its colours come back, and a beam of its rarity's colour
   *  comes down on it. */
  async cheerUp(_id: GlimmerId, rarity: Rarity): Promise<GlimmerModel | null> {
    this.grumble.mood = 0;
    await sleep(500);
    const at = this.foeCentre();
    this.grumble.burst();
    this.fx.emit({ at, count: 110, shape: ['star', 'dot', 'spark', 'heart'], color: [0xff6fa8, 0xffb44d, 0xffe066, 0x6fe3a0, 0x5bb6ff, 0xa98cff, 0xffffff], speed: [1.5, 6], life: [0.8, 1.8], size: [0.15, 0.35], drag: 1.4, gravity: 0.6, spin: 3 });
    this.play('cheer', 2.2, 'jump');
    await sleep(300);
    const rc = RARITY[rarity].color;
    this.fx.beam(this.foeAt.clone(), rc, { radius: 1.0 + (['legendary', 'mythic'].includes(rarity) ? 0.4 : 0), height: 16, life: 3.4, peak: 1 });
    this.fx.emit({ at: this.foeAt.clone().add(new THREE.Vector3(0, 0.2, 0)), count: 50, shape: ['ring', 'dot'], color: [rc, 0xffffff], dir: UP, spread: 0.9, speed: [1, 3], life: [0.8, 1.6], size: [0.2, 0.5], drag: 1.2 });
    this.revealed = this.grumble.glimmer;
    this.shot = 'reveal'; this.shotUntil = this.now + 99;
    const n = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].indexOf(rarity);
    for (let i = 0; i < 4 + n * 2; i++) setTimeout(() => this.fx.emit({ at: this.foeAt.clone().add(new THREE.Vector3(0, 2.5, 0)), count: 10, shape: ['star', 'dot'], color: [rc, 0xffffff], dir: new THREE.Vector3(0, -1, 0), spread: 0.6, speed: [0.3, 1], radius: 1, life: [1.4, 2.2], size: [0.1, 0.2], spin: 2 }), i * 300);
    return this.grumble.glimmer;
  }

  /** You ran out of Spark: the Grumble laughs and drifts off. */
  lose() {
    this.grumble.laugh();
    this.play('stumble', 1.5, 'idle');
    this.team.forEach(g => g?.play('sad'));
    setTimeout(() => { this.foeLeave = 0.001; }, 1600);
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    const me = this.me;
    me.root.position.copy(this.buddyAt);
    if (this.hover > 0) { this.hover -= dt; me.root.position.y += Math.sin(Math.min(1, this.hover / 1.2) * Math.PI) * 0.45; }
    // face the Grumble, turned a little toward you
    const toFoe = this.foeAt.clone().sub(this.buddyAt); toFoe.y = 0;
    const toCam = stage.camera.position.clone().sub(this.buddyAt); toCam.y = 0;
    const look = toFoe.normalize().multiplyScalar(0.62).add(toCam.normalize().multiplyScalar(this.shot === 'buddy' || this.shot === 'reveal' ? 0.9 : 0.38));
    me.root.rotation.set(0, Math.atan2(look.x, look.z), 0);
    if (this.now > this.busyUntil && me.currentName !== 'idle') me.play('idle', 0.4);
    me.update(dt);
    if (!me.root.visible) me.root.visible = true;
    // the grumpy Glimmer: turned between you and the buddy
    const toCamG = stage.camera.position.clone().sub(this.foeAt); toCamG.y = 0;
    const toBud = this.buddyAt.clone().sub(this.foeAt); toBud.y = 0;
    this.grumble.lookAt.copy(this.foeAt).add(toCamG.normalize().multiplyScalar(0.75).add(toBud.normalize().multiplyScalar(0.55)).multiplyScalar(4));
    if (this.foeLeave > 0) { this.foeLeave += dt; this.grumble.root.position.addScaledVector(this.right, dt * 1.4); }
    if (this.enterT < 1.6) {
      // its storm cloud comes down out of the sky, with a flash of lightning as it arrives
      const was = this.enterT; this.enterT += dt;
      const k = Math.min(1, this.enterT / 1.3), e = 1 - Math.pow(1 - k, 3);
      this.grumble.cloudLift = (1 - e) * 5;
      if (was < 1.2 && this.enterT >= 1.2) { const c = this.grumble.root.position.clone().add(new THREE.Vector3(0, this.grumble.height * 1.2, 0)); this.fx.lightning(c, this.foeAt.clone().add(new THREE.Vector3(0.35, 0.05, 0.2)), 0xfff1a0, 0.05); this.grumble.hit(0.4); this.shake = 0.22; }
    }
    this.grumble.update(dt, t);
    // the team and the newcomer
    for (const g of this.team) g?.update(dt, t);
    if (this.revealed) this.grumble.lookAt.copy(stage.camera.position);
    // banners wave, crystals turn and glow
    for (const b of this.banners) { const p = b.geometry.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const y = -p.getY(i); p.setZ(i, Math.sin(t * 2.6 + y * 4 + b.id) * 0.06 * y); } p.needsUpdate = true; }
    // the fire bowls flicker
    for (const f of this.fires) this.fx.emit({ at: f, count: Math.random() < 0.5 ? 2 : 1, shape: ['dot', 'spark'], color: [0xffd27a, 0xff9a3a], to: 0xff3d1a, dir: UP, spread: 0.25, speed: [0.5, 1.2], radius: 0.12, life: [0.35, 0.7], size: [0.18, 0.34], grow: -0.6, drag: 1 });
    this.lights.forEach((l, i) => (l.intensity = 6 + Math.sin(t * 13 + i * 2) * 0.8 + Math.sin(t * 7.3 + i) * 0.6));
    // floating motes of light over the arena
    this.moteT -= dt;
    if (this.moteT < 0) { this.moteT = 0.12; this.fx.emit({ at: this.C.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 1, shape: 'dot', color: [0xfff2b0, 0xffffff, 0xcfe8ff], speed: [0.1, 0.3], up: 3, radius: 3.2, life: [3, 5], size: [0.05, 0.1], drag: 0.2, gravity: -0.05 }); }
    this.fx.update(dt, t);
    this.camera(dt, t);
  }

  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandW = Math.max(0.2, v.right - v.left), bandH = Math.max(0.2, v.bottom - v.top);
    if (this.shot !== 'wide' && this.shot !== 'reveal' && this.now > this.shotUntil) this.shot = 'wide';
    const champ = this.opts.foe.champion;
    let focus: THREE.Vector3, span: number, high: number;
    if (this.shot === 'buddy') { focus = this.buddyAt.clone().add(new THREE.Vector3(0, 0.75, 0)); span = 3.2; high = 2.0; }
    else if (this.shot === 'reveal') { focus = this.foeAt.clone().lerp(this.buddyAt, 0.3).add(new THREE.Vector3(0, 0.75, 0)); span = 5.2; high = 2.6; }
    else { focus = this.C.clone().addScaledVector(this.right, champ ? 0.2 : 0).add(new THREE.Vector3(0, champ ? 1.35 : 0.92, 0)); span = champ ? 7.8 : 6.0; high = champ ? 3.4 : 2.9; }
    if (this.shot === 'push') { focus.addScaledVector(this.right, 0.35); span *= 0.94; }
    // a tall phone screen: closer in, so the buddy and the Grumble aren't tiny
    if (this.compact && this.shot === 'wide') span = champ ? 4.9 : 3.9;
    else if (this.compact && this.shot !== 'buddy') span *= 0.7;
    // fit the span across the band's width, and the height (about span/2.4) into its height
    const d = Math.max(span / (bandW * 2 * tanH * cam.aspect), (span / 2.2) / (bandH * 2 * tanH));
    const sway = Math.sin(t * 0.25) * 0.12;
    const dir = this.n.clone().applyAxisAngle(UP, sway - 0.08);
    const wantPos = focus.clone().addScaledVector(dir, d).add(new THREE.Vector3(0, d * 0.2 + 0.25, 0));
    const aim = focus.clone();
    const ndcX = 2 * ((v.left + v.right) / 2) - 1, ndcY = 1 - 2 * ((v.top + v.bottom) / 2);
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), UP).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).y -= ndcY * d * tanH;
    void high;
    if (!this.camReady) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.camReady = true; }
    const k = 1 - Math.exp(-dt * (this.shot === 'wide' ? 2.5 : 3.5));
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos);
    if (this.shake > 0) { this.shake = Math.max(0, this.shake - dt * 1.4); cam.position.x += (Math.random() - 0.5) * this.shake * 0.25; cam.position.y += (Math.random() - 0.5) * this.shake * 0.2; }
    cam.lookAt(this.camAim);
  }

  focus() { return this.C; }
  dispose() {
    this.me.dispose(); this.grumble.dispose(); this.fx.dispose();
    for (const g of this.team) g?.dispose();
    this.revealed?.dispose();
    this.arena.removeFromParent();
    this.arena.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.shared) { (m.material as THREE.Material)?.dispose?.(); } });
  }
}

// ---------- how each element's power looks ----------
type CastLook = { color: number; arc: number; trail: (at: THREE.Vector3, k: number) => Emit; impact: (at: THREE.Vector3, k: number) => Emit[] };
const CAST: Record<Element, CastLook> = {
  sun: {
    color: 0xffc23d, arc: 1.0,
    trail: (at, k) => ({ at, count: Math.round(4 * k), shape: ['star', 'dot', 'spark'], color: [0xffe066, 0xffb02e, 0xffffff], to: 0xff6a00, speed: [0.2, 0.9], life: [0.3, 0.6], size: [0.1, 0.22], drag: 2 }),
    impact: (at, k) => [
      { at, count: Math.round(50 * k), shape: ['star', 'spark', 'dot'], color: [0xffe066, 0xffb02e, 0xffffff], to: 0xff7a00, speed: [2.5, 7], life: [0.4, 0.9], size: [0.15, 0.32], drag: 2.2 },
      { at, count: 3, shape: 'ring', color: 0xffd166, speed: [0, 0.01], life: [0.5, 0.6], size: [0.6, 0.8], grow: 4 },
    ],
  },
  tide: {
    color: 0x46b4ff, arc: 0.9,
    trail: (at, k) => ({ at, count: Math.round(4 * k), shape: ['drop', 'dot'], color: [0x9fd8ff, 0x46b4ff, 0xffffff], speed: [0.2, 0.8], life: [0.3, 0.6], size: [0.08, 0.16], gravity: 3 }),
    impact: (at, k) => [
      { at, count: Math.round(55 * k), shape: ['drop', 'dot'], color: [0x9fd8ff, 0x46b4ff, 0xffffff], dir: UP, spread: 1.2, speed: [2.5, 6], life: [0.6, 1.1], size: [0.09, 0.2], gravity: 9 },
      { at, count: 2, shape: 'ring', color: 0x9fd8ff, speed: [0, 0.01], life: [0.5, 0.6], size: [0.6, 0.8], grow: 4 },
    ],
  },
  frost: {
    color: 0x9fe6ff, arc: 0.7,
    trail: (at, k) => ({ at, count: Math.round(4 * k), shape: ['flake', 'dot'], color: [0xffffff, 0xbff0ff], speed: [0.2, 0.7], life: [0.4, 0.8], size: [0.1, 0.2], spin: 3 }),
    impact: (at, k) => [
      { at, count: Math.round(36 * k), shape: 'shard', color: [0xbff0ff, 0xffffff, 0x7fd6ff], speed: [2.5, 6], life: [0.4, 0.8], size: [0.14, 0.3], drag: 2, spin: 8, gravity: 2 },
      { at, count: Math.round(30 * k), shape: 'flake', color: [0xffffff, 0xd9f4ff], speed: [0.5, 2], life: [1, 1.8], size: [0.1, 0.2], drag: 1.5, flutter: 1.5, gravity: 0.6, spin: 2 },
    ],
  },
  leaf: {
    color: 0x6fe08a, arc: 1.2,
    trail: (at, k) => ({ at, count: Math.round(3 * k), shape: ['leaf', 'petal'], color: [0x6fe08a, 0xb6f58f, 0xffb3d1], speed: [0.3, 1], life: [0.5, 0.9], size: [0.12, 0.2], spin: 6, flutter: 2 }),
    impact: (at, k) => [
      { at, count: Math.round(45 * k), shape: ['leaf', 'petal', 'dot'], color: [0x6fe08a, 0xb6f58f, 0xffb3d1, 0xffffff], speed: [2, 5.5], life: [0.8, 1.5], size: [0.12, 0.24], drag: 2, spin: 6, flutter: 3, gravity: 1 },
    ],
  },
  stone: {
    color: 0xd6b48a, arc: 1.4,
    trail: (at, k) => ({ at, count: Math.round(3 * k), shape: ['pebble', 'dot'], color: [0xd6b48a, 0xa88a6a], speed: [0.2, 0.6], life: [0.3, 0.6], size: [0.08, 0.16], gravity: 4 }),
    impact: (at, k) => [
      { at, count: Math.round(30 * k), shape: 'pebble', color: [0xd6b48a, 0xa88a6a, 0xe8d4b8], dir: UP, spread: 1.3, speed: [2.5, 5.5], life: [0.6, 1], size: [0.1, 0.22], gravity: 9, spin: 6 },
      { at, count: Math.round(24 * k), shape: 'dot', color: [0xe8d4b8, 0xc9b49a], speed: [1, 2.5], life: [0.6, 1.1], size: [0.25, 0.5], drag: 2.5, grow: 1 },
    ],
  },
};
