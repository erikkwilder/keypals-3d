// My Sky Island in 3D: a round floating island in a golden-hour sky, grass on top, blocks of warm stone
// underneath tapering into the clouds, ivy and flowers hanging over the edge, two waterfalls running down
// the cliff and away into the cloud sea, little rocks floating close by and other islands far off. On it:
// whatever the child built (island/props3d.ts), their buddy pottering about (or walked with the keys, the
// stick or a tap, as in the garden), up to eight of their Glimmers wandering, napping and playing by the
// home of their element, and now and then a visitor floating down on a cloud with a present.
//
// The camera turns round the island (drag), comes closer or further (pinch, scroll), slides (two fingers,
// right-drag), and frames the whole island in the space the screen leaves for it. In build mode a soft
// grid shows the squares, and the thing being placed or moved hovers over its squares, green where it fits.
//
// Blocks the child builds (three/islandBlocks.ts) are solid ground: the buddy and the Glimmers walk up ramps
// and stairs, stand on roofs and walk off bridges (the walking rules are island/blocks.ts), and a tap on a
// roof finds the way round to the ramp. The Glimmers use what's built: they swim in ponds, nap on benches,
// warm up on the sun dais and perch on high blocks; you can pet them, feed them treats and throw a ball for
// them to bring back, and now and then one thinks of a wish (a picture in a bubble). The island's secrets
// (three/islandSecrets.ts) live here too, and the evening brings the night sky.
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import { Fx } from './fx';
import { loadGltf, loadTexture } from './assets';
import { GlimmerModel } from './glimmerModel';
import { THEMES } from './themes';
import { blocked, resolve, step, type Box, type Solid } from './gardenLayout';
import { BlockKit } from './islandBlocks';
import { IslandSecrets } from './islandSecrets';
import { BLOCK, BUDDY_STEP, CLEAR, JUMP_UP, SHAPE, blockCells, fall, findPath, floorAt, perches, spansAt, standUp, walk, wallAt, worldOf, type Block, type P3, type ShapeId, type World } from '../island/blocks';
import { HouseRoom, ROOM_D, ROOM_H, ROOM_W } from './islandRoom';
import { rocksOf, onRock, WHALE_Y } from '../island/secrets';
import type { Island } from './island';
import type { View } from './runScene';
import type { FriendId } from '../art/cast';
import type { Dress } from '../adventure/gear';
import { GLIMMER, type GlimmerId } from '../adventure/glimmers';
import { sfx } from '../audio/sound';
import { CLIMB, HOMES, ITEM, HABITAT_OF } from '../island/catalog';
import { centerOf, footprint, type IslandSave, type Placed, type Rot } from '../island/save';
import { PropKit, type Tick } from '../island/props3d';
import { gridTex, stones } from '../island/paint';
import { drawThumbs } from './islandThumbs';

/** how tall a Glimmer stands on the island */
const GLIM_H = 0.8;
/** one square of the grid, in metres */
export const CELL = 1;
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

export type Out = { id: GlimmerId; level: number; evolved: boolean };
/** Something the buddy can do where it is (the E key or the action button): talk to a Glimmer, swing,
 *  go into a house, climb a tree or the lookout, get off or down again, go outside, read the house's note. */
export type Near = { kind: 'talk'; id: GlimmerId } | { kind: 'swing' | 'house' | 'tree'; uid: string } | { kind: 'off' } | { kind: 'note' } | { kind: 'jump' };
/** the buddy's jump: the speed it leaves the ground with (it reaches JUMP_UP), and the island's pull */
const GRAV = 15, JUMP_V = Math.sqrt(2 * GRAV * JUMP_UP);
/** where the house's room is: well away from the island, under the cloud sea */
const ROOM_AT = new THREE.Vector3(0, -240, 0);
type Doing =
  | { kind: 'swing'; uid: string; t0: number }
  | { kind: 'tree'; uid: string; t0: number; phase: 'up' | 'over' | 'top' | 'down'; c: THREE.Vector3; side: THREE.Vector3; r: number; climbTop: number; stand: number; from: THREE.Vector3; to: THREE.Vector3; pt0: number }
  | { kind: 'inside'; uid: string; item: string; p: { x: number; y: number; z: number }; door: THREE.Vector3; out: number };
export type Pick = { kind: 'glimmer'; id: GlimmerId } | { kind: 'visitor' } | { kind: 'item'; uid: string } | { kind: 'buddy' } | { kind: 'roomnote' }
  | { kind: 'bottle' } | { kind: 'note' } | { kind: 'rainbow' } | { kind: 'butterfly' } | null;
/** what a build tool would do where the pointer is: the square a new piece goes in, or the block a tool acts on */
export type Aim = { place: Block | null; on: Block | null; key: string | null };
/** a Glimmer's place to be: in a pond, on a bench, on the sun dais, up on the blocks */
type Spot = { kind: 'swim' | 'sit' | 'warm' | 'perch'; at: THREE.Vector3; r: number; face?: number; taken?: GlimmerId };
type Thing = { uid: string; pl: Placed; obj: THREE.Object3D; tick: Tick | null; pop: number };
type Mood = 'idle' | 'walk' | 'nap' | 'play' | 'swim' | 'sit' | 'warm' | 'perch' | 'fetch' | 'bring' | 'munch';
/** what a Glimmer's body keeps doing in each mood (glimmerMotion.ts) */
const MOOD_POSE: Record<Mood, 'idle' | 'walk' | 'sit' | 'sleep' | 'swim'> = { idle: 'idle', walk: 'walk', nap: 'sleep', play: 'idle', swim: 'swim', sit: 'sit', warm: 'sit', perch: 'sit', fetch: 'walk', bring: 'walk', munch: 'idle' };
type Pal = {
  id: GlimmerId; m: GlimmerModel; mood: Mood; until: number; to: THREE.Vector3 | null; home: THREE.Vector3 | null; hopAt: number; zzz: number; heart?: THREE.Sprite; heartT?: number; heartAt?: number;
  /** where it is (its feet), how fast it's falling */
  p3: P3; vy: number;
  /** a hop through the air (on to a bench, up a tower, into a pond) and what it does when it lands */
  hop?: { from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; h: number; then: Mood; until: number } | null;
  /** the place it's walking to, to do something there */
  next?: Spot | null; spot?: Spot | null;
  /** a wish bubble over its head */
  wish?: THREE.Sprite | null;
  /** munching a treat until then */
  munch?: number;
};

/** The island's edge at an angle: round, with a gentle wobble so it never looks drawn with a compass. */
const edge = (R: number, a: number) => R * (1 + 0.028 * Math.sin(3 * a + 0.7) + 0.018 * Math.sin(5 * a + 2.1) + 0.01 * Math.sin(11 * a + 0.3));
/** how far in the cliff comes at a depth below the grass (1: right under the edge, 0: the point) */
function taper(y: number, H: number) {
  const k = -y / H;
  const pts: [number, number][] = [[0, 1], [0.07, 0.995], [0.17, 0.955], [0.3, 0.87], [0.45, 0.72], [0.62, 0.5], [0.78, 0.29], [0.92, 0.1], [1, 0]];
  for (let i = 1; i < pts.length; i++) if (k <= pts[i][0]) { const [a0, b0] = pts[i - 1], [a1, b1] = pts[i]; return b0 + ((k - a0) / (a1 - a0)) * (b1 - b0); }
  return 0;
}

export class IslandScene implements Controller {
  get fps() { return this.busyT > 0 || this.drive.x || this.drive.z || this.goto || this.air || this.doing ? 60 : 40; }
  readonly island: Island;
  view: View;
  private kit: PropKit;
  private root: THREE.Group;
  private fx = new Fx();
  private own: { dispose(): void }[] = [];
  private keep = <T extends { dispose(): void }>(x: T) => { this.own.push(x); return x; };
  private sun!: THREE.DirectionalLight;
  /** the island's size: squares from the middle, and metres to its grassy edge */
  r = 5; private rimR = 6;
  private land = new THREE.Group();
  private things = new Map<string, Thing>();
  private solids: Solid[] = []; private boxes: Box[] = [];
  private me: Character | null = null;
  private pals: Pal[] = [];
  private visitor: { pal: Pal; arrive: number; from: THREE.Vector3; at: THREE.Vector3; present: THREE.Object3D | null; cloud: THREE.Sprite | null; opened: boolean } | null = null;
  private grid: THREE.Mesh | null = null;
  private marker: THREE.Mesh;
  private ghost: { obj: THREE.Object3D; item: string; x: number; z: number; rot: Rot; ok: boolean; hide: string | null } | null = null;
  private selected: string | null = null;
  private floaters: { o: THREE.Object3D; y: number; ph: number }[] = [];
  private flies: { g: THREE.Group; l: THREE.Object3D; r: THREE.Object3D; ph: number; sp: number; rad: number; y: number }[] = [];
  private goldWing: THREE.Material | null = null; private wingMat: THREE.Material | null = null;
  private clouds: THREE.Sprite[] = [];
  private extras: THREE.Object3D[] = [];
  private fall = { uT: { value: 0 } };
  private now = 0;
  /** the camera: round a spot, at a height and distance (the default frames the whole island) */
  private cam = { target: new THREE.Vector3(), yaw: 0.0, pitch: 0.6, dist: 20 };
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private framed = true;
  private busyT = 0;
  /** walking the buddy yourself */
  private drive = { x: 0, z: 0 };
  private goto: THREE.Vector3 | null = null;
  private walk = { mode: 'idle' as 'idle' | 'walk' | 'drive', to: new THREE.Vector3(), until: 0, lastDrive: -99 };
  private growK = 1; private growFrom = 1;
  /** told when a visitor lands (to show its card) */
  onLanded: (() => void) | null = null;
  /** told when the buddy gets somewhere secret: the cave rock, the floating rock, high enough to see the whale */
  onReach: ((what: 'cave' | 'skyrock' | 'whale') => void) | null = null;
  /** told when a Glimmer brings the ball back */
  onFetched: ((id: GlimmerId) => void) | null = null;
  private blk!: BlockKit;
  readonly secrets: IslandSecrets;
  /** what walkers walk on: the blocks, the secret rocks, the grass */
  world: World = { cols: new Map(), rocks: [], groundR: 5 };
  private rocks = rocksOf(5);
  private blockSq = new Set<string>();
  private spots: Spot[] = [];
  /** the buddy's feet, its falling speed, where its picture stands (steps eased) and the way it's walking */
  private meP: P3 = { x: 0, y: 0, z: 0 }; private meVy = 0; private meShow = 0;
  private path: P3[] = [];
  private ball: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t0: number; who: GlimmerId; phase: 'fly' | 'rest' | 'held'; } | null = null;
  /** sky: day to night (0..1) and rain (0..1), eased toward what's wanted */
  private weather = { dark: 0, rain: 0, wantDark: 0, wantRain: 0 };
  private skyU: Record<string, { value: THREE.Color }> | null = null;
  private hemi!: THREE.HemisphereLight;
  private golden = { on: false, t: 0 };
  private reached = new Set<string>();
  // ---------- the buddy's moves (jumping, the swing, climbing, the house) ----------
  /** in the air: its rising speed */
  private air: { vy: number } | null = null;
  /** a squash as it lands (seconds into it), and the buddy's own size */
  private squashT = -1; private meScale = new THREE.Vector3(1, 1, 1);
  private doing: Doing | null = null;
  private room: HouseRoom | null = null;
  private roomBusy = false;
  private camWas: { target: THREE.Vector3; yaw: number; pitch: number; dist: number; framed: boolean } | null = null;
  /** the Glimmer the buddy is talking to */
  private talking: GlimmerId | null = null;
  /** the houses whose note was read this time on the island */
  private notesRead = new Set<string>();
  /** told when the buddy goes into a house (the item) or comes out (null) */
  onInside: ((item: string | null) => void) | null = null;

  private constructor(island: Island, kit: PropKit, root: THREE.Group, view: View) {
    this.island = island; this.kit = kit; this.root = root; this.view = view;
    this.marker = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.keep(new THREE.MeshBasicMaterial({ color: 0x5fe08a, transparent: true, opacity: 0.45, depthWrite: false })));
    this.marker.visible = false; this.marker.renderOrder = 1;
    root.add(this.marker);
    stage.scene.add(this.fx.root);
    this.secrets = new IslandSecrets(this.fx, this.fall.uT);
    root.add(this.secrets.root);
    if (import.meta.env.DEV) Object.assign(window, { __isle: this, __stage: stage });
  }

  static async create(o: { save: IslandSave; r: number; buddy: FriendId; dress?: Dress | null; view: View; grewFrom?: number; caveOpen?: boolean }): Promise<IslandScene> {
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
    const root = new THREE.Group();
    const T = { ...THEMES.village, fog: 0xf3dcc4 };
    const [kit, blk] = await Promise.all([PropKit.load(), BlockKit.load()]);
    const island: Island = {
      trail: { length: 1, at: () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) }) as unknown as ReturnType<Island['trail']['at']> },
      height: () => 0, placeFinish: () => {}, gateSolid: () => {}, root, theme: T as Island['theme'], stats: {},
      setSmooth: () => {}, update: () => {}, dispose: () => { for (const x of own) x.dispose(); },
    };
    const sc = new IslandScene(island, kit, root, o.view);
    island.setSmooth = (on) => { for (const c of sc.clouds) c.visible = !on || c.userData.near; sc.extras.forEach((e, i) => (e.visible = !on || !!e.userData.keep || i % 3 === 0)); };
    sc.own.push(...own);
    sc.r = o.r; sc.rimR = (o.r + 0.95) * CELL;
    sc.blk = blk; root.add(blk.root);
    sc.rocks = rocksOf(o.r);
    await sc.sky();
    await sc.buildLand(o.r);
    await sc.secrets.build(sc.rocks, sc.rimR, !!o.caveOpen);
    if (o.grewFrom && o.grewFrom < o.r) { sc.growFrom = (o.grewFrom + 0.95) / (o.r + 0.95); sc.growK = 0; }
    sc.sync(o.save);
    for (const t of sc.things.values()) t.pop = 1;
    // the buddy
    const me = await Character.create(o.buddy);
    if (me) {
      stage.scene.add(me.root);
      me.play('idle', 0);
      void dressUp(me, o.dress === undefined ? undefined : o.dress);
      void me.loadMoves();
      me.root.position.copy(sc.freeSpot(new THREE.Vector3(0.6, 0, 2.6)));
      me.root.rotation.y = 0.3;
      sc.meScale.copy(me.root.scale);
      sc.meP = { x: me.root.position.x, y: 0, z: me.root.position.z };
      standUp(sc.world, sc.meP); sc.meShow = sc.meP.y;
      sc.me = me;
    }
    sc.frame(true);
    return sc;
  }

  // ---------- the sky round the island ----------
  private async sky() {
    const root = this.root, keep = this.keep, rnd = rand(17);
    // low over the cloud sea, back and to the left, so it shows in the view (the light itself comes from the front)
    const sunDir = new THREE.Vector3(-0.42, -0.17, -0.89).normalize();
    const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1500, 32, 16)), keep(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x7fb2ea) }, mid: { value: new THREE.Color(0xf7d7b4) }, low: { value: new THREE.Color(0xffeccd) }, sunDir: { value: sunDir }, sunA: { value: 1 } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top, mid, low, sunDir; uniform float sunA; varying vec3 vDir;
        void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.55, -0.15, y)); c = mix(c, top, smoothstep(-0.2, 0.35, y));
          float s = max(0.0, dot(normalize(vDir), sunDir));
          c += sunA * vec3(1.0, 0.88, 0.62) * (smoothstep(0.9993, 0.9997, s) * 1.4 + pow(s, 60.0) * 0.5 + pow(s, 8.0) * 0.22);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })));
    sky.renderOrder = -1; root.add(sky);
    this.skyU = (sky.material as THREE.ShaderMaterial).uniforms as unknown as Record<string, { value: THREE.Color }>;
    for (const k of ['top', 'mid', 'low']) this.skyU[k + '0'] = { value: this.skyU[k].value.clone() };
    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x9ab06a, 1.25);
    this.hemi = hemi;
    const sun = new THREE.DirectionalLight(0xffe4c0, 2.55);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.userData.dir = new THREE.Vector3(-0.5, 0.82, 0.42).normalize();
    root.add(hemi, sun, sun.target);
    this.sun = sun;
    // the cloud sea below, and a few clouds up in the sky (they always face you)
    const cloudTex = await loadTexture('world/cloud.webp');
    if (cloudTex) {
      const low = keep(new THREE.SpriteMaterial({ map: cloudTex, color: 0xfff3e6, transparent: true, depthWrite: false, fog: true }));
      const high = keep(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffe9d6, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
      this.cloudMats = [{ m: low, c: low.color.clone() }, { m: high, c: high.color.clone() }];
      // the sea of cloud the island floats over, from just under the cliff out to the horizon
      for (let i = 0; i < 64; i++) {
        const a = rnd() * Math.PI * 2, r = this.rimR + 5 + Math.pow(rnd(), 0.9) * 170;
        const s = new THREE.Sprite(low), sz = 16 + rnd() * 22 + r * 0.16;
        s.scale.set(sz * 2.2, sz, 1);
        s.position.set(Math.cos(a) * r, -13 - rnd() * 8 - r * 0.16, Math.sin(a) * r);
        s.userData.near = r < 45;
        root.add(s); this.clouds.push(s);
      }
      // a few big soft ones far off, behind the other islands
      for (let i = 0; i < 9; i++) {
        const a = -2.6 + (i / 9) * 5.2 + rnd() * 0.3, r = 330 + rnd() * 150, sz = 50 + rnd() * 40;
        const s = new THREE.Sprite(high); s.scale.set(sz * 2.2, sz, 1);
        s.position.set(Math.cos(a) * r, 10 + rnd() * 60, Math.sin(a) * r);
        root.add(s); this.clouds.push(s);
      }
    }
    // other islands, far off, at different heights; and rocks floating close by
    const isl = await loadGltf('world/island.glb');
    if (isl) {
      const box = new THREE.Box3().setFromObject(isl.scene), unit = 1 / Math.max(1e-6, box.getSize(new THREE.Vector3()).y);
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 - 1.45 + (i / 7) * 2.9 + (rnd() - 0.5) * 0.2, d = 85 + rnd() * 90;
        const c = isl.scene.clone(true), h = 7 + rnd() * 9;
        c.scale.setScalar(h * unit); c.position.set(Math.cos(a) * d, -d * (0.2 + rnd() * 0.14), Math.sin(a) * d); c.rotation.y = rnd() * 6;
        root.add(c); this.extras.push(c);
        this.floaters.push({ o: c, y: c.position.y, ph: rnd() * 6 });
      }
    }
    const rockMat = keep(new THREE.MeshStandardMaterial({ map: stones(keep, { big: true, seed: 77 }), roughness: 0.95 }));
    const capMat = keep(new THREE.MeshStandardMaterial({ map: (await loadTexture('world/grass.webp', { repeat: true })) ?? null, color: 0xe8ffd8 }));
    for (let i = 0; i < 5; i++) {
      const a = (i < 3 ? 2.75 : 0.15) + (i % 3) * 0.28 + rnd() * 0.12, d = this.rimR + 3.5 + rnd() * 4;
      const g = new THREE.Group(); g.position.set(Math.cos(a) * d, -2 - rnd() * 3, Math.sin(a) * d);
      const block = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.62, 0.3, 0.85, 7)), rockMat); block.position.y = -0.42; g.add(block);
      const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.66, 0.63, 0.12, 7)), capMat); cap.position.y = 0.04; g.add(cap);
      g.scale.setScalar(0.55 + rnd() * 0.7); g.rotation.y = rnd() * 6;
      g.traverse(m => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
      root.add(g); this.floaters.push({ o: g, y: g.position.y, ph: rnd() * 6 });
    }
    // butterflies
    const fly = await loadTexture('garden/butterfly.webp');
    if (fly) {
      const wingMat = keep(new THREE.MeshStandardMaterial({ map: fly, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }));
      const half = (left: boolean) => {
        const g = new THREE.PlaneGeometry(0.11, 0.2), uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, left ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
        g.translate(left ? -0.055 : 0.055, 0, 0); g.rotateX(-Math.PI / 2); return keep(g);
      };
      const lg = half(true), rg = half(false);
      for (let i = 0; i < 5; i++) { const g = new THREE.Group(), l = new THREE.Mesh(lg, wingMat), r = new THREE.Mesh(rg, wingMat); g.add(l, r); g.scale.setScalar(1.4); root.add(g); this.flies.push({ g, l, r, ph: i * 1.9, sp: 0.5 + (i % 3) * 0.15, rad: 1.5 + i * 0.7, y: 0.8 + (i % 2) * 0.5 }); }
      // the golden one (a secret): golden wings and a glitter trail, a little bigger
      this.goldWing = keep(new THREE.MeshStandardMaterial({ map: fly, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.3, metalness: 0.4, color: 0xffd34d, emissive: 0xb07800, emissiveIntensity: 0.6 }));
      this.wingMat = wingMat;
    }
  }

  // ---------- the island itself ----------
  private async buildLand(r: number) {
    const keep = this.keep, land = this.land, R = (r + 0.95) * CELL, H = 7 + R * 0.45;
    land.clear(); this.root.add(land);
    const [grassTex, leafTex, flowerTex, headTex] = await Promise.all([loadTexture('world/grass.webp', { repeat: true }), loadTexture('garden/leaves-card.webp'), loadTexture('world/flowers.webp'), loadTexture('garden/heads.webp')]);
    this.headTex = headTex; this.leafTex = leafTex;
    // the grass: rings out from the middle to a soft lip that rolls over the edge
    const S = 120, RINGS = 26, pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
    const lip = (k: number) => (k < 0.94 ? 0 : -0.22 * Math.pow((k - 0.94) / 0.06, 2));
    for (let i = 0; i <= RINGS; i++) {
      const k = i / RINGS;
      for (let j = 0; j <= S; j++) {
        const a = (j / S) * Math.PI * 2, e = edge(R, a) * (k < 0.94 ? k : 0.94 + (k - 0.94) * 1.05), x = Math.cos(a) * e, z = Math.sin(a) * e;
        pos.push(x, lip(k), z); uv.push(x / 2.4, z / 2.4);
        const n = 0.5 + 0.5 * Math.sin(x * 0.9 + Math.sin(z * 0.7) * 2) * Math.sin(z * 0.8 - x * 0.3);
        const l = 1.02 - 0.12 * Math.pow(k, 3) + n * 0.07;
        col.push(l * (0.98 + n * 0.04), l, l * (0.9 + n * 0.05));
      }
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + S + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); top.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    top.setIndex(idx); top.computeVertexNormals();
    const grassMat = keep(new THREE.MeshStandardMaterial({ map: grassTex, vertexColors: true, color: 0xffffff, roughness: 0.95 }));
    grassMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        { float l = dot(diffuseColor.rgb, vec3(0.3, 0.55, 0.15)); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.33, 0.62, 0.16) * (0.75 + l * 0.7), 0.5); }`);
    };
    grassMat.customProgramCacheKey = () => 'isle-grass';
    const grass = new THREE.Mesh(keep(top), grassMat);
    grass.receiveShadow = true; land.add(grass);
    // the cliff: stone blocks under the lip, bulging a little, tapering down to a point in the clouds
    const cliffTex = stones(keep, { big: true, seed: 41 });
    const CS = 96, CR = 22, cp: number[] = [], cu: number[] = [], cc: number[] = [], ci: number[] = [];
    for (let i = 0; i <= CR; i++) {
      const y = -0.18 - (i / CR) * H, k = taper(y + 0.18, H);
      for (let j = 0; j <= CS; j++) {
        const a = (j / CS) * Math.PI * 2;
        const lump = 1 + 0.05 * Math.sin(a * 9 + y * 1.3) + 0.045 * Math.sin(a * 17 - y * 2.1) + 0.035 * Math.sin(a * 5 + y * 3.3);
        const e = edge(R, a) * 0.995 * k * (i === 0 ? 1 : lump);
        cp.push(Math.cos(a) * e, y, Math.sin(a) * e);
        cu.push((j / CS) * (2 * Math.PI * R) / 3.2, y / 3.2);
        const d = 1 - 0.38 * (i / CR);
        cc.push(d, d * 0.97, d * 0.94);
      }
    }
    for (let i = 0; i < CR; i++) for (let j = 0; j < CS; j++) { const a = i * (CS + 1) + j, b = a + CS + 1; ci.push(a, a + 1, b, a + 1, b + 1, b); }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3)); cg.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2)); cg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    cg.setIndex(ci); cg.computeVertexNormals();
    const cliff = new THREE.Mesh(keep(cg), keep(new THREE.MeshStandardMaterial({ map: cliffTex, vertexColors: true, roughness: 0.95 })));
    cliff.castShadow = true; cliff.receiveShadow = true; land.add(cliff);

    // ivy and flowers hanging over the edge, and grass tufts along the lip
    const rnd = rand(5 + r);
    const vine = this.vineTexture(keep);
    const vineMat = keep(new THREE.MeshStandardMaterial({ map: vine, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.7 }));
    const vg = keep(new THREE.PlaneGeometry(0.5, 1).translate(0, -0.5, 0));
    const NV = Math.round(R * 7);
    const vines = new THREE.InstancedMesh(vg, vineMat, NV); vines.castShadow = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < NV; i++) {
      const a = (i / NV) * Math.PI * 2 + rnd() * 0.05, e = edge(R, a) * 1.005 + 0.03, len = 0.8 + Math.pow(rnd(), 1.5) * 2.6;
      q.setFromAxisAngle(up, -a + Math.PI / 2 + (rnd() - 0.5) * 0.3);
      m4.compose(new THREE.Vector3(Math.cos(a) * e, -0.08, Math.sin(a) * e), q, sv.set(0.8 + rnd() * 0.6, len, 1));
      vines.setMatrixAt(i, m4);
    }
    land.add(vines);
    // flowers round the rim: the painted meadow flowers, crossed cards
    if (flowerTex && !this.flowerMat) { this.flowerTex = flowerTex; this.flowerMat = keep(new THREE.MeshStandardMaterial({ map: flowerTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 })); }
    if (flowerTex) {
      const fm = keep(new THREE.MeshStandardMaterial({ map: flowerTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }));
      const parts: THREE.BufferGeometry[] = [];
      const NF = Math.round(R * 14);
      for (let i = 0; i < NF; i++) {
        const a = rnd() * Math.PI * 2, e = edge(R, a) * (0.88 + rnd() * 0.08), cell = Math.floor(rnd() * 3), cx = cell % 3, cy = Math.floor(cell / 3), h = 0.3 + rnd() * 0.22;
        for (const t of [0, Math.PI / 2]) {
          const p = new THREE.PlaneGeometry(h * 0.66, h), puv = p.attributes.uv as THREE.BufferAttribute;
          for (let k = 0; k < puv.count; k++) puv.setXY(k, (cx + puv.getX(k)) / 3, 1 - (cy + 1 - puv.getY(k)) / 2);
          p.translate(0, h / 2, 0); p.rotateY(t + rnd()); p.translate(Math.cos(a) * e, 0, Math.sin(a) * e); parts.push(p);
        }
      }
      const fl = new THREE.Mesh(keep(mergeAll(parts)), fm); land.add(fl); this.extras.push(fl);
    }
    // leafy tufts at the lip
    if (leafTex) {
      const lm = keep(new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, color: 0xd8f5b8 }));
      const NT = Math.round(R * 10), tuft = keep(new THREE.PlaneGeometry(0.42, 0.34).translate(0, 0.12, 0));
      const tm = new THREE.InstancedMesh(tuft, lm, NT);
      for (let i = 0; i < NT; i++) {
        const a = (i / NT) * Math.PI * 2 + rnd() * 0.1, e = edge(R, a) * (0.97 + rnd() * 0.03);
        q.setFromEuler(new THREE.Euler(-0.3 - rnd() * 0.4, -a + Math.PI / 2 + (rnd() - 0.5), 0, 'YXZ'));
        m4.compose(new THREE.Vector3(Math.cos(a) * e, -0.06, Math.sin(a) * e), q, sv.setScalar(0.8 + rnd() * 0.7));
        tm.setMatrixAt(i, m4);
      }
      land.add(tm);
    }
    // small rocks and bushes round the rim (outside the squares you build on)
    const [bush, boulder] = await Promise.all([loadGltf('world/bush.glb'), loadGltf('world/boulder.glb')]);
    const put = (g: Awaited<ReturnType<typeof loadGltf>>, n: number, h0: number, h1: number, k0: number, k1: number) => {
      if (!g) return;
      const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2, e = edge(R, a) * (k0 + rnd() * (k1 - k0)), h = h0 + rnd() * (h1 - h0), s = h / size.y;
        const c = g.scene.clone(true); c.scale.setScalar(s); c.position.set(Math.cos(a) * e, -box.min.y * s - 0.04, Math.sin(a) * e); c.rotation.y = rnd() * 6;
        c.traverse(m => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = true; } });
        land.add(c);
      }
    };
    put(bush, Math.round(R * 1.1), 0.32, 0.55, 0.9, 0.97);
    put(boulder, Math.round(R * 1.2), 0.18, 0.4, 0.9, 0.98);
    // two waterfalls: a little spring at the rim, the water running down the cliff and on into the clouds
    const fallMat = keep(new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { uT: this.fall.uT },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uT; varying vec2 vUv;
        float n(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        float sn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(n(i), n(i+vec2(1,0)), f.x), mix(n(i+vec2(0,1)), n(i+vec2(1,1)), f.x), f.y); }
        void main(){ float streak = sn(vec2(vUv.x * 14.0, vUv.y * 9.0 + uT * 2.6)) * 0.6 + sn(vec2(vUv.x * 34.0, vUv.y * 16.0 + uT * 4.0)) * 0.4;
          float side = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
          float fade = smoothstep(0.95, 0.55, vUv.y) * smoothstep(0.0, 0.03, vUv.y);
          vec3 c = mix(vec3(0.58, 0.84, 0.96), vec3(1.0), smoothstep(0.35, 0.8, streak));
          gl_FragColor = vec4(c, side * fade * (0.6 + 0.38 * streak));
          #include <colorspace_fragment>
        }`,
    }));
    const spring = this.kit.waterMat(0x2a8fd0, 0x9fe4f4);
    for (const a of [Math.PI * 0.93, Math.PI * 0.06]) {
      const W = 1.0, STEPS = 30, fp: number[] = [], fu: number[] = [], fi: number[] = [];
      const tx = -Math.sin(a), tz = Math.cos(a);
      for (let i = 0; i <= STEPS; i++) {
        const k = i / STEPS, y = 0.02 - k * (H + 5);
        const yy = Math.max(-H, y), rr = edge(R, a) * 1.0 * taper(Math.min(0, yy + 0.18), H) + 0.12 + Math.max(0, -y - 0.6) * 0.06 + (y < -H ? (-H - y) * 0.15 : 0);
        const cx = Math.cos(a) * rr, cz = Math.sin(a) * rr;
        for (const s of [-1, 1]) { fp.push(cx + tx * s * W / 2, y, cz + tz * s * W / 2); fu.push(s < 0 ? 0 : 1, k); }
      }
      for (let i = 0; i < STEPS; i++) { const b = i * 2; fi.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
      const fgeo = new THREE.BufferGeometry(); fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fgeo.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); fgeo.setIndex(fi);
      const fall = new THREE.Mesh(keep(fgeo), fallMat); fall.renderOrder = 3; land.add(fall);
      // the spring: a little pool in a ring of stones on the rim
      const e = edge(R, a) * 0.93, sp = new THREE.Mesh(keep(new THREE.CircleGeometry(0.46, 24).rotateX(-Math.PI / 2)), spring);
      sp.position.set(Math.cos(a) * e, 0.03, Math.sin(a) * e); land.add(sp);
      if (boulder) for (let i = 0; i < 7; i++) {
        const b = boulder.scene.clone(true), ba = a + Math.PI / 2 + (i / 6) * Math.PI;
        b.scale.setScalar(0.12 + (i % 3) * 0.03); b.position.set(Math.cos(a) * e + Math.cos(ba) * 0.46, 0, Math.sin(a) * e + Math.sin(ba) * 0.46);
        b.traverse(m => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
        land.add(b);
      }
    }
    // the grid for building
    const gt = gridTex(keep, r), n = Math.ceil(r) * 2 + 1;
    this.grid = new THREE.Mesh(keep(new THREE.PlaneGeometry(n * CELL, n * CELL).rotateX(-Math.PI / 2)), keep(new THREE.MeshBasicMaterial({ map: gt, transparent: true, depthWrite: false, opacity: 0.9 })));
    this.grid.position.y = 0.012; this.grid.visible = false; this.grid.renderOrder = 1; land.add(this.grid);
    // the sun's shadows cover the island
    Object.assign(this.sun.shadow.camera, { left: -R - 2, right: R + 2, top: R + 2, bottom: -R - 2, near: 1, far: 80 });
    this.sun.shadow.camera.updateProjectionMatrix();
  }
  /** a strand of ivy with leaves and a few flowers, painted on a canvas */
  private vineTexture(keep: <T extends { dispose(): void }>(x: T) => T) {
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 512;
    const g = cv.getContext('2d')!, r = rand(3);
    for (let s = 0; s < 3; s++) {
      let x = 30 + s * 34, y = 0;
      g.strokeStyle = '#4f7d2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y);
      const pts: [number, number][] = [];
      while (y < 500 - s * 90) { y += 18; x += (r() - 0.5) * 10; g.lineTo(x, y); pts.push([x, y]); }
      g.stroke();
      pts.forEach(([px, py], i) => {
        const side = i % 2 ? 1 : -1, l = 0.8 + r() * 0.5;
        g.save(); g.translate(px, py); g.rotate(side * (0.6 + r() * 0.5));
        const gr = g.createLinearGradient(0, -12, 0, 12); gr.addColorStop(0, '#9fe060'); gr.addColorStop(1, '#3f8f2f');
        g.fillStyle = gr; g.beginPath(); g.ellipse(side * 10 * l, 0, 11 * l, 7 * l, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,90,30,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(side * 18 * l, 0); g.stroke();
        g.restore();
        if (r() < 0.16) {
          const c = ['#ff8fc0', '#ffffff', '#ffd34d', '#c79bff'][Math.floor(r() * 4)];
          g.fillStyle = c; for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; g.beginPath(); g.arc(px + Math.cos(a) * 5, py + Math.sin(a) * 5, 4.2, 0, 7); g.fill(); }
          g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(px, py, 3, 0, 7); g.fill();
        }
      });
    }
    const t = keep(new THREE.CanvasTexture(cv)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }

  // ---------- what's built ----------
  /** Show the save's things: new ones pop in, moved ones move, put-away ones go. */
  sync(save: IslandSave) {
    const seen = new Set<string>();
    for (const [uid, pl] of Object.entries(save.placed)) {
      if (!ITEM[pl.item]) continue;
      seen.add(uid);
      let t = this.things.get(uid);
      if (!t) {
        const obj = this.kit.make(pl.item);
        if (!obj) continue;
        this.root.add(obj);
        t = { uid, pl, obj, tick: this.kit.tickFor(obj), pop: 0 };
        this.things.set(uid, t);
        if (this.now > 0) { const c = this.centre(pl); this.fx.emit({ at: c.clone().setY(0.4), count: 26, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8, 0xb8ffcf], speed: [0.8, 2.2], up: 1.2, life: [0.4, 0.8], size: [0.08, 0.16], drag: 2 }); }
      }
      t.pl = pl;
      const c = this.centre(pl);
      t.obj.position.set(c.x, 0, c.z);
      t.obj.rotation.y = -pl.rot * Math.PI / 2;
      t.obj.visible = this.ghost?.hide !== uid;
    }
    for (const [uid, t] of this.things) if (!seen.has(uid)) { t.obj.removeFromParent(); this.things.delete(uid); if (this.selected === uid) this.select(null); }
    this.solidsFrom();
    // the blocks: drawn, and walked on (anyone a block landed on climbs out on top)
    this.blk.sync(save.blocks);
    this.world = worldOf(save.blocks, [this.rocks.cave, this.rocks.sky], this.walkR);
    this.blockSq = blockCells(save.blocks);
    standUp(this.world, this.meP);
    for (const p of this.pals) if (!p.hop && p.mood !== 'swim' && p.mood !== 'sit' && p.mood !== 'warm') standUp(this.world, p.p3);
    this.meadow();
    this.spotsFrom();
    // Glimmers who live by a home of their element
    for (const p of this.pals) p.home = this.homeOf(GLIMMER[p.id].element);
  }
  /** the places Glimmers like to be: ponds to swim in, bench seats, the sun dais, the tops of high blocks */
  private spotsFrom() {
    const was = new Map(this.spots.map(sp => [`${sp.kind}|${sp.at.x.toFixed(2)}|${sp.at.z.toFixed(2)}`, sp.taken]));
    const out: Spot[] = [];
    for (const t of this.things.values()) {
      const id = t.pl.item, c = this.centre(t.pl), turn = -t.pl.rot * Math.PI / 2;
      if (id === 'pond') out.push({ kind: 'swim', at: c.clone().setY(0.03), r: 0.55 });
      else if (id === 'tidepond' || id === 'icepool') out.push({ kind: 'swim', at: c.clone().setY(0.04), r: 0.45 });
      else if (id === 'bench') for (const sx of [-0.42, 0.42]) out.push({ kind: 'sit', at: c.clone().add(new THREE.Vector3(Math.cos(turn) * sx, 0.47, -Math.sin(turn) * sx)), r: 0, face: turn });
      else if (id === 'sundais') for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.5; out.push({ kind: 'warm', at: c.clone().add(new THREE.Vector3(Math.cos(a) * 0.45, 0.29, Math.sin(a) * 0.45)), r: 0 }); }
    }
    for (const q of perches(this.world, 1.0).slice(0, 8)) out.push({ kind: 'perch', at: new THREE.Vector3(q.x, q.y, q.z), r: 0 });
    for (const sp of out) sp.taken = was.get(`${sp.kind}|${sp.at.x.toFixed(2)}|${sp.at.z.toFixed(2)}`);
    // a Glimmer whose place went (a bench put away, a tower taken down) gets down
    for (const p of this.pals) if (p.spot && !out.some(sp => sp.taken === p.id)) { p.spot = null; if (p.mood !== 'walk' && p.mood !== 'fetch' && p.mood !== 'bring') this.hopDown(p); }
    this.spots = out;
  }
  /** a thing's middle on the ground, in metres */
  private centre(pl: Placed) { const it = ITEM[pl.item], c = centerOf(it, pl.x, pl.z, pl.rot); return new THREE.Vector3(c.x * CELL, 0, c.z * CELL); }
  private solidsFrom() {
    this.solids = []; this.boxes = [];
    for (const t of this.things.values()) {
      const it = ITEM[t.pl.item];
      if (!it || it.flat || !t.obj.visible) continue;
      const c = this.centre(t.pl), f = footprint(it, t.pl.rot);
      if (it.trunk) this.solids.push({ x: c.x, z: c.z, r: it.trunk * CELL, tall: true });
      else this.boxes.push({ x0: c.x - f.w * CELL / 2 + 0.08, x1: c.x + f.w * CELL / 2 - 0.08, z0: c.z - f.d * CELL / 2 + 0.08, z1: c.z + f.d * CELL / 2 - 0.08 });
    }
  }
  private homeOf(el: string): THREE.Vector3 | null {
    const id = HABITAT_OF[el as keyof typeof HABITAT_OF];
    const t = [...this.things.values()].find(x => x.pl.item === id);
    return t ? this.centre(t.pl) : null;
  }
  private get walkR() { return (this.r + 0.35) * CELL; }
  /** a free spot near a point (out of everything solid, on the island) */
  private freeSpot(near: THREE.Vector3, r = 0.3): THREE.Vector3 {
    const p = resolve({ x: near.x, z: near.z }, this.solids, this.boxes, r, this.walkR - 0.2);
    return new THREE.Vector3(p.x, 0, p.z);
  }
  private randomSpot(around: THREE.Vector3 | null, spread: number, r = 0.25): THREE.Vector3 {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, d = around ? 0.9 + Math.random() * spread : Math.sqrt(Math.random()) * (this.walkR - 0.6);
      const p = { x: (around?.x ?? 0) + Math.cos(a) * d, z: (around?.z ?? 0) + Math.sin(a) * d };
      if (Math.hypot(p.x, p.z) < this.walkR - 0.4 && !blocked(p, this.solids, this.boxes, r)) return new THREE.Vector3(p.x, 0, p.z);
    }
    return this.freeSpot(around ?? new THREE.Vector3(), r);
  }

  // ---------- grass tufts and little flowers on the free squares ----------
  private tufts: THREE.InstancedMesh | null = null;
  private blooms: THREE.InstancedMesh[] = [];
  private meadowKit() {
    if (this.tufts) return;
    const keep = this.keep;
    // a tuft of grass blades, painted
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d')!, r = rand(9);
    for (let i = 0; i < 16; i++) {
      const x = 30 + r() * 68, lean = (r() - 0.5) * 50, h = 60 + r() * 60, w = 5 + r() * 4;
      const gr = g.createLinearGradient(0, 128, 0, 128 - h); gr.addColorStop(0, '#5aa83a'); gr.addColorStop(1, ['#c4ee7a', '#a8e266', '#d6f590'][i % 3]);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w, 128); g.quadraticCurveTo(x + lean * 0.3, 128 - h * 0.6, x + lean, 128 - h); g.quadraticCurveTo(x + lean * 0.3 + w * 0.6, 128 - h * 0.55, x + w, 128); g.closePath(); g.fill();
    }
    const tex = keep(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
    const cross = (w: number, h: number) => { const a = new THREE.PlaneGeometry(w, h).translate(0, h / 2, 0), b = a.clone().rotateY(Math.PI / 2); const m = mergeAll([a, b]); return keep(m); };
    this.tufts = new THREE.InstancedMesh(cross(0.42, 0.3), keep(new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 })), 900);
    this.tufts.count = 0; this.tufts.frustumCulled = false; this.root.add(this.tufts);
    if (this.headTex) {
      const headMat = keep(new THREE.MeshStandardMaterial({ map: this.headTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5 }));
      for (let c = 0; c < 6; c++) {
        const geo = keep(new THREE.PlaneGeometry(0.17, 0.17)), uv = geo.attributes.uv as THREE.BufferAttribute, cx = c % 3, cy = Math.floor(c / 3);
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (cx + uv.getX(k)) / 3, 1 - (cy + 1 - uv.getY(k)) / 2);
        geo.rotateX(-1.1); geo.translate(0, 0.13, 0);
        const m = new THREE.InstancedMesh(geo, headMat, 320); m.count = 0; m.frustumCulled = false; this.root.add(m); this.blooms.push(m);
      }
    }
    if (this.leafTex) {
      const lm = keep(new THREE.MeshStandardMaterial({ map: this.leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6 }));
      const a = new THREE.PlaneGeometry(0.3, 0.24).translate(0, 0.1, 0), b = a.clone().rotateY(Math.PI / 2);
      this.leaves = new THREE.InstancedMesh(keep(mergeAll([a, b])), lm, 400); this.leaves.count = 0; this.leaves.frustumCulled = false; this.root.add(this.leaves);
    }
  }
  private leaves: THREE.InstancedMesh | null = null;
  private headTex: THREE.Texture | null = null;
  private leafTex: THREE.Texture | null = null;
  private flowerTex: THREE.Texture | null = null;
  private flowerMat: THREE.Material | null = null;
  /** grass and flowers on every square nothing stands on (so a new island is never bare) */
  private meadow() {
    this.meadowKit();
    const t = this.tufts!; t.count = 0; for (const b of this.blooms) b.count = 0; if (this.leaves) this.leaves.count = 0;
    const busy = new Set<string>();
    for (const th of this.things.values()) { const it = ITEM[th.pl.item]; if (!it) continue; const f = footprint(it, th.pl.rot); for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) busy.add(`${th.pl.x + i},${th.pl.z + j}`); }
    for (const k of this.blockSq) busy.add(k);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), R = Math.ceil(this.r);
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
      if (Math.hypot(i, j) > this.r - 0.3 || busy.has(`${i},${j}`)) continue;
      const r = rand(((i + 50) * 131 + (j + 50) * 7919) % 2147483646 + 1); r(); r();
      const n = 0;
      for (let k = 0; k < n && t.count < 900; k++) { m4.compose(new THREE.Vector3((i + (r() - 0.5) * 0.9) * CELL, 0, (j + (r() - 0.5) * 0.9) * CELL), q.setFromAxisAngle(up, r() * 3), new THREE.Vector3().setScalar(0.7 + r() * 0.7)); t.setMatrixAt(t.count++, m4); }
      if (this.blooms.length && r() < 0.18) for (let k = 0, nb = 2 + Math.floor(r() * 3), cell = Math.floor(r() * 6); k < nb; k++) {
        const lv = this.leaves;
        if (lv && k < 2 && lv.count < 400) { m4.compose(new THREE.Vector3((i + (r() - 0.5) * 0.4) * CELL, 0, (j + (r() - 0.5) * 0.4) * CELL), q.setFromAxisAngle(up, r() * 3), new THREE.Vector3().setScalar(0.8 + r() * 0.5)); lv.setMatrixAt(lv.count++, m4); }
        const b = this.blooms[r() < 0.7 ? cell : Math.floor(r() * 6)];
        if (b.count >= 320) continue;
        m4.compose(new THREE.Vector3((i + (r() - 0.5) * 0.5) * CELL, 0, (j + (r() - 0.5) * 0.5) * CELL), q.setFromAxisAngle(up, r() * 3), new THREE.Vector3().setScalar(0.8 + r() * 0.6));
        b.setMatrixAt(b.count++, m4);
      }
    }
    // and the rim, outside the squares: clusters of flowers in leaves all the way round, as in a garden border
    if (this.blooms.length) {
      const rr = rand(4242), N = Math.round(this.r * 9);
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2 + (rr() - 0.5) * 0.2, e = edge(this.rimR, a) * (this.r / this.rimR + (1 - this.r / this.rimR) * (0.15 + rr() * 0.6)), cell = Math.floor(rr() * 6);
        const cx = Math.cos(a) * e, cz = Math.sin(a) * e;
        const lv = this.leaves;
        if (lv && lv.count < 400) { m4.compose(new THREE.Vector3(cx, 0, cz), q.setFromAxisAngle(up, rr() * 3), new THREE.Vector3().setScalar(1 + rr() * 0.6)); lv.setMatrixAt(lv.count++, m4); }
        for (let n = 0, nb = 2 + Math.floor(rr() * 3); n < nb; n++) {
          const b = this.blooms[rr() < 0.75 ? cell : Math.floor(rr() * 6)];
          if (b.count >= 320) continue;
          m4.compose(new THREE.Vector3(cx + (rr() - 0.5) * 0.4, 0.02, cz + (rr() - 0.5) * 0.4), q.setFromAxisAngle(up, a + Math.PI / 2 + (rr() - 0.5)), new THREE.Vector3().setScalar(0.9 + rr() * 0.7));
          b.setMatrixAt(b.count++, m4);
        }
      }
    }
    t.instanceMatrix.needsUpdate = true; for (const b of this.blooms) b.instanceMatrix.needsUpdate = true; if (this.leaves) this.leaves.instanceMatrix.needsUpdate = true;
  }

  // ---------- building ----------
  /** Build mode: the grid shows. */
  setBuilding(on: boolean) { if (this.grid) this.grid.visible = on; if (!on) { this.setGhost(null); this.select(null); } }
  /** The thing being placed or moved (null: none): it hovers over its squares, green if it fits, red if not.
   *  `hide`: the placed thing it stands in for (moving one). */
  setGhost(g: { item: string; x: number; z: number; rot: Rot; ok: boolean; hide?: string | null } | null) {
    if (this.ghost && (!g || g.item !== this.ghost.item)) { this.ghost.obj.removeFromParent(); this.ghost = null; }
    const was = this.ghost?.hide ?? null;
    if (!g) { this.marker.visible = false; if (was) { const t = this.things.get(was); if (t) { t.obj.visible = true; this.solidsFrom(); } } return; }
    if (!this.ghost) { const obj = this.kit.make(g.item); if (!obj) return; this.root.add(obj); this.ghost = { obj, item: g.item, x: g.x, z: g.z, rot: g.rot, ok: g.ok, hide: null }; }
    Object.assign(this.ghost, { x: g.x, z: g.z, rot: g.rot, ok: g.ok, hide: g.hide ?? null });
    if (was && was !== this.ghost.hide) { const t = this.things.get(was); if (t) t.obj.visible = true; }
    if (this.ghost.hide) { const t = this.things.get(this.ghost.hide); if (t) t.obj.visible = false; }
    this.solidsFrom();
    const it = ITEM[g.item], c = centerOf(it, g.x, g.z, g.rot), f = footprint(it, g.rot);
    this.ghost.obj.position.set(c.x * CELL, 0, c.z * CELL); this.ghost.obj.rotation.y = -g.rot * Math.PI / 2;
    this.marker.visible = true; this.marker.position.set(c.x * CELL, 0.03, c.z * CELL); this.marker.scale.set(f.w * CELL - 0.06, 1, f.d * CELL - 0.06);
    (this.marker.material as THREE.MeshBasicMaterial).color.set(g.ok ? 0x5fe08a : 0xff6b6b);
    this.busyT = 1;
  }
  /** Mark a placed thing (or none). */
  select(uid: string | null) {
    this.selected = uid;
    const t = uid ? this.things.get(uid) : null;
    if (!t || this.ghost) { if (!this.ghost) this.marker.visible = false; return; }
    const it = ITEM[t.pl.item], c = this.centre(t.pl), f = footprint(it, t.pl.rot);
    this.marker.visible = true; this.marker.position.set(c.x, 0.03, c.z); this.marker.scale.set(f.w * CELL - 0.06, 1, f.d * CELL - 0.06);
    (this.marker.material as THREE.MeshBasicMaterial).color.set(0xffd34d);
  }
  /** The square under a point on the screen (or null off the island). */
  cellAt(clientX: number, clientY: number): { i: number; j: number; x: number; z: number } | null {
    const p = this.groundAt(clientX, clientY);
    if (!p || Math.hypot(p.x, p.z) > this.rimR) return null;
    return { i: Math.round(p.x / CELL), j: Math.round(p.z / CELL), x: p.x / CELL, z: p.z / CELL };
  }
  private rayAt(clientX: number, clientY: number) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
    return ray;
  }
  private groundAt(clientX: number, clientY: number) {
    return this.rayAt(clientX, clientY).ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }

  // ---------- building with blocks ----------
  /** Where a build tool points: for placing, the square next to the face of the block under the pointer (or
   *  on the grass); for painting, turning or taking away, the block itself. `turnFor`: a ramp or stairs put
   *  against a block's side rises toward it; on the grass or on top it rises away from the camera. */
  blockAim(clientX: number, clientY: number, shape: ShapeId, paint: number, turn: number): Aim {
    const ray = this.rayAt(clientX, clientY), hit = this.blk.pick(ray);
    const camRot = ((Math.round(-this.cam.yaw / (Math.PI / 2)) % 4) + 4) % 4;
    const rotOf = (r: number) => (((r + turn) % 4) + 4) % 4 as Block['r'];
    if (hit) {
      const n = hit.normal, b = hit.block, ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      let place: Block | null = null;
      if (ay >= 0.55 || (ay > ax && ay > az)) {
        place = n.y > 0 ? { x: b.x, y: b.y + SHAPE[b.s].tall, z: b.z, s: shape, r: rotOf(camRot), p: paint } : (b.y > 0 ? { x: b.x, y: b.y - SHAPE[shape].tall, z: b.z, s: shape, r: rotOf(camRot), p: paint } : null);
      } else {
        const dx = ax > az ? Math.sign(n.x) : 0, dz = ax > az ? 0 : Math.sign(n.z);
        const y = Math.max(b.y, Math.min(b.y + SHAPE[b.s].tall - 1, Math.floor(hit.point.y / BLOCK + 1e-4)));
        // rising toward the block it's put against: its back faces back the way it came
        const r = dx > 0 ? 3 : dx < 0 ? 1 : dz > 0 ? 0 : 2;
        place = { x: b.x + dx, y, z: b.z + dz, s: shape, r: rotOf(r), p: paint };
      }
      return { place, on: b, key: `${b.x},${b.y},${b.z}` };
    }
    const g = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!g || Math.hypot(g.x, g.z) > this.rimR + 0.5) return { place: null, on: null, key: null };
    return { place: { x: Math.floor(g.x / BLOCK), y: 0, z: Math.floor(g.z / BLOCK), s: shape, r: rotOf(camRot), p: paint }, on: null, key: null };
  }
  /** The see-through piece where the next one goes (null: none). */
  ghostBlock(b: Block | null, ok = true) { this.blk.ghost(b, ok); if (b) this.busyT = 0.5; }
  /** A soft box round the block a tool acts on. */
  markBlock(b: Block | null, color?: number) { this.blk.mark(b, color); }
  /** A new block pops in (call before the sync that brings it), with a puff and a pop. */
  popBlock(b: Block) {
    this.blk.pop(`${b.x},${b.y},${b.z}`);
    this.fx.emit({ at: new THREE.Vector3((b.x + 0.5) * BLOCK, (b.y + 0.5) * BLOCK, (b.z + 0.5) * BLOCK), count: 10, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8], speed: [0.6, 1.4], up: 0.8, life: [0.3, 0.5], size: [0.05, 0.1], drag: 2 });
  }
  /** A puff where a block was taken away. */
  puffBlock(b: Block) {
    this.fx.emit({ at: new THREE.Vector3((b.x + 0.5) * BLOCK, (b.y + 0.5) * BLOCK, (b.z + 0.5) * BLOCK), count: 14, shape: ['dot', 'pebble'], color: [0xffffff, 0xe8e0d0], speed: [0.6, 1.6], up: 0.6, life: [0.3, 0.6], size: [0.06, 0.12], drag: 2, gravity: 3 });
  }
  /** the blocks' draws and triangles */
  blockStats() { return this.blk.stats(); }
  /** a puff of joy where something was placed */
  cheerAt(uid: string) { const t = this.things.get(uid); if (!t) return; t.pop = 0; sfx.pop(); }

  // ---------- the buddy ----------
  /** The keys or the stick: right and forward (-1..1), relative to the camera; 0, 0 lets go. */
  steer(x: number, z: number) { this.drive.x = x; this.drive.z = z; if (x || z) { this.goto = null; this.walk.mode = 'drive'; this.walk.lastDrive = this.now; } }
  /** Tap the ground, a roof or a rock: the buddy finds its way there (up ramps, round walls). 'none': not
   *  somewhere to stand; 'noway': there's no way up there (yet). */
  walkTo(clientX: number, clientY: number): 'ok' | 'none' | 'noway' {
    const ray = this.rayAt(clientX, clientY), hit = this.blk.pick(ray);
    let at: THREE.Vector3 | null = null;
    if (hit && hit.normal.y > 0.5) at = hit.point.clone();
    else if (hit) at = hit.point.clone().addScaledVector(hit.normal.setY(0).normalize(), 0.3);
    if (!at) for (const q of [this.rocks.cave, this.rocks.sky]) { const pt = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -q.top), new THREE.Vector3()); if (pt && Math.hypot(pt.x - q.x, pt.z - q.z) < q.r) { at = pt; break; } }
    if (!at) { const g = this.groundAt(clientX, clientY); if (g && Math.hypot(g.x, g.z) <= this.walkR) at = g; }
    if (!at) return 'none';
    const fy = floorAt(this.world, at.x, at.z, at.y + 0.05);
    if (fy === null) return 'none';
    const to = { x: at.x, y: fy, z: at.z };
    const pts = findPath(this.world, this.meP, to, (x, z, y) => y < 0.3 && blocked({ x, z }, this.solids, this.boxes, 0.22));
    if (!pts && fy > 0.3) return 'noway';
    this.path = pts ?? [to];
    this.goto = new THREE.Vector3(to.x, to.y, to.z); this.walk.mode = 'drive'; this.walk.lastDrive = this.now;
    this.fx.emit({ at: new THREE.Vector3(to.x, to.y + 0.08, to.z), count: 10, shape: 'ring', color: 0xffd34d, speed: [0.05, 0.2], life: [0.4, 0.6], size: [0.25, 0.4], drag: 2 });
    return 'ok';
  }
  /** where the buddy's feet are */
  get buddyAt(): P3 { return { ...this.meP }; }
  /** Move someone by `dist` toward `dir`: round the island's things while on the grass, over and up the blocks. */
  private move3(p: P3, dir: { x: number; z: number }, dist: number, r2d: number, r3d = 0.15, stepUp?: number): number {
    let dx = dir.x * dist, dz = dir.z * dist;
    if (p.y < 0.3) { const q = { x: p.x, z: p.z }; step(q, dir, dist, this.solids, this.boxes, r2d, Infinity); dx = q.x - p.x; dz = q.z - p.z; }
    const len = Math.hypot(dx, dz);
    return len < 1e-6 ? 0 : walk(this.world, p, { x: dx / len, z: dz / len }, len, r3d, stepUp);
  }
  cheer() {
    const me = this.me; if (!me || this.doing || this.air) return;
    const a = me.play(me.has('cheer') ? 'cheer' : me.has('jump') ? 'jump' : 'idle', 0.2); a?.reset();
    this.walk.mode = 'idle'; this.walk.until = this.now + 2.2;
    this.fx.emit({ at: me.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 20, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.8, 2.2], life: [0.6, 1.1], size: [0.1, 0.2], up: 1, drag: 1.5 });
  }
  /** Hearts over the island (family left one). */
  hearts() {
    for (let i = 0; i < 4; i++) setTimeout(() => this.fx.emit({ at: new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random(), (Math.random() - 0.5) * 3), count: 16, shape: 'heart', color: [0xff6fa8, 0xff9fc6, 0xffffff], speed: [0.6, 1.8], up: 1.4, life: [0.9, 1.5], size: [0.16, 0.3], drag: 1.2 }), i * 220);
    sfx.twinkle();
  }

  // ---------- the Glimmers ----------
  /** The Glimmers living on the island (only the changes are made). */
  async setOut(list: Out[]) {
    const want = new Set(list.map(o => o.id));
    for (const p of [...this.pals]) if (!want.has(p.id)) { p.m.dispose(); p.heart?.removeFromParent(); p.wish?.removeFromParent(); if (p.spot) p.spot.taken = undefined; if (p.next) p.next.taken = undefined; this.pals = this.pals.filter(x => x !== p); }
    for (const o of list) {
      if (this.pals.some(p => p.id === o.id)) continue;
      const m = await GlimmerModel.create(o.id, GLIM_H, { evolved: o.evolved }).catch(() => null);
      if (!m) continue;
      if (!want.has(o.id) || this.pals.some(p => p.id === o.id)) { m.dispose(); continue; }
      m.fx = this.fx;
      const home = this.homeOf(GLIMMER[o.id].element);
      m.root.position.copy(this.randomSpot(home, 1.4));
      m.root.rotation.y = Math.random() * 6;
      m.appearThen = 'idle';
      this.root.add(m.root);
      this.pals.push({ id: o.id, m, mood: 'idle', until: this.now + 1 + Math.random() * 3, to: null, home, hopAt: 0, zzz: 0, p3: { x: m.root.position.x, y: 0, z: m.root.position.z }, vy: 0 });
    }
  }
  /** A Glimmer was tapped: a happy hop and hearts. */
  poke(id: GlimmerId) {
    const p = this.pals.find(x => x.id === id) ?? (this.visitor?.pal.id === id ? this.visitor.pal : null);
    if (!p) return;
    p.m.droop = 0;
    // (in a pond, on a bench or up high it stays there)
    if (!p.spot && !p.hop && p.mood !== 'fetch' && p.mood !== 'bring') { p.mood = 'idle'; p.until = this.now + 2.5; p.to = null; if (p.next) { p.next.taken = undefined; p.next = null; } }
    p.m.face = this.camPos.clone().setY(p.p3.y);
    p.m.play('happy');
    this.fx.emit({ at: p.m.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)), count: 16, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.6, 1.6], up: 1.2, life: [0.6, 1.0], size: [0.08, 0.16], drag: 1.5 });
  }
  /** a speech bubble with a heart in it, painted once */
  private heartMat: THREE.SpriteMaterial | null = null;
  private heartBubble(): THREE.Sprite {
    if (!this.heartMat) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d')!;
      g.fillStyle = 'rgba(80,40,60,.18)'; g.beginPath(); g.ellipse(66, 60, 50, 46, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(64, 56, 50, 46, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(44, 90); g.lineTo(36, 118); g.lineTo(66, 98); g.fill();
      g.fillStyle = '#ff5f8f'; g.beginPath(); g.moveTo(64, 80); g.bezierCurveTo(28, 58, 40, 24, 64, 42); g.bezierCurveTo(88, 24, 100, 58, 64, 80); g.fill();
      g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(52, 42, 6, 4, -0.6, 0, 7); g.fill();
      const tex = this.keep(new THREE.CanvasTexture(cv)); tex.colorSpace = THREE.SRGBColorSpace;
      this.heartMat = this.keep(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    }
    const s = new THREE.Sprite(this.heartMat); s.renderOrder = 4; return s;
  }
  /** a Glimmer's place to go now and then, by what it likes (water ones swim, sunny ones warm up...) */
  private goSomewhere(p: Pal): boolean {
    const el = GLIMMER[p.id].element;
    const like: Record<Spot['kind'], number> = { swim: el === 'tide' ? 4 : el === 'frost' ? 2.5 : 0.8, sit: 1.2, warm: el === 'sun' ? 4 : 0.5, perch: el === 'stone' ? 2 : 1.1 };
    const free = this.spots.filter(sp => !sp.taken);
    if (!free.length) return false;
    let total = free.reduce((a, sp) => a + like[sp.kind], 0), r = Math.random() * total;
    const sp = free.find(x => (r -= like[x.kind]) <= 0) ?? free[0];
    void total;
    sp.taken = p.id; p.next = sp;
    p.mood = 'walk'; p.until = this.now + 14;
    // to the edge of the pond, the front of the bench, the foot of the tower
    p.to = this.freeSpot(sp.at.clone().setY(0).add(new THREE.Vector3(p.p3.x - sp.at.x, 0, p.p3.z - sp.at.z).setLength(sp.kind === 'perch' ? 0.45 : sp.r + 0.5)), 0.22);
    return true;
  }
  /** Hop through the air on to a place (or down from it). */
  private hopTo(p: Pal, to: THREE.Vector3, then: Mood, until: number) {
    const from = p.m.root.position.clone(), up = to.y - from.y;
    p.hop = { from, to: to.clone(), t0: this.now, dur: 0.5 + Math.min(1, Math.abs(up) * 0.22 + from.distanceTo(to) * 0.08), h: Math.max(0.35, up + 0.45), then, until };
    p.m.droop = 0;
  }
  private hopOnto(p: Pal, sp: Spot) {
    const to = sp.at.clone();
    if (sp.kind === 'swim') to.add(new THREE.Vector3((Math.random() - 0.5) * sp.r, 0, (Math.random() - 0.5) * sp.r));
    p.spot = sp; p.next = null;
    this.hopTo(p, to, sp.kind, this.now + 8 + Math.random() * 7);
  }
  /** down from a place on to the grass near by */
  private hopDown(p: Pal) {
    if (p.spot) { p.spot.taken = undefined; p.spot = null; }
    const at = this.randomSpot(new THREE.Vector3(p.p3.x, 0, p.p3.z), 0.7, 0.22);
    const y = floorAt(this.world, at.x, at.z, 0) ?? 0;
    this.hopTo(p, at.setY(y), 'idle', this.now + 1 + Math.random() * 2);
  }
  private palMove(p: Pal, dt: number, t: number) {
    const m = p.m, P = p.p3;
    // what its body does (a Glimmer with a skeleton): walks, naps curled up, sits on a bench or up high,
    // paddles in a pond; looks at your buddy when it's close
    m.pose = p.hop ? 'idle' : MOOD_POSE[p.mood];
    const near = this.me && (p.mood === 'idle' || p.mood === 'play' || p.mood === 'sit' || p.mood === 'perch') && Math.hypot(this.meP.x - P.x, this.meP.z - P.z) < 4;
    m.lookAt = near ? this.me!.root.position.clone().setY(this.meP.y + 0.8) : p.mood === 'warm' ? this.sun.position : null;
    // now and then a happy one shows a heart
    p.heartAt ??= t + 3 + Math.random() * 12;
    if (t > p.heartAt && p.mood !== 'nap' && p.mood !== 'sit') { p.heartAt = t + 10 + Math.random() * 16; p.heartT = 0; if (!p.heart) { p.heart = this.heartBubble(); this.root.add(p.heart); } }
    if (p.heart) {
      p.heartT = (p.heartT ?? 0) + dt;
      const k = p.heartT, show = k < 2.4, s = show ? Math.min(1, easeOutBack(Math.min(1, k / 0.35))) * 0.42 : Math.max(0, 0.42 - (k - 2.4) * 2);
      p.heart.visible = s > 0.01 && !p.wish; p.heart.scale.setScalar(Math.max(0.001, s * 1.3));
      p.heart.position.copy(m.root.position).add(new THREE.Vector3(0.18, m.height * (m.floats ? 1.75 : 1.4) + Math.sin(t * 3) * 0.03, 0));
    }
    if (p.wish) { p.wish.position.copy(m.root.position).add(new THREE.Vector3(0.2, m.height * (m.floats ? 1.9 : 1.55) + Math.sin(t * 2.4) * 0.05, 0)); p.wish.scale.setScalar(0.62 + Math.sin(t * 3) * 0.02); }
    // in the air
    if (p.hop) {
      const h = p.hop, k = Math.min(1, (t - h.t0) / h.dur);
      m.root.position.lerpVectors(h.from, h.to, k); m.root.position.y += Math.sin(k * Math.PI) * h.h;
      m.face = h.to.clone().setY(m.root.position.y);
      if (h.to.y - h.from.y > 1.2 && Math.random() < dt * 25) this.fx.emit({ at: m.root.position.clone(), count: 1, shape: ['star', 'spark'], color: [0xffffff, 0xfff2a8], speed: [0.1, 0.4], life: [0.4, 0.7], size: [0.05, 0.1], drag: 1 });
      if (k >= 1) {
        P.x = h.to.x; P.y = h.to.y; P.z = h.to.z; p.vy = 0;
        p.hop = null; p.mood = h.then; p.until = h.until;
        if (h.then === 'swim') { sfx.pop(); this.fx.emit({ at: h.to.clone().setY(h.to.y + 0.05), count: 14, shape: 'drop', color: [0xbfeaff, 0xffffff], speed: [0.6, 1.6], up: 1.8, life: [0.4, 0.7], size: [0.05, 0.1], gravity: 6 }); }
        else m.play('hop');
        if (h.then === 'sit') m.face = this.spotFace(p);
      }
      m.update(dt, t);
      return;
    }
    if (t > p.until && p.mood !== 'walk' && p.mood !== 'fetch' && p.mood !== 'bring') {
      if (p.mood === 'nap' || p.mood === 'sit') { m.droop = 0; m.play('happy'); }
      // done with its place: down again
      if (p.spot) { this.hopDown(p); m.update(dt, t); return; }
      const r = Math.random();
      if (r < 0.34 && P.y < 0.3 && this.goSomewhere(p)) { /* on its way */ }
      else if (r < 0.62) { p.mood = 'walk'; p.to = this.randomSpot(p.home && Math.random() < 0.7 ? p.home : null, 1.0); p.until = t + 12; }
      else if (r < 0.78) { p.mood = 'idle'; p.until = t + 2 + Math.random() * 3; p.to = null; m.face = Math.random() < 0.5 && this.me ? this.me.root.position.clone() : null; }
      else if (r < 0.88) { p.mood = 'nap'; p.until = t + 7 + Math.random() * 6; p.to = null; m.face = null; }
      else { p.mood = 'play'; p.until = t + 3 + Math.random() * 2; p.to = null; }
    }
    let swimY = 0;
    const walkOn = (to: THREE.Vector3, speed: number) => {
      const d = new THREE.Vector3(to.x - P.x, 0, to.z - P.z), len = d.length();
      if (len < 0.08) return len;
      const moved = this.move3(P, { x: d.x / len, z: d.z / len }, Math.min(len, dt * speed), 0.2, 0.12);
      m.face = to.clone().setY(P.y);
      // (one that walks on legs walks; the rest hop along)
      if (!m.floats && !m.walks && t > p.hopAt) { m.play('hop'); p.hopAt = t + (speed > 1 ? 0.32 : 0.5); }
      return moved < dt * speed * 0.15 && len > 0.3 ? -1 : len;
    };
    if (p.mood === 'walk' && p.to) {
      const len = walkOn(p.to, m.floats ? 0.75 : 0.62);
      if (len < 0.1 || t > p.until || (len < 0 && Math.random() < dt * 2)) {
        const sp = p.next;
        if (sp && Math.hypot(sp.at.x - P.x, sp.at.z - P.z) < 2.4) this.hopOnto(p, sp);
        else { if (sp) { sp.taken = undefined; p.next = null; } p.mood = 'idle'; p.until = t + 1.5 + Math.random() * 2; p.to = null; }
      }
    } else if (p.mood === 'fetch' && this.ball?.who === p.id) {
      const b = this.ball, len = walkOn(b.to, 1.7);
      if (b.phase === 'rest' && len >= 0 && len < 0.4) { b.phase = 'held'; p.mood = 'bring'; p.until = t + 16; m.play('happy'); sfx.pop(); }
      else if (t > p.until) this.dropBall(p, false);
    } else if (p.mood === 'bring' && this.ball?.who === p.id) {
      const me = this.meP, len = walkOn(new THREE.Vector3(me.x, me.y, me.z), 1.5);
      if (len >= 0 && len < 0.8) this.dropBall(p, true);
      else if (t > p.until) this.dropBall(p, false);
    } else if (p.mood === 'fetch' || p.mood === 'bring') { p.mood = 'idle'; p.until = t + 1; }
    else if (p.mood === 'swim' && p.spot) {
      // round and round the pond, low in the water, with ripples
      const sp = p.spot, a = t * 0.7 + p.id.length, rr = sp.r * 0.55;
      const to = sp.at.clone().add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
      P.x += (to.x - P.x) * Math.min(1, dt * 1.5); P.z += (to.z - P.z) * Math.min(1, dt * 1.5); P.y = sp.at.y;
      m.face = sp.at.clone().add(new THREE.Vector3(Math.cos(a + 0.6) * rr, 0, Math.sin(a + 0.6) * rr));
      swimY = -m.height * 0.32 + Math.sin(t * 2.2) * 0.03;
      p.zzz -= dt;
      if (p.zzz <= 0) { p.zzz = 0.5; this.fx.emit({ at: new THREE.Vector3(P.x, sp.at.y + 0.03, P.z), count: 1, shape: 'ring', color: 0xe6f8ff, speed: [0.02, 0.06], life: [0.8, 1.1], size: [0.3, 0.5], grow: 1.5, drag: 2 }); }
    } else if (p.mood === 'sit' || p.mood === 'nap') {
      // (one with a skeleton sits up or curls up instead of slumping)
      if (!m.rigged) m.droop = Math.min(0.9, m.droop + dt * 0.8);
      p.zzz -= dt;
      if (p.zzz <= 0) { p.zzz = 0.9; this.fx.emit({ at: m.root.position.clone().add(new THREE.Vector3(0.1, m.height * 0.9, 0)), count: 1, shape: 'dot', color: 0xffffff, speed: [0.15, 0.3], up: 0.6, life: [1.2, 1.6], size: [0.05, 0.09], drag: 0.5, fade: 1 }); }
    } else if (p.mood === 'warm') {
      m.face = this.sun.position.clone();
      if (Math.random() < dt * 4) this.fx.emit({ at: m.root.position.clone().add(new THREE.Vector3(0, m.height * 0.6, 0)), count: 1, shape: ['spark', 'star'], color: [0xffd34d, 0xffb52e, 0xffffff], speed: [0.1, 0.4], up: 0.8, life: [0.5, 0.9], size: [0.05, 0.1], drag: 1 });
    } else if (p.mood === 'perch') {
      if (t > p.hopAt) { p.hopAt = t + 2 + Math.random() * 2; m.face = new THREE.Vector3(P.x + Math.cos(t) * 3, P.y, P.z + Math.sin(t) * 3); if (Math.random() < 0.4) m.play('happy'); }
    } else if (p.mood === 'play') {
      if (t > p.hopAt) { const r = Math.random(); m.play(r < 0.35 ? 'happy' : r < 0.55 && m.rigged ? 'cheer' : 'hop'); p.hopAt = t + (m.rigged ? 1.4 : 0.9) + Math.random() * 0.6; if (Math.random() < 0.5) this.fx.emit({ at: m.root.position.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 6, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8], speed: [0.3, 0.9], up: 0.8, life: [0.4, 0.7], size: [0.05, 0.1], drag: 2 }); }
    }
    // a treat: munch, munch, munch
    if (p.munch && t < p.munch) { if (t > p.hopAt) { m.play('eat'); p.hopAt = t + (m.rigged ? 0.8 : 0.34); this.fx.emit({ at: m.root.position.clone().add(new THREE.Vector3(0, m.height * 0.5, 0)), count: 3, shape: 'dot', color: [0xe8a050, 0xffd9a0], speed: [0.3, 0.8], up: 0.6, life: [0.3, 0.5], size: [0.03, 0.05], gravity: 4 }); } }
    if (p.mood !== 'swim' && p.mood !== 'sit' && p.mood !== 'warm' && p.mood !== 'perch') p.vy = fall(this.world, P, p.vy, dt);
    m.root.position.set(P.x, P.y + swimY, P.z);
    m.update(dt, t);
  }
  /** which way a Glimmer on a bench faces (out from the back) */
  private spotFace(p: Pal) { const sp = p.spot, a = sp?.face ?? 0; return new THREE.Vector3(p.p3.x - Math.sin(a) * -2, p.p3.y, p.p3.z + Math.cos(a) * 2); }

  // ---------- playing with the Glimmers ----------
  private ballMat: THREE.Material | null = null;
  /** Throw a ball for a Glimmer: it runs to it and brings it back. */
  throwBall(id: GlimmerId): boolean {
    const p = this.pals.find(x => x.id === id), me = this.me;
    if (!p || !me || this.ball || p.hop) return false;
    if (p.spot) { p.spot.taken = undefined; p.spot = null; }
    if (p.next) { p.next.taken = undefined; p.next = null; }
    if (!this.ballMat) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
      const g = cv.getContext('2d')!; g.fillStyle = '#ff5f6d'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#ffd34d'; g.fillRect(0, 22, 128, 20); g.fillStyle = '#ffffff'; g.fillRect(0, 28, 128, 8);
      const tx = this.keep(new THREE.CanvasTexture(cv)); tx.colorSpace = THREE.SRGBColorSpace;
      this.ballMat = this.keep(new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35 }));
    }
    const mesh = new THREE.Mesh(this.keep(new THREE.SphereGeometry(0.11, 16, 12)), this.ballMat); mesh.castShadow = true;
    const from = me.root.position.clone().add(new THREE.Vector3(0, 0.95, 0));
    const ground = new THREE.Vector3(this.meP.x, 0, this.meP.z);
    let to = this.randomSpot(ground, 2.6, 0.25);
    for (let i = 0; i < 6 && to.distanceTo(ground) < 1.8; i++) to = this.randomSpot(ground, 2.6, 0.25);
    to.y = (floorAt(this.world, to.x, to.z, 0) ?? 0) + 0.11;
    mesh.position.copy(from); this.root.add(mesh);
    this.ball = { mesh, from, to, t0: this.now, who: id, phase: 'fly' };
    me.root.rotation.y = Math.atan2(to.x - this.meP.x, to.z - this.meP.z);
    const a = me.play(me.has('wave1') ? 'wave1' : me.has('cheer') ? 'cheer' : 'idle', 0.15); a?.reset();
    this.walk.mode = 'idle'; this.walk.until = this.now + 30; this.path = []; this.goto = null;
    p.mood = 'fetch'; p.until = this.now + 16; p.to = null; p.m.droop = 0;
    sfx.whoosh();
    return true;
  }
  get fetching(): GlimmerId | null { return this.ball?.who ?? null; }
  private dropBall(p: Pal, brought: boolean) {
    const b = this.ball; if (!b) return;
    this.ball = null;
    b.mesh.removeFromParent();
    p.mood = 'idle'; p.until = this.now + 2;
    this.walk.until = this.now + 1.5;
    if (brought) {
      p.m.play('happy'); p.m.face = this.me?.root.position.clone() ?? null;
      this.fx.emit({ at: p.m.root.position.clone().add(new THREE.Vector3(0, 0.7, 0)), count: 18, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.6, 1.6], up: 1.2, life: [0.6, 1.0], size: [0.08, 0.16], drag: 1.5 });
      sfx.cheer();
      this.onFetched?.(p.id);
    } else this.fx.emit({ at: b.mesh.position.clone(), count: 12, shape: 'dot', color: 0xffffff, speed: [0.4, 1], life: [0.3, 0.5], size: [0.06, 0.1], drag: 2 });
  }
  private ballMove(t: number) {
    const b = this.ball; if (!b) return;
    if (b.phase === 'fly') {
      const k = Math.min(1, (t - b.t0) / 0.9);
      b.mesh.position.lerpVectors(b.from, b.to, k); b.mesh.position.y += Math.sin(k * Math.PI) * 1.6;
      b.mesh.rotation.x += 0.3;
      if (k >= 1) { b.phase = 'rest'; b.t0 = t; sfx.pop(); this.fx.emit({ at: b.to.clone(), count: 6, shape: 'dot', color: 0xeaffd0, speed: [0.3, 0.7], up: 0.6, life: [0.3, 0.5], size: [0.04, 0.07], gravity: 4 }); }
    } else if (b.phase === 'rest') {
      const k = t - b.t0; b.mesh.position.copy(b.to); b.mesh.position.y += Math.abs(Math.sin(k * 9)) * 0.18 * Math.max(0, 1 - k * 1.6);
    } else {
      const p = this.pals.find(x => x.id === b.who);
      if (p) { const f = p.m.root.rotation.y; b.mesh.position.copy(p.m.root.position).add(new THREE.Vector3(Math.sin(f) * 0.24, p.m.height * 0.42, Math.cos(f) * 0.24)); }
    }
  }
  /** A treat flies from the buddy to a Glimmer, who munches it. */
  feedFx(id: GlimmerId) {
    const p = this.pals.find(x => x.id === id), me = this.me;
    if (!p || !me) return;
    const from = me.root.position.clone().add(new THREE.Vector3(0, 0.9, 0)), to = p.m.root.position.clone().add(new THREE.Vector3(0, p.m.height * 0.5, 0));
    if (!p.spot && !p.hop) { p.mood = 'idle'; p.until = this.now + 3; p.to = null; }
    p.m.face = from.clone().setY(p.p3.y);
    this.fx.fly(from, to, { color: 0xffb35c, size: 0.16, time: 0.55, arc: 0.7, trail: at => ({ at, count: 1, shape: 'dot', color: [0xffd9a0, 0xffffff], speed: [0.05, 0.2], life: [0.2, 0.4], size: [0.03, 0.06], drag: 2 }), hit: () => {
      p.munch = this.now + 1.4; p.hopAt = 0;
      this.fx.emit({ at: to, count: 16, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.5, 1.4], up: 1.2, life: [0.6, 1.0], size: [0.07, 0.14], drag: 1.5 });
      sfx.pop();
    } });
  }
  /** A Glimmer's wish, as a picture in a thought bubble over its head (null: none). */
  setWish(id: GlimmerId | null, pic: string | null) {
    for (const p of this.pals) if (p.wish && p.id !== id) { p.wish.removeFromParent(); (p.wish.material as THREE.SpriteMaterial).map?.dispose(); (p.wish.material as THREE.SpriteMaterial).dispose(); p.wish = null; }
    const p = id ? this.pals.find(x => x.id === id) : null;
    if (!p || p.wish) return;
    const cv = document.createElement('canvas'); cv.width = cv.height = 160;
    const g = cv.getContext('2d')!;
    const draw = (img?: HTMLImageElement) => {
      g.clearRect(0, 0, 160, 160);
      g.fillStyle = 'rgba(80,50,30,.18)';
      for (const [x, y, r] of [[82, 72, 60], [40, 60, 30], [120, 58, 30], [26, 140, 9], [44, 124, 13]]) { g.beginPath(); g.arc(x + 2, y + 3, r, 0, 7); g.fill(); }
      g.fillStyle = '#ffffff';
      for (const [x, y, r] of [[80, 70, 60], [38, 58, 30], [118, 56, 30], [24, 138, 9], [42, 122, 13]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      if (img) g.drawImage(img, 30, 18, 100, 100);
      tex.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    draw();
    if (pic) { const img = new Image(); img.onload = () => draw(img); img.src = pic; }
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.renderOrder = 5; s.scale.setScalar(0.62);
    p.wish = s; this.root.add(s);
    p.m.play('happy');
  }
  /** The wish came true: the bubble pops, hearts everywhere, a happy dance. */
  wishGranted(id: GlimmerId) {
    const p = this.pals.find(x => x.id === id);
    if (!p) return;
    if (p.wish) { this.fx.emit({ at: p.wish.position.clone(), count: 24, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8, 0xb8ffcf], speed: [0.6, 1.8], life: [0.4, 0.8], size: [0.06, 0.12], drag: 2 }); p.wish.removeFromParent(); p.wish = null; }
    p.m.play('happy');
    for (let i = 0; i < 3; i++) setTimeout(() => this.fx.emit({ at: p.m.root.position.clone().add(new THREE.Vector3(0, 0.8, 0)), count: 14, shape: 'heart', color: [0xff6fa8, 0xff9fc6, 0xffffff], speed: [0.6, 1.6], up: 1.4, life: [0.8, 1.2], size: [0.1, 0.18], drag: 1.2 }), i * 260);
  }
  /** The secrets' things on the island: the sparkle in the grass (a square, or none), a bottle in a pond
   *  (the pond's id), a note beside a very happy Glimmer. */
  showSparkle(at: { x: number; z: number } | null) { this.secrets.setSparkle(at ? new THREE.Vector3(at.x * CELL, 0.01, at.z * CELL) : null); }
  showBottle(uid: string | null) { const t = uid ? this.things.get(uid) : null; this.secrets.setBottle(t ? this.centre(t.pl).add(new THREE.Vector3(0.28, 0.05, 0.22)) : null); }
  showNote(id: GlimmerId | null) {
    if (!id) { this.secrets.setNote(null); return; }
    const p = this.pals.find(x => x.id === id), at = this.freeSpot(p ? new THREE.Vector3(p.p3.x + 0.55, 0, p.p3.z + 0.35) : new THREE.Vector3(1, 0, 1.6), 0.2);
    this.secrets.setNote(at.setY(floorAt(this.world, at.x, at.z, 0) ?? 0));
  }
  /** the rainbow after the rain (on or off) */
  rainbow(on: boolean) { this.secrets.setRainbow(on); }
  /** Is the buddy standing on the sparkle in the grass? */
  get onSparkle(): boolean { const s = this.secrets.sparkleAt; return !!s && Math.hypot(s.x - this.meP.x, s.z - this.meP.z) < 0.55 && this.meP.y < 0.2; }
  /** Dig on the sparkle: the buddy digs, then the chest (the first time) or a treat comes up. */
  dig(first: boolean, done: () => void) {
    const me = this.me, at = this.secrets.sparkleAt?.clone();
    if (!me || !at) return;
    this.walk.mode = 'idle'; this.walk.until = this.now + 4.5; this.path = []; this.goto = null;
    const a = me.play(me.has('fistpump') ? 'fistpump' : me.has('jump') ? 'jump' : 'cheer', 0.2); a?.reset();
    this.secrets.dig(at.setY(0), first, done);
    sfx.whoosh();
  }
  /** A coin flies from the buddy into the Wishing Well, and it sparkles. */
  wishFx(uid: string, done: () => void) {
    const t = this.things.get(uid), me = this.me;
    if (!t || !me) { done(); return; }
    const to = this.centre(t.pl).setY(0.45), from = me.root.position.clone().add(new THREE.Vector3(0, 0.9, 0));
    this.fx.fly(from, to, { color: 0xffd34d, size: 0.14, time: 0.7, arc: 1.2, trail: at => ({ at, count: 1, shape: 'spark', color: [0xffe27a, 0xffffff], speed: [0.05, 0.2], life: [0.2, 0.4], size: [0.04, 0.07], drag: 2 }), hit: () => {
      this.fx.emit({ at: to, count: 22, shape: 'drop', color: [0xbfeaff, 0xffffff], speed: [0.6, 1.6], up: 2, life: [0.4, 0.7], size: [0.05, 0.1], gravity: 6 });
      for (let i = 0; i < 4; i++) setTimeout(() => this.fx.emit({ at: to.clone().setY(0.6 + i * 0.35), count: 10, shape: ['star', 'spark'], color: [0xffd34d, 0xfff2a8, 0xffffff], speed: [0.3, 1], up: 1.2, life: [0.5, 0.9], size: [0.06, 0.12], drag: 1.5 }), i * 160);
      sfx.twinkle(); done();
    } });
  }
  /** Where a placed thing is on the screen (for a label over it). */
  screenAt(v: THREE.Vector3): { x: number; y: number } | null {
    const q = v.clone().project(stage.camera);
    return q.z > 1 ? null : { x: (q.x + 1) / 2, y: (1 - q.y) / 2 };
  }
  thingAt(uid: string): THREE.Vector3 | null { const t = this.things.get(uid); return t ? this.centre(t.pl) : null; }
  /** A Glimmer's feet (for the note it leaves near it). */
  glimmerAt(id: GlimmerId): THREE.Vector3 | null { const p = this.pals.find(x => x.id === id); return p ? new THREE.Vector3(p.p3.x, p.p3.y, p.p3.z) : null; }

  // ---------- the sky: night and rain ----------
  /** How dark (0 day, 1 night) and how rainy (0, 1) it should be; the sky eases there. */
  setWeather(o: { dark?: number; rain?: number; now?: boolean }) {
    if (o.dark !== undefined) this.weather.wantDark = o.dark;
    if (o.rain !== undefined) this.weather.wantRain = o.rain;
    if (o.now) { this.weather.dark = this.weather.wantDark; this.weather.rain = this.weather.wantRain; this.skyTick(0); }
    this.secrets.setNight(this.weather.wantDark);
    this.secrets.setRain(this.weather.wantRain > 0.5);
  }
  private cloudMats: { m: THREE.SpriteMaterial; c: THREE.Color }[] = [];
  private skyTick(dt: number) {
    const w = this.weather, ease = (a: number, b: number) => (dt <= 0 ? b : a + (b - a) * Math.min(1, dt * 0.8));
    const wasD = w.dark, wasR = w.rain;
    w.dark = ease(w.dark, w.wantDark); w.rain = ease(w.rain, w.wantRain);
    if (dt > 0 && Math.abs(w.dark - wasD) < 1e-4 && Math.abs(w.rain - wasR) < 1e-4) return;
    const d = w.dark, r = w.rain * (1 - d * 0.5);
    const mix = (day: number, rain: number, night: number) => new THREE.Color(day).lerp(new THREE.Color(rain), r).lerp(new THREE.Color(night), d);
    if (this.skyU) {
      this.skyU.top.value.copy(this.skyU.top0.value).lerp(new THREE.Color(0x8d9bb0), r).lerp(new THREE.Color(0x0b1640), d);
      this.skyU.mid.value.copy(this.skyU.mid0.value).lerp(new THREE.Color(0xb9c2cf), r).lerp(new THREE.Color(0x2a2f66), d);
      this.skyU.low.value.copy(this.skyU.low0.value).lerp(new THREE.Color(0xd5d9df), r).lerp(new THREE.Color(0x4a3f72), d);
      (this.skyU.sunA as unknown as { value: number }).value = Math.max(0, 1 - d * 1.2 - r * 0.8);
    }
    // (a moonlit night: blue, but the island still easy to see)
    this.hemi.intensity = 1.25 - r * 0.3 - d * 0.42; this.hemi.color.copy(mix(0xfff0dc, 0xe8eef6, 0xa8b6ff));
    this.sun.intensity = 2.55 - r * 1.3 - d * 1.6; this.sun.color.copy(mix(0xffe4c0, 0xe6ecf4, 0xb8c4ff));
    (stage.scene.fog as THREE.Fog | null)?.color.copy(mix(0xf3dcc4, 0xc8ccd4, 0x3a4274));
    for (const c of this.cloudMats) c.m.color.copy(c.c).lerp(new THREE.Color(0xb0b6c2), r).lerp(new THREE.Color(0x6c72a4), d);
    this.blk.setNight(d);
    this.kit.setNight?.(d);
  }

  // ---------- a photo ----------
  /** where the middle of the island is on the screen (0..1) */
  islandOnScreen(): { x: number; y: number } | null { return this.screenAt(new THREE.Vector3(0, 0.3, 0)); }
  /** The island as it is now, as a picture (a data URL). */
  snapshot(): string | null {
    const r = stage.renderer; if (!r) return null;
    // (sharper than the screen when it's drawing fewer pixels to keep up: up to about 2400 across)
    const was = r.getPixelRatio(), size = r.getSize(new THREE.Vector2()), k = Math.min(2, 2400 / Math.max(1, size.x));
    if (k > was) r.setPixelRatio(k);
    r.render(stage.scene, stage.camera);
    const url = r.domElement.toDataURL('image/png');
    if (k > was) r.setPixelRatio(was);
    return url;
  }

  // ---------- visitors ----------
  /** A visitor (null: none). `arriving`: it floats down from the sky on a cloud, with its present. */
  async setVisitor(v: { id: GlimmerId; near: string | null; present: boolean } | null, arriving = false) {
    if (this.visitor && (!v || v.id !== this.visitor.pal.id)) { const old = this.visitor; this.visitor = null; old.pal.m.dispose(); old.pal.heart?.removeFromParent(); old.present?.removeFromParent(); old.cloud?.removeFromParent(); }
    if (!v || this.visitor) return;
    const m = await GlimmerModel.create(v.id, GLIM_H).catch(() => null);
    if (!m) return;
    if (this.visitor) { m.dispose(); return; }
    m.fx = this.fx;
    const near = v.near ? [...this.things.values()].find(t => t.pl.item === v.near) : null;
    const base = near ? this.centre(near.pl).add(new THREE.Vector3(0, 0, 1.3)) : new THREE.Vector3(1.5, 0, 1.5);
    const at = this.freeSpot(base, 0.35);
    m.root.position.copy(arriving ? at.clone().setY(7) : at);
    m.appearThen = 'idle';
    this.root.add(m.root);
    let cloud: THREE.Sprite | null = null;
    const ct = await loadTexture('world/cloud.webp');
    if (arriving && ct) { cloud = new THREE.Sprite(this.keep(new THREE.SpriteMaterial({ map: ct, transparent: true, depthWrite: false, color: 0xffffff }))); cloud.scale.set(1.5, 0.66, 1); this.root.add(cloud); }
    let present: THREE.Object3D | null = null;
    if (v.present) { present = this.present(); present.position.copy(this.freeSpot(at.clone().add(new THREE.Vector3(0.55, 0, 0.25)), 0.25)); present.visible = !arriving; this.root.add(present); }
    this.visitor = { pal: { id: v.id, m, mood: 'idle', until: this.now + 3, to: null, home: at, hopAt: 0, zzz: 0, p3: { x: at.x, y: 0, z: at.z }, vy: 0 }, arrive: arriving ? this.now : -99, from: at.clone().setY(7), at, present, cloud, opened: !v.present };
    if (arriving) sfx.twinkle();
  }
  /** The present is opened: it pops. */
  openPresent() {
    const v = this.visitor; if (!v || v.opened) return;
    v.opened = true;
    if (v.present) { this.fx.emit({ at: v.present.position.clone().setY(0.35), count: 40, shape: ['star', 'heart', 'dot'], color: [0xff8fc0, 0xffd34d, 0x9fe0ff, 0xffffff], speed: [1, 2.6], up: 1.6, life: [0.6, 1.1], size: [0.08, 0.16], drag: 1.6 }); v.present.removeFromParent(); v.present = null; }
    sfx.reveal(1);
  }
  private present() {
    const g = new THREE.Group();
    const box = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.34, 0.28, 0.34)), this.keep(new THREE.MeshStandardMaterial({ color: 0xff7aa8, roughness: 0.45 })));
    box.position.y = 0.14; g.add(box);
    const lid = new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.38, 0.08, 0.38)), this.keep(new THREE.MeshStandardMaterial({ color: 0xff5f96, roughness: 0.45 })));
    lid.position.y = 0.31; g.add(lid);
    const rib = this.keep(new THREE.MeshStandardMaterial({ color: 0xffe066, roughness: 0.35, metalness: 0.2 }));
    g.add(new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.07, 0.37, 0.39)), rib).translateY(0.18), new THREE.Mesh(this.keep(new THREE.BoxGeometry(0.39, 0.37, 0.07)), rib).translateY(0.18));
    for (const s of [-1, 1]) { const b = new THREE.Mesh(this.keep(new THREE.TorusGeometry(0.07, 0.025, 6, 12)), rib); b.position.set(s * 0.06, 0.4, 0); b.rotation.set(0, Math.PI / 2, s * 0.5); g.add(b); }
    g.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    g.name = 'present';
    return g;
  }
  private visit(dt: number, t: number) {
    const v = this.visitor; if (!v) return;
    const m = v.pal.m;
    if (v.arrive >= 0) {
      // floating down on its cloud
      const k = Math.min(1, (t - v.arrive) / 3.2), e = 1 - Math.pow(1 - k, 3);
      m.root.position.lerpVectors(v.from, v.at, e);
      m.root.position.x += Math.sin(t * 2) * 0.15 * (1 - k);
      if (v.cloud) { v.cloud.position.copy(m.root.position).add(new THREE.Vector3(0, -0.05, 0)); (v.cloud.material as THREE.SpriteMaterial).opacity = 1 - Math.max(0, (k - 0.85) / 0.15); }
      if (Math.random() < dt * 20) this.fx.emit({ at: m.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 1, shape: ['star', 'spark'], color: [0xffffff, 0xfff2a8], speed: [0.1, 0.4], life: [0.5, 0.9], size: [0.05, 0.1], drag: 1 });
      m.update(dt, t);
      if (k >= 1) {
        v.arrive = -99; v.cloud?.removeFromParent(); v.cloud = null;
        if (v.present) v.present.visible = true;
        m.play('happy'); sfx.pop();
        this.fx.emit({ at: v.at.clone().setY(0.3), count: 30, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8, 0x9fe0ff], speed: [0.8, 2], up: 1, life: [0.5, 0.9], size: [0.07, 0.14], drag: 2 });
        this.onLanded?.();
      }
      return;
    }
    // it stays near where it landed, looking round, hopping about
    this.palMove(v.pal, dt, t);
    if (v.present && !v.opened) { v.present.rotation.y = Math.sin(t * 2) * 0.15; v.present.position.y = Math.abs(Math.sin(t * 3)) * 0.04; }
  }

  // ---------- picking things on the screen ----------
  pick(clientX: number, clientY: number): Pick {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
    // in the house: the note, or the buddy
    if (this.doing?.kind === 'inside') {
      const n = this.room?.note;
      if (n?.visible && ray.ray.distanceSqToPoint(n.getWorldPosition(new THREE.Vector3())) < 0.3 * 0.3) return { kind: 'roomnote' };
      if (this.me && ray.ray.intersectBox(new THREE.Box3().setFromObject(this.me.root), new THREE.Vector3())) return { kind: 'buddy' };
      return null;
    }
    let best: Pick = null, bd = Infinity;
    const boxHit = (o: THREE.Object3D, grow = 0.08) => { const b = new THREE.Box3().setFromObject(o).expandByScalar(grow); const p = ray.ray.intersectBox(b, new THREE.Vector3()); return p ? p.distanceTo(ray.ray.origin) : Infinity; };
    for (const p of this.pals) { const d = boxHit(p.m.root, 0.12); if (d < bd) { bd = d; best = { kind: 'glimmer', id: p.id }; } }
    if (this.visitor) { const d = Math.min(boxHit(this.visitor.pal.m.root, 0.15), this.visitor.present ? boxHit(this.visitor.present, 0.1) : Infinity); if (d < bd) { bd = d; best = { kind: 'visitor' }; } }
    if (this.me) { const d = boxHit(this.me.root, 0); if (d < bd) { bd = d; best = { kind: 'buddy' }; } }
    // the secrets: a bottle in a pond, a Glimmer's note, the golden butterfly, the rainbow
    const near = (v: THREE.Vector3 | null, r: number) => { if (!v) return Infinity; const d = ray.ray.distanceSqToPoint(v); return d < r * r ? ray.ray.origin.distanceTo(v) : Infinity; };
    for (const [kind, v, r] of [['bottle', this.secrets.bottleAt, 0.4], ['note', this.secrets.noteAt?.clone().setY((this.secrets.noteAt?.y ?? 0) + 0.06) ?? null, 0.4], ['butterfly', this.golden.on ? this.flies[0]?.g.position ?? null : null, 0.45]] as const) {
      const d = near(v, r); if (d < bd) { bd = d; best = { kind } as Pick; }
    }
    if (!best && this.secrets.hitsRainbow(ray.ray)) best = { kind: 'rainbow' };
    // things: the mesh hit nearest (only if nothing alive is in front)
    const objs = [...this.things.values()].filter(t => t.obj.visible).map(t => t.obj);
    const h = ray.intersectObjects(objs, true).find(x => (x.object as THREE.Mesh).isMesh && x.object.visible);
    // (a block in front of a thing hides it)
    const bh = this.blk.pick(ray), bdist = bh ? bh.point.distanceTo(ray.ray.origin) : Infinity;
    if (h && h.distance < bd && h.distance < bdist) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.item) o = o.parent;
      const t = o ? [...this.things.values()].find(x => x.obj === o) : null;
      if (t) best = { kind: 'item', uid: t.uid };
    }
    return best;
  }
  /** Where the buddy's head is on the screen (0..1), for the hint over it. */
  buddyScreen(lift = 1.5): { x: number; y: number } | null {
    const me = this.me;
    if (!me) return null;
    const v = me.root.position.clone(); v.y += lift;
    v.project(stage.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }
  /** Where something is on the screen (0..1), for its label: a Glimmer, the visitor, or a thing. */
  screenOf(what: { glimmer?: GlimmerId; visitor?: boolean; uid?: string }, lift = 0.9): { x: number; y: number } | null {
    let o: THREE.Object3D | null = null, h = lift;
    if (what.visitor && this.visitor) o = this.visitor.pal.m.root;
    else if (what.glimmer) o = this.pals.find(p => p.id === what.glimmer)?.m.root ?? null;
    else if (what.uid) { const t = this.things.get(what.uid); if (t) { o = t.obj; h = new THREE.Box3().setFromObject(t.obj).max.y + 0.3; } }
    if (!o) return null;
    const v = o.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, h, 0)).project(stage.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  // ---------- pictures for the catalogue ----------
  /** Draw things one by one, lit like the island on clear ground, for the catalogue's cards (kept for the
   *  session). `onOne` gets each picture as it's ready. */
  async thumbs(ids: string[], onOne: (id: string, url: string) => void, size = 168) { await drawThumbs(this.kit, this.blk, ids, onOne, size); }

  // ---------- the camera ----------
  /** Back to the view of the whole island. */
  frame(now = false) {
    this.framed = true;
    const c = this.cam, cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    const narrow = cam.aspect * bandW / bandH < 1;
    c.pitch = narrow ? 0.66 : 0.52; c.yaw = 0;
    // the grassy top fills the space left for it (the trees and the cottage may reach above it, and the
    // cliff runs on down behind the catalogue)
    const R = this.rimR, halfW = R * (narrow ? 1.02 : 1.2), halfH = R * Math.sin(c.pitch) * 1.04 + 1.1;
    c.dist = Math.max(halfW / (tanH * cam.aspect * bandW), halfH / (tanH * bandH));
    c.target.set(0, 0.35, -0.3);
    if (now) this.camReady = false;
  }
  orbit(dx: number, dy: number) { if (this.doing?.kind === 'inside') return; const c = this.cam; c.yaw -= dx * 0.006; c.pitch = Math.max(0.18, Math.min(1.35, c.pitch + dy * 0.005)); this.framed = false; this.busyT = 0.6; }
  zoom(factor: number, clientX?: number, clientY?: number) {
    if (this.doing?.kind === 'inside') return;
    const c = this.cam, was = c.dist;
    c.dist = Math.max(3.2, Math.min(this.rimR * 4 + 10, c.dist * factor));
    if (clientX !== undefined && clientY !== undefined && c.dist < was) { const p = this.groundAt(clientX, clientY); if (p) c.target.lerp(p.setY(c.target.y), 1 - c.dist / was); }
    this.clampTarget(); this.framed = false; this.busyT = 0.6;
  }
  pan(dx: number, dy: number) {
    if (this.doing?.kind === 'inside') return;
    const c = this.cam, k = (2 * c.dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2))) / innerHeight;
    const right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw)), fwd = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    c.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k / Math.max(0.35, Math.sin(c.pitch)));
    this.clampTarget(); this.framed = false; this.busyT = 0.6;
  }
  private clampTarget() { const t = this.cam.target, d = Math.hypot(t.x, t.z), m = this.rimR + 4; if (d > m) { t.x *= m / d; t.z *= m / d; } t.y = Math.max(0.55, Math.min(4, t.y)); }
  /** Is the camera somewhere you put it (not the whole island)? */
  get looking() { return !this.framed; }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    this.busyT = Math.max(0, this.busyT - dt);
    this.kit.water.uT.value = t; this.fall.uT.value = t;
    // the island grows (after the child met more Glimmers)
    if (this.growK < 1) { this.growK = Math.min(1, this.growK + dt / 1.8); const s = this.growFrom + (1 - this.growFrom) * easeOutBack(this.growK); this.land.scale.set(s, 1, s); if (Math.random() < dt * 30) this.fx.emit({ at: new THREE.Vector3((Math.random() - 0.5) * this.rimR * 2, 0.2, (Math.random() - 0.5) * this.rimR * 2), count: 2, shape: ['star', 'leaf'], color: [0xffffff, 0xb8ffcf, 0xfff2a8], speed: [0.4, 1.2], up: 1, life: [0.5, 1], size: [0.08, 0.16], drag: 1 }); }
    for (const th of this.things.values()) {
      if (th.pop < 1) { th.pop = Math.min(1, th.pop + dt / 0.5); th.obj.scale.setScalar(Math.max(0.001, easeOutBack(th.pop))); }
      th.tick?.(t, dt);
    }
    if (this.ghost) { this.ghost.obj.position.y = 0.12 + Math.sin(t * 4) * 0.05; (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t * 5) * 0.12; }
    else if (this.marker.visible) (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 4) * 0.12;
    for (const f of this.floaters) f.o.position.y = f.y + Math.sin(t * 0.5 + f.ph) * 0.25;
    // a little while after the island opens, one butterfly turns golden (a secret: tap it)
    if (!this.golden.on && this.goldWing && (this.golden.t += dt) > 14) { this.golden.on = true; const b = this.flies[0]; if (b) { (b.l as THREE.Mesh).material = this.goldWing; (b.r as THREE.Mesh).material = this.goldWing; b.g.scale.setScalar(1.9); b.y = 1.0; b.rad = 2.4; } }
    this.flies.forEach((b, i) => {
      const tt = t * b.sp + b.ph, p = new THREE.Vector3(Math.cos(tt * 0.6) * b.rad + Math.sin(tt * 2.1) * 0.3, b.y + Math.sin(tt * 1.3) * 0.3, Math.sin(tt * 0.6 + i) * b.rad * 0.8 + Math.cos(tt * 1.7) * 0.3);
      const v = p.clone().sub(b.g.position); b.g.position.copy(p); if (v.lengthSq() > 1e-6) b.g.rotation.y = Math.atan2(v.x, v.z);
      const flap = Math.sin(t * 16 + b.ph) * 0.9; b.l.rotation.z = -flap; b.r.rotation.z = flap;
      if (i === 0 && this.golden.on && Math.random() < dt * 12) this.fx.emit({ at: p.clone(), count: 1, shape: ['spark', 'star'], color: [0xffd34d, 0xffffff], speed: [0.05, 0.2], life: [0.4, 0.7], size: [0.04, 0.08], drag: 1 });
    });
    this.blk.update(t, dt);
    this.ballMove(t);
    this.buddy(dt, t);
    for (const p of this.pals) this.palMove(p, dt, t);
    this.visit(dt, t);
    this.skyTick(dt);
    this.secrets.update(t, dt, this.camPos);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
    this.fx.update(dt, t);
    this.camera(dt, t);
    const f = this.focus(), dir = this.sun.userData.dir as THREE.Vector3;
    this.sun.position.copy(f).addScaledVector(dir, 40); this.sun.target.position.copy(f);
  }

  /** where the keys, the stick or a tapped path take the buddy now (null: it isn't being walked) */
  private steerDir(t: number): { x: number; z: number; speed: number } | null {
    const P = this.meP;
    if (this.drive.x || this.drive.z) {
      const c = this.cam, fwd = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw)), right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
      const d = fwd.multiplyScalar(this.drive.z).addScaledVector(right, this.drive.x);
      const mm = Math.min(1, d.length()); d.normalize();
      this.walk.lastDrive = t; this.path = []; this.goto = null;
      return { x: d.x, z: d.z, speed: 3.0 * mm };
    }
    if (this.path.length) {
      const to = this.path[0], dx = to.x - P.x, dz = to.z - P.z, len = Math.hypot(dx, dz);
      if (len < 0.1) { this.path.shift(); if (!this.path.length) this.goto = null; return null; }
      this.walk.lastDrive = t;
      return { x: dx / len, z: dz / len, speed: this.path.length > 1 || len > 2 ? 3.0 : 1.1 + len };
    }
    return null;
  }

  private buddy(dt: number, t: number) {
    const me = this.me; if (!me) return;
    const w = this.walk, P = this.meP;
    const turnTo = (a: number, k: number) => { const d = Math.atan2(Math.sin(a - me.root.rotation.y), Math.cos(a - me.root.rotation.y)); me.root.rotation.y += d * Math.min(1, dt * k); };
    // on the swing, up a tree or in a house
    if (this.doing) { this.doingTick(me, dt, t, turnTo); this.squashTick(me, dt); return; }
    if (this.air) {
      // in the air: steered as on the ground, over the blocks it clears, down on to whatever it lands on
      const sd = w.mode === 'drive' ? this.steerDir(t) : null;
      if (sd) { this.airMove(P, sd, sd.speed * dt); turnTo(Math.atan2(sd.x, sd.z), 12); }
      const a = this.air; a.vy -= GRAV * dt;
      let ny = P.y + a.vy * dt;
      // (a block over its head: bonk)
      if (a.vy > 0 && spansAt(this.world, P.x, P.z).some(([c0]) => c0 >= P.y + CLEAR - 0.02 && c0 < ny + CLEAR)) { a.vy = 0; ny = P.y; }
      const f = a.vy <= 0 ? floorAt(this.world, P.x, P.z, P.y, 0.02) : null;
      if (f !== null && ny <= f) { P.y = f; this.landed(); }
      else if (ny < -1) { P.y = 0; standUp(this.world, P); this.landed(); }
      else P.y = ny;
      this.meShow = P.y;
    } else {
      if (w.mode === 'drive') {
        const sd = this.steerDir(t);
        if (sd && sd.speed > 0) {
          const moved = this.move3(P, sd, sd.speed * dt, 0.3, 0.15, BUDDY_STEP);
          // stuck against something on the way: give up on it
          if (this.path.length && moved < sd.speed * dt * 0.2) { this.stuck += dt; if (this.stuck > 0.5) { this.path = []; this.goto = null; } } else this.stuck = 0;
          turnTo(Math.atan2(sd.x, sd.z), 12);
          const gait = sd.speed > 2.2 && me.has('run') ? 'run' : 'walk'; me.play(gait, 0.2);
          const a = me.actions[gait]; if (a) a.timeScale = Math.max(0.6, Math.min(2, Math.max(0.3, moved / Math.max(1e-4, dt)) / (me.speedOf[gait] || sd.speed)));
          // walked into a house's door: in you go
          if (this.drive.x || this.drive.z) { const h = this.doorAhead(sd); if (h) void this.goIn(h); }
        } else me.play('idle', 0.3);
        if (this.talking) { const g = this.pals.find(x => x.id === this.talking); if (g) turnTo(Math.atan2(g.p3.x - P.x, g.p3.z - P.z), 6); }
        // left alone for a while: it potters about by itself again
        if (t - w.lastDrive > 8 && !this.talking) { w.mode = 'idle'; w.until = t + 2; }
      } else if (w.mode === 'walk') {
        const dx = w.to.x - P.x, dz = w.to.z - P.z, len = Math.hypot(dx, dz);
        if (len < 0.1 || t > w.until) { w.mode = 'idle'; w.until = t + 3 + Math.random() * 4; const a = me.play(me.has('wave1') && Math.random() < 0.25 ? 'wave1' : 'idle', 0.3); a?.reset(); }
        else { this.move3(P, { x: dx / len, z: dz / len }, Math.min(len, dt * 1.05), 0.3); turnTo(Math.atan2(dx, dz), 8); me.play('walk', 0.3); const a = me.actions.walk; if (a) a.timeScale = Math.max(0.6, 1.05 / (me.speedOf.walk || 1)); }
      } else {
        // off to look at something (only from the grass: up on what's built it stays put till you walk it)
        if (t > w.until && P.y < 0.3 && !this.ball && !this.talking) {
          const things = [...this.things.values()];
          const pick = Math.random() < 0.4 && this.pals.length ? this.pals[Math.floor(Math.random() * this.pals.length)].m.root.position.clone().setY(0) : Math.random() < 0.6 && things.length ? this.centre(things[Math.floor(Math.random() * things.length)].pl) : null;
          w.to.copy(this.randomSpot(pick, 0.8, 0.3)); w.mode = 'walk'; w.until = t + 10;
        } else {
          me.play('idle', 0.4);
          const look = this.talking ?? this.ball?.who;
          if (look) { const p = this.pals.find(x => x.id === look); if (p) turnTo(Math.atan2(p.p3.x - P.x, p.p3.z - P.z), 4); }
        }
      }
      this.meVy = fall(this.world, P, this.meVy, dt);
      // its picture: steps up eased, falls as they come
      this.meShow = P.y <= this.meShow ? P.y : this.meShow + (P.y - this.meShow) * Math.min(1, dt * 16);
    }
    me.root.position.set(P.x, this.meShow, P.z);
    // somewhere secret?
    const reach = (what: 'cave' | 'skyrock' | 'whale', yes: boolean) => { if (yes && !this.reached.has(what)) { this.reached.add(what); this.onReach?.(what); } };
    reach('cave', onRock(this.rocks.cave, P.x, P.y, P.z));
    reach('skyrock', onRock(this.rocks.sky, P.x, P.y, P.z));
    reach('whale', P.y >= WHALE_Y);
    me.update(dt);
    this.squashTick(me, dt);
  }
  private stuck = 0;
  /** Let a secret place tell again (it was found, or the moment is over). */
  unreach(what: 'cave' | 'skyrock' | 'whale') { this.reached.delete(what); }

  // ---------- jumping, the swing, climbing, going into a house, talking ----------
  /** Is the buddy busy with one of these (on the swing, up a tree, in a house)? */
  get busy(): 'swing' | 'tree' | 'inside' | null { return this.doing?.kind ?? null; }
  /** Jump (Space or the jump button). On the swing or up a tree it gets off instead. */
  jump(): boolean {
    const me = this.me, d = this.doing, P = this.meP;
    if (!me) return false;
    if (d?.kind === 'swing' || (d?.kind === 'tree' && d.phase === 'top')) { this.getOff(); return true; }
    if (d?.kind === 'tree' || this.air) return false;
    if (d?.kind === 'inside') { if (d.p.y > 0.01) return false; this.air = { vy: JUMP_V * 0.8 }; }
    else {
      if (this.meVy > 0.5 || floorAt(this.world, P.x, P.z, P.y + 0.02, 0.05) === null) return false;
      this.meShow = P.y; this.air = { vy: JUMP_V };
      if (this.walk.mode !== 'drive') { this.walk.mode = 'drive'; this.walk.lastDrive = this.now; }
    }
    const a = me.play(me.has('jump') ? 'jump' : 'idle', 0.08, 1.35); a?.reset();
    const feet = me.root.position.clone();
    this.fx.emit({ at: feet.setY(feet.y + 0.05), count: 8, shape: 'dot', color: [0xffffff, 0xf4ead8], speed: [0.4, 1.0], up: 0.2, life: [0.25, 0.4], size: [0.05, 0.1], drag: 3 });
    sfx.boink(); this.busyT = 1.2;
    return true;
  }
  /** down on its feet after a jump: a squash and a puff */
  private landed() {
    const me = this.me; this.air = null; this.meVy = 0; this.squashT = 0;
    if (!me) return;
    const at = me.root.position.clone(); at.y = (this.doing?.kind === 'inside' ? at.y : this.meP.y) + 0.04;
    this.fx.emit({ at, count: 14, shape: 'dot', color: [0xffffff, 0xf4ead8, 0xe8dcc4], speed: [0.7, 1.6], up: 0.25, life: [0.3, 0.55], size: [0.06, 0.13], drag: 3 });
    sfx.plop(0, 2);
    if (!this.drive.x && !this.drive.z) me.play('idle', 0.15);
  }
  /** the body squashes as it lands and stretches a little going up (the buddy's own size otherwise) */
  private squashTick(me: Character, dt: number) {
    let sy = 1, sxz = 1;
    if (this.squashT >= 0) { this.squashT += dt; const k = this.squashT / 0.24; if (k >= 1) this.squashT = -1; else { const q = Math.sin(k * Math.PI) * 0.2; sy = 1 - q; sxz = 1 + q * 0.5; } }
    else if (this.air && this.air.vy > 0) { const q = Math.min(1, this.air.vy / JUMP_V) * 0.1; sy = 1 + q; sxz = 1 - q * 0.5; }
    me.root.scale.set(this.meScale.x * sxz, this.meScale.y * sy, this.meScale.z * sxz);
  }
  /** a move through the air: round the island's things low down, and only where a block isn't at body
   *  height (so a jump clears a block it's higher than), never out over the edge */
  private airMove(P: P3, dir: { x: number; z: number }, dist: number) {
    let dx = dir.x * dist, dz = dir.z * dist;
    if (P.y < 0.3) { const q = { x: P.x, z: P.z }; step(q, dir, dist, this.solids, this.boxes, 0.3, Infinity); dx = q.x - P.x; dz = q.z - P.z; }
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08)), sx = dx / n, sz = dz / n;
    const free = (x: number, z: number) => {
      if (!spansAt(this.world, x, z).length) return false;
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; if (wallAt(this.world, x + Math.cos(a) * 0.15, z + Math.sin(a) * 0.15, P.y, 0.02, CLEAR)) return false; }
      return true;
    };
    for (let i = 0; i < n; i++) {
      if (free(P.x + sx, P.z + sz)) { P.x += sx; P.z += sz; }
      else if (free(P.x + sx, P.z)) P.x += sx;
      else if (free(P.x, P.z + sz)) P.z += sz;
      else break;
    }
  }
  /** a house's front door, on the grass in front of it */
  private doorOf(th: Thing): THREE.Vector3 {
    const it = ITEM[th.pl.item], c = this.centre(th.pl), a = -th.pl.rot * Math.PI / 2, zf = it.d * CELL / 2 + 0.3;
    return c.add(new THREE.Vector3(Math.sin(a) * zf, 0, Math.cos(a) * zf));
  }
  /** walking right into a house's door (the house's uid) */
  private doorAhead(dir: { x: number; z: number }): string | null {
    const P = this.meP;
    if (P.y > 0.3) return null;
    for (const th of this.things.values()) {
      if (!HOMES.has(th.pl.item)) continue;
      const dp = this.doorOf(th), c = this.centre(th.pl), to = new THREE.Vector3(c.x - dp.x, 0, c.z - dp.z).normalize();
      if (Math.hypot(dp.x - P.x, dp.z - P.z) < 0.5 && dir.x * to.x + dir.z * to.z > 0.6) return th.uid;
    }
    return null;
  }
  private trunkOf(item: string) { return item === 'lookout' ? 0.86 : (ITEM[item]?.trunk ?? 0.35) * CELL; }
  /** a block just in front that's too tall to step on but low enough to jump on */
  private blockAhead(): boolean {
    const me = this.me, P = this.meP;
    if (!me) return false;
    const a = me.root.rotation.y, x = P.x + Math.sin(a) * 0.38, z = P.z + Math.cos(a) * 0.38;
    if (!wallAt(this.world, x, z, P.y, BUDDY_STEP, CLEAR)) return false;
    const top = floorAt(this.world, x, z, P.y + JUMP_UP - 0.05, 0);
    return top !== null && top > P.y + BUDDY_STEP;
  }
  /** What the buddy can do where it is now, with its word for the hint ("Talk", "Swing", "Go in"...). */
  near(): (Near & { label: string }) | null {
    const d = this.doing, P = this.meP;
    if (!this.me) return null;
    if (d?.kind === 'swing') return { kind: 'off', label: 'Get off' };
    if (d?.kind === 'tree') return d.phase === 'top' ? { kind: 'off', label: 'Hop down' } : null;
    if (d?.kind === 'inside') {
      const r = this.room;
      if (!r) return null;
      if (r.note.visible && Math.hypot(d.p.x - r.noteSpot.x, d.p.z - r.noteSpot.z) < 0.85) return { kind: 'note', label: 'Read the note' };
      if (Math.hypot(d.p.x - r.exit.x, d.p.z - r.exit.z) < 0.8) return { kind: 'off', label: 'Go outside' };
      return null;
    }
    if (this.air) return null;
    let best: (Near & { label: string }) | null = null, bd = Infinity;
    const consider = (n: Near & { label: string }, dist: number, max: number) => { if (dist < max && dist < bd) { bd = dist; best = n; } };
    for (const p of this.pals) if (!p.hop && Math.abs(p.p3.y - P.y) < 0.7) consider({ kind: 'talk', id: p.id, label: 'Talk' }, Math.hypot(p.p3.x - P.x, p.p3.z - P.z), 1.35);
    if (P.y < 0.3) for (const th of this.things.values()) {
      const item = th.pl.item, c = this.centre(th.pl);
      if (item === 'swing') consider({ kind: 'swing', uid: th.uid, label: 'Swing' }, Math.hypot(c.x - P.x, c.z - P.z) - 0.35, 1.2);
      else if (HOMES.has(item)) { const dp = this.doorOf(th); consider({ kind: 'house', uid: th.uid, label: 'Go in' }, Math.hypot(dp.x - P.x, dp.z - P.z), 0.95); }
      else if (CLIMB.has(item)) consider({ kind: 'tree', uid: th.uid, label: 'Climb' }, Math.hypot(c.x - P.x, c.z - P.z) - this.trunkOf(item), 1.0);
    }
    if (best) return best;
    return this.blockAhead() ? { kind: 'jump', label: 'Jump' } : null;
  }
  /** Do what's close (the E key, the action button). Talking and the note are the screen's to show. */
  act(): (Near & { label: string }) | null {
    const n = this.near();
    if (!n) return null;
    if (n.kind === 'talk') this.talkTo(n.id);
    else if (n.kind === 'swing') this.sitOnSwing(n.uid);
    else if (n.kind === 'tree') this.climb(n.uid);
    else if (n.kind === 'house') void this.goIn(n.uid);
    else if (n.kind === 'off') this.getOff();
    else if (n.kind === 'note') this.readNote();
    else if (n.kind === 'jump') this.jump();
    return n;
  }
  /** Talk to a Glimmer: it stops and looks at the buddy (and the buddy at it) until the talk is over. */
  talkTo(id: GlimmerId) {
    const p = this.pals.find(x => x.id === id);
    if (!p) return;
    this.poke(id);
    this.talking = id;
    if (!p.spot && !p.hop && p.mood !== 'fetch' && p.mood !== 'bring') { p.mood = 'idle'; p.until = this.now + 60; p.to = null; }
    if (this.me) p.m.face = this.me.root.position.clone().setY(p.p3.y);
    if (this.walk.mode !== 'drive') { this.walk.mode = 'drive'; this.walk.lastDrive = this.now; }
  }
  endTalk() { const p = this.pals.find(x => x.id === this.talking); if (p && p.mood === 'idle' && !p.spot) p.until = this.now + 1.5; this.talking = null; }
  /** what a Glimmer is doing now (for what it says) */
  moodOf(id: GlimmerId): Mood | null { return this.pals.find(x => x.id === id)?.mood ?? null; }
  private sitOnSwing(uid: string) {
    const me = this.me;
    if (!me || !this.things.get(uid)) return;
    this.doing = { kind: 'swing', uid, t0: this.now };
    this.path = []; this.goto = null; this.air = null; this.endTalk();
    me.play(me.has('sit') ? 'sit' : 'idle', 0.25);
    sfx.pop(); this.busyT = 1;
  }
  private climb(uid: string) {
    const th = this.things.get(uid), me = this.me;
    if (!th || !me) return;
    const c = this.centre(th.pl), P = this.meP;
    const side = new THREE.Vector3(P.x - c.x, 0, P.z - c.z);
    if (side.lengthSq() < 1e-4) side.set(0, 0, 1);
    // (the lookout is climbed by its ladder, at the front)
    if (th.pl.item === 'lookout') { const a = -th.pl.rot * Math.PI / 2; side.set(Math.sin(a), 0, Math.cos(a)); }
    side.normalize();
    const box = new THREE.Box3().setFromObject(th.obj);
    // the lookout's floor; a tree's top (where you can see out over the island)
    const stand = th.pl.item === 'lookout' ? 2.4 : Math.max(1.2, box.max.y - 0.12);
    this.doing = { kind: 'tree', uid, t0: this.now, phase: 'up', c, side, r: this.trunkOf(th.pl.item), climbTop: Math.max(0.8, Math.min(stand - 0.5, stand * 0.62)), stand, from: new THREE.Vector3(), to: new THREE.Vector3(), pt0: 0 };
    this.path = []; this.goto = null; this.air = null; this.endTalk();
    me.root.scale.copy(this.meScale);
    sfx.click(); this.busyT = 1;
  }
  /** In through the door: the cosy room (built the first time), the camera with it. */
  async goIn(uid: string) {
    const th = this.things.get(uid), me = this.me;
    if (!th || !me || this.roomBusy || this.doing) return;
    if (!this.room) {
      this.roomBusy = true;
      try { this.room = await HouseRoom.build(ROOM_AT, this.keep); this.root.add(this.room.root); } finally { this.roomBusy = false; }
      if (this.doing || !this.things.get(uid)) return;
    }
    const r = this.room;
    r.look(th.pl.item);
    r.note.visible = !this.notesRead.has(uid);
    const c = this.cam;
    this.camWas = { target: c.target.clone(), yaw: c.yaw, pitch: c.pitch, dist: c.dist, framed: this.framed };
    this.framed = false; this.camReady = false;
    this.path = []; this.goto = null; this.air = null; this.endTalk();
    this.doing = { kind: 'inside', uid, item: th.pl.item, p: { x: r.exit.x - 0.3, y: 0, z: r.exit.z }, door: this.doorOf(th), out: 0 };
    me.root.rotation.set(0, -Math.PI / 2, 0);
    sfx.whoosh(); this.busyT = 1;
    this.onInside?.(th.pl.item);
  }
  /** Off the swing, down from the tree, out of the house. */
  getOff() {
    const d = this.doing, me = this.me, P = this.meP;
    if (!d || !me) return;
    if (d.kind === 'swing') {
      const th = this.things.get(d.uid);
      this.doing = null;
      me.root.quaternion.identity();
      if (th) {
        const a = -th.pl.rot * Math.PI / 2, c = this.centre(th.pl);
        const out = this.freeSpot(c.clone().add(new THREE.Vector3(Math.sin(a), 0, Math.cos(a))), 0.3);
        P.x = out.x; P.z = out.z; P.y = floorAt(this.world, out.x, out.z, 0.3, BUDDY_STEP) ?? 0;
        me.root.rotation.set(0, a, 0);
      }
      this.meShow = P.y; this.air = { vy: JUMP_V * 0.45 };
      this.walk.mode = 'drive'; this.walk.lastDrive = this.now;
      me.play('idle', 0.2); sfx.pop();
    } else if (d.kind === 'tree') {
      if (d.phase !== 'top') return;
      const g = this.freeSpot(d.c.clone().addScaledVector(d.side, d.r + 0.9), 0.3);
      d.from = me.root.position.clone(); d.to = new THREE.Vector3(g.x, floorAt(this.world, g.x, g.z, 0.3, BUDDY_STEP) ?? 0, g.z);
      d.phase = 'down'; d.pt0 = this.now;
      me.root.rotation.y = Math.atan2(d.to.x - d.from.x, d.to.z - d.from.z);
      const a = me.play(me.has('jump') ? 'jump' : 'idle', 0.1, 1.3); a?.reset();
      sfx.boink();
    } else {
      // out of the door, back on the island, the camera as it was
      this.doing = null; this.air = null;
      P.x = d.door.x; P.z = d.door.z; P.y = 0; standUp(this.world, P); this.meShow = P.y;
      const th = this.things.get(d.uid);
      me.root.rotation.set(0, th ? -th.pl.rot * Math.PI / 2 : 0, 0);
      me.root.position.set(P.x, P.y, P.z);
      const w = this.camWas;
      if (w) { this.cam.target.copy(w.target); this.cam.yaw = w.yaw; this.cam.pitch = w.pitch; this.cam.dist = w.dist; this.framed = w.framed; }
      this.camWas = null; this.camReady = false;
      this.walk.mode = 'drive'; this.walk.lastDrive = this.now;
      me.play('idle', 0.2); sfx.whoosh();
      this.onInside?.(null);
    }
    this.busyT = 1;
  }
  /** The note on the bed: picked up (the screen shows what it says). */
  readNote() {
    const d = this.doing;
    if (d?.kind !== 'inside' || !this.room?.note.visible) return;
    this.room.note.visible = false; this.notesRead.add(d.uid);
    this.fx.emit({ at: this.room.note.getWorldPosition(new THREE.Vector3()), count: 16, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.5, 1.4], up: 1, life: [0.5, 0.9], size: [0.06, 0.12], drag: 1.5 });
    sfx.twinkle();
  }
  /** the swing, a tree, the house: each frame */
  private doingTick(me: Character, dt: number, t: number, turnTo: (a: number, k: number) => void) {
    const d = this.doing!;
    if (d.kind === 'swing') {
      const th = this.things.get(d.uid), seat = th?.obj.getObjectByName('seat');
      if (!th || !seat) { this.doing = null; me.root.quaternion.identity(); return; }
      if (this.drive.x || this.drive.z) { this.getOff(); return; }
      // swinging higher and higher, then back and forth
      const k = Math.min(1, (t - d.t0) / 1.6);
      seat.rotation.x = Math.sin((t - d.t0) * 2.2) * 0.62 * k;
      th.obj.updateMatrixWorld(true);
      const top = seat.localToWorld(new THREE.Vector3(0, -1.42 + 0.03, 0));
      me.root.quaternion.copy(seat.getWorldQuaternion(new THREE.Quaternion()));
      me.root.position.copy(top);
      me.play(me.has('sit') ? 'sit' : 'idle', 0.25);
      me.update(dt);
      me.uprightSpine(0.5);
      // hips on the seat
      const hips = me.bones.Hips;
      if (hips) {
        me.root.updateMatrixWorld(true);
        const hp = hips.getWorldPosition(new THREE.Vector3()), up = new THREE.Vector3(0, 1, 0).applyQuaternion(me.root.quaternion);
        me.root.position.add(top.clone().addScaledVector(up, 0.12).sub(hp));
        me.root.updateMatrixWorld(true);
      }
      // a whoosh at the top of each swing forward
      const ph = ((t - d.t0) * 2.2) % (Math.PI * 2);
      if (k >= 1 && ph > 1.5 && ph < 1.5 + dt * 2.2) sfx.whoosh();
      return;
    }
    if (d.kind === 'tree') {
      if (d.phase === 'up') {
        const y = Math.min(d.climbTop, (t - d.t0) * 1.1);
        const at = d.c.clone().addScaledVector(d.side, d.r + 0.17).setY(y);
        me.root.position.copy(at); me.root.rotation.set(0, Math.atan2(-d.side.x, -d.side.z), 0);
        me.play(me.has('climb') ? 'climb' : 'walk', 0.2);
        if (y >= d.climbTop) {
          d.phase = 'over'; d.from = at.clone(); d.to = d.c.clone().setY(d.stand); d.pt0 = t;
          const a = me.play(me.has('jump') ? 'jump' : 'idle', 0.1, 1.2); a?.reset(); sfx.boink();
        }
      } else if (d.phase === 'over' || d.phase === 'down') {
        const dur = d.phase === 'over' ? 0.6 : 0.75, k = Math.min(1, (t - d.pt0) / dur);
        const at = d.from.clone().lerp(d.to, k); at.y += Math.sin(k * Math.PI) * (d.phase === 'over' ? 0.45 : 0.6);
        me.root.position.copy(at);
        if (k >= 1) {
          if (d.phase === 'over') {
            d.phase = 'top'; me.play('idle', 0.2); sfx.twinkle();
            this.fx.emit({ at: d.to.clone().setY(d.to.y + 0.9), count: 20, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8, 0xb8ffcf], speed: [0.6, 1.8], up: 1, life: [0.5, 0.9], size: [0.07, 0.14], drag: 1.6 });
          } else {
            const P = this.meP; P.x = d.to.x; P.y = d.to.y; P.z = d.to.z; this.meShow = P.y;
            this.doing = null; this.walk.mode = 'drive'; this.walk.lastDrive = t; this.landed();
          }
        }
      } else {
        // up top: look out over the island (and back at you)
        me.root.position.copy(d.to);
        turnTo(Math.atan2(this.camPos.x - d.to.x, this.camPos.z - d.to.z), 3);
        me.play('idle', 0.3);
        if (this.drive.x || this.drive.z) this.getOff();
      }
      me.update(dt);
      return;
    }
    // in the house: walk round the room; out through the door
    const r = this.room;
    if (!r) { this.doing = null; return; }
    const sd = this.steerDir(t);
    if (sd) {
      const q = { x: d.p.x, z: d.p.z };
      step(q, sd, sd.speed * 0.7 * dt, [], r.boxes, 0.26, Infinity);
      d.p.x = Math.max(-ROOM_W + 0.3, Math.min(ROOM_W - 0.28, q.x)); d.p.z = Math.max(-ROOM_D + 0.3, Math.min(ROOM_D + 0.45, q.z));
      turnTo(Math.atan2(sd.x, sd.z), 12);
      if (!this.air) me.play('walk', 0.2);
      if (d.p.x > ROOM_W - 0.36 && Math.abs(d.p.z - r.exit.z) < 0.42 && sd.x > 0.5) { d.out += dt; if (d.out > 0.15) { this.getOff(); return; } } else d.out = 0;
    } else if (!this.air) me.play('idle', 0.3);
    if (this.air) {
      this.air.vy -= GRAV * dt; d.p.y += this.air.vy * dt;
      if (d.p.y + 1.3 > ROOM_H && this.air.vy > 0) this.air.vy = 0;
      if (d.p.y <= 0) { d.p.y = 0; this.landed(); }
    }
    me.root.position.copy(r.world(new THREE.Vector3(d.p.x, d.p.y, d.p.z)));
    r.update(t);
    me.update(dt);
  }
  /** the camera in the house: the room fills the space for it, following the buddy across when it's wider */
  private roomCam() {
    const r = this.room, d = this.doing;
    if (!r || d?.kind !== 'inside') return;
    const c = this.cam, cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    c.yaw = 0; c.pitch = 0.2;
    const halfW = ROOM_W + 0.12, halfH = ROOM_H * 0.5 + 0.1;
    const wFit = halfW / (tanH * cam.aspect * bandW), hFit = halfH / (tanH * bandH);
    // (a tall phone screen sees more of the room's height, so the buddy isn't right in your face)
    c.dist = Math.max(2.4, Math.min(wFit, hFit * 1.45));
    const seeW = c.dist * tanH * cam.aspect * bandW, lim = Math.max(0, halfW - seeW);
    c.target.copy(r.at).add(new THREE.Vector3(Math.max(-lim, Math.min(lim, d.p.x)), ROOM_H * 0.46, 0.2));
  }

  private camera(dt: number, _t: number) {
    const c = this.cam, cam = stage.camera;
    if (this.doing?.kind === 'inside') this.roomCam();
    // up a tree or the lookout, on the swing: the camera (when it's yours, not the whole island) keeps the buddy in view
    else if ((this.doing || this.air) && this.me && !this.framed) c.target.lerp(this.me.root.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 1 - Math.exp(-dt * 2.5));
    else if (this.walk.mode === 'drive' && this.me && (this.drive.x || this.drive.z || this.goto) && !this.framed) c.target.lerp(this.me.root.position.clone().setY(this.meShow + 0.55), 1 - Math.exp(-dt * 3));
    if (this.framed) { this.frame(); c.yaw = Math.sin(_t * 0.07) * 0.14; }
    const pos = c.target.clone().add(new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.cos(c.yaw) * Math.cos(c.pitch)).multiplyScalar(c.dist));
    // the view band isn't the middle of the screen (the bars cover some): shift so the island sits in it
    const v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const ndcX = (v.left + v.right) - 1, ndcY = 1 - (v.top + v.bottom);
    const look = c.target.clone().sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, look).normalize();
    const shift = right.multiplyScalar(-ndcX * c.dist * tanH * cam.aspect).add(up.multiplyScalar(-ndcY * c.dist * tanH));
    const wantPos = pos.add(shift), aim = c.target.clone().add(shift);
    if (!this.camReady) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.camReady = true; }
    const k = 1 - Math.exp(-dt * (this.framed ? 3 : 9));
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }
  focus() { return new THREE.Vector3(0, 0, 0); }

  dispose() {
    this.me?.dispose();
    this.blk.dispose();
    this.secrets.dispose();
    this.ball?.mesh.removeFromParent();
    for (const p of this.pals) p.wish?.removeFromParent();
    for (const p of this.pals) p.m.dispose();
    if (this.visitor) this.visitor.pal.m.dispose();
    this.fx.root.removeFromParent(); this.fx.dispose();
    this.root.removeFromParent();
    if (stage.island === this.island) stage.island = null;
    this.kit.dispose();
    for (const x of this.own) x.dispose();
    if (import.meta.env.DEV) delete (window as unknown as { __isle?: IslandScene }).__isle;
  }
}

function mergeAll(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // (a tiny merge for plain planes: positions, normals and uvs, indexed)
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  let base = 0;
  for (const p of parts) {
    const P = p.attributes.position as THREE.BufferAttribute, N = p.attributes.normal as THREE.BufferAttribute, U = p.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i)); }
    const I = p.index!; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + base);
    base += P.count; p.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
