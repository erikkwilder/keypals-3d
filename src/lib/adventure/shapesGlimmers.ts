// Shape Peaks' own Glimmers: three natives and a Champion, written down and painted (concepts kept with
// the art for the 3D pipeline) but not in the game yet. They are `pending`: nothing lists, rolls, hatches or
// battles them until their 3D models come, when each moves into GLIMMERS (adventure/glimmers.ts, with its
// id added to GlimmerId and its grown-up form to EVOLVED) and Shape Peaks' island (adventure/state.ts)
// takes them as its natives and its Champion instead of the borrowed ones.
import type { Element, PowerKind, Rarity } from './glimmers';

export type PendingGlimmer = {
  id: string; name: string; rarity: Rarity; element: Element;
  power: { kind: PowerKind; name: string; base?: number; text: string };
  quirk: string;
  /** its grown-up form (level 5) */
  evolved: { name: string; perk: string };
  /** where it lives, and whether it's that world's Champion */
  home: 'peaks'; champion?: boolean;
  /** what it looks like, for its model (the painted concept is in the art hand-off) */
  looks: string;
  pending: true;
};

export const SHAPE_PEAKS_GLIMMERS: PendingGlimmer[] = [
  { id: 'pyramidpika', name: 'Pyramid Pika', rarity: 'common', element: 'stone', home: 'peaks', pending: true,
    quirk: 'Stacks pebbles into perfect pyramids, then knocks them down to do it again.',
    power: { kind: 'boost', name: 'Pyramid Stack', base: 2, text: 'Stone cards add 2 more cheer (more as it grows).' },
    evolved: { name: 'Great Pyramid Pika', perk: 'Stone cards also fill an extra Finale star.' },
    looks: 'A round fluffy sandy-grey pika with big shiny eyes and rosy cheeks, a little glowing golden crystal pyramid on its head like a hat.' },
  { id: 'hexabee', name: 'Hexabee', rarity: 'uncommon', element: 'sun', home: 'peaks', pending: true,
    quirk: 'Only lands on things with six sides. Hums in hexagons.',
    power: { kind: 'opener', name: 'Honeycomb Rush', base: 6, text: 'Your first right answer pops 6 extra cheer (more as it grows).' },
    evolved: { name: 'Queen Hexabee', perk: 'Your first two right answers both pop.' },
    looks: 'A chubby fluffy honey-gold bumblebee with big sparkling eyes; its four wings are clear glowing hexagon panes like honeycomb glass, a tiny hexagon crystal on each antenna.' },
  { id: 'tesselgecko', name: 'Tessel Gecko', rarity: 'rare', element: 'leaf', home: 'peaks', pending: true,
    quirk: 'Its scales tile perfectly: no gaps, no overlaps, ever.',
    power: { kind: 'freeze', name: 'Pattern Lock', text: 'Every 3 right in a row, it tiles a wall so the grumpy Glimmer can\'t send rain.' },
    evolved: { name: 'Mosaic Gecko', perk: 'Locks the pattern after 2 right in a row, not 3.' },
    looks: 'A cheerful round-headed gecko with huge friendly eyes; its scales are a perfect tiling of little glossy mint, teal and lime squares and triangles, a curly tail, round sticky toes.' },
  { id: 'prismgryphon', name: 'Prism Gryphon', rarity: 'legendary', element: 'frost', home: 'peaks', champion: true, pending: true,
    quirk: 'Its wings split sunlight into rainbows. It counts the colours out loud.',
    power: { kind: 'lanterns', name: 'Rainbow Prism', base: 10, text: 'Every 3rd right answer adds 10 big cheer (more as it grows).' },
    evolved: { name: 'Aurora Gryphon', perk: 'Your Finale cheers 10 more.' },
    looks: 'A noble, friendly baby-faced gryphon with soft white and lilac feathers, big kind eyes, a small crystal crest, large wings of clear faceted crystal panes that split light into rainbows, a crystal pyramid charm on its chest.' },
];
