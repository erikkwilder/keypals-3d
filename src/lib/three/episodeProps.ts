// The things on the table round a Learn episode's picture: a bowl of blueberries and a rolling pin in the
// bakery, a rope coil and a bucket on the dock, a basket and a jug of lemonade at the picnic, toy blocks
// and a jar of brushes in the workshop, a flower pot and a watering can in the garden shed. They sit at
// the table's front corners, so the camera sees them big at the bottom of the picture (depth, like a
// film set) without covering the counters. Each place has two modelled hero things (heroProps: a pie and a
// cookie jar in the bakery, a toy boat and a lantern on the dock...); the simple shapes below stand in if
// those can't load. Sizes are in metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SetId } from '../math/episodes';
import { loadGltf } from './assets';
import { juiceProps } from './juiceProps';

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const glass = () => new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const lathe = (pts: number[][], n = 32) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number] = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
/** a heap of little balls (berries, apples) filling a round top */
function heap(g: THREE.Group, n: number, r: number, R: number, y: number, mats: THREE.Material[]) {
  const geo = new THREE.SphereGeometry(r, 12, 9);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, d = Math.sqrt(i / n) * R;
    g.add(mesh(geo, mats[i % mats.length], [Math.cos(a) * d, y + (1 - d / R) * r * 1.2 + (i % 3) * r * 0.2, Math.sin(a) * d]));
  }
}

function bowlOfBerries() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.08, 0], [0.12, 0.025], [0.155, 0.08], [0.165, 0.1], [0.152, 0.1], [0.14, 0.078], [0.1, 0.03], [0, 0.026]]), std(0xf6f1e6, { roughness: 0.25, side: THREE.DoubleSide })));
  g.add(mesh(new THREE.TorusGeometry(0.159, 0.006, 6, 40).rotateX(Math.PI / 2), std(0x4e74c8, { roughness: 0.3 }), [0, 0.1, 0]));
  heap(g, 26, 0.024, 0.12, 0.07, [std(0x2c3b86, { roughness: 0.3 }), std(0x3b4fa6, { roughness: 0.3 }), std(0x22306e, { roughness: 0.3 })]);
  return g;
}
function rollingPin() {
  const g = new THREE.Group();
  const wood = std(0xe0b07a, { roughness: 0.55 }), dark = std(0xa8703e, { roughness: 0.5 });
  const body = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 20).rotateZ(Math.PI / 2);
  g.add(mesh(body, wood, [0, 0.04, 0]));
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.1, 12).rotateZ(Math.PI / 2), dark, [s * 0.25, 0.04, 0]));
  // a dusting of flour under it
  const flour = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 1, depthWrite: false }));
  flour.position.y = 0.002; flour.scale.set(1.4, 1, 0.7); flour.receiveShadow = true;
  g.add(flour);
  g.rotation.y = 0.5;
  return g;
}
function cookieJar() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.09, 0], [0.105, 0.03], [0.105, 0.2], [0.08, 0.235], [0.075, 0.25]]), glass(), [0, 0, 0], false));
  const cookie = lathe([[0, 0], [0.06, 0], [0.066, 0.01], [0.06, 0.02], [0, 0.021]], 20);
  const c = std(0xcf8f4f, { roughness: 0.7 });
  for (let i = 0; i < 7; i++) { const m = mesh(cookie, c, [Math.sin(i * 2.1) * 0.02, 0.01 + i * 0.026, Math.cos(i * 2.1) * 0.02], false); m.rotation.set(0.3 * Math.sin(i), 0, 0.3 * Math.cos(i * 1.7)); g.add(m); }
  g.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.03, 24), std(0xb87a46), [0, 0.265, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.025, 12, 9), std(0xb87a46), [0, 0.29, 0]));
  return g;
}
function ropeCoil() {
  const g = new THREE.Group();
  const rope = std(0xd2ad72, { roughness: 0.9 });
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.TorusGeometry(0.15 - i * 0.012, 0.022, 8, 40).rotateX(Math.PI / 2), rope, [0, 0.022 + i * 0.04, 0]));
  return g;
}
function bucket() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.11, 0], [0.135, 0.2], [0.125, 0.2], [0.1, 0.012], [0, 0.012]]), std(0x9a6b3c, { side: THREE.DoubleSide })));
  for (const y of [0.05, 0.16]) g.add(mesh(new THREE.TorusGeometry(0.115 + y * 0.12, 0.006, 6, 32).rotateX(Math.PI / 2), std(0x6c6f78, { metalness: 0.6, roughness: 0.35 }), [0, y, 0], false));
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.124, 28).rotateX(-Math.PI / 2), std(0x48b6e6, { roughness: 0.08, metalness: 0.2 }));
  water.position.y = 0.17; g.add(water);
  // a starfish resting on the rim
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2, r = i % 2 ? 0.022 : 0.06; if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(r, 0); }
  const star = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 2 }).rotateX(-Math.PI / 2), std(0xff8a4c, { roughness: 0.7 }), [0.21, 0.004, 0.08]);
  g.add(star);
  return g;
}
function basket() {
  const g = new THREE.Group();
  const weave = std(0xc89a5a, { roughness: 0.85, side: THREE.DoubleSide });
  g.add(mesh(lathe([[0, 0], [0.15, 0], [0.18, 0.15], [0.17, 0.15], [0.14, 0.012], [0, 0.012]]), weave));
  for (const y of [0.04, 0.08, 0.12]) g.add(mesh(new THREE.TorusGeometry(0.152 + y * 0.2, 0.007, 6, 36).rotateX(Math.PI / 2), std(0xa9773c), [0, y, 0], false));
  g.add(mesh(new THREE.TorusGeometry(0.16, 0.012, 8, 30, Math.PI), weave, [0, 0.15, 0]));
  heap(g, 9, 0.045, 0.11, 0.12, [std(0xe23b3b, { roughness: 0.35 }), std(0xf06a2a, { roughness: 0.35 }), std(0x8fc93a, { roughness: 0.35 })]);
  return g;
}
function lemonade() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.085, 0], [0.095, 0.05], [0.09, 0.24], [0.1, 0.27]]), glass(), [0, 0, 0], false));
  g.add(mesh(lathe([[0, 0.006], [0.08, 0.006], [0.088, 0.05], [0.084, 0.19], [0, 0.19]]), std(0xffd84a, { roughness: 0.15, transparent: true, opacity: 0.85 }), [0, 0, 0], false));
  for (let i = 0; i < 2; i++) { const m = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.008, 18), std(0xfff07a, { emissive: 0xffd000, emissiveIntensity: 0.15 }), [0.02 - i * 0.03, 0.17 - i * 0.05, 0.02 * i], false); m.rotation.set(0.4 + i, 0, 0.3); g.add(m); }
  g.add(mesh(new THREE.TorusGeometry(0.05, 0.01, 8, 18, Math.PI), glass(), [0.1, 0.15, 0], false));
  return g;
}
function blockStack() {
  const g = new THREE.Group();
  const cols = [0xf0679f, 0x4a95f2, 0xffc23d, 0x5ccf8a];
  const geo = new RoundedBoxGeometry(0.11, 0.11, 0.11, 2, 0.015);
  const spots: [number, number, number, number][] = [[0, 0.055, 0, 0.1], [0.125, 0.055, 0.02, -0.2], [0.06, 0.165, 0.01, 0.35], [-0.12, 0.055, 0.09, 0.6]];
  spots.forEach(([x, y, z, r], i) => { const m = mesh(geo, std(cols[i], { roughness: 0.45 }), [x, y, z]); m.rotation.y = r; g.add(m); });
  return g;
}
/** a cluster of glowing blue crystals on a rock (the Crystal Cave Workshop) */
function crystals() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.DodecahedronGeometry(0.08), std(0x7d6a5c, { roughness: 0.9, flatShading: true }), [0, 0.03, 0]));
  const glass = std(0x7fc4ff, { roughness: 0.15, metalness: 0.1, emissive: 0x2f7fe0, emissiveIntensity: 0.55, transparent: true, opacity: 0.92, flatShading: true });
  const spots: [number, number, number, number, number][] = [[0, 0.17, 0, 0.035, 0], [0.05, 0.12, 0.02, 0.025, 0.5], [-0.05, 0.11, 0.01, 0.026, -0.45], [0.01, 0.1, 0.06, 0.02, 0.3], [-0.02, 0.09, -0.05, 0.022, -0.3]];
  for (const [x, y, z, r, lean] of spots) { const m = mesh(new THREE.OctahedronGeometry(r, 0), glass, [x, y, z]); m.scale.set(1, 3.2, 1); m.rotation.z = lean; g.add(m); }
  return g;
}
function brushJar() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.15, 20), std(0x6fa8dc, { roughness: 0.35 }), [0, 0.075, 0]));
  const tips = [0xff5c7a, 0xffc23d, 0x4a95f2, 0x5ccf8a, 0xb07cff];
  tips.forEach((c, i) => {
    const a = (i / tips.length) * Math.PI * 2, lean = 0.18;
    const stick = new THREE.Group();
    stick.add(mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.22, 8), std(0xe8c38a), [0, 0.11, 0], false));
    stick.add(mesh(new THREE.ConeGeometry(0.014, 0.04, 10), std(c, { roughness: 0.6 }), [0, 0.24, 0], false));
    stick.position.set(Math.cos(a) * 0.025, 0.06, Math.sin(a) * 0.025);
    stick.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(stick);
  });
  return g;
}
function flowerPot() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.08, 0], [0.11, 0.15], [0.125, 0.155], [0.125, 0.18], [0.105, 0.18], [0, 0.17]]), std(0xc8714a, { roughness: 0.8 })));
  const leaf = new THREE.SphereGeometry(0.06, 10, 8);
  for (let i = 0; i < 7; i++) { const a = i * 0.9, m = mesh(leaf, std(0x4f9a3a, { roughness: 0.6 }), [Math.cos(a) * 0.06, 0.22 + (i % 3) * 0.03, Math.sin(a) * 0.06]); m.scale.set(1, 0.35, 0.55); m.rotation.set(0.5, a, 0.3); g.add(m); }
  const petal = new THREE.SphereGeometry(0.03, 10, 8);
  for (const [x, y, z, c] of [[0, 0.32, 0, 0xff79b0], [0.06, 0.28, 0.03, 0xffcd3d], [-0.05, 0.29, -0.02, 0x77afff]] as const) {
    for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2, m = mesh(petal, std(c, { roughness: 0.5 }), [x + Math.cos(a) * 0.028, y, z + Math.sin(a) * 0.028], false); m.scale.set(1, 0.4, 0.7); m.rotation.y = -a; g.add(m); }
    g.add(mesh(new THREE.SphereGeometry(0.018, 10, 8), std(0xffe08a), [x, y + 0.008, z], false));
  }
  return g;
}
function wateringCan() {
  const g = new THREE.Group();
  const tin = std(0x7fb8a8, { metalness: 0.5, roughness: 0.3 });
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.17, 24), tin, [0, 0.085, 0]));
  const spout = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.22, 10), tin, [0.15, 0.14, 0]);
  spout.rotation.z = -0.95; g.add(spout);
  g.add(mesh(new THREE.CylinderGeometry(0.03, 0.022, 0.03, 12).rotateZ(-0.95), tin, [0.24, 0.205, 0], false));
  g.add(mesh(new THREE.TorusGeometry(0.07, 0.012, 8, 20, Math.PI), tin, [-0.02, 0.17, 0]));
  return g;
}

/** The set's table things: one group for the left front corner, one for the right. */
export function propsFor(id: SetId): { left: THREE.Group; right: THREE.Group } {
  const two = (a: THREE.Object3D, b: THREE.Object3D, off: [number, number]) => { const g = new THREE.Group(); b.position.set(off[0], 0, off[1]); g.add(a, b); return g; };
  switch (id) {
    case 'kitchen': return { left: two(bowlOfBerries(), cookieJar(), [-0.25, -0.22]), right: rollingPin() };
    case 'dock': return { left: ropeCoil(), right: bucket() };
    case 'picnic': return { left: basket(), right: lemonade() };
    case 'workshop': return { left: blockStack(), right: brushJar() };
    case 'garden': return { left: flowerPot(), right: wateringCan() };
    case 'cave': return { left: crystals(), right: blockStack() };
    case 'clockshop': return { left: blockStack(), right: brushJar() };
    case 'peaks': return { left: crystals(), right: blockStack() };
    case 'juice': return juiceProps();
  }
}

/** The modelled hero things (public/learn/ep/props, made with Hunyuan3D 2.1, each 1 m tall as made):
 *  [file, height in metres, turn]; the first for the left corner, the second for the right. The bakery's
 *  left corner also keeps its bowl of blueberries, beside the pie. */
// (the cookie jar came out an opaque pink pot, so the bakery has the teapot and the picnic its lemonade)
const HERO: Record<SetId, [string, number, number][]> = {
  kitchen: [['pie', 0.1, 0.3], ['teapot', 0.2, -0.6]],
  dock: [['boat', 0.32, 0.6], ['lantern', 0.36, -0.3]],
  picnic: [['basket', 0.3, 0.4], ['', 0, 0]],
  workshop: [['train', 0.22, 0.7], ['paints', 0.18, -0.3]],
  garden: [['flowerpot', 0.34, 0.2], ['can', 0.28, -0.8]],
  cave: [['', 0, 0], ['lantern', 0.36, -0.3]],
  clockshop: [['train', 0.22, 0.7], ['lantern', 0.36, -0.3]],
  peaks: [['', 0, 0], ['lantern', 0.36, -0.3]],
  juice: [['', 0, 0], ['', 0, 0]],
};
/** The set's modelled things for the front corners, or null if they can't load (the simple ones stand in). */
export async function heroProps(id: SetId): Promise<{ left: THREE.Group; right: THREE.Group } | null> {
  const want = HERO[id];
  // (an empty name: the simple one of that corner)
  const got = await Promise.all(want.map(([f]) => (f ? loadGltf(`learn/ep/props/${f}.glb`) : Promise.resolve(null))));
  if (got.some((g, i) => want[i][0] && !g)) return null;
  const simple = propsFor(id);
  const [left, right] = got.map((g, i) => {
    if (!g) return i ? simple.right : simple.left;
    const [, h, turn] = want[i];
    const o = g!.scene.clone(true);
    o.scale.setScalar(h);
    o.rotation.y = turn;
    const grp = new THREE.Group();
    grp.add(o);
    return grp;
  });
  if (id === 'kitchen') {
    // a bowl of blueberries by the pie, a rolling pin in flour by the teapot, and cookie crumbs
    const bowl = bowlOfBerries(); bowl.position.set(-0.26, 0, 0.16); left.add(bowl);
    const pin = rollingPin(); pin.position.set(0.05, 0, 0.26); pin.scale.setScalar(0.8); right.add(pin);
    const crumb = new THREE.DodecahedronGeometry(0.008), dough = new THREE.MeshStandardMaterial({ color: 0xc98a4c, roughness: 0.8 });
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(crumb, dough); m.position.set(0.14 + Math.sin(i * 2.3) * 0.08, 0.004, 0.2 + Math.cos(i * 1.7) * 0.06); m.rotation.set(i, i * 2, 0); m.scale.setScalar(0.6 + (i % 3) * 0.3); left.add(m); }
  }
  return { left, right };
}
