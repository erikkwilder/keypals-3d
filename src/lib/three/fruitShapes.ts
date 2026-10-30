// The Juice Jungle's fruit in 3D, for the ratios Learn episodes (and Smoothie Stand): a strawberry with
// its seeds and leafy cap, a curved banana, a blueberry with its little crown, a mango, half a kiwi (cut
// side up), an orange, and a gold coin for prices. Made in counter units (a counter's radius is 1), like
// the fraction shapes, so they grow and shrink with the picture. `main` takes the colour (the gold glow of
// the ones you count), `extra` is the undyed part (leaves, stems, a banana's tips).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Hue } from '../math/learn';

export type FruitKind = 'straw' | 'banana' | 'berry' | 'mango' | 'kiwi' | 'orange' | 'coin';

const lathe = (pts: number[][], n = 28) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), n);
/** little leaves in a ring (a strawberry's cap, an orange's), lying out from the middle */
function leaves(n: number, len: number, wide: number, y: number, tilt: number) {
  const out: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const l = new THREE.SphereGeometry(1, 10, 6);
    l.scale(len, 0.05, wide); l.translate(len * 0.9, 0, 0); l.rotateZ(tilt); l.translate(0, y, 0); l.rotateY((i / n) * Math.PI * 2 + 0.4);
    out.push(l.toNonIndexed());
  }
  return out;
}
const stem = (r: number, h: number, y: number) => { const s = new THREE.CylinderGeometry(r * 0.7, r, h, 8); s.translate(0, y + h / 2, 0); return s.toNonIndexed(); };

/** A fruit's geometry: the coloured body, the undyed bits, and how tall it stands. */
export function fruitGeo(f: FruitKind): { main: THREE.BufferGeometry; extra: THREE.BufferGeometry | null; height: number } {
  if (f === 'straw') {
    // a plump strawberry lying on its side, its tip toward you and its leafy cap away
    const body = lathe([[0, 0], [0.18, 0.06], [0.48, 0.32], [0.7, 0.72], [0.78, 1.05], [0.7, 1.32], [0.45, 1.5], [0.12, 1.55], [0, 1.55]], 32);
    const cap = mergeGeometries([...leaves(6, 0.36, 0.16, 1.52, -0.35), stem(0.06, 0.22, 1.5)]);
    for (const g of [body, cap]) { g.translate(0, -0.78, 0); g.rotateZ(-Math.PI / 2); g.rotateX(-0.35); g.rotateY(0.45); g.scale(1.3, 1.3, 1.3); g.translate(0, 0.95, 0); }
    return { main: body, extra: cap, height: 1.5 };
  }
  if (f === 'banana') {
    // a curved banana lying flat: a tube along an arc, thick in the middle and thin at its ends
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.25, 0, 0.35), new THREE.Vector3(0, 0, -0.75), new THREE.Vector3(1.25, 0, 0.35));
    const g = new THREE.TubeGeometry(curve, 32, 0.46, 12, false);
    const p = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const t = uv.getX(i), c = curve.getPointAt(t), k = 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * t), 0.55);
      p.setXYZ(i, c.x + (p.getX(i) - c.x) * k, (p.getY(i) - c.y) * k * 0.85, c.z + (p.getZ(i) - c.z) * k);
    }
    g.computeVertexNormals(); g.translate(0, 0.4, 0);
    const a = curve.getPointAt(0), b = curve.getPointAt(1);
    const tip = (at: THREE.Vector3, r: number, h: number, ang: number) => { const s = new THREE.CylinderGeometry(r * 0.75, r, h, 8); s.rotateZ(Math.PI / 2); s.rotateY(ang); s.translate(at.x, 0.4, at.z); return s.toNonIndexed(); };
    const ends = mergeGeometries([tip(a, 0.11, 0.3, -0.6), tip(b, 0.08, 0.16, 0.6)]);
    return { main: g, extra: ends, height: 0.7 };
  }
  if (f === 'berry') {
    const b = new THREE.SphereGeometry(0.62, 22, 16); b.scale(1, 0.88, 1); b.translate(0, 0.55, 0);
    const crown: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 5; i++) { const c = new THREE.ConeGeometry(0.06, 0.14, 4); c.rotateZ(-0.5); c.translate(0.13, 1.08, 0); c.rotateY((i / 5) * Math.PI * 2); crown.push(c.toNonIndexed()); }
    return { main: b, extra: mergeGeometries(crown), height: 1.1 };
  }
  if (f === 'mango') {
    const m = new THREE.SphereGeometry(0.8, 26, 18); m.scale(1.3, 0.82, 0.95);
    // a little kidney curve: push one side in
    const p = m.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setZ(i, z + 0.12 * Math.cos((x / 1.04) * Math.PI * 0.5) * (z < 0 ? 1 : 0.4)); }
    m.computeVertexNormals(); m.translate(0, 0.66, 0);
    const leaf = new THREE.SphereGeometry(1, 10, 6); leaf.scale(0.42, 0.04, 0.16); leaf.translate(0.45, 0, 0); leaf.rotateZ(0.5); leaf.translate(-1.0, 1.0, 0);
    return { main: m, extra: mergeGeometries([leaf.toNonIndexed(), stem(0.05, 0.16, 0.92).translate(-1.0, 0, 0)]), height: 1.35 };
  }
  if (f === 'kiwi') {
    // half a kiwi, cut side up: fuzzy brown round the side, the green face on top
    const k = new THREE.CylinderGeometry(0.82, 0.74, 0.5, 36, 1);
    k.translate(0, 0.25, 0);
    return { main: k, extra: null, height: 0.5 };
  }
  if (f === 'orange') {
    const o = new THREE.SphereGeometry(0.82, 28, 20); o.scale(1, 0.94, 1); o.translate(0, 0.77, 0);
    return { main: o, extra: mergeGeometries([stem(0.05, 0.1, 1.5), ...leaves(1, 0.3, 0.13, 1.56, -0.2)]), height: 1.6 };
  }
  // a gold coin, lying flat
  const c = new THREE.CylinderGeometry(0.85, 0.85, 0.16, 40); c.translate(0, 0.08, 0);
  return { main: c, extra: null, height: 0.16 };
}

// ---------- looks ----------
const BODY: Record<FruitKind, number> = { straw: 0xe8263f, banana: 0xffd23a, berry: 0x3d4fb8, mango: 0xffffff, kiwi: 0x8a5a2b, orange: 0xffffff, coin: 0xffc53a };
const texCache = new Map<string, THREE.Texture>();
function canvas(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
/** strawberry skin: red, a touch lighter near the tip, golden seeds in rows */
const strawTex = () => canvas('straw', 256, 256, g => {
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#ff5c66'); grd.addColorStop(0.5, '#ffffff'); grd.addColorStop(1, '#ffffff');
  g.fillStyle = '#e3263c'; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.25; g.fillStyle = grd; g.fillRect(0, 0, 256, 60); g.globalAlpha = 1;
  for (let r = 0; r < 12; r++) for (let c = 0; c < 14; c++) {
    const x = c * 18.3 + (r % 2) * 9, y = 14 + r * 19;
    g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(x, y, 2.2, 3.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(120,0,20,.35)'; g.beginPath(); g.ellipse(x, y + 3, 3.4, 1.6, 0, 0, Math.PI * 2); g.fill();
  }
});
/** mango skin: red on top, orange, then yellow-green below */
const mangoTex = () => canvas('mango', 64, 256, g => {
  const grd = g.createLinearGradient(0, 0, 0, 256); grd.addColorStop(0, '#e8402e'); grd.addColorStop(0.4, '#ff8a2a'); grd.addColorStop(0.75, '#ffc23a'); grd.addColorStop(1, '#a8c83a');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,240,180,.35)'; g.fillRect(Math.random() * 64, Math.random() * 256, 1.5, 1.5); }
});
/** orange peel: dimpled */
const orangeTex = () => canvas('orange', 256, 128, g => {
  g.fillStyle = '#ff9a1f'; g.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(255,190,90,.5)' : 'rgba(210,100,10,.35)'; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 128, 1 + Math.random() * 1.6, 0, Math.PI * 2); g.fill(); }
});
/** a kiwi's cut face: bright green, a pale middle, a ring of black seeds */
const kiwiFace = () => canvas('kiwi', 256, 256, g => {
  const r = g.createRadialGradient(128, 128, 8, 128, 128, 128); r.addColorStop(0, '#fbfbe6'); r.addColorStop(0.22, '#e4f2a8'); r.addColorStop(0.3, '#9fd43a'); r.addColorStop(0.9, '#7fc22a'); r.addColorStop(1, '#6a4a22');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2, d = 40 + (i % 3) * 5; g.fillStyle = '#1a1208'; g.beginPath(); g.ellipse(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, 2.4, 5, a, 0, Math.PI * 2); g.fill(); }
  for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 50; g.strokeStyle = 'rgba(255,255,220,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30); g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); g.stroke(); }
});
/** a gold coin's face: a sun */
const coinFace = () => canvas('coin', 256, 256, g => {
  const r = g.createRadialGradient(110, 100, 10, 128, 128, 128); r.addColorStop(0, '#fff2b0'); r.addColorStop(0.6, '#ffc93a'); r.addColorStop(1, '#d99a12');
  g.fillStyle = r; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#c4860c'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 104, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#e8a417'; g.beginPath();
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, d = i % 2 ? 40 : 74; g.lineTo(128 + Math.cos(a) * d, 128 + Math.sin(a) * d); }
  g.closePath(); g.fill();
});

/** The fruit's material(s) in a hue: the gold ones you count glow warmly; crossed out ones go grey. */
export function fruitMats(f: FruitKind, hue: Hue, out: boolean, cache: (key: string, make: () => THREE.Material) => THREE.Material): THREE.Material | THREE.Material[] {
  if (out) return cache('fr-out', () => new THREE.MeshStandardMaterial({ color: 0xc9c1b4, roughness: 0.85, transparent: true, opacity: 0.5 }));
  const h = hue === 'ghost' ? 'a' : hue;
  const glow = h === 'c' ? 0.32 : h === 'b' ? 0.08 : 0.03;
  const em = h === 'c' ? 0xffb21a : h === 'b' ? 0xff6aa0 : 0x000000;
  const phys = (o: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial({ roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.3, emissive: em, emissiveIntensity: glow, ...o });
  if (f === 'kiwi') return [
    cache(`fr-kiwi-side-${h}`, () => phys({ color: BODY.kiwi, roughness: 0.95, clearcoat: 0, sheen: 1, sheenColor: new THREE.Color(0xc8a070) })),
    cache(`fr-kiwi-top-${h}`, () => phys({ map: kiwiFace(), color: 0xffffff, roughness: 0.3, clearcoat: 0.8 })),
    cache(`fr-kiwi-side-${h}`, () => phys({ color: BODY.kiwi, roughness: 0.95, clearcoat: 0 })),
  ];
  if (f === 'coin') return [
    cache(`fr-coin-edge-${h}`, () => phys({ color: 0xe0a92a, metalness: 0.8, roughness: 0.3 })),
    cache(`fr-coin-face-${h}`, () => phys({ map: coinFace(), color: 0xffffff, metalness: 0.55, roughness: 0.32 })),
    cache(`fr-coin-face-${h}`, () => phys({ map: coinFace(), color: 0xffffff, metalness: 0.55, roughness: 0.32 })),
  ];
  return cache(`fr-${f}-${h}`, () => {
    if (f === 'straw') return phys({ map: strawTex(), color: 0xffffff, roughness: 0.32, clearcoat: 0.8 });
    if (f === 'mango') return phys({ map: mangoTex(), color: 0xffffff, roughness: 0.45, clearcoat: 0.4 });
    if (f === 'orange') return phys({ map: orangeTex(), color: 0xffffff, roughness: 0.6, clearcoat: 0.2 });
    if (f === 'berry') return phys({ color: BODY.berry, roughness: 0.55, clearcoat: 0.15, sheen: 1, sheenColor: new THREE.Color(0x9fb0e8) });
    return phys({ color: 0xe0a000, roughness: 0.7, clearcoat: 0, sheen: 0, emissive: h === 'a' ? 0x6a4800 : em, emissiveIntensity: h === 'a' ? 0.35 : glow + 0.15 });
  });
}
/** leaves, stems and tips */
export function fruitExtraMat(f: FruitKind, cache: (key: string, make: () => THREE.Material) => THREE.Material) {
  if (f === 'banana') return cache('fr-tips', () => new THREE.MeshStandardMaterial({ color: 0x5a4020, roughness: 0.7 }));
  if (f === 'berry') return cache('fr-crown', () => new THREE.MeshStandardMaterial({ color: 0x24305e, roughness: 0.7 }));
  return cache('fr-leaf', () => new THREE.MeshStandardMaterial({ color: 0x3f9a3a, roughness: 0.55 }));
}
