// The Cheer Duel's stage: a round stone arena on the island trail, glowing crystal pillars and element
// banners round its back, a ruined arch behind. Your buddy stands on the left with up to two Glimmers;
// the Grumble floats on the right. The screen calls the moves (cast a power, a Glimmer's extra, mischief
// and a block, the Finale, the cheer-up) and gets back promises that resolve at the moment of impact, so
// numbers and sounds land with the hits. A block is a real shield: a glowing round one in front of the
// buddy, faint while the quick question is up, solid when it's answered; the counterattack bangs into it
// and gets knocked back at the Grumble. Missed, it flies straight at the buddy, who gets knocked back.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import type { Slot } from '../adventure/gear';
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
type Opts = { buddy: FriendId; outfit: string; dance: string; region: RegionId; team: GlimmerId[]; foe: { glimmer: GlimmerId; rarity: Rarity; champion: boolean; evolved?: boolean }; view: View; /** which team members are grown up */ teamEvolved?: boolean[]; /** hand, back and shoe gear */ kit?: Partial<Record<Slot, string>> };
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
  /** the painted storm-cloud pictures (the same as the grumpy Glimmer's cloud) */
  private stormTex: (THREE.Texture | null)[] = [];
  private revealed: GlimmerModel | null = null;
  private foeGone = false; private foeLeave = 0;
  private hover = 0;
  private lights: THREE.PointLight[] = [];
  private moteT = 0;
  /** the Grumble drifts down out of the sky at the start (seconds since) */
  private enterT = 0;
  private compact = false;
  /** the block shield: 'ready' (faint, while the quick question is up), 'up' (solid), 'off' */
  private shield = new THREE.Group(); private shieldFace: THREE.MeshStandardMaterial | null = null; private shieldGlow: THREE.SpriteMaterial | null = null;
  private shieldMode: 'off' | 'ready' | 'up' = 'off'; private shieldK = 0; private shieldAge = 0; private shieldFlash = 0; private shieldKick = 0;
  /** the Grumble knocked back by its own counterattack (eases back), the buddy knocked back by one that lands */
  private foePush = 0; private flinch = 0;

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
    team.forEach((g, i) => { if (!g) return; const s = spots[i]; s.y = island.height(s.x, s.z); g.root.position.copy(s); stage.scene.add(g.root); g.face = this.foeAt.clone(); g.fx = this.fx; });
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
  }

  static async create(opts: Opts): Promise<BattleScene> {
    const [island, me, ...team] = await Promise.all([
      stage.getIsland(opts.region), Character.create(opts.buddy),
      ...opts.team.slice(0, 2).map((id, i) => GlimmerModel.create(id, GLIMMER[id].rarity === 'legendary' || GLIMMER[id].rarity === 'mythic' ? 0.8 : 0.62, { evolved: opts.teamEvolved?.[i] }).catch(() => null)),
    ]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    const storm = await Promise.all([loadTexture('game/storm1.webp'), loadTexture('game/storm2.webp')]);
    await me.loadMoves();
    const grumble = await GrumpyGlimmer.create(opts.foe.glimmer, opts.foe.champion, opts.foe.evolved);
    const sc = new BattleScene(island, me, grumble, team as (GlimmerModel | null)[], opts);
    sc.stormTex = storm;
    await sc.buildArena();
    sc.buildShield(await loadTexture('game/icon-star.webp'));
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

  /** The block shield: a round, slightly domed disc of blue light with a gold rim and a star in the middle
   *  (the same look as the shield picture on the block question). */
  private buildShield(star: THREE.Texture | null) {
    const R = this.compact ? 0.31 : 0.36;
    // the face: painted once on a canvas, light in the middle, rings of light, a shine at the top
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    gr.addColorStop(0, '#e6fbff'); gr.addColorStop(0.35, '#8fdcff'); gr.addColorStop(0.8, '#3a9cff'); gr.addColorStop(1, '#2a6fe6');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 6;
    for (const r of [64, 100]) { g.beginPath(); g.arc(128, 128, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(96, 70, 46, 22, -0.5, 0, Math.PI * 2); g.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    // a shallow dome bulging toward the Grumble (+z once it's turned to face it)
    const big = R * 1.6, th = Math.asin(1 / 1.6);
    const dome = new THREE.SphereGeometry(big, 48, 10, 0, Math.PI * 2, 0, th);
    dome.rotateX(Math.PI / 2); dome.translate(0, 0, -big * Math.cos(th));
    this.shieldFace = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, color: 0xffffff, emissive: 0x7fcfff, emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    const face = new THREE.Mesh(dome, this.shieldFace);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.11, 14, 64), new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0x7a5200, emissiveIntensity: 0.5, metalness: 0.85, roughness: 0.3 }));
    const lift = big * (1 - Math.cos(th));
    const emblem = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.95, R * 0.95), new THREE.MeshBasicMaterial({ map: star, color: star ? 0xffffff : 0xffe066, transparent: true, depthWrite: false, opacity: star ? 1 : 0 }));
    emblem.position.z = lift + 0.01;
    // a soft glow behind it, brighter when something hits
    const glowCv = document.createElement('canvas'); glowCv.width = glowCv.height = 128;
    const gg = glowCv.getContext('2d')!, rg = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.4, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
    this.shieldGlow = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowCv), color: 0x7fd8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
    const glow = new THREE.Sprite(this.shieldGlow); glow.scale.setScalar(R * 3.4); glow.position.z = -0.05;
    this.shield.add(glow, face, rim, emblem);
    this.shield.traverse(o => { o.renderOrder = 6; });
    this.shield.visible = false;
    stage.scene.add(this.shield);
  }
  /** Where the shield stands: in front of the buddy, toward the Grumble, turned half toward you so it reads
   *  as a shield (and not a thin line) while it faces the attack. */
  private shieldSpot(): { at: THREE.Vector3; face: THREE.Vector3 } {
    const toFoe = this.foeAt.clone().sub(this.buddyAt).setY(0).normalize();
    const toCam = stage.camera.position.clone().sub(this.buddyAt).setY(0).normalize();
    const at = this.buddyAt.clone().addScaledVector(toFoe, this.compact ? 0.42 : 0.5).addScaledVector(toCam, 0.25).add(new THREE.Vector3(0, this.compact ? 0.62 : 0.7, 0));
    return { at, face: toFoe.multiplyScalar(0.7).add(toCam.multiplyScalar(0.75)).normalize() };
  }
  /** The middle of the shield's front, where a counterattack bangs into it. */
  private shieldFront() { const s = this.shieldSpot(); return s.at.addScaledVector(s.face, 0.12); }
  /** The quick question is up: a faint shield, waiting for the answer. */
  shieldReady() { this.shieldMode = 'ready'; this.shieldAge = 0; }
  /** Answered: the shield snaps up, solid. */
  private shieldUp() { this.shieldMode = 'up'; this.shieldAge = 0; this.shieldFlash = 0.6; }
  /** Not answered in time: the faint shield pops into bits. */
  private shieldPop() {
    if (this.shieldMode === 'ready' && this.shieldK > 0.05) this.fx.emit({ at: this.shieldSpot().at, count: 22, shape: ['shard', 'dot'], color: [0x9fdcff, 0xffffff], speed: [0.8, 2.2], radius: 0.25, life: [0.4, 0.7], size: [0.08, 0.16], gravity: 3, spin: 6 });
    this.shieldMode = 'off';
  }

  // ---------- where things are ----------
  private hand() { return this.buddyAt.clone().add(new THREE.Vector3(0, 0.95, 0)).addScaledVector(this.right, 0.35); }
  private foeCentre() { return this.grumble.centre; }
  /** A point on screen (fractions of the window) for a thing: for floating numbers. */
  screenOf(which: 'buddy' | 'foe' | 'team0' | 'team1' | 'reveal' | 'shield', dy = 0): { x: number; y: number } {
    const p = which === 'shield' ? this.shieldSpot().at.add(new THREE.Vector3(0, 0.45 + dy, 0))
      : which === 'buddy' ? this.buddyAt.clone().add(new THREE.Vector3(0, 1.3 + dy, 0))
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

  /** The Grumble gets ready for mischief (the block prompt is up): a faint shield waits for the answer. */
  windup() { this.grumble.attack(); this.shieldReady(); }

  /** The counterattack. Blocked: the shield snaps up, the attack bangs into it and bounces back at the
   *  Grumble. Not blocked: it flies at the buddy, who is knocked back. Skipped: a helper's bubble (or a
   *  freeze, or hovering) takes it. Resolves at the moment it hits, so the sound and the number land with it. */
  async mischief(kind: MischiefKind, result: 'full' | 'half' | 'none' | 'skip', why = ''): Promise<void> {
    const target = this.buddyAt.clone().add(new THREE.Vector3(0, 0.75, 0));
    if (result === 'skip') {
      this.shieldMode = 'off';
      if (why === 'frozen') { this.freeze(0); this.grumble.hit(0.2); await sleep(500); return; }
      if (why === 'Hover') { this.hover = 1.2; }
      this.fx.shieldAt(target, 1.0, why === 'Pebble Shell' ? 0xd6b48a : 0x9fe6ff, false);
      await sleep(400);
      return;
    }
    const look = HURL[kind];
    const blocked = result !== 'none';
    if (blocked) this.shieldUp(); else this.shieldPop();
    this.grumble.attack();
    await sleep(320);
    const from = this.foeCentre();
    const to = blocked ? this.shieldFront() : target;
    if (kind === 'zap') { this.fx.lightning(from, to, 0xfff1a0, 0.05); await sleep(90); }
    else await new Promise<void>(res => this.fx.fly(from, to, { color: look.color, size: 0.42, time: 0.5, arc: look.arc, trail: at => look.trail(at), hit: res }));
    if (blocked) {
      // it bangs into the shield: a flash, sparks and bits of it flying off, the shield pushed back a little
      const face = this.shieldSpot().face;
      this.shieldFlash = 1; this.shieldKick = 1;
      this.fx.emit({ at: to, count: 26, shape: ['spark', 'star'], color: [0xffffff, 0xbff0ff, 0xffe066], speed: [2.5, 5.5], dir: face, spread: 0.9, life: [0.25, 0.5], size: [0.14, 0.3], drag: 3 });
      this.fx.emit({ ...look.splash(to), dir: face.clone().add(new THREE.Vector3(0, 0.6, 0)), spread: 0.8 });
      this.fx.emit({ at: to, count: 1, shape: 'ring', color: 0xbff0ff, speed: [0, 0.01], life: [0.3, 0.35], size: [0.3, 0.35], grow: 1.6 });
      this.shake = 0.14;
      void this.knockBack(kind, to);
      return;
    }
    // it lands: the buddy is knocked back a step, with a splash of whatever it was
    this.fx.emit(look.splash(target));
    if (kind === 'rain') this.cloudlet(target.clone().add(new THREE.Vector3(0, 1.5, 0)));
    this.play('stumble', 1.0, 'idle');
    this.flinch = 1;
    this.shake = 0.35;
  }
  /** A blocked counterattack bounces back at the Grumble and knocks it back a little. */
  private async knockBack(kind: MischiefKind, from: THREE.Vector3) {
    const look = HURL[kind];
    await sleep(120);
    await new Promise<void>(res => this.fx.fly(from, this.foeCentre(), { color: look.color, size: 0.34, time: 0.42, arc: 0.55, trail: at => look.trail(at), hit: res }));
    const at = this.foeCentre();
    this.fx.emit(look.splash(at));
    this.fx.emit({ at, count: 12, shape: 'star', color: [0xffffff, 0xffe066], speed: [1, 2.5], life: [0.4, 0.7], size: [0.12, 0.22], drag: 2, spin: 4 });
    this.grumble.hit(0.35);
    this.foePush = 1;
    this.shake = Math.max(this.shake, 0.1);
    this.shieldMode = 'off';
  }
  /** A little raincloud over the buddy for a moment: the same painted storm cloud the grumpy Glimmer sits
   *  under (and the duel's rain clouds), raining for a beat. */
  private cloudlet(at: THREE.Vector3) {
    const g = new THREE.Group();
    const mats: THREE.SpriteMaterial[] = [];
    [[0, 0, 1], [-0.3, -0.05, 0.75], [0.32, -0.04, 0.8]].forEach(([x, y, w], k) => {
      const t = this.stormTex[k % 2] ?? null;
      const m = new THREE.SpriteMaterial({ map: t, color: 0x9aa2bc, transparent: true, depthWrite: false, opacity: t ? 1 : 0 });
      mats.push(m);
      const sp = new THREE.Sprite(m);
      sp.scale.set(0.95 * w, 0.95 * w * 0.48, 1); sp.position.set(x * 0.95, y * 0.45, k * -0.02); sp.renderOrder = 2; g.add(sp);
    });
    g.position.copy(at); g.scale.setScalar(0.01);
    stage.scene.add(g);
    const t0 = performance.now();
    let rained = false;
    const tick = () => {
      const k = (performance.now() - t0) / 1400;
      g.scale.setScalar(k < 0.15 ? k / 0.15 : k > 0.8 ? Math.max(0.01, (1 - k) / 0.2) : 1);
      g.position.x = at.x + Math.sin(k * 9) * 0.03;
      if (!rained && k > 0.18) { rained = true; this.fx.emit({ at: g.position.clone().add(new THREE.Vector3(0, -0.15, 0)), count: 60, shape: 'drop', color: [0x9fd0ff, 0xd6ecff], dir: new THREE.Vector3(0, -1, 0), spread: 0.15, speed: [3, 5], radius: 0.4, life: [0.4, 0.7], size: [0.08, 0.13], gravity: 6 }); }
      if (k < 1) requestAnimationFrame(tick); else { g.removeFromParent(); mats.forEach(m => m.dispose()); }
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
    // knocked back by a counterattack that got through: a quick step away from the Grumble and back
    const away = this.buddyAt.clone().sub(this.foeAt).setY(0).normalize();
    let lean = 0;
    if (this.flinch > 0) { this.flinch = Math.max(0, this.flinch - dt * 2.2); const k = Math.sin(this.flinch * Math.PI); me.root.position.addScaledVector(away, 0.22 * k); lean = 0.32 * k; }
    if (this.hover > 0) { this.hover -= dt; me.root.position.y += Math.sin(Math.min(1, this.hover / 1.2) * Math.PI) * 0.45; }
    // face the Grumble, turned a little toward you
    const toFoe = this.foeAt.clone().sub(this.buddyAt); toFoe.y = 0;
    const toCam = stage.camera.position.clone().sub(this.buddyAt); toCam.y = 0;
    const look = toFoe.normalize().multiplyScalar(0.62).add(toCam.normalize().multiplyScalar(this.shot === 'buddy' || this.shot === 'reveal' ? 0.9 : 0.38));
    me.root.rotation.set(0, Math.atan2(look.x, look.z), 0);
    if (lean) me.root.rotateX(-lean);
    if (this.now > this.busyUntil && me.currentName !== 'idle') me.play('idle', 0.4);
    me.update(dt);
    if (!me.root.visible) me.root.visible = true;
    // the grumpy Glimmer: turned between you and the buddy
    const toCamG = stage.camera.position.clone().sub(this.foeAt); toCamG.y = 0;
    const toBud = this.buddyAt.clone().sub(this.foeAt); toBud.y = 0;
    this.grumble.lookAt.copy(this.foeAt).add(toCamG.normalize().multiplyScalar(0.75).add(toBud.normalize().multiplyScalar(0.55)).multiplyScalar(4));
    if (this.foeLeave > 0) { this.foeLeave += dt; this.grumble.root.position.addScaledVector(this.right, dt * 1.4); }
    else if (this.foePush > 0 || this.grumble.root.position.distanceToSquared(this.foeAt) > 1e-6) {
      // knocked back by its own counterattack: pushed away, then it drifts back to its spot
      this.foePush = Math.max(0, this.foePush - dt * 1.6);
      const k = this.foePush > 0.75 ? (1 - this.foePush) / 0.25 : this.foePush / 0.75;
      this.grumble.root.position.copy(this.foeAt).addScaledVector(away, -0.45 * k);
    }
    this.updateShield(dt, t);
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

  private updateShield(dt: number, t: number) {
    if (!this.shieldFace || !this.shieldGlow) return;
    this.shieldAge += dt;
    const want = this.shieldMode === 'up' ? 1 : this.shieldMode === 'ready' ? 0.32 : 0;
    this.shieldK += (want - this.shieldK) * (1 - Math.exp(-dt * (this.shieldMode === 'up' ? 22 : 7)));
    // a solid shield goes away on its own a little after it's done its job
    if (this.shieldMode === 'up' && this.shieldAge > 2.2) this.shieldMode = 'off';
    this.shield.visible = this.shieldK > 0.02;
    if (!this.shield.visible) return;
    this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
    this.shieldKick = Math.max(0, this.shieldKick - dt * 4);
    const s = this.shieldSpot();
    // waiting: smaller and breathing; snapping up: a quick pop bigger than it ends up
    const pop = this.shieldMode === 'up' ? 1 + 0.22 * Math.sin(Math.min(1, this.shieldAge / 0.28) * Math.PI) : 0.78 + 0.04 * Math.sin(t * 7);
    this.shield.position.copy(s.at).addScaledVector(s.face, -0.18 * Math.sin(this.shieldKick * Math.PI));
    this.shield.lookAt(this.shield.position.clone().add(s.face));
    this.shield.scale.setScalar(Math.max(0.01, pop * (0.6 + 0.4 * this.shieldK)));
    // waiting, it's mostly its gold ring (an outline to fill); up, it's solid
    this.shieldFace.opacity = 0.92 * this.shieldK * this.shieldK;
    this.shieldFace.emissiveIntensity = 0.55 + 0.4 * this.shieldK + this.shieldFlash * 2.2;
    this.shieldGlow.opacity = 0.25 * this.shieldK + this.shieldFlash * 0.55;
    this.shield.traverse(o => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m && m !== this.shieldFace && m !== this.shieldGlow) { m.transparent = true; m.opacity = Math.min(1, this.shieldK * 1.6); } });
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
    this.shield.removeFromParent();
    // (the star picture is shared, so only the shield's own canvas pictures go)
    this.shieldFace?.map?.dispose(); this.shieldGlow?.map?.dispose(); this.shieldGlow?.dispose();
    this.shield.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } });
    this.arena.removeFromParent();
    this.arena.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && !m.userData.shared) { (m.material as THREE.Material)?.dispose?.(); } });
  }
}

// ---------- how each element's power looks ----------
export type CastLook = { color: number; arc: number; trail: (at: THREE.Vector3, k: number) => Emit; impact: (at: THREE.Vector3, k: number) => Emit[] };
export const CAST: Record<Element, CastLook> = {
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

// ---------- how each counterattack looks, thrown ----------
type Hurl = { color: number; arc: number; trail: (at: THREE.Vector3) => Emit; splash: (at: THREE.Vector3) => Emit };
const HURL: Record<MischiefKind, Hurl> = {
  rain: { color: 0x7fc4ff, arc: 0.5, trail: at => ({ at, count: 3, shape: ['drop', 'dot'], color: [0x9fd0ff, 0xd6ecff], speed: [0.2, 0.6], life: [0.3, 0.5], size: [0.08, 0.14], gravity: 3 }),
    splash: at => ({ at, count: 40, shape: ['drop', 'dot'], color: [0x9fd0ff, 0xd6ecff, 0xffffff], speed: [2, 4.5], up: 0.6, life: [0.4, 0.8], size: [0.08, 0.15], gravity: 8 }) },
  snow: { color: 0xffffff, arc: 0.45, trail: at => ({ at, count: 3, shape: ['flake', 'dot'], color: [0xffffff, 0xd9f4ff], speed: [0.2, 0.6], life: [0.4, 0.7], size: [0.1, 0.18], spin: 3 }),
    splash: at => ({ at, count: 34, shape: ['dot', 'flake'], color: [0xffffff, 0xd9f4ff], speed: [1.5, 3.5], life: [0.5, 0.9], size: [0.12, 0.24], drag: 2, gravity: 2, spin: 3 }) },
  pebbles: { color: 0xd6b48a, arc: 0.8, trail: at => ({ at, count: 2, shape: ['pebble', 'dot'], color: [0xd6b48a, 0xa88a6a], speed: [0.2, 0.5], life: [0.3, 0.5], size: [0.08, 0.14], gravity: 4 }),
    splash: at => ({ at, count: 18, shape: 'pebble', color: [0xc9a27a, 0x9a7a5a, 0xd8c0a0], speed: [2, 4], up: 0.8, life: [0.5, 0.8], size: [0.1, 0.18], gravity: 9, spin: 6 }) },
  gust: { color: 0xbaf5c8, arc: 0.3, trail: at => ({ at, count: 3, shape: ['leaf', 'spark'], color: [0xd8ffe0, 0x9fe6a0], speed: [0.3, 0.9], life: [0.3, 0.6], size: [0.1, 0.18], spin: 6, flutter: 2 }),
    splash: at => ({ at, count: 30, shape: ['leaf', 'spark', 'dot'], color: [0xd8ffe0, 0x9fe6a0, 0xffffff], speed: [2, 4.5], life: [0.4, 0.8], size: [0.1, 0.2], spin: 6, flutter: 3, drag: 1.5 }) },
  zap: { color: 0xfff1a0, arc: 0.4, trail: at => ({ at, count: 3, shape: ['spark', 'dot'], color: [0xfff1a0, 0xffffff], speed: [0.3, 1], life: [0.2, 0.4], size: [0.1, 0.2], drag: 3 }),
    splash: at => ({ at, count: 30, shape: 'spark', color: [0xfff1a0, 0xffffff], speed: [2, 5], life: [0.2, 0.5], size: [0.1, 0.25], drag: 4 }) },
};
