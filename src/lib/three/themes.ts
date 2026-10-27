// The look of each region's island: sky and light, ground and trail, what grows and stands along the
// trail, what lies below the edge (a sea of clouds, or real sea), and a few special touches. The shape
// of the trail is the same everywhere; everything else comes from here. Each follows its map banner.
import type { RegionId } from '../engine/course';

export type PropSpec = {
  model: string;
  /** how many along 230 m of trail */
  count: number;
  /** across the trail: negative is the far side (toward the edge), positive the camera side */
  near: number; far: number;
  /** room each one needs */
  minR: number;
  /** height range in metres */
  h: [number, number];
  sink?: number;
  /** grow in clumps with open views between */
  clump?: boolean;
  /** cast shadows (off for small or near-side things) */
  shadow?: boolean;
  /** hidden in smooth mode */
  extra?: boolean;
};

export type Theme = {
  id: RegionId;
  seed: number;
  sky: [number, number, number];
  fog: number;
  sun: { color: number; power: number };
  hemi: { sky: number; ground: number; power: number };
  /** hills: how rolling the land is (1 = gentle); rise: how much the camera side climbs; wide: extra
   *  metres of land on the far side (room for big things like treehouse trees) */
  land: { hills: number; rise: number; wide?: number };
  ground: { tex: 'grass' | 'sand'; lush: number; dry: number; rock: number; rockDark: number; sand?: number };
  trail: { tex: 'dirt' | 'sand'; tint: number };
  grass: { perMetre: number; hue: [number, number]; sat: [number, number]; light: [number, number]; tall: number } | null;
  flowers: number;
  /** near-side props must stay under ~0.8 m and within 4.5 m of the trail: the camera stands about 5 m out on that side */
  props: PropSpec[];
  below: 'clouds' | 'sea';
  waterfalls: number;
  floaters: { islands: number; slabs: number };
  extras: ('rainbow' | 'balloons' | 'mountains' | 'bridges' | 'lighthouses' | 'seastacks')[];
};

const meadowGrass = { perMetre: 280, hue: [0.2, 0.26] as [number, number], sat: [0.6, 0.8] as [number, number], light: [0.5, 0.66] as [number, number], tall: 1 };

export const THEMES: Record<RegionId, Theme> = {
  // Home Row Island: the first sky island, meadows, old ruins and the stone gate
  village: {
    id: 'village', seed: 11,
    sky: [0x4f9fe8, 0x9fd0f4, 0xdcecf6], fog: 0xd6e9f5,
    sun: { color: 0xfff0d8, power: 2.6 }, hemi: { sky: 0xcfe8ff, ground: 0x7f9a5c, power: 1.15 },
    land: { hills: 1, rise: 1 },
    ground: { tex: 'grass', lush: 0xffffff, dry: 0xe8e2b0, rock: 0x9a8f86, rockDark: 0x6f6670 },
    trail: { tex: 'dirt', tint: 0xffffff },
    grass: meadowGrass, flowers: 8,
    props: [
      { model: 'tree_puffy', count: 9, near: -8.5, far: -3.2, minR: 2.2, h: [4.4, 6.2], sink: 0.15, clump: true },
      { model: 'tree_puffy2', count: 6, near: -9.5, far: -4, minR: 2.4, h: [5.2, 7], sink: 0.15, clump: true },
      { model: 'bush', count: 34, near: -9.5, far: -1.8, minR: 0.8, h: [0.6, 1.2], sink: 0.08 },
      { model: 'boulder', count: 16, near: -10, far: -2.2, minR: 0.9, h: [0.5, 1.4], sink: 0.2 },
      { model: 'ruin', count: 8, near: -9, far: -3, minR: 1.6, h: [1.1, 2.2], sink: 0.1 },
      { model: 'bush', count: 12, near: 2.2, far: 4.5, minR: 0.6, h: [0.35, 0.6], sink: 0.05, shadow: false, extra: true },
      { model: 'boulder', count: 8, near: 2.0, far: 4.5, minR: 0.5, h: [0.25, 0.5], sink: 0.08, shadow: false, extra: true },
    ],
    below: 'clouds', waterfalls: 6, floaters: { islands: 16, slabs: 16 }, extras: [],
  },
  // Top Row Treetops: giant trees with treehouses, rope bridges between them, deep green
  treetops: {
    id: 'treetops', seed: 23,
    sky: [0x5aa6e6, 0xa8d6f2, 0xe2f0f4], fog: 0xdcecee,
    sun: { color: 0xfff2d2, power: 2.5 }, hemi: { sky: 0xd5ecff, ground: 0x6f9a52, power: 1.2 },
    land: { hills: 0.9, rise: 1, wide: 14 },
    ground: { tex: 'grass', lush: 0xf2ffe8, dry: 0xd8e8a8, rock: 0x8f8a7c, rockDark: 0x645e5a },
    trail: { tex: 'dirt', tint: 0xf0e2c8 },
    grass: { ...meadowGrass, hue: [0.22, 0.29], light: [0.42, 0.6] }, flowers: 5,
    props: [
      { model: 'treehouse_tree', count: 8, near: -17, far: -10, minR: 4.2, h: [13, 16], sink: 0.3 },
      { model: 'tree_puffy', count: 12, near: -9, far: -3.4, minR: 2.2, h: [5, 7], sink: 0.15 },
      { model: 'tree_puffy2', count: 6, near: -9.5, far: -4, minR: 2.4, h: [6, 8], sink: 0.15 },
      { model: 'bush', count: 44, near: -9.5, far: -1.8, minR: 0.8, h: [0.7, 1.4], sink: 0.08 },
      { model: 'boulder', count: 6, near: -10, far: -2.4, minR: 0.9, h: [0.5, 1.1], sink: 0.2 },
      { model: 'bush', count: 16, near: 2.2, far: 4.5, minR: 0.6, h: [0.4, 0.7], sink: 0.05, shadow: false, extra: true },
    ],
    below: 'clouds', waterfalls: 2, floaters: { islands: 10, slabs: 6 }, extras: ['bridges'],
  },
  // Bottom Row Burrows: rolling hills with round doors, mushrooms, cosy and warm
  burrows: {
    id: 'burrows', seed: 37,
    sky: [0x5b9fe0, 0xb0d6f0, 0xf4ead8], fog: 0xeee6d6,
    sun: { color: 0xffe8c4, power: 2.7 }, hemi: { sky: 0xf0e8ff, ground: 0x8aa058, power: 1.1 },
    land: { hills: 1.9, rise: 1.4, wide: 8 },
    ground: { tex: 'grass', lush: 0xfaffe0, dry: 0xf0e0a0, rock: 0x9a8a78, rockDark: 0x6e6258 },
    trail: { tex: 'dirt', tint: 0xf4dcc0 },
    grass: { ...meadowGrass, hue: [0.17, 0.24], light: [0.52, 0.68] }, flowers: 12,
    props: [
      { model: 'hobbit_hill', count: 9, near: -12, far: -5.5, minR: 3.4, h: [3.2, 4.2], sink: 0.4 },
      { model: 'tree_round', count: 6, near: -9.5, far: -4, minR: 2.2, h: [4.2, 6], sink: 0.15, clump: true },
      { model: 'mushroom', count: 20, near: -8, far: -1.6, minR: 0.6, h: [0.5, 1.1], sink: 0.03 },
      { model: 'bush', count: 26, near: -9.5, far: -1.8, minR: 0.8, h: [0.6, 1.1], sink: 0.08 },
      { model: 'boulder', count: 8, near: -10, far: -2.2, minR: 0.9, h: [0.4, 1.0], sink: 0.2 },
      { model: 'mushroom', count: 8, near: 2.0, far: 4.2, minR: 0.5, h: [0.35, 0.6], sink: 0.02, shadow: false, extra: true },
    ],
    below: 'clouds', waterfalls: 2, floaters: { islands: 12, slabs: 4 }, extras: [],
  },
  // Capital Cliffs: rock arches and pillars, waterfalls everywhere, islands of stone in the sky
  cliffs: {
    id: 'cliffs', seed: 41,
    sky: [0x4a98e4, 0x9ccdf2, 0xe0ecf4], fog: 0xd8e6f2,
    sun: { color: 0xfff0d8, power: 2.7 }, hemi: { sky: 0xcfe4ff, ground: 0x8a8a5c, power: 1.15 },
    land: { hills: 1.3, rise: 1.1, wide: 8 },
    ground: { tex: 'grass', lush: 0xf4f8e0, dry: 0xe8d8a0, rock: 0xa89a88, rockDark: 0x7a6e68 },
    trail: { tex: 'dirt', tint: 0xf6e6cc },
    grass: { ...meadowGrass, perMetre: 200, hue: [0.16, 0.24] }, flowers: 5,
    props: [
      { model: 'rock_arch', count: 5, near: -12, far: -6, minR: 3.6, h: [5.5, 7.5], sink: 0.2 },
      { model: 'rock_spire', count: 10, near: -13, far: -4.5, minR: 1.8, h: [4, 9], sink: 0.3 },
      { model: 'boulder', count: 26, near: -10, far: -2.2, minR: 0.9, h: [0.5, 1.8], sink: 0.2 },
      { model: 'ruin', count: 6, near: -9, far: -3, minR: 1.6, h: [1.1, 2.2], sink: 0.1 },
      { model: 'tree_umbrella', count: 5, near: -9, far: -4, minR: 2.2, h: [4, 5.5], sink: 0.15, clump: true },
      { model: 'bush', count: 20, near: -9.5, far: -1.8, minR: 0.8, h: [0.5, 1.0], sink: 0.08 },
      { model: 'boulder', count: 10, near: 2.0, far: 4.5, minR: 0.5, h: [0.25, 0.6], sink: 0.08, shadow: false, extra: true },
    ],
    below: 'clouds', waterfalls: 9, floaters: { islands: 22, slabs: 24 }, extras: [],
  },
  // Number Ridge: a high alpine meadow, pines and stone cairns, snowy peaks rising from the clouds
  ridge: {
    id: 'ridge', seed: 53,
    sky: [0x3f8fe0, 0x98caf0, 0xe6f0f6], fog: 0xdfe9f2,
    sun: { color: 0xfff6e8, power: 2.8 }, hemi: { sky: 0xd8ecff, ground: 0x7a9460, power: 1.15 },
    land: { hills: 1.4, rise: 2.2, wide: 3 },
    ground: { tex: 'grass', lush: 0xeefae0, dry: 0xdcdcaa, rock: 0x9a9690, rockDark: 0x6c6a6c },
    trail: { tex: 'dirt', tint: 0xe8dcc8 },
    grass: { ...meadowGrass, perMetre: 240, hue: [0.21, 0.28], sat: [0.45, 0.65], light: [0.48, 0.62], tall: 0.8 }, flowers: 6,
    props: [
      { model: 'pine_tree', count: 26, near: -9.5, far: -3.4, minR: 1.6, h: [4, 8], sink: 0.15, clump: true },
      { model: 'cairn', count: 7, near: -6, far: -1.8, minR: 0.8, h: [0.7, 1.3], sink: 0.05 },
      { model: 'boulder', count: 20, near: -10, far: -2.2, minR: 0.9, h: [0.5, 1.5], sink: 0.2 },
      { model: 'bush', count: 10, near: -9.5, far: -1.8, minR: 0.8, h: [0.5, 0.9], sink: 0.08 },
    ],
    below: 'clouds', waterfalls: 2, floaters: { islands: 0, slabs: 0 }, extras: ['mountains'],
  },
  // Symbol Shores: a sandy beach along a turquoise sea, palms, rocks and a lighthouse
  shores: {
    id: 'shores', seed: 67,
    sky: [0x3e9be8, 0x8fd2f6, 0xe4f4fa], fog: 0xd8eef6,
    sun: { color: 0xfff4dc, power: 2.9 }, hemi: { sky: 0xd4f0ff, ground: 0xb8a878, power: 1.2 },
    land: { hills: 0.8, rise: 1 },
    ground: { tex: 'grass', lush: 0xf6ffe4, dry: 0xeee4b0, rock: 0xb0a090, rockDark: 0x8a7a70, sand: 0xf3dfb0 },
    trail: { tex: 'sand', tint: 0xfbecc8 },
    grass: { ...meadowGrass, perMetre: 160, hue: [0.18, 0.26] }, flowers: 4,
    props: [
      { model: 'palm_tree', count: 16, near: -6.5, far: -2.6, minR: 1.8, h: [5, 8], sink: 0.1 },
      { model: 'boulder', count: 14, near: -7, far: -2.2, minR: 0.9, h: [0.5, 1.4], sink: 0.2 },
      { model: 'bush', count: 10, near: 2.2, far: 4.5, minR: 0.7, h: [0.4, 0.7], sink: 0.05, shadow: false, extra: true },
    ],
    below: 'sea', waterfalls: 0, floaters: { islands: 0, slabs: 0 }, extras: ['lighthouses', 'seastacks'],
  },
  // The Open Road: wide open meadow, a rainbow, hot-air balloons drifting past floating islands
  road: {
    id: 'road', seed: 79,
    sky: [0x4d9ce8, 0xa2d2f4, 0xe8f2f8], fog: 0xdcecf6,
    sun: { color: 0xfff2dc, power: 2.6 }, hemi: { sky: 0xd2ebff, ground: 0x84a05a, power: 1.15 },
    land: { hills: 1.1, rise: 1, wide: 2 },
    ground: { tex: 'grass', lush: 0xffffff, dry: 0xeae4b2, rock: 0x9a8f86, rockDark: 0x6f6670 },
    trail: { tex: 'dirt', tint: 0xffffff },
    grass: meadowGrass, flowers: 10,
    props: [
      { model: 'tree_puffy', count: 5, near: -9, far: -3.4, minR: 2.2, h: [4.4, 6.2], sink: 0.15, clump: true },
      { model: 'tree_umbrella', count: 4, near: -9.5, far: -4, minR: 2.4, h: [5, 6.5], sink: 0.15 },
      { model: 'signpost', count: 4, near: -2.6, far: -1.8, minR: 1, h: [1.6, 1.9], sink: 0.05 },
      { model: 'bush', count: 22, near: -9.5, far: -1.8, minR: 0.8, h: [0.6, 1.1], sink: 0.08 },
      { model: 'boulder', count: 10, near: -10, far: -2.2, minR: 0.9, h: [0.5, 1.2], sink: 0.2 },
      { model: 'bush', count: 10, near: 2.2, far: 4.5, minR: 0.6, h: [0.35, 0.6], sink: 0.05, shadow: false, extra: true },
    ],
    below: 'clouds', waterfalls: 4, floaters: { islands: 20, slabs: 10 }, extras: ['rainbow', 'balloons'],
  },
};
