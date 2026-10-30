// The shapes episodes' things in 3D: crystal tiles, each a polygon (a triangle, a square, a slice of a
// cake, a corner torn off a triangle, a thin stick for an angle's side) cut from a slab of glossy coloured
// crystal with soft bevelled edges and cut facets inside. A tile's corners are in board units round the
// counter's own middle, so it moves (and turns) like any other counter.
import * as THREE from 'three';
import type { Hue, Shape } from '../math/learn';

type Tile = Extract<Shape, { k: 'tile' }>;
export const tileKey = (s: Tile) => `t:${s.pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(';')}:${s.h ?? 7}`;

/** A tile's geometry in counter units (`RU` board units make one): the outline flat on the table, its
 *  thickness going up. */
export function tileGeo(s: Tile, RU: number, depth: number): { main: THREE.BufferGeometry; extra: null; height: number } {
  const H = s.h ?? 7, bt = Math.min(H * 0.3, 2.4);
  const minSide = Math.min(...s.pts.map((p, i) => Math.hypot(p[0] - s.pts[(i + 1) % s.pts.length][0], p[1] - s.pts[(i + 1) % s.pts.length][1])));
  const shape = new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: true, bevelThickness: bt, bevelSize: Math.min(bt, minSide * 0.12), bevelSegments: 3, curveSegments: 4 });
  // the facets spread over the tile: the pattern every 70 board units
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 70, uv.getY(i) / 70);
  g.rotateX(Math.PI / 2);
  g.translate(0, H + bt, 0);
  g.scale(1 / RU, 1 / RU, depth / RU);
  g.computeVertexNormals();
  return { main: g, extra: null, height: (H + bt * 2) / RU };
}

/** the crystal colours: a tile's own tint for the first lot, then pink and gold as everywhere */
export const TILE_TINT = { teal: 0x14b8a2, rose: 0xf2558f, gold: 0xffb21e, violet: 0x8b62f5, sky: 0x3d9cf0, mint: 0x3fc779, pale: 0xe6def8 } as const;
export type TileTint = keyof typeof TILE_TINT;

/** Crystal facets: a seamless pattern of flat facets, each a little lighter or darker, with a soft shine
 *  across each and bright seams (made once on a canvas). Multiplied into a tile's colour it reads as cut
 *  crystal. */
let facets: THREE.Texture | null = null;
export function facetTexture(): THREE.Texture {
  if (facets) return facets;
  const S = 256, N = 34, cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d')!, img = g.createImageData(S, S);
  // the seeds (always the same pattern), each with a lightness and a shine direction
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pts = Array.from({ length: N }, () => ({ x: rnd() * S, y: rnd() * S, l: 0.72 + rnd() * 0.28, a: rnd() * Math.PI * 2 }));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let best = 0, bd = Infinity, second = Infinity;
    for (let k = 0; k < N; k++) {
      // (wrapped distance: the pattern tiles without seams)
      let dx = Math.abs(x - pts[k].x), dy = Math.abs(y - pts[k].y);
      if (dx > S / 2) dx = S - dx;
      if (dy > S / 2) dy = S - dy;
      const d = dx * dx + dy * dy;
      if (d < bd) { second = bd; bd = d; best = k; } else if (d < second) second = d;
    }
    const p = pts[best];
    const shine = 0.08 * Math.cos(Math.atan2(y - p.y, x - p.x) - p.a);
    const seam = Math.sqrt(second) - Math.sqrt(bd) < 1.6 ? 0.12 : 0;
    const v = Math.max(0, Math.min(1, p.l + shine + seam));
    const o = (y * S + x) * 4;
    img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(v * 255);
    img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (facets = t);
}

/** A tile's material in a hue: 'a' its own tint, 'b' pink, 'c' gold (glowing: the one that makes the idea work). */
export function tileMat(s: Tile, hue: Hue, out: boolean, cache: (key: string, make: () => THREE.Material) => THREE.Material): THREE.Material {
  if (out) return cache('t-out', () => new THREE.MeshStandardMaterial({ color: 0xc9c1d4, roughness: 0.6, transparent: true, opacity: 0.45 }));
  const tint: TileTint = hue === 'b' ? 'rose' : hue === 'c' ? 'gold' : (s.tint ?? 'teal');
  return cache(`t-${tint}`, () => {
    const c = new THREE.Color(TILE_TINT[tint]);
    return new THREE.MeshPhysicalMaterial({ color: c, map: facetTexture(), roughness: 0.1, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.08,
      emissive: c, emissiveIntensity: tint === 'gold' ? 0.22 : 0 });
  });
}
