// The Jungle Juice Bar's table things for the ratios Learn episodes (episodeProps.ts takes them for the
// 'juice' set): a bowl heaped with oranges, strawberries and a banana bunch on the left, and a blender with a
// pink smoothie and a tall layered smoothie glass on the right. Simple shapes, sized in metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const std = (color: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6, ...o });
const glass = () => new THREE.MeshPhysicalMaterial({ color: 0xf2fbff, roughness: 0.05, metalness: 0, transmission: 0.6, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
const lathe = (pts: number[][], n = 32) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: [number, number, number] = [0, 0, 0], shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...at);
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}

/** a wooden bowl heaped with fruit */
export function fruitBowl() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0, 0], [0.09, 0], [0.13, 0.03], [0.17, 0.09], [0.18, 0.11], [0.165, 0.11], [0.15, 0.09], [0.11, 0.035], [0, 0.03]]), std(0xb57a42, { roughness: 0.55, side: THREE.DoubleSide })));
  const orange = std(0xff9a1f, { roughness: 0.55 }), straw = phys({ color: 0xe3263c }), mango = phys({ color: 0xff7a2e, roughness: 0.45 });
  const ball = new THREE.SphereGeometry(0.05, 16, 12);
  const spots: [number, number, number, THREE.Material][] = [[-0.06, 0.1, 0.02, orange], [0.05, 0.1, -0.03, orange], [0, 0.13, 0.05, mango], [0.07, 0.11, 0.06, straw], [-0.05, 0.12, -0.06, straw], [0.0, 0.16, -0.01, orange]];
  for (const [x, y, z, m] of spots) { const b = mesh(ball, m, [x, y, z]); if (m === straw) b.scale.set(0.7, 0.8, 0.7); if (m === mango) b.scale.set(1.3, 0.85, 0.95); g.add(b); }
  // a banana bunch leaning on the heap
  const yellow = phys({ color: 0xffd23a, roughness: 0.45 });
  for (let i = 0; i < 3; i++) {
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.1, 0.12, 0), new THREE.Vector3(0, 0.2 + i * 0.012, 0.03), new THREE.Vector3(0.1, 0.14, 0.02));
    const b = mesh(new THREE.TubeGeometry(curve, 14, 0.018, 8), yellow);
    b.rotation.y = -0.4 + i * 0.12; b.position.set(0.02, 0.02 + i * 0.01, 0.06 - i * 0.025);
    g.add(b);
  }
  return g;
}

/** a blender: a chunky base, a glass jug of pink smoothie, a lid */
export function blender() {
  const g = new THREE.Group();
  g.add(mesh(new RoundedBoxGeometry(0.15, 0.09, 0.15, 3, 0.02), std(0xd9773a, { roughness: 0.35, metalness: 0.3 }), [0, 0.045, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16).rotateX(Math.PI / 2), std(0xffffff), [0, 0.05, 0.078], false));
  g.add(mesh(lathe([[0.05, 0], [0.065, 0.02], [0.075, 0.18], [0.072, 0.19], [0.05, 0.02]]), glass(), [0, 0.09, 0], false));
  g.add(mesh(lathe([[0, 0], [0.05, 0], [0.064, 0.02], [0.071, 0.13], [0, 0.13]]), phys({ color: 0xff8fb0, roughness: 0.5, clearcoat: 0.2 }), [0, 0.092, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.02, 24), std(0x3b3b46, { roughness: 0.4 }), [0, 0.29, 0]));
  return g;
}

/** a tall glass of layered smoothie with a straw and a strawberry on the rim */
export function smoothieGlass() {
  const g = new THREE.Group();
  g.add(mesh(lathe([[0.03, 0], [0.045, 0.005], [0.05, 0.02], [0.045, 0.06], [0.055, 0.2], [0.053, 0.2], [0.043, 0.06], [0.03, 0.01]]), glass(), [0, 0, 0], false));
  const pink = phys({ color: 0xff8fb0, roughness: 0.5 }), yellow = phys({ color: 0xffe08a, roughness: 0.5 });
  [[0.06, 0.1, pink], [0.1, 0.14, yellow], [0.14, 0.185, pink]].forEach(([y0, y1, m]) => g.add(mesh(new THREE.CylinderGeometry(0.05 * (0.86 + (y1 as number) * 0.6), 0.05 * (0.86 + (y0 as number) * 0.6), (y1 as number) - (y0 as number), 20), m as THREE.Material, [0, ((y0 as number) + (y1 as number)) / 2, 0], false)));
  const straw = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.24, 8), std(0x4fc3f7, { roughness: 0.4 }), [0.02, 0.2, 0]);
  straw.rotation.z = -0.25; g.add(straw);
  const berry = mesh(new THREE.ConeGeometry(0.025, 0.04, 12), phys({ color: 0xe3263c }), [-0.05, 0.205, 0]);
  berry.rotation.z = Math.PI * 0.85; g.add(berry);
  return g;
}

/** the juice bar's two front corners */
export function juiceProps(): { left: THREE.Group; right: THREE.Group } {
  const left = fruitBowl();
  const right = new THREE.Group();
  const b = blender(); right.add(b);
  const s = smoothieGlass(); s.position.set(-0.2, 0, 0.12); right.add(s);
  return { left, right };
}
