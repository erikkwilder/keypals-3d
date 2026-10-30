// My Sky Island: everything a child can put on their island, and what it costs in shells (the game's one
// currency: practice and battles earn them, the Shop's eggs and treats spend them, and this is where the
// rest go). Priced so a child who plays most days buys something every few days: the little things
// (flowers, stepping stones, a fence) about a day's shells, a tree or a bench a couple of days, a home or a
// habitat most of a week, and a few dream things (the treehouse, the balloon, the lighthouse, the
// rainbow) that take weeks of saving.
//
// Each thing covers a few squares of the island's grid (`w` along the island, `d` into it, before it's
// turned). Habitats are the homes of one kind of Glimmer (a sun dais, an ice pool, a tide pond, a stone
// cave, a leaf grove): Glimmers of that element play near them, and they invite visitors of that element.
// Some other things invite a little too (a pond brings water Glimmers, lanterns sunny ones). Gifts are
// things only a visitor leaves (never sold). How each one looks is in island/props3d.ts.
import type { Element } from '../adventure/glimmers';

export type ItemKind = 'home' | 'nature' | 'water' | 'path' | 'fun' | 'habitat' | 'dream' | 'gift';
export type ItemDef = {
  id: string; name: string; price: number; kind: ItemKind;
  /** squares it covers: along the island (x) and into it (z), before turning */
  w: number; d: number;
  /** a few words for its card */
  blurb: string;
  /** the Glimmers it invites, by element (how strongly) */
  invites?: Partial<Record<Element, number>>;
  /** a habitat: Glimmers of this element play by it */
  habitat?: Element;
  /** you walk over it (stepping stones, decking): nothing bumps into it */
  flat?: boolean;
  /** only a visitor's gift */
  gift?: boolean;
  /** one of the few big things worth saving up for */
  dream?: boolean;
  /** the round part you bump into (a tree's trunk), as a share of a square; absent: the whole footprint */
  trunk?: number;
};

export const KINDS: { id: ItemKind; name: string }[] = [
  { id: 'home', name: 'Homes' }, { id: 'nature', name: 'Trees and flowers' }, { id: 'water', name: 'Water' }, { id: 'path', name: 'Paths and fences' },
  { id: 'fun', name: 'Lights and fun' }, { id: 'habitat', name: 'Glimmer homes' }, { id: 'dream', name: 'Dream things' },
];

export const ITEMS: ItemDef[] = [
  // ---------- homes ----------
  { id: 'cottage', name: 'Cosy Cottage', price: 320, kind: 'home', w: 3, d: 3, blurb: 'Stone walls, a blue roof and a chimney.' },
  { id: 'burrow', name: 'Hill House', price: 280, kind: 'home', w: 3, d: 3, blurb: 'A grassy hill with a round front door.' },
  { id: 'mushhouse', name: 'Mushroom House', price: 240, kind: 'home', w: 2, d: 2, blurb: 'A spotty mushroom you can live in.', invites: { leaf: 1 } },
  { id: 'tent', name: 'Starry Tent', price: 150, kind: 'home', w: 2, d: 2, blurb: 'For sleepovers under the stars.' },
  // ---------- trees and flowers ----------
  { id: 'oak', name: 'Big Shady Tree', price: 90, kind: 'nature', w: 2, d: 2, blurb: 'A big tree to nap under.', trunk: 0.45 },
  { id: 'puffy', name: 'Puffy Tree', price: 90, kind: 'nature', w: 2, d: 2, blurb: 'Soft and round, like a cloud.', trunk: 0.45 },
  { id: 'roundtree', name: 'Round Tree', price: 70, kind: 'nature', w: 1, d: 1, blurb: 'A neat little tree.', trunk: 0.35 },
  { id: 'pine', name: 'Pine Tree', price: 70, kind: 'nature', w: 1, d: 1, blurb: 'Icy Glimmers like a pine.', invites: { frost: 1 }, trunk: 0.35 },
  { id: 'palm', name: 'Palm Tree', price: 80, kind: 'nature', w: 1, d: 1, blurb: 'Water Glimmers like a palm.', invites: { tide: 1 }, trunk: 0.3 },
  { id: 'umbrella', name: 'Umbrella Tree', price: 110, kind: 'nature', w: 2, d: 2, blurb: 'Flat on top, shady underneath.', trunk: 0.4 },
  { id: 'bush', name: 'Round Bush', price: 25, kind: 'nature', w: 1, d: 1, blurb: 'Good for hiding behind.' },
  { id: 'flowers', name: 'Flower Patch', price: 20, kind: 'nature', w: 1, d: 1, blurb: 'Pink, yellow and blue.', invites: { leaf: 1 } },
  { id: 'flowerbed', name: 'Flower Bed', price: 35, kind: 'nature', w: 1, d: 1, blurb: 'Flowers in a ring of stones.', invites: { leaf: 1 } },
  { id: 'mushrooms', name: 'Mushroom Ring', price: 30, kind: 'nature', w: 1, d: 1, blurb: 'A fairy ring of mushrooms.', invites: { leaf: 1 } },
  { id: 'boulder', name: 'Big Rock', price: 30, kind: 'nature', w: 1, d: 1, blurb: 'Stone Glimmers like a sunny rock.', invites: { stone: 1 } },
  // ---------- water ----------
  { id: 'pond', name: 'Lily Pond', price: 120, kind: 'water', w: 2, d: 2, blurb: 'Lily pads and a pink flower.', invites: { tide: 2 } },
  { id: 'fountain', name: 'Fountain', price: 260, kind: 'water', w: 2, d: 2, blurb: 'Splashes all day long.', invites: { tide: 2 } },
  { id: 'well', name: 'Wishing Well', price: 140, kind: 'water', w: 2, d: 2, blurb: 'Make a wish!', invites: { tide: 1 } },
  // ---------- paths and fences ----------
  { id: 'stones', name: 'Stepping Stones', price: 10, kind: 'path', w: 1, d: 1, blurb: 'Make a path.', flat: true },
  { id: 'deck', name: 'Wooden Deck', price: 25, kind: 'path', w: 1, d: 1, blurb: 'Planks to stand on.', flat: true },
  { id: 'fence', name: 'Rope Fence', price: 15, kind: 'path', w: 1, d: 1, blurb: 'Posts and a rope.' },
  { id: 'picket', name: 'Picket Fence', price: 18, kind: 'path', w: 1, d: 1, blurb: 'A white garden fence.' },
  // ---------- lights and fun ----------
  { id: 'lamp', name: 'Lantern Post', price: 50, kind: 'fun', w: 1, d: 1, blurb: 'A warm light. Sunny Glimmers love it.', invites: { sun: 1 } },
  { id: 'bench', name: 'Bench', price: 60, kind: 'fun', w: 2, d: 1, blurb: 'Sit and watch the clouds.' },
  { id: 'birdhouse', name: 'Birdhouse', price: 45, kind: 'fun', w: 1, d: 1, blurb: 'A little house on a post.' },
  { id: 'swing', name: 'Swing', price: 110, kind: 'fun', w: 2, d: 1, blurb: 'Whee! Glimmers take turns.' },
  { id: 'signpost', name: 'Signpost', price: 30, kind: 'fun', w: 1, d: 1, blurb: 'Points the way.' },
  { id: 'scarecrow', name: 'Scarecrow', price: 70, kind: 'fun', w: 1, d: 1, blurb: 'A friendly one.' },
  { id: 'lookout', name: 'Lookout Tower', price: 450, kind: 'fun', w: 2, d: 2, blurb: 'See all the islands from the top.' },
  // ---------- Glimmer homes: one for each element ----------
  { id: 'sundais', name: 'Sun Dais', price: 220, kind: 'habitat', w: 2, d: 2, habitat: 'sun', invites: { sun: 4 }, blurb: 'A warm golden stage. Sun Glimmers come to play.' },
  { id: 'icepool', name: 'Ice Pool', price: 220, kind: 'habitat', w: 2, d: 2, habitat: 'frost', invites: { frost: 4 }, blurb: 'Cold, sparkly water. Ice Glimmers come to play.' },
  { id: 'tidepond', name: 'Tide Pond', price: 220, kind: 'habitat', w: 2, d: 2, habitat: 'tide', invites: { tide: 4 }, blurb: 'A rock pool with shells. Water Glimmers come to play.' },
  { id: 'stonecave', name: 'Stone Cave', price: 220, kind: 'habitat', w: 2, d: 2, habitat: 'stone', invites: { stone: 4 }, blurb: 'A cosy cave with crystals. Stone Glimmers come to play.' },
  { id: 'leafgrove', name: 'Leaf Grove', price: 220, kind: 'habitat', w: 2, d: 2, habitat: 'leaf', invites: { leaf: 4 }, blurb: 'Mossy logs and big leaves. Leaf Glimmers come to play.' },
  // ---------- dream things ----------
  { id: 'balloon', name: 'Hot-Air Balloon', price: 900, kind: 'dream', w: 2, d: 2, dream: true, invites: { sun: 2 }, blurb: 'It floats over your island, tied to a post.' },
  { id: 'lighthouse', name: 'Lighthouse', price: 1000, kind: 'dream', w: 2, d: 2, dream: true, invites: { tide: 2, frost: 1 }, blurb: 'Its light shines out over the clouds.' },
  { id: 'treehouse', name: 'Treehouse', price: 1200, kind: 'dream', w: 3, d: 3, dream: true, invites: { leaf: 2 }, blurb: 'A house up in a giant tree.', trunk: 0.8 },
  { id: 'rainbow', name: 'Rainbow Arch', price: 1500, kind: 'dream', w: 3, d: 1, dream: true, invites: { sun: 1, frost: 1, tide: 1, stone: 1, leaf: 1 }, blurb: 'Every kind of Glimmer loves a rainbow.' },
  // ---------- gifts from visitors (not sold) ----------
  { id: 'gem-sun', name: 'Sun Crystal', price: 0, kind: 'gift', gift: true, w: 1, d: 1, invites: { sun: 1 }, blurb: 'A gift from a sunny visitor.' },
  { id: 'gem-frost', name: 'Ice Crystal', price: 0, kind: 'gift', gift: true, w: 1, d: 1, invites: { frost: 1 }, blurb: 'A gift from an icy visitor.' },
  { id: 'gem-tide', name: 'Sea Glass', price: 0, kind: 'gift', gift: true, w: 1, d: 1, invites: { tide: 1 }, blurb: 'A gift from a water visitor.' },
  { id: 'gem-stone', name: 'Geode', price: 0, kind: 'gift', gift: true, w: 1, d: 1, invites: { stone: 1 }, blurb: 'A gift from a stony visitor.' },
  { id: 'gem-leaf', name: 'Leaf Crystal', price: 0, kind: 'gift', gift: true, w: 1, d: 1, invites: { leaf: 1 }, blurb: 'A gift from a leafy visitor.' },
];
export const ITEM: Record<string, ItemDef> = Object.fromEntries(ITEMS.map(i => [i.id, i]));
/** the habitat of each element */
export const HABITAT_OF: Record<Element, string> = { sun: 'sundais', frost: 'icepool', tide: 'tidepond', stone: 'stonecave', leaf: 'leafgrove' };
/** the gift a visitor of each element leaves */
export const GIFT_OF: Record<Element, string> = { sun: 'gem-sun', frost: 'gem-frost', tide: 'gem-tide', stone: 'gem-stone', leaf: 'gem-leaf' };
