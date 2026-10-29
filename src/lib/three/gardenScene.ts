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
export type GPlot = { op: Op; title: string; sign: string; color: string; beds: GBed[] };

// ---------- the layout, in metres ----------
const CELL = 0.62;
const BED_L = 11 * CELL + 0.5;
const BED_D = 0.82, BED_H = 0.32, RIM = 0.07;
const SOIL_Y = BED_H - 0.05;
const ROW = 1.35;
const PLOT_GAP = 17;
const PATH_Z = 1.55;
const plotX = (i: number) => (i - 1.5) * PLOT_GAP;
const bedZ = (j: number) => -j * ROW;
const plantX = (c: number) => -BED_L / 2 + 0.25 + (c + 0.5) * CELL;
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
function textOn(x: CanvasRenderingContext2D, text: string, cx: number, cy: number, size: number, fill = '#fff8e6', stroke = '#5b3416') {
  x.font = `600 ${size}px ${fontUi()}`; x.textAlign = 'center'; x.textBaseline = 'middle';
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

export class GardenScene implements Controller {
  fps = 30;
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
  private walk = { to: new THREE.Vector3(), wait: 2, mode: 'idle' as 'idle' | 'walk' | 'water' | 'travel', until: 0, route: [] as THREE.Vector3[], face: Math.PI, waterAt: null as THREE.Vector3 | null, speed: 3.2 };
  /** the player's own camera (drag, pinch, the arrows), or null: the garden frames itself */
  private free: { target: THREE.Vector3; yaw: number; pitch: number; dist: number } | null = null;
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

  static async create(o: { plots: GPlot[]; buddy: FriendId; view: View; plot?: number }): Promise<GardenScene> {
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
    const T = { ...THEMES.village };
    const root = new THREE.Group();
    const rnd = rand(29);
    const base = import.meta.env.BASE_URL;
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
    const R = 46;
    if (grassTex) grassTex.repeat.set(26, 26);
    const ground = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 72)), keep(new THREE.MeshStandardMaterial({ map: grassTex, color: grassTex ? 0xf2ffe8 : 0x8fcf6e, roughness: 0.95 })));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
    if (rockTex) rockTex.repeat.set(10, 2);
    const skirt = new THREE.Mesh(keep(new THREE.CylinderGeometry(R, 7, 26, 56, 1, true)), keep(new THREE.MeshStandardMaterial({ map: rockTex, color: 0xd8c2a8, roughness: 0.95, side: THREE.DoubleSide })));
    skirt.position.y = -13; root.add(skirt);
    const pathMat = keep(new THREE.MeshStandardMaterial({ map: dirtTex, color: 0xf3e2c6, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }));
    const paths: THREE.BufferGeometry[] = [];
    const strip = (x0: number, z0: number, x1: number, z1: number, w: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), g = new THREE.PlaneGeometry(len, w, 1, 1);
      const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 2.2, uv.getY(i) * w / 2.2);
      g.rotateX(-Math.PI / 2); g.rotateY(-Math.atan2(z1 - z0, x1 - x0)); g.translate((x0 + x1) / 2, 0.01, (z0 + z1) / 2);
      paths.push(g);
    };
    strip(-38, PATH_Z, 38, PATH_Z, 1.7);
    for (const x of [0, -PLOT_GAP, PLOT_GAP]) strip(x, PATH_Z, x, -16, 1.3);
    strip(-9, -16.5, 9, -16.5, 1.3);
    strip(0, -16.5, 0, -23, 1.5);
    const pathMesh = new THREE.Mesh(keep(mergeGeometries(paths)!), pathMat); pathMesh.receiveShadow = true; root.add(pathMesh);
    paths.forEach(g => g.dispose());

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
      const X = plotX(pi);
      // the signs: one canvas for the plot, a row for each bed
      const sc = plankCanvas(512, 128 * pl.beds.length, planksImg), sx = sc.getContext('2d')!;
      const signGeo: THREE.BufferGeometry[] = [];
      pl.beds.forEach((bd, j) => {
        const Z = bedZ(j);
        const add = (list: THREE.BufferGeometry[], g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); list.push(g); };
        add(frames, tiledBox(BED_L, BED_H, RIM, 0.9), X, BED_H / 2, Z - BED_D / 2 + RIM / 2);
        add(frames, tiledBox(RIM, BED_H, BED_D - 2 * RIM, 0.9), X - BED_L / 2 + RIM / 2, BED_H / 2, Z);
        add(frames, tiledBox(RIM, BED_H, BED_D - 2 * RIM, 0.9), X + BED_L / 2 - RIM / 2, BED_H / 2, Z);
        const front = new THREE.BoxGeometry(BED_L, BED_H, RIM); add(fronts, front, X, BED_H / 2, Z + BED_D / 2 - RIM / 2);
        add(soils, tiledBox(BED_L - 2 * RIM, SOIL_Y, BED_D - 2 * RIM, 1.2), X, SOIL_Y / 2, Z);
        // the sign: a post and a board at the bed's left end, turned a little toward the path
        const sxp = X - BED_L / 2 - 0.62, szp = Z + 0.1;
        add(posts, new THREE.CylinderGeometry(0.04, 0.05, 0.66, 7), sxp, 0.33, szp);
        const row = j * 128;
        sx.save(); sx.strokeStyle = '#5b3416'; sx.lineWidth = 10; sx.strokeRect(5, row + 5, 502, 118); sx.restore();
        textOn(sx, bd.label, 256, row + 68, 96);
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
      textOn(tx, pl.title, 600, 132, 104);
      const tt = keep(new THREE.CanvasTexture(tc)); tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8;
      const title = new THREE.Mesh(keep(new THREE.PlaneGeometry(2.2, 0.55)), keep(new THREE.MeshStandardMaterial({ map: tt, roughness: 0.8 })));
      title.position.set(X - BED_L / 2 + 0.4, 1.05, PATH_Z + 1.25); title.rotation.y = 0.12; title.castShadow = true; root.add(title);
      for (const dx of [-0.95, 0.95]) posts.push(new THREE.CylinderGeometry(0.05, 0.06, 1.3, 7).translate(X - BED_L / 2 + 0.4 + dx * Math.cos(0.12), 0.65, PATH_Z + 1.2 - dx * Math.sin(0.12)));
    });
    for (const [list, mat] of [[frames, planksMat], [fronts, numMat], [soils, soilMat], [posts, postMat]] as const) {
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

    const all = o.plots.flatMap((pl, pi) => pl.beds.flatMap((bd, j) => bd.plants.map((pt, c) => ({ pt, pi, j, c, color: bd.color }))));
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
    for (const { pt, pi, j, c, color } of all) {
      const pos = new THREE.Vector3(plotX(pi) + plantX(c) + (prnd() - 0.5) * 0.05, SOIL_Y, bedZ(j) + (prnd() - 0.5) * 0.08);
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
    const clear = (x: number, z: number) => !(Math.abs(x) < 35 && z > -17.5 && z < 4.5) && !(Math.abs(x) < 6 && z < -16 && z > -28);
    const place = (m: THREE.Object3D | null, n: number, rMin: number, rMax: number, sMin: number, sMax: number) => {
      if (!m) return;
      for (let i = 0, tries = 0; i < n && tries < n * 30; tries++) {
        const a = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin), x = Math.cos(a) * r, z = Math.sin(a) * r - 6;
        if (!clear(x, z) || Math.hypot(x, z) > R - 2) continue;
        const c = m.clone(true); c.position.set(x, 0, z); c.scale.setScalar(sMin + rnd() * (sMax - sMin)); c.rotation.y = rnd() * 6.28; root.add(c); i++;
      }
    };
    place(puffy, 10, 18, 44, 0.8, 1.2); place(puffy2, 8, 18, 44, 0.8, 1.15); place(round, 8, 16, 42, 0.8, 1.2);
    place(bush, 28, 8, 44, 0.7, 1.4); place(boulder, 10, 10, 44, 0.6, 1.5); place(mush, 20, 6, 40, 0.6, 1.3);
    // a few bushes and mushrooms right by the beds (never on the paths)
    if (bush) for (let pi = 0; pi < o.plots.length; pi++) for (const [dx, dz] of [[BED_L / 2 + 2.1, -2], [BED_L / 2 + 2.2, -7.5], [-BED_L / 2 - 1.5, -10]]) { const c = bush.clone(true); c.position.set(plotX(pi) + dx, 0, dz); c.scale.setScalar(0.7 + rnd() * 0.4); root.add(c); }
    if (mush) for (let pi = 0; pi < o.plots.length; pi++) for (const [dx, dz] of [[BED_L / 2 + 0.7, 0.4], [-BED_L / 2 - 1.1, -4.6]]) { const c = mush.clone(true); c.position.set(plotX(pi) + dx, 0, dz); c.scale.setScalar(0.6 + rnd() * 0.5); root.add(c); }
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
    for (let pi = 0; pi < o.plots.length; pi++) { const c = new THREE.Mesh(canGeo, canMat); c.position.set(plotX(pi) + BED_L / 2 + 0.55, 0, PATH_Z - 0.75); c.rotation.y = -2.2; c.castShadow = true; root.add(c); }

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
      const start = new THREE.Vector3(plotX(sc.plot) - 2, 0, PATH_Z);
      me.root.position.copy(start); sc.walk.to.copy(start);
    }
    await sleep(0);
    return sc;
  }

  // ---------- what the screen asks ----------
  /** Look at a plot (and one bed of it, or the whole plot). */
  show(plot: number, bed: number | null) {
    if (plot === this.plot && bed === this.bed && !this.free) return;
    this.plot = plot; this.bed = bed; this.free = null;
    // the buddy walks there along the paths (runs if it's far), the camera following, and waters once it
    // arrives: along the path in front of the plots, then up the grass aisle beside the beds to the bed
    const me = this.me;
    if (!me) return;
    const X = plotX(plot), at = me.root.position.clone().setY(0), route: THREE.Vector3[] = [];
    const aisle = X + BED_L / 2 + 0.75;
    if (Math.abs(at.z - PATH_Z) > 0.35) route.push(new THREE.Vector3(at.x, 0, PATH_Z));
    if (bed === null) {
      route.push(new THREE.Vector3(X - 1.5 + Math.random() * 2, 0, PATH_Z));
      this.walk.face = Math.PI; this.walk.waterAt = null;
    } else {
      route.push(new THREE.Vector3(aisle, 0, PATH_Z), new THREE.Vector3(aisle, 0, bedZ(bed)));
      this.walk.face = -Math.PI / 2; this.walk.waterAt = new THREE.Vector3(aisle - 1.1, 0, bedZ(bed));
    }
    // a step that's already where the buddy is (or where the last step ends) is left out
    this.walk.route = route.filter((q, i) => q.distanceTo(i ? route[i - 1] : at) > 0.05);
    // a running speed for the whole trip: about three seconds there, however far (a walk if it's close)
    const total = this.walk.route.reduce((a, q, i) => a + q.distanceTo(i ? this.walk.route[i - 1] : at), 0);
    this.walk.speed = Math.min(8, Math.max(3.2, total / 3));
    this.walk.mode = this.walk.route.length ? 'travel' : 'water';
    this.walk.until = this.now + 2.6;
  }
  /** The garden frames itself again (the "back to the bed" button). */
  resetView() { this.free = null; }
  /** Is the player steering the camera? */
  get looking() { return this.free !== null; }
  /** Start steering from wherever the camera is, so nothing jumps. */
  private steer() {
    if (this.free) return this.free;
    const v = this.camPos.clone().sub(this.camAim), dist = Math.max(1, v.length());
    this.free = { target: this.camAim.clone(), dist, pitch: Math.asin(Math.min(1, Math.max(-1, v.y / dist))), yaw: Math.atan2(v.x, v.z) };
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
    f.target.x = Math.max(-38, Math.min(38, f.target.x));
    f.target.z = Math.max(-26, Math.min(7, f.target.z));
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
    if (this.bed !== null) { this.bedGlow.position.set(plotX(this.plot), BED_H + 0.02, bedZ(this.bed)); (this.bedGlow.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 3) * 0.3; }
    if (this.ring.visible) { this.ring.position.y = SOIL_Y + 0.03 + Math.sin(t * 3) * 0.015; this.ring.rotation.z = t * 0.8; }
    this.butterflyFly(t);
    this.buddy(dt, t);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
    this.fx.update(dt, t);
    this.camera(dt, t);
    // the sun's shadows follow where the camera looks
    const f = this.focus(), dir = this.sun.userData.dir as THREE.Vector3;
    this.sun.position.copy(f).addScaledVector(dir, 60); this.sun.target.position.copy(f);
  }

  private butterflyFly(t: number) {
    const X = plotX(this.plot), nb = this.plots[this.plot]?.beds.length ?? 11;
    this.butterflies.forEach((b, i) => {
      const tt = t * b.sp + b.ph;
      const p = new THREE.Vector3(X + Math.sin(tt * 0.7) * (BED_L / 2 + 0.6) + Math.sin(tt * 2.1) * 0.3, 0.75 + Math.sin(tt * 1.3) * 0.35 + (i % 2) * 0.3, -((nb - 1) * ROW) / 2 + Math.cos(tt * 0.5 + i) * ((nb * ROW) / 2) + Math.cos(tt * 1.7) * 0.3);
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
    const w = this.walk, X = plotX(this.plot);
    const turnTo = (a: number, k: number) => { const d = Math.atan2(Math.sin(a - me.root.rotation.y), Math.cos(a - me.root.rotation.y)); me.root.rotation.y += d * Math.min(1, dt * k); };
    if (w.mode === 'travel') {
      // along the route: running while there's a long way to go, walking the last few metres
      const next = w.route[0];
      if (!next) { w.mode = 'water'; w.until = t + 2.6; }
      else {
        const d = next.clone().sub(me.root.position); d.y = 0;
        const left = d.length() + w.route.slice(1).reduce((a, q, i) => a + q.distanceTo(w.route[i]), 0);
        // run (faster for a longer trip), slowing to a walk for the last couple of metres
        const run = left > 2.5 && me.has('run'), speed = run ? w.speed : 1.1 + Math.max(0, w.speed - 1.1) * Math.min(1, left / 2.5) * 0.4;
        if (d.length() < 0.05) w.route.shift();
        else {
          me.root.position.addScaledVector(d.normalize(), Math.min(d.length(), dt * speed));
          turnTo(Math.atan2(d.x, d.z), 10);
          const gait = run ? (speed > 4.8 && me.has('sprint') ? 'sprint' : 'run') : 'walk';
          me.play(gait, 0.25);
          const a = me.actions[gait]; if (a) a.timeScale = Math.max(0.6, Math.min(2, speed / (me.speedOf[gait] || speed)));
        }
      }
    } else if (w.mode === 'idle') {
      w.wait -= dt;
      // with a bed chosen the buddy stays by it; otherwise it potters along the path in front of the plot
      if (w.wait <= 0) {
        if (this.bed === null) { w.to.set(X - BED_L / 2 + 0.6 + Math.random() * (BED_L - 1.2), 0, PATH_Z + (Math.random() - 0.5) * 0.4); w.mode = 'walk'; }
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
      const wa = w.waterAt ?? new THREE.Vector3(me.root.position.x, 0, bedZ(0));
      if (Math.random() < dt * 12) this.fx.emit({ at: new THREE.Vector3(wa.x + (Math.random() - 0.5) * 0.9, 1.1, wa.z + (Math.random() - 0.5) * 0.4), count: 2, shape: 'dot', color: [0x9fdcff, 0xd8f2ff], speed: [0.2, 0.6], dir: new THREE.Vector3(0, -1, 0), spread: 0.4, life: [0.5, 0.8], size: [0.04, 0.07], gravity: 2.5 });
      if (t > w.until) { w.mode = 'idle'; w.wait = 2 + Math.random() * 4; }
    }
    me.update(dt);
  }

  private camera(dt: number, t: number) {
    const cam = stage.camera, v = this.view, tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const bandH = Math.max(0.2, v.bottom - v.top), bandW = Math.max(0.2, v.right - v.left);
    const X = plotX(this.plot), nb = this.plots[this.plot]?.beds.length ?? 11;
    let center: THREE.Vector3, halfW: number, halfH: number, dir: THREE.Vector3;
    if (this.free) {
      // the player's camera: round the spot they're looking at, quick to answer a finger
      const f = this.free;
      const pos = f.target.clone().add(new THREE.Vector3(Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), Math.cos(f.yaw) * Math.cos(f.pitch)).multiplyScalar(f.dist));
      pos.y = Math.max(0.45, pos.y);
      const k = 1 - Math.exp(-dt * 9);
      this.camPos.lerp(pos, k); this.camAim.lerp(f.target, k);
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
      center = new THREE.Vector3(X - 0.3, 0.3, -((nb - 1) * ROW) / 2 + 0.9);
      halfW = BED_L / 2 + 1.0; halfH = (nb * ROW / 2 + 1.0) * 0.72 + 0.6;
      dir = new THREE.Vector3(0, 0.72, 0.7).normalize();
    } else {
      // one bed up close: its sign, its plants and the numbers along its front
      center = new THREE.Vector3(X - 0.35, SOIL_Y + 0.22, bedZ(this.bed) + 0.05);
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
    if (this.free) return this.free.target.clone().setY(0);
    if (this.walk.mode === 'travel' && this.me) return this.me.root.position.clone().setY(0);
    return new THREE.Vector3(plotX(this.plot), 0, -4);
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
export const GARDEN_LAYOUT = { CELL, BED_L, ROW, PLOT_GAP, plotX, bedZ, plantX };
