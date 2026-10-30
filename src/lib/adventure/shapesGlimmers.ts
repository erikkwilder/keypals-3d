// Shape Peaks' own Glimmers: three natives and a Champion, in the 100-Glimmer ladder's shape (ladder.ts):
// source 'native', world 'peaks', the Prism Gryphon the island's Champion. They're `pending` until their 3D
// models come, so the Glimmer Book shows them "On its way" and nothing rolls, hatches or battles them yet;
// meanwhile crystal-loving Glimmers from the islands live in Shape Peaks (adventure/state.ts). Their
// paintings, faces and outlines are in public/game/glimmers (made with scripts/glimmers/concepts-finish.py
// from the concepts in keypals-round9/SHP/glimmers); `looks` is what the model is made from.
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, put
// the natives in ISLANDS.peaks.natives and make the Prism Gryphon the island's champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type ShapesGlimmerId = 'pyramidpika' | 'hexabee' | 'tesselgecko' | 'prismgryphon';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const SHAPE_PEAKS_GLIMMERS: (GlimmerDef & { id: ShapesGlimmerId; looks: string })[] = [
  { id: 'pyramidpika', source: 'native', world: 'peaks', pending: true, name: 'Pyramid Pika', rarity: 'common', element: 'stone',
    quirk: 'Stacks pebbles into perfect pyramids, then knocks them down to do it again.',
    power: { kind: 'boost', name: 'Pyramid Stack', base: 2, text: l => `Stone cards add ${pn(2, l)} more cheer.` },
    looks: 'A round fluffy sandy-grey pika with big shiny eyes and rosy cheeks, a little glowing golden crystal pyramid on its head like a hat.' },
  { id: 'hexabee', source: 'native', world: 'peaks', pending: true, name: 'Hexabee', rarity: 'uncommon', element: 'sun',
    quirk: 'Only lands on things with six sides. Hums in hexagons.',
    power: { kind: 'opener', name: 'Honeycomb Rush', base: 6, text: l => `Your first right answer pops ${pn(6, l)} extra cheer.` },
    looks: 'A chubby fluffy honey-gold bumblebee with big sparkling eyes; its four wings are clear glowing hexagon panes like honeycomb glass, a tiny hexagon crystal on each antenna.' },
  { id: 'tesselgecko', source: 'native', world: 'peaks', pending: true, name: 'Tessel Gecko', rarity: 'rare', element: 'leaf',
    quirk: 'Its scales tile perfectly: no gaps, no overlaps, ever.',
    power: { kind: 'freeze', name: 'Pattern Lock', text: () => 'Every 3 right in a row, it tiles a wall so the grumpy Glimmer can\'t send rain.' },
    looks: 'A cheerful round-headed gecko with huge friendly eyes; its scales are a perfect tiling of little glossy mint, teal and lime squares and triangles, a curly tail, round sticky toes.' },
  { id: 'prismgryphon', source: 'native', world: 'peaks', champion: 'peaks', pending: true, name: 'Prism Gryphon', rarity: 'legendary', element: 'frost',
    quirk: 'Its wings split sunlight into rainbows. It counts the colours out loud.',
    power: { kind: 'lanterns', name: 'Rainbow Prism', base: 10, text: l => `Every 3rd right answer adds ${pn(10, l, 3)} big cheer.` },
    looks: 'A noble, friendly baby-faced gryphon with soft white and lilac feathers, big kind eyes, a small crystal crest, large wings of clear faceted crystal panes that split light into rainbows, a crystal pyramid charm on its chest.' },
];

/** Their grown-up forms (level 5): each kind's own grown-up perk. */
export const SHAPES_EVOLVED: Record<ShapesGlimmerId, { name: string; perk: string }> = {
  pyramidpika: { name: 'Great Pyramid Pika', perk: 'Stone cards also fill an extra Finale star.' },
  hexabee: { name: 'Queen Hexabee', perk: 'Your first two right answers both pop.' },
  tesselgecko: { name: 'Mosaic Gecko', perk: 'Locks the pattern after 2 right in a row, not 3.' },
  prismgryphon: { name: 'Aurora Gryphon', perk: 'Your Finale cheers 10 more.' },
};
