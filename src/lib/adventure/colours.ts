// Colours: paint your buddy a new colour. A colour changes the buddy's own colour (its fur, skin or
// box, the hue it's made in: the cast's colour), keeping its eyes, mouth and the clothes in other
// colours as they are (three/character.ts setColour does it in the buddy's shader). Bought with shells
// like everything else; each buddy keeps its own colour in its look.
import type { Wearable } from './wearables';
import type { FriendId } from '../art/cast';

/** plain: a new hue; gold, rainbow and galaxy move a little */
export type ColourMode = 'plain' | 'gold' | 'rainbow' | 'galaxy';
export type ColourDef = {
  id: string; name: string; text: string; price: number;
  rarity: Wearable['rarity']; vibe: Wearable['vibe'];
  /** the new hue (0..1), how colourful (0..1) and how light (a multiplier) */
  hue: number; sat: number; light: number;
  mode: ColourMode;
  icon: string;
};

const C = (d: Omit<ColourDef, 'icon'>): ColourDef => ({ ...d, icon: `colours/${d.id}.webp` });
export const COLOURS_LIST: ColourDef[] = [
  C({ id: 'colour_sunny', name: 'Sunny Yellow', text: 'Bright as a lemon. Sunglasses recommended.', price: 60, rarity: 'common', vibe: 'cool', hue: 0.13, sat: 0.78, light: 1.12, mode: 'plain' }),
  C({ id: 'colour_bubblegum', name: 'Bubblegum Pink', text: 'Sweet, bouncy, and only a little bit sticky.', price: 60, rarity: 'common', vibe: 'goofy', hue: 0.93, sat: 0.55, light: 1.1, mode: 'plain' }),
  C({ id: 'colour_mint', name: 'Mint', text: 'Cool and fresh, like a breeze that brushed its teeth.', price: 60, rarity: 'common', vibe: 'cosy', hue: 0.43, sat: 0.45, light: 1.12, mode: 'plain' }),
  C({ id: 'colour_ocean', name: 'Ocean Blue', text: 'Deep and splashy. Fish wave as you go by.', price: 80, rarity: 'common', vibe: 'cool', hue: 0.59, sat: 0.72, light: 0.95, mode: 'plain' }),
  C({ id: 'colour_lava', name: 'Lava Orange', text: 'Hot stuff! (Not actually hot. You can hug it.)', price: 90, rarity: 'uncommon', vibe: 'sporty', hue: 0.035, sat: 0.85, light: 1.05, mode: 'plain' }),
  C({ id: 'colour_grape', name: 'Grape Purple', text: 'Fancy and fruity. Smells faintly of jam.', price: 90, rarity: 'uncommon', vibe: 'fancy', hue: 0.78, sat: 0.58, light: 0.92, mode: 'plain' }),
  C({ id: 'colour_lime', name: 'Zingy Lime', text: 'So bright it fizzes. Do not put it in a drink.', price: 100, rarity: 'uncommon', vibe: 'goofy', hue: 0.24, sat: 0.72, light: 1.08, mode: 'plain' }),
  C({ id: 'colour_snow', name: 'Snowy White', text: 'White as fresh snow, with a little blue sparkle.', price: 120, rarity: 'rare', vibe: 'cosy', hue: 0.58, sat: 0.08, light: 1.45, mode: 'plain' }),
  C({ id: 'colour_midnight', name: 'Midnight', text: 'Dark and mysterious, like a cat on a secret mission.', price: 140, rarity: 'rare', vibe: 'cool', hue: 0.66, sat: 0.5, light: 0.55, mode: 'plain' }),
  C({ id: 'colour_gold', name: 'Gold Shimmer', text: 'Shines like a trophy. Everyone wants a high five.', price: 220, rarity: 'epic', vibe: 'fancy', hue: 0.12, sat: 0.72, light: 1.18, mode: 'gold' }),
  C({ id: 'colour_rainbow', name: 'Rainbow Shimmer', text: 'Every colour at once, slowly swirling. Very hard to hide.', price: 300, rarity: 'legendary', vibe: 'magic', hue: 0, sat: 0.7, light: 1.08, mode: 'rainbow' }),
  C({ id: 'colour_galaxy', name: 'Galaxy', text: 'A whole night sky, with stars that twinkle when you move.', price: 280, rarity: 'legendary', vibe: 'magic', hue: 0.72, sat: 0.62, light: 0.7, mode: 'galaxy' }),
];
export const COLOUR: Record<string, ColourDef> = Object.fromEntries(COLOURS_LIST.map(c => [c.id, c]));
/** Buddies whose colours aren't ready yet (a black or patterned coat that won't take a new colour
 *  cleanly): the Wardrobe says so kindly instead of offering colours, and a saved colour doesn't show. */
export const COLOUR_SOON: FriendId[] = ['cat', 'rabbit', 'antenna'];
export const colourSoon = (id: FriendId) => COLOUR_SOON.includes(id);
