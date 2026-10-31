// Down the snowy slope: six ways, like the trail's six rides and the cliff's six ways up. Each speed step is
// its own ride with its own motion, and changing step is a moment you can't miss: a burst of snow, a hop,
// the new ride popping in underneath, the banner and the speed card.
//   0 Wobbly Sled: the wooden sled from the start line, sitting down, fishtailing and tipping.
//   1 Saucer: a round red disc, knees up, hands on the rim, turning slowly round as it slides.
//   2 Skis: standing up for the first time, long blue skis, poles pushing, swinging in small turns.
//   3 Snowboard: sideways on an orange board, facing you, knees bent, leaning hard into big turns.
//   4 Bobsled: down inside a red bobsled, tucked in, dead straight, ice flying off the runners.
//   5 Avalanche: running on top of a giant rolling snowball with a wave of snow behind it.
// Everything is worked out from the buddy's own measurements, so every size and shape rides the same way;
// how far down the slope it is sets the turns, so a right answer is what moves them, and when it stops it
// settles. All the rides are made and readied when the run starts, and no lights are added: a step-up
// never hitches. See climbKit.ts, which does the same on the cliff.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Character } from './character';
import { loadTexture } from './assets';
import { stage } from './stage';
import { reach } from './ik';
import { fitOf, points, shadows, showWorn } from './gear3d';
import { seatDrop, sitOnSled } from './sledSeat';
import { Spray, Streaks, backOut, bindTurn, frac, measure, smooth, stretch, turnBone, type RideKit, type RideState } from './kitParts';

type V = THREE.Vector3;
/** Where everything goes this frame: the ride on the slope, then the buddy on the ride (on the ride's own axes: x forward, y up, z toward the camera). */
type Pose = { hop: number; side: number; yaw: number; roll: number; tip: number; face: number; lean: number; bank: number; foot: number; hip: V; lh: V; rh: V; lf: V; rf: V };
const blankPose = (): Pose => ({ hop: 0, side: 0, yaw: 0, roll: 0, tip: 0, face: 0, lean: 0, bank: 0, foot: Math.PI / 2, hip: new THREE.Vector3(), lh: new THREE.Vector3(), rh: new THREE.Vector3(), lf: new THREE.Vector3(), rf: new THREE.Vector3() });
const NUMS = ['hop', 'side', 'yaw', 'roll', 'tip', 'face', 'lean', 'bank', 'foot'] as const, VECS = ['hip', 'lh', 'rh', 'lf', 'rf'] as const;
const lerpPose = (o: Pose, a: Pose, b: Pose, k: number) => {
  for (const f of NUMS) o[f] = a[f] + (b[f] - a[f]) * k;
  for (const f of VECS) o[f].lerpVectors(a[f], b[f], k);
};
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const WHITE: [number, number, number] = [1, 1, 1], SHADE: [number, number, number] = [0.8, 0.87, 0.97];
const STEEL = 0x9aa0aa, TOP = 0.05;
/** which way the knees go on each ride (on the ride's own axes) */
const KNEE: [number, number, number][] = [[0.5, 1, 0], [0.45, 1, 0], [1, 0.25, 0], [0.1, 0.1, 1], [0.6, 1, 0], [1, 0.2, 0]];
const CLIP = ['sit', 'sit', 'idle', 'idle', 'sit', 'run'];
/** what the buddy has on elsewhere steps aside: nothing held on the rim or the poles, nothing on the feet in a binding, nothing on its back in the bobsled */
const HIDE: string[][] = [[], ['hand'], ['hand', 'feet'], ['hand', 'feet'], ['hand', 'feet', 'back'], []];
const paint = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
/** A long thin plank, curling up at the front (and at the back too for a snowboard). */
function plank(L: number, w: number, curl: number, both: boolean) {
  const g = new THREE.BoxGeometry(L, 0.028, w, 40, 1, 2), p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / L + 0.5, f = smooth((u - 0.82) / 0.18), b = both ? smooth((0.18 - u) / 0.18) : smooth((0.06 - u) / 0.06) * 0.25;
    p.setY(i, p.getY(i) + (f * f + b * b) * curl);
    const round = Math.max(both ? Math.max(0, (0.1 - u) / 0.1) : 0, (u - 0.9) / 0.1);
    if (round > 0) p.setZ(i, p.getZ(i) * Math.sqrt(Math.max(0.02, 1 - round * round * 0.92)));
  }
  g.computeVertexNormals();
  return g;
}
/** A bobsled's body: a hull round the x axis, nose at +x, with the seat left open at the top. */
function hullGeo(L: number, W: number, Ht: number) {
  const NX = 44, NV = 28, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NX + 1; i++) {
    // (the first ring closes the tail)
    const u = Math.max(0, i - 1) / NX, shut = i === 0;
    const w = u < 0.32 ? 0.74 + 0.26 * smooth(u / 0.32) : Math.pow(Math.cos(((u - 0.32) / 0.68) * Math.PI / 2), 0.62);
    const h = u < 0.4 ? 0.82 + 0.18 * smooth(u / 0.4) : 0.3 + 0.7 * Math.pow(Math.cos(((u - 0.4) / 0.6) * Math.PI / 2), 0.7);
    const bump = smooth((u - 0.1) / 0.1) * (1 - smooth((u - 0.5) / 0.1)), reach = Math.PI - (Math.PI - 1.85) * bump;
    for (let j = 0; j <= NV; j++) {
      const a = ((j / NV) * 2 - 1) * reach, s = Math.sin(a), c = Math.cos(a);
      // (a bit square at the sides, as bobsleds are)
      const sx = Math.sign(s) * Math.pow(Math.abs(s), 0.72), cy = Math.sign(c) * Math.pow(Math.abs(c), 0.8);
      pos.push(-L / 2 + u * L, Ht * (0.5 + 0.08 * u) - cy * h * Ht * 0.5 * (shut ? 0.02 : 1), sx * w * W * (shut ? 0.02 : 1));
      uv.push(u, j / NV);
    }
  }
  for (let i = 0; i <= NX; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function sledKit(c: Character, env: { sled: THREE.Object3D; ghost?: THREE.Material | null }): Promise<RideKit | null> {
  const B = c.bones, f = fitOf(c), b = measure(c);
  if (!b) return null;
  for (const n of ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Hips', 'Head']) if (!B[n]) return null;
  const snowTex = await loadTexture('world/snow.webp', { repeat: true, color: true });
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  const gloss = (color: number, roughness = 0.28, extra: THREE.MeshStandardMaterialParameters = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  const k = b.H / f.H, body = points(c, ['Hips', 'Spine', 'Spine01', 'Spine02'], 0.3), xs = body.map(p => p.x), wide = xs.length ? ((Math.max(...xs) - Math.min(...xs)) / 2) * k : 0.25;

  /** the world holder: on the slope at the buddy's place */
  const rig = new THREE.Group(), deck = new THREE.Group();
  rig.add(deck); stage.scene.add(rig);
  const rides: THREE.Group[] = Array.from({ length: 6 }, () => { const g = new THREE.Group(); g.visible = false; deck.add(g); return g; });
  const steel = gloss(STEEL, 0.32, { metalness: 0.85 }), dark = gloss(0x23262e, 0.6), rope = gloss(0xd9c49a, 0.9);

  // ---------- 1: the saucer ----------
  const dish = Math.max(0.58, b.hx + b.leg * 1.02);
  {
    const red = gloss(0xe0222b, 0.24, { side: THREE.DoubleSide }), rim = gloss(0xffffff, 0.35);
    const prof = [[0.001, 0.05], [0.5, 0.055], [0.72, 0.08], [0.87, 0.125], [0.96, 0.17], [1, 0.2], [0.99, 0.225], [0.95, 0.22]].map(([r, y]) => new THREE.Vector2(r * dish, y));
    const disc = new THREE.Mesh(keep(new THREE.LatheGeometry(prof, 40)), red);
    const band = new THREE.Mesh(keep(new THREE.TorusGeometry(dish * 0.985, 0.026, 8, 48)), rim); band.rotation.x = Math.PI / 2; band.position.y = 0.205;
    rides[1].add(disc, band);
    const ropeGeo = keep(new THREE.TorusGeometry(0.1, 0.018, 6, 14, Math.PI));
    for (const sd of [-1, 1]) { const h = new THREE.Mesh(ropeGeo, rope); h.position.set(0, 0.22, sd * dish * 0.97); h.rotation.set(Math.PI / 2 * sd, 0, 0); rides[1].add(h); }
  }
  // ---------- 2: the skis and poles ----------
  const skiL = Math.max(1.35, b.H * 1.3), skiW = 0.13, skiGap = Math.max(b.hx + 0.03, 0.11);
  const skiMap = keep(paint(256, 32, g => {
    g.fillStyle = '#1f7fe8'; g.fillRect(0, 0, 256, 32); g.fillStyle = '#fff'; g.fillRect(0, 12, 256, 8);
    g.fillStyle = '#ffd23d'; g.fillRect(226, 0, 30, 32); g.fillStyle = '#0d4fa8'; g.fillRect(96, 0, 56, 32);
  }));
  {
    const mat = keep(new THREE.MeshStandardMaterial({ map: skiMap, roughness: 0.3 })), geo = keep(plank(skiL, skiW, 0.17, false)), clip = keep(new THREE.BoxGeometry(0.2, 0.05, 0.11));
    for (const sd of [-1, 1]) { const s = new THREE.Mesh(geo, mat); s.position.set(0.02, 0.022, sd * skiGap); const bind = new THREE.Mesh(clip, dark); bind.position.set(0.02, 0.05, sd * skiGap); rides[2].add(s, bind); }
  }
  const stick = (r: number, mat: THREE.Material) => { const m = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r, 1, 8)), mat); m.frustumCulled = false; return m; };
  const poleMat = gloss(0xff4a2a, 0.3), poleLo = stick(0.022, poleMat), poleHi = stick(0.022, poleMat);
  rig.add(poleLo, poleHi); poleLo.visible = poleHi.visible = false;
  const basketGeo = keep(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12)), baskets = [new THREE.Mesh(basketGeo, dark), new THREE.Mesh(basketGeo, dark)];
  baskets.forEach(m => { m.visible = false; rig.add(m); });
  // ---------- 3: the snowboard ----------
  const boardL = Math.max(1.4, b.H * 1.3), boardW = 0.42, stance = Math.max(b.hx * 1.5, 0.2);
  const boardMap = keep(paint(256, 64, g => {
    g.fillStyle = '#ff8a1f'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#ffd23d'; for (const x of [28, 92, 156, 220]) { g.beginPath(); g.moveTo(x - 24, 0); g.lineTo(x + 8, 0); g.lineTo(x + 24, 32); g.lineTo(x + 8, 64); g.lineTo(x - 24, 64); g.lineTo(x - 8, 32); g.closePath(); g.fill(); }
  }));
  {
    const board = new THREE.Mesh(keep(plank(boardL, boardW, 0.16, true)), keep(new THREE.MeshStandardMaterial({ map: boardMap, roughness: 0.3 })));
    board.position.y = 0.026; rides[3].add(board);
    const clip = keep(new THREE.BoxGeometry(0.14, 0.05, 0.3));
    for (const sd of [-1, 1]) { const m = new THREE.Mesh(clip, dark); m.position.set(sd * stance, 0.052, 0); rides[3].add(m); }
  }
  // ---------- 4: the bobsled ----------
  const hullL = Math.max(2, b.H * 1.75), hullW = Math.max(0.34, wide + 0.07), rimY = 0.16 + (b.sy - b.hy) * 0.72 + seatDrop(c);
  const hullMap = keep(paint(512, 256, g => {
    g.fillStyle = '#d81e2a'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#fff'; g.fillRect(0, 44, 512, 16); g.fillRect(0, 196, 512, 16);
    g.fillStyle = '#ffd23d'; g.fillRect(0, 62, 512, 8); g.fillRect(0, 186, 512, 8);
    g.fillStyle = '#23262e'; g.fillRect(430, 0, 82, 256);
  }));
  {
    const mat = keep(new THREE.MeshStandardMaterial({ map: hullMap, roughness: 0.2, side: THREE.DoubleSide }));
    const hull = new THREE.Mesh(keep(hullGeo(hullL, hullW, rimY)), mat); hull.position.y = 0.11; rides[4].add(hull);
    for (const z of [-hullW * 0.72, hullW * 0.72]) {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-hullL * 0.46, 0.045, z), new THREE.Vector3(hullL * 0.3, 0.035, z), new THREE.Vector3(hullL * 0.42, 0.06, z), new THREE.Vector3(hullL * 0.47, 0.14, z)]);
      rides[4].add(new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 24, 0.026, 8)), steel));
      for (const x of [-hullL * 0.3, hullL * 0.2]) { const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6)), steel); leg.position.set(x, 0.09, z); rides[4].add(leg); }
    }
  }
  // ---------- 5: the avalanche: a giant snowball ----------
  const ballR = 0.86;
  const ball = new THREE.Group();
  {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 14).deleteAttribute('uv').deleteAttribute('normal'));
    const p = g.attributes.position as THREE.BufferAttribute, col: number[] = [], v = new THREE.Vector3(), uv: number[] = [];
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const n = Math.sin(v.x * 7 + v.y * 3) * 0.3 + Math.sin(v.y * 9 - v.z * 5) * 0.3 + Math.sin(v.z * 11 + v.x * 4) * 0.25 + Math.sin(v.x * 19 + v.z * 17) * 0.15;
      v.multiplyScalar(1 + n * 0.09);
      p.setXYZ(i, v.x, v.y, v.z);
      const s = 0.8 + 0.2 * smooth(n + 0.45);
      col.push(s * 0.93, s * 0.97, s * 1.02);
      uv.push(Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5, v.y * 0.5 + 0.5);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const map = snowTex ? keep(snowTex.clone()) : null;
    if (map) { map.repeat.set(3, 2); map.needsUpdate = true; }
    const m = new THREE.Mesh(keep(g), keep(new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.95, emissive: 0xaebfd6, emissiveIntensity: 0.62, emissiveMap: map })));
    m.scale.setScalar(ballR); ball.add(m);
  }
  ball.position.y = ballR; rides[5].add(ball);

  for (const r of rides) shadows(r);
  for (const o of [poleLo, poleHi, ...baskets]) o.castShadow = true;
  if (env.ghost) for (const r of [...rides, rig]) r.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = env.ghost!; m.castShadow = false; } });
  const fx = new THREE.Group(); stage.scene.add(fx);
  const spray = env.ghost ? null : new Spray(fx, 100), streaks = env.ghost ? null : new Streaks(fx, 14, 0x9dbdea, [5, 1.5, 3.2], 0);

  // ---------- the six poses ----------
  const S = { s: 0, t: 0, v: 0, m: 0, spin: 0, pole: 0 };
  const sit = () => seatDrop(c);
  const torso = b.sy - b.hy;
  const poses: ((p: Pose) => void)[] = [
    // Wobbly Sled: fishtailing and tipping from side to side (sitOnSled does the sitting)
    p => {
      const w = 0.45 + 0.55 * S.m;
      p.hop = 0; p.side = Math.sin(S.s * 0.9) * 0.1 * S.m; p.yaw = Math.sin(S.t * 2.6) * 0.14 * w; p.roll = Math.sin(S.t * 3.9) * 0.075 * w; p.tip = Math.sin(S.t * 6.1) * 0.012; p.face = 0; p.lean = 0; p.bank = 0; p.foot = Math.PI / 2;
    },
    // Saucer: knees up in the dish, hands on the rim, the whole thing turning round
    p => {
      const seat = 0.075 + sit();
      p.hop = 0; p.side = Math.sin(S.s * 0.5) * 0.3 * S.m; p.yaw = S.spin; p.roll = Math.sin(S.t * 2.3) * 0.05; p.tip = 0.06 + Math.sin(S.t * 1.7) * 0.04; p.face = 0; p.lean = -0.1; p.bank = 0; p.foot = Math.PI / 2;
      p.hip.set(-0.08, seat, 0);
      const fx1 = -0.08 + b.leg * 0.86, fy = 0.13 + b.ankle;
      p.lf.set(fx1, fy, -b.hx - 0.03); p.rf.set(fx1, fy, b.hx + 0.03);
      const hz = Math.min(dish * 0.84, b.sx + b.arm * 0.82), hy = seat + torso * 0.42;
      p.lh.set(-0.04, hy, -hz); p.rh.set(-0.04, hy, hz);
    },
    // Skis: standing up, knees a little bent, poles pushing, swinging in small turns
    p => {
      const a = (S.s / 9) * Math.PI * 2, A = 0.42 * S.m, gone = (2 * Math.PI * A) / 9;
      p.hop = 0; p.side = Math.sin(a) * A; p.yaw = -Math.atan(gone * Math.cos(a)); p.roll = -Math.sin(a) * 0.16 * S.m; p.tip = 0; p.face = 0; p.lean = 0.32; p.bank = 0; p.foot = Math.PI / 2;
      const hy = TOP + b.hy - b.leg * (0.15 + 0.1 * S.m);
      p.hip.set(-0.06, hy, 0);
      const ank = TOP + b.ankle;
      p.lf.set(0.03, ank, -skiGap); p.rf.set(0.03, ank, skiGap);
      const sh = hy + torso * Math.cos(0.32), sx = -0.06 + torso * Math.sin(0.32), sw = Math.sin(S.pole * Math.PI * 2) * S.m;
      p.lh.set(sx + b.arm * (0.5 + 0.34 * sw), sh - b.arm * (0.5 - 0.24 * sw), -b.sx - 0.1);
      p.rh.set(sx + b.arm * (0.5 - 0.34 * sw), sh - b.arm * (0.5 + 0.24 * sw), b.sx + 0.1);
    },
    // Snowboard: sideways, facing you, knees bent, arms out, leaning hard into big turns
    p => {
      const a = (S.s / 14) * Math.PI * 2, A = 1.35 * S.m, gone = (2 * Math.PI * A) / 14;
      p.hop = 0; p.side = Math.sin(a) * A; p.yaw = -Math.atan(gone * Math.cos(a)); p.roll = -Math.sin(a) * 0.5 * S.m; p.tip = 0; p.face = Math.PI / 2; p.lean = 0.2; p.bank = 0; p.foot = 0;
      const hy = TOP + b.hy - b.leg * 0.36;
      p.hip.set(0, hy, -0.05);
      const ank = TOP + b.ankle;
      p.lf.set(stance, ank, 0); p.rf.set(-stance, ank, 0);
      const sh = hy + torso * 0.8;
      p.lh.set(b.sx + b.arm * 0.92, sh - 0.02, 0.1); p.rh.set(-b.sx - b.arm * 0.92, sh + 0.14 + Math.sin(S.t * 3) * 0.03, 0.04);
    },
    // Bobsled: dead straight, down inside, tucked in behind the nose
    p => {
      const seat = 0.2 + sit();
      p.hop = 0; p.side = 0; p.yaw = 0; p.roll = Math.sin(S.t * 9) * 0.006; p.tip = 0; p.face = 0; p.lean = 0.42; p.bank = 0; p.foot = Math.PI / 2;
      p.hip.set(-hullL * 0.18, seat, 0);
      const fy = 0.2 + b.ankle, fx1 = -hullL * 0.18 + b.leg * 0.9;
      p.lf.set(fx1, fy, -b.hx - 0.02); p.rf.set(fx1, fy, b.hx + 0.02);
      const hy = rimY + 0.1, hx = -hullL * 0.18 + torso * 0.45 + b.arm * 0.5;
      p.lh.set(hx, hy, -hullW * 0.8); p.rh.set(hx, hy, hullW * 0.8);
    },
    // Avalanche: running on top of the giant snowball, the wave behind it
    p => {
      const bob = Math.abs(Math.sin(S.t * 9)) * 0.05;
      p.hop = 0; p.side = 0; p.yaw = 0; p.roll = 0; p.tip = 0; p.face = 0; p.lean = 0.18 + Math.sin(S.t * 2.3) * 0.06; p.bank = Math.sin(S.t * 3.1) * 0.1; p.foot = Math.PI / 2;
      p.hip.set(0.02, ballR * 2 + 0.03 + b.hy + bob, 0);
    },
  ];

  // ---------- running it ----------
  let way = 0, from = 0, mix = 1, camUp = 0, camTall = 0, popAt = -9, hopAt = -9, hopH = 0, restAt = true, sprayT = 0, ballTurn = 0, lastS = 0, flip = 0, wasSign = 0;
  const A = blankPose(), Bp = blankPose(), P = blankPose();
  const feet = ['LeftFoot', 'RightFoot'].map(n => [B[n], bindTurn(c, n)] as const);
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), dq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  const show = (w: number, vis: boolean) => {
    if (w === 0) env.sled.visible = vis;
    else rides[w].visible = vis;
    if (w === 2) for (const o of [poleLo, poleHi, ...baskets]) o.visible = vis;
  };
  const swapWorn = (w: number) => { for (const slot of ['hand', 'feet', 'back'] as const) showWorn(c, slot, !HIDE[w].includes(slot)); };
  const ofDeck = (o: Pose) => {
    deck.updateMatrixWorld(true);
    o.hip.copy(B.Hips.getWorldPosition(v0)); deck.worldToLocal(o.hip);
    o.lh.copy(B.LeftHand.getWorldPosition(v0)); deck.worldToLocal(o.lh);
    o.rh.copy(B.RightHand.getWorldPosition(v0)); deck.worldToLocal(o.rh);
    o.lf.copy(B.LeftFoot.getWorldPosition(v0)); deck.worldToLocal(o.lf);
    o.rf.copy(B.RightFoot.getWorldPosition(v0)); deck.worldToLocal(o.rf);
  };
  /** the ride on the slope, from the pose */
  const placeRide = (p: Pose, hop: number) => {
    deck.position.set(0, p.hop + hop, p.side);
    deck.rotation.set(p.roll, p.yaw, p.tip, 'YXZ');
    deck.updateMatrixWorld(true);
  };
  const dir = (a: [number, number, number], m: THREE.Matrix4) => new THREE.Vector3(a[0], a[1], a[2]).transformDirection(m);
  /** The buddy on the ride, hips on their mark, then hands and feet (`amount`: 0 leaves the move as it is). */
  const apply = (p: Pose, amount: number) => {
    deck.getWorldQuaternion(dq);
    q0.setFromAxisAngle(Y, Math.PI / 2 - p.face); q1.setFromAxisAngle(X, p.lean); q2.setFromAxisAngle(Z, p.bank);
    c.root.quaternion.copy(dq).multiply(q0).multiply(q1).multiply(q2);
    c.root.updateMatrixWorld(true);
    if (amount > 0.01) c.uprightSpine(amount, false);
    B.Hips.getWorldPosition(v0); deck.localToWorld(v1.copy(p.hip));
    c.root.position.add(v1.sub(v0));
    c.root.updateMatrixWorld(true);
    if (amount <= 0.01) return;
    const rm = c.root.matrixWorld, kn = KNEE[way === 0 ? from : way];
    const knee = dir(kn, deck.matrixWorld), eL = dir([1, -0.7, -0.35], rm), eR = dir([-1, -0.7, -0.35], rm);
    reach(B.LeftArm, B.LeftForeArm, B.LeftHand, deck.localToWorld(v1.copy(p.lh)), eL, amount);
    reach(B.RightArm, B.RightForeArm, B.RightHand, deck.localToWorld(v1.copy(p.rh)), eR, amount);
    reach(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, deck.localToWorld(v1.copy(p.lf)), knee, amount);
    reach(B.RightUpLeg, B.RightLeg, B.RightFoot, deck.localToWorld(v1.copy(p.rf)), knee, amount);
    // soles flat on the ride, toes along it (or across, on the board)
    q0.setFromAxisAngle(Y, p.foot);
    for (const [bone, bind] of feet) {
      q1.copy(dq).multiply(q0).multiply(bind);
      const cur = bone.getWorldQuaternion(pq).clone().slerp(q1, amount);
      bone.parent!.getWorldQuaternion(pq);
      bone.quaternion.copy(pq.invert().multiply(cur));
      bone.updateMatrixWorld(true);
    }
  };
  const emitSnow = (dt: number, t: number) => {
    if (!spray) return;
    sprayT -= dt;
    deck.getWorldPosition(v0);
    const v = S.v, m = S.m;
    if (m < 0.25 || sprayT > 0) return;
    const rnd = (a = 1) => (Math.random() - 0.5) * a * 2;
    if (way === 0) { sprayT = 0.14; spray.emit(v1.set(v0.x - 0.8, v0.y + 0.05, v0.z + rnd(0.3)), -v * 0.2, 0.6, rnd(0.4), 0.2, 0.5, 1.5, 2.5); }
    else if (way === 1) {
      sprayT = 0.05;
      const a = Math.random() * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      spray.emit(v1.set(v0.x + cs * dish, v0.y + 0.1, v0.z + sn * dish), -sn * 1.6 - v * 0.2, 0.9, cs * 1.6, 0.17, 0.5, 1.2, 3.2);
    } else if (way === 2) {
      sprayT = 0.05;
      const sd = Math.random() < 0.5 ? -1 : 1;
      spray.emit(v1.set(v0.x - skiL * 0.45, v0.y + 0.06, v0.z + sd * skiGap), -v * 0.15, 0.8 + Math.random() * 0.5, sd * 0.3, 0.16, 0.45, 1.6, 2.6);
    } else if (way === 3) {
      const a = (S.s / 14) * Math.PI * 2, s = Math.sin(a), hard = Math.abs(s) > 0.5;
      sprayT = hard ? 0.022 : 0.1;
      // the edge digging in throws a fan of snow out of the turn
      deck.localToWorld(v1.set(-boardL * 0.4 + Math.random() * boardL * 0.8, 0.05, 0));
      spray.emit(v1, -v * 0.2 + rnd(0.4), 1.6 + Math.random() * 1.6, Math.sign(s) * (hard ? 2.4 : 0.8), hard ? 0.26 : 0.18, 0.55, 1.5, 4.2);
    } else if (way === 4) {
      sprayT = 0.03;
      const sd = Math.random() < 0.5 ? -1 : 1;
      spray.emit(v1.set(v0.x - hullL * 0.46, v0.y + 0.05, v0.z + sd * hullW * 0.72), -v * 0.1, 0.5 + Math.random() * 0.7, sd * 0.5, 0.15, 0.4, 1.6, 2.4);
    } else if (way === 5) {
      sprayT = 0.016;
      // the wave: billows thrown up behind the ball, some in shade so it has a shape
      for (let i = 0; i < 2; i++) spray.emit(v1.set(v0.x - ballR * (0.7 + Math.random() * 0.5), v0.y + ballR * (0.15 + Math.random() * 1.5), v0.z + rnd(ballR * 1.25)), -0.8 - v * 0.25, 1.4 + Math.random() * 2.6, rnd(1.4), 0.55 + Math.random() * 0.5, 0.8 + Math.random() * 0.5, 1.3, 2.8, Math.random() < 0.45 ? SHADE : WHITE, 0.92);
    }
    void t;
  };

  const kit: RideKit = {
    get way() { return way; },
    get camUp() { return camUp; },
    get camTall() { return camTall; },
    onChange: null, onTouch: null,
    lead(dt, t, st) {
      S.t = t; S.v = st.v;
      const ds = Math.max(0, st.s - lastS); lastS = st.s; S.s = st.s;
      S.m += (Math.min(1, st.v / 0.7) - S.m) * Math.min(1, dt * 4);
      S.spin += dt * (0.5 + 0.9 * S.m); S.pole = frac(st.s / 1.9);
      ballTurn -= ds / ballR;
      if (restAt) { restAt = false; swapWorn(way); show(way, true); }
      if (st.step !== way) {
        const up = st.step > way;
        Object.assign(A, { ...P, hip: A.hip, lh: A.lh, rh: A.rh, lf: A.lf, rf: A.rf }); A.yaw = Math.atan2(Math.sin(P.yaw), Math.cos(P.yaw));
        ofDeck(A);
        show(way, false); from = way; way = st.step; mix = 0; popAt = t; swapWorn(way); show(way, true);
        if (way === 1) S.spin = 0;
        // up: a hop and a burst; down: it just slips back onto the slower ride
        if (up) { hopAt = t; hopH = way === 5 ? 0.9 : 0.5; }
        deck.getWorldPosition(v0); v0.y += b.hy;
        kit.onChange?.(way, up, v0);
        if (spray && up) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; spray.emit(v1.copy(v0).setY(v0.y - b.hy + 0.1), Math.cos(a) * 2.4, 1.2 + Math.random() * 1.4, Math.sin(a) * 2.4, 0.3, 0.7, 1.6, 3.4, i % 3 ? WHITE : SHADE); }
      }
      camUp += ([0, 0, 0.08, 0.08, -0.1, 0.95][way] - camUp) * Math.min(1, dt * 3);
      camTall += ([0, 0.1, 0.2, 0.25, 0.2, 1.7][way] - camTall) * Math.min(1, dt * 3);
      mix = Math.min(1, mix + dt / (from > way ? 0.7 : 0.4));
      rig.position.set(st.at.x, st.at.y, st.at.z + st.lane);
      rig.rotation.z = -st.pitch;
      const a = c.play(c.has(CLIP[way]) ? CLIP[way] : c.has('seated') ? 'seated' : 'idle', 0.25);
      if (a && way === 5) a.timeScale = Math.max(0.8, Math.min(1.9, 0.9 + S.v * 0.35));
      else if (a) a.timeScale = 1;
    },
    follow(dt, t) {
      const k = smooth(mix), hop = Math.sin(smooth((t - hopAt) / 0.5) * Math.PI) * hopH * (t - hopAt < 0.5 ? 1 : 0);
      poses[way](Bp);
      if (way === 0) {
        lerpPose(P, A, Bp, mix < 1 ? k : 1);
        placeRide(P, hop);
        deck.getWorldPosition(env.sled.position); deck.getWorldQuaternion(env.sled.quaternion);
        // sitting on the sled: hips on the deck, legs out along it; it needs the buddy facing along the sled
        deck.getWorldQuaternion(dq); q0.setFromAxisAngle(Y, Math.PI / 2);
        c.root.quaternion.copy(dq).multiply(q0);
        c.root.updateMatrixWorld(true);
        sitOnSled(c, env.sled, dt);
        if (mix < 1) {
          ofDeck(Bp); P.hip.lerpVectors(A.hip, Bp.hip, k); P.lh.lerpVectors(A.lh, Bp.lh, k); P.rh.lerpVectors(A.rh, Bp.rh, k); P.lf.lerpVectors(A.lf, Bp.lf, k); P.rf.lerpVectors(A.rf, Bp.rf, k);
          apply(P, 1);
        }
      } else if (way === 5) {
        // (running on the move as it is)
        lerpPose(P, A, Bp, mix < 1 ? k : 1);
        if (mix >= 1) P.hip.copy(Bp.hip);
        placeRide(P, hop);
        apply(P, 1 - k);
      } else {
        lerpPose(P, A, Bp, mix < 1 ? k : 1);
        placeRide(P, hop);
        apply(P, 1);
        // the head looks where it's going
        if (way === 2 || way === 4) turnBone(B.Head, dir([0, 0, 1], deck.matrixWorld), P.lean * 0.7);
      }
      // the new ride pops in, a little too big, then settles
      const pop = backOut((t - popAt) / 0.34);
      if (way) rides[way].scale.setScalar(Math.max(0.02, pop));
      if (way === 5) ball.rotation.z = ballTurn;
      if (way === 2) {
        // the poles, from the hands to the snow, pushing and swinging forward again
        rig.updateMatrixWorld(true);
        const sw = Math.sin(S.pole * Math.PI * 2);
        for (const [i, hand] of [B.LeftHand, B.RightHand].entries()) {
          hand.getWorldPosition(v0); rig.worldToLocal(v0);
          const sgn = i ? -1 : 1, lift = Math.max(0, -sw * sgn) * 0.22 * S.m;
          v2.set(v0.x - 0.42 - 0.2 * sgn * sw * S.m, deck.position.y + 0.03 + lift, deck.position.z + (i ? 1 : -1) * (b.sx + 0.2));
          stretch(i ? poleHi : poleLo, v0, v2);
          baskets[i].position.copy(v2).setY(v2.y + 0.1);
        }
      }
      if (way === 3) {
        // a touch-down at the end of each turn
        const sg = Math.sign(Math.cos((S.s / 14) * Math.PI * 2));
        if (sg !== wasSign) { wasSign = sg; if (S.m > 0.5) { flip++; deck.getWorldPosition(v0); kit.onTouch?.(0.6, v0); } }
      }
      emitSnow(dt, t);
      rig.getWorldPosition(v0);
      if (spray) spray.update(dt, stage.camera);
      streaks?.update(dt, v0, Math.abs(rig.rotation.z), Math.max(0, Math.min(1, (way - 1) / 4)) * S.m);
    },
    rest(dt) {
      if (restAt) { spray?.update(dt, stage.camera); return; }
      restAt = true; S.m = 0; mix = 1;
      show(way, false); swapWorn(0); env.sled.visible = true;
      if (way) { c.root.getWorldPosition(v0); v0.y += 0.3; kit.onTouch?.(1, v0); }
      way = 0; from = 0; camUp = 0; camTall = 0;
      deck.position.set(0, 0, 0); deck.rotation.set(0, 0, 0);
      streaks?.update(dt, v0, 0, 0);
    },
    async ready() {
      const r = stage.renderer;
      if (!r) return;
      try {
        for (const tex of [skiMap, boardMap, hullMap, snowTex]) if (tex) r.initTexture(tex);
        await r.compileAsync(rig, stage.camera, stage.scene);
        await r.compileAsync(fx, stage.camera, stage.scene);
      } catch { /* it compiles when first drawn instead */ }
    },
    dispose() {
      swapWorn(0);
      for (const o of [rig, fx]) { o.removeFromParent(); o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh && !env.ghost) m.geometry?.dispose?.(); }); }
      spray?.dispose(); streaks?.dispose();
      for (const x of own) x.dispose();
    },
  };
  return kit;
}
