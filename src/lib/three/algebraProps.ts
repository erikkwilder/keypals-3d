// The Star Lab's things for the Learn episodes (episodeScene.ts): mystery boxes and brass weights as
// counters you can drag and tap, and the golden balance that stands between two pans (a board's `beam`):
// a brass post on a round foot, a beam across the top with a star on its pivot, and chains from each end
// down to its pan. The pans are the board's plates (brass ones in the Star Lab), so the counters sit in
// them as usual; the balance is drawn level, because every step keeps it level.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Hue, Shape } from '../math/learn';

type Cache = (key: string, make: () => THREE.Material) => THREE.Material;
/** the algebra shapes: a mystery box, a brass weight */
export const isAlgShape = (s: Shape): s is Extract<Shape, { k: 'box' | 'weight' }> => s.k === 'box' || s.k === 'weight';

/** A shape's geometry in counter units (RU board units to one), standing on y = 0. */
export function algShapeGeo(s: Shape, RU: number, depth: number): { main: THREE.BufferGeometry; extra: THREE.BufferGeometry | null; height: number } {
  if (s.k === 'box') {
    const w = 44, g = new RoundedBoxGeometry(w, w * 0.92, w, 4, w * 0.12);
    g.translate(0, (w * 0.92) / 2, 0);
    g.scale(1 / RU, 1 / RU, depth / RU);
    return { main: g, extra: null, height: (w * 0.92) / RU };
  }
  // a brass weight: a short round body with a rounded shoulder and a knob on top
  const R = 15, H = 26, pts = [[0, 0], [R * 0.96, 0], [R, H * 0.06], [R, H * 0.62], [R * 0.9, H * 0.72], [R * 0.42, H * 0.76], [R * 0.36, H * 0.8], [R * 0.5, H * 0.9], [R * 0.46, H], [0, H * 1.02]];
  const g = new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 28);
  g.scale(1 / RU, 1 / RU, depth / RU);
  return { main: g, extra: null, height: H / RU };
}

let boxFace: THREE.Texture | null = null;
/** the box's painted face: deep violet, a gold frame, little stars (the letter on it is a word pinned over it) */
function boxTexture() {
  if (boxFace) return boxFace;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const rg = g.createRadialGradient(128, 110, 20, 128, 128, 180);
  rg.addColorStop(0, '#a77bff'); rg.addColorStop(0.6, '#6b3fd6'); rg.addColorStop(1, '#3f1f96');
  g.fillStyle = rg; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#ffd25e'; g.lineWidth = 16; g.strokeRect(10, 10, 236, 236);
  g.strokeStyle = '#fff1b8'; g.lineWidth = 3; g.strokeRect(26, 26, 204, 204);
  g.fillStyle = '#ffe79a';
  const star = (x: number, y: number, r: number) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  for (const [x, y, r] of [[52, 54, 9], [204, 62, 7], [70, 196, 6], [196, 200, 10], [128, 40, 5]]) star(x, y, r);
  boxFace = new THREE.CanvasTexture(c); boxFace.colorSpace = THREE.SRGBColorSpace; boxFace.anisotropy = 4;
  return boxFace;
}
const BRASS: Record<'a' | 'b' | 'c', number> = { a: 0xd8981e, b: 0xd8705a, c: 0xffc93a };
export function algShapeMats(s: Shape, hue: Hue, cache: Cache): THREE.Material {
  const h = hue === 'ghost' ? 'a' : hue;
  if (s.k === 'box') return cache(`alg-box-${h}`, () => new THREE.MeshPhysicalMaterial({ map: boxTexture(), color: h === 'c' ? 0xfff0c0 : 0xffffff, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: h === 'c' ? 0xffb02a : 0x5a2fc4, emissiveIntensity: h === 'c' ? 0.35 : 0.12 }));
  return cache(`alg-wt-${h}`, () => new THREE.MeshStandardMaterial({ color: BRASS[h], metalness: 0.6, roughness: 0.3, emissive: BRASS[h], emissiveIntensity: h === 'c' ? 0.35 : 0.14 }));
}

const brass = () => new THREE.MeshStandardMaterial({ color: 0xd8a640, metalness: 0.85, roughness: 0.3 });
/** The golden balance between two pans (their middles `a` and `b` on the table, their radius `r`, in metres):
 *  its group stands at the post's foot, so it grows up out of the table. */
export function makeBalance(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.Group {
  const g = new THREE.Group();
  const mat = brass(), dark = new THREE.MeshStandardMaterial({ color: 0x6b3fd6, metalness: 0.3, roughness: 0.4 });
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const back = Math.min(a.z, b.z) - r * 1.05;
  const foot = new THREE.Vector3(mid.x, a.y, back);
  g.position.copy(foot);
  const span = b.x - a.x, H = Math.max(0.42, span * 0.62);
  // the round foot, with a violet band
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.48, 0.03, 40), mat); base.position.y = 0.015;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.39, r * 0.39, 0.012, 40), dark); band.position.y = 0.032;
  // the post, with rings
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, H, 18), mat); post.position.y = H / 2 + 0.03;
  for (const k of [0.25, 0.6]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 20).rotateX(Math.PI / 2), mat); ring.position.y = 0.03 + H * k; g.add(ring); }
  // the beam across the top, thicker in the middle, and a star on the pivot
  const top = H + 0.03;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, span, 14).rotateZ(Math.PI / 2), mat); beam.position.y = top;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.022, 28).rotateX(Math.PI / 2), mat); hub.position.set(0, top, 0.012);
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const ang = (i * Math.PI) / 5 + Math.PI / 2, rr = i % 2 ? 0.014 : 0.032; const x = Math.cos(ang) * rr, y = Math.sin(ang) * rr; if (i) starShape.lineTo(x, y); else starShape.moveTo(x, y); }
  const star = new THREE.Mesh(new THREE.ExtrudeGeometry(starShape, { depth: 0.008, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffc23d, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 }));
  star.position.set(0, top, 0.026);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), mat); cap.position.y = top + 0.05;
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.05, 12), mat); finial.position.y = top + 0.085;
  g.add(base, band, post, beam, hub, star, cap, finial);
  // each end: a ball, and chains down to three points on its pan's rim
  for (const p of [a, b]) {
    const ex = p.x - foot.x, end = new THREE.Vector3(ex, top, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), mat); ball.position.copy(end); g.add(ball);
    const rimY = r * 0.15;
    for (const ang of [Math.PI * 0.85, Math.PI * 0.15, -Math.PI / 2]) {
      const to = new THREE.Vector3(p.x - foot.x + Math.cos(ang) * r * 0.95, rimY, p.z - foot.z + Math.sin(ang) * r * 0.95 * 1.15);
      const dir = to.clone().sub(end), len = dir.length();
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, len, 6), mat);
      chain.position.copy(end).add(to).multiplyScalar(0.5);
      chain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      g.add(chain);
    }
  }
  g.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
