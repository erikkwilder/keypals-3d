// Sky Slalom: the buddy races a sled down an endless snowy run on a floating mountain, through ice-arch
// gates. Each gate has three arches with a number over each; the question is on the card at the top of
// the screen, and you steer through the arch with the right answer. The world is a treadmill: the sled
// stays near the middle and the snow, trees and gates slide past, so it can go on as long as a round
// does. Strips of slope are reused as they pass behind the camera, dressed afresh each time.
import * as THREE from 'three';
import { stage, type Controller } from '../stage';
import { Character } from '../character';
import { dressUp } from '../dress';
import { Fx } from '../fx';
import { loadTexture } from '../assets';
import { THEMES } from '../themes';
import type { Island } from '../island';
import type { FriendId } from '../../art/cast';
import { Many, backdrop, fontLoaded, makeSled, plaqueSprite, disposeSprite, skyDome } from './kit';

const SLOPE = 0.2;
const STRIP = 60, STRIPS = 5;
export const LANES = [-2.3, 0, 2.3];
const rand = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2146483646; };

export type GateSpec = { values: [number, number, number]; right: 0 | 1 | 2 };
type Gate = { d: number; spec: GateSpec; group: THREE.Group; arches: THREE.Mesh[]; labels: THREE.Sprite[]; passed: boolean; lit: number; shown: boolean };
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
  base = 9; top = 21;
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
  private flags: THREE.InstancedMesh | null = null;
  private gates: Gate[] = [];
  private snow: THREE.Points;
  private sun: THREE.DirectionalLight;
  private t = 0; private lastLaneT = -9;
  private spin = 0; private spinV = 0; private lean = 0; private bump = 0;
  private slow = 1;
  private finishing = 0; private cheered = false;
  private camPos = new THREE.Vector3(); private camAim = new THREE.Vector3(); private camReady = false;
  private own: { dispose(): void }[] = [];
  private archMat: THREE.MeshStandardMaterial; private archLit: THREE.MeshStandardMaterial; private archDim: THREE.MeshStandardMaterial;
  private archGeo: THREE.TubeGeometry; private icicleGeo: THREE.ConeGeometry; private moundGeo: THREE.SphereGeometry; private moundMat: THREE.MeshStandardMaterial;

  private constructor(island: Island, me: Character, sled: { group: THREE.Group; dispose(): void }, snowMat: THREE.MeshStandardMaterial, many: (Many | null)[]) {
    this.island = island; this.me = me; this.sled = sled;
    [this.pines, this.rocks] = many;
    const root = island.root;
    this.world.rotation.x = -Math.atan(SLOPE);
    root.add(this.world);
    this.world.add(this.track);
    // the slope: strips of groomed snow, banked up at the sides
    const geo = new THREE.PlaneGeometry(46, STRIP, 46, 30);
    const p = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), ax = Math.abs(x);
      const bank = ax > 4.6 ? Math.pow(ax - 4.6, 1.35) * 0.32 + Math.sin(x * 0.7 + y * 0.31) * 0.35 : Math.sin(y * 0.4) * 0.03;
      p.setZ(i, bank);
    }
    geo.computeVertexNormals();
    this.own.push(geo);
    for (let i = 0; i < STRIPS; i++) {
      const mesh = new THREE.Mesh(geo, snowMat);
      mesh.rotation.x = -Math.PI / 2; mesh.receiveShadow = true;
      this.track.add(mesh);
      this.strips.push({ mesh, i: -1 });
    }
    // edge lines either side of the run
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x8fc0ff, transparent: true, opacity: 0.5 });
    const lineGeo = new THREE.PlaneGeometry(0.14, STRIP * STRIPS);
    this.own.push(lineMat, lineGeo);
    for (const x of [-4.1, 4.1]) { const l = new THREE.Mesh(lineGeo, lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, -STRIP * STRIPS / 2 + 20); this.world.add(l); }
    for (const m of many) if (m) this.track.add(m.group);
    // bunting along the fences: little painted triangle flags
    const flagGeo = new THREE.BufferGeometry();
    flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.16, 0, 0, 0.16, 0, 0, 0, -0.32, 0]), 3));
    flagGeo.computeVertexNormals();
    const flagMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 });
    this.own.push(flagGeo, flagMat);
    this.flags = new THREE.InstancedMesh(flagGeo, flagMat, 2 * STRIPS * 24);
    this.flags.frustumCulled = false;
    this.track.add(this.flags);
    // gates: icy arches
    this.archGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, k) => { const a = (k / 16) * Math.PI; return new THREE.Vector3(Math.cos(a) * 0.95, Math.sin(a) * 1.75, 0); })), 40, 0.13, 10, false);
    this.icicleGeo = new THREE.ConeGeometry(0.06, 0.32, 6);
    this.moundGeo = new THREE.SphereGeometry(0.35, 12, 8);
    this.archMat = new THREE.MeshStandardMaterial({ color: 0xc8ecff, emissive: 0x4aa8ff, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.92 });
    this.archLit = new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffb81f, emissiveIntensity: 1.2, roughness: 0.2 });
    this.archDim = new THREE.MeshStandardMaterial({ color: 0x9fb3c8, emissive: 0x334455, emissiveIntensity: 0.2, roughness: 0.4, transparent: true, opacity: 0.55 });
    this.moundMat = snowMat;
    this.own.push(this.archGeo, this.icicleGeo, this.moundGeo, this.archMat, this.archLit, this.archDim);
    // the rider
    this.world.add(this.rig);
    this.rig.add(sled.group);
    sled.group.rotation.y = Math.PI / 2;
    // the buddy rides in the rig, facing down the hill like the sled
    this.rig.add(me.root);
    // falling snow round the camera
    const n = 900, pos = new Float32Array(n * 3), r = rand(5);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 40; pos[i * 3 + 1] = r() * 22; pos[i * 3 + 2] = -r() * 50 + 8; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1, transparent: true, opacity: 0.85, depthWrite: false }));
    this.own.push(sg, this.snow.material as THREE.Material);
    root.add(this.snow);
    // light: a low warm sun for long shadows, cool fill from the sky
    const hemi = new THREE.HemisphereLight(0xdcefff, 0x9fb6d6, 1.25);
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0005; this.sun.shadow.normalBias = 0.03;
    root.add(hemi, this.sun, this.sun.target);
    root.add(this.fx.root);
    this.layoutStrips(true);
    this.place(0);
  }

  static async create(o: { buddy: FriendId; seed: number }): Promise<SlalomScene> {
    await fontLoaded();
    const theme = { ...THEMES.ridge };
    const root = new THREE.Group();
    const snowTex = await loadTexture('world/snow.webp', { repeat: true, color: true });
    if (snowTex) { snowTex.repeat.set(10, 14); snowTex.anisotropy = 8; }
    const snowMat = new THREE.MeshStandardMaterial({ map: snowTex, color: 0xffffff, roughness: 0.82 });
    const [me, sled, pines, rocks, bg] = await Promise.all([
      Character.create(o.buddy), makeSled(),
      Many.load('world/pine_tree.glb', 5, STRIPS * 22), Many.load('world/boulder.glb', 1.2, STRIPS * 6),
      backdrop('arcade/bg-slalom.webp', 420, 330),
    ]);
    if (!me) throw new Error('character missing');
    void dressUp(me);
    await me.loadMoves();
    // the sky and the painted mountains far off
    root.add(skyDome(0x7fb8f2, 0xcfe4fb, 0xfbe3ef));
    if (bg) { bg.position.set(0, 40, 0); root.add(bg); }
    const own: { dispose(): void }[] = [snowMat];
    const island: Island = {
      trail: { length: 1e6, at: () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(0, 0, -1), n: new THREE.Vector3(1, 0, 0) }) },
      height: () => 0, placeFinish: () => {}, gateSolid: () => {}, setSmooth: () => {},
      update: () => {}, root, theme, stats: {},
      dispose: () => own.forEach(x => x.dispose()),
    };
    const sc = new SlalomScene(island, me, sled, snowMat, [pines, rocks]);
    return sc;
  }

  // ---------- the course ----------
  /** Put each strip of slope where it belongs and dress it (trees, rocks, flags) when it moves up. */
  private layoutStrips(first = false) {
    const head = Math.floor(this.dist / STRIP);
    for (let k = 0; k < STRIPS; k++) {
      const i = head - 1 + k; // one strip behind, the rest ahead
      const s = this.strips[((i % STRIPS) + STRIPS) % STRIPS];
      if (s.i === i && !first) continue;
      s.i = i;
      s.mesh.position.set(0, 0, -(i * STRIP + STRIP / 2));
      this.dress(((i % STRIPS) + STRIPS) % STRIPS, i);
    }
    this.pines?.commit(); this.rocks?.commit();
    if (this.flags) this.flags.instanceMatrix.needsUpdate = true;
  }
  private dress(slot: number, i: number) {
    const r = rand(1000 + i * 7919);
    const z0 = -i * STRIP;
    if (this.pines) for (let k = 0; k < 22; k++) {
      const side = k % 2 ? 1 : -1, x = side * (6.5 + Math.pow(r(), 0.9) * 16), z = z0 - r() * STRIP;
      this.pines.set(slot * 22 + k, x, Math.pow(Math.max(0, Math.abs(x) - 4.6), 1.35) * 0.32 - 0.1, z, 0.7 + r() * 0.8, r() * 6);
    }
    if (this.rocks) for (let k = 0; k < 6; k++) {
      const side = r() < 0.5 ? 1 : -1, x = side * (5.2 + r() * 9), z = z0 - r() * STRIP;
      this.rocks.set(slot * 6 + k, x, Math.pow(Math.max(0, Math.abs(x) - 4.6), 1.35) * 0.32 - 0.15, z, 0.5 + r() * 1.1, r() * 6);
    }
    // bunting: a string of flags along each fence line
    if (this.flags) {
      const cols = [0xff6f91, 0xffc93d, 0x4fc3f7, 0x7ed957, 0xb388ff, 0xff9f43];
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
      for (let side = 0; side < 2; side++) for (let k = 0; k < 24; k++) {
        const idx = slot * 48 + side * 24 + k, z = z0 - (k + 0.5) * (STRIP / 24), x = side ? 4.9 : -4.9;
        const sag = Math.sin(((k % 6) / 6) * Math.PI) * 0.18;
        q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
        m.compose(new THREE.Vector3(x, 1.25 - sag, z), q, new THREE.Vector3(1, 1, 1));
        this.flags.setMatrixAt(idx, m);
        this.flags.setColorAt(idx, c.setHex(cols[(k + i) % cols.length]));
      }
      if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
    }
  }

  /** Add a gate `d` metres down the run. */
  addGate(d: number, spec: GateSpec) {
    const g = new THREE.Group();
    g.position.set(0, 0, -d);
    const arches: THREE.Mesh[] = [], labels: THREE.Sprite[] = [];
    LANES.forEach((x, k) => {
      const a = new THREE.Mesh(this.archGeo, this.archMat);
      a.position.set(x, 0, 0); a.castShadow = true;
      g.add(a); arches.push(a);
      for (let j = 0; j < 5; j++) { const ic = new THREE.Mesh(this.icicleGeo, this.archMat); const ang = (0.2 + j * 0.15) * Math.PI; ic.position.set(x + Math.cos(ang) * 0.95, Math.sin(ang) * 1.75 - 0.2, 0); ic.rotation.z = Math.PI; g.add(ic); }
      for (const sx of [-0.95, 0.95]) { const mound = new THREE.Mesh(this.moundGeo, this.moundMat); mound.position.set(x + sx, 0.02, 0); mound.scale.set(1, 0.55, 1); mound.receiveShadow = true; g.add(mound); }
      const lab = plaqueSprite(String(spec.values[k]), 0.85, { bg: ['#ffffff', '#dff1ff'], ink: '#1d3f75', edge: '#ffffff', glow: 'rgba(80,160,255,0.6)' });
      lab.position.set(x, 2.45, 0);
      lab.visible = false;
      g.add(lab); labels.push(lab);
    });
    this.track.add(g);
    this.gates.push({ d, spec, group: g, arches, labels, passed: false, lit: 0, shown: false });
  }
  /** Show the numbers on the next gate (the one the question card is about). */
  showGate(d: number) { const g = this.gates.find(x => x.d === d); if (g) { g.shown = true; g.labels.forEach((l, k) => { l.visible = true; l.scale.multiplyScalar(0.2); l.userData.pop = 0; l.userData.k = k; }); } }
  /** The distance to the next gate not yet passed (Infinity if none). */
  nextGate() { return this.gates.find(g => !g.passed)?.d ?? Infinity; }

  // ---------- steering ----------
  steer(dir: -1 | 1) {
    if (!this.running || this.paused) return;
    const l = Math.max(-1, Math.min(1, this.lane + dir));
    if (l === this.lane) return;
    this.lane = l; this.lastLaneT = this.t;
    this.lean = dir * 0.55;
    this.spray(18, dir);
  }
  steerTo(l: -1 | 0 | 1) { if (l !== this.lane) this.steer(l > this.lane ? 1 : -1); if (l !== this.lane) this.steer(l > this.lane ? 1 : -1); }
  /** Snow kicked up behind the runners (thrown back toward the camera, as the slope rushes past). */
  private spray(n: number, side = 0) {
    const w = this.rig.localToWorld(new THREE.Vector3(side * 0.3, 0.12, 0.55));
    this.fx.emit({ at: w, count: n, shape: ['dot', 'flake'], color: [0xffffff, 0xe8f4ff], speed: [2, 3.5 + this.speed * 0.25], dir: new THREE.Vector3(-side * 0.8, 0.7, 1), spread: 0.45, radius: 0.2, life: [0.35, 0.8], size: [0.08, 0.22], gravity: 4, drag: 1.2 });
  }

  /** A crash (the wrong arch): the sled spins out in a burst of snow, slows, and carries on. */
  crash() {
    this.spinV = Math.PI * 2 / 0.75; this.spin = 0;
    this.slow = 0.45;
    this.bump = 0.35;
    const w = this.rig.localToWorld(new THREE.Vector3(0, 0.5, 0));
    this.fx.emit({ at: w, count: 70, shape: ['dot', 'flake'], color: [0xffffff, 0xdcefff], speed: [2, 6], up: 1, radius: 0.5, life: [0.6, 1.2], size: [0.1, 0.26], gravity: 4, drag: 1.2 });
  }
  /** A right arch: it lights gold and bursts into stars; a little speed boost. */
  cheer(lane: number, combo: number) {
    const g = this.gates.find(x => x.passed && x.lit === 0 && x.d <= this.dist + 2);
    if (g) {
      g.lit = 1;
      g.arches[lane].material = this.archLit;
      g.arches.forEach((a, k) => { if (k !== lane) a.material = this.archDim; });
    }
    const w = this.rig.localToWorld(new THREE.Vector3(0, 1.6, -1));
    this.fx.emit({ at: w, count: 26 + Math.min(40, combo * 4), shape: ['star', 'spark'], color: [0xffe066, 0xffffff, 0x8fd3ff], speed: [2, 5], radius: 0.6, life: [0.5, 1], size: [0.14, 0.3], drag: 1.6 });
    this.slow = Math.min(1.25, this.slow + 0.12);
  }
  /** A wrong arch shatters into ice. */
  shatter(lane: number) {
    const g = this.gates.find(x => x.passed && x.lit === 0 && x.d <= this.dist + 2);
    if (!g) return;
    g.lit = -1;
    const at = g.group.localToWorld(new THREE.Vector3(LANES[lane], 1.2, 0));
    g.arches[lane].visible = false;
    this.fx.emit({ at, count: 40, shape: 'shard', color: [0xcfefff, 0x9fd8ff, 0xffffff], speed: [2, 5], radius: 0.6, life: [0.6, 1.1], size: [0.12, 0.26], gravity: 6, spin: 8 });
  }
  /** The end of the round: slow to a stop. */
  finish() { this.running = false; this.finishing = 1; }

  // ---------- each frame ----------
  update(dt: number, t: number) {
    this.t = t;
    if (!this.paused) {
      if (this.running) {
        this.slow += (1 - this.slow) * Math.min(1, dt * 0.9);
        const target = Math.min(this.top, this.base + this.dist * 0.012);
        this.speed += (target * this.slow - this.speed) * Math.min(1, dt * 1.5);
      } else if (this.finishing) {
        this.speed = Math.max(0, this.speed - dt * 9);
      }
      this.dist += this.speed * dt;
      // gates: reached?
      for (const g of this.gates) {
        if (g.passed || g.d > this.dist) continue;
        g.passed = true;
        const lane = (this.lane + 1) as 0 | 1 | 2;
        const near = this.t - this.lastLaneT < 0.3;
        this.onGate?.(lane, g.spec, near);
      }
      // gates far behind go away
      while (this.gates.length && this.gates[0].d < this.dist - 30) { const g = this.gates.shift()!; g.labels.forEach(disposeSprite); g.group.removeFromParent(); }
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
    // gate labels pop in and bob
    for (const g of this.gates) for (const l of g.labels) {
      if (!l.visible) continue;
      l.userData.pop = Math.min(1, (l.userData.pop ?? 1) + dt * 4);
      const k = l.userData.pop, e = 1 + Math.sin(k * Math.PI) * 0.25;
      const base = 0.85 * e, img = l.material.map!.image as HTMLCanvasElement;
      l.scale.set(base * (img.width / img.height), base, 1);
      l.position.y = 2.45 + Math.sin(t * 3 + (l.userData.k ?? 0)) * 0.06;
    }
    // runner spray while moving fast
    if (this.speed > 6 && Math.random() < dt * this.speed * 1.2) this.spray(2);
    // falling snow drifts toward the camera with the speed
    const sp = this.snow.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) {
      let y = sp.getY(i) - dt * 1.2, z = sp.getZ(i) + dt * this.speed * 0.9;
      if (y < -2 || z > 10) { y = 14 + Math.random() * 8; z = -40 - Math.random() * 10; sp.setX(i, (Math.random() - 0.5) * 40); }
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
    // sitting on the sled, legs forward (the chair pose), hips on the deck
    me.groundFeet = false;
    me.play(me.has('sit') ? 'sit' : me.has('seated') ? 'seated' : 'idle', 0.25);
    me.root.position.set(0, 0, 0.05);
    me.root.rotation.set(0, Math.PI, 0);
    this.rig.updateMatrixWorld(true);
    const hips = me.bones.Hips?.getWorldPosition(new THREE.Vector3());
    if (hips) me.root.position.y += 0.3 - this.rig.worldToLocal(hips).y;
  }
  private camera(dt: number) {
    const cam = stage.camera;
    const narrow = innerWidth / innerHeight < 0.8;
    const back = narrow ? 8.5 : 6.6, up = narrow ? 4.2 : 3.3;
    const want = this.world.localToWorld(new THREE.Vector3(this.x * 0.55, up, back));
    const aim = this.world.localToWorld(new THREE.Vector3(this.x * 0.7, 0.9, -9));
    if (!this.camReady) { this.camPos.copy(want); this.camAim.copy(aim); this.camReady = true; }
    this.camPos.lerp(want, Math.min(1, dt * 5)); this.camAim.lerp(aim, Math.min(1, dt * 6));
    cam.position.copy(this.camPos);
    // a touch of shake on a crash
    if (this.bump > 0) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * this.bump * 0.25, (Math.random() - 0.5) * this.bump * 0.25, 0));
    cam.fov = 56 + Math.min(10, Math.max(0, this.speed - 9) * 0.8);
    cam.updateProjectionMatrix();
    cam.lookAt(this.camAim);
    this.fx.setScale(innerHeight, cam.fov);
    // the sun's shadows follow the sled
    const f = this.rig.getWorldPosition(new THREE.Vector3());
    this.sun.position.copy(f).add(new THREE.Vector3(-8, 16, 6));
    this.sun.target.position.copy(f);
  }
  /** Where the buddy's head is on the screen (0..1 across and down), for the score pops. */
  screenAt() { const v = this.rig.localToWorld(new THREE.Vector3(0, 1.9, 0)).project(stage.camera); return { x: (v.x + 1) / 2, y: (1 - v.y) / 2 }; }
  focus() { return this.rig.getWorldPosition(new THREE.Vector3()); }
  dispose() {
    this.me.dispose();
    for (const g of this.gates) { g.labels.forEach(disposeSprite); g.group.removeFromParent(); }
    this.pines?.dispose(); this.rocks?.dispose();
    this.flags?.dispose();
    this.sled.dispose();
    this.fx.dispose();
    this.own.forEach(o => o.dispose());
    this.island.root.removeFromParent();
    this.island.dispose();
  }
}
