// Below Zero Caves' own Glimmers: three natives and a Champion, written down and painted as concepts
// (~/Documents/keypals-round9/NEG/glimmers/ for the round-9 lead), waiting for their 3D models from the
// model pipeline. They are `pending`: nothing in the game lists them (they are not in GLIMMERS, so no
// battle, egg, shop or collection can show them). Until their models arrive the world borrows frosty
// Glimmers from the other islands (state.ts ISLANDS 'frost': natives Snowdrop Seal, Mitten Yeti, Snowflake
// Jelly and Frost Owl, with the Comet Cat as its Champion). When a model is ready: add the id to
// GlimmerId, move its entry into GLIMMERS (home or champion as below), give it an EVOLVED entry, and put
// it in the island's natives (or make it the Champion).
import { powerNum, type Element, type PowerKind, type Rarity } from './glimmers';

export type PendingGlimmer = {
  id: string; name: string; rarity: Rarity; element: Element;
  power: { kind: PowerKind; name: string; text: (lvl: number) => string; base?: number };
  quirk: string;
  /** the world it lives in, and whether it's that world's Champion */
  world: 'frost'; champion?: boolean;
  /** waiting for its 3D model: never shown in the game yet */
  pending: true;
  /** the painted concept (for the model pipeline) */
  concept: string;
};

export const FROST_GLIMMERS: PendingGlimmer[] = [
  { id: 'snowhog', name: 'Snowball Hedgehog', rarity: 'common', element: 'frost', world: 'frost', pending: true, concept: 'snowball-hedgehog.webp',
    quirk: 'Curls up into a snowball to keep warm. It is always a little bit cold.',
    power: { kind: 'coolhead', name: 'Snow Spines', text: l => `Gives you ${powerNum(2, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'glowfin', name: 'Glowfin Angler', rarity: 'uncommon', element: 'tide', world: 'frost', pending: true, concept: 'glowfin-angler.webp',
    quirk: 'Lives far below sea level and carries its own night light.',
    power: { kind: 'glow', name: 'Deep Glow', text: () => 'Once a battle, tap Hint and its lantern shows you a trick for the answer.' } },
  { id: 'compasscrab', name: 'Compass Crab', rarity: 'rare', element: 'stone', world: 'frost', pending: true, concept: 'compass-crab.webp',
    quirk: 'Always knows which way is north. Walks sideways anyway.',
    power: { kind: 'dig', name: 'Treasure Hunt', base: 6, text: l => `When you win a battle, it digs up ${powerNum(6, l)} extra shells.` } },
  { id: 'auroranarwhal', name: 'Aurora Narwhal', rarity: 'legendary', element: 'frost', world: 'frost', champion: true, pending: true, concept: 'aurora-narwhal.webp',
    quirk: 'Its horn is an icicle that never melts. It always points to buried treasure.',
    power: { kind: 'lanterns', name: 'Northern Lights', base: 10, text: l => `Every 3rd right answer adds ${powerNum(10, l, 3)} big cheer.` } },
];
