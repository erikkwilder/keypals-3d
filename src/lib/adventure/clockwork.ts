// Clockwork Isle's own Glimmers: three natives and a Champion that belong to the world of clocks, gears
// and scales. They're written here in the same shape as glimmers.ts, but marked `pending`: their 3D
// models come from the separate Glimmer pipeline (scripts/glimmers), and until a model exists a Glimmer
// can't be met, hatched or battled. So for now they appear nowhere, and the world borrows Glimmers who
// fit (state.ts ISLANDS: Sunny Snail, Teakettle Dragon, Pebble Tortoise and Rock Candy Armadillo, with the
// Comet Cat holding the clock tower). The painted concepts for the model pipeline are in the round's
// folder (keypals-round9/MSR/glimmers/<id>.png).
//
// To bring them in once their models are made: add the ids to GlimmerId and these entries to GLIMMERS
// (without `pending`, with `home: 'clockwork'` once GlimmerDef's home takes world islands), put them in
// ISLANDS.clockwork.natives, and make the Gearmane Lion the island's champion.
import { powerNum, type GlimmerDef } from './glimmers';

export type PendingGlimmer = Omit<GlimmerDef, 'id' | 'home' | 'champion'> & {
  id: 'cuckoochick' | 'cogbeetle' | 'sandhog' | 'gearlion';
  /** not in the game until its 3D model is made */
  pending: true;
  /** where it lives, and (the Champion) the island it guards */
  home: 'clockwork'; champion?: 'clockwork';
  /** the painted concept the model is made from */
  concept: string;
};

export const CLOCKWORK_GLIMMERS: PendingGlimmer[] = [
  { id: 'cuckoochick', pending: true, home: 'clockwork', name: 'Cuckoo Chick', rarity: 'common', element: 'leaf', concept: 'cuckoochick.png',
    quirk: 'Pops out of its little clock house to say cuckoo. Always one minute early.',
    power: { kind: 'opener', name: 'First Cuckoo', base: 5, text: l => `Your first right answer cuckoos ${powerNum(5, l)} extra cheer.` } },
  { id: 'cogbeetle', pending: true, home: 'clockwork', name: 'Cogwheel Beetle', rarity: 'uncommon', element: 'stone', concept: 'cogbeetle.png',
    quirk: 'Its shell is a brass gear. It spins round when it giggles.',
    power: { kind: 'shell', name: 'Gear Shell', text: () => 'Blocks the first rain or zap in every battle for you.' } },
  { id: 'sandhog', pending: true, home: 'clockwork', name: 'Hourglass Hedgehog', rarity: 'rare', element: 'sun', concept: 'sandhog.png',
    quirk: 'Turns itself upside down whenever it needs a little more time.',
    power: { kind: 'coolhead', name: 'Slow Sand', base: 3, text: l => `Gives you ${powerNum(3, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'gearlion', pending: true, home: 'clockwork', champion: 'clockwork', name: 'Gearmane Lion', rarity: 'legendary', element: 'sun', cloud: 'fox', concept: 'gearlion.png',
    quirk: 'Its mane of gears ticks while it thinks. It roars exactly on the hour.',
    power: { kind: 'lanterns', name: 'On the Hour', base: 12, text: l => `Every 3rd right answer strikes the hour: ${powerNum(12, l, 3)} big cheer.` } },
];
