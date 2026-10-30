// The Chance Fair's own Glimmers: three natives and a Champion, designed for the world (concept paintings
// in public/game/glimmers/ when they ship; for now ~/Documents/keypals-round9/DAT/glimmers/). Their 3D
// models come from a separate pipeline later, so every one is `pending`: kept out of GLIMMERS (no eggs,
// no battles, no collection, no Champion fight) until it has a model. Until then the fair's battles use
// Glimmers that already exist (state.ts ISLANDS: Popcorn Puffling and friends, and Pinecone Pangolin as
// the Champion). To bring one in: add its id to GlimmerId, move its entry into GLIMMERS (dropping
// `pending`, `world`, `evolved` and `concept`), put `evolved` in EVOLVED, and list it in the fair's natives
// (or as its champion).
import { powerNum, type GlimmerDef } from './glimmers';

export type PendingGlimmer = Omit<GlimmerDef, 'id' | 'home' | 'champion' | 'cloud'> & {
  id: string;
  /** not in the game yet: waiting for its 3D model */
  pending: true;
  /** the world it belongs to, and whether it's that world's Champion */
  world: 'fair'; champion?: boolean;
  /** its grown-up form (EVOLVED) */
  evolved: { name: string; perk: string };
  /** its concept painting */
  concept: string;
};

export const FAIR_GLIMMERS: PendingGlimmer[] = [
  { id: 'dicebun', pending: true, world: 'fair', name: 'Dice Bunny', rarity: 'common', element: 'stone', concept: 'dicebun.webp',
    quirk: 'Rolls over to say hello. Never lands the same way twice.',
    power: { kind: 'dig', name: 'Roll Out', base: 3, text: l => `When you win a battle, it rolls up ${powerNum(3, l)} extra shells.` },
    evolved: { name: 'Double Dice Bunny', perk: 'Rolls up shells after a lost battle too.' } },
  { id: 'pinwheelfinch', pending: true, world: 'fair', name: 'Pinwheel Finch', rarity: 'uncommon', element: 'leaf', concept: 'pinwheelfinch.webp',
    quirk: 'Its tail spins whenever it\'s happy. It\'s usually spinning.',
    power: { kind: 'opener', name: 'Spin Up', base: 5, text: l => `Your first right answer spins ${powerNum(5, l)} extra cheer.` },
    evolved: { name: 'Windmill Finch', perk: 'Your first two right answers both spin.' } },
  { id: 'balloonpuff', pending: true, world: 'fair', name: 'Balloon Puffer', rarity: 'rare', element: 'tide', concept: 'balloonpuff.webp',
    quirk: 'Floats on a ribbon. Lets go of it when it giggles.',
    power: { kind: 'bubbles', name: 'Balloon Shield', base: 4, text: () => 'Every 4th right answer floats a balloon that stops the next rain or zap. 2 shields a battle at most.' },
    evolved: { name: 'Hot Air Puffer', perk: 'Floats a balloon every 3rd right answer instead.' } },
  { id: 'spinpeacock', pending: true, world: 'fair', champion: true, name: 'Spinwheel Peacock', rarity: 'legendary', element: 'leaf', concept: 'spinpeacock.webp',
    quirk: 'Its tail is a wheel of eight colours. It never says which one it likes best.',
    power: { kind: 'lanterns', name: 'Grand Spin', base: 9, text: l => `Every 3rd right answer spins ${powerNum(9, l, 3)} big cheer.` },
    evolved: { name: 'Carousel Peacock', perk: 'Your Finale cheers 10 more.' } },
];
