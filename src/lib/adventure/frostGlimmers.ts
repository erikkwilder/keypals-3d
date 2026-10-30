// Below Zero Caves' own Glimmers: three natives and a Champion, in the 100-Glimmer ladder's shape
// (ladder.ts): source 'native', world 'frost', the Aurora Narwhal the island's Champion. They're `pending`
// until their 3D models come from the model pipeline, so the Glimmer Book shows them "On its way" and no
// battle, egg or shop gives one yet. Until then the world borrows frosty Glimmers from the other islands
// (state.ts ISLANDS 'frost': Snowdrop Seal, Mitten Yeti, Snowflake Jelly and Frost Owl, with the Comet Cat as
// its Champion). Their paintings, faces and outlines are in public/game/glimmers (made with
// scripts/glimmers/concepts-finish.py from the concepts in keypals-round9/NEG/glimmers).
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, put
// the natives in the island's natives and make the Aurora Narwhal its champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type FrostGlimmerId = 'snowhog' | 'glowfin' | 'compasscrab' | 'auroranarwhal';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const FROST_GLIMMERS: (GlimmerDef & { id: FrostGlimmerId })[] = [
  { id: 'snowhog', source: 'native', world: 'frost', pending: true, name: 'Snowball Hedgehog', rarity: 'common', element: 'frost',
    quirk: 'Curls up into a snowball to keep warm. It is always a little bit cold.',
    power: { kind: 'coolhead', name: 'Snow Spines', text: l => `Gives you ${pn(2, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'glowfin', source: 'native', world: 'frost', pending: true, name: 'Glowfin Angler', rarity: 'uncommon', element: 'tide',
    quirk: 'Lives far below sea level and carries its own night light.',
    power: { kind: 'glow', name: 'Deep Glow', text: () => 'Once a battle, tap Hint and its lantern shows you a trick for the answer.' } },
  { id: 'compasscrab', source: 'native', world: 'frost', pending: true, name: 'Compass Crab', rarity: 'rare', element: 'stone',
    quirk: 'Always knows which way is north. Walks sideways anyway.',
    power: { kind: 'dig', name: 'Treasure Hunt', base: 6, text: l => `When you win a battle, it digs up ${pn(6, l)} extra shells.` } },
  { id: 'auroranarwhal', source: 'native', world: 'frost', champion: 'frost', pending: true, name: 'Aurora Narwhal', rarity: 'legendary', element: 'frost',
    quirk: 'Its horn is an icicle that never melts. It always points to buried treasure.',
    power: { kind: 'lanterns', name: 'Northern Lights', base: 10, text: l => `Every 3rd right answer adds ${pn(10, l, 3)} big cheer.` } },
];

/** Their grown-up forms (level 5): each kind's own grown-up perk. */
export const FROST_EVOLVED: Record<FrostGlimmerId, { name: string; perk: string }> = {
  snowhog: { name: 'Blizzard Hedgehog', perk: 'Every rain or zap you block also adds 2 cheer.' },
  glowfin: { name: 'Lantern Deep Angler', perk: 'You can use Hint twice a battle.' },
  compasscrab: { name: 'Treasure Map Crab', perk: 'Digs up shells after a lost battle too.' },
  auroranarwhal: { name: 'Polar Lights Narwhal', perk: 'Your Finale cheers 10 more.' },
};
