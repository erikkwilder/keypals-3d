// Clockwork Isle's own Glimmers: three natives and a Champion that belong to the world of clocks, gears
// and scales, in the 100-Glimmer ladder's shape (ladder.ts): source 'native', world 'clockwork', the
// Gearmane Lion the island's Champion. They're `pending` until their 3D models are made (scripts/glimmers),
// so the Glimmer Book shows them "On its way" and nobody can meet, hatch or battle one yet; meanwhile the
// world borrows Glimmers who fit (state.ts ISLANDS: Sunny Snail, Teakettle Dragon, Pebble Tortoise and Rock
// Candy Armadillo, with the Comet Cat holding the clock tower). Their paintings, faces and outlines are in
// public/game/glimmers (made with scripts/glimmers/concepts-finish.py from the concepts in
// keypals-round9/MSR/glimmers).
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, put
// the natives in ISLANDS.clockwork.natives and make the Gearmane Lion the island's champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type ClockworkGlimmerId = 'cuckoochick' | 'cogbeetle' | 'sandhog' | 'gearlion';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const CLOCKWORK_GLIMMERS: (GlimmerDef & { id: ClockworkGlimmerId })[] = [
  { id: 'cuckoochick', source: 'native', world: 'clockwork', pending: true, name: 'Cuckoo Chick', rarity: 'common', element: 'leaf',
    quirk: 'Pops out of its little clock house to say cuckoo. Always one minute early.',
    power: { kind: 'opener', name: 'First Cuckoo', base: 5, text: l => `Your first right answer cuckoos ${pn(5, l)} extra cheer.` } },
  { id: 'cogbeetle', source: 'native', world: 'clockwork', pending: true, name: 'Cogwheel Beetle', rarity: 'uncommon', element: 'stone',
    quirk: 'Its shell is a brass gear. It spins round when it giggles.',
    power: { kind: 'shell', name: 'Gear Shell', text: () => 'Blocks the first rain or zap in every battle for you.' } },
  { id: 'sandhog', source: 'native', world: 'clockwork', pending: true, name: 'Hourglass Hedgehog', rarity: 'rare', element: 'sun',
    quirk: 'Turns itself upside down whenever it needs a little more time.',
    power: { kind: 'coolhead', name: 'Slow Sand', base: 3, text: l => `Gives you ${pn(3, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'gearlion', source: 'native', world: 'clockwork', champion: 'clockwork', pending: true, name: 'Gearmane Lion', rarity: 'legendary', element: 'sun', cloud: 'fox',
    quirk: 'Its mane of gears ticks while it thinks. It roars exactly on the hour.',
    power: { kind: 'lanterns', name: 'On the Hour', base: 12, text: l => `Every 3rd right answer strikes the hour: ${pn(12, l, 3)} big cheer.` } },
];

/** Their grown-up forms (each kind's own grown-up perk, as battle.ts does for every Glimmer of a kind). */
export const CLOCKWORK_EVOLVED: Record<ClockworkGlimmerId, { name: string; perk: string }> = {
  cuckoochick: { name: 'Cuckoo Songbird', perk: 'Your first two right answers both cuckoo.' },
  cogbeetle: { name: 'Clocktower Beetle', perk: 'Blocks the first two rains or zaps, not just one.' },
  sandhog: { name: 'Sundial Hedgehog', perk: 'Every rain or zap you block also adds 2 cheer.' },
  gearlion: { name: 'Grand Clockwork Lion', perk: 'Your Finale cheers 10 more.' },
};
