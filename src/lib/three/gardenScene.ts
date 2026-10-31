// The Fact Garden in 3D: a little floating garden island with four plots, one for each kind of math
// (times, plus, take away, share). Every fact is a plant in a raised wooden bed, one bed for each table
// or row: a seed in the soil, then a sprout, a bud, and a flower in bloom. A soft glow at a plant's foot
// is its latest answer (green quick, gold slow, pink missed) and a water drop floats over one that's due
// a check-up. Each bed has a painted sign with its row, and its front board numbers the plants, so every
// plant can be read like a square in the times table. The buddy wanders the path and waters the beds,
// butterflies drift about, and plants that grew since the last visit pop up one after another.
//
// Hundreds of plants, one draw for each kind of part (InstancedMesh): stems, leaves, buds, the six
// flower colours, soil mounds, glows, drops. The plants are painted cards (leaves, buds, flowers from
// gpt-image paintings) on real stems, and sway in the vertex shader, so nothing moves on the CPU.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import { Fx } from './fx';
import { loadGltf, loadTexture } from './assets';
import { THEMES } from './themes';
import type { Island, TrailPoint } from './island';
import type { View } from './runScene';
import type { FriendId } from '../art/cast';
import type { Op, Stage } from '../math/facts';
import { GlimmerModel } from './glimmerModel';
import { makeOutfit } from './outfits3d';
import { savedDress } from './dress';
import { sfx } from '../audio/sound';
import { BED_D, BED_H, BED_L, CELL, PATH_Z, PLOT_GAP, RIM, ROW, SOIL_Y, BUDDY_R, bedZ, crossings, findRoute, landRadius, pathZ, plantX, plotDepth, plotPlaces, plotRect, resolve as resolveAt, routeLength, step as stepAt, walkRadius, type Box, type PlotPlace, type Solid } from './gardenLayout';

export type GPlant = {
  id: string; stage: Stage;
  /** the latest answer: quick, slow, missed, or not asked */
  latest: 'fast' | 'slow' | 'miss' | null;
  due: boolean;
  /** grew since the last visit: its turn in the pop-up order (-1: didn't) */
  grew: number;
};
/** one bed: a row of the garden (a times table, a "+3" row), plants left to right by column 0 to 10 */
export type GBed = { label: string; color: number; plants: GPlant[] };
/** one plot: a fact strand (`op` is its sign: x, +...) or a skill area (`op` is the area id, a bed for each
 *  skill and a plant for each kind of question). `spread` plots space their plants along the beds and
 *  have plain front boards (the fact plots number their columns 0 to 10). */
export type GPlot = { op: Op | string; title: string; sign: string; color: string; beds: GBed[]; spread?: boolean };

// ---------- the layout, in metres (three/gardenLayout.ts: two rows of plots, the island sized to fit) ----------
const HEIGHT: Record<Stage, number> = { 0: 0, 1: 0.16, 2: 0.44, 3: 0.58 };
const GLOW = { fast: 0x1fd06e, slow: 0xffb300, miss: 0xff3f86 } as const;
/** bud tints, one for each flower colour (pink, purple, orange, blue, yellow, red), soft so the green sepals stay green */
const BUD_TINT = [0xffc2dc, 0xd9c2ff, 0xffd2a8, 0xc2e2ff, 0xfff0a8, 0xffb8b8];

const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** A box with its texture tiled by size (metres per repeat), so planks and soil aren't stretched. */
function tiledBox(w: number, h: number, d: number, per: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // faces in order: +x, -x, +y, -y, +z, -z (4 vertices each); u runs along the first size, v the second
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / per, uv.getY(i) * dims[f][1] / per); }
  return g;
}
/** Two crossed upright cards, bottom at y = 0 (leaves, buds): from the front both show, at a slant. */
function crossCards(w: number, h: number, lift = 0): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(w, h); a.translate(0, h / 2 + lift, 0); a.rotateY(Math.PI / 4);
  const b = new THREE.PlaneGeometry(w, h); b.translate(0, h / 2 + lift, 0); b.rotateY(-Math.PI / 4);
  return mergeGeometries([a, b])!;
}
/** A flower face tilted up toward the camera, its UVs on one cell of the 3 by 2 flower atlas. */
function headCard(cell: number, size: number, top: number): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(size, size);
  const uv = g.attributes.uv as THREE.BufferAttribute, cx = cell % 3, cy = Math.floor(cell / 3);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 3, 1 - (cy + 1 - uv.getY(i)) / 2);
  g.rotateX(-0.95);
  g.translate(0, top, 0.02);
  return g;
}
/** Plants sway: the higher a point, the more it moves, each plant a little out of step with the next. */
function sway(mat: THREE.Material, u: { uT: { value: number } }, amount: number) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = u.uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float ph = instanceMatrix[3].x * 1.37 + instanceMatrix[3].z * 0.71;
      #else
        float ph = 0.0;
      #endif
      transformed.x += sin(uT * 1.7 + ph) * ${amount.toFixed(3)} * transformed.y;
      transformed.z += cos(uT * 1.3 + ph * 1.3) * ${(amount * 0.5).toFixed(3)} * transformed.y;`);
  };
  mat.customProgramCacheKey = () => `garden-sway-${amount}`;
}

/** A canvas picture of a painted plank with words or numbers on it. */
function plankCanvas(w: number, h: number, planks: HTMLImageElement | null): HTMLCanvasElement {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d')!;
  if (planks) { const s = h / planks.height * 1.6; for (let px = 0; px < w; px += planks.width * s) x.drawImage(planks, px, 0, planks.width * s, planks.height * s); }
  else { x.fillStyle = '#b07a4f'; x.fillRect(0, 0, w, h); }
  return cv;
}
const fontUi = () => (getComputedStyle(document.documentElement).getPropertyValue('--font-ui').trim() || 'Fredoka, sans-serif');
function textOn(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, fill = '#fff8e6', stroke = '#5b3416', maxW = Infinity) {
  x.font = `600 ${size}px ${fontUi()}`;
  // a long word shrinks to fit its board
  const w = x.measureText(text).width; if (w > maxW) { size = Math.floor(size * maxW / w); x.font = `600 ${size}px ${fontUi()}`; }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineJoin = 'round'; x.lineWidth = size * 0.18; x.strokeStyle = stroke; x.strokeText(text, cx, cy);
  x.fillStyle = fill; x.fillText(text, cx, cy);
}
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}

/** A copy of a world model scaled to a height, its base on y = 0. */
async function model(path: string, height: number): Promise<THREE.Object3D | null> {
  const g = await loadGltf(path);
  if (!g) return null;
  const o = g.scene.clone(true);
  const box = new THREE.Box3().setFromObject(o), size = box.getSize(new THREE.Vector3());
  const k = height / Math.max(1e-6, size.y);
  o.scale.setScalar(k); o.position.y = -box.min.y * k;
  o.traverse(m => { const mm = m as THREE.Mesh; if (mm.isMesh) { mm.castShadow = true; mm.receiveShadow = true; } });
  const wrap = new THREE.Group(); wrap.add(o);
  return wrap;
}

type Slot = { mesh: THREE.InstancedMesh; i: number; base: THREE.Matrix4 };
/** a surprise somewhere on the island: it happens when you walk up to it, and again once you've walked away */
type Secret = { at: THREE.Vector3; r: number; away: number; armed: boolean; fire: () => void; tick?: (dt: number, t: number) => void };
/** where the surprises are (kept clear of the trees placed at random) */
const SPOTS = [
  { x: -13, z: -23, r: 4.2 },   // the pond and its frog
  { x: 13, z: -22.5, r: 3 },    // the wishing well
  { x: -6, z: -19.4, r: 2.2 },  // the scarecrow
  { x: 6, z: -19.8, r: 2.2 },   // the bouncy mushroom
  { x: 2.6, z: -34.4, r: 2.6 }, // the golden flower, behind the little house
];

export class GardenScene implements Controller {
  /** smooth while you walk the buddy round or steer the camera, calmer while you just look */
  get fps() { return this.walk.mode === 'drive' || this.walk.mode === 'travel' || this.free ? 60 : 30; }
  readonly island: Island;
  view: View;
  readonly plots: GPlot[];
  /** which plot and bed the camera is on (bed null: the whole plot) */
  plot = 0; bed: number | null = null;
  private me: Character | null = null;
  private fx = new Fx();
  private u = { uT: { value: 0 } };
  private own: { dispose(): void }[] = [];
  private hit!: THREE.InstancedMesh;
  /** each hit-box instance: which plant (plot, bed, column) */
  private hitIds: { id: string; plot: number; bed: number; col: number; pos: THREE.Vector3; top: number }[] = [];
  private ring: THREE.Mesh;
  private bedGlow: THREE.Mesh;
  private selected: number | null = null;
  private drops: { mesh: THREE.InstancedMesh; at: THREE.Vector3[] } | null = null;
  private growing: { slots: Slot[]; at: number; pos: THREE.Vector3; done: boolean }[] = [];
  /** seconds between one plant popping up and the next (shorter when lots grew) */
  private popGap = 0.16;
  private butterflies: { g: THREE.Group; l: THREE.Object3D; r: THREE.Object3D; ph: number; sp: number }[] = [];
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private now = 0; private started = -1;
  private walk = {
    to: new THREE.Vector3(), wait: 2, mode: 'idle' as 'idle' | 'walk' | 'water' | 'travel' | 'drive', until: 0, route: [] as THREE.Vector3[], face: Math.PI, waterAt: null as THREE.Vector3 | null, speed: 3.2,
    /** a trip: when it set off, how long it should take, and whether it has had to look for another way */
    began: 0, takes: 3, rerouted: false, check: 0, checkAt: new THREE.Vector3(),
  };
  /** walking the buddy yourself: the keys or pad held (right, forward), or a spot tapped on the ground */
  private input = { x: 0, z: 0 };
  private goto: THREE.Vector3 | null = null;
  /** the corners after that on the way there, and whether it may still look for another way */
  private gotoWay: THREE.Vector3[] = [];
  private gotoAgain = true;
  private stuckT = 0;
  /** the camera stays behind the buddy while you walk it */
  private follow = false;
  /** a boing on the bouncy mushroom (seconds into it, or -1) */
  private hopT = -1;
  private solids: Solid[] = [];
  private boxes: Box[] = [];
  /** where each plot is (two rows), how far from the middle the buddy can walk, how far the rows reach */
  places: PlotPlace[] = [];
  private walkR = 44;
  private edge = 38;
  /** plot i's middle and its front bed's z */
  private px(i: number) { return this.places[i]?.x ?? 0; }
  private pz(i: number) { return this.places[i]?.z ?? 0; }
  private secrets: Secret[] = [];
  /** where the buddy is (plot, bed) and the plant it's standing by, so the screen can follow along */
  private near = { plot: -1, bed: null as number | null, plant: -1 };
  /** the buddy says something (the secrets) */
  onSay: ((text: string) => void) | null = null;
  /** a secret of the 100-Glimmer ladder was found ('hut': the Seed Library's door) */
  onSecret: ((id: 'hut') => void) | null = null;
  /** you walked to another plot or bed */
  onWhere: ((plot: number, bed: number | null) => void) | null = null;
  /** you walked up to a plant (null: none close) */
  onNear: ((id: string | null) => void) | null = null;
  /** the player's own camera (drag, pinch, the arrows), or null: the garden frames itself */
  private free: { target: THREE.Vector3; yaw: number; pitch: number; dist: number } | null = null;
  /** going to another garden: the camera keeps its zoom and angle (this offset from where it looks) and
   *  follows the buddy there, then rests on that garden (Erik: "don't change the zoom level") */
  private hold: { off: THREE.Vector3 } | null = null;
  /** the stage clock time the scene showed (growth pops in after) */
  private sun: THREE.DirectionalLight;
  private clouds: THREE.Object3D[] = [];

  private constructor(island: Island, plots: GPlot[], view: View, sun: THREE.DirectionalLight, own: { dispose(): void }[]) {
    this.island = island; this.plots = plots; this.view = view; this.sun = sun; this.own = own;
    this.ring = new THREE.Mesh(this.keep(new THREE.TorusGeometry(0.3, 0.026, 8, 40)), this.keep(new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.95 })));
    this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false;
    island.root.add(this.ring);
    const edge = (w: number, d: number, x: number, z: number) => new THREE.BoxGeometry(w, 0.03, d).translate(x, 0, z);
    const e = 0.06, L = BED_L + 0.14, D = BED_D + 0.14;
    this.bedGlow = new THREE.Mesh(this.keep(mergeGeometries([edge(L, e, 0, -D / 2), edge(L, e, 0, D / 2), edge(e, D, -L / 2, 0), edge(e, D, L / 2, 0)])!), this.keep(new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.9 })));
    this.bedGlow.visible = false;
    island.root.add(this.bedGlow);
    stage.scene.add(this.fx.root);
    if (import.meta.env.DEV) (window as unknown as { __garden: GardenScene }).__garden = this;
  }
  private keep<T extends { dispose(): void }>(x: T) { this.own.push(x); return x; }

  static async create(o: { plots: GPlot[]; buddy: FriendId; view: View; plot?: number; name?: string; blooms?: number }): Promise<GardenScene> {
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
    const T = { ...THEMES.village };
    const root = new THREE.Group();
    const rnd = rand(29);
    const base = import.meta.env.BASE_URL;
    // the plots in two rows (the four fact plots at the back, the skill areas in front), each row with its
    // own path; the island is as big as they need (three/gardenLayout.ts)
    const NP = o.plots.length, places = plotPlaces(NP), depths = o.plots.map(pl => pl.beds.length);
    const EDGE = Math.max(38, ...places.map(q => Math.abs(q.x) + BED_L / 2 + 3));
    const R = landRadius(places, depths), rows = places.some(q => q.row === 1) ? 2 : 1;
    const rowEdge = (row: number) => Math.max(...places.filter(q => q.row === row).map(q => Math.abs(q.x) + BED_L / 2 + 3));
    await document.fonts?.ready;
    const [grassTex, dirtTex, planksTex, postTex, rockTex, cloudTex, leafTex, budTex, headTex, flyTex, seedTex, dropTex, tealTex, planksImg] = await Promise.all([
      loadTexture('world/grass.webp', { repeat: true }), loadTexture('world/dirt.webp', { repeat: true }), loadTexture('world/planks.webp', { repeat: true }),
      loadTexture('world/post.webp', { repeat: true }), loadTexture('world/rock.webp', { repeat: true }), loadTexture('world/cloud.webp'),
      loadTexture('garden/leaves-card.webp'), loadTexture('garden/bud-card.webp'), loadTexture('garden/heads.webp'), loadTexture('garden/butterfly.webp'), loadTexture('garden/seed.webp'),
      loadTexture('garden/due.webp'), loadTexture('gear/tex-teal.webp', { repeat: true }), loadImage(`${base}world/planks.webp`),
    ]);
    for (const t of [leafTex, budTex, headTex, flyTex, seedTex, dropTex]) if (t) t.anisotropy = 4;

    // ---------- sky, light, clouds (as on the islands) ----------
    const sunDir = new THREE.Vector3(0.45, 0.62, 0.65).normalize();
    const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1500, 32, 16)), keep(new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(T.sky[0]) }, mid: { value: new THREE.Color(T.sky[1]) }, low: { value: new THREE.Color(T.sky[2]) }, sunDir: { value: sunDir } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: 'uniform vec3 top, mid, low, sunDir; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.08, 0.18, y)); c = mix(c, top, smoothstep(0.18, 0.75, y)); float s = max(0.0, dot(normalize(vDir), sunDir)); c += vec3(1.0,0.93,0.78) * (pow(s, 600.0) * 1.6 + pow(s, 12.0) * 0.18); gl_FragColor = vec4(c, 1.0); }',
    })));
    sky.renderOrder = -1; root.add(sky);
    const hemi = new THREE.HemisphereLight(T.hemi.sky, T.hemi.ground, T.hemi.power * 1.15);
    const sun = new THREE.DirectionalLight(T.sun.color, T.sun.power);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 160 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    sun.userData.dir = sunDir;
    root.add(hemi, sun, sun.target);
    const clouds: THREE.Object3D[] = [];
    if (cloudTex) {
      const mat = keep(new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false }));
      const geo = keep(new THREE.PlaneGeometry(1, 1));
      for (let i = 0; i < 36; i++) {
        const p = new THREE.Mesh(geo, mat), sz = 16 + rnd() * 30, a = rnd() * Math.PI * 2, r = 70 + rnd() * 150;
        const low = i < 20;
        p.position.set(Math.cos(a) * r, low ? -30 + rnd() * 14 : 16 + rnd() * 40, Math.sin(a) * r - (low ? 0 : 60));
        p.scale.set(sz * 2.2, sz, 1); p.userData.spin = 0.2 + rnd() * 0.4; root.add(p); clouds.push(p);
      }
    }

    // ---------- the island: a grassy top on a rocky underside, paths ----------
    if (grassTex) grassTex.repeat.set(26 * R / 46, 26 * R / 46);
    const ground = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 72)), keep(new THREE.MeshStandardMaterial({ map: grassTex, color: grassTex ? 0xf2ffe8 : 0x8fcf6e, roughness: 0.95 })));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
    if (rockTex) rockTex.repeat.set(10, 2);
    const skirt = new THREE.Mesh(keep(new THREE.CylinderGeometry(R, 7, 26, 56, 1, true)), keep(new THREE.MeshStandardMaterial({ map: rockTex, color: 0xd8c2a8, roughness: 0.95, side: THREE.DoubleSide })));
    skirt.position.y = -13; root.add(skirt);
    // the paths: drawn as one picture over the grass (one layer, soft edges), so where two paths meet
    // there are no overlapping strips to flicker against each other
    const PX = EDGE + 1, PZ0 = -27, PZ1 = pathZ(rows - 1) + 1.4;
    const pc = document.createElement('canvas'); pc.width = 2048; pc.height = Math.round(2048 * (PZ1 - PZ0) / (2 * PX));
    {
      const g = pc.getContext('2d')!, kx = pc.width / (2 * PX), kz = pc.height / (PZ1 - PZ0);
      const cx = (x: number) => (x + PX) * kx, cz = (z: number) => (z - PZ0) * kz;
      g.fillStyle = '#000'; g.fillRect(0, 0, pc.width, pc.height);
      g.filter = 'blur(2px)'; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
      const line = (pts: [number, number][], w: number) => { g.lineWidth = w * kx; g.beginPath(); pts.forEach(([x, z], i) => (i ? g.lineTo(cx(x), cz(z)) : g.moveTo(cx(x), cz(z)))); g.stroke(); };
      // the back row's path, and the grass aisles between its plots back to the little house's path
      const backXs = places.filter(q => q.row === 0).map(q => q.x);
      line([[-rowEdge(0), PATH_Z], [rowEdge(0), PATH_Z]], 1.7);
      for (let i = 0; i < backXs.length - 1; i++) { const x = (backXs[i] + backXs[i + 1]) / 2; line([[x, PATH_Z], [x, -16.5]], 1.3); }
      // the front row's path, joined to the back row's beside each of its plots
      if (rows > 1) {
        line([[-rowEdge(1), pathZ(1)], [rowEdge(1), pathZ(1)]], 1.7);
        for (const x of crossings(places)) line([[x, pathZ(1)], [x, PATH_Z]], 1.4);
      }
      line([[-9, -16.5], [9, -16.5]], 1.3);
      line([[0, -16.5], [0, -22.4]], 1.5);
    }
    const pathAlpha = keep(new THREE.CanvasTexture(pc));
    const pathTex = dirtTex ? keep(dirtTex.clone()) : null;
    if (pathTex) { pathTex.wrapS = pathTex.wrapT = THREE.RepeatWrapping; pathTex.repeat.set((2 * PX) / 2.2, (PZ1 - PZ0) / 2.2); pathTex.needsUpdate = true; }
    const pathMat = keep(new THREE.MeshStandardMaterial({ map: pathTex, alphaMap: pathAlpha, transparent: true, depthWrite: false, color: 0xf3e2c6, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    const pathMesh = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * PX, PZ1 - PZ0).rotateX(-Math.PI / 2).translate(0, 0.012, (PZ0 + PZ1) / 2)), pathMat);
    pathMesh.receiveShadow = true; pathMesh.renderOrder = -0.5; root.add(pathMesh);

    // ---------- the beds: plank frames, soil, a numbered front board and a sign for each row ----------
    const planksMat = keep(new THREE.MeshStandardMaterial({ map: planksTex, color: 0xfff1e0, roughness: 0.85 }));
    const soilMat = keep(new THREE.MeshStandardMaterial({ map: dirtTex, color: 0xa7835f, roughness: 1 }));
    const postMat = keep(new THREE.MeshStandardMaterial({ map: postTex, roughness: 0.9 }));
    // the front board: the planks with each column's number on a little cream tag
    const nc = plankCanvas(2048, 90, planksImg), nx = nc.getContext('2d')!;
    for (let c = 0; c <= 10; c++) {
      const cx = ((plantX(c) + BED_L / 2) / BED_L) * nc.width;
      nx.fillStyle = 'rgba(255, 246, 225, .96)'; nx.strokeStyle = '#6b4320'; nx.lineWidth = 4;
      nx.beginPath(); nx.roundRect(cx - 34, 12, 68, 66, 18); nx.fill(); nx.stroke();
      textOn(nx, String(c), cx, 47, 50, '#5b3416', 'rgba(0,0,0,0)');
    }
    const numTex = keep(new THREE.CanvasTexture(nc)); numTex.colorSpace = THREE.SRGBColorSpace; numTex.anisotropy = 8;
    const numMat = keep(new THREE.MeshStandardMaterial({ map: numTex, roughness: 0.85 }));
    const frames: THREE.BufferGeometry[] = [], soils: THREE.BufferGeometry[] = [], fronts: THREE.BufferGeometry[] = [], posts: THREE.BufferGeometry[] = [];
    const signMats: THREE.Material[] = [];
    const signMeshes: THREE.Mesh[] = [];
    o.plots.forEach((pl, pi) => {
      const X = places[pi].x, Z0 = places[pi].z;
      // the signs: one canvas for the plot, a row for each bed
      const sc = plankCanvas(512, 128 * pl.beds.length, planksImg), sx = sc.getContext('2d')!;
      const signGeo: THREE.BufferGeometry[] = [];
      pl.beds.forEach((bd, j) => {
        const Z = Z0 + bedZ(j);
        const add = (list: THREE.BufferGeometry[], g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); list.push(g); };
        add(frames, tiledBox(BED_L, BED_H, RIM, 0.9), X, BED_H / 2, Z - BED_D / 2 + RIM / 2);
        add(frames, tiledBox(RIM, BED_H, BED_D - 2 * RIM, 0.9), X - BED_L / 2 + RIM / 2, BED_H / 2, Z);
        add(frames, tiledBox(RIM, BED_H, BED_D - 2 * RIM, 0.9), X + BED_L / 2 - RIM / 2, BED_H / 2, Z);
        if (pl.spread) add(frames, tiledBox(BED_L, BED_H, RIM, 0.9), X, BED_H / 2, Z + BED_D / 2 - RIM / 2);
        else add(fronts, new THREE.BoxGeometry(BED_L, BED_H, RIM), X, BED_H / 2, Z + BED_D / 2 - RIM / 2);
        add(soils, tiledBox(BED_L - 2 * RIM, SOIL_Y, BED_D - 2 * RIM, 1.2), X, SOIL_Y / 2, Z);
        // the sign: a post and a board at the bed's left end, turned a little toward the path
        const sxp = X - BED_L / 2 - 0.62, szp = Z + 0.1;
        add(posts, new THREE.CylinderGeometry(0.04, 0.05, 0.66, 7), sxp, 0.33, szp);
        const row = j * 128;
        sx.save(); sx.strokeStyle = '#5b3416'; sx.lineWidth = 10; sx.strokeRect(5, row + 5, 502, 118); sx.restore();
        textOn(sx, bd.label, 256, row + 68, 96, undefined, undefined, 470);
        const board = new THREE.PlaneGeometry(1.05, 0.3);
        const uv = board.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (j + 1 - uv.getY(i)) / pl.beds.length);
        board.rotateX(-0.5); board.rotateY(0.3); board.translate(sxp, 0.66, szp + 0.03);
        signGeo.push(board);
        add(frames, tiledBox(1.07, 0.32, 0.04, 0.9).rotateX(-0.5).rotateY(0.3), sxp, 0.66, szp + 0.005);
      });
      const st = keep(new THREE.CanvasTexture(sc)); st.colorSpace = THREE.SRGBColorSpace; st.anisotropy = 8;
      const sm = keep(new THREE.MeshStandardMaterial({ map: st, roughness: 0.8 }));
      signMats.push(sm);
      const signs = new THREE.Mesh(keep(mergeGeometries(signGeo)!), sm); signs.castShadow = true; root.add(signs); signMeshes.push(signs);
      signGeo.forEach(g => g.dispose());
      // the plot's name on a big board at its front corner
      const tc = plankCanvas(1024, 256, planksImg), tx = tc.getContext('2d')!;
      tx.strokeStyle = '#5b3416'; tx.lineWidth = 16; tx.strokeRect(8, 8, 1008, 240);
      tx.fillStyle = pl.color; tx.beginPath(); tx.arc(128, 128, 82, 0, Math.PI * 2); tx.fill(); tx.strokeStyle = '#fff'; tx.lineWidth = 10; tx.stroke();
      textOn(tx, pl.sign, 128, 136, 120, '#fff', 'rgba(0,0,0,.25)');
      textOn(tx, pl.title, 600, 132, 104, undefined, undefined, 740);
      const tt = keep(new THREE.CanvasTexture(tc)); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
      const title = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.2, 0.55)), keep(new THREE.MeshStandardMaterial({ map: tt, roughness: 0.8 })));
      title.position.set(X - BED_L / 2 + 0.4, 1.05, Z0 + PATH_Z + 1.25); title.rotation.y = 0.12; title.castShadow = true; root.add(title);
      for (const dx of [-0.95, 0.95]) posts.push(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 7).translate(X - BED_L / 2 + 0.4 + dx * Math.cos(0.12), 0.65, Z0 + PATH_Z + 1.2 - dx * Math.sin(0.12)));
    });
    for (const [list, mat] of [[frames, planksMat], [fronts, numMat], [soils, soilMat], [posts, postMat]] as const) {
      if (!list.length) continue;
      const m = new THREE.Mesh(keep(mergeGeometries(list as THREE.BufferGeometry[])!), mat);
      m.castShadow = true; m.receiveShadow = true; root.add(m);
      (list as THREE.BufferGeometry[]).forEach(g => g.dispose());
    }
    void signMats; void signMeshes;

    // ---------- the plants: one InstancedMesh for each kind of part ----------
    const u = { uT: { value: 0 } };
    const cardMat = (map: THREE.Texture | null, amount: number, color = 0xffffff) => {
      const m = keep(new THREE.MeshStandardMaterial({ map, color, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65 }));
      sway(m, u, amount); return m;
    };
    const stemGeo = keep(new THREE.CylinderGeometry(0.014, 0.02, 1, 5).translate(0, 0.5, 0));
    const stemMat = keep(new THREE.MeshStandardMaterial({ color: 0x4fae5c, roughness: 0.7 })); sway(stemMat, u, 0.18);
    const leafGeo = keep(crossCards(0.34, 0.28));
    const budGeo = keep(crossCards(0.19, 0.21, HEIGHT[2] - 0.05));
    const headGeos = [0, 1, 2, 3, 4, 5].map(c => keep(headCard(c, 0.44, HEIGHT[3])));
    // a seed: the painted seed in its little mound, leaning back to face the path
    const seedGeo = keep(new THREE.PlaneGeometry(0.26, 0.26).translate(0, 0.11, 0).rotateX(-0.55));
    const glowTexC = document.createElement('canvas'); glowTexC.width = glowTexC.height = 64;
    { const g = glowTexC.getContext('2d')!, gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); }
    const glowTex = keep(new THREE.CanvasTexture(glowTexC));
    const glowGeo = keep(new THREE.PlaneGeometry(0.56, 0.56).rotateX(-Math.PI / 2));
    // a soft pool of colour on the soil (not added light: that washed every colour out to yellow)
    const glowMat = keep(new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }));

    // a spread plot's few plants share out the bed's length (the fact plots: one per numbered column)
    const all = o.plots.flatMap((pl, pi) => pl.beds.flatMap((bd, j) => bd.plants.map((pt, c) => ({ pt, pi, j, c, x: pl.spread ? (c + 0.5) * (11 / Math.max(1, bd.plants.length)) - 0.5 : c, color: bd.color }))));
    const count = (f: (x: typeof all[number]) => boolean) => Math.max(1, all.filter(f).length);
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, shadow = false) => {
      const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.castShadow = shadow; m.receiveShadow = false; m.frustumCulled = false; root.add(m); return m;
    };
    const stems = mk(stemGeo, stemMat, count(x => x.pt.stage >= 2), true);
    const leaves = mk(leafGeo, cardMat(leafTex, 0.22), count(x => x.pt.stage >= 1), true);
    const buds = mk(budGeo, cardMat(budTex, 0.18), count(x => x.pt.stage === 2), true);
    const headMat = cardMat(headTex, 0.16);
    const heads = headGeos.map((g, c) => mk(g, headMat, count(x => x.pt.stage === 3 && x.color === c), true));
    const mounds = mk(seedGeo, cardMat(seedTex, 0.05), count(x => x.pt.stage === 0));
    const glows = mk(glowGeo, glowMat, count(x => !!x.pt.latest));
    const hitMat = keep(new THREE.MeshBasicMaterial({ visible: false }));
    // tall enough to catch a tap on a flower's head as well as its leaves
    const hit = mk(keep(new THREE.BoxGeometry(0.56, 0.9, 0.7).translate(0, 0.4, 0)), hitMat, all.length);
    const dropMat = keep(new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, alphaTest: 0.1, depthWrite: false }));
    const drops = mk(keep(new THREE.PlaneGeometry(0.17, 0.17)), dropMat, count(x => x.pt.due));

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), col = new THREE.Color();
    const put = (mesh: THREE.InstancedMesh, pos: THREE.Vector3, rotY: number, s: number, color?: number): Slot => {
      const i = mesh.count++;
      m4.compose(pos, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), sv.set(s, s, s));
      mesh.setMatrixAt(i, m4);
      if (color !== undefined) mesh.setColorAt(i, col.set(color));
      return { mesh, i, base: m4.clone() };
    };
    const growing: GardenScene['growing'] = [];
    const hitIds: GardenScene['hitIds'] = [];
    const dropAt: THREE.Vector3[] = [];
    const prnd = rand(7);
    for (const { pt, pi, j, c, x, color } of all) {
      const pos = new THREE.Vector3(places[pi].x + plantX(x) + (prnd() - 0.5) * 0.05, SOIL_Y, places[pi].z + bedZ(j) + (prnd() - 0.5) * 0.08);
      const ry = (prnd() - 0.5) * 0.7, slots: Slot[] = [];
      if (pt.stage === 0) slots.push(put(mounds, pos, ry * 0.4, 0.85 + prnd() * 0.25));
      if (pt.stage >= 1) slots.push(put(leaves, pos, ry, pt.stage === 1 ? 0.8 : 1.05));
      if (pt.stage >= 2) { const s = put(stems, pos, ry, 1); m4.compose(pos, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), sv.set(1, HEIGHT[pt.stage], 1)); stems.setMatrixAt(s.i, m4); s.base = m4.clone(); slots.push(s); }
      if (pt.stage === 2) slots.push(put(buds, pos, ry * 0.5, 1, BUD_TINT[color] ?? 0xffffff));
      if (pt.stage === 3) slots.push(put(heads[color] ?? heads[0], pos, ry * 0.3, 1));
      if (pt.latest) put(glows, pos.clone().setY(SOIL_Y + 0.006), 0, pt.stage === 0 ? 0.8 : 1, GLOW[pt.latest]);
      if (pt.due) { const at = pos.clone().setY(SOIL_Y + HEIGHT[pt.stage] + 0.2); dropAt.push(at); put(drops, at, 0, 1); }
      put(hit, pos, 0, 1);
      hitIds.push({ id: pt.id, plot: pi, bed: j, col: c, pos, top: SOIL_Y + HEIGHT[pt.stage] });
      if (pt.grew >= 0) growing.push({ slots, at: pt.grew, pos, done: false });
    }
    for (const m of [stems, leaves, buds, ...heads, mounds, glows, hit, drops]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
    // plants that grew since the last visit start small and pop up one by one
    for (const g of growing) for (const s of g.slots) { s.mesh.setMatrixAt(s.i, new THREE.Matrix4().makeScale(0, 0, 0)); s.mesh.instanceMatrix.needsUpdate = true; }

    // ---------- around the garden: trees, bushes, mushrooms, the little house, watering cans ----------
    const [puffy, puffy2, round, bush, mush, hill, boulder, isl] = await Promise.all([
      model('world/tree_puffy.glb', 5.4), model('world/tree_puffy2.glb', 6.2), model('world/tree_round.glb', 4.6), model('world/bush.glb', 0.9),
      model('world/mushroom.glb', 0.7), model('world/hobbit_hill.glb', 4.2), model('world/boulder.glb', 1), model('world/island.glb', 10),
    ]);
    // things the buddy can't walk through: circles (rocks, tree trunks, bushes, the well, the scarecrow)
    // and boxes (the beds, the little house), each as big as the model really is on the ground
    const solids: Solid[] = [], boxes: Box[] = [];
    /** how far a model reaches out from its middle on the ground, at scale 1 */
    const reachOf = (m: THREE.Object3D | null) => { if (!m) return 0; const b = new THREE.Box3().setFromObject(m), sz = b.getSize(new THREE.Vector3()); return Math.max(sz.x, sz.z) / 2; };
    const foot = { boulder: reachOf(boulder), bush: reachOf(bush), mush: reachOf(mush) };
    o.plots.forEach((pl, pi) => {
      const X = places[pi].x, Z0 = places[pi].z;
      pl.beds.forEach((_, j) => {
        boxes.push({ x0: X - BED_L / 2 - 0.04, x1: X + BED_L / 2 + 0.04, z0: Z0 + bedZ(j) - BED_D / 2, z1: Z0 + bedZ(j) + BED_D / 2 });
        solids.push({ x: X - BED_L / 2 - 0.62, z: Z0 + bedZ(j) + 0.1, r: 0.12 });
      });
      solids.push({ x: X - BED_L / 2 + 0.4 - 0.95, z: Z0 + PATH_Z + 1.25, r: 0.1 }, { x: X - BED_L / 2 + 0.4 + 0.95, z: Z0 + PATH_Z + 1.12, r: 0.1 });
      solids.push({ x: X + BED_L / 2 + 0.55, z: Z0 + PATH_Z - 0.75, r: 0.22 });
    });
    // the little house: its own size on the ground (its round door at the front stays reachable)
    if (hill) { const b = new THREE.Box3().setFromObject(hill); boxes.push({ x0: b.min.x * 0.92, x1: b.max.x * 0.92, z0: -27 + b.min.z * 0.92, z1: Math.min(-22.6, -27 + b.max.z * 0.92) }); }
    // the trees and bushes placed at random stay off the plots, the paths and the secret spots
    const keepOff = places.map((q, i) => plotRect(q, depths[i]));
    const clear = (x: number, z: number) =>
      !keepOff.some(k => x > k.x0 - 2.5 && x < k.x1 + 2.5 && z > k.z0 - 2.5 && z < k.z1 + 2) &&
      !(Math.abs(z - PATH_Z) < 2.2 && Math.abs(x) < rowEdge(0) + 1) && !(rows > 1 && Math.abs(z - pathZ(1)) < 2.2 && Math.abs(x) < rowEdge(1) + 1) &&
      !(rows > 1 && z > PATH_Z && z < pathZ(1) && crossings(places).some(cx => Math.abs(x - cx) < 2.2)) &&
      !(Math.abs(x) < 6 && z < -16 && z > -33) && !(Math.abs(z + 16.5) < 2 && Math.abs(x) < 10) && !SPOTS.some(sp => Math.hypot(x - sp.x, z - sp.z) < sp.r);
    const grow = R / 46;
    const place = (m: THREE.Object3D | null, n: number, rMin: number, rMax: number, sMin: number, sMax: number, solid = 0, tall = false, kind = '') => {
      if (!m) return;
      n = Math.round(n * grow * grow);
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const a = rnd() * Math.PI * 2, r = (rMin + rnd() * (rMax - rMin)) * grow, x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
        if (!clear(x, z) || Math.hypot(x, z) > R - 2) continue;
        const c = m.clone(true), s = sMin + rnd() * (sMax - sMin); c.position.set(x, 0, z); c.scale.setScalar(s); c.rotation.y = rnd() * 6.28; root.add(c); i++;
        if (solid) solids.push({ x, z, r: solid * s, tall, kind });
      }
    };
    // trees: their trunks; bushes, rocks and mushrooms: nearly all of them
    place(puffy, 10, 18, 44, 0.8, 1.2, 0.75, true, 'tree'); place(puffy2, 8, 18, 44, 0.8, 1.15, 0.75, true, 'tree'); place(round, 8, 16, 42, 0.8, 1.2, 0.65, true, 'tree');
    place(bush, 28, 8, 44, 0.7, 1.4, foot.bush * 0.85 || 0.45, false, 'bush'); place(boulder, 10, 10, 44, 0.6, 1.5, foot.boulder * 0.92 || 0.6, false, 'rock'); place(mush, 20, 6, 40, 0.6, 1.3, foot.mush * 0.6 || 0.2, false, 'mushroom');
    // a few bushes and mushrooms right by the beds (never on the paths)
    if (bush) for (let pi = 0; pi < o.plots.length; pi++) for (const [dx, dz] of [[BED_L / 2 + 2.1, -2], [BED_L / 2 + 2.2, -7.5], [-BED_L / 2 - 1.5, -10]]) { if (-dz > plotDepth(depths[pi]) + 1) continue; const c = bush.clone(true), s = 0.7 + rnd() * 0.4, z = places[pi].z + dz; c.position.set(places[pi].x + dx, 0, z); c.scale.setScalar(s); root.add(c); solids.push({ x: c.position.x, z, r: (foot.bush * 0.85 || 0.45) * s }); }
    if (mush) for (let pi = 0; pi < o.plots.length; pi++) for (const [dx, dz] of [[BED_L / 2 + 0.7, 0.4], [-BED_L / 2 - 1.1, -4.6]]) { const c = mush.clone(true), s = 0.6 + rnd() * 0.5, z = places[pi].z + dz; c.position.set(places[pi].x + dx, 0, z); c.scale.setScalar(s); root.add(c); solids.push({ x: c.position.x, z, r: (foot.mush * 0.6 || 0.2) * s }); }
    if (hill) { hill.position.set(0, 0, -27); root.add(hill); }
    if (isl) for (let i = 0; i < 6; i++) { const c = isl.clone(true); const a = rnd() * Math.PI * 2; c.position.set(Math.cos(a) * (90 + rnd() * 80), -6 + rnd() * 26, Math.sin(a) * (90 + rnd() * 80) - 40); c.scale.setScalar(0.7 + rnd() * 1.6); c.rotation.y = rnd() * 6; root.add(c); }
    // a painted watering can by each plot
    if (tealTex) tealTex.repeat.set(2, 1);
    const canMat = keep(new THREE.MeshStandardMaterial({ map: tealTex, color: 0xffffff, roughness: 0.4, metalness: 0.1 }));
    const canParts = [
      new THREE.LatheGeometry([0.13, 0.15, 0.155, 0.15, 0.12, 0.05].map((r, i) => new THREE.Vector2(r, i * 0.06)), 16),
      new THREE.CylinderGeometry(0.018, 0.03, 0.34, 8).rotateZ(-1.0).translate(0.22, 0.2, 0),
      new THREE.CylinderGeometry(0.05, 0.03, 0.05, 10).rotateZ(-1.0).translate(0.36, 0.29, 0),
      new THREE.TorusGeometry(0.1, 0.018, 6, 16, Math.PI).translate(-0.02, 0.3, 0),
    ];
    const canGeo = keep(mergeGeometries(canParts.map(g => g.index ? g.toNonIndexed() : g))!);
    canParts.forEach(g => g.dispose());
    for (let pi = 0; pi < o.plots.length; pi++) { const c = new THREE.Mesh(canGeo, canMat); c.position.set(places[pi].x + BED_L / 2 + 0.55, 0, places[pi].z + PATH_Z - 0.75); c.rotation.y = -2.2; c.castShadow = true; root.add(c); }

    const garden: Island = {
      trail: { length: 100, at: (s: number): TrailPoint => ({ p: new THREE.Vector3(s, 0, PATH_Z), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) } as TrailPoint) },
      height: () => 0, placeFinish: () => {}, gateSolid: () => {}, root, theme: T as Island['theme'], stats: {},
      setSmooth: (on: boolean) => { for (const c of clouds) c.visible = !on || c.position.y > 0; },
      update: (dt: number) => { for (const c of clouds) c.rotation.z = 0; void dt; },
      dispose: () => { for (const x of own) x.dispose(); },
    };
    const sc = new GardenScene(garden, o.plots, o.view, sun, own);
    sc.u = u; sc.hit = hit; sc.hitIds = hitIds; sc.growing = growing; sc.clouds = clouds;
    sc.drops = { mesh: drops, at: dropAt };
    sc.popGap = Math.min(0.16, 3.6 / Math.max(1, growing.length));
    sc.plot = o.plot ?? 0;
    sc.places = places; sc.walkR = walkRadius(R); sc.edge = EDGE;

    // ---------- butterflies ----------
    if (flyTex) {
      const wingMat = keep(new THREE.MeshStandardMaterial({ map: flyTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.6 }));
      const half = (left: boolean) => {
        const g = new THREE.PlaneGeometry(0.11, 0.2); const uv = g.attributes.uv as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) uv.setX(i, left ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
        g.translate(left ? -0.055 : 0.055, 0, 0); g.rotateX(-Math.PI / 2); return keep(g);
      };
      const lg = half(true), rg = half(false);
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group(), l = new THREE.Mesh(lg, wingMat), r = new THREE.Mesh(rg, wingMat);
        g.add(l, r); root.add(g);
        sc.butterflies.push({ g, l, r, ph: i * 1.7, sp: 0.6 + (i % 3) * 0.18 });
      }
    }

    // ---------- the buddy ----------
    const me = await Character.create(o.buddy);
    if (me) {
      me.root.visible = false;
      stage.scene.add(me.root);
      me.play('idle', 0);
      void dressUp(me);
      void me.loadMoves();
      sc.me = me;
      const start = new THREE.Vector3(places[sc.plot].x - 2, 0, places[sc.plot].z + PATH_Z);
      me.root.position.copy(start); sc.walk.to.copy(start);
    }
    sc.solids = solids; sc.boxes = boxes;
    await sc.secretsUp({ root, keep, hill: !!hill, mush, boulder, planksTex, postTex, rockTex, tealTex, dirtTex, leafTex, budTex, headTex, name: o.name ?? '', blooms: o.blooms ?? 0, buddy: o.buddy });
    await sleep(0);
    return sc;
  }

  // ---------- the surprises around the island ----------
  private async secretsUp(k: {
    root: THREE.Group; keep: <T extends { dispose(): void }>(x: T) => T; hill: boolean; mush: THREE.Object3D | null; boulder: THREE.Object3D | null;
    planksTex: THREE.Texture | null; postTex: THREE.Texture | null; rockTex: THREE.Texture | null; tealTex: THREE.Texture | null; dirtTex: THREE.Texture | null;
    leafTex: THREE.Texture | null; budTex: THREE.Texture | null; headTex: THREE.Texture | null; name: string; blooms: number; buddy: FriendId;
  }) {
    const { root, keep } = k;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const canvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
      const t = keep(new THREE.CanvasTexture(c)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    };
    const tiled = (t: THREE.Texture | null, rx: number, ry: number, rot = 0) => {
      if (!t) return null;
      const c = keep(t.clone()); c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); c.center.set(0.5, 0.5); c.rotation = rot; c.needsUpdate = true; return c;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => { const o = new THREE.Mesh(keep(g), m); o.position.set(x, y, z); o.castShadow = shadow; o.receiveShadow = true; return o; };
    const say = (text: string) => this.onSay?.(text);
    const nearBuddy = () => this.me?.root.position ?? V(0, 0, 0);
    const postMat = keep(new THREE.MeshStandardMaterial({ map: tiled(k.postTex, 1, 2), roughness: 0.9 }));

    // the little house: its round door opens when you walk up, and the Seed Library's keeper hops out
    if (k.hill) {
      const DOOR_R = 0.8, DOOR_Y = 1.3, DOOR_Z = -23.62;
      // inside: a warm room with shelves of seed jars (the Seed Library)
      const inside = mesh(new THREE.CircleGeometry(DOOR_R * 0.97, 40), keep(new THREE.MeshBasicMaterial({ map: canvasTex(256, 256, g => {
        const gr = g.createRadialGradient(128, 150, 8, 128, 128, 128); gr.addColorStop(0, '#ffdca0'); gr.addColorStop(0.4, '#d98a3c'); gr.addColorStop(0.8, '#5a2f16'); gr.addColorStop(1, '#2a160c');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        const jar = ['#7fd48a', '#ffb3d1', '#ffe07a', '#9fd0ff', '#c9a2ff', '#ff9f6b'];
        for (const [y, n] of [[92, 7], [150, 8], [206, 6]] as [number, number][]) {
          g.fillStyle = '#6b3e1f'; g.fillRect(28, y, 200, 9); g.fillStyle = 'rgba(255,220,160,.35)'; g.fillRect(28, y, 200, 2);
          for (let i = 0; i < n; i++) {
            const x = 128 - (n - 1) * 13 + i * 26, h = 20 + ((i * 7 + y) % 9);
            g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.roundRect(x - 9, y - h, 18, h, 5); g.fill();
            g.fillStyle = jar[(i + y) % jar.length]; g.beginPath(); g.roundRect(x - 7, y - h * 0.6, 14, h * 0.6 - 1, 3); g.fill();
            g.fillStyle = '#8a5a2b'; g.fillRect(x - 8, y - h - 4, 16, 5);
          }
        }
      }) })), 0, DOOR_Y, DOOR_Z - 0.06, false);
      root.add(inside);
      const hinge = new THREE.Group(); hinge.position.set(-DOOR_R, DOOR_Y, DOOR_Z); root.add(hinge);
      const doorMat = keep(new THREE.MeshStandardMaterial({ map: tiled(k.planksTex, 1, 1, Math.PI / 2), color: 0x7cc47a, roughness: 0.8 }));
      hinge.add(mesh(new THREE.CylinderGeometry(DOOR_R, DOOR_R, 0.08, 40).rotateX(Math.PI / 2), doorMat, DOOR_R, 0, 0));
      hinge.add(mesh(new THREE.TorusGeometry(DOOR_R, 0.05, 8, 40), keep(new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.7 })), DOOR_R, 0, 0.04));
      hinge.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), keep(new THREE.MeshStandardMaterial({ color: 0xf2c14e, metalness: 0.7, roughness: 0.3 })), DOOR_R + 0.5, 0, 0.1));
      const light = new THREE.PointLight(0xffb060, 0, 6, 1.6); light.position.set(0, DOOR_Y, DOOR_Z + 0.6); root.add(light);
      const keeper = await GlimmerModel.create('sproutbun', 0.7).catch(() => null);
      if (keeper) { keeper.root.visible = false; root.add(keeper.root); }
      let open = 0, want = 0, out = 0, outWant = 0;
      this.secrets.push({
        at: V(0, 0, -22.4), r: 3.2, away: 7, armed: true,
        fire: () => {
          want = 1; outWant = 1; sfx.secret();
          setTimeout(() => say(`Shh... this is the Seed Library! Every fact you learn starts as one of these seeds.`), 700);
          this.onSecret?.('hut');
          if (keeper) { keeper.root.visible = true; keeper.play('appear'); }
        },
        tick: (dt, t) => {
          // close up again once you've wandered off
          if (want && nearBuddy().distanceTo(V(0, 0, -22.4)) > 7) { want = 0; outWant = 0; }
          open += (want - open) * Math.min(1, dt * 3);
          hinge.rotation.y = -1.75 * open;
          light.intensity = 2.4 * open;
          out += (outWant - out) * Math.min(1, dt * (outWant ? 1.6 : 3));
          if (keeper) {
            // out of the door and over to the right, so it stands beside the buddy (not behind it)
            keeper.root.position.set(0.25 + out * 0.95, Math.sin(Math.min(1, out) * Math.PI) * 0.35, DOOR_Z + 0.25 + out * 1.85);
            keeper.root.visible = out > 0.03 || outWant > 0;
            keeper.face = this.me ? this.me.root.position.clone() : null;
            if (outWant && out > 0.9 && Math.random() < dt * 0.4) keeper.play('happy');
            keeper.update(dt, t);
          }
        },
      });
    }

    // the pond: a frog on a lily pad that plops in when you come close, and pops back up later
    {
      const C = V(-13, 0, -23), PR = 2.3;
      const water = mesh(new THREE.CircleGeometry(PR, 48).rotateX(-Math.PI / 2), keep(new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, g => {
        const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128); gr.addColorStop(0, '#2f8fc8'); gr.addColorStop(0.75, '#5cc0e6'); gr.addColorStop(1, '#a8e6f4');
        g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 5; g.lineCap = 'round';
        for (const [x, y, r, a0] of [[90, 80, 40, 3.6], [170, 150, 30, 0.3], [120, 190, 22, 2.2], [190, 70, 18, 4.2]]) { g.beginPath(); g.arc(x, y, r, a0, a0 + 1.2); g.stroke(); }
      }), roughness: 0.12, metalness: 0.05, polygonOffset: true, polygonOffsetFactor: -3 })), C.x, 0.03, C.z, false);
      root.add(water);
      root.add(mesh(new THREE.RingGeometry(PR - 0.02, PR + 0.4, 48).rotateX(-Math.PI / 2), keep(new THREE.MeshStandardMaterial({ map: tiled(k.dirtTex, 3, 3), color: 0xf0dcb8, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })), C.x, 0.02, C.z, false));
      if (k.boulder) for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2 + 0.2, b = k.boulder.clone(true); b.position.set(C.x + Math.cos(a) * (PR + 0.32), -0.05, C.z + Math.sin(a) * (PR + 0.32)); b.scale.setScalar(0.24 + ((i * 7) % 5) * 0.04); b.rotation.y = i * 1.7; root.add(b); }
      const padMat = keep(new THREE.MeshStandardMaterial({ color: 0x5cb85c, roughness: 0.6, side: THREE.DoubleSide }));
      const pads = [V(-12.1, 0.05, -22.3), V(-13.9, 0.05, -23.7), V(-12.6, 0.05, -24.2)];
      pads.forEach((pp, i) => { const m = mesh(new THREE.CircleGeometry(0.36, 24, 0.3, Math.PI * 2 - 0.6).rotateX(-Math.PI / 2), padMat, pp.x, pp.y, pp.z, false); m.rotation.y = i * 2.1; root.add(m); });
      root.add(mesh(new THREE.ConeGeometry(0.09, 0.14, 8).translate(0, 0.07, 0), keep(new THREE.MeshStandardMaterial({ color: 0xff9ac6, roughness: 0.5 })), -13.75, 0.05, -23.55));
      // (the pond and the ring of stones round it)
      this.solids.push({ x: C.x, z: C.z, r: PR + 0.75 });
      const frog = await GlimmerModel.create('rainbootfrog', 0.5).catch(() => null);
      let pad = 0, jump = -1, gone = 0;
      if (frog) { frog.root.position.copy(pads[0]); frog.root.rotation.y = 0.6; root.add(frog.root); }
      this.secrets.push({
        at: C, r: PR + 1.6, away: PR + 5, armed: true,
        fire: () => { if (!frog || jump >= 0 || gone > 0) return; jump = 0; sfx.boink(); setTimeout(() => say('Plop! The frog was a bit shy. Wait and see...'), 600); },
        tick: (dt, t) => {
          water.rotation.y += dt * 0.05;
          if (!frog) return;
          if (jump >= 0) {
            jump += dt / 0.6;
            const from = pads[pad], to = C.clone().setY(0.05), k2 = Math.min(1, jump);
            frog.root.position.lerpVectors(from, to, k2); frog.root.position.y = 0.05 + Math.sin(k2 * Math.PI) * 0.9;
            if (jump >= 1) { jump = -1; gone = 4.5; frog.root.visible = false; sfx.splashSmall(1); this.fx.emit({ at: to.clone().setY(0.1), count: 36, shape: ['drop', 'ring'], color: [0xbfeaff, 0xffffff], speed: [1, 3], up: 2.2, life: [0.5, 0.9], size: [0.06, 0.14], gravity: 6, drag: 1 }); }
          } else if (gone > 0) {
            gone -= dt;
            if (gone <= 0) { pad = (pad + 1) % pads.length; frog.root.position.copy(pads[pad]); frog.root.visible = true; frog.play('appear'); sfx.pop(); this.fx.emit({ at: pads[pad].clone().setY(0.1), count: 14, shape: 'drop', color: 0xbfeaff, speed: [0.5, 1.5], up: 1.6, life: [0.4, 0.7], size: [0.05, 0.1], gravity: 5 }); }
          } else if (Math.random() < dt * 0.15) frog.play('hop');
          frog.face = this.me ? this.me.root.position.clone() : null;
          frog.update(dt, t);
        },
      });
    }

    // the wishing well: say hello and it says your name back, quieter and quieter
    {
      const W = new THREE.Group(); W.position.set(13, 0, -22.5); W.rotation.y = -0.5; root.add(W);
      const rockMat = keep(new THREE.MeshStandardMaterial({ map: tiled(k.rockTex, 3, 1), color: 0xe6dccb, roughness: 0.95, side: THREE.DoubleSide }));
      W.add(mesh(new THREE.CylinderGeometry(0.78, 0.84, 0.85, 22, 1, true).translate(0, 0.425, 0), rockMat));
      W.add(mesh(new THREE.TorusGeometry(0.8, 0.1, 8, 26).rotateX(Math.PI / 2), rockMat, 0, 0.86, 0));
      W.add(mesh(new THREE.CircleGeometry(0.74, 24).rotateX(-Math.PI / 2), keep(new THREE.MeshStandardMaterial({ color: 0x1c3b52, roughness: 0.15, emissive: 0x0a2236 })), 0, 0.5, 0, false));
      for (const x of [-0.92, 0.92]) W.add(mesh(new THREE.BoxGeometry(0.11, 2.0, 0.11), postMat, x, 1.0, 0));
      const roofMat = keep(new THREE.MeshStandardMaterial({ map: tiled(k.planksTex, 2, 1), color: 0xd98a5a, roughness: 0.85 }));
      for (const sgn of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(2.2, 0.06, 0.82), roofMat, 0, 2.08, sgn * 0.3); r.rotation.x = sgn * 0.62; W.add(r); }
      W.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.84, 10).rotateZ(Math.PI / 2), postMat, 0, 1.45, 0));
      W.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.4, 5), keep(new THREE.MeshStandardMaterial({ color: 0xc9a46a })), 0, 1.24, 0));
      W.add(mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.22, 14), keep(new THREE.MeshStandardMaterial({ map: tiled(k.planksTex, 1, 1, Math.PI / 2), color: 0xb98a5a, roughness: 0.8 })), 0, 0.95, 0));
      this.solids.push({ x: 13, z: -22.5, r: 1.05 });
      const nm = k.name || 'friend';
      this.secrets.push({
        at: V(13, 0, -22.5), r: 2.4, away: 5, armed: true,
        fire: () => {
          say(`Hello, ${nm}!`); sfx.twinkle();
          setTimeout(() => say(`...hello, ${nm}...`), 1300);
          setTimeout(() => say(`...${nm.toLowerCase()}...`), 2600);
          setTimeout(() => say(`...${nm.toLowerCase().slice(0, Math.max(2, Math.ceil(nm.length / 2)))}...`), 3800);
        },
      });
    }

    // the scarecrow: it wears whatever hat your buddy has on
    {
      const S = new THREE.Group(); S.position.set(-6, 0, -19.4); S.rotation.y = 0.35; root.add(S);
      const plaid = canvasTex(128, 128, g => {
        g.fillStyle = '#d9483b'; g.fillRect(0, 0, 128, 128);
        g.fillStyle = 'rgba(255,214,90,.55)'; for (let i = 0; i < 128; i += 32) { g.fillRect(i + 10, 0, 10, 128); g.fillRect(0, i + 10, 128, 10); }
        g.fillStyle = 'rgba(60,20,20,.35)'; for (let i = 0; i < 128; i += 32) { g.fillRect(i + 24, 0, 4, 128); g.fillRect(0, i + 24, 128, 4); }
      });
      plaid.wrapS = plaid.wrapT = THREE.RepeatWrapping; plaid.repeat.set(2, 2);
      const cloth = keep(new THREE.MeshStandardMaterial({ map: plaid, roughness: 0.9 }));
      const straw = keep(new THREE.MeshStandardMaterial({ color: 0xe9c75e, roughness: 0.9 }));
      S.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.1, 8), postMat, 0, 1.05, -0.05));
      const body = new THREE.Group(); S.add(body);
      body.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.72, 12), cloth, 0, 1.33, 0));
      body.add(mesh(new THREE.CylinderGeometry(0.11, 0.12, 1.5, 10).rotateZ(Math.PI / 2), cloth, 0, 1.58, 0));
      for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) body.add(mesh(new THREE.ConeGeometry(0.05, 0.22, 6).rotateZ(-sx * Math.PI / 2), straw, sx * (0.86 + i * 0.02), 1.58 + (i - 1) * 0.06, (i - 1) * 0.04));
      for (let i = 0; i < 5; i++) body.add(mesh(new THREE.ConeGeometry(0.05, 0.24, 6).rotateX(Math.PI), straw, -0.2 + i * 0.1, 0.92, 0.05 * ((i % 2) * 2 - 1)));
      const head = new THREE.Group(); head.position.set(0, 2.0, 0); body.add(head);
      head.add(mesh(new THREE.SphereGeometry(0.27, 18, 14), keep(new THREE.MeshStandardMaterial({ map: tiled(k.dirtTex, 1, 1), color: 0xf2dcae, roughness: 1 }))));
      const face = mesh(new THREE.PlaneGeometry(0.44, 0.44), keep(new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, g => {
        g.fillStyle = '#3a2416'; for (const x of [42, 86]) { g.beginPath(); g.arc(x, 54, 9, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,120,120,.45)'; for (const x of [30, 98]) { g.beginPath(); g.arc(x, 74, 10, 0, 7); g.fill(); }
        g.strokeStyle = '#3a2416'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(64, 70, 22, 0.25, Math.PI - 0.25); g.stroke();
        for (let i = 0; i < 6; i++) { const a = 0.35 + i * 0.48; g.beginPath(); g.moveTo(64 + Math.cos(a) * 18, 70 + Math.sin(a) * 18); g.lineTo(64 + Math.cos(a) * 27, 70 + Math.sin(a) * 27); g.stroke(); }
      }), transparent: true, alphaTest: 0.2 })), 0, 0, 0.255, false);
      head.add(face);
      this.solids.push({ x: -6, z: -19.4, r: 0.45 });
      const hatId = savedDress(k.buddy)?.hat;
      const hat = hatId && hatId !== 'none' ? await makeOutfit(hatId).catch(() => null) : null;
      if (hat) {
        const box = new THREE.Box3().setFromObject(hat), size = box.getSize(new THREE.Vector3());
        const sc2 = (0.6 * ((hat.userData.fit as number) ?? 0.9) / 0.9) / Math.max(1e-4, Math.max(size.x, size.z));
        hat.scale.setScalar(sc2);
        hat.position.set(-(box.min.x + box.max.x) / 2 * sc2, 0.2 - box.min.y * sc2 - size.y * sc2 * ((hat.userData.sink as number) ?? 0.25) * 0.6, -(box.min.z + box.max.z) / 2 * sc2);
        hat.traverse(m => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });
        head.add(hat);
      }
      let wob = 0;
      this.secrets.push({
        at: V(-6, 0, -19.4), r: 2.6, away: 6, armed: true,
        fire: () => { wob = 1.6; sfx.giggle(); say(hat ? 'The scarecrow copied your hat! It thinks it looks great.' : 'The scarecrow wants a hat like yours. Put one on in the Wardrobe and see!'); },
        tick: (dt, t) => {
          wob = Math.max(0, wob - dt);
          body.rotation.z = Math.sin(t * 9) * 0.08 * wob;
          // the head turns to watch the buddy go by
          const b = nearBuddy(), local = S.worldToLocal(b.clone());
          const want = Math.max(-0.9, Math.min(0.9, Math.atan2(local.x, local.z)));
          head.rotation.y += (want - head.rotation.y) * Math.min(1, dt * 2);
        },
      });
    }

    // a big bouncy mushroom: walk onto it and boing
    if (k.mush) {
      const M = k.mush.clone(true); M.position.set(6, 0, -19.8); M.scale.setScalar(2.3); M.rotation.y = 0.8; root.add(M);
      for (const [dx, dz, s] of [[0.9, 0.5, 0.9], [-0.7, 0.8, 0.7], [0.5, -0.9, 0.8]]) { const c = k.mush.clone(true); c.position.set(6 + dx, 0, -19.8 + dz); c.scale.setScalar(s); c.rotation.y = dx * 3; root.add(c); }
      let squash = 0;
      // you bump into it (it's solid) and boing up off its cap
      this.solids.push({ x: 6, z: -19.8, r: 0.75 });
      this.secrets.push({
        at: V(6, 0, -19.8), r: 1.25, away: 2.2, armed: true,
        fire: () => { squash = 1; this.bounce(); say(['Boing!', 'Boing boing!', 'Wheee!'][Math.floor(Math.random() * 3)]); },
        tick: (dt) => { squash = Math.max(0, squash - dt * 2.5); M.scale.set(2.3 * (1 + 0.12 * squash), 2.3 * (1 - 0.25 * Math.sin(squash * Math.PI)), 2.3 * (1 + 0.12 * squash)); },
      });
    }

    // a golden flower behind the little house: it opens for gardeners with 10 flowers in bloom
    {
      const G = new THREE.Group(); G.position.set(2.6, 0, -34.4); G.scale.setScalar(1.7); root.add(G);
      // a little ring of pebbles round it, so it looks planted on purpose
      if (k.boulder) for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, b = k.boulder.clone(true); b.position.set(2.6 + Math.cos(a) * 0.75, -0.04, -34.4 + Math.sin(a) * 0.75); b.scale.setScalar(0.16); b.rotation.y = i; root.add(b); }
      const open = k.blooms >= 10;
      G.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, 1, 6).translate(0, 0.5, 0), keep(new THREE.MeshStandardMaterial({ color: 0x4fae5c, roughness: 0.7 }))));
      const leafMat = keep(new THREE.MeshStandardMaterial({ map: k.leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.65 }));
      G.add(mesh(crossCards(0.7, 0.6), leafMat));
      const gold = keep(new THREE.MeshStandardMaterial({ map: open ? k.headTex : k.budTex, color: 0xffd34d, emissive: 0x6b4a00, emissiveIntensity: 0.35, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.2 }));
      const top = open ? mesh(headCard(4, 0.85, 1.0), gold) : mesh(crossCards(0.4, 0.44, 0.78), gold);
      G.add(top);
      this.solids.push({ x: 2.6, z: -34.4, r: 0.85 });
      this.secrets.push({
        at: V(2.6, 0, -34.4), r: 2.2, away: 5, armed: true,
        fire: () => {
          if (open) { sfx.golden(); say('A golden flower! It only opens for gardeners with 10 flowers in bloom. That\'s you!'); this.fx.emit({ at: V(2.6, 1.1, -34.4), count: 40, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xffb02e], speed: [1, 3], up: 1.5, life: [0.6, 1.2], size: [0.08, 0.18], drag: 1.5 }); }
          else { sfx.sparkle(); say(`A golden bud... it opens when you have 10 flowers in bloom. You have ${k.blooms} so far!`); this.fx.emit({ at: V(2.6, 1.3, -34.4), count: 14, shape: 'spark', color: [0xffe066, 0xffffff], speed: [0.4, 1.2], up: 1, life: [0.5, 0.9], size: [0.05, 0.1], drag: 1.5 }); }
        },
        tick: (dt, t) => { top.rotation.y = Math.sin(t * 0.8) * 0.15; if (Math.random() < dt * (open ? 2.5 : 0.8)) this.fx.emit({ at: V(2.6 + (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 0.7, -34.4 + (Math.random() - 0.5) * 0.8), count: 1, shape: 'spark', color: [0xffe066, 0xffffff], speed: [0.1, 0.3], up: 0.6, life: [0.6, 1], size: [0.06, 0.11] }); },
      });
    }
  }

  // ---------- what the screen asks ----------
  /** Look at a plot (and one bed of it, or the whole plot). */
  show(plot: number, bed: number | null) {
    if (plot === this.plot && bed === this.bed && !this.free && this.walk.mode !== 'drive') return;
    // to another garden (the whole of it): keep the zoom and angle the camera has now; a bed is framed up close
    if (bed !== null) this.hold = null;
    else if (plot !== this.plot && this.camReady) this.hold = { off: this.camPos.clone().sub(this.camAim) };
    this.plot = plot; this.bed = bed; this.free = null; this.follow = false;
    this.input.x = this.input.z = 0; this.goto = null;
    this.near.plot = plot; this.near.bed = bed;
    // the buddy walks there the short way (runs if it's far), the camera following, and waters once it
    // arrives: along the aisle it's in, round the signs and the ends of the beds, never out to the front
    // and back. It waters a bed from whichever end is nearer.
    const me = this.me;
    if (!me) return;
    const X = this.px(plot), Z0 = this.pz(plot), at = me.root.position.clone().setY(0);
    if (bed === null) {
      this.walk.route = this.routeFrom(at, new THREE.Vector3(X - 1.5 + Math.random() * 2, 0, Z0 + PATH_Z));
      this.walk.face = Math.PI; this.walk.waterAt = null;
    } else {
      const z = Z0 + bedZ(bed), right = this.routeFrom(at, new THREE.Vector3(X + BED_L / 2 + 0.75, 0, z));
      // (the end with the signs: outside their posts)
      const left = this.routeFrom(at, new THREE.Vector3(X - BED_L / 2 - 1.05, 0, z));
      const signSide = routeLength(at, left) < routeLength(at, right) - 0.5;
      this.walk.route = signSide ? left : right;
      this.walk.face = signSide ? Math.PI / 2 : -Math.PI / 2;
      this.walk.waterAt = new THREE.Vector3(X + (signSide ? -1 : 1) * (BED_L / 2 - 0.35), 0, z);
    }
    this.walk.route = this.walk.route.filter(q => q.distanceTo(at) > 0.05);
    // a running speed for the whole trip: about three seconds there, however far (a walk if it's close)
    const total = routeLength(at, this.walk.route);
    this.walk.speed = Math.min(8, Math.max(3.2, total / 3));
    this.walk.mode = this.walk.route.length ? 'travel' : 'water';
    this.walk.until = this.now + 2.6;
    this.walk.began = this.now; this.walk.takes = total / this.walk.speed + 2.5; this.walk.rerouted = false;
    this.walk.check = this.now; this.walk.checkAt.copy(at);
  }
  /** The garden frames itself again (the "back to the bed" button). */
  resetView() { this.free = null; this.follow = false; this.hold = null; }
  /** Is the buddy being walked by you? */
  get walking() { return this.walk.mode === 'drive'; }

  // ---------- walking the buddy yourself ----------
  /** The keys or the pad: right (-1..1) and forward (-1..1), relative to the camera. Call every frame while
   *  held; 0, 0 lets go. */
  drive(x: number, z: number) {
    this.input.x = x; this.input.z = z;
    if (x || z) { this.goto = null; this.startDriving(); }
  }
  /** Tap on the ground: the buddy walks there (true if the tap landed on the island). */
  walkTo(clientX: number, clientY: number): boolean {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
    if (!p || Math.hypot(p.x, p.z) > this.walkR) return false;
    this.gotoWay = this.me ? this.routeFrom(this.me.root.position, this.resolve(p.setY(0))) : [p.setY(0)];
    this.goto = this.gotoWay.shift() ?? null; this.stuckT = 0; this.gotoAgain = true;
    this.startDriving();
    this.fx.emit({ at: p.clone().setY(0.08), count: 10, shape: 'ring', color: 0xffd34d, speed: [0.05, 0.2], life: [0.4, 0.6], size: [0.25, 0.4], drag: 2 });
    return true;
  }
  private startDriving() {
    if (this.walk.mode !== 'drive') { this.walk.mode = 'drive'; this.walk.waterAt = null; }
    if (!this.follow) {
      const f = this.steer();
      f.dist = Math.max(4.5, Math.min(9, f.dist)); f.pitch = 0.45;
      this.follow = true;
    }
  }
  /** Boing: the buddy bounces up off the big mushroom. */
  bounce() {
    if (this.hopT >= 0 || !this.me) return;
    this.hopT = 0; sfx.boink();
    const a = this.me.play(this.me.has('jump') ? 'jump' : 'cheer', 0.15); a?.reset();
    this.fx.emit({ at: this.me.root.position.clone().add(new THREE.Vector3(0, 0.4, 0)), count: 18, shape: ['star', 'dot'], color: [0xff6b6b, 0xffffff, 0xffd34d], speed: [1, 2.6], up: 1.5, life: [0.5, 0.9], size: [0.07, 0.15], drag: 1.6 });
  }
  /** Keep a spot out of the beds, the rocks, the trees, the pond and the house, and on the island. */
  private resolve(p: THREE.Vector3, r = BUDDY_R) { return resolveAt(p, this.solids, this.boxes, r, this.walkR); }
  /** The short way from here to a spot, as corners to walk through. */
  private routeFrom(at: THREE.Vector3, to: THREE.Vector3) {
    return findRoute(at, this.resolve(to.clone().setY(0)), this.solids, this.boxes, BUDDY_R, this.walkR).map(q => new THREE.Vector3(q.x, 0, q.z));
  }
  /** A step toward `dir` (unit, on the ground), sliding round whatever is in the way: how far it got. */
  private stepTo(p: THREE.Vector3, dir: THREE.Vector3, dist: number, r = BUDDY_R) { return stepAt(p, dir, dist, this.solids, this.boxes, r, this.walkR); }
  /** Is the player steering the camera? */
  get looking() { return this.free !== null; }
  /** Start steering from wherever the camera is, so nothing jumps. */
  private steer() {
    if (this.free) return this.free;
    const v = this.camPos.clone().sub(this.camAim), dist = Math.max(1, v.length());
    this.free = { target: this.camAim.clone(), dist, pitch: Math.asin(Math.min(1, Math.max(-1, v.y / dist))), yaw: Math.atan2(v.x, v.z) };
    this.hold = null;
    return this.free;
  }
  /** Drag: turn round the spot you're looking at (pixels). */
  orbit(dx: number, dy: number) {
    const f = this.steer();
    f.yaw -= dx * 0.006;
    f.pitch = Math.max(0.2, Math.min(1.35, f.pitch + dy * 0.005));
  }
  /** Pinch or scroll: closer or further (factor < 1 is closer), toward the point under the finger. */
  zoom(factor: number, clientX?: number, clientY?: number) {
    const f = this.steer(), was = f.dist;
    f.dist = Math.max(0.9, Math.min(42, f.dist * factor));
    if (clientX !== undefined && clientY !== undefined && f.dist < was) {
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
      const hitP = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -SOIL_Y), new THREE.Vector3());
      if (hitP) f.target.lerp(hitP.setY(f.target.y), 1 - f.dist / was);
    }
    this.clampFree();
  }
  /** Two fingers or a right-drag: slide over the garden (pixels). */
  pan(dx: number, dy: number) {
    const f = this.steer(), k = (2 * f.dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2))) / innerHeight;
    const right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw)), fwd = new THREE.Vector3(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
    f.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k / Math.max(0.35, Math.sin(f.pitch)));
    this.clampFree();
  }
  /** The arrows on screen: walk the view along (while held, every frame). */
  nudge(dir: 'up' | 'down' | 'left' | 'right', dt: number) {
    const f = this.steer(), sp = Math.max(1.6, f.dist * 0.55) * dt;
    const right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw)), fwd = new THREE.Vector3(-Math.sin(f.yaw), 0, -Math.cos(f.yaw));
    if (dir === 'up') f.target.addScaledVector(fwd, sp); else if (dir === 'down') f.target.addScaledVector(fwd, -sp);
    else if (dir === 'left') f.target.addScaledVector(right, -sp); else f.target.addScaledVector(right, sp);
    this.clampFree();
  }
  /** Never off the edge of the island, under it or lost in the sky. */
  private clampFree() {
    const f = this.free!;
    if (this.follow) { f.target.y = SOIL_Y + 0.1; return; }
    f.target.x = Math.max(-this.edge, Math.min(this.edge, f.target.x));
    f.target.z = Math.max(-30, Math.min(Math.max(...this.places.map(q => q.z)) + 7, f.target.z));
    f.target.y = SOIL_Y + 0.1;
  }
  /** Mark a plant (or nothing). */
  select(id: string | null) {
    const k = id === null ? -1 : this.hitIds.findIndex(h => h.id === id);
    this.selected = k >= 0 ? k : null;
    this.ring.visible = this.selected !== null;
    if (this.selected !== null) this.ring.position.copy(this.hitIds[this.selected].pos).setY(SOIL_Y + 0.02);
  }
  /** The plant (or the buddy) under a point on the screen. */
  pickAt(clientX: number, clientY: number): { id: string; plot: number; bed: number } | 'buddy' | null {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
    if (this.me) {
      const box = new THREE.Box3().setFromObject(this.me.root);
      if (ray.ray.intersectsBox(box)) { this.cheer(); return 'buddy'; }
    }
    const h = ray.intersectObject(this.hit, false)[0];
    if (!h || h.instanceId === undefined) return null;
    const x = this.hitIds[h.instanceId];
    return { id: x.id, plot: x.plot, bed: x.bed };
  }
  /** The buddy cheers (tapped, or a fact grew). */
  cheer() {
    const me = this.me;
    if (!me) return;
    const name = me.has('cheer') ? 'cheer' : me.has('jump') ? 'jump' : 'idle';
    const a = me.play(name, 0.2); a?.reset();
    this.walk.mode = 'water'; this.walk.until = this.now + 2.2;
    this.fx.emit({ at: me.root.position.clone().add(new THREE.Vector3(0, 1.2, 0)), count: 20, shape: ['heart', 'star'], color: [0xff8fc0, 0xffd34d, 0xffffff], speed: [0.8, 2.2], life: [0.6, 1.1], size: [0.1, 0.2], up: 1, drag: 1.5 });
  }
  /** Where a plant is on the screen (0..1), for its label. */
  screenOf(id: string, lift = 0.25): { x: number; y: number } | null {
    const h = this.hitIds.find(x => x.id === id);
    if (!h) return null;
    const v = h.pos.clone().setY(h.top + lift).project(stage.camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
  }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.now = t;
    if (this.started < 0) this.started = t;
    this.u.uT.value = t;
    // growth since the last visit pops in, one plant after another, each with a little burst
    for (const g of this.growing) {
      if (g.done) continue;
      const k = (t - this.started - 0.9 - g.at * this.popGap) / 0.55;
      if (k < 0) continue;
      const s = k >= 1 ? 1 : 1 + Math.sin(k * Math.PI) * 0.35 - (1 - k) * 1 * (1 - k);
      const sc = Math.max(0, Math.min(1.3, k >= 1 ? 1 : s * Math.min(1, k * 1.6)));
      for (const sl of g.slots) { sl.mesh.setMatrixAt(sl.i, sl.base.clone().multiply(new THREE.Matrix4().makeScale(sc, sc, sc))); sl.mesh.instanceMatrix.needsUpdate = true; }
      if (!g.done && k >= 1) {
        g.done = true;
        this.fx.emit({ at: g.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), count: 14, shape: ['star', 'dot'], color: [0xfff2a8, 0xffffff, 0xb8ffcf], speed: [0.4, 1.4], life: [0.4, 0.8], size: [0.05, 0.12], up: 1, drag: 2 });
      }
    }
    // water drops bob over the plants that are due a check-up, always facing the camera
    if (this.drops && this.drops.at.length) {
      const m = new THREE.Matrix4(), cq = stage.camera.quaternion;
      this.drops.at.forEach((p, i) => { m.compose(p.clone().setY(p.y + Math.sin(t * 2.4 + i) * 0.035), cq, new THREE.Vector3(1, 1, 1)); this.drops!.mesh.setMatrixAt(i, m); });
      this.drops.mesh.instanceMatrix.needsUpdate = true;
    }
    this.bedGlow.visible = this.bed !== null;
    if (this.bed !== null) { this.bedGlow.position.set(this.px(this.plot), BED_H + 0.02, this.pz(this.plot) + bedZ(this.bed)); (this.bedGlow.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.3; }
    if (this.ring.visible) { this.ring.position.y = SOIL_Y + 0.03 + Math.sin(t * 3) * 0.015; this.ring.rotation.z = t * 0.8; }
    this.butterflyFly(t);
    this.buddy(dt, t);
    for (const s of this.secrets) s.tick?.(dt, t);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
    this.fx.update(dt, t);
    this.camera(dt, t);
    // the sun's shadows follow where the camera looks
    const f = this.focus(), dir = this.sun.userData.dir as THREE.Vector3;
    this.sun.position.copy(f).addScaledVector(dir, 60); this.sun.target.position.copy(f);
  }

  private butterflyFly(t: number) {
    const X = this.px(this.plot), Z0 = this.pz(this.plot), nb = this.plots[this.plot]?.beds.length ?? 11;
    this.butterflies.forEach((b, i) => {
      const tt = t * b.sp + b.ph;
      const p = new THREE.Vector3(X + Math.sin(tt * 0.7) * (BED_L / 2 + 0.6) + Math.sin(tt * 2.1) * 0.3, 0.75 + Math.sin(tt * 1.3) * 0.35 + (i % 2) * 0.3, Z0 - ((nb - 1) * ROW) / 2 + Math.cos(tt * 0.5 + i) * ((nb * ROW) / 2) + Math.cos(tt * 1.7) * 0.3);
      const prev = b.g.position.clone();
      b.g.position.copy(p);
      const v = p.clone().sub(prev);
      if (v.lengthSq() > 1e-6) b.g.rotation.y = Math.atan2(v.x, v.z);
      const flap = Math.sin(t * 16 + b.ph) * 0.9;
      b.l.rotation.z = -flap; b.r.rotation.z = flap;
    });
  }

  /** The buddy walks the path in front of the plot, stops by a bed and waters it, now and then. */
  private buddy(dt: number, t: number) {
    const me = this.me;
    if (!me) return;
    if (!me.root.visible) me.root.visible = true;
    const w = this.walk, X = this.px(this.plot), Z0 = this.pz(this.plot);
    const turnTo = (a: number, k: number) => { const d = Math.atan2(Math.sin(a - me.root.rotation.y), Math.cos(a - me.root.rotation.y)); me.root.rotation.y += d * Math.min(1, dt * k); };
    if (w.mode === 'travel') {
      // along the route: running while there's a long way to go, walking the last few metres, sliding round
      // anything in the way (never through it). Not getting any closer for a moment: it finds another way
      // from where it is. Stuck again, or a trip that runs long: a little hop and a puff, and it's there (a
      // rock in the way is never walked through)
      const still = t - w.check > 0.8 && me.root.position.distanceTo(w.checkAt) < 0.3;
      if (w.route.length && still && !w.rerouted) {
        w.rerouted = true;
        w.route = this.routeFrom(me.root.position, w.route[w.route.length - 1]);
        w.check = t; w.checkAt.copy(me.root.position);
      } else if (w.route.length && (still || t - w.began > w.takes)) {
        const end = w.route[w.route.length - 1];
        this.fx.emit({ at: me.root.position.clone().setY(0.3), count: 14, shape: ['dot', 'star'], color: [0xffffff, 0xfff2a8], speed: [0.5, 1.5], up: 1, life: [0.3, 0.6], size: [0.08, 0.16], drag: 2 });
        me.root.position.copy(end); w.route = [];
        this.fx.emit({ at: end.clone().setY(0.3), count: 14, shape: ['dot', 'star'], color: [0xffffff, 0xfff2a8], speed: [0.5, 1.5], up: 1, life: [0.3, 0.6], size: [0.08, 0.16], drag: 2 });
      }
      if (t - w.check > 0.8) { w.check = t; w.checkAt.copy(me.root.position); }
      const next = w.route[0];
      if (!next) { w.mode = 'water'; w.until = t + 2.6; }
      else {
        const d = next.clone().sub(me.root.position); d.y = 0;
        const len = d.length();
        const left = len + w.route.slice(1).reduce((a, q, i) => a + q.distanceTo(w.route[i]), 0);
        // run (faster for a longer trip), slowing to a walk for the last couple of metres
        const run = left > 2.5 && me.has('run'), speed = run ? w.speed : 1.1 + Math.max(0, w.speed - 1.1) * Math.min(1, left / 2.5) * 0.4;
        if (len < 0.05) w.route.shift();
        else {
          // (the length first: normalising first made every step a whole metre, so it overshot and ran on
          // the spot either side of the corner for ever)
          this.stepTo(me.root.position.setY(0), d.multiplyScalar(1 / len), Math.min(len, dt * speed), 0.25);
          turnTo(Math.atan2(d.x, d.z), 10);
          const gait = run ? (speed > 4.8 && me.has('sprint') ? 'sprint' : 'run') : 'walk';
          me.play(gait, 0.25);
          const a = me.actions[gait]; if (a) a.timeScale = Math.max(0.6, Math.min(2, speed / (me.speedOf[gait] || speed)));
        }
      }
    } else if (w.mode === 'drive') {
      // walked by you: the keys or pad move it round the camera's way, a tapped spot draws it there
      let dir: THREE.Vector3 | null = null, speed = 0;
      const inp = this.input;
      if (inp.x || inp.z) {
        const yaw = this.free ? this.free.yaw : Math.atan2(this.camPos.x - this.camAim.x, this.camPos.z - this.camAim.z);
        const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        dir = fwd.multiplyScalar(inp.z).addScaledVector(right, inp.x);
        const m = Math.min(1, dir.length()); dir.normalize(); speed = 3.3 * m;
      } else if (this.goto) {
        const d = this.goto.clone().sub(me.root.position); d.y = 0;
        const len = d.length(), left = len + routeLength(this.goto, this.gotoWay);
        if (len < 0.15) this.goto = this.gotoWay.shift() ?? null;
        else { dir = d.multiplyScalar(1 / len); speed = left > 2.2 ? 3.3 : 1.2 + left; }
      }
      if (dir && speed > 0) {
        // a step, sliding along a rock or a bed instead of stopping dead (and never ending up inside one)
        const moved = this.stepTo(me.root.position.setY(0), dir, speed * dt);
        // walking into a wall toward a tapped spot: another way from here, and if that fails too, stop there
        if (this.goto) {
          this.stuckT = moved < speed * dt * 0.25 ? this.stuckT + dt : 0;
          if (this.stuckT > 0.6) {
            const end = this.gotoWay[this.gotoWay.length - 1] ?? this.goto;
            this.gotoWay = this.gotoAgain ? this.routeFrom(me.root.position, end) : [];
            this.goto = this.gotoWay.shift() ?? null;
            this.gotoAgain = false; this.stuckT = 0;
          }
        }
        turnTo(Math.atan2(dir.x, dir.z), 12);
        const run = speed > 2.2 && me.has('run'), gait = run ? 'run' : 'walk';
        me.play(gait, 0.2);
        const a = me.actions[gait]; if (a) a.timeScale = Math.max(0.6, Math.min(2, Math.max(0.3, moved / Math.max(1e-4, dt)) / (me.speedOf[gait] || speed)));
      } else if (this.hopT < 0) me.play('idle', 0.3);
    } else if (w.mode === 'idle') {
      w.wait -= dt;
      // with a bed chosen the buddy stays by it; otherwise it potters along the path in front of the plot
      if (w.wait <= 0) {
        if (this.bed === null) { w.to.set(X - BED_L / 2 + 0.6 + Math.random() * (BED_L - 1.2), 0, Z0 + PATH_Z + (Math.random() - 0.5) * 0.4); w.mode = 'walk'; }
        else { w.mode = 'water'; w.until = t + 2.4; }
      }
      me.play('idle', 0.4);
      turnTo(w.face, 3);
    } else if (w.mode === 'walk') {
      const d = w.to.clone().sub(me.root.position); d.y = 0;
      const dist = d.length();
      if (dist < 0.06) {
        w.mode = 'water'; w.until = t + 2.4;
        const a = me.play(me.has('wave1') && Math.random() < 0.3 ? 'wave1' : 'idle', 0.3); a?.reset();
      } else {
        const step = Math.min(dist, dt * 1.05);
        me.root.position.addScaledVector(d.normalize(), step);
        turnTo(Math.atan2(d.x, d.z), 10);
        w.face = Math.PI;
        me.play('walk', 0.3);
        const a = me.actions.walk; if (a) a.timeScale = Math.max(0.6, 1.05 / (me.speedOf.walk || 1));
      }
    } else {
      // watering: turn to the bed, a shower of drops over it (the chosen bed's end, or the front bed by the buddy)
      turnTo(w.face, 4);
      me.play('idle', 0.4);
      const wa = w.waterAt ?? new THREE.Vector3(me.root.position.x, 0, Z0 + bedZ(0));
      if (Math.random() < dt * 12) this.fx.emit({ at: new THREE.Vector3(wa.x + (Math.random() - 0.5) * 0.9, 1.1, wa.z + (Math.random() - 0.5) * 0.4), count: 2, shape: 'dot', color: [0x9fdcff, 0xd8f2ff], speed: [0.2, 0.6], dir: new THREE.Vector3(0, -1, 0), spread: 0.4, life: [0.5, 0.8], size: [0.04, 0.07], gravity: 2.5 });
      if (t > w.until) { w.mode = 'idle'; w.wait = 2 + Math.random() * 4; }
    }
    // boing: up off the mushroom and down again
    if (this.hopT >= 0) {
      this.hopT += dt;
      const k = this.hopT / 0.95;
      me.root.position.y = k < 1 ? Math.sin(k * Math.PI) * 1.5 : 0;
      if (k >= 1) this.hopT = -1;
    } else if (me.root.position.y !== 0) me.root.position.y = 0;
    me.update(dt);
    this.track(t);
  }

  /** Where the buddy is: its plot and bed and the plant beside it (for the screen), and the surprises
   *  it walks up to. Only while you're walking it yourself. */
  private track(t: number) {
    const me = this.me;
    if (!me || this.walk.mode !== 'drive') return;
    const p = me.root.position, NP = this.plots.length;
    // the plot: the nearest one, once you're close to its beds
    let plot = this.near.plot < 0 ? this.plot : this.near.plot, bed: number | null = null;
    for (let pi = 0; pi < NP; pi++) { const q = this.places[pi], deep = plotDepth(this.plots[pi].beds.length); if (Math.abs(p.x - q.x) < BED_L / 2 + 2.5 && p.z > q.z - deep - 3 && p.z < q.z + PATH_Z + 2) { plot = pi; break; } }
    const X = this.px(plot), Z0 = this.pz(plot), nb = this.plots[plot]?.beds.length ?? 0;
    if (Math.abs(p.x - X) < BED_L / 2 + 1.3) for (let j = 0; j < nb; j++) if (Math.abs(p.z - (Z0 + bedZ(j))) < ROW / 2 + (j === 0 ? 0.6 : 0)) { bed = j; break; }
    if (plot !== this.near.plot || bed !== this.near.bed) {
      this.near.plot = plot; this.near.bed = bed;
      this.plot = plot; if (bed !== null) this.bed = bed;
      this.onWhere?.(plot, bed);
    }
    // the plant it's standing by
    let best = -1, bd = 0.85;
    if (bed !== null) this.hitIds.forEach((h, i) => { if (h.plot !== plot || h.bed !== bed) return; const d = Math.hypot(h.pos.x - p.x, h.pos.z - p.z); if (d < bd) { bd = d; best = i; } });
    if (best !== this.near.plant) {
      // (it lets go of a plant a little further away than it picks one up, so it doesn't flicker)
      const cur = this.near.plant >= 0 ? this.hitIds[this.near.plant] : null;
      if (best >= 0 || !cur || Math.hypot(cur.pos.x - p.x, cur.pos.z - p.z) > 1.3) { this.near.plant = best; this.onNear?.(best >= 0 ? this.hitIds[best].id : null); }
    }
    // the surprises: each one goes off when you walk up, and again after you've wandered away
    for (const s of this.secrets) {
      const d = Math.hypot(p.x - s.at.x, p.z - s.at.z);
      if (s.armed && d < s.r) { s.armed = false; s.fire(); }
      else if (!s.armed && d > s.away) s.armed = true;
    }
    void t;
  }

  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    const X = this.px(this.plot), Z0 = this.pz(this.plot), nb = this.plots[this.plot]?.beds.length ?? 11;
    let center: THREE.Vector3, halfW: number, halfH: number, dir: THREE.Vector3;
    if (this.free) {
      // the player's camera: round the spot they're looking at, quick to answer a finger (and while you walk
      // the buddy, round the buddy)
      const f = this.free;
      if (this.follow && this.me) f.target.lerp(this.me.root.position.clone().setY(0.9 + this.me.root.position.y * 0.5), 1 - Math.exp(-dt * 7));
      const pos = f.target.clone().add(new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch)).multiplyScalar(f.dist));
      if (this.follow) {
        // walking among the trees: come in front of a trunk or a canopy instead of looking out from inside it
        const ax = f.target.x, az = f.target.z, dx = pos.x - ax, dz = pos.z - az, L2 = dx * dx + dz * dz;
        let u = 1;
        for (const s of this.solids) if (s.tall) {
          const R = s.r * 2.4, cx = ax - s.x, cz = az - s.z, b = cx * dx + cz * dz, c = cx * cx + cz * cz - R * R, disc = b * b - L2 * c;
          if (c > 0 && b < 0 && disc > 0) u = Math.min(u, (-b - Math.sqrt(disc)) / L2);
        }
        if (u < 1) pos.lerpVectors(f.target, pos, Math.max(u - 0.08, 2.4 / f.dist));
      }
      pos.y = Math.max(0.45, pos.y);
      const k = 1 - Math.exp(-dt * 9);
      this.camPos.lerp(pos, k); this.camAim.lerp(f.target, k);
      cam.position.copy(this.camPos); cam.lookAt(this.camAim);
      return;
    }
    if (this.hold) {
      // off to another garden at the zoom you had: follow the buddy on the way, then rest on the garden
      const off = this.hold.off, dist = off.length();
      const c = this.walk.mode === 'travel' && this.me
        ? this.me.root.position.clone().setY(0.6)
        : new THREE.Vector3(X - 0.3, 0.3, Z0 - ((nb - 1) * ROW) / 2 + 0.9);
      // (the same shift for the view band as below, so the garden sits where the screen leaves room)
      const look = off.clone().negate().normalize(), ndcX = (v.left + v.right) - 1, ndcY = 1 - (v.top + v.bottom);
      const right = new THREE.Vector3().crossVectors(look, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, look).normalize();
      const aim = c.addScaledVector(right, -ndcX * dist * tanH * cam.aspect).addScaledVector(up, -ndcY * dist * tanH);
      const k = 1 - Math.exp(-dt * (this.walk.mode === 'travel' ? 3.2 : 2.2));
      this.camAim.lerp(aim, k);
      // never so far behind that the buddy runs off the screen (however close the camera is)
      const lag = this.camAim.distanceTo(aim), most = 0.35 * dist * tanH;
      if (lag > most) this.camAim.lerp(aim, 1 - most / lag);
      this.camPos.copy(this.camAim).add(off);
      cam.position.copy(this.camPos); cam.lookAt(this.camAim);
      return;
    }
    if (this.walk.mode === 'travel' && this.me) {
      // on the way: keep the buddy in view, looking a little ahead to where it's going
      const ahead = this.walk.route[this.walk.route.length - 1] ?? this.me.root.position;
      center = this.me.root.position.clone().lerp(ahead, 0.25).setY(0.6);
      halfW = 4.2; halfH = 2.4;
      dir = new THREE.Vector3(0, 0.6, 0.8).normalize();
    } else if (this.bed === null) {
      // the whole plot from above the path, every bed and its sign in view
      center = new THREE.Vector3(X - 0.3, 0.3, Z0 - ((nb - 1) * ROW) / 2 + 0.9);
      halfW = BED_L / 2 + 1.0; halfH = (nb * ROW / 2 + 1.0) * 0.72 + 0.6;
      dir = new THREE.Vector3(0, 0.72, 0.7).normalize();
    } else {
      // one bed up close: its sign, its plants and the numbers along its front
      center = new THREE.Vector3(X - 0.35, SOIL_Y + 0.22, Z0 + bedZ(this.bed) + 0.05);
      halfW = BED_L / 2 + 0.95; halfH = 0.7;
      if (cam.aspect * bandW / bandH < 1) {
        const sel = this.selected !== null ? this.hitIds[this.selected] : null;
        halfW = 2.1; halfH = 1.0;
        center.x = sel && sel.bed === this.bed && sel.plot === this.plot ? sel.pos.x : X - BED_L / 2 + 1.6;
      }
      dir = new THREE.Vector3(0, 0.62, 1).normalize();
    }
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.12) * 0.06);
    const d = Math.max(halfW / (tanH * cam.aspect * bandW), halfH / (tanH * bandH)) * 1.04;
    const wantPos = center.clone().addScaledVector(dir, d);
    const aim = center.clone();
    // the view band isn't the middle of the screen (panels cover some of it): shift so it frames the band
    const ndcX = (v.left + v.right) - 1, ndcY = 1 - (v.top + v.bottom);
    const right = new THREE.Vector3().crossVectors(aim.clone().sub(wantPos).normalize(), new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, aim.clone().sub(wantPos).normalize()).normalize();
    aim.addScaledVector(right, -ndcX * d * tanH * cam.aspect).addScaledVector(up, -ndcY * d * tanH);
    wantPos.addScaledVector(right, -ndcX * d * tanH * cam.aspect).addScaledVector(up, -ndcY * d * tanH);
    if (!this.camReady) { this.camPos.copy(wantPos); this.camAim.copy(aim); this.camReady = true; }
    const k = 1 - Math.exp(-dt * 2.6);
    this.camPos.lerp(wantPos, k); this.camAim.lerp(aim, k);
    cam.position.copy(this.camPos); cam.lookAt(this.camAim);
  }

  /** where the sun's shadows go: where you're looking, or the buddy on its way, or the plot */
  focus() {
    if (this.follow && this.me) return this.me.root.position.clone().setY(0);
    if (this.free) return this.free.target.clone().setY(0);
    if (this.walk.mode === 'travel' && this.me) return this.me.root.position.clone().setY(0);
    return new THREE.Vector3(this.px(this.plot), 0, this.pz(this.plot) - 4);
  }
  dispose() {
    this.me?.dispose();
    this.fx.root.removeFromParent(); this.fx.dispose();
    this.island.root.removeFromParent();
    if (stage.island === this.island) stage.island = null;
    this.island.dispose();
  }
}

/** Ground positions, for checks. */
export const GARDEN_LAYOUT = { CELL, BED_L, ROW, PLOT_GAP, plotPlaces, bedZ, plantX };
