// STUB until helper L writes the wearables library here (same shape). The wardrobe (wardrobe.ts) reads
// WEARABLES generically: anything listed here shows in the Shop and the Wardrobe and can be worn.
export type WearSlot = 'head' | 'face' | 'neck' | 'back' | 'hand' | 'feet';
export type Wearable = {
  id: string; name: string; slot: WearSlot; rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** shells */
  price: number;
  /** one fun line with personality */
  text: string;
  vibe: 'cool' | 'cosy' | 'goofy' | 'fancy' | 'sporty' | 'magic';
  /** 'wear/<id>.glb' for head, face, neck, back, hand (Y up, front +Z, origin at the attach point) */
  model?: string;
  /** feet: 'wear/tile-<id>.webp', a painted tile for the shoe shell */
  shoeTile?: string;
  /** head/face/neck: width as a share of the head's; back: of the back's; hand: height as a share of the buddy's */
  size: number;
  /** head: how far it slides down over the head, as a share of its own height */
  sink?: number;
  /** 'wear/<id>.webp' */
  icon: string;
};
export const WEARABLES: Wearable[] = [];
