// The Star Lab's own Glimmers: three that live there and its Champion. Their painted concepts are made;
// their 3D models come later from the model pipeline, so they are `pending`: kept out of GLIMMERS (no egg,
// battle, shop or collection shows them) until a model exists. Until then the Star Lab borrows star-ish
// Glimmers from the other islands (state.ts ISLANDS: Spark Moth, Frost Owl, Snowflake Jelly, Cloud Whale
// Calf) and the Comet Cat is its Champion. When a model lands: give the id to GlimmerId, move the entry
// into GLIMMERS (glimmers.ts) without `pending`, add its EVOLVED line, and swap it into the island.
import type { Element, PowerKind, Rarity } from './glimmers';
import { powerNum } from './glimmers';

export type PendingGlimmer = {
  id: string; name: string; rarity: Rarity; element: Element; quirk: string;
  power: { kind: PowerKind; name: string; text: (lvl: number) => string; base?: number };
  /** where it lives (a native), or the island whose Champion it is */
  home?: 'stars'; champion?: 'stars';
  /** the shape of its storm cloud as a Champion Grumble */
  cloud?: 'fox' | 'drake' | 'whale';
  /** its grown-up form (level 5) */
  evolved: { name: string; perk: string };
  /** no 3D model yet: not in the game */
  pending: true;
};

export const STAR_GLIMMERS: PendingGlimmer[] = [
  { id: 'moonbeambat', home: 'stars', name: 'Moonbeam Bat', rarity: 'common', element: 'frost', pending: true,
    quirk: 'Sleeps all day. Counts the stars all night, and never loses count.',
    power: { kind: 'boost', name: 'Moonbeam', base: 2, text: l => `Ice cards add ${powerNum(2, l)} more cheer.` },
    evolved: { name: 'Midnight Bat', perk: 'Ice cards also fill an extra Finale star.' } },
  { id: 'stardusthamster', home: 'stars', name: 'Stardust Hamster', rarity: 'uncommon', element: 'sun', pending: true,
    quirk: 'Stuffs its cheeks with stardust, then sneezes sparkles everywhere.',
    power: { kind: 'opener', name: 'Stardust Sneeze', base: 6, text: l => `Your first right answer sneezes ${powerNum(6, l)} extra cheer.` },
    evolved: { name: 'Galaxy Hamster', perk: 'Your first two right answers both sneeze.' } },
  { id: 'orbitotter', home: 'stars', name: 'Orbit Otter', rarity: 'rare', element: 'tide', pending: true,
    quirk: 'A tiny moon follows it everywhere. It throws the moon. The moon comes back.',
    power: { kind: 'bubbles', name: 'Little Moon', base: 4, text: () => 'Every 4th right answer its little moon makes a shield that stops the next rain or zap. 2 shields a battle at most.' },
    evolved: { name: 'Planet Otter', perk: 'Its moon makes a shield every 3rd right answer instead.' } },
  { id: 'starmanelion', champion: 'stars', cloud: 'fox', name: 'Starmane Lion', rarity: 'legendary', element: 'sun', pending: true,
    quirk: 'Its mane is a whole night sky. It has named every star in it.',
    power: { kind: 'lanterns', name: 'Constellation', base: 10, text: l => `Every 3rd right answer joins up the stars for ${powerNum(10, l, 3)} big cheer.` },
    evolved: { name: 'Great Starmane Lion', perk: 'Your Finale cheers 10 more.' } },
];
/** the painted concepts (not shipped with the game: in the round-9 working folder, glimmers/<id>.png) */
export const STAR_GLIMMER_CONCEPTS = STAR_GLIMMERS.map(g => `${g.id}.png`);
