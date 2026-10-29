// Dressing a 3D buddy: its hat, what it has on in every other slot, and the Wardrobe's nudges, all in
// one call. Every scene calls dressUp when it makes a buddy, so the look follows the buddy everywhere
// (typing, math, the playground, the Wardrobe, battles, duels). Without a look of its own, a buddy is
// dressed from the player's save (the app sets where that comes from, adventure/wardrobe.ts dressOf).
import type { Character } from './character';
import type { FriendId } from '../art/cast';
import type { Dress } from '../adventure/gear';
import { makeOutfit } from './outfits3d';
import { wearKit } from './gear3d';

let fromSave: ((buddy: FriendId) => Dress | null) | null = null;
/** Where a buddy's look comes from when a scene doesn't bring one (the app sets it once). */
export function setDressSource(f: (buddy: FriendId) => Dress | null) { fromSave = f; }
/** The look the save has for a buddy (null before there's a player). */
export const savedDress = (buddy: FriendId) => fromSave?.(buddy) ?? null;

/** Put everything on: the hat (with its nudge) and every other slot. `d` null: nothing at all. */
export async function dressUp(c: Character, d: Dress | null | undefined = savedDress(c.id)) {
  const look = d ?? { hat: 'none', on: {}, nudge: {} };
  c.nudgeHat(look.nudge[look.hat] ?? null);
  await Promise.all([c.wear(look.hat || 'none', makeOutfit), wearKit(c, look.on, look.nudge)]);
}
