// Climbing the cliff: six ways up, like the trail's six rides. Each speed step is its own way of climbing,
// with its own gear on the buddy and its own motion, and changing step is a moment you can't miss:
//   0 Hold On: hands and feet on the holds (the climbing move, nothing else).
//   1 Rope Climber: a harness and a blue rope dropped from the top; leaning back, walking up the wall,
//     hand over hand.
//   2 Spring Boots: big springs under its feet: it squashes on a hold and bounds to the next.
//   3 Grappling Hook: fires a hook up the wall, hangs on the line and zips up it, again and again.
//   4 Jet Pack: two rockets on its back and flames under them; floats up, clear of the wall.
//   5 Rocket Boots: huge boots with long flames, standing tall, one fist up, shooting straight up.
// The poses are worked out from the buddy's own measurements, so every size and shape climbs the same way;
// hands and feet are placed after the buddy's move has played (ik.ts). How far up the wall it is sets the
// motion, so a right answer is what moves it; when it stops it settles into that step's waiting pose. All
// the gear is made and readied when the climb starts, and no lights are added: a step-up never hitches.
import * as THREE from 'three';
import type { Character } from './character';
import { loadTexture } from './assets';
import { stage } from './stage';
import { reach } from './ik';
import { ROCKET, ROCKET_ASPECT, fitOf, latheFromPicture, onBone, painted, points, shadows, showWorn } from './gear3d';
import { backOut, bindTurn, ellipseCurve, frac, measure, ringRound, smooth, stretch } from './kitParts';

export type ClimbState = {
  /** the speed step (0 to 5) */
  step: number;
  /** how far up the wall (the buddy's place before any lean or hop) */
  y: number;
  /** metres a second */
  v: number;
  /** metres one right answer moves it */
  stride: number;
};
export type ClimbKit = {
  /** the way of climbing showing now (0 until the first step-up has begun) */
  readonly way: number;
  /** how much higher the camera should look: more for a hook overhead, less for long flames below */
  readonly camUp: number;
  /** Before the buddy's move plays: its place and lean this frame. */
  lead(dt: number, t: number, s: ClimbState): void;
  /** After it has played: hands and feet on their marks, and the gear. */
  follow(dt: number, t: number): void;
  /** Not climbing (over the top, the dance): everything off. */
  rest(dt: number, t: number): void;
  /** Called when a step changes, with where to put a puff of dust. */
  onChange: ((step: number, up: boolean, at: THREE.Vector3) => void) | null;
  /** Called when something lands on the wall (a spring's bounce, the hook), for a little puff. */
  onTouch: ((at: THREE.Vector3, n: number) => void) | null;
  /** Get every piece of gear ready to draw, so the first step-up doesn't stall. */
  ready(): Promise<void>;
  dispose(): void;
};
type V = THREE.Vector3;
/** Where everything goes this frame. Hands and feet are relative to the buddy's place on the line. */
type Pose = { x: number; z: number; lift: number; lean: number; roll: number; lh: V; rh: V; lf: V; rf: V; /** 1: soles on the wall, 0: flat, below 0: toes down */ tilt: number };
const blankPose = (): Pose => ({ x: 0, z: 0, lift: 0, lean: 0, roll: 0, lh: new THREE.Vector3(), rh: new THREE.Vector3(), lf: new THREE.Vector3(), rf: new THREE.Vector3(), tilt: 0 });
const lerpPose = (o: Pose, a: Pose, b: Pose, k: number) => {
  for (const f of ['x', 'z', 'lift', 'lean', 'roll', 'tilt'] as const) o[f] = a[f] + (b[f] - a[f]) * k;
  for (const f of ['lh', 'rh', 'lf', 'rf'] as const) o[f].lerpVectors(a[f], b[f], k);
};
const UP = new THREE.Vector3(0, 1, 0), ROPE_BLUE = 0x2f7de8, ROPE_X = 0.17;

/** A flame or a jet: two crossed cards hanging from its top, `len` long (scaled to size each frame). */
function jet(len: number, w: number, mat: THREE.Material) {
  const g = new THREE.Group();
  for (const turn of [0, Math.PI / 2]) {
    const fg = new THREE.PlaneGeometry(w, len); fg.translate(0, -len / 2, 0); fg.rotateY(turn);
    const m = new THREE.Mesh(fg, mat); m.frustumCulled = false; g.add(m);
  }
  return g;
}
export async function climbKit(c: Character, env: { wall: (x: number, y: number) => number; top: () => number; ghost?: THREE.Material | null }): Promise<ClimbKit | null> {
  const B = c.bones, f = fitOf(c), b = measure(c);
  if (!b || !f.feet.length || !f.back) return null;
  for (const n of ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Hips', 'Spine02']) if (!B[n]) return null;
  const [springShoe, rocketShoe, chrome, rocketTex, packTex, finTex, flameBase, dot] = await Promise.all([
    painted('gear/tile-sneaker_spring.webp', { repeat: true }), painted('gear/tile-sneaker_rocket.webp', { repeat: true }), painted('gear/tile-chrome.webp', { repeat: true }),
    painted('gear/tex-rocket.webp'), painted('gear/tex-pack.webp', { cut: true }), painted('gear/tex-fin.webp', { cut: true }), loadTexture('gear/tex-flame.webp'), loadTexture('vibes/dot.webp'),
  ]);
  springShoe.roughness = 0.55; rocketShoe.roughness = 0.5;
  // (bind units: H is the buddy's height, `upm` how many make a metre, `s` the gear's measure)
  const H = f.H, upm = H / b.H, s = H * 0.6;
  /** the things that aren't the buddy's own: dropped at the end */
  const own: { dispose(): void }[] = [springShoe, rocketShoe, chrome, rocketTex, packTex, finTex];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  // (the painted flame without the bit of nozzle at its top)
  const flameMap = flameBase ? keep(flameBase.clone()) : null;
  if (flameMap) { flameMap.repeat.set(1, 0.86); flameMap.needsUpdate = true; }
  const fmat = keep(new THREE.MeshBasicMaterial({ map: flameMap, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: env.ghost ? 0.35 : 1 }));

  /** each way's gear (index = the step): what to show, and how big it is when fully on */
  const gear: { o: THREE.Object3D; k: number }[][] = [[], [], [], [], [], []];
  const roots: THREE.Object3D[] = [];
  // (k 0: a piece fitted in the buddy's own space, which doesn't pop)
  const add = (way: number, parent: THREE.Object3D, o: THREE.Object3D, pop = true) => { o.visible = false; parent.add(o); gear[way].push({ o, k: pop ? o.scale.x : 0 }); return o; };
  const bones = new Map<string, THREE.Group>();
  const on = (name: string) => { let g = bones.get(name); if (!g) { g = onBone(c, name)!; bones.set(name, g); roots.push(g); } return g; };
  /** things out in the world (a rope, a line, a hook), not on the buddy */
  const world = new THREE.Group(); world.visible = true; stage.scene.add(world);
  const addW = (way: number, o: THREE.Object3D) => { o.visible = false; world.add(o); gear[way].push({ o, k: 1 }); return o; };

  // ---------- 1: the harness and the rope ----------
  const orange = keep(new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.7 })), gold = keep(new THREE.MeshStandardMaterial({ color: 0xffc23d, roughness: 0.3, metalness: 0.6 }));
  const hipBody = points(c, ['Hips', 'Spine'], 0.3), hipY = f.minY + b.hy * upm + H * 0.05;
  const waist = ringRound(hipBody, hipY, H * 0.03);
  const tie = new THREE.Object3D();
  if (waist) {
    const g = on('Hips'), h = new THREE.Group(), rx = waist.rx * 1.08 + H * 0.02, rz = waist.rz * 1.1 + H * 0.02;
    h.add(new THREE.Mesh(keep(new THREE.TubeGeometry(ellipseCurve(rx, rz), 60, H * 0.016, 8, true)), orange));
    h.children[0].scale.y = 1.7;
    const clip = new THREE.Mesh(keep(new THREE.TorusGeometry(H * 0.03, H * 0.008, 8, 18)), gold); clip.scale.set(0.7, 1.2, 1); clip.position.set(0, -H * 0.01, rz + H * 0.016); h.add(clip);
    tie.position.set(0, -H * 0.01, rz + H * 0.02); h.add(tie);
    h.position.set(waist.cx, hipY, waist.cz);
    add(1, g, h);
  } else { tie.position.set(0, hipY, H * 0.1); on('Hips').add(tie); }
  // a loop round the top of each leg
  for (const side of ['Left', 'Right'] as const) {
    const pts = points(c, [`${side}UpLeg`], 0.5), y = f.minY + b.hy * upm - H * 0.09, r = ringRound(pts, y, H * 0.03);
    if (!r) continue;
    const h = new THREE.Mesh(keep(new THREE.TubeGeometry(ellipseCurve(r.rx + H * 0.008, r.rz + H * 0.008), 40, H * 0.012, 8, true)), orange);
    h.position.set(r.cx, y, r.cz);
    add(1, on(`${side}UpLeg`), h);
  }
  const stick = (r: number, mat: THREE.Material) => { const g = keep(new THREE.CylinderGeometry(r, r, 1, 8)); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m; };
  const ropeMat = keep(new THREE.MeshStandardMaterial({ color: ROPE_BLUE, roughness: 0.7 }));
  const rope = addW(1, stick(0.026, ropeMat)), tail = addW(1, stick(0.02, ropeMat));

  // ---------- 2: the spring boots ----------
  const springs: { coil: THREE.Mesh; pad: THREE.Mesh }[] = [];
  const turns = 4.5, sr = s * 0.078, coilH = s * 0.3;
  const coilGeo = keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 100 }, (_, i) => { const a = (i / 99) * turns * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * sr, (-i / 99) * coilH, Math.sin(a) * sr); })), 220, s * 0.017, 6, false));
  const padGeo = keep(new THREE.CylinderGeometry(sr * 1.5, sr * 1.7, s * 0.024, 20)), plateGeo = keep(new THREE.CylinderGeometry(sr * 1.3, sr * 1.3, s * 0.018, 20));
  const padMat = keep(new THREE.MeshStandardMaterial({ color: 0x7ed321, roughness: 0.6 }));
  for (const ft of f.feet) {
    const g = on(`${ft.side}Foot`), mid = new THREE.Vector3(ft.cx, ft.sole, (ft.heel + ft.toe) / 2);
    if (ft.geo) { const shell = new THREE.Mesh(ft.geo, springShoe); shell.position.copy(mid).multiplyScalar(-0.05); shell.scale.setScalar(1.05); add(2, g, shell, false); }
    const holder = new THREE.Group(); holder.position.copy(mid);
    const coil = new THREE.Mesh(coilGeo, chrome), plate = new THREE.Mesh(plateGeo, padMat), pad = new THREE.Mesh(padGeo, padMat);
    plate.position.y = -s * 0.004;
    holder.add(coil, plate, pad);
    add(2, g, holder); springs.push({ coil, pad });
  }

  // ---------- 3: the grappling hook ----------
  const steel = keep(new THREE.MeshStandardMaterial({ color: 0xc9d2dc, roughness: 0.3, metalness: 0.7 })), red = keep(new THREE.MeshStandardMaterial({ color: 0xe23b3b, roughness: 0.5 }));
  const launcher = new THREE.Group();
  {
    const body = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.06, 0.075, 0.3, 12)), red); body.position.y = 0.08;
    const drum = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.095, 0.095, 0.08, 14)), steel); drum.rotation.z = Math.PI / 2; drum.position.y = -0.03;
    const tip = new THREE.Mesh(keep(new THREE.ConeGeometry(0.062, 0.08, 12)), steel); tip.position.y = 0.27;
    launcher.add(body, drum, tip);
  }
  addW(3, launcher);
  const hook = new THREE.Group();
  {
    const stem = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8)), steel); stem.position.y = -0.04;
    const prong = keep(new THREE.TorusGeometry(0.075, 0.016, 8, 12, Math.PI * 0.72));
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(prong, steel); const a = (i / 3) * Math.PI * 2; p.rotation.y = a; p.position.set(Math.sin(a) * 0.06, 0.06, Math.cos(a) * 0.06); p.rotateZ(Math.PI * 1.1); hook.add(p); }
    hook.add(stem);
  }
  addW(3, hook);
  const line = addW(3, stick(0.014, ropeMat));

  // ---------- 4: the jet pack ----------
  const bk = f.back, pack = new THREE.Group();
  const rh = H * 0.38, rw = rh * ROCKET_ASPECT, gap = Math.max(bk.w * 0.46, rw * 0.72), cy = bk.top - H * 0.15;
  const rocketGeo = keep(latheFromPicture(rh, ROCKET, ROCKET_ASPECT));
  const packFlames: THREE.Group[] = [];
  for (const sd of [-1, 1]) {
    const r = new THREE.Group();
    const m = new THREE.Mesh(rocketGeo, rocketTex); m.rotation.y = Math.PI; r.add(m);
    for (const fs of [-1, 1]) {
      const fg = keep(new THREE.PlaneGeometry(rw * 0.42, rw * 0.7)); fg.translate(rw * 0.21, 0, 0);
      const fm = new THREE.Mesh(fg, finTex); fm.scale.x = fs; fm.position.set(fs * rw * 0.36, -rh * 0.17, 0); fm.rotation.y = Math.PI; r.add(fm);
    }
    const fl = jet(rh * 1.2, rw * 0.95, fmat); fl.position.y = -rh * 0.47; r.add(fl); packFlames.push(fl);
    r.position.set(sd * gap, 0, -rw * 0.55); r.rotation.x = -0.05;
    pack.add(r);
  }
  const plate = new THREE.Mesh(keep(new THREE.PlaneGeometry(gap * 1.5, gap * 1.5 * (256 / 187))), packTex); plate.position.set(0, rh * 0.05, -H * 0.02); plate.rotation.y = Math.PI; pack.add(plate);
  pack.position.set(bk.cx, cy, bk.z);
  add(4, on('Spine02'), pack);

  // ---------- 5: the rocket boots ----------
  const bootFlames: THREE.Group[] = [];
  const bootH = H * 0.4, bootW = bootH * ROCKET_ASPECT, bootGeo = keep(latheFromPicture(bootH, ROCKET, ROCKET_ASPECT));
  const finGeo = keep(new THREE.PlaneGeometry(bootW * 0.5, bootW * 0.85)); finGeo.translate(bootW * 0.25, 0, 0);
  for (const ft of f.feet) {
    // a rocket round the foot and shin, nose up the leg, standing on its flame
    const g = on(`${ft.side}Foot`), holder = new THREE.Group();
    holder.position.set(ft.cx, ft.sole + bootH * 0.44, (ft.heel + ft.toe) / 2);
    const body = new THREE.Mesh(bootGeo, rocketTex); body.rotation.y = Math.PI; holder.add(body);
    for (const sd of [-1, 1]) { const fm = new THREE.Mesh(finGeo, finTex); fm.scale.x = sd; fm.position.set(sd * bootW * 0.34, -bootH * 0.22, 0); fm.rotation.y = Math.PI; holder.add(fm); }
    const fl = jet(H * 0.95, bootW * 1.15, fmat); fl.position.y = -bootH * 0.48; holder.add(fl);
    add(5, g, holder); bootFlames.push(fl);
  }
  for (const w of gear) for (const x of w) shadows(x.o);
  for (const fl of [...packFlames, ...bootFlames]) fl.traverse(o => { o.castShadow = false; });
  if (env.ghost) for (const w of gear) for (const x of w) x.o.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material !== fmat) { m.material = env.ghost!; m.castShadow = false; } });

  // ---------- speed you can see: lines rushing down past it, and sparks under the flames ----------
  const Hm = b.H, fx = new THREE.Group(); world.add(fx);
  const lineMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, vertexColors: true }));
  const lg = keep(new THREE.PlaneGeometry(1, 1, 1, 4));
  { const p = lg.attributes.position as THREE.BufferAttribute, col: number[] = []; for (let i = 0; i < p.count; i++) { const k = 1 - Math.abs(p.getY(i)) * 2; col.push(k, k, k); } lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
  const lines = env.ghost ? [] : Array.from({ length: 16 }, (_, i) => {
    const m = new THREE.Mesh(lg, lineMat), side = i % 2 ? 1 : -1;
    m.userData = { side, x: side * Hm * (0.42 + Math.random() * 0.5), z: Hm * (0.05 + Math.random() * 0.25), y: Math.random() * 2 - 0.5, sp: 0.8 + Math.random() * 0.5 };
    m.visible = false; m.frustumCulled = false; fx.add(m); return m;
  });
  const sparks = env.ghost ? [] : Array.from({ length: 22 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: 0xffd36b, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.visible = false; sp.userData = { life: 9, v: new THREE.Vector3() }; sp.frustumCulled = false; fx.add(sp); keep(sp.material); return sp;
  });

  // ---------- the six poses ----------
  const S = { y: 0, t: 0, v: 0, m: 0, stride: 1 };
  /** the rock's face near the climbing line, smoothed (the bumps shouldn't jolt the whole buddy) */
  const faceAt = (y: number) => (env.wall(0, y - 0.3) + env.wall(0, y) + env.wall(0, y + 0.3)) / 3;
  const rockAt = (x: number, y: number) => env.wall(x, y);
  /** one bound of the spring boots: an answer's stride, or a few keys' worth when typing */
  const hopOf = () => (S.stride >= 0.7 ? S.stride : Math.ceil(0.9 / S.stride) * S.stride);
  const springLen = (up: number) => 0.2 + up * 0.3;
  let hookZ = 0, tieWorld = new THREE.Vector3();
  const poses: ((p: Pose) => void)[] = [
    // Hold On: the climbing move as it is
    p => {
      p.x = p.z = p.lift = p.lean = p.roll = p.tilt = 0;
      const W = faceAt(S.y) + 0.1;
      p.lh.set(-b.sx - 0.05, b.sy + b.arm * 0.3, W); p.rh.set(b.sx + 0.05, b.sy + b.arm * 0.5, W);
      p.lf.set(-b.hx, b.ankle + 0.05, W + 0.1); p.rf.set(b.hx, b.ankle + 0.15, W + 0.1);
    },
    // Rope Climber: feet on the wall, leaning back on the rope, hand over hand
    p => {
      const W = faceAt(S.y), lean = 0.3, cl = Math.cos(lean);
      // (standing a little to the left of the rope, so its head doesn't hide its hands on it)
      p.x = -ROPE_X; p.roll = 0.05; p.lean = lean; p.tilt = 1;
      p.z = W + b.ankle + 0.16; p.lift = 0.02 + Math.sin(S.t * 1.7) * 0.004;
      const L = 1.1 * b.arm, sh = b.sy * cl, z = tieWorld.z || W + 0.22;
      const hand = (o: number) => { const q = frac(S.y / L + o), lo = sh + b.arm * 0.1, hi = sh + b.arm * 0.76; return q < 0.6 ? hi + (lo - hi) * (q / 0.6) : lo + (hi - lo) * smooth((q - 0.6) / 0.4); };
      p.lh.set(-0.035, hand(0), z); p.rh.set(0.035, hand(0.5), z);
      const R = b.leg * 0.42, L2 = R / 0.6, foot = (o: number) => { const q = frac(S.y / L2 + o); return q < 0.6 ? R * (1 - q / 0.6) : R * smooth((q - 0.6) / 0.4); };
      const fx1 = b.hx + 0.04, ly = b.ankle * 0.4 + foot(0), ry = b.ankle * 0.4 + foot(0.5);
      p.lf.set(p.x - fx1, ly, rockAt(-fx1, S.y + ly) + b.ankle + 0.02); p.rf.set(p.x + fx1, ry, rockAt(fx1, S.y + ry) + b.ankle + 0.02);
    },
    // Spring Boots: squash on a hold, bound to the next, arms flung up in the air
    p => {
      const W = faceAt(S.y), q = frac(S.y / hopOf()), up = Math.sin(q * Math.PI) * S.m;
      const crouch = (1 - up) * b.leg * 0.3, spring = springLen(up);
      p.x = 0; p.roll = 0; p.tilt = 0;
      p.lean = up * 0.2; p.z = W + 0.36 + up * 0.34; p.lift = spring - crouch;
      const fy = spring + b.ankle, sh = b.sy + p.lift, zz = p.z, fw = b.hx + 0.09;
      p.lf.set(-fw, fy, zz); p.rf.set(fw, fy, zz);
      const wide = b.sx + 0.08 + up * 0.14, hy = sh + b.arm * (0.2 + up * 0.7);
      p.lh.set(-wide, hy, zz - 0.2 + up * 0.18); p.rh.set(wide, hy, zz - 0.2 + up * 0.18);
    },
    // Grappling Hook: hanging from the launcher, swinging a little, legs trailing as it zips up the line
    p => {
      const W = faceAt(S.y), sw = Math.sin(S.t * 2.3) * (0.05 - 0.03 * S.m);
      p.z = W + 0.38; p.x = sw; p.roll = -sw * 0.8; p.lean = 0.05 + S.m * 0.1; p.tilt = -0.45 - S.m * 0.25; p.lift = 0;
      // (up past the side of its head, so you can see the launcher and the line)
      const top = b.sy + b.arm * 0.9, z = p.z - 0.02 + hookZ * 0.12, hx = b.sx + b.arm * 0.4;
      p.rh.set(hx + sw, top, z); p.lh.set(b.sx * 0.5 + sw, top - b.arm * 0.25, z);
      const kick = Math.sin(S.y * 3.2) * 0.06 * S.m;
      p.lf.set(-b.hx * 0.7 + sw * 0.4, b.ankle + 0.1 + kick, p.z - 0.04); p.rf.set(b.hx * 0.7 + sw * 0.4, b.ankle + 0.06 - kick, p.z - 0.04);
    },
    // Jet Pack: floating clear of the wall, hands on the straps, feet dangling, bobbing on the flames
    p => {
      const W = faceAt(S.y), bob = Math.sin(S.t * 2.2) * 0.035;
      p.x = Math.sin(S.t * 1.1) * 0.05; p.roll = Math.sin(S.t * 1.1 + 0.8) * 0.05; p.lean = -0.1 + S.m * 0.06; p.tilt = -0.6;
      p.z = W + 0.68; p.lift = 0.1 + bob;
      const zz = p.z - 0.16;
      const wing = b.sx + b.arm * 0.72, hy = p.lift + b.sy - b.arm * 0.28;
      p.lh.set(p.x - wing, hy, zz); p.rh.set(p.x + wing, hy, zz);
      const k = Math.sin(S.t * 1.8) * 0.03;
      p.lf.set(p.x - b.hx, p.lift + b.ankle + 0.1 + k, p.z - 0.05); p.rf.set(p.x + b.hx, p.lift + b.ankle + 0.03 - k, p.z - 0.02);
    },
    // Rocket Boots: standing tall, one fist in the air, shooting straight up
    p => {
      const W = faceAt(S.y), shake = Math.sin(S.t * 31) * 0.006 * (0.4 + S.m);
      p.x = shake; p.roll = Math.sin(S.t * 3) * 0.02; p.lean = 0.02; p.tilt = 0;
      p.z = W + 0.62; p.lift = 0.3 + Math.sin(S.t * 3) * 0.015;
      p.rh.set(p.x + b.sx * 0.45, p.lift + b.sy + b.arm * 0.99, p.z - 0.04);
      p.lh.set(p.x - b.sx - 0.08, p.lift + b.sy - b.arm * 0.9, p.z + 0.02);
      p.lf.set(p.x - b.hx * 0.8, p.lift + b.ankle, p.z); p.rf.set(p.x + b.hx * 0.8, p.lift + b.ankle, p.z);
    },
  ];

  // ---------- running it ----------
  let way = 0, from = 0, mix = 1, camUp = 0, popAt = -9, ik = 0, restAt = true, slip = 0, sparkT = 0, hopWas = 0, hookI = -1, hookFired = -9, flame = 0;
  const A = blankPose(), Bp = blankPose(), P = blankPose();
  const footBind = new Map<string, THREE.Quaternion>(['LeftFoot', 'RightFoot'].map(n => [n, bindTurn(c, n)]));
  const yaw = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI), q = new THREE.Quaternion(), pq = new THREE.Quaternion(), rx = new THREE.Quaternion(), XAX = new THREE.Vector3(1, 0, 0);
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), hookAt = new THREE.Vector3(), base = new THREE.Vector3();
  const showWay = (w: number, vis: boolean) => { for (const x of gear[w]) x.o.visible = vis; };
  /** what the buddy has on elsewhere steps aside for a way's own gear */
  const swapWorn = (w: number) => { showWorn(c, 'feet', w !== 2 && w !== 5); showWorn(c, 'back', w !== 4); showWorn(c, 'hand', w !== 3); };
  const place = (cOut: V, t0: V) => cOut.set(base.x + t0.x, base.y + t0.y, t0.z);

  const kit: ClimbKit = {
    get way() { return way; },
    get camUp() { return camUp; },
    onChange: null, onTouch: null,
    lead(dt, t, st) {
      S.y = st.y; S.t = t; S.v = st.v; S.stride = st.stride;
      S.m += (Math.min(1, st.v / 0.35) - S.m) * Math.min(1, dt * 7);
      if (restAt) { restAt = false; swapWorn(way); showWay(way, true); }
      if (st.step !== way) {
        const up = st.step > way;
        showWay(way, false); from = way; way = st.step; mix = 0; popAt = t; swapWorn(way); showWay(way, true);
        if (!up) slip = 0.28;
        hookI = -1;
        c.root.getWorldPosition(v0); v0.y += b.hy;
        kit.onChange?.(way, up, v0);
      }
      camUp += ([0, 0, -0.05, 0.16, -0.1, -0.16][way] - camUp) * Math.min(1, dt * 3);
      mix = Math.min(1, mix + dt / 0.38);
      slip *= Math.max(0, 1 - dt * 5);
      const k = smooth(mix);
      poses[from](A); poses[way](Bp); lerpPose(P, A, Bp, k);
      const wantIk = way ? 1 : 0, fromIk = from ? 1 : 0; ik = fromIk + (wantIk - fromIk) * k;
      // the buddy's place: leaning back from its feet, hopping, floating
      base.copy(c.root.position);
      c.root.position.x += P.x; c.root.position.z += P.z; c.root.position.y += P.lift - slip;
      c.root.rotation.set(P.lean, Math.PI, P.roll);
      // a spring's landing puffs a little dust off the hold
      if (way === 2) { const n = Math.floor(S.y / hopOf()); if (n !== hopWas && S.m > 0.4) { hopWas = n; c.root.getWorldPosition(v0); kit.onTouch?.(v0, 2); } }
    },
    follow(dt, t) {
      // (nothing to place on the Hold On step)
      if (ik > 0.01) {
        // (square to the wall: the standing move's easy twist would turn the gear on its back aside)
        c.uprightSpine(ik, false);
        c.root.updateMatrixWorld(true);
        const elbowL = v0.set(-1, -0.7, 0.35).clone(), elbowR = v0.set(1, -0.7, 0.35).clone(), knee = v0.set(0, 0.45, way === 1 ? -1 : -0.6).clone();
        reach(B.LeftArm, B.LeftForeArm, B.LeftHand, place(v1, P.lh), elbowL, ik);
        reach(B.RightArm, B.RightForeArm, B.RightHand, place(v1, P.rh), elbowR, ik);
        reach(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, place(v1, P.lf), knee, ik);
        reach(B.RightUpLeg, B.RightLeg, B.RightFoot, place(v1, P.rf), knee, ik);
        // soles flat on the wall, flat under the springs, or pointing down in the air
        rx.setFromAxisAngle(XAX, P.tilt * Math.PI / 2);
        for (const n of ['LeftFoot', 'RightFoot']) {
          const bone = B[n]; if (!bone) continue;
          q.copy(rx).multiply(yaw).multiply(footBind.get(n)!);
          const cur = bone.getWorldQuaternion(pq).clone().slerp(q, ik);
          bone.parent!.getWorldQuaternion(pq);
          bone.quaternion.copy(pq.invert().multiply(cur));
          bone.updateMatrixWorld(true);
        }
      }
      // the gear pops on, a little too big, then settles
      const pop = backOut((t - popAt) / 0.34);
      for (const x of gear[way]) if (x.k && x.o.parent !== world) x.o.scale.setScalar(x.k * Math.max(0.02, pop));
      tie.getWorldPosition(tieWorld);
      if (way === 1) {
        // the rope comes down from the top of the wall and clips on
        const drop = smooth((t - popAt) / 0.3), topY = env.top();
        v1.set(base.x, topY, env.wall(0, topY) + 0.32);
        v2.set(base.x, tieWorld.y, tieWorld.z); v2.y += (1 - drop) * 6;
        stretch(rope, v2, v1);
        // (a short bit from the rope to the clip on the belt)
        stretch(tail, v2, tieWorld);
      } else if (way === 2) {
        const up = Math.sin(frac(S.y / hopOf()) * Math.PI) * S.m, len = springLen(up) * upm;
        for (const sp of springs) { sp.coil.scale.y = len / coilH; sp.pad.position.y = -len; }
      } else if (way === 3) {
        // fire to the next anchor up the wall, hang on it, and zip up to it
        B.RightHand.getWorldPosition(v1);
        launcher.position.copy(v1); launcher.position.y += 0.05;
        const gapY = 1.5, top = env.top() - 0.1, i = Math.floor((v1.y + 0.55) / gapY) + 1;
        if (i !== hookI) { hookI = i; hookFired = t; }
        const ay = Math.min(top, i * gapY), ax = base.x + b.sx + b.arm * 0.4 + Math.sin(i * 12.9) * 0.14;
        v2.set(ax, ay, env.wall(ax, ay) + 0.04);
        const k2 = smooth((t - hookFired) / 0.16);
        hookAt.lerpVectors(v1, v2, k2);
        hook.position.copy(hookAt); hookZ = v2.z - v1.z;
        hook.quaternion.setFromUnitVectors(UP, v0.copy(v2).sub(v1).normalize());
        launcher.quaternion.copy(hook.quaternion);
        v0.copy(v1).addScaledVector(v2.clone().sub(v1).normalize(), 0.3);
        stretch(line, v0, hookAt);
        if (k2 >= 1 && hookFired > 0) { hookFired = -9 - t; kit.onTouch?.(hookAt, 3); }
      }
      // the flames: short while it waits, long as it goes
      const power = way >= 4 ? 0.5 + 0.5 * S.m : 0;
      flame += (power - flame) * Math.min(1, dt * 9);
      const flick = 0.82 + 0.3 * Math.abs(Math.sin(t * 27)), lap = 0.9 + 0.2 * Math.abs(Math.sin(t * 33 + 1));
      for (const fl of packFlames) fl.scale.set(0.8 + 0.3 * flame, Math.max(0.05, flame * flick), 0.8 + 0.3 * flame);
      for (const [i, fl] of bootFlames.entries()) fl.scale.set(0.85 + 0.3 * flame, Math.max(0.05, flame * (i ? lap : flick)), 0.85 + 0.3 * flame);
      // speed lines: more, brighter and longer each step up, while it's moving
      const lk = Math.max(0, Math.min(1, (way - 1) / 4)) * S.m, shown = Math.round(lines.length * lk);
      lineMat.opacity = 0.2 + 0.34 * lk;
      c.root.getWorldPosition(v0);
      fx.position.set(v0.x, v0.y, v0.z);
      lines.forEach((m, i) => {
        const u = m.userData as { side: number; x: number; z: number; y: number; sp: number };
        m.visible = i < shown;
        if (!m.visible) return;
        u.y -= dt * u.sp * (1.2 + 3.6 * lk);
        if (u.y < -0.6) { u.y = 1.6 + Math.random() * 0.4; u.x = u.side * Hm * (0.42 + Math.random() * 0.5); }
        m.position.set(u.x, u.y * Hm, u.z); m.scale.set(Hm * 0.018, Hm * (0.25 + 0.6 * lk), 1);
      });
      // sparks falling from the flames
      sparkT -= dt;
      if (way >= 4 && sparkT <= 0 && S.m > 0.2 && sparks.length) {
        sparkT = 0.05;
        const sp = sparks.find(x => (x.userData.life as number) > 0.55) ?? sparks[0], fl = way === 4 ? packFlames : bootFlames, from3 = fl[Math.floor(Math.random() * fl.length)];
        from3.getWorldPosition(v0); fx.worldToLocal(v0);
        sp.position.copy(v0); sp.userData.life = 0; (sp.userData.v as V).set((Math.random() - 0.5) * 0.7, -1.6 - Math.random(), (Math.random() - 0.2) * 0.4).multiplyScalar(Hm);
        sp.visible = true;
      }
      for (const sp of sparks) {
        const u = sp.userData as { life: number; v: V };
        if (!sp.visible) continue;
        u.life += dt;
        if (u.life > 0.55) { sp.visible = false; continue; }
        sp.position.addScaledVector(u.v, dt); sp.scale.setScalar(Hm * 0.06 * (1 - u.life * 1.5));
      }
    },
    rest(_dt, t) {
      if (restAt) return;
      restAt = true; S.m = 0; ik = 0; mix = 1; from = 0;
      showWay(way, false); swapWorn(0);
      if (way) { c.root.getWorldPosition(v0); v0.y += b.hy; kit.onTouch?.(v0, 16); }
      way = 0; popAt = t;
      lines.forEach(m => { m.visible = false; }); sparks.forEach(sp => { sp.visible = false; });
    },
    async ready() {
      const r = stage.renderer;
      if (!r) return;
      const gearOn = gear.flatMap(w => w.map(x => x.o));
      try {
        for (const tex of [flameMap, rocketTex.map, packTex.map, finTex.map, springShoe.map, rocketShoe.map, chrome.map]) if (tex) r.initTexture(tex);
        await r.compileAsync(world, stage.camera, stage.scene);
        for (const o of gearOn) if (o.parent !== world) await r.compileAsync(o, stage.camera, stage.scene);
      } catch { /* it compiles when first drawn instead */ }
    },
    dispose() {
      swapWorn(0);
      for (const o of [...roots, world]) {
        o.removeFromParent();
        o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh) { const fg = f.feet.some(ft => ft.geo === m.geometry); if (!fg) m.geometry?.dispose?.(); } });
      }
      for (const x of own) x.dispose();
    },
  };
  return kit;
}
