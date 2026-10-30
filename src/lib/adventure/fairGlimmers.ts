// The Chance Fair's own Glimmers: three natives and a Champion, in the 100-Glimmer ladder's shape (ladder.ts):
// source 'native', world 'fair', the Spinwheel Peacock the island's Champion. Their 3D models come from a
// separate pipeline later, so every one is `pending`: the Glimmer Book shows them "On its way" and no egg,
// battle or Champion fight gives one yet. Until then the fair's battles use Glimmers that already exist
// (state.ts ISLANDS: Popcorn Puffling and friends, and Pinecone Pangolin as the Champion). Their paintings,
// faces and outlines are in public/game/glimmers (made with scripts/glimmers/concepts-finish.py from the
// concepts in keypals-round9/DAT/glimmers).
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, list
// the natives in the fair's natives and make the Spinwheel Peacock its champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type FairGlimmerId = 'dicebun' | 'pinwheelfinch' | 'balloonpuff' | 'spinpeacock';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const FAIR_GLIMMERS: (GlimmerDef & { id: FairGlimmerId })[] = [
  { id: 'dicebun', source: 'native', world: 'fair', pending: true, name: 'Dice Bunny', rarity: 'common', element: 'stone',
    quirk: 'Rolls over to say hello. Never lands the same way twice.',
    power: { kind: 'dig', name: 'Roll Out', base: 3, text: l => `When you win a battle, it rolls up ${pn(3, l)} extra shells.` } },
  { id: 'pinwheelfinch', source: 'native', world: 'fair', pending: true, name: 'Pinwheel Finch', rarity: 'uncommon', element: 'leaf',
    quirk: 'Its tail spins whenever it\'s happy. It\'s usually spinning.',
    power: { kind: 'opener', name: 'Spin Up', base: 5, text: l => `Your first right answer spins ${pn(5, l)} extra cheer.` } },
  { id: 'balloonpuff', source: 'native', world: 'fair', pending: true, name: 'Balloon Puffer', rarity: 'rare', element: 'tide',
    quirk: 'Floats on a ribbon. Lets go of it when it giggles.',
    power: { kind: 'bubbles', name: 'Balloon Shield', base: 4, text: () => 'Every 4th right answer floats a balloon that stops the next rain or zap. 2 shields a battle at most.' } },
  { id: 'spinpeacock', source: 'native', world: 'fair', champion: 'fair', pending: true, name: 'Spinwheel Peacock', rarity: 'legendary', element: 'leaf',
    quirk: 'Its tail is a wheel of eight colours. It never says which one it likes best.',
    power: { kind: 'lanterns', name: 'Grand Spin', base: 9, text: l => `Every 3rd right answer spins ${pn(9, l, 3)} big cheer.` } },
];

/** Their grown-up forms (level 5): each kind's own grown-up perk. */
export const FAIR_EVOLVED: Record<FairGlimmerId, { name: string; perk: string }> = {
  dicebun: { name: 'Double Dice Bunny', perk: 'Rolls up shells after a lost battle too.' },
  pinwheelfinch: { name: 'Windmill Finch', perk: 'Your first two right answers both spin.' },
  balloonpuff: { name: 'Hot Air Puffer', perk: 'Floats a balloon every 3rd right answer instead.' },
  spinpeacock: { name: 'Carousel Peacock', perk: 'Your Finale cheers 10 more.' },
};
