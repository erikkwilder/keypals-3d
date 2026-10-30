// The Juice Jungle's own Glimmers: three that live there and its Champion, in the 100-Glimmer ladder's shape
// (ladder.ts): source 'native', world 'jungle', the Mango Jaguar the island's Champion. They're `pending`
// until their 3D models come from the Glimmer pipeline (scripts/glimmers), so the Glimmer Book shows them "On
// its way" and nothing rolls, hatches or battles them yet. Until then Juice Jungle's battles use Glimmers from
// the islands (state.ts ISLANDS: Mushroom Mouse, Cactus Kitten, Sprout Bunny and Popcorn Puffling live there,
// and the Pinecone Pangolin is its Champion). Their paintings, faces and outlines are in public/game/glimmers
// (made with scripts/glimmers/concepts-finish.py from the concepts in keypals-round9/RAT/glimmers); `look`
// is what the model is made from.
//
// When a model ships: take its `pending` off (glimmers.ts spreads these in), and once all four are in, put
// the natives in ISLANDS.jungle.natives and make the Mango Jaguar the island's champion.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

export type JungleGlimmerId = 'smoothiesloth' | 'pineapplepine' | 'coconutcrab' | 'mangojaguar';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const JUNGLE_GLIMMERS: (GlimmerDef & { id: JungleGlimmerId; look: string })[] = [
  { id: 'smoothiesloth', source: 'native', world: 'jungle', pending: true, name: 'Smoothie Sloth', rarity: 'common', element: 'leaf',
    quirk: 'Drinks its smoothie upside down, so it takes the long way down.',
    look: 'A soft mint-green baby sloth with leafy tufts on its head, hugging a little cup of pink smoothie with a straw, one arm hanging from a vine.',
    power: { kind: 'nibble', name: 'Slow Sip', text: l => `Gives you ${pn(1, l, 6)} energy back after each answer.` } },
  { id: 'pineapplepine', source: 'native', world: 'jungle', pending: true, name: 'Pineapple Porcupine', rarity: 'uncommon', element: 'sun',
    quirk: 'Its spikes are leaves. Its leaves are spikes. Nobody is sure.',
    look: 'A round golden baby porcupine whose back is pineapple skin with soft quills, a crown of green pineapple leaves, a cheeky grin.',
    power: { kind: 'opener', name: 'Prickly Start', base: 6, text: l => `Your first right answer pops ${pn(6, l)} extra cheer.` } },
  { id: 'coconutcrab', source: 'native', world: 'jungle', pending: true, name: 'Coconut Crab', rarity: 'rare', element: 'tide',
    quirk: 'Sips coconut water through a tiny straw, very politely.',
    look: 'A small friendly turquoise crab wearing half a coconut as its shell, sipping through a striped straw in a pool under a juice waterfall.',
    power: { kind: 'shell', name: 'Coconut Shell', base: 2, text: () => 'Blocks the first two rains or zaps in every battle for you.' } },
  { id: 'mangojaguar', source: 'native', world: 'jungle', champion: 'jungle', pending: true, name: 'Mango Jaguar', rarity: 'legendary', element: 'sun', cloud: 'fox',
    quirk: 'Its spots are little mango slices. They smell amazing.',
    look: 'A young golden-orange jaguar cub with mango-slice spots and a glowing leaf-and-mango crown, a soft sunny aura with sparkles.',
    power: { kind: 'lanterns', name: 'Three Slices', base: 10, text: l => `Every 3rd right answer adds ${pn(10, l, 3)} big cheer.` } },
];

/** Their grown-up forms (level 5): each kind's own grown-up perk. */
export const JUNGLE_EVOLVED: Record<JungleGlimmerId, { name: string; perk: string }> = {
  smoothiesloth: { name: 'Tropical Sloth', perk: 'Strong ⚡ cards give you 2 more energy back.' },
  pineapplepine: { name: 'Pineapple King Porcupine', perk: 'Your first two right answers both pop.' },
  coconutcrab: { name: 'Palm Island Crab', perk: 'Each rain or zap it blocks gives you 2 energy back.' },
  mangojaguar: { name: 'Golden Mango Jaguar', perk: 'Your Finale cheers 10 more.' },
};
