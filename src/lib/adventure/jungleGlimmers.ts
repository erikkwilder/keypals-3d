// The Juice Jungle's own Glimmers: three that live there and its Champion. They are written here, ready, but
// `pending`: their 3D models come later from the Glimmer pipeline (scripts/glimmers), so they are NOT in
// GLIMMERS yet and can't hatch, battle or show in the collection. Until they're made, Juice Jungle's battles
// use Glimmers from the islands (state.ts ISLANDS: Mushroom Mouse, Cactus Kitten, Sprout Bunny and Popcorn
// Puffling live there, and the Pinecone Pangolin is its Champion). Each one's painted concept, for the
// pipeline to follow, is in the round's art folder (smoothiesloth.webp, pineapplepine.webp, coconutcrab.webp,
// mangojaguar.webp). To bring one in: add its id to GlimmerId, move its entry into GLIMMERS (without
// `pending`), make its model and pictures, and put it in the jungle island's natives (or its champion).
import { powerNum, type GlimmerDef } from './glimmers';

export type PendingGlimmer = Omit<GlimmerDef, 'id' | 'home' | 'champion'> & {
  id: string;
  /** not made yet: no model, no pictures; it never appears in the game */
  pending: true;
  /** the world it belongs to, and whether it is that world's Champion */
  world: 'jungle'; champion?: boolean;
  /** its look, for whoever makes the model */
  look: string;
};

export const JUNGLE_GLIMMERS: PendingGlimmer[] = [
  { id: 'smoothiesloth', pending: true, world: 'jungle', name: 'Smoothie Sloth', rarity: 'common', element: 'leaf',
    quirk: 'Drinks its smoothie upside down, so it takes the long way down.',
    look: 'A soft mint-green baby sloth with leafy tufts on its head, hugging a little cup of pink smoothie with a straw, one arm hanging from a vine.',
    power: { kind: 'nibble', name: 'Slow Sip', text: l => `Gives you ${powerNum(1, l, 6)} energy back after each answer.` } },
  { id: 'pineapplepine', pending: true, world: 'jungle', name: 'Pineapple Porcupine', rarity: 'uncommon', element: 'sun',
    quirk: 'Its spikes are leaves. Its leaves are spikes. Nobody is sure.',
    look: 'A round golden baby porcupine whose back is pineapple skin with soft quills, a crown of green pineapple leaves, a cheeky grin.',
    power: { kind: 'opener', name: 'Prickly Start', base: 6, text: l => `Your first right answer pops ${powerNum(6, l)} extra cheer.` } },
  { id: 'coconutcrab', pending: true, world: 'jungle', name: 'Coconut Crab', rarity: 'rare', element: 'tide',
    quirk: 'Sips coconut water through a tiny straw, very politely.',
    look: 'A small friendly turquoise crab wearing half a coconut as its shell, sipping through a striped straw in a pool under a juice waterfall.',
    power: { kind: 'shell', name: 'Coconut Shell', base: 2, text: () => 'Blocks the first two rains or zaps in every battle for you.' } },
  { id: 'mangojaguar', pending: true, world: 'jungle', champion: true, name: 'Mango Jaguar', rarity: 'legendary', element: 'sun', cloud: 'fox',
    quirk: 'Its spots are little mango slices. They smell amazing.',
    look: 'A young golden-orange jaguar cub with mango-slice spots and a glowing leaf-and-mango crown, a soft sunny aura with sparkles.',
    power: { kind: 'lanterns', name: 'Three Slices', base: 10, text: l => `Every 3rd right answer adds ${powerNum(10, l, 3)} big cheer.` } },
];
