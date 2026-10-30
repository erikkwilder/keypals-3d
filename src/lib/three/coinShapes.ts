// The Sky Market's money for the Learn episodes (decimals and money): real US coins lying face up on the
// table, at their true sizes against each other, with the painted faces from public/math/money/ on top
// and a milled metal edge; and a dollar bill lying flat. They are counters like any other (the episode
// drags, taps and counts them), drawn by fracShapes.ts's shapeGeo and shapeMats.
import * as THREE from 'three';
import type { Hue } from '../math/learn';

export type CoinKind = 'penny' | 'nickel' | 'dime' | 'quarter' | 'dollar' | 'bill';
/** what each is worth, in cents */
export const CENTS: Record<CoinKind, number> = { penny: 1, nickel: 5, dime: 10, quarter: 25, dollar: 100, bill: 100 };
/** across, in board units (a quarter is 24.26 mm; the rest in proportion); a bill is long and flat */
export const COIN_D: Record<CoinKind, number> = { penny: 60, nickel: 67, dime: 56, quarter: 76, dollar: 83, bill: 160 };
const EDGE: Record<CoinKind, number> = { penny: 0xb8683a, nickel: 0xb9bcc2, dime: 0xc4c7cc, quarter: 0xc2c5ca, dollar: 0xd6a83e, bill: 0x9fbf8c };
/** the painted faces (and the bill), loaded by the episode */
export const COIN_FILES: Record<CoinKind, string> = { penny: 'math/money/penny.webp', nickel: 'math/money/nickel.webp', dime: 'math/money/dime.webp', quarter: 'math/money/quarter.webp', dollar: 'math/money/dollar.webp', bill: 'math/money/bill.webp' };
export type CoinTex = Partial<Record<CoinKind, THREE.Texture | null>>;

/** A coin (or bill) in counter units: two material groups, its face (0) and its edge (1). */
export function coinGeo(c: CoinKind, RU: number, depth: number): { main: THREE.BufferGeometry; extra: null; height: number } {
  let g: THREE.BufferGeometry;
  let h: number;
  if (c === 'bill') {
    const w = COIN_D.bill, d = w / 2.35;
    h = 1.6;
    // the face: a plane lying flat (its top edge away from you, so the bill reads the right way up)
    const top = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(0, h + 0.05, 0);
    const box = new THREE.BoxGeometry(w * 0.995, h, d * 0.995).translate(0, h / 2, 0);
    g = merge([top, box]);
  } else {
    const r = COIN_D[c] / 2;
    h = COIN_D[c] * 0.075;
    const top = new THREE.CircleGeometry(r, 48).rotateX(-Math.PI / 2).translate(0, h, 0);
    const bottom = new THREE.CircleGeometry(r, 48).rotateX(Math.PI / 2);
    // the milled edge: a ring of fine ridges
    const edge = new THREE.CylinderGeometry(r, r, h, 96, 1, true).translate(0, h / 2, 0);
    const p = edge.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + (c === 'nickel' || c === 'penny' ? 0 : Math.cos(a * 96) * 0.006);
      p.setXYZ(i, x * k, p.getY(i), z * k);
    }
    edge.computeVertexNormals();
    g = merge([top, merge([edge, bottom])]);
  }
  g.scale(1 / RU, 1 / RU, depth / RU);
  return { main: g, extra: null, height: h / RU };
}

/** two geometries as one, the first in material group 0 and the second in group 1 */
function merge([a, b]: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const A = a.index ? a.toNonIndexed() : a, B = b.index ? b.toNonIndexed() : b;
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv'] as const) {
    const x = A.attributes[name] as THREE.BufferAttribute, y = B.attributes[name] as THREE.BufferAttribute;
    const arr = new Float32Array(x.array.length + y.array.length);
    arr.set(x.array as Float32Array); arr.set(y.array as Float32Array, x.array.length);
    out.setAttribute(name, new THREE.BufferAttribute(arr, x.itemSize));
  }
  const na = A.attributes.position.count;
  out.addGroup(0, na, 0);
  out.addGroup(na, B.attributes.position.count, 1);
  return out;
}

/** [face, edge] in a hue: as it comes, or (the coins being counted, gold) glowing warm */
export function coinMats(c: CoinKind, hue: Hue, out: boolean, tex: CoinTex, cache: (key: string, make: () => THREE.Material) => THREE.Material): THREE.Material[] {
  const h = hue === 'ghost' ? 'a' : hue, metal = c !== 'bill';
  if (out) {
    const m = cache(`coin-out-${c}`, () => new THREE.MeshStandardMaterial({ map: tex[c] ?? null, color: 0xd8d2c8, roughness: 0.8, transparent: true, opacity: 0.45 }));
    return [m, m];
  }
  const face = cache(`coin-${c}-${h}`, () => new THREE.MeshPhysicalMaterial({
    map: tex[c] ?? null, color: h === 'b' ? 0xffd0e0 : 0xffffff, roughness: metal ? 0.42 : 0.85, metalness: metal ? 0.25 : 0,
    clearcoat: metal ? 0.5 : 0, clearcoatRoughness: 0.3, emissive: h === 'c' ? 0xffb02a : 0x000000, emissiveIntensity: h === 'c' ? 0.28 : 0,
  }));
  const edge = cache(`coin-edge-${c}-${h}`, () => new THREE.MeshStandardMaterial({ color: EDGE[c], roughness: metal ? 0.35 : 0.9, metalness: metal ? 0.75 : 0, emissive: h === 'c' ? 0xffb02a : 0x000000, emissiveIntensity: h === 'c' ? 0.2 : 0 }));
  return [face, edge];
}
