// What the course kits share (climbKit, sledKit, swimKit): a buddy's measurements, a few easing curves, and
// the little effects that make speed something you can see: a spray of snow or water, and streaks rushing
// past. No lights are added here or anywhere in a kit: a new light recompiles every material mid-game.
import * as THREE from 'three';
import type { Character } from './character';
import { fitOf, hw, skinned } from './gear3d';

type V = THREE.Vector3;
export const frac = (x: number) => x - Math.floor(x);
export const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };
/** a little too far, then settles: gear popping on */
export const backOut = (x: number) => { const k = Math.min(1, x) - 1; return 1 + 2.7 * k * k * k + 1.7 * k * k; };
const UP = new THREE.Vector3(0, 1, 0);

/** A buddy's measurements in metres, feet on the ground: shoulders and hips (height, half width), arm and leg length, ankle height. */
export function measure(c: Character) {
  const f = fitOf(c), k = hw(c) / f.H, B = c.bones, sk = skinned(c).find(m => m.skeleton.bones.includes(B.Hips));
  if (!sk) return null;
  const at = (n: string) => new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.skeleton.boneInverses[sk.skeleton.bones.indexOf(B[n])]).invert());
  const near = (a: string, b: string) => at(a).distanceTo(at(b)) * k, above = (n: string) => (at(n).y - f.minY) * k, side = (a: string, b: string) => Math.abs(at(a).x - at(b).x) / 2 * k;
  return {
    H: hw(c), sy: above('LeftArm'), sx: side('LeftArm', 'RightArm'), hy: above('LeftUpLeg'), hx: side('LeftUpLeg', 'RightUpLeg'),
    arm: near('LeftArm', 'LeftForeArm') + near('LeftForeArm', 'LeftHand'), leg: near('LeftUpLeg', 'LeftLeg') + near('LeftLeg', 'LeftFoot'), ankle: above('LeftFoot'),
  };
}
export type Sizes = NonNullable<ReturnType<typeof measure>>;
/** How a bone is turned in the buddy's own standing pose. */
export const bindTurn = (c: Character, bone: string) => {
  const sk = skinned(c).find(m => m.skeleton.bones.includes(c.bones[bone]))!, q = new THREE.Quaternion();
  new THREE.Matrix4().copy(sk.skeleton.boneInverses[sk.skeleton.bones.indexOf(c.bones[bone])]).invert().decompose(new THREE.Vector3(), q, new THREE.Vector3());
  return q;
};
/** A ring round a body at a height, from the body's own shape there, a little out. */
export function ringRound(pts: V[], y: number, band: number) {
  const near = pts.filter(p => Math.abs(p.y - y) < band);
  if (near.length < 12) return null;
  const xs = near.map(p => p.x).sort((a, b) => a - b), zs = near.map(p => p.z).sort((a, b) => a - b), q = (a: number[], p: number) => a[Math.floor(p * (a.length - 1))];
  const x0 = q(xs, 0.03), x1 = q(xs, 0.97), z0 = q(zs, 0.03), z1 = q(zs, 0.97);
  return { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 };
}
export function ellipseCurve(rx: number, rz: number) {
  return new THREE.CatmullRomCurve3(Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * Math.PI * 2; return new THREE.Vector3(Math.sin(a) * rx, 0, Math.cos(a) * rz); }), true);
}
/** Stretch a one-metre upright stick from a to b. */
export function stretch(m: THREE.Object3D, a: V, b: V) {
  const d = b.clone().sub(a), len = d.length();
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.scale.set(1, Math.max(0.001, len), 1);
}
const wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), dq = new THREE.Quaternion();
/** Turn a bone about a direction in the world, whatever its own axes are. */
export function turnBone(bone: THREE.Object3D, axis: V, angle: number) {
  dq.setFromAxisAngle(axis, angle);
  bone.getWorldQuaternion(wq);
  bone.parent!.getWorldQuaternion(pq);
  bone.quaternion.copy(pq.invert().multiply(dq).multiply(wq));
  bone.updateMatrixWorld(true);
}

/** What a sled or swim course tells its kit each frame. */
export type RideState = {
  /** the speed step (0 to 5) */
  step: number;
  /** the buddy's place on the course (before any lean or hop) */
  at: V;
  /** how steeply the course falls here */
  pitch: number;
  /** across the course from the middle (the ghost has a lane of its own) */
  lane: number;
  /** metres a second */
  v: number;
  /** how far along the course */
  s: number;
  /** metres to the finish line */
  left: number;
};
/** The six ways down the slope or across the bay: the same shape as the climb's kit. */
export type RideKit = {
  /** the way of moving showing now */
  readonly way: number;
  /** how much higher the camera should look */
  readonly camUp: number;
  /** how much taller the picture should be */
  readonly camTall: number;
  /** Before the buddy's move plays: which move, and the step changing. */
  lead(dt: number, t: number, s: RideState): void;
  /** After it has played: the buddy's place, hands and feet on their marks, and the gear. */
  follow(dt: number, t: number): void;
  /** Not on the course any more (the dance, the swim steps): everything off. */
  rest(dt: number, t: number): void;
  /** After the run: the ride it finished on, left lying here (false: it finished on the plain sled). */
  park?(at: V, pitch: number): boolean;
  /** Called when a step changes, with where to put a burst. */
  onChange: ((step: number, up: boolean, at: V) => void) | null;
  /** Called on a touch-down that can be heard: `k` is how big. */
  onTouch: ((k: number, at: V) => void) | null;
  /** Get every piece of gear ready to draw, so the first step-up doesn't stall. */
  ready(): Promise<void>;
  dispose(): void;
};

/** Soft blobs of snow or water, one draw for the lot. They fly, fall, swell and fade. */
export class Spray {
  readonly mesh: THREE.InstancedMesh;
  private ps: { life: number; max: number; p: V; v: V; s: number; grow: number; fall: number; a: number }[];
  private tint: THREE.InstancedBufferAttribute;
  private o = new THREE.Object3D();
  private i = 0;
  constructor(parent: THREE.Object3D, n = 90, edge = 0.35) {
    const geo = new THREE.PlaneGeometry(1, 1);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    this.tint.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aTint', this.tint);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute vec4 aTint; varying vec4 vT; varying vec2 vU; void main(){ vT = aTint; vU = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec4 vT; varying vec2 vU; void main(){ float d = length(vU - 0.5) * 2.0; float a = (1.0 - smoothstep(' + edge.toFixed(2) + ', 1.0, d)) * vT.a; if (a < 0.01) discard; gl_FragColor = vec4(vT.rgb, a); }',
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 2;
    this.ps = Array.from({ length: n }, () => ({ life: 9, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0.2, grow: 1, fall: 0, a: 0.9 }));
    parent.add(this.mesh);
    this.o.scale.setScalar(0);
    this.o.updateMatrix();
    for (let k = 0; k < n; k++) this.mesh.setMatrixAt(k, this.o.matrix);
  }
  /** One blob: where, how fast, how big, how long, how much it swells, how fast it falls, its colour. */
  emit(at: V, vx: number, vy: number, vz: number, size: number, life: number, grow = 1.4, fall = 3, color: [number, number, number] = [1, 1, 1], alpha = 0.9) {
    const q = this.ps[this.i];
    q.life = 0; q.max = life; q.p.copy(at); q.v.set(vx, vy, vz); q.s = size; q.grow = grow; q.fall = fall; q.a = alpha;
    this.tint.setXYZ(this.i, color[0], color[1], color[2]);
    this.i = (this.i + 1) % this.ps.length;
  }
  update(dt: number, cam: THREE.Camera) {
    const o = this.o;
    this.ps.forEach((q, i) => {
      if (q.life >= q.max) return;
      q.life += dt;
      const k = q.life / q.max;
      if (k >= 1) { o.scale.setScalar(0); o.position.set(0, -999, 0); this.tint.setW(i, 0); }
      else {
        q.v.y -= q.fall * dt;
        q.p.addScaledVector(q.v, dt);
        o.position.copy(q.p); o.quaternion.copy(cam.quaternion);
        o.scale.setScalar(q.s * (1 + k * q.grow));
        this.tint.setW(i, q.a * (k < 0.1 ? k * 10 : 1 - (k - 0.1) / 0.9));
      }
      o.updateMatrix(); this.mesh.setMatrixAt(i, o.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.tint.needsUpdate = true;
  }
  clear() { for (const q of this.ps) q.life = Math.min(q.life, q.max - 1e-3); }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); }
}

/** Streaks rushing past the buddy along the course: more, longer and brighter each step up. One draw. */
export class Streaks {
  readonly mesh: THREE.InstancedMesh;
  private ls: { x: number; y: number; z: number; sp: number; len: number }[];
  private o = new THREE.Object3D();
  private map: THREE.CanvasTexture;
  constructor(parent: THREE.Object3D, n: number, color: number, private readonly box: [number, number, number], private readonly floor: number) {
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8;
    const g = cv.getContext('2d')!, grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.75, 'rgba(255,255,255,0.9)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 2, 64, 4);
    this.map = new THREE.CanvasTexture(cv);
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.map, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }), n);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.ls = Array.from({ length: n }, () => this.fresh({ x: 0, y: 0, z: 0, sp: 1, len: 1 }));
    parent.add(this.mesh);
  }
  private fresh(l: { x: number; y: number; z: number; sp: number; len: number }, x = (Math.random() - 0.5) * 2 * this.box[0]) {
    // (either side of the buddy's lane, never across the buddy itself)
    l.x = x; l.y = this.floor + Math.random() * this.box[1]; l.z = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * this.box[2]); l.sp = 0.7 + Math.random() * 0.6; l.len = 0.6 + Math.random() * 0.8;
    return l;
  }
  /** `level` 0 to 1; at the buddy's place, on the course's slope. */
  update(dt: number, at: V, slope: number, level: number) {
    const m = this.mesh, n = Math.round(this.ls.length * level), o = this.o;
    m.count = n;
    (m.material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.4 * level;
    if (!n) return;
    m.position.copy(at); m.rotation.z = -slope;
    for (let i = 0; i < n; i++) {
      const l = this.ls[i];
      l.x -= dt * l.sp * (3 + 11 * level);
      if (l.x < -this.box[0]) this.fresh(l, this.box[0] + Math.random());
      o.position.set(l.x, l.y, l.z); o.scale.set(l.len * (0.8 + 2 * level), 0.05, 1); o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.map.dispose(); }
}
