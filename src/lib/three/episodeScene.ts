// A Learn episode's 3D place: a painted set behind a real table in warm light, your buddy (dressed as
// it is) standing behind the table, and the place's Glimmer sitting on it. The lesson's pictures become
// things on the table: counters (cookies, pearls, berries, blocks or flowers, by place) that roll and hop
// to where the next picture puts them, muffin tins for ten frames, plates for groups and a numbered plank
// the Glimmer hops along. The kid's hands do the moves: drag glowing counters into glowing spots, tap them
// away, tap the next number to hop. Words (labels, numbers, speech) are pinned on the page over the 3D
// things, so they stay sharp. The camera moves to frame what matters: the table, the buddy, everyone.
//
// The episode borrows the stage (stage.swap) and hides whatever was on it; it puts it all back on dispose.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import { reach } from './ik';
import { Fx } from './fx';
import { GlimmerModel } from './glimmerModel';
import { propsFor, heroProps } from './episodeProps';
import { loadTexture } from './assets';
import { FRIEND, type FriendId } from '../art/cast';
import { sfx } from '../audio/sound';
import { BW, FC, boundsOf, type Board, type Hue, type Shape, type Tag } from '../math/learn';
import { extraMat, makeDish, shapeGeo, shapeKey, shapeMats, type FracTex } from './fracShapes';
import { SETS, type SetId, type Task, type TokenKind } from '../math/episodes';
import type { GlimmerId } from '../adventure/glimmers';

export type View = { top: number; bottom: number; left: number; right: number };
/** what the camera frames: everyone round the table, the table close up, the buddy, the two friends */
export type Shot = 'intro' | 'wide' | 'board' | 'buddy' | 'pals';
type GMove = Parameters<GlimmerModel['play']>[0];

/** the table top's height, and the part of it the picture fills (metres) */
const TY = 0.48, TW = 1.8, TD = 0.85;
/** the work sits forward on the table, toward the kid (the friends stand behind it) */
const AZ = 0.2;
/** the muffin tin's top, above the table */
const TRAY_TOP = 0.05;
/** the bones the gestures and the looking turn */
const POSED = ['Head', 'Neck', 'Spine', 'Spine1', 'Spine2', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand'];
/** the buddy is drawn a little bigger than life here, like a film's hero */
const BS = 1.15;
/** the picture is stretched toward you a little (the camera looks down at it) */
const DEPTH = 1.15;
/** the number line, where LearnBoard draws it */
const LY = 236, LX0 = 44, LX1 = BW - 44;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (k: number) => k * k * (3 - 2 * k);
const clamp01 = (k: number) => Math.max(0, Math.min(1, k));
const backOut = (k: number) => { const s = 1.9; k -= 1; return k * k * ((s + 1) * k + s) + 1; };

/** each hue's colour, per kind of counter: a blue lot, a pink lot, and the gold ones (the trick's own) */
const HUE: Record<TokenKind, Record<'a' | 'b' | 'c', number>> = {
  cookie: { a: 0x6aaeff, b: 0xff86bd, c: 0xffd04a },
  pearl: { a: 0x9fd0ff, b: 0xffb3d6, c: 0xffd977 },
  berry: { a: 0x4a6fe0, b: 0xec4c80, c: 0xffb733 },
  block: { a: 0x4a95f2, b: 0xf0679f, c: 0xffc23d },
  flower: { a: 0x77afff, b: 0xff82b5, c: 0xffcd3d },
};
/** the part of each counter that isn't its hue (the cookie under the icing, a berry's leaf, a flower's middle) */
const BASE: Record<TokenKind, number | null> = { cookie: 0xd8995a, pearl: null, berry: 0x4f9a3a, block: null, flower: 0xffe08a };

type Token = {
  id: string; g: THREE.Group; hueMesh: THREE.Mesh; halo: THREE.Sprite;
  /** the gold rim round one to touch, and its soft shadow on the table */
  rim: THREE.Mesh; blob: THREE.Mesh;
  hue: Hue; out: boolean;
  /** moving from → to over [t0, t0 + dur], hopping `arc` metres high on the way */
  from: THREE.Vector3; to: THREE.Vector3; t0: number; dur: number; arc: number;
  born: number; scale: number;
  /** on its way out: shrinking away, or flying into the Glimmer's mouth */
  leaving: number; eaten: boolean;
  /** how much it glows (0 none, 1 "touch me") */
  glow: number; lit: number;
  drag: boolean; squashAt: number;
  /** a counter with a shape of its own (a slice, a square, a cupcake), and its undyed part */
  shape?: Shape; extra?: THREE.Mesh;
};
type Spot = { id: string; mesh: THREE.Mesh; at: THREE.Vector3; born: number; leaving: number; strong: boolean };
type Piece = { id: string; g: THREE.Group; born: number; leaving: number };

type Armed = {
  t: Task;
  next: Board;
  /** targets still open: the token id that belongs there and where */
  open: Map<string, THREE.Vector3>;
  /** tokens the kid can touch now */
  live: Set<string>;
  done: number;
  /** the line's hops still to make */
  hops: { a: number; b: number; label: string }[];
  resolve: () => void;
  finishing: boolean;
};

export class EpisodeScene implements Controller {
  fps = 60;
  readonly me: Character;
  readonly pal: GlimmerModel;
  readonly setId: SetId;
  readonly root = new THREE.Group();
  readonly fx = new Fx();
  /** told when something the page shows changes (a hop drawn, a task done) */
  onChange: (() => void) | null = null;
  view: View = { top: 0.08, bottom: 0.78, left: 0, right: 1 };
  /** screen pixels per board unit at the picture's middle (the page sizes words on the table by it) */
  unit = 1;
  /** hops drawn on the number line so far (the page shows their labels) */
  hopsDrawn = 0;
  /** words the kid has tapped open (a label task) */
  revealed = new Set<string>();

  private set: (typeof SETS)[SetId];
  private H: number;
  private now = 0;
  private table!: THREE.Mesh;
  private pool!: THREE.Mesh;
  private cloth!: THREE.Mesh;
  /** the table's back edge (it moves with the work, so the friends always stand right behind it) */
  private backZ = -0.45;
  private backdrop!: THREE.Mesh;
  private beams: THREE.Mesh[] = [];
  private key!: THREE.SpotLight;
  // the board on the table
  private board: Board | null = null;
  private map = { cx: BW / 2, cy: 170, s: TW / BW };
  private area = { x0: -1, x1: 1, z0: -0.5, z1: 0.5 };
  private tokens = new Map<string, Token>();
  private spots = new Map<string, Spot>();
  private trays = new Map<string, Piece>();
  private plates = new Map<string, Piece>();
  /** pie dishes, pizza boards and foil (fractions), and how high each one's floor is */
  private dishes = new Map<string, Piece>();
  private dishLift = new Map<string, number>();
  private fracTex: FracTex = { pie: null, pizza: null, choc: null };
  /** the fraction episodes: one pie or bar big on a bare wooden table, the camera in close */
  private close = false;
  private shapeGeos = new Map<string, ReturnType<typeof shapeGeo>>();
  private plank: THREE.Group | null = null;
  private lineKey = '';
  private stars: THREE.Sprite[] = [];
  private starTex: THREE.Texture | null = null;
  private pileZ = 0;
  private refit = false;
  // shared looks
  private geos: { hue: THREE.BufferGeometry; base: THREE.BufferGeometry | null; rim: THREE.BufferGeometry } | null = null;
  private mats = new Map<string, THREE.Material>();
  private haloTex: THREE.Texture;
  private ringTex: THREE.Texture;
  // the characters
  private buddyAt = new THREE.Vector3(-1.3, 0, -1.0);
  private palHome = new THREE.Vector3(1.3, TY, -0.42);
  private palAt = new THREE.Vector3();
  private palFrom = new THREE.Vector3(); private palTo = new THREE.Vector3(); private palHop0 = -9; private palHopDur = 0.55;
  private lookBoard = 0;
  private busyUntil = 0;
  private gest: { kind: 'point' | 'present' | 'think' | 'oops' | 'clap' | 'shrug' | 'nod' | 'talk' | 'gasp'; at: number; for: number; target?: THREE.Vector3 }[] = [];
  // the camera
  private shotName: Shot = 'intro';
  private shotAt = 0;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private ready = false;
  private before = { fog: null as THREE.Fog | THREE.FogExp2 | null, bg: null as THREE.Color | THREE.Texture | null, fov: 42, env: null as THREE.Texture | null, envK: 1 };
  /** the painted place as light: soft colour and reflections from all round */
  private env: THREE.Texture | null = null;
  private propL: THREE.Group | null = null; private propR: THREE.Group | null = null;
  /** the Glimmer comes over to stand by the buddy (the card) */
  private together = false;
  private hidden: THREE.Object3D[] = [];
  private pins = new Map<HTMLElement, () => THREE.Vector3 | null>();
  // the kid's hands
  private armed: Armed | null = null;
  private held: Token | null = null;
  private heldFrom = new THREE.Vector3();
  private downAt = { x: 0, y: 0 };
  private ray = new THREE.Raycaster();
  private hintAt = 0;
  private lastH = 0;
  private moteT = 0;

  private constructor(setId: SetId, me: Character, pal: GlimmerModel, buddy: FriendId) {
    this.setId = setId; this.set = SETS[setId]; this.me = me; this.pal = pal;
    this.H = (FRIEND[buddy].height ?? 1.2) * BS;
    this.haloTex = glowTexture();
    this.ringTex = ringTexture();
  }

  static async create(opts: { setId: SetId; buddy: FriendId; star?: GlimmerId; evolved?: boolean; frac?: boolean }): Promise<EpisodeScene> {
    const s = SETS[opts.setId];
    const [me, pal] = await Promise.all([Character.create(opts.buddy), GlimmerModel.create(opts.star ?? s.star, 1.0, { evolved: opts.evolved })]);
    if (!me) throw new Error('character missing');
    await Promise.all([dressUp(me), me.loadMoves()]);
    const sc = new EpisodeScene(opts.setId, me, pal, opts.buddy);
    // the painted pie, pizza and chocolate the fraction episodes cut up
    if (opts.frac) {
      const [pie, pizza, choc] = await Promise.all(['pie-top', 'pizza-top', 'choc-top'].map(f => loadTexture(`learn/frac/${f}.webp`)));
      for (const t of [pie, pizza, choc]) if (t) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }
      sc.fracTex = { pie, pizza, choc };
      sc.close = true;
    }
    await sc.build();
    return sc;
  }

  // ---------- the set ----------
  private async build() {
    const s = this.set;
    // (the place behind is a little soft, like a camera focused on the table)
    const [back, top, planks, star, dough, plate, hero] = await Promise.all([
      loadTexture(s.backdrop.replace('.webp', '-soft.webp')), loadTexture(s.table, { repeat: true }), loadTexture('world/planks.webp', { repeat: true }), loadTexture('game/icon-star.webp'),
      loadTexture('learn/ep/tex-cookie.webp', { repeat: true }), loadTexture('learn/ep/tex-plate.webp'), heroProps(this.setId),
    ]);
    this.starTex = star; this.doughTex = dough; this.plateTex = plate;
    this.blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, fog: false, opacity: 0.6 });
    // the painted place behind (kept exactly as painted: no fog, no tone mapping)
    const bm = new THREE.MeshBasicMaterial({ map: back, fog: false, toneMapped: false, depthWrite: false });
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bm);
    this.backdrop.renderOrder = -2;
    this.backdrop.userData.aspect = back?.image ? (back.image as { width: number }).width / (back.image as { height: number }).height : 1.5;
    this.root.add(this.backdrop);
    // the table: wide and deep, so its edges stay out of the picture
    if (top) { top.repeat.set(6 / 1.3, 3.2 / 1.3); top.anisotropy = 8; }
    const tg = new THREE.BoxGeometry(6, 0.12, 3.2);
    this.table = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ map: top, color: 0xeedccb, roughness: 0.82, metalness: 0 }));
    this.table.position.set(0, TY - 0.06, 1.15);
    this.table.receiveShadow = true;
    this.root.add(this.table);
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, depthWrite: false, fog: false }));
    this.pool.position.set(0, TY + 0.0015, 1.15);
    this.pool.renderOrder = 1;
    this.root.add(this.pool);
    // a cloth under the work (a linen runner, a sack, felt...), its size set by the work's
    this.cloth = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: clothTexture(this.setId), roughness: 0.92 }));
    this.cloth.position.y = TY + 0.002;
    this.cloth.receiveShadow = true;
    this.cloth.renderOrder = 1;
    this.root.add(this.cloth);
    // light: a warm key from the window side with soft shadows, sky and bounce, and a rim from behind
    const hemi = new THREE.HemisphereLight(s.sky, s.ground, 0.55);
    const key = new THREE.SpotLight(s.key, 170, 0, 0.4, 1, 1.6);
    key.position.set(-2.6, 4.3, 2.4);
    key.target.position.set(0.1, TY, -0.25);
    key.castShadow = true;
    key.shadow.mapSize.set(stage.low ? 1024 : 2048, stage.low ? 1024 : 2048);
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    Object.assign(key.shadow.camera, { near: 2, far: 12 });
    const rim = new THREE.DirectionalLight(s.key, 1.5);
    rim.position.set(1.5, 3, -4);
    const fill = new THREE.DirectionalLight(s.sky, 0.55);
    fill.position.set(3, 2, 3);
    this.key = key;
    this.root.add(hemi, key, key.target, rim, fill);
    // sunbeams slanting down across the room
    const beamMat = new THREE.MeshBasicMaterial({ map: beamTexture(), color: s.key, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    for (const [x, w, rot] of [[-1.6, 0.9, 0.5], [-0.4, 0.55, 0.5], [0.9, 0.7, 0.5]] as const) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 5), beamMat);
      m.position.set(x, 2.1, -1.7); m.rotation.z = rot;
      m.renderOrder = 5;
      this.beams.push(m); this.root.add(m);
    }
    this.plankTex = planks;
    if (back && stage.renderer) {
      const eq = back.clone(); eq.mapping = THREE.EquirectangularReflectionMapping; eq.needsUpdate = true;
      const pm = new THREE.PMREMGenerator(stage.renderer);
      this.env = pm.fromEquirectangular(eq).texture;
      pm.dispose(); eq.dispose();
    }
    // the hero things at the table's front corners (modelled), or simple ones if they didn't load
    const pr = hero ?? propsFor(this.setId);
    this.propL = pr.left; this.propR = pr.right;
    for (const g of [pr.left, pr.right]) { g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } }); g.add(this.blob(0.5)); }
    this.root.add(pr.left, pr.right);
    // the counters' shapes, by place
    this.geos = tokenGeos(this.set.token);
    // the characters
    const me = this.me;
    me.root.position.copy(this.buddyAt);
    me.root.scale.multiplyScalar(BS);
    me.play('idle', 0);
    me.root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.pal.root.traverse(o => { if ((o as THREE.Mesh).isMesh) o.castShadow = true; });
    this.pal.fx = this.fx;
    for (const c of this.pal.root.children) if ((c as THREE.Mesh).geometry?.type === 'CircleGeometry') c.visible = false;
    this.palAt.copy(this.palHome);
    this.root.add(me.root, this.pal.root, this.fx.root);
  }
  private plankTex: THREE.Texture | null = null;
  private doughTex: THREE.Texture | null = null;
  private plateTex: THREE.Texture | null = null;
  private blobGeo!: THREE.BufferGeometry;
  private blobMat!: THREE.MeshBasicMaterial;
  /** a soft round shadow lying on the table (size in metres, or in its parent's units) */
  private blob(size: number) {
    const b = new THREE.Mesh(this.blobGeo, this.blobMat);
    b.scale.set(size, 1, size * DEPTH);
    b.position.y = 0.003;
    b.renderOrder = 2;
    return b;
  }
  /** the buddy's happy bounce, and when it started */
  private bounceAt = -9;
  /** the friends lean in while the kid works */
  private leanIn = 0;

  /** Put the set on the stage, hiding what was there (call once it runs). */
  enter() {
    const sc = stage.scene;
    this.hidden = sc.children.filter(o => o.visible && o !== this.root);
    for (const o of this.hidden) o.visible = false;
    this.before = { fog: sc.fog, bg: sc.background as THREE.Color | THREE.Texture | null, fov: stage.camera.fov, env: sc.environment, envK: sc.environmentIntensity };
    sc.environment = this.env; sc.environmentIntensity = 0.55;
    sc.fog = new THREE.Fog(this.set.haze, 14, 40);
    sc.background = new THREE.Color(this.set.haze);
    stage.camera.fov = 36; stage.camera.updateProjectionMatrix();
    sc.add(this.root);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
    this.pal.play('appear');
  }

  // ---------- characters ----------
  private compact = false;
  /** Where the buddy and the Glimmer stand: closer together on a tall screen. */
  private layout() {
    const W = innerWidth || 1, Hh = innerHeight || 1;
    const asp = ((this.view.right - this.view.left) * W) / Math.max(1, (this.view.bottom - this.view.top) * Hh);
    const compact = asp < 1.05;
    this.compact = compact;
    // the table's back edge just behind the work; the friends stand right behind it, either side of the
    // work (the table hides their legs)
    const a = this.area;
    const back = a.z0 - 0.08;
    // (the fraction episodes: a big pie on the table, the friends just behind its edges, like the concept)
    // (on a phone the camera looks down: by a wide picture they stand further back, so a big Glimmer never looms over it)
    const inset = this.close && !compact ? (a.x1 - a.x0) * 0.12 : 0.06, far = this.close && compact && !this.stackFrac ? 0.3 : 0;
    this.buddyAt.set(compact ? -0.34 : Math.min(-0.62, a.x0 + inset), 0, back - 0.15 - far);
    this.palHome.set(compact ? 0.4 : Math.max(0.66, a.x1 - inset), TY - 0.17, back - 0.2 - far);
    if (this.together) this.palHome.set(this.buddyAt.x + (compact ? 0.66 : 1.0), TY - 0.17, back - 0.2);
    this.backZ += (back - this.backZ) * 0.08;
    this.table.position.z = this.backZ + 1.6; this.pool.position.z = this.backZ + 1.6;
    // the cloth under the work
    this.cloth.position.set((a.x0 + a.x1) / 2, TY + 0.002, (a.z0 + a.z1) / 2 + 0.02);
    this.cloth.visible = !this.close;
    this.cloth.scale.set(a.x1 - a.x0 + (compact ? 0.14 : 0.24), 1, a.z1 - a.z0 + (compact ? 0.1 : 0.16));
    // the hero things at the table's front corners, just outside the work
    this.propL?.position.set(a.x0 - (compact ? 0.05 : 0.28), TY, a.z1 + (compact ? 0.3 : 0.02));
    this.propR?.position.set(a.x1 + (compact ? 0.05 : 0.3), TY, a.z1 + (compact ? 0.3 : 0));
    this.propL?.scale.setScalar(compact ? 0.7 : 0.85); this.propR?.scale.setScalar(compact ? 0.7 : 0.85);
  }
  /** Buddy moves (the clips it has), and gestures done with its arms. */
  wave() { this.clip(['wave1', 'wave'], 2.2); }
  cheer() { this.clip(['fistpump', 'jump', 'cheer'], 1.8); }
  jump() { this.clip(['jump', 'fistpump'], 1.4); }
  dance(id: string) { this.clip([id, 'dance_happyhands', 'fistpump'], 6); }
  point(at?: THREE.Vector3, secs = 1.8) { this.gesture('point', secs, at ?? this.centre()); }
  present(secs = 2) { this.gesture('present', secs, this.centre()); }
  think(secs = 2.2) { this.gesture('think', secs); }
  oops() { this.gesture('oops', 1.6); }
  clap() { this.gesture('clap', 1.2); }
  shrug() { this.gesture('shrug', 1.3); }
  nod() { this.gesture('nod', 0.6); }
  talk(secs = 2) { this.gesture('talk', secs); }
  /** a gasp: hands up by its cheeks, leaning back ("oh!") */
  gasp() { this.gesture('gasp', 1.4); this.bounceAt = this.now; }
  /** a happy little bounce (a right move) */
  bounce() { this.bounceAt = this.now; }
  /** The Glimmer hops over to stand by the buddy (or back to its place). */
  gather(on: boolean) { if (on !== this.together) { this.together = on; this.layout(); if (!this.board?.line) this.hopPal(this.palHome.clone(), false); } }
  /** The Glimmer's moves: hop, happy (a spin), act (a lean), sad. */
  palDo(m: GMove) { if (this.palHop0 + this.palHopDur < this.now) this.pal.play(m); }
  private clip(names: string[], secs: number) {
    const name = names.find(n => this.me.has(n));
    if (!name) return;
    this.gest = this.gest.filter(g => g.kind === 'talk');
    const a = this.me.play(name, 0.2); a?.reset();
    this.busyUntil = this.now + secs;
  }
  private gesture(kind: EpisodeScene['gest'][number]['kind'], secs: number, target?: THREE.Vector3) {
    this.gest = this.gest.filter(g => g.kind !== kind && (kind === 'talk' || kind === 'nod' || g.kind === 'talk' || g.kind === 'nod'));
    this.gest.push({ kind, at: this.now, for: secs, target: target?.clone() });
  }
  private centre() { return new THREE.Vector3((this.area.x0 + this.area.x1) / 2, TY + 0.05, (this.area.z0 + this.area.z1) / 2); }

  // ---------- the camera ----------
  shot(s: Shot) { if (s !== this.shotName) { this.shotName = s; this.shotAt = this.now; } }
  setView(v: View) { this.view = v; }

  // ---------- board → table ----------
  /** On a tall screen two tins side by side stack instead (the second under the first), so every
   *  counter is big enough to touch. Everything in the right half moves with its tin. */
  private stack = false;
  /** The same for a fraction picture with its things either side (a pie and a plate, two pizzas): the
   *  right-hand one goes under the left, so both are big enough to share onto. */
  private stackFrac = false;
  private mv<T extends { x: number; y: number }>(o: T, b: Board): T {
    if (this.stackFrac) return o.x >= 300 ? { ...o, x: o.x - 250, y: o.y + 250 } : o;
    if (this.stack && b.frames.length === 2) return o.x >= 300 ? { ...o, x: o.x - 256, y: o.y + FC * 2 + 26 } : o;
    return o;
  }
  private tf(b: Board): Board {
    if (this.stackFrac) return { ...b, dots: b.dots.map(o => this.mv(o, b)), plates: b.plates.map(o => this.mv(o, b)), dishes: b.dishes?.map(o => this.mv(o, b)), tags: b.tags.map(o => this.mv(o, b)) };
    if (!this.stack || b.frames.length !== 2) return b;
    return { ...b, frames: b.frames.map(o => this.mv(o, b)), dots: b.dots.map(o => this.mv(o, b)), tags: b.tags.map(o => this.mv(o, b)) };
  }
  /** Fit these pictures onto the table (call when the picture's zoom changes). */
  fitBoards(boards: Board[]) {
    const W = innerWidth || 1, Hh = innerHeight || 1;
    this.stack = ((this.view.right - this.view.left) * W) / Math.max(1, (this.view.bottom - this.view.top) * Hh) < 0.9;
    // (only when no dish or plate sits across the middle, and something is on the right)
    const things = (b: Board) => [...b.plates.map(p => ({ x: p.x, h: p.r })), ...(b.dishes ?? []).map(p => ({ x: p.x, h: p.kind === 'foil' ? (p.w ?? 0) / 2 : p.r }))];
    this.stackFrac = this.stack && this.close && boards.every(b => !b.line && !b.frames.length && things(b).every(p => p.x + p.h * 0.5 < 300 || p.x - p.h * 0.5 > 300))
      && boards.some(b => things(b).some(p => p.x >= 300));
    this.fit(boundsOf(boards.map(b => this.tf(b))));
  }
  /** where a word of the picture on the table now sits */
  tagPoint(t: Tag): THREE.Vector3 {
    const m = this.board ? this.mv(t, this.board) : t;
    return this.boardPoint(m.x, m.y, 0.03);
  }
  /** Fit these board bounds onto the table (call when the picture's zoom changes). */
  fit(b: { x: number; y: number; w: number; h: number }) {
    // (stacked on a phone: narrower and deeper, seen from higher up)
    const k = this.close ? 1.45 : 1;
    const s = this.stack ? Math.min(1.05 * k / b.w, 1.3 * k / (b.h * DEPTH)) : Math.min(TW * k / b.w, TD * k / (b.h * DEPTH));
    const m = { cx: b.x + b.w / 2, cy: b.y + b.h / 2, s };
    // a new zoom: the tins, plates and plank are made again at the new size (the counters glide over)
    if (Math.abs(m.cx - this.map.cx) > 0.5 || Math.abs(m.cy - this.map.cy) > 0.5 || Math.abs(m.s - this.map.s) > 1e-6) this.refit = true;
    this.map = m;
    this.area = { x0: -b.w * s / 2, x1: b.w * s / 2, z0: -b.h * s * DEPTH / 2 + AZ, z1: b.h * s * DEPTH / 2 + AZ };
    this.pileZ = this.area.z1 + 0.12;
  }
  /** A point on the table under a spot on the board. */
  boardPoint(x: number, y: number, lift = 0): THREE.Vector3 {
    const m = this.map;
    return new THREE.Vector3((x - m.cx) * m.s, TY + lift, (y - m.cy) * m.s * DEPTH + AZ);
  }
  private get r() { return (FC / 2) * this.map.s * 0.9; }
  /** how high a counter sits at this spot on the board: in a tin's cup, on a plate, on the plank */
  private liftAt(b: Board, x: number, y: number) {
    // (in a tin's cup the cookie stands up out of it: only its bottom is in the cup)
    for (const f of b.frames) if (x > f.x && x < f.x + FC * 5 && y > f.y && y < f.y + FC * 2) return TRAY_TOP - this.r * 0.18;
    for (const p of b.plates) if (Math.hypot(x - p.x, y - p.y) < p.r) return p.r * this.map.s * (this.deepPlates ? 0.08 : 0.06);
    for (const p of b.dishes ?? []) {
      const inside = p.kind === 'foil' ? Math.abs(x - p.x) < (p.w ?? 0) / 2 && Math.abs(y - p.y) < (p.h ?? 0) / 2 : Math.hypot(x - p.x, y - p.y) < p.r;
      if (inside) return this.dishLift.get(p.id) ?? (p.kind === 'pie' ? p.r * this.map.s * 0.04 : 0.02);
    }
    if (b.line && Math.abs(y - LY) < 20) return 0.04;
    return 0;
  }
  private get deepPlates() { return this.set.token === 'pearl' || this.set.token === 'flower' || this.set.token === 'block'; }

  /** Show a picture: everything moves, pops in or leaves to match it. */
  show(raw: Board, instant = false) {
    const b = this.tf(raw);
    const prev = this.board;
    this.board = b;
    const t = this.now;
    if (this.refit) {
      this.refit = false;
      for (const map of [this.trays, this.plates, this.dishes]) { for (const p of map.values()) { p.g.removeFromParent(); dispose(p.g); } map.clear(); }
      this.trayRects.clear();
      if (this.plank) { this.plank.removeFromParent(); dispose(this.plank); this.plank = null; }
      this.lineKey = '';
      if (this.chartMesh) { this.chartMesh.removeFromParent(); dispose(this.chartMesh); this.chartMesh = null; }
      this.chartKey = '';
      this.clearStars(); this.hopsDrawn = 0;
      for (const [k, sp] of this.spots) if (k.startsWith('g:')) { sp.mesh.removeFromParent(); this.spots.delete(k); }
    }
    // counters
    const keep = new Set<string>();
    for (const d of b.dots) {
      if (d.c === 'ghost') continue;
      keep.add(d.id);
      const at = this.boardPoint(d.x, d.y, this.liftAt(b, d.x, d.y));
      let tk = this.tokens.get(d.id);
      if (!tk) {
        tk = this.token(d.id, d.c, at, d.shape);
        tk.born = instant ? -9 : t + (d.d ?? 0) * 1.4;
        if (!instant) { tk.from = at.clone().add(new THREE.Vector3(0, 0.22, 0)); tk.t0 = tk.born; tk.dur = 0.38; tk.arc = 0; tk.squashAt = tk.born + 0.38; }
      } else if (!tk.drag) {
        if (tk.to.distanceTo(at) > 1e-3) { tk.from = this.tokenPos(tk); tk.to = at; tk.t0 = instant ? -9 : t + (d.d ?? 0) * 1.4; tk.dur = 0.75; tk.arc = Math.min(0.25, 0.06 + tk.from.distanceTo(at) * 0.18); }
      }
      if (tk.hue !== d.c) this.recolor(tk, d.c);
      if (!!d.out !== tk.out) { tk.out = !!d.out; this.recolor(tk, tk.hue); }
      tk.glow = d.c === 'c' && !d.out ? 0.45 : 0;
      tk.leaving = 0;
    }
    for (const tk of this.tokens.values()) if (!keep.has(tk.id) && !tk.leaving) tk.leaving = instant ? t - 9 : t;
    // empty places (ghosts): glowing rings on the table
    const ghosts = new Set(b.dots.filter(d => d.c === 'ghost').map(d => d.id));
    for (const d of b.dots) if (d.c === 'ghost' && !this.spots.has('g:' + d.id)) this.spot('g:' + d.id, this.boardPoint(d.x, d.y), false, instant);
    for (const [k, s] of this.spots) if (k.startsWith('g:') && !ghosts.has(k.slice(2)) && !s.leaving) s.leaving = t;
    // ten frames and plates
    this.pieces(this.trays, b.frames.map(f => ({ id: f.id, make: () => this.tray(f.x, f.y) })), instant);
    this.pieces(this.plates, b.plates.map(p => ({ id: p.id, make: () => this.plate(p.x, p.y, p.r, !!p.empty) })), instant);
    this.pieces(this.dishes, (b.dishes ?? []).map(p => ({ id: p.id, make: () => {
      const { g, lift } = makeDish(p.kind, p.r, p.w ?? 0, p.h ?? 0, this.map.s, DEPTH, this.plankTex);
      this.dishLift.set(p.id, lift);
      g.add(this.blob(p.kind === 'foil' ? (p.w ?? 100) * this.map.s * 1.1 : p.r * this.map.s * 2.4));
      g.position.copy(this.boardPoint(p.x, p.y));
      return g;
    } })), instant);
    // a treasure map with its grid (negative numbers)
    const ck = b.chart ? JSON.stringify(b.chart) : '';
    if (ck !== this.chartKey) {
      this.chartKey = ck;
      if (this.chartMesh) { this.chartMesh.removeFromParent(); dispose(this.chartMesh); this.chartMesh = null; }
      if (b.chart) { this.chartMesh = this.makeChart(b.chart); this.root.add(this.chartMesh); }
    }
    // the number line
    const lk = b.line ? `${b.line.from}-${b.line.to}` : '';
    if (lk !== this.lineKey) {
      this.lineKey = lk;
      if (this.plank) { this.plank.removeFromParent(); dispose(this.plank); this.plank = null; }
      if (b.line) { this.plank = this.makePlank(b.line.from, b.line.to); this.root.add(this.plank); }
    }
    if (b.line) {
      const want = b.line.hops.length;
      if (want < this.hopsDrawn || !prev?.line || prev.line.from !== b.line.from) { this.clearStars(); this.hopsDrawn = 0; }
      for (let i = this.hopsDrawn; i < want; i++) this.trail(b.line.hops[i].a, b.line.hops[i].b, instant ? 0 : i * 0.1);
      this.hopsDrawn = want;
      const st = this.standAt(b.line.at);
      if (this.palAt.distanceTo(st) > 0.01) this.hopPal(st, instant);
    } else {
      this.clearStars(); this.hopsDrawn = 0;
      if (this.palAt.distanceTo(this.palHome) > 0.01) this.hopPal(this.palHome.clone(), instant);
    }
    this.onChange?.();
  }

  private pieces(map: Map<string, Piece>, want: { id: string; make: () => THREE.Group }[], instant: boolean) {
    const ids = new Set(want.map(w => w.id));
    for (const w of want) if (!map.has(w.id)) { const g = w.make(); this.root.add(g); map.set(w.id, { id: w.id, g, born: instant ? -9 : this.now, leaving: 0 }); }
    for (const p of map.values()) if (!ids.has(p.id) && !p.leaving) p.leaving = instant ? this.now - 9 : this.now;
  }

  // ---------- making things ----------
  private mat(key: string, make: () => THREE.Material) {
    let m = this.mats.get(key);
    if (!m) { m = make(); this.mats.set(key, m); }
    return m;
  }
  private hueMat(hue: Hue, out: boolean) {
    const kind = this.set.token;
    if (out) return this.mat('out', () => new THREE.MeshStandardMaterial({ color: 0xc9c1b4, roughness: 0.8, transparent: true, opacity: 0.55 }));
    const c = HUE[kind][hue === 'ghost' ? 'a' : hue];
    const rough = kind === 'pearl' ? 0.12 : kind === 'berry' ? 0.28 : kind === 'block' ? 0.4 : 0.35;
    // glossy (icing, pearls, berries, painted blocks), and a little light from inside (the gold ones more)
    return this.mat('h' + hue, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: rough, metalness: kind === 'pearl' ? 0.1 : 0, clearcoat: kind === 'flower' ? 0.2 : 1, clearcoatRoughness: 0.12,
      iridescence: kind === 'pearl' ? 0.8 : 0, sheen: kind === 'flower' ? 1 : 0, sheenColor: new THREE.Color(0xffffff), emissive: c, emissiveIntensity: hue === 'c' ? 0.3 : 0.07 }));
  }
  private token(id: string, hue: Hue, at: THREE.Vector3, shape?: Shape): Token {
    const r = this.r;
    let geos = this.geos!;
    let extra: THREE.Mesh | undefined;
    if (shape) {
      const key = shapeKey(shape);
      let sg = this.shapeGeos.get(key);
      if (!sg) { sg = shapeGeo(shape, FC * 0.45, DEPTH); this.shapeGeos.set(key, sg); }
      geos = { hue: sg.main, base: null, rim: sg.main };
      if (sg.extra) { extra = new THREE.Mesh(sg.extra, extraMat((k, m) => this.mat(k, m))); extra.castShadow = true; extra.receiveShadow = true; }
    }
    const g = new THREE.Group();
    const hueMesh = new THREE.Mesh(geos.hue, shape ? shapeMats(shape, hue, false, this.fracTex, (k, m) => this.mat(k, m)) : this.hueMat(hue, false));
    hueMesh.castShadow = true; hueMesh.receiveShadow = !!shape;
    g.add(hueMesh);
    if (extra) g.add(extra);
    if (geos.base) {
      const cookie = this.set.token === 'cookie';
      const base = new THREE.Mesh(geos.base, this.mat('base', () => new THREE.MeshStandardMaterial({ color: cookie ? 0xffffff : BASE[this.set.token] ?? 0xffffff, map: cookie ? this.doughTex : null, roughness: 0.8 })));
      base.castShadow = true;
      g.add(base);
    }
    // the gold rim that says "touch me": the shape again, a little bigger, lit from behind
    const rim = new THREE.Mesh(geos.rim, this.mat('rimglow', () => new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })).clone() as THREE.MeshBasicMaterial);
    rim.scale.set(1.22, 1.35, 1.22);
    rim.visible = false;
    g.add(rim);
    const blob = this.blob(r * 2.6);
    blob.position.copy(at).setY(at.y + 0.003);
    this.root.add(blob);
    const halo = new THREE.Sprite(this.mat('halo' + hue, () => new THREE.SpriteMaterial({ map: this.haloTex, color: hue === 'c' ? 0xffd25a : 0xfff0b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })).clone() as THREE.SpriteMaterial);
    halo.position.y = 0.5;
    halo.scale.setScalar(3.4);
    halo.renderOrder = 6;
    halo.visible = false;
    g.add(halo);
    g.scale.setScalar(r);
    g.position.copy(at);
    this.root.add(g);
    const tk: Token = { id, g, hueMesh, halo, rim, blob, hue, out: false, from: at.clone(), to: at.clone(), t0: -9, dur: 0.5, arc: 0, born: -9, scale: r, leaving: 0, eaten: false, glow: 0, lit: 0, drag: false, squashAt: -9, shape, extra };
    // a flat thing (a slice, a square): its glow is a thin border round it, not a big shell
    if (shape && shape.k !== 'cupcake') rim.scale.set(1.08, 1.6, 1.08);
    this.tokens.set(id, tk);
    return tk;
  }
  private recolor(tk: Token, hue: Hue) { tk.hue = hue; tk.hueMesh.material = tk.shape ? shapeMats(tk.shape, hue, tk.out, this.fracTex, (k, m) => this.mat(k, m)) : this.hueMat(hue, tk.out); }
  private spot(key: string, at: THREE.Vector3, strong: boolean, instant = false) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.ringTex, color: strong ? 0xffe27a : 0xfff4dc, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(at).setY(this.onTray(at) ? TY + TRAY_TOP + 0.002 : Math.max(TY + 0.004, at.y + 0.004));
    m.scale.setScalar(this.r * (strong ? 3.0 : 2.4));
    m.renderOrder = 4;
    this.root.add(m);
    const s: Spot = { id: key, mesh: m, at: at.clone(), born: instant ? -9 : this.now, leaving: 0, strong };
    this.spots.set(key, s);
    return s;
  }
  /** a muffin tin (a crate, box or seed tray elsewhere): a top plate with ten round holes and a rolled
   *  rim, standing on ten deep cups, by the frame's top left corner */
  private tray(x: number, y: number) {
    const s = this.map.s, c = this.set.tray, cell = FC * s;
    const w = (FC * 5 + 26) * s, d = (FC * 2 + 22) * s, cr = cell * 0.43;
    const tin = this.set.token === 'cookie';
    const g = new THREE.Group();
    const at = (i: number) => [((i % 5) + 0.5 - 2.5) * cell, (Math.floor(i / 5) + 0.5 - 1) * cell] as const;
    // the plate: a rounded rectangle with the holes cut out
    const rr = Math.min(w, d) * 0.12, shape = new THREE.Shape();
    shape.moveTo(-w / 2 + rr, -d / 2); shape.lineTo(w / 2 - rr, -d / 2); shape.quadraticCurveTo(w / 2, -d / 2, w / 2, -d / 2 + rr);
    shape.lineTo(w / 2, d / 2 - rr); shape.quadraticCurveTo(w / 2, d / 2, w / 2 - rr, d / 2); shape.lineTo(-w / 2 + rr, d / 2);
    shape.quadraticCurveTo(-w / 2, d / 2, -w / 2, d / 2 - rr); shape.lineTo(-w / 2, -d / 2 + rr); shape.quadraticCurveTo(-w / 2, -d / 2, -w / 2 + rr, -d / 2);
    for (let i = 0; i < 10; i++) { const [hx, hz] = at(i); const h = new THREE.Path(); h.absarc(hx, -hz, cr, 0, Math.PI * 2, true); shape.holes.push(h); }
    const pg = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2, curveSegments: 18 });
    pg.rotateX(-Math.PI / 2); pg.translate(0, TRAY_TOP - 0.01, 0); pg.scale(1, 1, DEPTH);
    const plateMat = this.mat('tray', () => new THREE.MeshStandardMaterial({ color: c.color, roughness: tin ? 0.26 : 0.5, metalness: tin ? 0.6 : 0 }));
    const plate = new THREE.Mesh(pg, plateMat);
    plate.castShadow = true; plate.receiveShadow = true;
    g.add(plate);
    // the cups under the holes (a bowl each), and the legs of the tin: its sides down to the table
    const cups: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 10; i++) {
      const [hx, hz] = at(i);
      const cup = new THREE.LatheGeometry([[0, 0.004], [cr * 0.62, 0.004], [cr * 0.86, 0.012], [cr * 0.98, TRAY_TOP - 0.006], [cr * 1.0, TRAY_TOP - 0.002]].map(([a, b]) => new THREE.Vector2(a, b)), 26);
      cup.translate(hx, 0, hz);
      cups.push(cup.toNonIndexed());
    }
    cups.push(new RoundedBoxGeometry(w * 0.98, TRAY_TOP - 0.008, d * 0.98, 2, 0.006).translate(0, (TRAY_TOP - 0.008) / 2, 0).toNonIndexed());
    const cg = mergeGeometries(cups.map(geo => { geo.deleteAttribute('uv'); return geo; }));
    cg.scale(1, 1, DEPTH);
    const cm = new THREE.Mesh(cg, this.mat('cups', () => new THREE.MeshStandardMaterial({ color: c.rim, roughness: tin ? 0.32 : 0.55, metalness: tin ? 0.55 : 0, side: THREE.DoubleSide })));
    cm.castShadow = true; cm.receiveShadow = true;
    g.add(cm);
    const sh = this.blob(1); sh.scale.set(w * 1.2, 1, d * DEPTH * 1.25); g.add(sh);
    g.position.copy(this.boardPoint(x + FC * 2.5, y + FC));
    this.trayRects.set(`${x},${y}`, { x0: g.position.x - w / 2, x1: g.position.x + w / 2, z0: g.position.z - (d * DEPTH) / 2, z1: g.position.z + (d * DEPTH) / 2 });
    return g;
  }
  /** where the tins are on the table (a place in one glows on its top, round the hole) */
  private trayRects = new Map<string, { x0: number; x1: number; z0: number; z1: number }>();
  private onTray(p: THREE.Vector3) { for (const r of this.trayRects.values()) if (p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1) return true; return false; }
  /** a plate (or bucket, bin, pot) for a group, by its middle */
  private plate(x: number, y: number, rr: number, empty: boolean) {
    const s = this.map.s, c = this.set.plate, r = rr * s;
    const deep = this.deepPlates;
    const h = deep ? r * 0.42 : r * 0.14;
    const prof = deep
      ? [[0, 0], [r * 0.78, 0], [r * 0.86, h * 0.1], [r * 0.98, h], [r * 1.02, h * 1.06], [r * 0.95, h * 1.02], [r * 0.82, h * 0.2], [0, h * 0.18]]
      : [[0, 0], [r * 0.6, 0], [r * 0.66, h * 0.25], [r * 0.95, h], [r * 1.0, h * 1.02], [r * 0.93, h * 0.95], [r * 0.64, h * 0.45], [0, h * 0.42]];
    const geo = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 40);
    geo.scale(1, 1, DEPTH);
    const g = new THREE.Group();
    const m = new THREE.Mesh(geo, this.mat('plate', () => new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.32, side: THREE.DoubleSide })));
    m.castShadow = true; m.receiveShadow = true;
    if (empty) { m.material = this.mat('plate-e', () => new THREE.MeshStandardMaterial({ color: c.color, roughness: 0.32, transparent: true, opacity: 0.55, side: THREE.DoubleSide })); }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, Math.max(0.004, r * 0.035), 6, 40).rotateX(Math.PI / 2).scale(1, 1, DEPTH), this.mat('rim', () => new THREE.MeshStandardMaterial({ color: c.rim, roughness: 0.4 })));
    rim.position.y = h * 1.01;
    g.add(m, rim);
    if (!deep && this.plateTex) {
      // the painted plate (blue vines round the rim) lying in the dish
      const top = new THREE.Mesh(new THREE.CircleGeometry(r * 0.99, 48).rotateX(-Math.PI / 2).scale(1, 1, DEPTH), this.mat('platetop', () => new THREE.MeshStandardMaterial({ map: this.plateTex, roughness: 0.25, transparent: empty, opacity: empty ? 0.6 : 1 })));
      top.position.y = h * 0.46; top.receiveShadow = true;
      g.add(top);
    }
    g.add(this.blob(r * 2.5));
    g.position.copy(this.boardPoint(x, y));
    return g;
  }
  private chartMesh: THREE.Group | null = null;
  private chartKey = '';
  /** A treasure map lying on the table: old paper with the coordinate grid, the axes as dark lines and
   *  every line numbered (minus numbers in blue), a little lifted at the edges. */
  private makeChart(c: NonNullable<Board['chart']>) {
    const nx = c.xMax - c.xMin, ny = c.yMax - c.yMin, P = 110, pad = 0.8;
    const cv = document.createElement('canvas');
    cv.width = Math.round((nx + pad * 2) * P); cv.height = Math.round((ny + pad * 2) * P);
    const g = cv.getContext('2d')!;
    const SW = cv.width, SH = cv.height;
    const grad = g.createRadialGradient(SW / 2, SH / 2, SH * 0.2, SW / 2, SH / 2, SW * 0.6);
    grad.addColorStop(0, '#fbf0d4'); grad.addColorStop(1, '#e8cf9a');
    g.fillStyle = grad; g.fillRect(0, 0, SW, SH);
    for (let i = 0; i < SW * SH / 400; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(150,100,40,0.06)' : 'rgba(255,255,240,0.2)'; g.fillRect(Math.random() * SW, Math.random() * SH, 3, 3); }
    g.strokeStyle = '#b8894a'; g.lineWidth = 12; g.strokeRect(10, 10, SW - 20, SH - 20);
    const X = (v: number) => (v - c.xMin + pad) * P, Y = (v: number) => (c.yMax - v + pad) * P;
    for (let v = c.xMin; v <= c.xMax; v++) { const axis = v === 0; g.strokeStyle = axis ? '#5b3416' : 'rgba(120,80,35,0.35)'; g.lineWidth = axis ? 9 : 3; g.beginPath(); g.moveTo(X(v), Y(c.yMax) - (axis ? P * 0.45 : 0)); g.lineTo(X(v), Y(c.yMin) + (axis ? P * 0.45 : 0)); g.stroke(); }
    for (let v = c.yMin; v <= c.yMax; v++) { const axis = v === 0; g.strokeStyle = axis ? '#5b3416' : 'rgba(120,80,35,0.35)'; g.lineWidth = axis ? 9 : 3; g.beginPath(); g.moveTo(X(c.xMin) - (axis ? P * 0.45 : 0), Y(v)); g.lineTo(X(c.xMax) + (axis ? P * 0.45 : 0), Y(v)); g.stroke(); }
    g.font = `700 ${Math.round(P * 0.46)}px "Fredoka", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const label = (s: string, x: number, y: number, col: string) => { g.strokeStyle = 'rgba(255,248,230,0.95)'; g.lineWidth = 10; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
    const txt = (v: number) => (v < 0 ? `−${-v}` : String(v));
    for (let v = c.xMin; v <= c.xMax; v++) if (v !== 0) label(txt(v), X(v), Y(0) + P * 0.42, v < 0 ? '#1f5f9e' : '#5b3416');
    for (let v = c.yMin; v <= c.yMax; v++) if (v !== 0) label(txt(v), X(0) - P * 0.42, Y(v), v < 0 ? '#1f5f9e' : '#5b3416');
    label('0', X(0) - P * 0.34, Y(0) + P * 0.38, '#5b3416');
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const w = (nx + pad * 2) * c.cell * this.map.s, d = (ny + pad * 2) * c.cell * this.map.s;
    const grp = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(w, d * DEPTH).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    paper.receiveShadow = true;
    grp.add(paper);
    grp.add(this.blob(w * 1.2));
    const at = this.boardPoint(c.x + ((c.xMin + c.xMax) / 2) * c.cell, c.y - ((c.yMin + c.yMax) / 2) * c.cell, 0.004);
    grp.position.copy(at);
    return grp;
  }
  /** the number line: a wooden plank with a peg at every number */
  private makePlank(from: number, to: number) {
    const g = new THREE.Group();
    const a = this.boardPoint(LX0 - 22, LY), b = this.boardPoint(LX1 + 22, LY);
    const len = b.x - a.x, depth = this.plankDepth;
    const tex = this.plankTex?.clone() ?? null;
    if (tex) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(len / 0.6, 1); tex.needsUpdate = true; }
    const den = this.board?.line?.den;
    if (this.close && den) {
      // a fraction's plank: one piece of wood for each equal jump, the colours taking turns, so you can
      // see the equal parts (and a darker end beyond 0 and beyond the last number)
      const H = 0.06, piece = (x0: number, x1: number, color: number) => {
        const m = new THREE.Mesh(new RoundedBoxGeometry(x1 - x0, H, depth, 2, 0.014), new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.8 }));
        m.position.set((x0 + x1) / 2, TY + H / 2, a.z); m.castShadow = true; m.receiveShadow = true; g.add(m);
      };
      piece(a.x, this.linePoint(from).x - 0.004, 0x9a6438);
      for (let n = from; n < to; n++) piece(this.linePoint(n).x + 0.004, this.linePoint(n + 1).x - 0.004, (n - from) % 2 ? 0xb87440 : 0xf7d6a0);
      piece(this.linePoint(to).x + 0.004, b.x, 0x9a6438);
      return g;
    }
    const plank = new THREE.Mesh(new RoundedBoxGeometry(len, 0.04, depth, 2, 0.012), new THREE.MeshStandardMaterial({ map: tex, color: 0xd9a86a, roughness: 0.8 }));
    plank.position.set((a.x + b.x) / 2, TY + 0.02, a.z);
    plank.castShadow = true; plank.receiveShadow = true;
    g.add(plank);
    const pegs: THREE.BufferGeometry[] = [];
    for (let n = from; n <= to; n++) {
      const p = this.linePoint(n);
      const big = (to - from > 12 && n % 5 === 0) || to - from <= 12;
      const geo = new THREE.CylinderGeometry(big ? 0.011 : 0.007, big ? 0.013 : 0.009, 0.012, 10);
      geo.translate(p.x, TY + 0.046, p.z + depth * 0.32);
      pegs.push(geo.toNonIndexed());
    }
    const pm = new THREE.Mesh(mergeGeometries(pegs), new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.6 }));
    g.add(pm);
    return g;
  }
  /** the plank's width (a fraction's plank is a broad one, to see its equal parts) */
  private get plankDepth() { return this.close ? 0.17 : 0.09; }
  /** where the Glimmer stands for number n: just behind the plank, so the numbers stay in sight */
  private standAt(n: number) { return this.linePoint(n).add(new THREE.Vector3(0, 0, -this.plankDepth / 2 - 0.005)); }
  linePoint(n: number): THREE.Vector3 {
    const ln = this.board?.line;
    const x = ln ? LX0 + ((n - ln.from) / Math.max(1, ln.to - ln.from)) * (LX1 - LX0) : BW / 2;
    return this.boardPoint(x, LY, 0.04);
  }
  /** a hop's trail: stars along the arc, left lying on the table */
  private trail(a: number, b: number, delay: number) {
    if (!this.starTex) return;
    const pa = this.linePoint(a), pb = this.linePoint(b);
    const n = Math.max(3, Math.round(pa.distanceTo(pb) / 0.05));
    const hgt = Math.min(0.3, 0.07 + pa.distanceTo(pb) * 0.25);
    const tex = this.starTex;
    const mat = this.mat(b < a ? 'star-' : 'star+', () => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: b < a ? 0xc9b8ff : 0xffffff }));
    for (let i = 1; i < n; i++) {
      const k = i / n, p = pa.clone().lerp(pb, k);
      p.y += Math.sin(k * Math.PI) * hgt;
      const sp = new THREE.Sprite(mat as THREE.SpriteMaterial);
      sp.position.copy(p);
      sp.scale.setScalar(0.001);
      sp.userData = { born: this.now + delay + k * 0.4, size: i === n - 1 ? 0.075 : 0.05 };
      this.stars.push(sp); this.root.add(sp);
    }
  }
  private clearStars() { for (const s of this.stars) s.removeFromParent(); this.stars = []; }
  /** the top of hop i's arc (for its label) */
  hopPoint(i: number): THREE.Vector3 | null {
    const h = this.board?.line?.hops[i];
    if (!h || i >= this.hopsDrawn) return null;
    const pa = this.linePoint(h.a), pb = this.linePoint(h.b);
    const p = pa.lerp(pb, 0.5);
    p.y += Math.min(0.3, 0.07 + this.linePoint(h.a).distanceTo(this.linePoint(h.b)) * 0.25) + 0.05;
    return p;
  }
  tickPoint(n: number): THREE.Vector3 { return this.linePoint(n).add(new THREE.Vector3(0, -0.02, this.plankDepth / 2 + 0.04)); }
  private hopPal(to: THREE.Vector3, instant: boolean) {
    this.palFrom.copy(this.palAt); this.palTo.copy(to);
    this.palHop0 = instant ? -9 : this.now;
    this.palHopDur = Math.min(0.9, 0.45 + this.palFrom.distanceTo(to) * 0.4);
    if (instant) this.palAt.copy(to);
  }

  // ---------- the kid's hands ----------
  /** Arm a task: resolves when the kid has done their part and the rest has followed. */
  arm(t: Task, rawNext: Board): Promise<void> {
    const next = this.tf(rawNext);
    this.disarm();
    if (t.kind === 'watch') return Promise.resolve();
    return new Promise(resolve => {
      const a: Armed = { t, next, open: new Map(), live: new Set(), done: 0, hops: [], resolve, finishing: false };
      this.armed = a;
      this.hintAt = this.now + 2.5;
      const nd = new Map(next.dots.map(d => [d.id, d]));
      if (t.kind === 'place') {
        // the new counters wait in a glowing row at the front; their places glow on the table
        const n = t.ids.length, per = Math.min(10, n), rows = Math.ceil(n / per), gap = this.r * 2.25;
        t.ids.forEach((id, i) => {
          const d = nd.get(id)!;
          const row = Math.floor(i / per), col = i % per, inRow = Math.min(per, n - row * per);
          const at = new THREE.Vector3((col - (inRow - 1) / 2) * gap, TY, this.pileZ + row * gap * 0.95);
          let tk = this.tokens.get(id);
          if (!tk) { tk = this.token(id, d.c, at, d.shape); tk.born = this.now + i * 0.04; tk.from = at.clone().add(new THREE.Vector3(0, 0.35, 0)); tk.t0 = tk.born; tk.dur = 0.45; }
          tk.leaving = 0; tk.glow = 1;
          a.live.add(id);
          const to = this.boardPoint(d.x, d.y, this.liftAt(next, d.x, d.y));
          a.open.set(id, to);
          this.spot('t:' + id, to, true);
        });
        this.pileZ = this.area.z1 + 0.12;
      } else if (t.kind === 'move') {
        for (const id of t.ids) {
          const d = nd.get(id)!, tk = this.tokens.get(id);
          if (!tk) continue;
          tk.glow = 1; a.live.add(id);
          const to = this.boardPoint(d.x, d.y, this.liftAt(next, d.x, d.y));
          a.open.set(id, to);
          this.spot('t:' + id, to, true);
        }
      } else if (t.kind === 'take' || t.kind === 'tap') {
        for (const id of t.ids) { const tk = this.tokens.get(id); if (tk) { tk.glow = 1; a.live.add(id); } }
      } else if (t.kind === 'label') {
        this.revealed = new Set();
        for (const id of t.ids) {
          const tag = next.tags.find(x => x.id === id);
          if (!tag) continue;
          a.live.add(id);
          this.spot('l:' + id, this.boardPoint(tag.x, Math.min(next.cell ? tag.y + 6 : tag.y, 330)), true);
        }
      } else if (t.kind === 'hop') {
        a.hops = [...t.hops];
        this.spot('hop', this.linePoint(a.hops[0].b).setY(TY + 0.041), true);
      }
      sfx.twinkle();
      this.onChange?.();
    });
  }
  /** what the kid still has to do (for the page's words) */
  get left() { const a = this.armed; if (!a) return 0; return a.t.kind === 'hop' ? a.hops.length : a.t.kind === 'label' ? a.live.size : 'by' in a.t ? Math.max(0, a.t.by - a.done) : a.live.size ? 1 : 0; }
  get busy() { return !!this.armed; }
  private disarm() {
    if (this.held) { this.held.drag = false; this.held = null; }
    for (const [k, s] of this.spots) if (k.startsWith('t:') || k.startsWith('hop') || k.startsWith('l:')) { s.leaving = this.now; }
    for (const tk of this.tokens.values()) tk.glow = tk.hue === 'c' && !tk.out ? 0.45 : 0;
    this.armed = null;
  }
  /** Do the rest by itself (the kid's part is done, or "Show me"). */
  finish() {
    const a = this.armed;
    if (!a || a.finishing) return;
    a.finishing = true;
    const t = a.t;
    let wait = 0.3;
    if (t.kind === 'place' || t.kind === 'move') {
      let i = 0;
      for (const [id, to] of a.open) {
        const tk = this.tokens.get(id);
        if (!tk) continue;
        tk.from = this.tokenPos(tk); tk.to = to.clone(); tk.t0 = this.now + i * 0.13; tk.dur = 0.6; tk.arc = 0.18; tk.squashAt = tk.t0 + tk.dur;
        i++;
      }
      a.open.clear();
      wait = 0.6 + i * 0.13;
      if (i) setTimeout(() => sfx.pop(), 600);
    } else if (t.kind === 'take') {
      let i = 0;
      for (const id of a.live) { const tk = this.tokens.get(id); if (tk) setTimeout(() => this.takeAway(tk, a.next), i * 140); i++; }
      a.live.clear();
      wait = 0.5 + i * 0.14;
    } else if (t.kind === 'tap') {
      this.tapAll(a);
      wait = 0.6;
    } else if (t.kind === 'label') {
      let i = 0;
      for (const id of [...a.live]) { setTimeout(() => this.reveal(a, id), i * 280); i++; }
      wait = 0.4 + i * 0.28;
    } else if (t.kind === 'hop') {
      const n = a.hops.length;
      a.hops.forEach((_, i) => setTimeout(() => this.hopNext(a), i * 650));
      wait = 0.6 + n * 0.65;
    }
    setTimeout(() => { if (this.armed === a) { this.disarm(); this.react(true); a.resolve(); } }, wait * 1000);
  }
  /** The buddy and the Glimmer react to a move: a nod and a hop for each, a cheer when it's all done. */
  private react(all: boolean) {
    if (all) { this.cheer(); this.palDo('happy'); this.burst(this.centre().add(new THREE.Vector3(0, 0.25, 0)), 1); }
    else { if (Math.random() < 0.5) this.nod(); else this.clap(); this.bounce(); this.palDo('hop'); }
  }
  private progress(a: Armed) {
    a.done++;
    this.hintAt = this.now + 4;
    const by = 'by' in a.t ? a.t.by : 1;
    if (a.done >= by) this.finish(); else this.react(false);
    this.onChange?.();
  }

  /** Pointer events from the page (screen pixels). Returns true when the scene used it. */
  pointer(kind: 'down' | 'move' | 'up', x: number, y: number): boolean {
    const a = this.armed;
    if (!a || a.finishing) return false;
    if (kind === 'down') {
      this.downAt = { x, y };
      if (a.t.kind === 'hop') {
        const tgt = this.toScreen(this.linePoint(a.hops[0].b)), pal = this.toScreen(this.palAt.clone().add(new THREE.Vector3(0, 0.2, 0)));
        if ((tgt && Math.hypot(tgt.x - x, tgt.y - y) < 80) || (pal && Math.hypot(pal.x - x, pal.y - y) < 70)) { this.hopNext(a); return true; }
        return false;
      }
      if (a.t.kind === 'label') {
        let best: string | null = null, bd = Infinity;
        for (const id of a.live) { const sp = this.spots.get('l:' + id), s = sp && this.toScreen(sp.at); if (!s) continue; const dd = Math.hypot(s.x - x, s.y - y); if (dd < bd) { bd = dd; best = id; } }
        if (!best || bd > 90) return false;
        this.reveal(a, best);
        if (!a.live.size) this.finish(); else this.react(false);
        return true;
      }
      const tk = this.pick(x, y, a);
      if (!tk) return false;
      if (a.t.kind === 'take') { a.live.delete(tk.id); this.takeAway(tk, a.next); this.progress(a); return true; }
      if (a.t.kind === 'tap') { this.tapAll(a); setTimeout(() => this.finish(), 500); return true; }
      // place / move: pick it up
      this.held = tk; tk.drag = true; this.heldFrom.copy(this.tokenPos(tk));
      tk.from.copy(this.heldFrom); tk.to.copy(this.heldFrom); tk.t0 = -9;
      sfx.click();
      return true;
    }
    if (kind === 'move' && this.held) {
      const p = this.onTable(x, y, 0.12);
      if (p) this.held.g.position.copy(p);
      return true;
    }
    if (kind === 'up' && this.held) {
      const tk = this.held;
      this.held = null; tk.drag = false;
      const here = tk.g.position.clone();
      // the nearest open place, judged on screen (generous: little fingers)
      let best: string | null = null, bd = Infinity;
      for (const [id, to] of a.open) {
        const s = this.toScreen(to); if (!s) continue;
        const dd = Math.hypot(s.x - x, s.y - y);
        if (dd < bd) { bd = dd; best = id; }
      }
      const reachPx = Math.max(64, this.screenSize(this.r) * 2.4);
      if (best && bd < reachPx) {
        const to = a.open.get(best)!;
        // whichever counter lands there becomes that place's counter
        if (best !== tk.id) this.swapIds(tk.id, best, a);
        const mine = this.tokens.get(best)!;
        a.open.delete(best); a.live.delete(best);
        const sp = this.spots.get('t:' + best); if (sp) sp.leaving = this.now;
        mine.from = here; mine.to = to.clone(); mine.t0 = this.now; mine.dur = 0.22; mine.arc = 0.03; mine.squashAt = this.now + 0.22; mine.glow = 0;
        const want = a.next.dots.find(d => d.id === best);
        if (want && want.c !== mine.hue && want.c !== 'ghost') this.recolor(mine, want.c);
        setTimeout(() => { sfx.pop(); this.sparkle(to); }, 200);
        this.progress(a);
      } else {
        // not near a place: it slides back
        tk.from = here; tk.to = this.heldFrom.clone(); tk.t0 = this.now; tk.dur = 0.35; tk.arc = 0.05;
        if (Math.hypot(x - this.downAt.x, y - this.downAt.y) > 20) { sfx.slip(); this.gesture('shrug', 1.1); }
        this.hintAt = this.now + 0.5;
      }
      return true;
    }
    return false;
  }
  private swapIds(a: string, b: string, armed: Armed) {
    const ta = this.tokens.get(a)!, tb = this.tokens.get(b)!;
    ta.id = b; tb.id = a;
    this.tokens.set(b, ta); this.tokens.set(a, tb);
    const la = armed.live.has(a), lb = armed.live.has(b);
    armed.live.delete(a); armed.live.delete(b);
    if (la) armed.live.add(b); if (lb) armed.live.add(a);
    // the other one keeps its glow and its place in the row
  }
  private pick(x: number, y: number, a: Armed): Token | null {
    let best: Token | null = null, bd = Infinity;
    for (const id of a.live) {
      const tk = this.tokens.get(id); if (!tk) continue;
      const s = this.toScreen(this.tokenPos(tk)); if (!s) continue;
      const dd = Math.hypot(s.x - x, s.y - y);
      if (dd < bd) { bd = dd; best = tk; }
    }
    return best && bd < Math.max(48, this.screenSize(this.r) * 1.8) ? best : null;
  }
  private takeAway(tk: Token, next: Board) {
    const d = next.dots.find(x => x.id === tk.id);
    tk.glow = 0;
    if (d?.out) {
      // crossed out: it greys and sinks a little, with a puff
      tk.out = true; this.recolor(tk, tk.hue);
      this.fx.emit({ at: this.tokenPos(tk).add(new THREE.Vector3(0, 0.05, 0)), count: 10, shape: 'dot', color: [0xffffff, 0xe8dccb], speed: [0.2, 0.6], life: [0.4, 0.7], size: [0.03, 0.06], up: 0.6, drag: 3 });
      sfx.pop();
      return;
    }
    // the Glimmer eats it
    tk.eaten = true; tk.leaving = this.now;
    tk.from = this.tokenPos(tk); tk.to = this.palMouth(); tk.t0 = this.now; tk.dur = 0.5; tk.arc = 0.25;
    sfx.whoosh();
    setTimeout(() => {
      this.pal.face = null;
      this.palDo('happy');
      this.fx.emit({ at: this.palMouth(), count: 12, shape: ['dot', 'pebble'], color: [BASE[this.set.token] ?? 0xffffff, HUE[this.set.token][tk.hue === 'ghost' ? 'a' : tk.hue]], speed: [0.4, 1.1], life: [0.4, 0.8], size: [0.02, 0.04], up: 0.8, gravity: 2, drag: 1 });
      sfx.giggle();
    }, 480);
  }
  private tapAll(a: Armed) {
    const nd = new Map(a.next.dots.map(d => [d.id, d]));
    let i = 0;
    for (const id of a.live) {
      const tk = this.tokens.get(id), d = nd.get(id);
      if (!tk || !d) continue;
      tk.glow = 0;
      // covered up (it becomes an empty place) or a new colour
      setTimeout(() => { if (d.c === 'ghost') tk.leaving = this.now; else this.recolor(tk, d.c); this.sparkle(this.tokenPos(tk)); }, i * 60);
      i++;
    }
    a.live.clear();
    sfx.golden();
  }
  /** open one word (a label task) */
  private reveal(a: Armed, id: string) {
    if (!a.live.has(id)) return;
    a.live.delete(id);
    this.revealed.add(id);
    const sp = this.spots.get('l:' + id);
    if (sp) { sp.leaving = this.now; this.sparkle(sp.at); }
    sfx.star(Math.min(5, this.revealed.size - 1));
    this.hintAt = this.now + 4;
    this.onChange?.();
  }
  private hopNext(a: Armed) {
    const h = a.hops.shift();
    if (!h) return;
    const sp = this.spots.get('hop');
    if (sp) { this.spots.delete('hop'); sp.leaving = this.now; this.spots.set(`hop${this.now}`, sp); }
    this.hopPal(this.standAt(h.b), false);
    this.trail(h.a, h.b, 0);
    this.hopsDrawn++;
    sfx.star(Math.min(5, this.hopsDrawn - 1));
    setTimeout(() => this.sparkle(this.linePoint(h.b)), this.palHopDur * 1000);
    if (a.hops.length) this.spot('hop', this.linePoint(a.hops[0].b).setY(TY + 0.041), true);
    this.onChange?.();
    if (!a.finishing) {
      a.done++;
      if (!a.hops.length) setTimeout(() => { if (this.armed === a) { this.disarm(); this.react(true); a.resolve(); } }, this.palHopDur * 1000 + 300);
      else this.react(false);
    }
  }

  /** Where the kid's attention should go now: the first counter to touch (for "Try it" and the hand). */
  tryPoint(): THREE.Vector3 | null {
    const a = this.armed;
    if (!a || a.finishing || this.held) return null;
    if (a.t.kind === 'hop') return a.hops[0] ? this.linePoint(a.hops[0].b).add(new THREE.Vector3(0, 0.06, 0)) : null;
    if (a.t.kind === 'label') { const sp = this.spots.get('l:' + [...a.live][0]); return sp ? sp.at.clone().add(new THREE.Vector3(0, 0.05, 0)) : null; }
    const id = [...a.live][0];
    const tk = id ? this.tokens.get(id) : null;
    return tk ? this.tokenPos(tk).add(new THREE.Vector3(0, this.r * 2.2, 0)) : null;
  }
  /** The helping hand: from the first glowing counter to its place, over and over (once the kid waits). */
  handPoint(): THREE.Vector3 | null {
    const a = this.armed;
    if (!a || a.finishing || this.held || this.now < this.hintAt) return null;
    const k = ((this.now - this.hintAt) % 2.2) / 2.2;
    if (a.t.kind === 'place' || a.t.kind === 'move') {
      const id = [...a.live][0], tk = id ? this.tokens.get(id) : null, to = id ? a.open.get(id) : null;
      if (!tk || !to) return null;
      const from = this.tokenPos(tk);
      const m = smooth(clamp01((k - 0.15) / 0.6));
      const p = from.clone().lerp(to, m); p.y += Math.sin(m * Math.PI) * 0.1;
      return p;
    }
    return this.tryPoint()?.add(new THREE.Vector3(0, -this.r * 1.8 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.03, 0)) ?? null;
  }
  /** The hand's press: true while it "holds" the counter (for the page's drawing). */
  get handDown() { const k = ((this.now - this.hintAt) % 2.2) / 2.2; return k > 0.1 && k < 0.8; }

  // ---------- page pins ----------
  pin(el: HTMLElement, at: () => THREE.Vector3 | null) { this.pins.set(el, at); }
  unpin(el: HTMLElement) { this.pins.delete(el); }
  /** above the buddy's head, and the Glimmer's */
  head(who: 'buddy' | 'pal'): THREE.Vector3 {
    if (who === 'pal') return this.pal.root.position.clone().add(new THREE.Vector3(0, this.pal.height * this.pal.root.scale.y * 1.05 + 0.05, 0));
    const h = this.me.bones.Head?.getWorldPosition(new THREE.Vector3());
    return h ? h.add(new THREE.Vector3(0, this.H * 0.28, 0)) : this.me.root.position.clone().add(new THREE.Vector3(0, this.H * 1.08, 0));
  }
  /** beside the buddy's face, on the work's side (where its speech bubble starts) */
  bubbleAt(): THREE.Vector3 {
    const h = this.me.bones.Head?.getWorldPosition(new THREE.Vector3()) ?? this.me.root.position.clone().add(new THREE.Vector3(0, this.H * 0.85, 0));
    return h.add(new THREE.Vector3(this.H * 0.16, this.H * 0.06, 0));
  }
  /** over the middle of the picture, a little above the table (where the shortcut appears) */
  over(): THREE.Vector3 {
    const c = this.centre();
    // (the fraction episodes: just over the work's back edge, under the speech bubble)
    if (this.close) { c.y = TY + 0.1; c.z = this.area.z0 + 0.02; } else { c.y += 0.3; c.z = this.area.z0 - 0.05; }
    return c;
  }

  private toScreen(p: THREE.Vector3): { x: number; y: number } | null {
    const v = p.clone().project(stage.camera);
    if (v.z > 1) return null;
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  }
  private screenSize(r: number) {
    const cam = stage.camera, d = cam.position.distanceTo(this.centre());
    return (r / (d * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)))) * innerHeight / 2;
  }
  private onTable(x: number, y: number, lift: number): THREE.Vector3 | null {
    this.ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), stage.camera);
    const p = new THREE.Vector3();
    return this.ray.ray.intersectPlane(new THREE.Plane(UP, -(TY + lift)), p) ? p : null;
  }
  private tokenPos(tk: Token) { return tk.g.position.clone().setY(TY); }
  private palMouth() { return this.pal.root.position.clone().add(new THREE.Vector3(0, this.pal.height * this.pal.root.scale.y * 0.55, 0.08)); }
  private sparkle(at: THREE.Vector3) {
    this.fx.emit({ at: at.clone().add(new THREE.Vector3(0, 0.06, 0)), count: 16, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xffc6e8], speed: [0.4, 1.2], life: [0.4, 0.8], size: [0.03, 0.07], up: 0.9, drag: 2.5, spin: 4 });
  }
  /** a shower of stars and hearts (the end of a task; k makes it bigger) */
  burst(at: THREE.Vector3, k = 1) {
    this.fx.emit({ at, count: Math.round(40 * k), shape: ['star', 'heart', 'spark'], color: [0xffe066, 0xffffff, 0xff9ad5, 0x9fe6ff], speed: [0.8, 2.2], life: [0.7, 1.3], size: [0.04, 0.09], drag: 1.6, gravity: 1, up: 0.6, spin: 3 });
  }
  /** confetti over everyone (the trick card) */
  party() {
    const c = this.centre().add(new THREE.Vector3(0, 0.9, -0.3));
    for (let i = 0; i < 5; i++) setTimeout(() => this.fx.emit({ at: c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0, 0)), count: 26, shape: ['star', 'heart', 'note', 'spark'], color: [0xffe066, 0xff9ad5, 0x9fe6ff, 0xb48cff, 0xffffff], speed: [0.6, 1.8], up: 1.2, radius: 0.3, life: [1.2, 2], size: [0.05, 0.1], drag: 1, gravity: 0.8, spin: 3 }), i * 260);
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    if (innerHeight !== this.lastH) { this.lastH = innerHeight; this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov); }
    this.layout();
    this.tokensUpdate(dt);
    this.piecesUpdate(this.trays); this.piecesUpdate(this.plates); this.piecesUpdate(this.dishes);
    // rings: fade in, pulse, fade out
    for (const [k, s] of this.spots) {
      const m = s.mesh.material as THREE.MeshBasicMaterial;
      const inK = clamp01((t - s.born) / 0.35), outK = s.leaving ? clamp01(1 - (t - s.leaving) / 0.3) : 1;
      const pulse = s.strong ? 0.65 + Math.sin(t * 5) * 0.3 : 0.55;
      m.opacity = inK * outK * pulse;
      s.mesh.scale.setScalar(this.r * (s.strong ? 3.0 + Math.sin(t * 5) * 0.25 : 2.4) * (0.6 + 0.4 * inK));
      if (s.leaving && t - s.leaving > 0.3) { s.mesh.removeFromParent(); s.mesh.geometry.dispose(); m.dispose(); this.spots.delete(k); }
    }
    for (const s of this.stars) { const k = clamp01((t - (s.userData.born as number)) / 0.3); s.scale.setScalar(Math.max(0.001, (s.userData.size as number) * backOut(k))); }
    this.characters(dt, t);
    this.camera(dt, t);
    this.backdropFollow();
    // dust in the sunbeams
    this.moteT -= dt;
    if (this.moteT <= 0) {
      this.moteT = stage.smooth ? 0.5 : 0.18;
      this.fx.emit({ at: new THREE.Vector3((Math.random() - 0.5) * 4, TY + 0.3 + Math.random() * 1.6, -0.9 + Math.random() * 1.6), count: 1, shape: 'dot', color: [0xfff4d6, 0xffe6b0], speed: [0.02, 0.08], life: [4, 7], size: [0.012, 0.026], drag: 0.2, flutter: 0.4, fade: 1 });
    }
    for (const [i, b] of this.beams.entries()) (b.material as THREE.MeshBasicMaterial).opacity = 0.13 + Math.sin(t * 0.4 + i) * 0.03;
    this.fx.update(dt, t);
    const u0 = this.toScreen(this.boardPoint(this.map.cx, this.map.cy)), u1 = this.toScreen(this.boardPoint(this.map.cx + 50, this.map.cy));
    if (u0 && u1) this.unit = Math.hypot(u1.x - u0.x, u1.y - u0.y) / 50;
    // pins: the page's words follow their 3D things (and get the table's scale for their size)
    for (const [el, at] of this.pins) {
      const p = at();
      const s = p ? this.toScreen(p) : null;
      if (!s) { el.style.visibility = 'hidden'; continue; }
      el.style.visibility = '';
      // (kept below the top bar, so a bubble by a tall friend never hides under it)
      el.style.transform = `translate(${s.x.toFixed(1)}px, ${Math.min(innerHeight - 30, Math.max(110, s.y)).toFixed(1)}px)`;
      el.style.setProperty('--u', this.unit.toFixed(3)); el.style.setProperty('--px', s.x.toFixed(0));
    }
  }

  private tokensUpdate(dt: number) {
    const t = this.now;
    for (const [id, tk] of this.tokens) {
      const g = tk.g;
      if (!tk.drag) {
        const k = tk.t0 < -1 ? 1 : clamp01((t - tk.t0) / tk.dur);
        const e = tk.eaten ? k * k : 1 - Math.pow(1 - k, 3);
        g.position.lerpVectors(tk.from, tk.to, e);
        g.position.y = TY + (tk.from.y - TY) * (1 - e) + (tk.to.y - TY) * e + Math.sin(k * Math.PI) * tk.arc;
        if (tk.out) g.position.y -= this.r * 0.25;
      }
      // pop in, squash on landing, lifted while held
      const born = tk.born < -1 ? 1 : clamp01((t - tk.born) / 0.4);
      let sx = backOut(born), sy = sx;
      const sq = t - tk.squashAt;
      if (sq > 0 && sq < 0.35) { const w = Math.sin((sq / 0.35) * Math.PI) * Math.exp(-sq * 6); sy *= 1 - w * 0.6; sx *= 1 + w * 0.35; }
      if (tk.drag) { sy *= 1.08; sx *= 1.08; g.rotation.z = Math.sin(t * 9) * 0.08; } else g.rotation.z *= 0.8;
      // leaving: shrink away (or, eaten, shrink into the Glimmer's mouth)
      let gone = 1;
      if (tk.leaving) {
        const lk = clamp01((t - tk.leaving) / (tk.eaten ? 0.55 : 0.4));
        gone = tk.eaten ? 1 - lk * lk : 1 - smooth(lk);
        if (lk >= 1) { g.removeFromParent(); tk.blob.removeFromParent(); (tk.halo.material as THREE.Material).dispose(); (tk.rim.material as THREE.Material).dispose(); if (this.tokens.get(id) === tk) this.tokens.delete(id); continue; }
      }
      g.scale.set(this.r * sx * gone, this.r * sy * gone, this.r * sx * gone);
      // glow: the material's light and the halo, pulsing when it wants touching
      tk.lit += (tk.glow - tk.lit) * Math.min(1, dt * 6);
      const hm = tk.halo.material as THREE.SpriteMaterial;
      const pulse = tk.glow >= 1 ? 0.75 + Math.sin(t * 6 + tk.g.position.x * 9) * 0.25 : 1;
      hm.opacity = tk.lit * (tk.glow >= 1 ? 0.95 : 0.4) * pulse;
      tk.halo.visible = hm.opacity > 0.02;
      const rm = tk.rim.material as THREE.MeshBasicMaterial;
      // (a fraction's gold pieces, the ones you count, keep a soft gold edge)
      rm.opacity = tk.glow >= 1 ? tk.lit * (0.85 + Math.sin(t * 6 + g.position.x * 9) * 0.15) : tk.shape && tk.hue === 'c' ? 0.5 : 0;
      tk.rim.visible = rm.opacity > 0.02;
      // the shadow stays on the table, fainter and wider as the counter lifts
      const surface = Math.min(g.position.y, tk.to.y), up = Math.max(0, g.position.y - surface);
      tk.blob.position.set(g.position.x, surface + 0.003, g.position.z);
      const bs = this.r * 2.6 * gone * (1 + up * 4);
      tk.blob.scale.set(bs, 1, bs * DEPTH);
      tk.blob.visible = gone > 0.05 && !tk.eaten;
    }
  }
  private piecesUpdate(map: Map<string, Piece>) {
    const t = this.now;
    for (const [id, p] of map) {
      const k = p.born < -1 ? 1 : clamp01((t - p.born) / 0.45);
      let s = backOut(k);
      if (p.leaving) { const lk = clamp01((t - p.leaving) / 0.35); s *= 1 - smooth(lk); if (lk >= 1) { p.g.removeFromParent(); dispose(p.g); map.delete(id); continue; } }
      p.g.scale.setScalar(Math.max(0.001, s));
    }
  }

  private characters(dt: number, t: number) {
    const me = this.me, cam = stage.camera;
    me.root.position.lerp(this.buddyAt, Math.min(1, dt * 3));
    // face the camera, turned a little toward the table's middle while it shows something
    const toCam = cam.position.clone().sub(me.root.position).setY(0).normalize();
    const toBoard = this.centre().sub(me.root.position).setY(0).normalize();
    const pointing = this.gest.some(g => (g.kind === 'point' || g.kind === 'present') && t - g.at < g.for);
    // (the body faces the kid; the head turns to look at the work)
    this.lookBoard += ((pointing ? 0.08 : 0.02) - this.lookBoard) * Math.min(1, dt * 3);
    const face = toCam.lerp(toBoard, this.lookBoard).normalize();
    const yaw = Math.atan2(face.x, face.z);
    const dy = Math.atan2(Math.sin(yaw - me.root.rotation.y), Math.cos(yaw - me.root.rotation.y));
    me.root.rotation.y += dy * Math.min(1, dt * 6);
    if (t > this.busyUntil && me.currentName !== 'idle') me.play('idle', 0.4);
    // a happy bounce
    const bk = (t - this.bounceAt) / 0.5;
    me.root.position.y = this.buddyAt.y + (bk >= 0 && bk < 1 ? Math.abs(Math.sin(bk * Math.PI * 2)) * 0.07 * (1 - bk * 0.5) : 0);
    // the gestures and the looking turn bones on top of the clip; a clip that doesn't move a bone (the
    // idle leaves the head alone) would keep last frame's turn and add to it, so each frame starts from
    // the clip's own pose
    for (const [b, q] of this.posed) b.quaternion.copy(q);
    me.update(dt);
    if (!this.posed.length) this.posed = POSED.map(n => me.bones[n]).filter(Boolean).map(b => [b, new THREE.Quaternion()] as [THREE.Bone, THREE.Quaternion]);
    for (const [b, q] of this.posed) q.copy(b.quaternion);
    me.root.updateMatrixWorld(true);
    this.lookAround(dt, t);
    if (t > this.busyUntil) this.gestures();
    // the Glimmer: hops from place to place, faces the camera (or what it's eating)
    const pal = this.pal;
    if (this.palHop0 > -1) {
      const k = clamp01((t - this.palHop0) / this.palHopDur);
      this.palAt.lerpVectors(this.palFrom, this.palTo, smooth(k));
      this.palAt.y = this.palFrom.y + (this.palTo.y - this.palFrom.y) * k + Math.sin(k * Math.PI) * Math.min(0.32, 0.12 + this.palFrom.distanceTo(this.palTo) * 0.3);
      if (k >= 1) { this.palHop0 = -9; pal.play('hop'); }
    } else if (!this.board?.line) this.palAt.lerp(this.palHome, Math.min(1, dt * 3));
    pal.root.position.copy(this.palAt);
    // smaller on the number line (a pin on the plank), its own size elsewhere
    const ps = this.board?.line && !this.together ? 0.38 : 1;
    pal.root.scale.setScalar(pal.root.scale.x + (ps - pal.root.scale.x) * Math.min(1, dt * 5));
    // the Glimmer faces the kid too, turned a little toward the work
    pal.face = cam.position.clone().lerp(this.focusPoint(), 0.25).setY(this.palAt.y);
    pal.update(dt, t);
    this.gest = this.gest.filter(g => t - g.at < g.for);
  }

  /** What the friends look at: the counter in the kid's hand, the next thing to touch, or the work. */
  private focusPoint(): THREE.Vector3 {
    if (this.held) return this.held.g.position.clone();
    return this.tryPoint() ?? this.centre();
  }
  /** The head looks at the kid or the work (aimed outright: the idle clip looks round on its own, and
   *  that turned the buddy's face away), the body leans in while the kid works and sways a little. */
  private lookAround(dt: number, t: number) {
    const B = this.me.bones, head = B.Head, spine = B.Spine2 ?? B.Spine1 ?? B.Spine;
    this.leanIn += ((this.armed ? 1 : 0.35) - this.leanIn) * Math.min(1, dt * 2);
    const busy = t < this.busyUntil;
    if (spine && !busy) { spine.rotateX(0.02 * this.leanIn); spine.rotateZ(Math.sin(t * 1.1) * 0.03); spine.updateMatrixWorld(true); }
    if (!head || busy) return;
    // it looks at the kid (the camera), glancing at the work while the kid works: down only a little, so
    // its face (eyes and mouth) always reads, never the top of its head
    const atKid = !this.held && (!this.armed || (t % 4) < 1.7);
    const hp = head.getWorldPosition(new THREE.Vector3()), want = (atKid ? stage.camera.position.clone() : this.focusPoint()).sub(hp);
    const fwd = this.me.root.getWorldDirection(new THREE.Vector3()).setY(0).normalize(), side = new THREE.Vector3().crossVectors(UP, fwd).normalize();
    const yaw = THREE.MathUtils.clamp(Math.atan2(want.dot(side), want.dot(fwd)), -0.45, 0.45);
    const pitch = THREE.MathUtils.clamp(Math.atan2(-want.y, Math.hypot(want.dot(side), want.dot(fwd))), -0.4, 0.08);
    this.lookYaw += (yaw - this.lookYaw) * Math.min(1, dt * 4);
    this.lookPitch += (pitch - this.lookPitch) * Math.min(1, dt * 4);
    // turn the head (its +Z is its face) from where the clip left it to this way, most of the way
    const dir = fwd.clone().multiplyScalar(Math.cos(this.lookYaw)).addScaledVector(side, Math.sin(this.lookYaw)).multiplyScalar(Math.cos(this.lookPitch)).setY(-Math.sin(this.lookPitch)).normalize();
    const hq = head.getWorldQuaternion(new THREE.Quaternion());
    const cur = new THREE.Vector3(0, 0, 1).applyQuaternion(hq).normalize();
    const aimed = new THREE.Quaternion().setFromUnitVectors(cur, dir).multiply(hq);
    const pq = head.parent!.getWorldQuaternion(new THREE.Quaternion()).invert();
    head.quaternion.slerp(pq.multiply(aimed), 0.85);
    head.updateMatrixWorld(true);
  }
  private lookYaw = 0; private lookPitch = 0;
  /** the clip's pose of the bones we turn (see characters) */
  private posed: [THREE.Bone, THREE.Quaternion][] = [];

  /** Arms and head on top of the clip: pointing, presenting, thinking, oops, clapping, shrugging, nodding, talking, a gasp. */
  private gestures() {
    const B = this.me.bones, H = this.H, t = this.now;
    const fwd = this.me.root.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(UP, fwd).normalize();
    const env = (g: { at: number; for: number }, inn = 0.3, out = 0.4) => smooth(Math.min(1, (t - g.at) / inn, Math.max(0, (g.at + g.for - t) / out)));
    const arm = (S: 'Left' | 'Right') => ({ a: B[`${S}Arm`], f: B[`${S}ForeArm`], h: B[`${S}Hand`] });
    const len = (x: ReturnType<typeof arm>) => x.a.getWorldPosition(new THREE.Vector3()).distanceTo(x.f.getWorldPosition(new THREE.Vector3())) + x.f.getWorldPosition(new THREE.Vector3()).distanceTo(x.h.getWorldPosition(new THREE.Vector3()));
    for (const g of this.gest) {
      const k = env(g);
      if (k < 0.01) continue;
      if ((g.kind === 'point' || g.kind === 'present') && g.target) {
        // the arm on the target's side (the buddy faces you: its left arm is on your right)
        const rel = g.target.clone().sub(this.me.root.position);
        const S = rel.dot(side) > 0 ? 'Left' : 'Right';
        const x = arm(S); if (!x.a || !x.f || !x.h) continue;
        const sh = x.a.getWorldPosition(new THREE.Vector3());
        const dir = g.target.clone().sub(sh).normalize();
        const L = len(x);
        const tgt = g.kind === 'point' ? sh.clone().addScaledVector(dir, L * 0.97) : sh.clone().addScaledVector(dir, L * 0.78).add(new THREE.Vector3(0, H * 0.06, 0));
        reach(x.a, x.f, x.h, tgt, new THREE.Vector3(0, -1, 0).addScaledVector(fwd, g.kind === 'present' ? -0.4 : 0), k);
      } else if (g.kind === 'think' || g.kind === 'oops') {
        // a hand to the chin ("hmm"), or to the forehead ("oops!")
        const x = arm('Right'); const head = B.Head?.getWorldPosition(new THREE.Vector3());
        if (!x.a || !x.f || !x.h || !head) continue;
        const tgt = head.clone().addScaledVector(fwd, H * 0.11).add(new THREE.Vector3(0, g.kind === 'oops' ? H * 0.07 : -H * 0.06, 0)).addScaledVector(side, -H * 0.02);
        reach(x.a, x.f, x.h, tgt, new THREE.Vector3(0, -1, 0).addScaledVector(side, -0.6), k);
        if (B.Head) { B.Head.rotateX((g.kind === 'oops' ? 0.25 : 0.12) * k); B.Head.rotateZ((g.kind === 'oops' ? -0.12 : 0.18) * k); B.Head.updateMatrixWorld(true); }
      } else if (g.kind === 'clap') {
        const chest = (B.Spine2 ?? B.Spine1 ?? B.Spine)?.getWorldPosition(new THREE.Vector3());
        if (!chest) continue;
        const c = chest.addScaledVector(fwd, H * 0.24).add(new THREE.Vector3(0, H * 0.04, 0));
        const open = 0.012 + Math.abs(Math.sin((t - g.at) * 11)) * H * 0.07;
        for (const [S, s] of [['Left', 1], ['Right', -1]] as const) {
          const x = arm(S); if (!x.a || !x.f || !x.h) continue;
          reach(x.a, x.f, x.h, c.clone().addScaledVector(side, s * open), new THREE.Vector3(0, -1, 0).addScaledVector(side, s * 0.5), k);
        }
      } else if (g.kind === 'shrug') {
        const sk = Math.sin(clamp01((t - g.at) / g.for) * Math.PI);
        for (const [S, s] of [['Left', 1], ['Right', -1]] as const) {
          const x = arm(S); if (!x.a || !x.f || !x.h) continue;
          const sh = x.a.getWorldPosition(new THREE.Vector3());
          reach(x.a, x.f, x.h, sh.clone().addScaledVector(side, s * H * 0.26).addScaledVector(fwd, H * 0.16).add(new THREE.Vector3(0, -H * 0.1, 0)), new THREE.Vector3(0, -1, 0).addScaledVector(fwd, -0.5), smooth(sk));
        }
        if (B.Head) { B.Head.rotateZ(0.22 * sk); B.Head.updateMatrixWorld(true); }
      } else if (g.kind === 'gasp') {
        // both hands up by its cheeks, head back a little: "oh!"
        const head = B.Head?.getWorldPosition(new THREE.Vector3());
        if (!head) continue;
        for (const [S, s2] of [['Left', 1], ['Right', -1]] as const) {
          const x = arm(S); if (!x.a || !x.f || !x.h) continue;
          reach(x.a, x.f, x.h, head.clone().addScaledVector(side, s2 * H * 0.13).addScaledVector(fwd, H * 0.1).add(new THREE.Vector3(0, -H * 0.05, 0)), new THREE.Vector3(0, -1, 0).addScaledVector(side, s2 * 0.6), k);
        }
        if (B.Head) { B.Head.rotateX(-0.22 * k); B.Head.updateMatrixWorld(true); }
      } else if (g.kind === 'nod') {
        const nk = Math.sin(((t - g.at) / g.for) * Math.PI * 2);
        if (B.Head) { B.Head.rotateX(0.18 * nk); B.Head.updateMatrixWorld(true); }
      } else if (g.kind === 'talk') {
        if (B.Head) { B.Head.rotateX(Math.sin(t * 7.3) * 0.05 * k); B.Head.rotateZ(Math.sin(t * 3.1) * 0.06 * k); B.Head.updateMatrixWorld(true); }
      }
    }
  }

  /** Frame the shot inside the page's box for it: binary search the distance that just fits. */
  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view;
    const box = new THREE.Box3();
    const a = this.area;
    const content = new THREE.Box3(new THREE.Vector3(a.x0 - 0.05, TY, a.z0 - 0.05), new THREE.Vector3(a.x1 + 0.05, TY + 0.12, a.z1 + 0.05));
    if (this.armed && this.armed.t.kind === 'place') content.expandByPoint(new THREE.Vector3(0, TY, this.pileZ + this.r * 2.4 * Math.ceil(this.armed.t.ids.length / 10)));
    const head = this.buddyAt.clone().add(new THREE.Vector3(0, this.H * 1.02, 0));
    const buddy = new THREE.Box3(new THREE.Vector3(head.x - 0.3, TY - 0.05, head.z - 0.2), new THREE.Vector3(head.x + 0.3, head.y, head.z + 0.2));
    const ph = this.pal.height * this.pal.root.scale.y;
    const pal = new THREE.Box3(new THREE.Vector3(this.palAt.x - 0.28, Math.max(TY, this.palAt.y), this.palAt.z - 0.2), new THREE.Vector3(this.palAt.x + 0.28, this.palAt.y + ph * 1.05, this.palAt.z + 0.2));
    let pitch = 0.42, yaw = 0;
    const margin = 0.02;
    const s = this.shotName;
    // a tall box (a phone): the friends at the top, the work big under them, seen more from above
    const tall = ((v.right - v.left) * innerWidth) / Math.max(1, (v.bottom - v.top) * innerHeight) < 0.9;
    const r = v;
    /** the points that must be in the shot (a box's corners, or for the work shots exact points: a box
     *  round both the near work and the far faces would have phantom corners that push the camera back) */
    let pts: THREE.Vector3[] | null = null;
    if (s === 'board' || s === 'wide') {
      // the work shots, like the concept: the work big in the lower middle, the friends standing right
      // behind it either side, their faces in (their sides may be cut at the frame's edge, like a film)
      const pt = this.palAt.y + ph * 1.02;
      box.copy(content);
      pts = [];
      for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? content.max.x : content.min.x, i & 2 ? content.max.y : content.min.y, i & 4 ? content.max.z : content.min.z));
      pts.push(new THREE.Vector3(head.x - 0.05, head.y + 0.06, head.z), new THREE.Vector3(head.x + 0.18, head.y - 0.3, head.z),
        new THREE.Vector3(this.palAt.x + 0.05, pt, this.palAt.z), new THREE.Vector3(this.palAt.x - 0.18, pt - 0.3, this.palAt.z));
      for (const q of pts.slice(8)) box.expandByPoint(q);
      pitch = tall ? (s === 'board' ? 0.98 : 0.9) : s === 'board' ? 0.36 : 0.32;
    }
    // the buddy close, turned toward it, with all of its picture in front (so nothing looms at the camera)
    else if (s === 'buddy') { box.copy(buddy).union(content); pitch = tall ? 0.5 : 0.2; yaw = -0.08; }
    // the card: the two friends together (the table is cleared first, so nothing looms in front)
    else if (s === 'pals') { box.copy(buddy).union(pal); pitch = 0.16; }
    else { box.copy(buddy).union(pal).union(content); pitch = 0.18; }
    // a slow drift, so the shot is never quite still
    yaw += Math.sin(t * 0.13) * 0.035; pitch += Math.sin(t * 0.17) * 0.012;
    const fwd = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    const c = box.getCenter(new THREE.Vector3());
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)), asp = cam.aspect;
    const nx0 = r.left * 2 - 1, nx1 = r.right * 2 - 1, ny0 = 1 - r.bottom * 2, ny1 = 1 - r.top * 2;
    const rcx = (nx0 + nx1) / 2, rcy = (ny0 + ny1) / 2, rhx = ((nx1 - nx0) / 2) * (1 - margin), rhy = ((ny1 - ny0) / 2) * (1 - margin);
    const corners: THREE.Vector3[] = pts ?? [];
    if (!pts) for (let i = 0; i < 8; i++) corners.push(new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const place = (d: number) => c.clone().addScaledVector(fwd, -d).addScaledVector(right, -rcx * d * tanH * asp).addScaledVector(camUp, -rcy * d * tanH);
    const fits = (d: number) => {
      const p = place(d);
      for (const q of corners) {
        const rel = q.clone().sub(p), z = rel.dot(fwd);
        if (z < 0.2) return false;
        const x = rel.dot(right) / (z * tanH * asp), y = rel.dot(camUp) / (z * tanH);
        if (Math.abs(x - rcx) > rhx || Math.abs(y - rcy) > rhy) return false;
      }
      return true;
    };
    let lo = 0.4, hi = 30;
    for (let i = 0; i < 22; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    let d = hi;
    // the work shots on a wide screen, like the concept: the work fills about 60% of the frame's width in
    // its lower middle, the friends' faces in at the top (the camera backs off only if a face won't fit)
    let lowerMiddle: THREE.Vector3 | null = null;
    if (pts && !tall) {
      const cc = content.getCenter(new THREE.Vector3()), ww = content.max.x - content.min.x;
      const ty = rcy - rhy * 0.42;
      const at = (dd: number) => cc.clone().addScaledVector(fwd, -dd).addScaledVector(right, -rcx * dd * tanH * asp).addScaledVector(camUp, -ty * dd * tanH);
      let dd = ww / ((this.close ? 1.5 : 1.2) * tanH * asp);
      for (let i = 0; i < 30; i++) {
        const p = at(dd);
        const top = Math.max(...pts.slice(8).filter((_, k) => k % 2 === 0).map(q => { const rel = q.clone().sub(p); return rel.dot(camUp) / (rel.dot(fwd) * tanH); }));
        if (top <= rcy + rhy * 0.96) break;
        dd *= 1.04;
      }
      d = dd; lowerMiddle = at(dd);
    }
    // the opening: start further back and higher, and settle in
    if (s === 'intro') d *= 1 + 0.5 * (1 - smooth(clamp01((t - this.shotAt) / 3.5)));
    const wantPos = lowerMiddle ?? place(d);
    // room to spare up and down (the shot is as wide as it can be): heads near the top, the spare
    // table at the bottom, under the page's buttons
    let ymax = -Infinity, ymin = Infinity;
    for (const q of corners) { const rel = q.clone().sub(wantPos), z = rel.dot(fwd), y = rel.dot(camUp) / (z * tanH); ymax = Math.max(ymax, y); ymin = Math.min(ymin, y); }
    const topSlack = rcy + rhy - ymax, botSlack = ymin - (rcy - rhy);
    // (a fraction's wide picture on a phone: the spare room split more evenly, so the work sits nearer the thumbs)
    const topShare = tall ? (this.close ? 0.55 : 0.35) : 0.6;
    if (!lowerMiddle && topSlack > 0 && botSlack > 0) wantPos.addScaledVector(camUp, -(topSlack - (topSlack + botSlack) * topShare) * d * tanH);
    const wantAim = wantPos.clone().add(fwd);
    if (!this.ready) { this.camPos.copy(wantPos); this.camAim.copy(wantAim); this.ready = true; }
    const k = 1 - Math.exp(-dt * (s === 'intro' ? 6 : 3));
    this.camPos.lerp(wantPos, k); this.camAim.lerp(wantAim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
    // the key light's shadows cover the table round the action
    this.key.target.position.set(c.x * 0.5, TY, (a.z0 + a.z1) / 2);
  }

  /** The painted place always fills the view behind, far back, drifting a little against the table. */
  private backdropFollow() {
    const cam = stage.camera, fwd = cam.getWorldDirection(new THREE.Vector3());
    const D = 7;
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const h = 2 * D * tanH * 1.12, w = h * cam.aspect;
    const asp = this.backdrop.userData.aspect as number;
    const ph = Math.max(h, w / asp), pw = ph * asp;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    this.backdrop.position.copy(cam.position).addScaledVector(fwd, D);
    // the painting's top lines up with the view's top (the table hides its bottom), and it drifts a
    // little against the camera, so the table feels in front of it
    this.backdrop.position.addScaledVector(up, -(ph - h) * 0.45 - (cam.position.y - 1.6) * 0.08).addScaledVector(right, -cam.position.x * 0.3);
    this.backdrop.quaternion.copy(cam.quaternion);
    this.backdrop.scale.set(pw, ph, 1);
  }

  focus() { return this.centre(); }

  dispose() {
    this.armed = null;
    this.pins.clear();
    const sc = stage.scene;
    this.root.removeFromParent();
    sc.fog = this.before.fog; sc.background = this.before.bg;
    sc.environment = this.before.env; sc.environmentIntensity = this.before.envK;
    this.env?.dispose();
    stage.camera.fov = this.before.fov; stage.camera.updateProjectionMatrix();
    for (const o of this.hidden) o.visible = true;
    this.hidden = [];
    this.me.dispose(); this.pal.dispose(); this.fx.dispose();
    this.clearStars();
    for (const m of this.mats.values()) m.dispose();
    // (the buddy and the Glimmer have left the group already: the rest is all ours)
    this.root.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh || (o as THREE.Sprite).isSprite) { if (m.isMesh) m.geometry.dispose(); for (const mt of [m.material].flat()) (mt as THREE.Material | undefined)?.dispose(); } });
    this.geos?.hue.dispose(); this.geos?.base?.dispose();
  }
}

// ---------- the counters' shapes (made once per episode, scaled to the counter's size) ----------
function tokenGeos(kind: TokenKind): { hue: THREE.BufferGeometry; base: THREE.BufferGeometry | null; rim: THREE.BufferGeometry } {
  const g = shapes(kind);
  return { ...g, rim: kind === 'cookie' && g.base ? g.base : g.hue };
}
function shapes(kind: TokenKind): { hue: THREE.BufferGeometry; base: THREE.BufferGeometry | null } {
  const lathe = (pts: number[][], n = 28) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
  if (kind === 'cookie') {
    // a golden cookie with a dome of coloured icing
    // a thick baked cookie (its top crumbly and golden) under a dome of glossy icing
    const base = lathe([[0, 0], [0.88, 0], [0.98, 0.07], [1.02, 0.24], [0.98, 0.38], [0.86, 0.45], [0.5, 0.48], [0, 0.48]], 36);
    const hue = lathe([[0, 0.43], [0.72, 0.43], [0.78, 0.48], [0.72, 0.56], [0.45, 0.61], [0, 0.62]], 36);
    return { hue, base };
  }
  if (kind === 'pearl') {
    const hue = new THREE.SphereGeometry(0.8, 24, 16); hue.translate(0, 0.8, 0);
    return { hue, base: null };
  }
  if (kind === 'berry') {
    const hue = new THREE.SphereGeometry(0.82, 22, 16); hue.scale(1, 0.9, 1); hue.translate(0, 0.74, 0);
    const leaves: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) { const l = new THREE.SphereGeometry(0.22, 8, 6); l.scale(1.3, 0.25, 0.55); l.translate(0.22, 1.47, 0); l.rotateY((i / 5) * Math.PI * 2); leaves.push(l.toNonIndexed()); }
    const stem = new THREE.CylinderGeometry(0.04, 0.05, 0.18, 6); stem.translate(0, 1.56, 0);
    return { hue, base: mergeGeometries([...leaves, stem.toNonIndexed()]) };
  }
  if (kind === 'block') {
    const hue = new RoundedBoxGeometry(1.45, 1.3, 1.45, 3, 0.16); hue.translate(0, 0.65, 0);
    return { hue, base: null };
  }
  // flower: five round petals round a sunny middle
  const petals: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) { const p = new THREE.SphereGeometry(0.46, 14, 10); p.scale(1, 0.32, 0.72); p.translate(0.52, 0.2, 0); p.rotateY((i / 5) * Math.PI * 2 + 0.3); petals.push(p.toNonIndexed()); }
  const mid = new THREE.SphereGeometry(0.34, 14, 10); mid.scale(1, 0.6, 1); mid.translate(0, 0.32, 0);
  return { hue: mergeGeometries(petals), base: mid };
}

// ---------- painted-on-the-fly textures ----------
function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void, w = size) {
  const c = document.createElement('canvas'); c.width = w; c.height = size;
  draw(c.getContext('2d')!, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** a soft round glow */
function glowTexture() {
  return canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,240,200,.65)'); r.addColorStop(0.6, 'rgba(255,220,150,.18)'); r.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}
/** a glowing ring (a place to put something) */
function ringTexture() {
  return canvasTex(128, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, s * 0.22, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.35, 'rgba(255,250,230,.5)'); r.addColorStop(0.55, 'rgba(255,255,255,1)'); r.addColorStop(0.7, 'rgba(255,236,170,.45)'); r.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,248,225,.16)'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.25, 0, Math.PI * 2); g.fill();
  });
}
/** the cloth under the work: per place, a soft woven pattern with a stitched border */
function clothTexture(id: SetId) {
  const C: Record<SetId, [string, string, string]> = {
    kitchen: ['#f7f1e6', '#5d8fd6', '#3f6fb3'], dock: ['#d9c39a', '#b89a68', '#8a6b3e'], picnic: ['#fbf6ec', '#f3d9a0', '#d6a85a'],
    workshop: ['#6f9a63', '#5f8a55', '#3f6b3a'], garden: ['#e7dcc2', '#c9b88f', '#9c8758'], cave: ['#5b6fa3', '#4c5f92', '#33446f'],
    frost: ['#eaf4fb', '#9cc8e8', '#3f7fb8'],
  };
  const [bg, line, edge] = C[id];
  return canvasTex(256, (g, s) => {
    g.fillStyle = bg; g.fillRect(0, 0, s, s);
    // checks (gingham) in the bakery, a weave elsewhere
    g.globalAlpha = id === 'kitchen' ? 0.5 : 0.18; g.fillStyle = line;
    const n = id === 'kitchen' ? 12 : 40;
    for (let i = 0; i < n; i += 2) { g.fillRect((i / n) * s, 0, s / n, s); g.fillRect(0, (i / n) * s, s, s / n); }
    g.globalAlpha = 1;
    // a border and its stitches
    g.strokeStyle = edge; g.lineWidth = 6; g.strokeRect(8, 8, s - 16, s - 16);
    g.setLineDash([6, 6]); g.lineWidth = 2; g.strokeStyle = '#fffaf0'; g.strokeRect(16, 16, s - 32, s - 32);
  });
}
/** a soft round shadow */
function blobTexture() {
  return canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(40,20,5,.55)'); r.addColorStop(0.5, 'rgba(40,20,5,.28)'); r.addColorStop(1, 'rgba(40,20,5,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}
/** the table's shading: clear in the middle where the light falls, warm brown toward the ends */
function poolTexture() {
  return canvasTex(256, (g, s) => {
    // (the canvas top is the table's back edge; the light falls round the picture, a quarter of the way in)
    const r = g.createRadialGradient(s / 2, s * 0.25, s * 0.1, s / 2, s * 0.25, s * 0.7);
    r.addColorStop(0, 'rgba(60,28,8,0)'); r.addColorStop(0.55, 'rgba(60,28,8,.18)'); r.addColorStop(1, 'rgba(50,22,6,.62)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });
}
/** a shaft of light, bright in the middle, fading at the sides and the bottom */
function beamTexture() {
  return canvasTex(256, (g, s) => {
    const w = 64;
    const across = g.createLinearGradient(0, 0, w, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)'); across.addColorStop(0.5, 'rgba(255,255,255,1)'); across.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = across; g.fillRect(0, 0, w, s);
    g.globalCompositeOperation = 'destination-in';
    const down = g.createLinearGradient(0, 0, 0, s);
    down.addColorStop(0, 'rgba(0,0,0,1)'); down.addColorStop(0.7, 'rgba(0,0,0,.6)'); down.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = down; g.fillRect(0, 0, w, s);
  }, 64);
}

function dispose(o: THREE.Object3D) {
  o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); } });
}
