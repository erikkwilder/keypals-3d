// The fraction episodes' things in 3D: pie and pizza slices (each a real wedge with a baked side, its top
// the matching part of one painted pie, so the slices of a dish make the whole painted pie), chocolate
// squares (the painted square on top), cupcakes (a pleated paper cup and a swirl of icing), and the
// dishes they sit in: a pie dish, a pizza board, a bar's gold foil.
// Shapes are made in the counters' own units (a counter's radius is 1; `RU` board units make one), so
// they grow and shrink with the picture like every other counter.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Hue, Shape } from '../math/learn';
import { tileGeo, tileKey, tileMat } from './shapeTiles';
import { fruitExtraMat, fruitGeo, fruitMats } from './fruitShapes';
import { algShapeGeo, algShapeMats, isAlgShape } from './algebraProps';
import { coinGeo, coinMats, type CoinTex } from './coinShapes';

/** where slice i of n sits (its middle), from the middle of a whole of radius R (board units) */
export function sliceAt(n: number, i: number, R: number) {
  const th = (Math.PI * 2) / n, a = (i + 0.5) * th - Math.PI / 2;
  const d = n === 1 ? 0 : (4 * R * Math.sin(th / 2)) / (3 * th);
  return { dx: Math.cos(a) * d, dy: Math.sin(a) * d };
}

export const shapeKey = (s: Shape) => (s.k === 'wedge' ? `w:${s.food}:${s.n}:${s.i}:${s.r}` : s.k === 'chunk' ? `c:${s.w}` : s.k === 'tile' ? tileKey(s) : s.k === 'fruit' ? `f:${s.f}` : s.k === 'cupcake' ? 'cup' : s.k === 'coin' ? `coin:${s.c}` : s.k);

/** A shape's geometry in counter units: `main` carries the colour (two material groups for a wedge: its
 *  top and its sides), `extra` an undyed part (a cupcake's paper cup). */
export function shapeGeo(s: Shape, RU: number, depth: number): { main: THREE.BufferGeometry; extra: THREE.BufferGeometry | null; height: number } {
  if (s.k === 'fruit') return fruitGeo(s.f);
  if (s.k === 'coin') return coinGeo(s.c, RU, depth);
  if (s.k === 'wedge') return wedge(s.food, s.n, s.i, s.r, RU, depth);
  if (s.k === 'tile') return tileGeo(s, RU, depth);
  if (isAlgShape(s)) return algShapeGeo(s, RU, depth);
  if (s.k === 'chunk') {
    const w = s.w, h = w * 0.3;
    const g = new RoundedBoxGeometry(w * 0.94, h, w * 0.94, 3, w * 0.07);
    g.translate(0, h / 2, 0);
    g.scale(1 / RU, 1 / RU, depth / RU);
    return { main: g, extra: null, height: h / RU };
  }
  return cupcake();
}

function wedge(food: 'pie' | 'pizza', n: number, i: number, R: number, RU: number, depth: number) {
  const th = (Math.PI * 2) / n, a0 = i * th - Math.PI / 2;
  const { dx, dy } = sliceAt(n, i, R);
  const H = R * (food === 'pie' ? 0.2 : 0.085), bt = H * 0.16;
  // the slice's outline round its own middle, pulled in a touch so the cuts show
  const k = n === 1 ? 0.985 : 0.965, steps = Math.max(6, Math.round((th / (Math.PI * 2)) * 64));
  const pts: THREE.Vector2[] = [];
  if (n > 1) pts.push(new THREE.Vector2(-dx * k, -dy * k));
  for (let j = 0; j <= steps; j++) { const a = a0 + (th * j) / steps; pts.push(new THREE.Vector2((Math.cos(a) * R - dx) * k, (Math.sin(a) * R - dy) * k)); }
  const shape = new THREE.Shape(pts);
  // the top: the slice's own part of the whole painted pie; the sides: baked layers top to bottom
  const uvGen = {
    generateTopUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number) {
      return [a, b, c].map(q => new THREE.Vector2(0.5 + (v[q * 3] / k + dx) / (2 * R), 0.5 - (v[q * 3 + 1] / k + dy) / (2 * R)));
    },
    generateSideWallUV(_g: THREE.ExtrudeGeometry, v: number[], a: number, b: number, c: number, d: number) {
      return [a, b, c, d].map(q => new THREE.Vector2((v[q * 3] + v[q * 3 + 1]) / (R * 0.6), Math.min(1, Math.max(0, (v[q * 3 + 2] + bt) / (H + bt * 2)))));
    },
  };
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: bt, bevelSize: R * 0.012, bevelSegments: 2, curveSegments: steps, UVGenerator: uvGen });
  // lying on the table: the outline flat (board y is toward you), the depth going up
  g.rotateX(Math.PI / 2);
  g.translate(0, H + bt, 0);
  g.scale(1 / RU, 1 / RU, depth / RU);
  return { main: g, extra: null, height: (H + bt * 2) / RU };
}

function cupcake() {
  // a pleated paper cup
  const cupPts = [[0, 0], [0.6, 0], [0.64, 0.05], [0.8, 0.72], [0.84, 0.76]].map(([a, b]) => new THREE.Vector2(a, b));
  const cup = new THREE.LatheGeometry(cupPts, 48);
  const p = cup.attributes.position as THREE.BufferAttribute;
  for (let q = 0; q < p.count; q++) {
    const x = p.getX(q), z = p.getZ(q), r = Math.hypot(x, z);
    if (r < 1e-4) continue;
    const a = Math.atan2(z, x), w = 1 + Math.cos(a * 24) * 0.035;
    p.setXYZ(q, (x / r) * r * w, p.getY(q), (z / r) * r * w);
  }
  cup.computeVertexNormals();
  // a swirl of icing: three soft rings getting smaller, and a curl on top
  const rings: THREE.BufferGeometry[] = [];
  for (const [r, t, y] of [[0.6, 0.27, 0.92], [0.42, 0.24, 1.22], [0.22, 0.2, 1.47]] as const) { const tg = new THREE.TorusGeometry(r, t, 14, 40).rotateX(Math.PI / 2); tg.translate(0, y, 0); rings.push(tg.toNonIndexed()); }
  const tip = new THREE.ConeGeometry(0.17, 0.32, 20); tip.translate(0, 1.72, 0); rings.push(tip.toNonIndexed());
  const fill = new THREE.CylinderGeometry(0.8, 0.8, 0.2, 32); fill.translate(0, 0.84, 0); rings.push(fill.toNonIndexed());
  const icing = mergeGeometries(rings);
  icing.computeVertexNormals();
  // (a little bigger than a counter: a cupcake you'd want)
  const S = 1.25;
  icing.scale(S, S, S); cup.scale(S, S, S);
  return { main: icing, extra: cup, height: 1.9 * S };
}

// ---------- looks ----------
/** the colours a hue tints each thing: a = as it comes, b = the second lot, c = the gold ones you count */
const TINT: Record<'a' | 'b' | 'c', number> = { a: 0xffffff, b: 0xffc2d6, c: 0xffdc8a };
const ICING: Record<'a' | 'b' | 'c', number> = { a: 0x62b0ff, b: 0xff9cc8, c: 0xffd75a };

export type FracTex = { pie: THREE.Texture | null; pizza: THREE.Texture | null; choc: THREE.Texture | null; /** the Sky Market's coins and bill */ coins?: CoinTex };

/** The materials for a shape in a hue: [top, sides] for a wedge, one for the rest. */
export function shapeMats(s: Shape, hue: Hue, out: boolean, tex: FracTex, cache: (key: string, make: () => THREE.Material) => THREE.Material): THREE.Material | THREE.Material[] {
  if (s.k === 'fruit') return fruitMats(s.f, hue, out, cache);
  if (s.k === 'coin') return coinMats(s.c, hue, out, tex.coins ?? {}, cache);
  const h = hue === 'ghost' ? 'a' : hue;
  if (s.k === 'tile') return tileMat(s, hue, out, cache);
  if (out) return cache('f-out', () => new THREE.MeshStandardMaterial({ color: 0xc9c1b4, roughness: 0.85, transparent: true, opacity: 0.5 }));
  // (the gold ones glow clearly: they're the ones you count)
  const glow = h === 'c' ? 0.4 : 0.04;
  if (isAlgShape(s)) return algShapeMats(s, h, cache);
  if (s.k === 'wedge') {
    const top = cache(`f-${s.food}-${h}`, () => new THREE.MeshPhysicalMaterial({ map: tex[s.food], color: TINT[h], roughness: s.food === 'pie' ? 0.55 : 0.6, clearcoat: s.food === 'pie' ? 0.35 : 0.15, clearcoatRoughness: 0.4, emissive: h === 'c' ? 0xffa21a : 0x000000, emissiveIntensity: glow }));
    const side = cache(`f-${s.food}-side`, () => new THREE.MeshStandardMaterial({ map: sideTex(s.food), roughness: 0.75 }));
    return [top, side];
  }
  if (s.k === 'chunk') {
    // (the warm light makes the painted milk chocolate look like copper: a shade darker)
    const base = h === 'b' ? 0xf2a6c0 : h === 'c' ? 0xd9b49a : 0x8f6a5a;
    return cache(`f-choc-${h}`, () => new THREE.MeshPhysicalMaterial({ map: tex.choc, color: base, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, emissive: h === 'c' ? 0xffa21a : 0x000000, emissiveIntensity: glow }));
  }
  return cache(`f-icing-${h}`, () => new THREE.MeshPhysicalMaterial({ color: ICING[h], roughness: 0.45, sheen: 1, sheenColor: new THREE.Color(0xffffff), clearcoat: 0.3, emissive: ICING[h], emissiveIntensity: h === 'c' ? 0.25 : 0.06 }));
}
export function extraMat(cache: (key: string, make: () => THREE.Material) => THREE.Material, s?: Shape) {
  if (s?.k === 'fruit') return fruitExtraMat(s.f, cache);
  return cache('f-cup', () => new THREE.MeshStandardMaterial({ map: cupTex(), roughness: 0.7 }));
}

// ---------- the dishes (made in metres, for the board's scale `s`) ----------
export function makeDish(kind: 'pie' | 'pizza' | 'foil', r: number, w: number, h: number, s: number, depth: number, wood: THREE.Texture | null): { g: THREE.Group; lift: number } {
  const g = new THREE.Group();
  if (kind === 'pie') {
    const R = r * s;
    const prof = [[0, 0], [R * 0.84, 0], [R * 0.9, R * 0.025], [R * 0.99, R * 0.15], [R * 1.05, R * 0.17], [R * 1.04, R * 0.19], [R * 0.97, R * 0.17], [R * 0.88, R * 0.045], [0, R * 0.04]];
    const geo = new THREE.LatheGeometry(prof.map(([a, b]) => new THREE.Vector2(a, b)), 64).scale(1, 1, depth);
    const dish = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xfbf6ee, roughness: 0.22, clearcoat: 0.8, side: THREE.DoubleSide }));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.045, R * 0.022, 8, 64).rotateX(Math.PI / 2).scale(1, 1, depth), new THREE.MeshStandardMaterial({ color: 0x5b8fd8, roughness: 0.35 }));
    rim.position.y = R * 0.18;
    for (const m of [dish, rim]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(dish, rim);
    return { g, lift: R * 0.04 };
  }
  if (kind === 'pizza') {
    const R = r * s, t = 0.02;
    const tex = wood?.clone() ?? null;
    if (tex) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(R * 2.4, R * 2.4); tex.needsUpdate = true; }
    const board = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.04, R * 1.04, t, 64).scale(1, 1, depth), new THREE.MeshStandardMaterial({ map: tex, color: 0xd9a86a, roughness: 0.7 }));
    board.position.y = t / 2;
    const handle = new THREE.Mesh(new RoundedBoxGeometry(R * 0.5, t, R * 0.22, 2, t * 0.4), board.material);
    handle.position.set(R * 1.2, t / 2, 0);
    for (const m of [board, handle]) { m.castShadow = true; m.receiveShadow = true; }
    g.add(board, handle);
    return { g, lift: t };
  }
  // gold foil, crinkled, a little bigger than the bar
  const W = w * s, D = h * s * depth, t = 0.006;
  const foil = new THREE.Mesh(new RoundedBoxGeometry(W, t, D, 2, t * 0.4), new THREE.MeshStandardMaterial({ color: 0xf0c75e, metalness: 0.85, roughness: 0.32, map: foilTex() }));
  foil.position.y = t / 2;
  foil.receiveShadow = true;
  g.add(foil);
  return { g, lift: t };
}

// ---------- painted-on-the-fly textures ----------
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
/** a slice's cut side: (canvas top = the slice's bottom) pastry, filling, crust */
function sideTex(food: 'pie' | 'pizza') {
  return canvas('side-' + food, 128, 128, g => {
    if (food === 'pie') {
      const grd = g.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, '#e2a35e'); grd.addColorStop(0.22, '#d58e48');
      grd.addColorStop(0.26, '#5b2f86'); grd.addColorStop(0.74, '#3f2370');
      grd.addColorStop(0.78, '#e8b066'); grd.addColorStop(1, '#f4c77e');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
      for (let q = 0; q < 70; q++) { g.fillStyle = q % 3 ? 'rgba(40,20,90,.7)' : 'rgba(150,110,220,.6)'; g.beginPath(); g.arc(Math.random() * 128, 36 + Math.random() * 56, 2 + Math.random() * 4, 0, 7); g.fill(); }
    } else {
      const grd = g.createLinearGradient(0, 0, 0, 128);
      grd.addColorStop(0, '#e9b56a'); grd.addColorStop(0.6, '#f1c47c'); grd.addColorStop(0.68, '#d8452e'); grd.addColorStop(0.8, '#f7d873'); grd.addColorStop(1, '#fbe29a');
      g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    }
    for (let q = 0; q < 140; q++) { g.fillStyle = `rgba(255,240,210,${Math.random() * 0.25})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
  });
}
/** a paper cupcake case: pastel stripes */
function cupTex() {
  return canvas('cup', 256, 64, g => {
    const cols = ['#ffd3e2', '#ffffff', '#cfe8ff', '#ffffff'];
    for (let x = 0; x < 256; x += 8) { g.fillStyle = cols[(x / 8) % 4]; g.fillRect(x, 0, 8, 64); }
    g.fillStyle = 'rgba(0,0,0,.05)'; for (let x = 0; x < 256; x += 8) g.fillRect(x, 0, 1, 64);
  });
}
/** crinkled gold foil */
function foilTex() {
  return canvas('foil', 256, 256, g => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
    for (let q = 0; q < 260; q++) { const x = Math.random() * 256, y = Math.random() * 256, l = 8 + Math.random() * 30, a = Math.random() * Math.PI; g.strokeStyle = `rgba(${Math.random() < 0.5 ? '120,80,10' : '255,250,220'},${0.15 + Math.random() * 0.3})`; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
}
