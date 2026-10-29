// Sky Slalom: the buddy races a sled down an endless snowy run along the ridge of a floating mountain,
// through stone and ice arches. Each gate has three arches with a number over each; the question is on
// the card at the top of the screen, and you steer through the arch with the right answer. The world is
// a treadmill: the sled stays put and the snow, trees, fences and gates slide past, so it can go on as
// long as a round does. Strips of slope are reused as they pass behind the camera, dressed afresh. Past
// the fences the mountain falls away to the clouds, with the painted sky islands beyond.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { stage, type Controller } from '../stage';
import { Character } from '../character';
import { dressUp } from '../dress';
import { Fx } from '../fx';
import { THEMES } from '../themes';
import type { Island } from '../island';
import type { FriendId } from '../../art/cast';
import { Many, backdrop, fontLoaded, makeSled, plaqueSprite, disposeSprite, skyDome } from './kit';
import { sitOnSled } from '../sledSeat';
import { sfx } from '../../audio/sound';

const SLOPE = 0.2;
const STRIP = 60, STRIPS = 5;
export const LANES = [-2.5, 0, 2.5];
const ARCH_W = 1.15, ARCH_H = 2.35;
const FENCE_X = 5.2, POSTS = 10;
const WAVE = (2 * Math.PI) / STRIP;
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2146483646; };

/** The snow's height across the run (x) and along a strip (y, repeating every strip so the strips meet):
 *  the flat groomed run, a soft berm with the fences, then the mountain falling away to the clouds. */
function ground(x: number, y: number) {
  const ax = Math.abs(x);
  const rip = Math.sin(y * WAVE * 6) * 0.03;
  if (ax <= 4.4) return rip;
  const k = Math.min(1, (ax - 4.4) / 2.2), s = k * k * (3 - 2 * k);
  const berm = s * (0.8 + Math.sin(x * 0.9 + y * WAVE * 4) * 0.25);
  return ax <= 9 ? berm : berm - Math.pow(ax - 9, 1.7) * 0.42;
}

/** Fresh groomed snow, painted on a canvas: soft drifts, sparkles and the corduroy of the groomer. */
function snowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f6f9ff'; g.fillRect(0, 0, 512, 512);
  const r = rand(3);
  for (let i = 0; i < 900; i++) {
    const x = r() * 512, y = r() * 512, rad = 6 + r() * 40;
    const grd = g.createRadialGradient(x, y, 0, x, y, rad);
    grd.addColorStop(0, r() < 0.5 ? 'rgba(170,195,235,0.06)' : 'rgba(255,255,255,0.08)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let x = 0; x < 512; x += 9) { g.fillStyle = `rgba(160,185,230,${0.05 + r() * 0.05})`; g.fillRect(x, 0, 3, 512); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${0.6 + r() * 0.4})`; const s = 1 + r() * 1.5; g.fillRect(r() * 512, r() * 512, s, s); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
/** The soft glow filling an arch: clear in the middle, bright at the rim. */
function portalTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 128, 10, 64, 128, 128);
  grd.addColorStop(0, 'rgba(255,255,255,0.05)'); grd.addColorStop(0.7, 'rgba(255,255,255,0.25)'); grd.addColorStop(1, 'rgba(255,255,255,0.9)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A boost pad on the snow: three bright chevrons pointing down the run. */
function arrowPadTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, 'rgba(255,214,90,0)'); grd.addColorStop(0.5, 'rgba(255,214,90,0.35)'); grd.addColorStop(1, 'rgba(255,214,90,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
  g.lineJoin = 'round'; g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const y = 40 + i * 70;
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 22;
    g.beginPath(); g.moveTo(20, y + 34); g.lineTo(64, y); g.lineTo(108, y + 34); g.stroke();
    g.strokeStyle = '#ffb21f'; g.lineWidth = 12;
    g.beginPath(); g.moveTo(20, y + 34); g.lineTo(64, y); g.lineTo(108, y + 34); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** An arch of chunky stone blocks round a half ellipse, on two plinths, and the snow lying on its top. */
function archStones() {
  const r = rand(11), stones: THREE.BufferGeometry[] = [], snow: THREE.BufferGeometry[] = [];
  const pt = (a: number) => new THREE.Vector2(Math.cos(a) * ARCH_W, Math.sin(a) * ARCH_H);
  const N = 9;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI, a1 = ((k + 1) / N) * Math.PI, a = (a0 + a1) / 2;
    const c = pt(a), len = pt(a0).distanceTo(pt(a1)) * 0.96;
    const tan = Math.atan2(Math.cos(a) * ARCH_H, -Math.sin(a) * ARCH_W);
    const b = new RoundedBoxGeometry(len, 0.5 + r() * 0.1, 0.66 + r() * 0.1, 2, 0.07);
    b.rotateZ(tan); b.translate(c.x, c.y, (r() - 0.5) * 0.06);
    stones.push(b);
    if (k >= 3 && k <= 5) {
      const n = new THREE.Vector2(Math.cos(a) * ARCH_H, Math.sin(a) * ARCH_W).normalize();
      const cap = new THREE.SphereGeometry(0.5, 10, 6);
      cap.scale(len / 0.85, 0.32, 0.86); cap.rotateZ(tan + Math.PI); cap.translate(c.x + n.x * 0.24, c.y + n.y * 0.24, 0);
      snow.push(cap);
    }
  }
  for (const x of [-ARCH_W, ARCH_W]) { const b = new RoundedBoxGeometry(0.78, 0.36, 0.86, 2, 0.06); b.translate(x, 0.12, 0); stones.push(b); }
  const out = { stone: mergeGeometries(stones)!, snow: mergeGeometries(snow)! };
  stones.forEach(g => g.dispose()); snow.forEach(g => g.dispose());
  return out;
}

export type GateSpec = { values: [number, number, number]; right: 0 | 1 | 2 };
/** the cruising top speed (the run's own build-up and your streak), and the most turbo and boost rings
 *  can add on top (metres a second: 30 is about 108 km/h, 50 about 180) */
export const CRUISE_TOP = 30, SPEED_MAX = 50;
/** turbo: how much faster, for how long */
export const TURBO = { mult: 1.45, secs: 3.5 };
type Ring = { d: number; lane: number; group: THREE.Group; passed: boolean; fade: number };
type Lane = { group: THREE.Group; stone: THREE.Mesh; rim: THREE.Mesh; portal: THREE.Mesh; label: THREE.Sprite };
type Gate = { d: number; spec: GateSpec; group: THREE.Group; lanes: Lane[]; passed: boolean; lit: number; shown: boolean };
type View = { top: number; bottom: number; left: number; right: number };

export class SlalomScene implements Controller {
  fps = 60;
  readonly island: Island;
  readonly me: Character;
  view: View = { top: 0, bottom: 1, left: 0, right: 1 };
  /** the round is running (false: waiting at the top, or finished) */
  running = false;
  paused = false;
  /** metres travelled, metres a second */
  dist = 0; speed = 0;
  base = 9;
  /** seconds the run has been going (the speed builds with it) */
  runT = 0;
  /** right answers in a row (each one adds a little speed) */
  streak = 0;
  /** seconds of turbo left, and of a boost ring's burst */
  turbo = 0; burst = 0;
  /** told when a boost ring is reached: whether you rode through it */
  onRing: ((hit: boolean) => void) | null = null;
  private rings: Ring[] = [];
  /** lane: -1, 0, 1 (where the sled is steering), and where it is now (metres across) */
  lane = 0; x = 0;
  /** told when a gate is reached: which lane you went through */
  onGate: ((lane: 0 | 1 | 2, g: GateSpec, nearMiss: boolean) => void) | null = null;
  private world = new THREE.Group();
  private track = new THREE.Group();
  private rig = new THREE.Group();
  private sled: { group: THREE.Group; dispose(): void };
  private fx = new Fx();
  private strips: { mesh: THREE.Mesh; i: number }[] = [];
  private pines: Many | null = null; private rocks: Many | null = null;
  private posts: THREE.InstancedMesh; private rails: THREE.InstancedMesh; private flags: THREE.InstancedMesh;
  private gates: Gate[] = [];
  private snow: THREE.Points;
  private sun: THREE.DirectionalLight;
  private t = 0; private lastLaneT = -9;
  private spin = 0; private spinV = 0; private lean = 0; private bump = 0;
  private slow = 1;
  private finishing = 0; private cheered = false;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private own: { dispose(): void }[] = [];
  private mats: Record<'stone' | 'gold' | 'dim' | 'cap' | 'rim' | 'rimGold' | 'portal' | 'portalGold' | 'crystal', THREE.Material>;
  private geos: Record<'arch' | 'cap' | 'rim' | 'portal' | 'crystal' | 'mound' | 'ring' | 'ringGlow' | 'pad', THREE.BufferGeometry>;
  private ringMats!: { ring: THREE.MeshStandardMaterial; glow: THREE.MeshBasicMaterial; pad: THREE.MeshBasicMaterial };

  private constructor(island: Island, me: Character, sled: { group: THREE.Group; dispose(): void }, many: (Many | null)[]) {
    this.island = island; this.me = me; this.sled = sled;
    [this.pines, this.rocks] = many;
    const root = island.root;
    const keep = <T extends { dispose(): void }>(x: T) => { this.own.push(x); return x; };
    this.world.rotation.x = -Math.atan(SLOPE);
    root.add(this.world);
    this.world.add(this.track);
    // the slope: strips of groomed snow
    const snowTex = keep(snowTexture());
    snowTex.repeat.set(3, 4.5);
    const snowMat = keep(new THREE.MeshStandardMaterial({ map: snowTex, color: 0xffffff, roughness: 0.78, emissive: 0xd8e6ff, emissiveIntensity: 0.16 }));
    const geo = keep(new THREE.PlaneGeometry(40, STRIP, 64, 30));
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, ground(p.getX(i), p.getY(i)));
    geo.computeVertexNormals();
    for (let i = 0; i < STRIPS; i++) {
      const mesh = new THREE.Mesh(geo, snowMat);
      mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
      this.track.add(mesh);
      this.strips.push({ mesh, i: -1 });
    }
    // soft blue lines either side of the run
    const lineMat = keep(new THREE.MeshBasicMaterial({ color: 0x9cc8ff, transparent: true, opacity: 0.45, fog: true }));
    const lineGeo = keep(new THREE.PlaneGeometry(0.12, STRIP * STRIPS));
    for (const x of [-4.2, 4.2]) { const l = new THREE.Mesh(lineGeo, lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.035, -STRIP * STRIPS / 2 + 20); this.world.add(l); }
    for (const m of many) if (m) this.track.add(m.group);
    // the fences: wooden posts, a rail, and bunting hanging from it
    const wood = keep(new THREE.MeshStandardMaterial({ color: 0x9a6a3c, roughness: 0.8 }));
    this.posts = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.09, 0.11, 1.25, 7)), wood, STRIPS * POSTS * 2);
    this.rails = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(0.07, 0.07, STRIP / POSTS)), wood, STRIPS * POSTS * 2);
    const flagGeo = keep(new THREE.BufferGeometry());
    flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.17, 0, 0, 0.17, 0, 0, 0, -0.36, 0]), 3));
    flagGeo.computeVertexNormals();
    this.flags = new THREE.InstancedMesh(flagGeo, keep(new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 })), STRIPS * POSTS * 2 * 4);
    for (const m of [this.posts, this.rails, this.flags]) { m.frustumCulled = false; m.castShadow = m !== this.flags; this.track.add(m); }
    // the gates: chunky stone arches capped with snow, an icy glow inside, crystals on top
    const curve = (s: number) => new THREE.CatmullRomCurve3(Array.from({ length: 19 }, (_, k) => { const a = (k / 18) * Math.PI; return new THREE.Vector3(Math.cos(a) * ARCH_W * s, Math.sin(a) * ARCH_H * s, 0); }));
    const stones = archStones();
    const opening = new THREE.Shape();
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI; const x = Math.cos(a) * ARCH_W * 0.86, y = Math.sin(a) * ARCH_H * 0.88; if (k) opening.lineTo(x, y); else opening.moveTo(x, y); }
    const portalGeo = new THREE.ShapeGeometry(opening);
    { const pp = portalGeo.attributes.position as THREE.BufferAttribute, uv = portalGeo.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < pp.count; i++) uv.setXY(i, pp.getX(i) / (ARCH_W * 1.72) + 0.5, pp.getY(i) / (ARCH_H * 0.88)); }
    this.geos = {
      arch: keep(stones.stone),
      cap: keep(stones.snow),
      rim: keep(new THREE.TubeGeometry(curve(0.87), 30, 0.05, 6, false)),
      portal: keep(portalGeo),
      crystal: keep(new THREE.ConeGeometry(0.16, 0.7, 5)),
      mound: keep(new THREE.SphereGeometry(0.42, 10, 7)),
      ring: keep(new THREE.TorusGeometry(0.95, 0.14, 12, 40)),
      ringGlow: keep(new THREE.CircleGeometry(0.95, 32)),
      pad: keep(new THREE.PlaneGeometry(1.5, 2.6)),
    };
    const ptex = keep(portalTexture());
    this.mats = {
      stone: keep(new THREE.MeshStandardMaterial({ color: 0xaebdd0, roughness: 0.85 })),
      gold: keep(new THREE.MeshStandardMaterial({ color: 0xffd36b, emissive: 0xffa21f, emissiveIntensity: 0.55, roughness: 0.45 })),
      dim: keep(new THREE.MeshStandardMaterial({ color: 0x8e9bb0, roughness: 0.95, transparent: true, opacity: 0.6 })),
      cap: snowMat,
      rim: keep(new THREE.MeshBasicMaterial({ color: 0x9fe6ff })),
      rimGold: keep(new THREE.MeshBasicMaterial({ color: 0xfff0a0 })),
      portal: keep(new THREE.MeshBasicMaterial({ map: ptex, color: 0x7fd4ff, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
      portalGold: keep(new THREE.MeshBasicMaterial({ map: ptex, color: 0xffc94a, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
      crystal: keep(new THREE.MeshStandardMaterial({ color: 0xa8e4ff, emissive: 0x3aa0ff, emissiveIntensity: 0.55, roughness: 0.12, flatShading: true })),
    };
    // boost rings: a gold hoop standing over a glowing arrow pad on the snow
    this.ringMats = {
      ring: keep(new THREE.MeshStandardMaterial({ color: 0xffd34a, emissive: 0xff9a1f, emissiveIntensity: 0.9, roughness: 0.3, metalness: 0.2 })),
      glow: keep(new THREE.MeshBasicMaterial({ map: ptex, color: 0xffd76a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })),
      pad: keep(new THREE.MeshBasicMaterial({ map: keep(arrowPadTexture()), transparent: true, opacity: 0.9, depthWrite: false })),
    };
    // the rider
    this.world.add(this.rig);
    this.rig.add(sled.group);
    sled.group.rotation.y = Math.PI / 2;
    // the buddy rides in the rig, facing down the hill like the sled
    this.rig.add(me.root);
    // falling snow round the camera
    const n = 900, pos = new Float32Array(n * 3), r = rand(5);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 40; pos[i * 3 + 1] = r() * 22; pos[i * 3 + 2] = -r() * 50 + 8; }
    const sg = keep(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false })));
    root.add(this.snow);
    // light: a bright low sun ahead and to the left (long shadows toward you), cool fill from the sky
    const hemi = new THREE.HemisphereLight(0xeaf4ff, 0xa9bfdc, 1.55);
    this.sun = new THREE.DirectionalLight(0xfff0d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -16, near: 1, far: 110 });
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    root.add(hemi, this.sun, this.sun.target);
    root.add(this.fx.root);
    this.layoutStrips(true);
    this.place(0);
  }

  static async create(o: { buddy: FriendId; seed: number }): Promise<SlalomScene> {
    void o.seed;
    await fontLoaded();
    const theme = { ...THEMES.ridge, fog: 0xe4eefa };
    const root = new THREE.Group();
    const [me, sled, pines, rocks, bg] = await Promise.all([
      Character.create(o.buddy), makeSled(),
      Many.load('world/pine_tree.glb', 5, STRIPS * 24), Many.load('world/boulder.glb', 1.2, STRIPS * 8),
      backdrop('arcade/bg-slalom.webp', 420, 330),
    ]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    await me.loadMoves();
    // the sky and the painted mountains far off
    root.add(skyDome(0x6fb0f0, 0xcfe6fb, 0xf6e6f2));
    if (bg) { bg.position.set(0, 18, 0); root.add(bg); }
    const island: Island = {
      trail: { length: 1e6, at: () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0) }) },
      height: () => 0, placeFinish: () => {}, gateSolid: () => {}, setSmooth: () => {},
      update: () => {}, root, theme, stats: {},
      dispose: () => { bg?.geometry.dispose(); (bg?.material as THREE.MeshBasicMaterial | undefined)?.map?.dispose(); (bg?.material as THREE.Material | undefined)?.dispose(); },
    };
    return new SlalomScene(island, me, sled, [pines, rocks]);
  }

  // ---------- the course ----------
  /** Put each strip of slope where it belongs and dress it (trees, rocks, fences) when it moves up. */
  private layoutStrips(first = false) {
    const head = Math.floor(this.dist / STRIP);
    let moved = false;
    for (let k = 0; k < STRIPS; k++) {
      const i = head - 1 + k; // one strip behind, the rest ahead
      const slot = ((i % STRIPS) + STRIPS) % STRIPS, s = this.strips[slot];
      if (s.i === i && !first) continue;
      s.i = i; moved = true;
      s.mesh.position.set(0, 0, -(i * STRIP + STRIP / 2));
      this.dress(slot, i);
    }
    if (!moved) return;
    this.pines?.commit(); this.rocks?.commit();
    for (const m of [this.posts, this.rails, this.flags]) m.instanceMatrix.needsUpdate = true;
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
  }
  private dress(slot: number, i: number) {
    const r = rand(1000 + i * 7919);
    const z0 = -i * STRIP;
    const h = (x: number, z: number) => ground(x, -z);
    if (this.pines) for (let k = 0; k < 24; k++) {
      const side = k % 2 ? 1 : -1, x = side * (6.4 + Math.pow(r(), 1.3) * 9), z = z0 - r() * STRIP;
      this.pines.set(slot * 24 + k, x, h(x, z) - 0.15, z, 0.65 + r() * 0.75, r() * 6);
    }
    if (this.rocks) for (let k = 0; k < 8; k++) {
      const side = r() < 0.5 ? 1 : -1, x = side * (6.3 + r() * 4.5), z = z0 - r() * STRIP;
      this.rocks.set(slot * 8 + k, x, h(x, z) - 0.2, z, 0.45 + r() * 0.7, r() * 6);
    }
    // the fences and their bunting
    const cols = [0xff5d8f, 0xffc93d, 0x3fb6f2, 0x6fd64a, 0xa97bff, 0xff9f43];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    const step = STRIP / POSTS;
    for (let side = 0; side < 2; side++) {
      const x = side ? FENCE_X : -FENCE_X;
      for (let k = 0; k < POSTS; k++) {
        const idx = (slot * 2 + side) * POSTS + k, z = z0 - k * step, y = h(x, z);
        q.identity();
        m.compose(new THREE.Vector3(x, y + 0.55, z), q, one); this.posts.setMatrixAt(idx, m);
        m.compose(new THREE.Vector3(x, y + 1.05, z - step / 2), q, one); this.rails.setMatrixAt(idx, m);
        q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        for (let j = 0; j < 4; j++) {
          const f = idx * 4 + j, fz = z - (j + 0.75) * (step / 4.5), sag = Math.sin(((j + 0.75) / 4.5) * Math.PI) * 0.16;
          m.compose(new THREE.Vector3(x, y + 1.02 - sag, fz), q, one); this.flags.setMatrixAt(f, m);
          this.flags.setColorAt(f, c.setHex(cols[(k * 4 + j + i) % cols.length]));
        }
      }
    }
  }

  /** Add a gate `d` metres down the run (its numbers hidden until showGate). */
  addGate(d: number, spec: GateSpec) {
    const g = new THREE.Group();
    g.position.set(0, ground(0, d), -d);
    const lanes: Lane[] = [];
    LANES.forEach((x, k) => {
      const lg = new THREE.Group(); lg.position.x = x;
      const stone = new THREE.Mesh(this.geos.arch, this.mats.stone); stone.castShadow = true;
      const cap = new THREE.Mesh(this.geos.cap, this.mats.cap); cap.castShadow = true;
      const rim = new THREE.Mesh(this.geos.rim, this.mats.rim);
      const portal = new THREE.Mesh(this.geos.portal, this.mats.portal); portal.position.z = -0.02;
      lg.add(stone, cap, rim, portal);
      // ice crystals: a cluster on top, one at each foot
      for (const [cx, cy, rz, s] of [[0, ARCH_H + 0.35, 0, 1.2], [-0.32, ARCH_H + 0.12, 0.45, 0.9], [0.3, ARCH_H + 0.14, -0.4, 0.85], [-ARCH_W - 0.15, 0.35, 0.3, 0.8], [ARCH_W + 0.15, 0.3, -0.25, 0.7]]) {
        const cr = new THREE.Mesh(this.geos.crystal, this.mats.crystal); cr.position.set(cx, cy, 0); cr.rotation.z = rz; cr.scale.setScalar(s); lg.add(cr);
      }
      for (const sx of [-ARCH_W, ARCH_W]) { const mound = new THREE.Mesh(this.geos.mound, this.mats.cap); mound.position.set(sx, 0.02, 0); mound.scale.set(1.1, 0.5, 1); mound.receiveShadow = true; lg.add(mound); }
      const label = plaqueSprite(String(spec.values[k]), 1.05, { bg: ['#ffffff', '#e4f3ff'], ink: '#1d2f66', edge: '#ffffff', glow: 'rgba(60,140,255,0.55)' });
      label.position.set(0, ARCH_H - 0.05, 0.4);
      label.visible = false;
      lg.add(label);
      g.add(lg);
      lanes.push({ group: lg, stone, rim, portal, label });
    });
    this.track.add(g);
    this.gates.push({ d, spec, group: g, lanes, passed: false, lit: 0, shown: false });
  }
  /** Show the numbers on the next gate (the one the question card is about). */
  showGate(d: number) { const g = this.gates.find(x => x.d === d); if (g) { g.shown = true; g.lanes.forEach((l, k) => { l.label.visible = true; l.label.userData.pop = 0; l.label.userData.k = k; }); } }
  /** Add a boost ring `d` metres down the run, in a lane (0, 1, 2). */
  addRing(d: number, lane: number) {
    const g = new THREE.Group();
    g.position.set(LANES[lane], ground(LANES[lane], d), -d);
    const hoop = new THREE.Mesh(this.geos.ring, this.ringMats.ring); hoop.position.y = 1.15; hoop.castShadow = true;
    const glow = new THREE.Mesh(this.geos.ringGlow, this.ringMats.glow); glow.position.y = 1.15;
    const pad = new THREE.Mesh(this.geos.pad, this.ringMats.pad); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.04, 1.6);
    g.add(hoop, glow, pad);
    g.userData.hoop = hoop;
    this.track.add(g);
    this.rings.push({ d, lane, group: g, passed: false, fade: 1 });
  }
  /** Fire the turbo you've earned. */
  fireTurbo() {
    if (!this.running || this.paused) return;
    this.turbo = TURBO.secs;
    const w = this.rig.localToWorld(new THREE.Vector3(0, 0.6, 0.4));
    this.fx.emit({ at: w, count: 70, shape: ['star', 'spark'], color: [0x7fe0ff, 0xffffff, 0xffe066], speed: [3, 7], dir: new THREE.Vector3(0, 0.4, 1), spread: 0.8, radius: 0.5, life: [0.5, 1], size: [0.14, 0.32], drag: 1.2 });
  }
  /** The distance to the next gate not yet passed (Infinity if none). */
  nextGate() { return this.gates.find(g => !g.passed)?.d ?? Infinity; }

  // ---------- steering ----------
  steer(dir: -1 | 1) {
    if (!this.running || this.paused) return;
    const l = Math.max(-1, Math.min(1, this.lane + dir));
    if (l === this.lane) return;
    this.lane = l; this.lastLaneT = this.t;
    this.lean = dir * 0.55;
    this.spray(22, dir);
  }
  /** Snow kicked up behind the runners (thrown back toward the camera, as the slope rushes past). */
  private spray(n: number, side = 0) {
    const w = this.rig.localToWorld(new THREE.Vector3(side * 0.35, 0.12, 0.6));
    this.fx.emit({ at: w, count: n, shape: ['dot', 'flake'], color: [0xffffff, 0xeef6ff], speed: [2.5, 4 + this.speed * 0.3], dir: new THREE.Vector3(-side * 0.9, 0.8, 1), spread: 0.5, radius: 0.25, life: [0.4, 0.9], size: [0.1, 0.28], gravity: 4, drag: 1.1 });
  }

  /** A crash (the wrong arch): the sled spins out in a burst of snow, slows, and carries on. */
  crash() {
    this.spinV = Math.PI * 2 / 0.75; this.spin = 0;
    this.slow = 0.45;
    this.bump = 0.35;
    const w = this.rig.localToWorld(new THREE.Vector3(0, 0.5, 0));
    this.fx.emit({ at: w, count: 90, shape: ['dot', 'flake'], color: [0xffffff, 0xdcefff], speed: [2, 6], up: 1, radius: 0.6, life: [0.6, 1.2], size: [0.12, 0.3], gravity: 4, drag: 1.2 });
  }
  /** A right arch: it turns gold and bursts into stars; a little speed boost. */
  cheer(lane: number, combo: number) {
    const g = this.gates.find(x => x.passed && x.lit === 0 && x.d <= this.dist + 2);
    if (g) {
      g.lit = 1;
      g.lanes.forEach((l, k) => {
        if (k === lane) { l.stone.material = this.mats.gold; l.rim.material = this.mats.rimGold; l.portal.material = this.mats.portalGold; }
        else { l.stone.material = this.mats.dim; l.portal.visible = false; }
      });
      const at = g.group.localToWorld(new THREE.Vector3(LANES[lane], ARCH_H, 0));
      this.fx.emit({ at, count: 40, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xffb81f], speed: [2, 5], radius: 0.8, life: [0.6, 1.1], size: [0.16, 0.34], drag: 1.4 });
    }
    const w = this.rig.localToWorld(new THREE.Vector3(0, 1.4, -0.6));
    this.fx.emit({ at: w, count: 22 + Math.min(40, combo * 4), shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0x8fd3ff], speed: [2, 5], radius: 0.5, life: [0.5, 1], size: [0.14, 0.3], drag: 1.6 });
    this.slow = Math.min(1.25, this.slow + 0.12);
  }
  /** A wrong arch shatters into ice. */
  shatter(lane: number) {
    const g = this.gates.find(x => x.passed && x.lit === 0 && x.d <= this.dist + 2);
    if (!g) return;
    g.lit = -1;
    const l = g.lanes[lane];
    const at = g.group.localToWorld(new THREE.Vector3(LANES[lane], 1.3, 0));
    l.group.visible = false;
    this.fx.emit({ at, count: 60, shape: 'shard', color: [0xcfefff, 0x9fd8ff, 0xffffff, 0xb3c2d4], speed: [2, 6], radius: 0.8, life: [0.6, 1.2], size: [0.14, 0.3], gravity: 7, spin: 9 });
    // the answer's arch glows so you see where it was
    const right = g.lanes[g.spec.right];
    right.rim.material = this.mats.rimGold; right.portal.material = this.mats.portalGold;
  }
  /** The end of the round: slow to a stop. */
  finish() { this.running = false; this.finishing = 1; }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.t = t;
    if (!this.paused) {
      if (this.running) {
        this.runT += dt;
        this.slow += (1 - this.slow) * Math.min(1, dt * 0.9);
        this.turbo = Math.max(0, this.turbo - dt); this.burst = Math.max(0, this.burst - dt);
        // the speed builds as the run goes and with every right answer in a row; turbo and boost rings on top
        const cruise = Math.min(CRUISE_TOP, this.base + this.runT * 0.14 + Math.min(9, this.streak * 0.6));
        const target = Math.min(SPEED_MAX, cruise * (this.turbo > 0 ? TURBO.mult : 1) * (this.burst > 0 ? 1.3 : 1) * this.slow);
        this.speed += (target - this.speed) * Math.min(1, dt * (target > this.speed ? 2.2 : 1.5));
      } else if (this.finishing) {
        this.speed = Math.max(0, this.speed - dt * 9);
      }
      this.dist += this.speed * dt;
      sfx.wind(this.speed / SPEED_MAX);
      // gates: reached?
      for (const g of this.gates) {
        if (g.passed || g.d > this.dist) continue;
        g.passed = true;
        const lane = (this.lane + 1) as 0 | 1 | 2;
        const near = this.t - this.lastLaneT < 0.3;
        this.onGate?.(lane, g.spec, near);
      }
      // gates far behind go away
      while (this.gates.length && this.gates[0].d < this.dist - 30) { const g = this.gates.shift()!; g.lanes.forEach(l => disposeSprite(l.label)); g.group.removeFromParent(); }
      // boost rings: ride through one for a burst of speed
      for (const r of this.rings) {
        if (r.passed || r.d > this.dist) continue;
        r.passed = true;
        const hit = this.lane + 1 === r.lane;
        if (hit) {
          this.burst = 1.6;
          const at = r.group.localToWorld(new THREE.Vector3(0, 1.15, 0));
          this.fx.emit({ at, count: 60, shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0xffb21f], speed: [3, 7], radius: 0.9, life: [0.5, 1], size: [0.16, 0.34], drag: 1.3 });
          r.group.visible = false;
        }
        this.onRing?.(hit);
      }
      while (this.rings.length && this.rings[0].d < this.dist - 30) this.rings.shift()!.group.removeFromParent();
    }
    // the treadmill
    this.track.position.z = this.dist;
    this.layoutStrips();
    // steering: slide across to the lane, leaning into it
    const goal = LANES[this.lane + 1];
    this.x += (goal - this.x) * Math.min(1, dt * 9);
    this.lean += (0 - this.lean) * Math.min(1, dt * 4);
    if (this.spinV > 0) { this.spin += this.spinV * dt; if (this.spin >= Math.PI * 2) { this.spin = 0; this.spinV = 0; } }
    this.bump = Math.max(0, this.bump - dt);
    this.place(dt);
    // gate numbers pop in and bob; the glow inside the arches shimmers
    for (const g of this.gates) for (const l of g.lanes) {
      l.portal.scale.y = 1 + Math.sin(t * 4 + g.d) * 0.02;
      const lab = l.label;
      if (!lab.visible) continue;
      lab.userData.pop = Math.min(1, (lab.userData.pop ?? 1) + dt * 3.5);
      // the numbers shrink away just before the sled goes under them (they'd fill the screen)
      const near = Math.max(0, Math.min(1, (g.d - this.dist - 1.5) / 5));
      const k = lab.userData.pop, e = near * Math.min(1, k * 1.6) * (1 + Math.sin(Math.min(1, k) * Math.PI) * 0.25);
      const base = 1.05 * Math.max(0.01, e), img = lab.material.map!.image as HTMLCanvasElement;
      lab.scale.set(base * (img.width / img.height), base, 1);
      lab.position.y = ARCH_H - 0.05 + Math.sin(t * 3 + (lab.userData.k ?? 0)) * 0.05;
    }
    // the boost rings turn and shimmer
    for (const r of this.rings) { const h = r.group.userData.hoop as THREE.Mesh; h.rotation.z = t * 1.6 + r.d; r.group.position.y = ground(LANES[r.lane], r.d) + Math.sin(t * 3 + r.d) * 0.06; }
    // runner spray while moving fast (more of it the faster you go); a streak of turbo sparks behind
    if (this.speed > 5 && Math.random() < dt * this.speed * 1.6) this.spray(3 + Math.floor(this.speed / 12));
    if ((this.turbo > 0 || this.burst > 0) && !this.paused) {
      const w = this.rig.localToWorld(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.35, 0.9));
      this.fx.emit({ at: w, count: 3, shape: ['spark', 'dot'], color: this.turbo > 0 ? [0x7fe0ff, 0xffffff, 0x4fa8ff] : [0xffe066, 0xffffff], speed: [1, 3], dir: new THREE.Vector3(0, 0.2, 1), spread: 0.4, radius: 0.15, life: [0.3, 0.6], size: [0.1, 0.22], drag: 1 });
    }
    // falling snow drifts toward the camera with the speed
    const sp = this.snow.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * 1.2, z = sp.getZ(i) + dt * this.speed * 0.9;
      if (y < -3 || z > 10) { y = 12 + Math.random() * 8; z = -40 - Math.random() * 10; sp.setX(i, (Math.random() - 0.5) * 40); }
      sp.setY(i, y); sp.setZ(i, z);
    }
    sp.needsUpdate = true;
    this.fx.update(dt, t);
    this.camera(dt);
  }
  /** The sled and the buddy on it, at the steering position. */
  private place(dt: number) {
    const me = this.me;
    const wobble = Math.sin(this.t * 13) * 0.012 * Math.min(1, this.speed / 10) + this.bump * Math.sin(this.t * 40) * 0.08;
    this.rig.position.set(this.x, wobble, 0);
    this.rig.rotation.set(0, this.spin, this.spinV ? 0 : -this.lean * 0.35);
    me.update(dt);
    if (this.finishing && this.speed < 0.2) {
      // off the sled at the bottom to celebrate beside it, facing the camera
      me.groundFeet = true;
      me.root.position.set(-1.0, 0, 0.3);
      me.root.rotation.set(0, 0.3, 0);
      if (!this.cheered) { this.cheered = true; me.play(me.has('cheer') ? 'cheer' : me.has('jump') ? 'jump' : 'idle', 0.3); }
      return;
    }
    // sitting on the sled: hips on the deck, legs out along it, hands on the sides
    me.groundFeet = false;
    me.play(me.has('sit') ? 'sit' : me.has('seated') ? 'seated' : 'idle', 0.25);
    me.root.position.set(0, 0, 0.05);
    me.root.rotation.set(0, Math.PI, 0);
    this.rig.updateMatrixWorld(true);
    sitOnSled(me, this.sled.group, dt);
  }
  private camera(dt: number) {
    const cam = stage.camera;
    const narrow = cam.aspect < 0.8;
    // low behind the sled, like riding along; on a phone further back so all three arches fit
    // (a little further back at high speed and with the turbo on, so it feels like a rush)
    const rush = Math.min(1, Math.max(0, this.speed - 18) / 25);
    const back = (narrow ? 7.4 : 4.9) + rush * 0.9, up = (narrow ? 3.2 : 2.3) - rush * 0.25;
    const ending = this.finishing && this.speed < 3;
    const want = this.world.localToWorld(ending ? new THREE.Vector3(this.x + 1.2, 1.6, 4.2) : new THREE.Vector3(this.x * 0.6, up, back));
    const aim = this.world.localToWorld(ending ? new THREE.Vector3(this.x - 0.6, 0.9, 0) : new THREE.Vector3(this.x * 0.65, 1.1, -11));
    if (!this.camReady) { this.camPos.copy(want); this.camAim.copy(aim); this.camReady = true; }
    this.camPos.lerp(want, Math.min(1, dt * (ending ? 2 : 5))); this.camAim.lerp(aim, Math.min(1, dt * (ending ? 2 : 6)));
    cam.position.copy(this.camPos);
    // a touch of shake on a crash
    if (this.bump > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.bump * 0.25, (Math.random() - 0.5) * this.bump * 0.25, 0));
    // a little buzz at top speed
    if (this.speed > 32 && !this.paused) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.03, 0));
    cam.fov = (narrow ? 64 : 58) + Math.min(20, Math.max(0, this.speed - 9) * 0.55) + (this.turbo > 0 ? 6 : 0);
    cam.updateProjectionMatrix();
    cam.lookAt(this.camAim);
    this.fx.setScale(innerHeight, cam.fov);
    // the sun's shadows follow the sled
    const f = this.rig.getWorldPosition(new THREE.Vector3());
    this.sun.position.copy(f).add(new THREE.Vector3(-12, 16, -22));
    this.sun.target.position.copy(f).add(new THREE.Vector3(0, 0, -6));
  }
  /** Where the buddy's head is on the screen (0..1 across and down), for the score pops. */
  screenAt() { const v = this.rig.localToWorld(new THREE.Vector3(0, 1.9, 0)).project(stage.camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }
  focus() { return this.rig.getWorldPosition(new THREE.Vector3()); }
  dispose() {
    this.me.dispose();
    for (const g of this.gates) { g.lanes.forEach(l => disposeSprite(l.label)); g.group.removeFromParent(); }
    for (const r of this.rings) r.group.removeFromParent();
    this.pines?.dispose(); this.rocks?.dispose();
    this.posts.dispose(); this.rails.dispose(); this.flags.dispose();
    this.sled.dispose();
    this.fx.dispose();
    this.own.forEach(o => o.dispose());
    this.island.root.removeFromParent();
    this.island.dispose();
  }
}
