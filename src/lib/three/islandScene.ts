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
import * as THREE from 'three';
import { stage, type Controller } from './stage';
import { Character } from './character';
import { dressUp } from './dress';
import { Fx } from './fx';
import { loadGltf, loadTexture } from './assets';
import { GlimmerModel } from './glimmerModel';
import { THEMES } from './themes';
import { blocked, resolve, step, type Box, type Solid } from './gardenLayout';
import type { Island } from './island';
import type { View } from './runScene';
import type { FriendId } from '../art/cast';
import type { Dress } from '../adventure/gear';
import { GLIMMER, type GlimmerId } from '../adventure/glimmers';
import { sfx } from '../audio/sound';
import { ITEM, HABITAT_OF } from '../island/catalog';
import { centerOf, footprint, type IslandSave, type Placed, type Rot } from '../island/save';
import { PropKit, type Tick } from '../island/props3d';
import { gridTex, stones } from '../island/paint';

/** the catalogue's pictures, drawn once a session */
const THUMBS = new Map<string, string>();
/** how tall a Glimmer stands on the island */
const GLIM_H = 0.8;
/** one square of the grid, in metres */
export const CELL = 1;
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

export type Out = { id: GlimmerId; level: number; evolved: boolean };
export type Pick = { kind: 'glimmer'; id: GlimmerId } | { kind: 'visitor' } | { kind: 'item'; uid: string } | { kind: 'buddy' } | null;
type Thing = { uid: string; pl: Placed; obj: THREE.Object3D; tick: Tick | null; pop: number };
type Mood = 'idle' | 'walk' | 'nap' | 'play';
type Pal = { id: GlimmerId; m: GlimmerModel; mood: Mood; until: number; to: THREE.Vector3 | null; home: THREE.Vector3 | null; hopAt: number; zzz: number; heart?: THREE.Sprite; heartT?: number; heartAt?: number };

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
  get fps() { return this.busyT > 0 || this.drive.x || this.drive.z || this.goto ? 60 : 40; }
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

  private constructor(island: Island, kit: PropKit, root: THREE.Group, view: View) {
    this.island = island; this.kit = kit; this.root = root; this.view = view;
    this.marker = new THREE.Mesh(this.keep(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), this.keep(new THREE.MeshBasicMaterial({ color: 0x5fe08a, transparent: true, opacity: 0.45, depthWrite: false })));
    this.marker.visible = false; this.marker.renderOrder = 1;
    root.add(this.marker);
    stage.scene.add(this.fx.root);
    if (import.meta.env.DEV) (window as unknown as { __isle: IslandScene }).__isle = this;
  }

  static async create(o: { save: IslandSave; r: number; buddy: FriendId; dress?: Dress | null; view: View; grewFrom?: number }): Promise<IslandScene> {
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
    const root = new THREE.Group();
    const T = { ...THEMES.village, fog: 0xf3dcc4 };
    const kit = await PropKit.load();
    const island: Island = {
      trail: { length: 1, at: () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 0, 1) }) as unknown as ReturnType<Island['trail']['at']> },
      height: () => 0, placeFinish: () => {}, gateSolid: () => {}, root, theme: T as Island['theme'], stats: {},
      setSmooth: () => {}, update: () => {}, dispose: () => { for (const x of own) x.dispose(); },
    };
    const sc = new IslandScene(island, kit, root, o.view);
    island.setSmooth = (on) => { for (const c of sc.clouds) c.visible = !on || c.userData.near; sc.extras.forEach((e, i) => (e.visible = !on || !!e.userData.keep || i % 3 === 0)); };
    sc.own.push(...own);
    sc.r = o.r; sc.rimR = (o.r + 0.95) * CELL;
    await sc.sky();
    await sc.buildLand(o.r);
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
      uniforms: { top: { value: new THREE.Color(0x7fb2ea) }, mid: { value: new THREE.Color(0xf7d7b4) }, low: { value: new THREE.Color(0xffeccd) }, sunDir: { value: sunDir } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 top, mid, low, sunDir; varying vec3 vDir;
        void main(){ float y = vDir.y; vec3 c = mix(low, mid, smoothstep(-0.55, -0.15, y)); c = mix(c, top, smoothstep(-0.2, 0.35, y));
          float s = max(0.0, dot(normalize(vDir), sunDir));
          c += vec3(1.0, 0.88, 0.62) * (smoothstep(0.9993, 0.9997, s) * 1.4 + pow(s, 60.0) * 0.5 + pow(s, 8.0) * 0.22);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })));
    sky.renderOrder = -1; root.add(sky);
    const hemi = new THREE.HemisphereLight(0xfff0dc, 0x9ab06a, 1.25);
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
    this.meadow();
    // Glimmers who live by a home of their element
    for (const p of this.pals) p.home = this.homeOf(GLIMMER[p.id].element);
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
  private groundAt(clientX: number, clientY: number) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1), stage.camera);
    return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
  }
  /** a puff of joy where something was placed */
  cheerAt(uid: string) { const t = this.things.get(uid); if (!t) return; t.pop = 0; sfx.pop(); }

  // ---------- the buddy ----------
  /** The keys or the stick: right and forward (-1..1), relative to the camera; 0, 0 lets go. */
  steer(x: number, z: number) { this.drive.x = x; this.drive.z = z; if (x || z) { this.goto = null; this.walk.mode = 'drive'; this.walk.lastDrive = this.now; } }
  /** Tap the ground: the buddy walks there. */
  walkTo(clientX: number, clientY: number): boolean {
    const p = this.groundAt(clientX, clientY);
    if (!p || Math.hypot(p.x, p.z) > this.walkR) return false;
    this.goto = p.setY(0); this.walk.mode = 'drive'; this.walk.lastDrive = this.now;
    this.fx.emit({ at: p.clone().setY(0.08), count: 10, shape: 'ring', color: 0xffd34d, speed: [0.05, 0.2], life: [0.4, 0.6], size: [0.25, 0.4], drag: 2 });
    return true;
  }
  cheer() {
    const me = this.me; if (!me) return;
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
    for (const p of [...this.pals]) if (!want.has(p.id)) { p.m.dispose(); p.heart?.removeFromParent(); this.pals = this.pals.filter(x => x !== p); }
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
      this.pals.push({ id: o.id, m, mood: 'idle', until: this.now + 1 + Math.random() * 3, to: null, home, hopAt: 0, zzz: 0 });
    }
  }
  /** A Glimmer was tapped: a happy hop and hearts. */
  poke(id: GlimmerId) {
    const p = this.pals.find(x => x.id === id) ?? (this.visitor?.pal.id === id ? this.visitor.pal : null);
    if (!p) return;
    p.m.droop = 0; p.mood = 'idle'; p.until = this.now + 2.5; p.to = null;
    p.m.face = this.camPos.clone().setY(0);
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
  private palMove(p: Pal, dt: number, t: number) {
    const m = p.m, pos = m.root.position;
    // now and then a happy one shows a heart
    p.heartAt ??= t + 3 + Math.random() * 12;
    if (t > p.heartAt && p.mood !== 'nap') { p.heartAt = t + 10 + Math.random() * 16; p.heartT = 0; if (!p.heart) { p.heart = this.heartBubble(); this.root.add(p.heart); } }
    if (p.heart) {
      p.heartT = (p.heartT ?? 0) + dt;
      const k = p.heartT, show = k < 2.4, s = show ? Math.min(1, easeOutBack(Math.min(1, k / 0.35))) * 0.42 : Math.max(0, 0.42 - (k - 2.4) * 2);
      p.heart.visible = s > 0.01; p.heart.scale.setScalar(Math.max(0.001, s * 1.3));
      p.heart.position.copy(pos).add(new THREE.Vector3(0.18, m.height * (m.floats ? 1.75 : 1.4) + Math.sin(t * 3) * 0.03, 0));
    }
    if (t > p.until && p.mood !== 'walk') {
      // what next: wander (often to its home), stand about, nap, or play by its home
      const r = Math.random();
      if (p.mood === 'nap') { m.droop = 0; m.play('happy'); }
      if (r < 0.5) { p.mood = 'walk'; p.to = this.randomSpot(p.home && Math.random() < 0.7 ? p.home : null, 1.0); p.until = t + 12; }
      else if (r < 0.7) { p.mood = 'idle'; p.until = t + 2 + Math.random() * 3; p.to = null; m.face = Math.random() < 0.5 && this.me ? this.me.root.position.clone() : null; }
      else if (r < 0.84) { p.mood = 'nap'; p.until = t + 7 + Math.random() * 6; p.to = null; m.face = null; }
      else { p.mood = 'play'; p.until = t + 3 + Math.random() * 2; p.to = null; }
    }
    if (p.mood === 'walk' && p.to) {
      const d = p.to.clone().sub(pos); d.y = 0;
      const len = d.length();
      if (len < 0.08 || t > p.until) { p.mood = 'idle'; p.until = t + 1.5 + Math.random() * 2; p.to = null; }
      else {
        step(pos, d.multiplyScalar(1 / len), Math.min(len, dt * (m.floats ? 0.75 : 0.62)), this.solids, this.boxes, 0.2, this.walkR - 0.25);
        m.face = p.to.clone();
        if (!m.floats && t > p.hopAt) { m.play('hop'); p.hopAt = t + 0.5; }
      }
    } else if (p.mood === 'nap') {
      m.droop = Math.min(0.9, m.droop + dt * 0.8);
      p.zzz -= dt;
      if (p.zzz <= 0) { p.zzz = 0.9; this.fx.emit({ at: pos.clone().add(new THREE.Vector3(0.1, m.height * 0.9, 0)), count: 1, shape: 'dot', color: 0xffffff, speed: [0.15, 0.3], up: 0.6, life: [1.2, 1.6], size: [0.05, 0.09], drag: 0.5, fade: 1 }); }
    } else if (p.mood === 'play') {
      if (t > p.hopAt) { m.play(Math.random() < 0.4 ? 'happy' : 'hop'); p.hopAt = t + 0.9 + Math.random() * 0.6; if (Math.random() < 0.5) this.fx.emit({ at: pos.clone().add(new THREE.Vector3(0, 0.5, 0)), count: 6, shape: ['star', 'dot'], color: [0xffffff, 0xfff2a8], speed: [0.3, 0.9], up: 0.8, life: [0.4, 0.7], size: [0.05, 0.1], drag: 2 }); }
    }
    m.update(dt, t);
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
    this.visitor = { pal: { id: v.id, m, mood: 'idle', until: this.now + 3, to: null, home: at, hopAt: 0, zzz: 0 }, arrive: arriving ? this.now : -99, from: at.clone().setY(7), at, present, cloud, opened: !v.present };
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
    let best: Pick = null, bd = Infinity;
    const boxHit = (o: THREE.Object3D, grow = 0.08) => { const b = new THREE.Box3().setFromObject(o).expandByScalar(grow); const p = ray.ray.intersectBox(b, new THREE.Vector3()); return p ? p.distanceTo(ray.ray.origin) : Infinity; };
    for (const p of this.pals) { const d = boxHit(p.m.root, 0.12); if (d < bd) { bd = d; best = { kind: 'glimmer', id: p.id }; } }
    if (this.visitor) { const d = Math.min(boxHit(this.visitor.pal.m.root, 0.15), this.visitor.present ? boxHit(this.visitor.present, 0.1) : Infinity); if (d < bd) { bd = d; best = { kind: 'visitor' }; } }
    if (this.me) { const d = boxHit(this.me.root, 0); if (d < bd) { bd = d; best = { kind: 'buddy' }; } }
    // things: the mesh hit nearest (only if nothing alive is in front)
    const objs = [...this.things.values()].filter(t => t.obj.visible).map(t => t.obj);
    const h = ray.intersectObjects(objs, true).find(x => (x.object as THREE.Mesh).isMesh && x.object.visible);
    if (h && h.distance < bd) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.item) o = o.parent;
      const t = o ? [...this.things.values()].find(x => x.obj === o) : null;
      if (t) best = { kind: 'item', uid: t.uid };
    }
    return best;
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
  async thumbs(ids: string[], onOne: (id: string, url: string) => void, size = 168) {
    const r = stage.renderer; if (!r) return;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xfff4e6, 0x9ab06a, 1.6));
    const d = new THREE.DirectionalLight(0xffe8cc, 2.6); d.position.set(-3, 5, 4); scene.add(d);
    const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 200);
    const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); rt.texture.colorSpace = THREE.SRGBColorSpace;
    const buf = new Uint8Array(size * size * 4), cv = document.createElement('canvas'); cv.width = cv.height = size;
    const g = cv.getContext('2d')!, clear = r.getClearColor(new THREE.Color()), alpha = r.getClearAlpha();
    try {
      for (const id of ids) {
        const had = THUMBS.get(id);
        if (had) { onOne(id, had); continue; }
        const o = this.kit.make(id); if (!o) continue;
        scene.add(o); o.updateMatrixWorld(true);
        const box = new THREE.Box3(); o.traverse(m => { if ((m as THREE.Mesh).isMesh) box.expandByObject(m); });
        const sph = box.getBoundingSphere(new THREE.Sphere());
        const dir = new THREE.Vector3(0.45, 0.5, 1).normalize();
        cam.position.copy(sph.center).addScaledVector(dir, (sph.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 0.94); cam.lookAt(sph.center);
        r.setRenderTarget(rt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, cam);
        r.readRenderTargetPixels(rt, 0, 0, size, size, buf);
        r.setRenderTarget(null);
        const img = g.createImageData(size, size);
        for (let y = 0; y < size; y++) img.data.set(buf.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
        g.clearRect(0, 0, size, size); g.putImageData(img, 0, 0);
        const url = cv.toDataURL('image/webp', 0.9);
        THUMBS.set(id, url); onOne(id, url);
        scene.remove(o);
        await new Promise(res => setTimeout(res, 0));
      }
    } finally { r.setRenderTarget(null); r.setClearColor(clear, alpha); rt.dispose(); }
  }

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
  orbit(dx: number, dy: number) { const c = this.cam; c.yaw -= dx * 0.006; c.pitch = Math.max(0.18, Math.min(1.35, c.pitch + dy * 0.005)); this.framed = false; this.busyT = 0.6; }
  zoom(factor: number, clientX?: number, clientY?: number) {
    const c = this.cam, was = c.dist;
    c.dist = Math.max(3.2, Math.min(this.rimR * 4 + 10, c.dist * factor));
    if (clientX !== undefined && clientY !== undefined && c.dist < was) { const p = this.groundAt(clientX, clientY); if (p) c.target.lerp(p.setY(c.target.y), 1 - c.dist / was); }
    this.clampTarget(); this.framed = false; this.busyT = 0.6;
  }
  pan(dx: number, dy: number) {
    const c = this.cam, k = (2 * c.dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2))) / innerHeight;
    const right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw)), fwd = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw));
    c.target.addScaledVector(right, -dx * k).addScaledVector(fwd, dy * k / Math.max(0.35, Math.sin(c.pitch)));
    this.clampTarget(); this.framed = false; this.busyT = 0.6;
  }
  private clampTarget() { const t = this.cam.target, d = Math.hypot(t.x, t.z), m = this.rimR + 1; if (d > m) { t.x *= m / d; t.z *= m / d; } t.y = 0.55; }
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
    this.flies.forEach((b, i) => {
      const tt = t * b.sp + b.ph, p = new THREE.Vector3(Math.cos(tt * 0.6) * b.rad + Math.sin(tt * 2.1) * 0.3, b.y + Math.sin(tt * 1.3) * 0.3, Math.sin(tt * 0.6 + i) * b.rad * 0.8 + Math.cos(tt * 1.7) * 0.3);
      const v = p.clone().sub(b.g.position); b.g.position.copy(p); if (v.lengthSq() > 1e-6) b.g.rotation.y = Math.atan2(v.x, v.z);
      const flap = Math.sin(t * 16 + b.ph) * 0.9; b.l.rotation.z = -flap; b.r.rotation.z = flap;
    });
    this.buddy(dt, t);
    for (const p of this.pals) this.palMove(p, dt, t);
    this.visit(dt, t);
    this.fx.setScale(innerHeight * Math.min(2, devicePixelRatio || 1), stage.camera.fov);
    this.fx.update(dt, t);
    this.camera(dt, t);
    const f = this.focus(), dir = this.sun.userData.dir as THREE.Vector3;
    this.sun.position.copy(f).addScaledVector(dir, 40); this.sun.target.position.copy(f);
  }

  private buddy(dt: number, t: number) {
    const me = this.me; if (!me) return;
    const w = this.walk, pos = me.root.position;
    const turnTo = (a: number, k: number) => { const d = Math.atan2(Math.sin(a - me.root.rotation.y), Math.cos(a - me.root.rotation.y)); me.root.rotation.y += d * Math.min(1, dt * k); };
    if (w.mode === 'drive') {
      let dir: THREE.Vector3 | null = null, speed = 0;
      if (this.drive.x || this.drive.z) {
        const c = this.cam, fwd = new THREE.Vector3(-Math.sin(c.yaw), 0, -Math.cos(c.yaw)), right = new THREE.Vector3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
        dir = fwd.multiplyScalar(this.drive.z).addScaledVector(right, this.drive.x);
        const mm = Math.min(1, dir.length()); dir.normalize(); speed = 3.0 * mm; w.lastDrive = t;
      } else if (this.goto) {
        const d = this.goto.clone().sub(pos); d.y = 0; const len = d.length();
        if (len < 0.15) this.goto = null; else { dir = d.multiplyScalar(1 / len); speed = len > 2 ? 3.0 : 1.1 + len; w.lastDrive = t; }
      }
      if (dir && speed > 0) {
        const moved = step(pos.setY(0), dir, speed * dt, this.solids, this.boxes, 0.3, this.walkR);
        if (this.goto && moved < speed * dt * 0.2) this.goto = null;
        turnTo(Math.atan2(dir.x, dir.z), 12);
        const gait = speed > 2.2 && me.has('run') ? 'run' : 'walk'; me.play(gait, 0.2);
        const a = me.actions[gait]; if (a) a.timeScale = Math.max(0.6, Math.min(2, Math.max(0.3, moved / Math.max(1e-4, dt)) / (me.speedOf[gait] || speed)));
      } else me.play('idle', 0.3);
      // left alone for a while: it potters about by itself again
      if (t - w.lastDrive > 8) { w.mode = 'idle'; w.until = t + 2; }
    } else if (w.mode === 'walk') {
      const d = w.to.clone().sub(pos); d.y = 0; const len = d.length();
      if (len < 0.1 || t > w.until) { w.mode = 'idle'; w.until = t + 3 + Math.random() * 4; const a = me.play(me.has('wave1') && Math.random() < 0.25 ? 'wave1' : 'idle', 0.3); a?.reset(); }
      else { step(pos.setY(0), d.multiplyScalar(1 / len), Math.min(len, dt * 1.05), this.solids, this.boxes, 0.3, this.walkR); turnTo(Math.atan2(d.x, d.z), 8); me.play('walk', 0.3); const a = me.actions.walk; if (a) a.timeScale = Math.max(0.6, 1.05 / (me.speedOf.walk || 1)); }
    } else {
      if (t > w.until) {
        // off to look at something: a Glimmer, a thing, or just somewhere
        const things = [...this.things.values()];
        const pick = Math.random() < 0.4 && this.pals.length ? this.pals[Math.floor(Math.random() * this.pals.length)].m.root.position : Math.random() < 0.6 && things.length ? this.centre(things[Math.floor(Math.random() * things.length)].pl) : null;
        w.to.copy(this.randomSpot(pick, 0.8, 0.3)); w.mode = 'walk'; w.until = t + 10;
      } else me.play('idle', 0.4);
    }
    me.update(dt);
  }

  private camera(dt: number, _t: number) {
    const c = this.cam, cam = stage.camera;
    if (this.walk.mode === 'drive' && this.me && (this.drive.x || this.drive.z || this.goto) && !this.framed) c.target.lerp(this.me.root.position.clone().setY(0.55), 1 - Math.exp(-dt * 3));
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
