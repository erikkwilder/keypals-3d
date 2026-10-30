// The Star Lab's own Glimmers: three that live there and its Champion, in the 100-Glimmer ladder's shape
// (ladder.ts): source 'native', world 'stars', the Starmane Lion the island's Champion. Their 3D models come
// later from the model pipeline, so they are `pending`: the Glimmer Book shows them "On its way" and no egg,
// battle or shop gives one yet. Until then the Star Lab borrows star-ish Glimmers from the other islands
// (state.ts ISLANDS: Spark Moth, Frost Owl, Snowflake Jelly, Cloud Whale Calf) and the Comet Cat is its
// Champion. Their paintings, faces and outlines are in public/game/glimmers (made with
// scripts/glimmers/concepts-finish.py from the concepts in keypals-round9/ALG/glimmers).
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, swap
// the natives into the island and make the Starmane Lion its champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type StarGlimmerId = 'moonbeambat' | 'stardusthamster' | 'orbitotter' | 'starmanelion';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const STAR_GLIMMERS: (GlimmerDef & { id: StarGlimmerId })[] = [
  { id: 'moonbeambat', source: 'native', world: 'stars', pending: true, name: 'Moonbeam Bat', rarity: 'common', element: 'frost',
    quirk: 'Sleeps all day. Counts the stars all night, and never loses count.',
    power: { kind: 'boost', name: 'Moonbeam', base: 2, text: l => `Ice cards add ${pn(2, l)} more cheer.` } },
  { id: 'stardusthamster', source: 'native', world: 'stars', pending: true, name: 'Stardust Hamster', rarity: 'uncommon', element: 'sun',
    quirk: 'Stuffs its cheeks with stardust, then sneezes sparkles everywhere.',
    power: { kind: 'opener', name: 'Stardust Sneeze', base: 6, text: l => `Your first right answer sneezes ${pn(6, l)} extra cheer.` } },
  { id: 'orbitotter', source: 'native', world: 'stars', pending: true, name: 'Orbit Otter', rarity: 'rare', element: 'tide',
    quirk: 'A tiny moon follows it everywhere. It throws the moon. The moon comes back.',
    power: { kind: 'bubbles', name: 'Little Moon', base: 4, text: () => 'Every 4th right answer its little moon makes a shield that stops the next rain or zap. 2 shields a battle at most.' } },
  { id: 'starmanelion', source: 'native', world: 'stars', champion: 'stars', cloud: 'fox', pending: true, name: 'Starmane Lion', rarity: 'legendary', element: 'sun',
    quirk: 'Its mane is a whole night sky. It has named every star in it.',
    power: { kind: 'lanterns', name: 'Constellation', base: 10, text: l => `Every 3rd right answer joins up the stars for ${pn(10, l, 3)} big cheer.` } },
];

/** Their grown-up forms (level 5): each kind's own grown-up perk. */
export const STAR_EVOLVED: Record<StarGlimmerId, { name: string; perk: string }> = {
  moonbeambat: { name: 'Midnight Bat', perk: 'Ice cards also fill an extra Finale star.' },
  stardusthamster: { name: 'Galaxy Hamster', perk: 'Your first two right answers both sneeze.' },
  orbitotter: { name: 'Planet Otter', perk: 'Its moon makes a shield every 3rd right answer instead.' },
  starmanelion: { name: 'Great Starmane Lion', perk: 'Your Finale cheers 10 more.' },
};
