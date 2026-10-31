// Across the bay: six ways of swimming, like the trail's six rides and the cliff's six ways up. Each speed
// step is its own stroke with its own gear, and changing step is a moment you can't miss: a big splash, the
// new gear popping on, the banner and the speed card.
//   0 Swim Ring: upright in an orange ring, arms over it, bobbing on the swell, kicking along.
//   1 Arm Bands: yellow bands on its arms, head up, a doggy paddle with both hands.
//   2 Flippers: flat on the water, arms out on a float, big teal flippers kicking through the surface.
//   3 Goggles: a fast front crawl, arms over the water one after the other, rolling with each stroke.
//   4 Dolphin: a blue dolphin's tail on its feet, leaping right out of the water in arcs.
//   5 Torpedo: a yellow torpedo pulling it along, arms straight out in front, a long white wake behind.
// The water is solid to the eye (nothing shows through it), so everything that matters happens at or above
// the surface. Everything is worked out from the buddy's own measurements, so every size and shape swims the
// same way. All the gear is made and readied when the swim starts, and no lights are added: a step-up never
// hitches. See climbKit.ts, which does the same on the cliff.
import * as THREE from 'three';
import type { Character } from './character';
import { stage } from './stage';
import { reach } from './ik';
import { fitOf, onBone, points, shadows, showWorn } from './gear3d';
import { Spray, Streaks, backOut, bindTurn, measure, ringRound, smooth, turnBone, type RideKit, type RideState } from './kitParts';

type V = THREE.Vector3;
/** Where everything goes this frame, on the lane's own axes (x along it, y up from the water, z toward the camera). */
type Pose = { pitch: number; roll: number; bend: number; point: number; hip: V; lh: V; rh: V; lf: V; rf: V };
const blankPose = (): Pose => ({ pitch: 0, roll: 0, bend: 0, point: 0, hip: new THREE.Vector3(), lh: new THREE.Vector3(), rh: new THREE.Vector3(), lf: new THREE.Vector3(), rf: new THREE.Vector3() });
const NUMS = ['pitch', 'roll', 'bend', 'point'] as const, VECS = ['hip', 'lh', 'rh', 'lf', 'rf'] as const;
const lerpPose = (o: Pose, a: Pose, b: Pose, k: number) => {
  for (const f of NUMS) o[f] = a[f] + (b[f] - a[f]) * k;
  for (const f of VECS) o[f].lerpVectors(a[f], b[f], k);
};
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const FOAM: [number, number, number] = [0.93, 0.98, 1];
/** the swell on the bay, the same as the water's own (courses.ts) */
const swell = (x: number, z: number, t: number) => Math.sin(x * 0.45 + t * 1.7) * 0.05 + Math.sin(z * 0.7 - t * 1.3 + x * 0.2) * 0.04;
/** what the buddy has on elsewhere steps aside: hands are busy, flippers and the tail go on the feet, goggles over glasses, and nothing on its back when it leaps or tows */
const HIDE: string[][] = [['hand'], ['hand'], ['hand', 'feet'], ['hand', 'face'], ['hand', 'feet', 'back'], ['hand', 'back']];
const paint = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
};
/** A flat blade lying in the x-z plane, from `w0` wide at z 0 to `w1` wide at z `L`, its tip bending away a little. */
function bladeGeo(w0: number, w1: number, L: number, th: number, bend = 0) {
  const s = new THREE.Shape();
  s.moveTo(-w0 / 2, 0);
  s.bezierCurveTo(-w0 * 0.6, L * 0.3, -w1 / 2, L * 0.62, -w1 / 2, L * 0.98);
  s.quadraticCurveTo(-w1 * 0.25, L * 1.06, 0, L * 0.94);
  s.quadraticCurveTo(w1 * 0.25, L * 1.06, w1 / 2, L * 0.98);
  s.bezierCurveTo(w1 / 2, L * 0.62, w0 * 0.6, L * 0.3, w0 / 2, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: th, bevelEnabled: false, curveSegments: 10 });
  g.rotateX(Math.PI / 2); g.translate(0, th / 2, 0);
  if (bend) { const p = g.attributes.position as THREE.BufferAttribute; for (let i = 0; i < p.count; i++) { const u = p.getZ(i) / L; p.setY(i, p.getY(i) - u * u * bend); } g.computeVertexNormals(); }
  return g;
}

export async function swimKit(c: Character, env: { ghost?: THREE.Material | null } = {}): Promise<RideKit | null> {
  const B = c.bones, f = fitOf(c), b = measure(c);
  if (!b || !f.feet.length || !f.head || !f.back) return null;
  for (const n of ['LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Hips', 'Head', 'Spine02', 'neck']) if (!B[n]) return null;
  const own: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => { own.push(x); return x; };
  const gloss = (color: number, roughness = 0.26, extra: THREE.MeshStandardMaterialParameters = {}) => keep(new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
  // (bind units: H is the buddy's height, `upm` how many make a metre)
  const H = f.H, upm = H / b.H;
  const gear: { o: THREE.Object3D; k: number }[][] = [[], [], [], [], [], []];
  const roots: THREE.Object3D[] = [];
  const add = (way: number, parent: THREE.Object3D, o: THREE.Object3D) => { o.visible = false; parent.add(o); gear[way].push({ o, k: o.scale.x }); return o; };
  const bones = new Map<string, THREE.Group>();
  const on = (name: string) => { let g = bones.get(name); if (!g) { g = onBone(c, name)!; bones.set(name, g); roots.push(g); } return g; };
  /** the lane: at the buddy's place, level with the water */
  const rig = new THREE.Group(); stage.scene.add(rig);
  const inLane = (way: number, o: THREE.Object3D) => add(way, rig, o);

  // ---------- 0: the swim ring ----------
  const chest = points(c, ['Hips', 'Spine', 'Spine01', 'Spine02'], 0.3), ringAt = f.minY + (b.hy + (b.sy - b.hy) * 0.5) * upm, round = ringRound(chest, ringAt, H * 0.05);
  const inner = round ? Math.max(round.rx, round.rz) / upm : 0.26, tube = 0.135, ringR = inner + tube * 0.92;
  const ringHeight = b.hy + (b.sy - b.hy) * 0.5;
  const ringMap = keep(paint(256, 32, g => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff4e6' : '#ff6a1f'; g.fillRect(i * 32, 0, 32, 32); } }));
  const ring = inLane(0, new THREE.Mesh(keep(new THREE.TorusGeometry(ringR, tube, 16, 48)), keep(new THREE.MeshStandardMaterial({ map: ringMap, roughness: 0.3 }))));
  ring.rotation.x = Math.PI / 2;

  // ---------- 1: the arm bands ----------
  const yellow = gloss(0xffc21f, 0.24), bandTurn = new THREE.Quaternion();
  for (const side of ['Left', 'Right'] as const) {
    const sk = c.bones[`${side}Arm`], pts = points(c, [`${side}Arm`], 0.5);
    if (!sk || pts.length < 8) continue;
    const a = pts.reduce((p, q) => p.add(q), new THREE.Vector3()).divideScalar(pts.length);
    // along the arm: the bind pose holds it nearly straight out (side to side), a little down
    const tip = pts.reduce((p, q) => (Math.abs(q.x) > Math.abs(p.x) ? q : p), pts[0]), axis = tip.clone().sub(a).normalize();
    const r = Math.max(...pts.filter(p => Math.abs(p.clone().sub(a).dot(axis)) < H * 0.04).map(p => p.clone().sub(a).sub(axis.clone().multiplyScalar(p.clone().sub(a).dot(axis))).length()), H * 0.03);
    const fat = H * 0.042, m = new THREE.Mesh(keep(new THREE.TorusGeometry(r * 0.9 + fat, fat, 12, 28)), yellow);
    m.scale.z = 1.5;
    bandTurn.setFromUnitVectors(Z, axis); m.quaternion.copy(bandTurn); m.position.copy(a);
    const g = new THREE.Group(); g.add(m);
    add(1, on(`${side}Arm`), g);
  }

  // ---------- 2: the flippers, and a float to hold ----------
  const teal = gloss(0x19d9cf, 0.3, { side: THREE.DoubleSide }), tealDark = gloss(0x08828c, 0.4);
  for (const ft of f.feet) {
    const g = on(`${ft.side}Foot`), L = Math.max(0.38, b.H * 0.34) * upm, w0 = Math.max(ft.w * 1.15, 0.1 * upm), w1 = Math.max(ft.w * 2.1, 0.22 * upm);
    const h = new THREE.Group();
    const blade = new THREE.Mesh(keep(bladeGeo(w0, w1, L, 0.012 * upm, L * 0.1)), teal); h.add(blade);
    for (const sd of [-1, 1]) { const rib = new THREE.Mesh(keep(new THREE.BoxGeometry(0.02 * upm, 0.016 * upm, L * 0.62)), tealDark); rib.position.set(sd * w0 * 0.44, 0.002 * upm, L * 0.36); rib.rotation.y = -sd * 0.17; h.add(rib); }
    h.position.set(ft.cx, ft.sole - 0.008 * upm, ft.heel + (ft.toe - ft.heel) * 0.2);
    add(2, g, h);
    if (ft.geo) { const shell = new THREE.Mesh(ft.geo, teal); shell.position.set(ft.cx, ft.sole, (ft.heel + ft.toe) / 2).multiplyScalar(-0.05); shell.scale.setScalar(1.05); add(2, g, shell); gear[2][gear[2].length - 1].k = 1.05; }
  }
  const float = inLane(2, new THREE.Mesh(keep(bladeGeo(0.3, 0.42, 0.56, 0.06)), gloss(0xff5f8f, 0.45)));

  // ---------- 3: the goggles ----------
  const hd = f.head, headPts = points(c, ['Head'], 0.5), hr = ringRound(headPts, hd.eyes, H * 0.04) ?? { cx: hd.cx, cz: hd.zmid, rx: hd.w / 2, rz: (hd.front - hd.zmid) || H * 0.12 }, lensR = Math.max(hd.w * 0.19, H * 0.082);
  {
    const frame = gloss(0x0f5fd6, 0.3), glass = gloss(0x8fe3ff, 0.08, { metalness: 0.2, emissive: 0x1a6a9a, emissiveIntensity: 0.55 }), shineMat = gloss(0xffffff, 0.2, { emissive: 0xffffff, emissiveIntensity: 0.7 });
    const g = new THREE.Group(), lens0 = keep(new THREE.CircleGeometry(lensR, 22)), rim0 = keep(new THREE.TorusGeometry(lensR, lensR * 0.24, 8, 26)), shine0 = keep(new THREE.CircleGeometry(lensR * 0.3, 10));
    // a big round lens each side of the face, turned out so it shows from the side as well as the front
    const rx = hr.rx * 1.06, rz = hr.rz * 1.06, along = 0.6;
    for (const sd of [-1, 1]) {
      const zz = along * rz, xx = sd * rx * Math.sqrt(1 - along * along), n = new THREE.Vector3(xx / (rx * rx), 0, zz / (rz * rz)).normalize();
      const pot = new THREE.Group(); pot.position.set(hr.cx + xx, hd.eyes, hr.cz + zz); pot.quaternion.setFromUnitVectors(Z, n);
      const shine = new THREE.Mesh(shine0, shineMat); shine.position.set(-lensR * 0.3, lensR * 0.34, H * 0.004);
      pot.add(new THREE.Mesh(lens0, glass), new THREE.Mesh(rim0, frame), shine);
      g.add(pot);
    }
    const strap = new THREE.Mesh(keep(new THREE.CylinderGeometry(1, 1, H * 0.042, 32, 1, true)), gloss(0x0f5fd6, 0.5, { side: THREE.DoubleSide }));
    strap.scale.set(hr.rx * 1.05, 1, hr.rz * 1.05); strap.position.set(hr.cx, hd.eyes, hr.cz); g.add(strap);
    add(3, on('Head'), g);
  }

  // ---------- 4: the dolphin's tail and a fin on its back ----------
  const blue = gloss(0x2f8fe8, 0.3, { side: THREE.DoubleSide });
  {
    const ft = f.feet[0], L = Math.max(0.42, b.H * 0.36) * upm, W = Math.max(0.46, b.H * 0.42) * upm;
    const s = new THREE.Shape();
    // two lobes of a fluke, from the ankles back
    s.moveTo(-0.07 * upm, 0); s.bezierCurveTo(-0.1 * upm, L * 0.4, -W * 0.28, L * 0.6, -W / 2, L * 1.02); s.quadraticCurveTo(-W * 0.14, L * 0.86, 0, L * 0.66);
    s.quadraticCurveTo(W * 0.14, L * 0.86, W / 2, L * 1.02); s.bezierCurveTo(W * 0.28, L * 0.6, 0.1 * upm, L * 0.4, 0.07 * upm, 0); s.closePath();
    const g = keep(new THREE.ExtrudeGeometry(s, { depth: 0.03 * upm, bevelEnabled: false, curveSegments: 10 })); g.rotateX(Math.PI / 2);
    // (upright, like a fish's: that's the side the camera sees; between the two feet, which come together)
    const m = new THREE.Mesh(g, blue), other = f.feet[1] ?? ft;
    g.translate(0, -0.015 * upm, 0); g.rotateZ(Math.PI / 2);
    m.position.set((ft.cx + other.cx) / 2, ft.sole + 0.04 * upm, ft.heel + (ft.toe - ft.heel) * 0.3);
    add(4, on(`${ft.side}Foot`), m);
    const h = H * 0.3, out = H * 0.2, fin = new THREE.Shape();
    fin.moveTo(0, h / 2); fin.quadraticCurveTo(out * 0.72, h * 0.3, out, -h * 0.28); fin.quadraticCurveTo(out * 0.5, -h * 0.1, 0, -h / 2); fin.closePath();
    const fg = keep(new THREE.ExtrudeGeometry(fin, { depth: H * 0.022, bevelEnabled: false, curveSegments: 8 })); fg.rotateY(Math.PI / 2);
    const dorsal = new THREE.Mesh(fg, blue); dorsal.position.set(f.back.cx - H * 0.011, f.back.top - H * 0.12, f.back.z + H * 0.03);
    add(4, on('Spine02'), dorsal);
  }

  // ---------- 5: the torpedo ----------
  const torpedoL = 1.15, torpedoR = 0.22, prop = new THREE.Group();
  const torpedo = new THREE.Group();
  {
    const map = keep(paint(256, 128, g => {
      g.fillStyle = '#ffc61f'; g.fillRect(0, 0, 256, 128);
      g.fillStyle = '#ff9a1f'; g.fillRect(0, 54, 256, 6); g.fillRect(0, 68, 256, 6);
      g.fillStyle = '#c9851a'; for (let i = 0; i < 18; i++) { g.beginPath(); g.arc(14 * i + 6, 34, 2.4, 0, 7); g.fill(); g.beginPath(); g.arc(14 * i + 6, 94, 2.4, 0, 7); g.fill(); }
    }));
    const prof: [number, number][] = [[0, 0], [0.05, 0.62], [0.12, 0.84], [0.22, 0.97], [0.35, 1], [0.7, 1], [0.84, 0.86], [0.94, 0.56], [1, 0.3]];
    const body = new THREE.Mesh(keep(new THREE.LatheGeometry(prof.map(([u, r]) => new THREE.Vector2(Math.max(0.002, r * torpedoR), torpedoL * (0.5 - u))), 22)), keep(new THREE.MeshStandardMaterial({ map, roughness: 0.25 })));
    const noseGeo = keep(new THREE.SphereGeometry(torpedoR * 0.72, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2)), nose = new THREE.Mesh(noseGeo, gloss(0x1f7fe8, 0.12, { metalness: 0.3 })); nose.position.y = torpedoL * 0.42;
    const glassRing = new THREE.Mesh(keep(new THREE.TorusGeometry(torpedoR * 0.34, torpedoR * 0.09, 8, 20)), gloss(0xff8a1f, 0.3)), port = new THREE.Mesh(keep(new THREE.CircleGeometry(torpedoR * 0.34, 18)), gloss(0x8fe3ff, 0.1, { emissive: 0x1a5a8a, emissiveIntensity: 0.5 }));
    glassRing.position.set(0, torpedoL * 0.1, torpedoR * 0.98); port.position.copy(glassRing.position).setZ(torpedoR * 0.975);
    const fins = gloss(0xff5a2a, 0.3, { side: THREE.DoubleSide }), finS = new THREE.Shape(); finS.moveTo(0, 0); finS.lineTo(torpedoR * 0.62, -torpedoL * 0.17); finS.lineTo(torpedoR * 0.62, -torpedoL * 0.27); finS.lineTo(0, -torpedoL * 0.16); finS.closePath();
    const fg = keep(new THREE.ShapeGeometry(finS));
    for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const m = new THREE.Mesh(fg, fins); m.rotation.y = a; m.position.y = -torpedoL * 0.2; m.position.x = Math.cos(a) * torpedoR * 0.7; m.position.z = -Math.sin(a) * torpedoR * 0.7; torpedo.add(m); }
    torpedo.add(body, nose, glassRing, port);
    const bladeG = keep(new THREE.BoxGeometry(torpedoR * 1.5, 0.012, 0.09));
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(bladeG, steelBlade()); m.rotation.y = (i / 3) * Math.PI * 2; m.rotation.z = 0.0; prop.add(m); }
    prop.position.y = -torpedoL * 0.53; torpedo.add(prop);
    // lying along the lane, nose first, the porthole toward the camera
    torpedo.rotation.z = -Math.PI / 2;
  }
  function steelBlade() { return gloss(0xc9d2dc, 0.3, { metalness: 0.7 }); }
  inLane(5, torpedo);

  for (const w of gear) for (const x of w) shadows(x.o);
  if (env.ghost) for (const w of gear) for (const x of w) x.o.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.material = env.ghost!; m.castShadow = false; } });

  // ---------- the wake, the spray, and the water rushing past ----------
  const fx = new THREE.Group(); stage.scene.add(fx);
  const wakeMap = keep(paint(256, 128, g => {
    g.clearRect(0, 0, 256, 128);
    const drawV = (a: number, w: number) => { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(250, 64); g.quadraticCurveTo(120, 48, 8, 6); g.moveTo(250, 64); g.quadraticCurveTo(120, 80, 8, 122); g.stroke(); };
    g.filter = 'blur(5px)'; drawV(0.55, 18); g.filter = 'blur(1px)'; drawV(0.85, 4);
    g.filter = 'blur(10px)'; const grad = g.createLinearGradient(0, 0, 256, 0); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(255,255,255,0.75)'); g.fillStyle = grad; g.beginPath(); g.moveTo(250, 64); g.lineTo(20, 30); g.lineTo(20, 98); g.closePath(); g.fill();
    g.filter = 'none';
    g.globalCompositeOperation = 'destination-in'; const fade = g.createLinearGradient(0, 0, 256, 0); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(0.5, 'rgba(0,0,0,0.9)'); fade.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = fade; g.fillRect(0, 0, 256, 128);
  }));
  const wakeMat = keep(new THREE.MeshBasicMaterial({ map: wakeMap, transparent: true, depthWrite: false, opacity: 0 }));
  const wake = new THREE.Mesh(keep(new THREE.PlaneGeometry(1, 1)), wakeMat); wake.rotation.x = -Math.PI / 2; wake.visible = !env.ghost; wake.renderOrder = 1; fx.add(wake);
  const spray = env.ghost ? null : new Spray(fx, 110, 0.72), streaks = env.ghost ? null : new Streaks(fx, 12, 0xffffff, [5, 0.02, 2.6], 0.12);

  // ---------- the six poses ----------
  const S = { x: 0, t: 0, v: 0, m: 0, z: 0, kick: 0, stroke: 0, leap: 0, paddle: 0, sw: 0 };
  const torso = b.sy - b.hy, reachUp = b.arm * 0.96;
  const shoulder = (p: Pose) => ({ x: p.hip.x + Math.sin(p.pitch) * torso, y: p.hip.y + Math.cos(p.pitch) * torso });
  const trail = (p: Pose, q: number) => [p.hip.x - Math.sin(p.pitch + q) * b.leg * 0.98, p.hip.y - Math.cos(p.pitch + q) * b.leg * 0.98];
  const poses: ((p: Pose) => void)[] = [
    // Swim Ring: upright, arms over the ring, bobbing, kicking along underneath
    p => {
      const bob = S.sw + Math.sin(S.t * 2.2) * 0.022;
      p.pitch = 0.1 + Math.sin(S.t * 1.3) * 0.03 + S.m * 0.06; p.roll = Math.sin(S.t * 1.7) * 0.04; p.bend = -0.04; p.point = 0.6;
      p.hip.set(0, b.hy - ringHeight + bob + 0.02, 0);
      const zz = ringR * 0.96, hy = tube * 0.9 + bob;
      p.lh.set(ringR * 0.34, hy, -zz); p.rh.set(ringR * 0.34, hy, zz);
      const k = Math.sin(S.t * 5) * 0.05 * S.m, an = p.hip.y - b.leg * 0.92;
      p.lf.set(-0.1 + k, an, -b.hx); p.rf.set(-0.1 - k, an, b.hx);
    },
    // Arm Bands: head up, a doggy paddle: both hands in small quick circles in front of its chin
    p => {
      const q = S.paddle * Math.PI * 2, m = 0.4 + 0.6 * S.m;
      p.pitch = 0.74; p.roll = Math.sin(q) * 0.1; p.bend = 0.5; p.point = 0.9;
      p.hip.set(-0.08, 0.15 - Math.cos(0.74) * torso + S.sw + Math.sin(q * 2) * 0.012, 0);
      const s = shoulder(p), rad = b.arm * 0.3 * m, cx = s.x + b.arm * 0.66, cy = 0.13 + S.sw;
      p.lh.set(cx + Math.cos(q) * rad, cy + Math.sin(q) * rad * 0.9, -b.sx * 0.72); p.rh.set(cx + Math.cos(q + Math.PI) * rad, cy + Math.sin(q + Math.PI) * rad * 0.9, b.sx * 0.72);
      const k = Math.sin(q) * 0.14, [lx, ly] = trail(p, k), [rx, ry] = trail(p, -k);
      p.lf.set(lx, ly, -b.hx); p.rf.set(rx, ry, b.hx);
    },
    // Flippers: flat on the water, arms out on the float, a long proper kick breaking the surface
    p => {
      const q = S.kick * Math.PI * 2, m = 0.35 + 0.65 * S.m;
      p.pitch = 1.3; p.roll = 0; p.bend = 0.95; p.point = 1.25;
      p.hip.set(-0.1, 0.03 + S.sw * 0.6, 0);
      const s = shoulder(p), hx = s.x + reachUp;
      p.lh.set(hx, 0.1 + S.sw, -0.1); p.rh.set(hx, 0.1 + S.sw, 0.1);
      const an = p.hip.x - b.leg * 0.97, lift = Math.max(0.13, b.leg * 0.42) * m;
      p.lf.set(an, p.hip.y + 0.08 + Math.sin(q) * lift, -b.hx - 0.02); p.rf.set(an, p.hip.y + 0.08 - Math.sin(q) * lift, b.hx + 0.02);
    },
    // Goggles: a fast crawl: one arm right over the water, then the other, the body rolling with it
    p => {
      const q = S.stroke, tw = Math.PI * 2, roll = Math.sin(q * tw) * 0.34 * (0.4 + 0.6 * S.m);
      p.pitch = 1.3; p.roll = roll; p.bend = 0.92; p.point = 1.25;
      p.hip.set(-0.12, 0.02 + S.sw * 0.5, 0);
      const s = shoulder(p);
      const arm = (o: number, z: number, h: V) => {
        const u = (q + o) % 1;
        if (u < 0.55) {
          // over the water: from the hip, high over, to the entry far ahead
          const a = u / 0.55;
          h.set(s.x - b.arm * 0.7 + (b.arm * 1.65) * smooth(a), 0.08 + Math.sin(a * Math.PI) * b.arm * 1.05, z);
        } else {
          // under the water, pulling back (it's out of sight, so it just has to come round)
          const a = (u - 0.55) / 0.45;
          h.set(s.x + b.arm * 0.95 - b.arm * 1.65 * a, 0.02 - Math.sin(a * Math.PI) * 0.22, z);
        }
      };
      arm(0, -b.sx - 0.04, p.lh); arm(0.5, b.sx + 0.04, p.rh);
      const kq = q * tw * 3, an = p.hip.x - b.leg * 0.97, l = 0.09 * S.m;
      p.lf.set(an, 0.03 + Math.sin(kq) * l, -b.hx); p.rf.set(an, 0.03 - Math.sin(kq) * l, b.hx);
    },
    // Dolphin: feet together and arms straight ahead, leaping out of the water and diving back in
    p => {
      const q = S.leap, air = 0.66, top = (b.H * 0.45 + 0.42) * (0.25 + 0.75 * S.m);
      let y = 0, slope = 0;
      if (q < air) { const a = q / air; y = Math.sin(a * Math.PI) * top; slope = Math.cos(a * Math.PI) * 1.05; }
      else { const a = (q - air) / (1 - air); y = -Math.sin(a * Math.PI) * 0.34; slope = -Math.cos(a * Math.PI) * 0.8; }
      const wig = Math.sin(q * Math.PI * 4) * 0.08 * S.m;
      p.pitch = Math.PI / 2 - slope * (0.25 + 0.75 * S.m) + 0.06; p.roll = 0; p.bend = 0.42 - slope * 0.1; p.point = 1.35;
      p.hip.set(0, 0.04 + y + S.sw * 0.5, 0);
      const dx = Math.sin(p.pitch), dy = Math.cos(p.pitch), hand = torso + reachUp * 1.02;
      p.lh.set(p.hip.x + dx * hand, p.hip.y + dy * hand, -0.07); p.rh.set(p.hip.x + dx * hand, p.hip.y + dy * hand, 0.07);
      const [ax, ay] = trail(p, wig);
      p.lf.set(ax, ay, -0.045); p.rf.set(ax, ay, 0.045);
    },
    // Torpedo: dead straight, arms out in front, holding on to the torpedo, legs streaming behind
    p => {
      const k = Math.sin(S.t * 24) * 0.018 * S.m;
      p.pitch = 1.38; p.roll = Math.sin(S.t * 2) * 0.03; p.bend = 0.9; p.point = 1.35;
      p.hip.set(-0.42, 0.08 + S.sw * 0.5, 0);
      const s = shoulder(p), hx = s.x + reachUp, y = 0.14 + S.sw;
      p.lh.set(hx, y, -0.13); p.rh.set(hx, y, 0.13);
      const an = p.hip.x - b.leg * 0.98;
      p.lf.set(an, 0.09 + k, -0.05); p.rf.set(an, 0.09 - k, 0.05);
    },
  ];

  // ---------- running it ----------
  let way = 0, from = 0, mix = 1, camUp = 0, camTall = 0, popAt = -9, hopAt = -9, restAt = true, sprayT = 0, wakeK = 0, wetWas = false, handWas = [false, false], flapT = 0;
  const A = blankPose(), Bp = blankPose(), P = blankPose();
  const feet = ['LeftFoot', 'RightFoot'].map(n => [B[n], bindTurn(c, n)] as const);
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), pq = new THREE.Quaternion(), rootQ = new THREE.Quaternion();
  const showWay = (w: number, vis: boolean) => { for (const x of gear[w]) x.o.visible = vis; };
  const swapWorn = (w: number) => { for (const slot of ['hand', 'feet', 'back', 'face'] as const) showWorn(c, slot, !HIDE[w].includes(slot)); };
  const ofRig = (o: Pose) => {
    rig.updateMatrixWorld(true);
    o.hip.copy(B.Hips.getWorldPosition(v0)); rig.worldToLocal(o.hip);
    o.lh.copy(B.LeftHand.getWorldPosition(v0)); rig.worldToLocal(o.lh);
    o.rh.copy(B.RightHand.getWorldPosition(v0)); rig.worldToLocal(o.rh);
    o.lf.copy(B.LeftFoot.getWorldPosition(v0)); rig.worldToLocal(o.lf);
    o.rf.copy(B.RightFoot.getWorldPosition(v0)); rig.worldToLocal(o.rf);
  };
  const dir = (a: [number, number, number], m: THREE.Matrix4) => new THREE.Vector3(a[0], a[1], a[2]).transformDirection(m);
  /** The buddy in the water, hips on their mark, the back arched so the head looks forward, then hands and feet. */
  const apply = (p: Pose, hop: number) => {
    q0.setFromAxisAngle(Y, Math.PI / 2); q1.setFromAxisAngle(X, p.pitch); q2.setFromAxisAngle(Y, p.roll);
    rootQ.copy(q0).multiply(q1).multiply(q2);
    c.root.quaternion.copy(rootQ);
    c.root.updateMatrixWorld(true);
    c.uprightSpine(1, true);
    // the arch: a little in the back, more in the neck
    if (p.bend > 0.01) { turnBone(B.Spine02, Z, p.bend * 0.3); turnBone(B.neck, Z, p.bend * 0.35); turnBone(B.Head, Z, p.bend * 0.35); }
    B.Hips.getWorldPosition(v0); rig.localToWorld(v1.copy(p.hip)); v1.y += hop;
    c.root.position.add(v1.sub(v0));
    c.root.updateMatrixWorld(true);
    const rm = c.root.matrixWorld, up = way === 3 ? [1, 0.2, -0.1] as [number, number, number] : [1, -0.7, -0.35] as [number, number, number];
    const eL = dir(up, rm), eR = dir([-up[0], up[1], up[2]], rm);
    if (way === 3) { eL.set(0, 1, -0.6).normalize(); eR.set(0, 1, 0.6).normalize(); }
    if (way === 2 || way === 4 || way === 5) { eL.set(0, 1, -0.5).normalize(); eR.set(0, 1, 0.5).normalize(); }
    const knee = dir([0, 0, 1], rm);
    reach(B.LeftArm, B.LeftForeArm, B.LeftHand, rig.localToWorld(v1.copy(p.lh)).setY(p.lh.y + hop), eL);
    reach(B.RightArm, B.RightForeArm, B.RightHand, rig.localToWorld(v1.copy(p.rh)).setY(p.rh.y + hop), eR);
    reach(B.LeftUpLeg, B.LeftLeg, B.LeftFoot, rig.localToWorld(v1.copy(p.lf)).setY(p.lf.y + hop), knee);
    reach(B.RightUpLeg, B.RightLeg, B.RightFoot, rig.localToWorld(v1.copy(p.rf)).setY(p.rf.y + hop), knee);
    // toes pointed back along the legs
    q0.setFromAxisAngle(X, p.point);
    for (const [bone, bind] of feet) {
      q1.copy(rootQ).multiply(q0).multiply(bind);
      bone.parent!.getWorldQuaternion(pq);
      bone.quaternion.copy(pq.invert().multiply(q1));
      bone.updateMatrixWorld(true);
    }
  };
  /** A splash at a spot on the lane. */
  const splash = (x: number, z: number, n: number, up: number, size: number) => {
    if (!spray) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.6 + Math.random();
      spray.emit(v1.set(rig.position.x + x + Math.cos(a) * 0.08, 0.1, rig.position.z + z + Math.sin(a) * 0.08), Math.cos(a) * r * 0.8, up * (0.6 + Math.random() * 0.8), Math.sin(a) * r * 0.8, size * (0.35 + Math.random() * 0.45), 0.5, 0.5, 7, FOAM, 0.95);
    }
  };
  const emitWater = (dt: number, t: number) => {
    if (!spray) return;
    sprayT -= dt;
    const m = S.m;
    if (way === 0 && m > 0.2 && sprayT <= 0) { sprayT = 0.2; splash(-ringR - 0.1, (Math.random() - 0.5) * 0.3, 1, 1.1, 0.14); }
    if (way === 1 && sprayT <= 0) { sprayT = 0.12; const h = Math.random() < 0.5 ? P.lh : P.rh; if (h.y > -0.06) splash(h.x, h.z, 1, 1.3, 0.14); }
    if (way === 2 && m > 0.2 && sprayT <= 0) {
      // the kick throws water up behind it
      sprayT = 0.045;
      const fq = Math.random() < 0.5 ? P.lf : P.rf;
      splash(fq.x - b.H * 0.34, fq.z, 1, 2.1, 0.18);
    }
    if (way === 3) {
      for (const [i, h] of [P.lh, P.rh].entries()) {
        const wet = h.y < 0.1;
        if (wet && !handWas[i]) { splash(h.x, h.z, 6, 2.2, 0.2); kit.onTouch?.(0.25, v0.set(rig.position.x + h.x, 0.2, h.z)); }
        handWas[i] = wet;
      }
      if (m > 0.2 && sprayT <= 0) { sprayT = 0.09; splash(P.lf.x - 0.15, (Math.random() - 0.5) * 0.3, 1, 1.5, 0.15); }
    }
    if (way === 4) {
      const wet = P.hip.y < 0.08;
      if (wet !== wetWas) { wetWas = wet; if (m > 0.3) { splash(P.hip.x + (wet ? 0.3 : -0.3), 0, 12, 3.2, 0.24); kit.onTouch?.(wet ? 1 : 0.5, v0.copy(c.root.position).setY(0.2)); } }
    }
    if (way === 5 && m > 0.15 && sprayT <= 0) {
      // the bow wave off the nose, and the wash behind the propeller
      sprayT = 0.02;
      const nose = torpedo.position.x + torpedoL * 0.5;
      for (const sd of [-1, 1]) spray.emit(v1.set(rig.position.x + nose, 0.12, rig.position.z + sd * torpedoR), -S.v * 0.3 - 0.4, 1.3 + Math.random() * 0.9, sd * (1.1 + Math.random() * 0.8), 0.14, 0.42, 1.1, 6, FOAM);
      splash(P.lf.x - 0.2, (Math.random() - 0.5) * 0.25, 1, 1.4, 0.2);
    }
    void t;
  };

  const kit: RideKit = {
    get way() { return way; },
    get camUp() { return camUp; },
    get camTall() { return camTall; },
    onChange: null, onTouch: null,
    lead(dt, t, st) {
      S.x = st.s; S.t = t; S.v = st.v; S.z = st.lane;
      S.m += (Math.min(1, st.v / 0.3) - S.m) * Math.min(1, dt * 5);
      // (a stroke's pace follows the buddy's speed; each stays lively at a child's pace)
      const go = 0.3 + 0.7 * S.m;
      S.kick += dt * go * (1.5 + st.v * 0.6); S.stroke = (S.stroke + dt * go * (0.62 + st.v * 0.24)) % 1; S.paddle += dt * go * 1.5;
      S.leap = (S.leap + dt * (S.m > 0.3 ? 0.55 + st.v * 0.3 : 0.3)) % 1;
      S.sw = swell(st.at.x, st.lane, t);
      if (restAt) { restAt = false; swapWorn(way); showWay(way, true); }
      if (st.step !== way) {
        const up = st.step > way;
        Object.assign(A, { ...P, hip: A.hip, lh: A.lh, rh: A.rh, lf: A.lf, rf: A.rf });
        ofRig(A);
        showWay(way, false); from = way; way = st.step; mix = 0; popAt = t; swapWorn(way); showWay(way, true);
        if (up) hopAt = t;
        v0.set(st.at.x, 0.3, st.lane);
        kit.onChange?.(way, up, v0);
        if (up) { rig.position.x = st.at.x; splash(0, 0, 30, 3.6, 0.3); }
      }
      camUp += ([0, 0.05, 0, 0.1, 0.42, 0][way] - camUp) * Math.min(1, dt * 3);
      camTall += ([0, 0.1, 0.25, 0.3, 0.9, 0.3][way] - camTall) * Math.min(1, dt * 3);
      mix = Math.min(1, mix + dt / (from > way ? 0.7 : 0.4));
      rig.position.set(st.at.x, 0, st.lane);
      c.play('idle', 0.25);
    },
    follow(dt, t) {
      const k = smooth(mix), hop = t - hopAt < 0.55 ? Math.sin(((t - hopAt) / 0.55) * Math.PI) * 0.34 : 0;
      poses[way](Bp);
      lerpPose(P, A, Bp, k);
      apply(P, hop);
      // the gear pops on, a little too big, then settles
      const pop = backOut((t - popAt) / 0.34);
      for (const x of gear[way]) x.o.scale.setScalar(x.k * Math.max(0.02, pop));
      if (way === 0) { ring.position.set(0, P.hip.y + ringHeight - b.hy, 0); ring.rotation.set(Math.PI / 2 + Math.sin(S.t * 1.3) * 0.05, Math.sin(S.t * 1.7) * 0.05, 0); }
      if (way === 2) { float.position.set(P.lh.x - 0.05, 0.08 + S.sw, 0); float.rotation.set(0, Math.PI / 2, 0); }
      if (way === 5) { torpedo.position.set(P.lh.x + torpedoL * 0.5 + 0.1, 0.12 + S.sw, 0); prop.rotation.y = t * 30; }
      emitWater(dt, t);
      // the wake: how long and how bright each stroke leaves it
      const want = [0.2, 0.3, 0.55, 0.6, 0.15, 1][way] * S.m;
      wakeK += (want - wakeK) * Math.min(1, dt * 3);
      if (!env.ghost) {
        const len = 1.6 + 5 * wakeK, wid = 1 + 2.4 * wakeK;
        wake.position.set(rig.position.x + Math.min(P.lf.x, P.rf.x) - b.H * 0.2 - len / 2, 0.115, S.z); wake.scale.set(len, wid, 1);
        wakeMat.opacity = Math.min(0.9, wakeK * 1.15);
      }
      spray?.update(dt, stage.camera);
      streaks?.update(dt, v1.set(rig.position.x, 0, S.z), 0, Math.max(0, Math.min(1, (way - 1) / 4)) * S.m);
      void flapT;
    },
    rest(dt, t) {
      if (restAt) { spray?.update(dt, stage.camera); return; }
      restAt = true; S.m = 0; mix = 1;
      showWay(way, false); swapWorn(0);
      c.root.rotation.set(0, 0, 0);
      wakeMat.opacity = 0; wakeK = 0;
      if (spray) { c.root.getWorldPosition(v0); splash(0, 0, 10, 2.2, 0.22); }
      kit.onTouch?.(0.6, v0.copy(c.root.position).setY(0.4));
      way = 0; from = 0; camUp = 0; camTall = 0; popAt = t;
      streaks?.update(dt, v1, 0, 0);
    },
    async ready() {
      const r = stage.renderer;
      if (!r) return;
      try {
        for (const tex of [ringMap, wakeMap]) r.initTexture(tex);
        await r.compileAsync(rig, stage.camera, stage.scene);
        await r.compileAsync(fx, stage.camera, stage.scene);
        for (const w of gear) for (const x of w) if (x.o.parent !== rig) await r.compileAsync(x.o, stage.camera, stage.scene);
      } catch { /* it compiles when first drawn instead */ }
    },
    dispose() {
      swapWorn(0);
      for (const o of [...roots, rig, fx]) {
        o.removeFromParent();
        o.traverse(x => { const m = x as THREE.Mesh; if (m.isMesh && !f.feet.some(ft => ft.geo === m.geometry)) m.geometry?.dispose?.(); });
      }
      spray?.dispose(); streaks?.dispose();
      for (const x of own) x.dispose();
    },
  };
  return kit;
}
