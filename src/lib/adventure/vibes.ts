// Vibes: an aura round your buddy instead of a thing to wear. Sparkles, a swirl, a little cloud overhead,
// hearts, bubbles, music notes, falling leaves or snow, a rainbow trail, fireflies, a ring of stars, a
// golden glow. One at a time, bought with shells like everything else in the Shop; they show wherever
// the buddy's look shows (three/gear3d.ts draws them: a handful of painted sprites, cheap on a phone,
// and kept clear of the face).
import type { Wearable } from './wearables';

/** How a vibe moves: drifting round the body, rising, falling from above, orbiting, overhead, trailing
 *  from the feet, or a glow on the ground. */
export type VibeMotion = 'drift' | 'rise' | 'fall' | 'orbit' | 'swirl' | 'overhead' | 'trail' | 'glow';
export type VibeDef = {
  id: string; name: string; text: string; price: number;
  rarity: Wearable['rarity']; vibe: Wearable['vibe'];
  motion: VibeMotion;
  /** painted sprites (public/...), picked from at random */
  sprites: string[];
  /** sprite size as a share of the buddy's height */
  size: number;
  /** light that adds up (the golden glow) */
  glow?: boolean;
  /** tints cycled through (the rainbow) */
  tints?: number[];
  icon: string;
};

const V = (d: Omit<VibeDef, 'icon'>): VibeDef => ({ ...d, icon: `vibes/icon-${d.id}.webp` });
export const VIBES_LIST: VibeDef[] = [
  V({ id: 'vibe_sparkles', name: 'Twinkle Twinkle', text: 'A little shimmer follows you everywhere. Very hard to sneak up on anyone.', price: 90, rarity: 'common', vibe: 'magic', motion: 'drift', sprites: ['vibes/sparkle.webp'], size: 0.14 }),
  V({ id: 'vibe_hearts', name: 'Love Bubbles', text: 'Hearts float up whenever you feel happy, which is always.', price: 90, rarity: 'common', vibe: 'cosy', motion: 'rise', sprites: ['vibes/heart.webp'], size: 0.1 }),
  V({ id: 'vibe_bubbles', name: 'Bubble Trouble', text: 'Pop! Pop! Pop! You smell faintly of bubble bath now.', price: 80, rarity: 'common', vibe: 'goofy', motion: 'rise', sprites: ['math/bubble.webp'], size: 0.15 }),
  V({ id: 'vibe_cloud', name: 'Little Cloud', text: 'Your very own weather. Mostly sunny, with a chance of drizzle.', price: 120, rarity: 'uncommon', vibe: 'cosy', motion: 'overhead', sprites: ['vibes/cloud.webp', 'vibes/dot.webp'], size: 0.42 }),
  V({ id: 'vibe_notes', name: 'Groove Aura', text: 'You hum. The air hums back. Everybody hums.', price: 140, rarity: 'uncommon', vibe: 'cool', motion: 'rise', sprites: ['gear/tex-note0.webp', 'gear/tex-note1.webp', 'gear/tex-note2.webp'], size: 0.1 }),
  V({ id: 'vibe_leaves', name: 'Autumn Breeze', text: 'Leaves twirl down around you. It is always autumn somewhere.', price: 140, rarity: 'uncommon', vibe: 'cosy', motion: 'fall', sprites: ['vibes/leaf.webp', 'vibes/leaf2.webp'], size: 0.11 }),
  V({ id: 'vibe_snow', name: 'Snow Day', text: 'Soft snow, just for you. Nobody else has to wear a coat.', price: 160, rarity: 'uncommon', vibe: 'cosy', motion: 'fall', sprites: ['vibes/snowflake.webp'], size: 0.11 }),
  V({ id: 'vibe_fireflies', name: 'Firefly Friends', text: 'A few tiny friends who keep the lights on for you.', price: 180, rarity: 'rare', vibe: 'magic', motion: 'drift', sprites: ['vibes/firefly.webp'], size: 0.13 }),
  V({ id: 'vibe_stars', name: 'Starry Spin', text: 'Like you just bumped into something wonderful.', price: 200, rarity: 'rare', vibe: 'goofy', motion: 'orbit', sprites: ['game/icon-star.webp'], size: 0.1 }),
  V({ id: 'vibe_swirl', name: 'Magic Swirl', text: 'A slow swirl of wizard dust spins round you. Please do not sneeze.', price: 220, rarity: 'rare', vibe: 'magic', motion: 'swirl', sprites: ['vibes/wisp.webp', 'vibes/sparkle.webp'], size: 0.18 }),
  V({ id: 'vibe_glow', name: 'Golden Glow', text: 'You light up the room. And the field. And the beach.', price: 260, rarity: 'epic', vibe: 'fancy', motion: 'glow', sprites: ['vibes/dot.webp', 'vibes/sparkle.webp'], size: 0.06, glow: true }),
  V({ id: 'vibe_rainbow', name: 'Rainbow Trail', text: 'Wherever you go, a rainbow goes too. Runs leave a stripe behind you.', price: 300, rarity: 'epic', vibe: 'magic', motion: 'trail', sprites: ['vibes/sparkle.webp'], size: 0.13, tints: [0xff6b6b, 0xffb347, 0xffe066, 0x7ee081, 0x6ec6ff, 0xb48cff] }),
];
export const VIBE: Record<string, VibeDef> = Object.fromEntries(VIBES_LIST.map(v => [v.id, v]));
