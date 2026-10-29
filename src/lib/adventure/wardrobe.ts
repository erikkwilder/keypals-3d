// The wardrobe's catalog: everything a buddy can wear, in one list, with how to get each thing. Hats
// are friendship gifts (reach the friendship level with ANY buddy and the hat is yours for every
// buddy); the nine battle pieces come from the shop or a Champion and help in Adventure battles; the
// library (wearables.ts) is just for fun, bought with shells. Everything belongs to the player, and
// each buddy keeps its own look (gear.ts). dressOf is the one place a 3D buddy's clothes come from.
import type { FriendId } from '../art/cast';
import { lookOf, outfitOf, setLook, type Profile } from '../engine/profile';
import { OUTFITS } from '../engine/rewards';
import { GEAR, type Rarity } from './glimmers';
import { advOf, advView, type IslandId } from './state';
import { ITEMS, NO_NUDGE, SETS, buyGear, lookView, setNudge, wardrobeView, wearGear, type Dress, type Nudge, type SetId, type WearSlot } from './gear';
import { WEARABLES, type Wearable } from './wearables';
import { VIBES_LIST } from './vibes';

export type Vibe = Wearable['vibe'];
export const VIBES: { id: Vibe; name: string }[] = [
  { id: 'cool', name: 'Cool' }, { id: 'cosy', name: 'Cosy' }, { id: 'goofy', name: 'Goofy' },
  { id: 'fancy', name: 'Fancy' }, { id: 'sporty', name: 'Sporty' }, { id: 'magic', name: 'Magic' },
];
export type How = 'friendship' | 'shop' | 'champion';
export type CatalogItem = {
  id: string; name: string; slot: WearSlot; rarity: Rarity;
  /** the fun line, or the battle power in plain words */
  text: string;
  /** a picture for its card */
  icon: string;
  how: How;
  /** shells (shop things) */
  price: number | null;
  /** friendship gifts: the level any buddy needs */
  level?: number;
  champion?: IslandId;
  /** what it does in Adventure battles (null: just for fun) */
  power: { name: string; text: string } | null;
  set?: SetId;
  vibe?: Vibe;
  /** from the library (a model or a shoe tile in public/wear) */
  lib?: Wearable;
};

const HAT_RARITY: Record<string, Rarity> = { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legendary' };
const HAT_VIBE: Record<string, Vibe> = { party_hat: 'goofy', flower_crown: 'cosy', propeller_cap: 'goofy', cowboy_hat: 'cool', pirate_hat: 'cool', wizard_hat: 'magic', viking_helmet: 'sporty', top_hat: 'fancy', gold_crown: 'fancy' };
const GEAR_VIBE: Record<string, Vibe> = { bubble_wand: 'magic', hero_cape: 'cool', spring_shoes: 'sporty', sky_kite: 'sporty', fairy_wings: 'magic', cloud_slippers: 'cosy', boombox: 'cool', rocket_pack: 'cool', rocket_sneakers: 'sporty' };

export const CATALOG: CatalogItem[] = [
  ...OUTFITS.map((o): CatalogItem => ({
    id: o.id, name: o.name, slot: 'head', rarity: HAT_RARITY[o.rarity] ?? 'common', icon: `outfits/${o.id}.webp`, how: 'friendship', price: null, level: o.level,
    text: GEAR[o.id]?.text ?? 'A hat for every occasion.', power: GEAR[o.id] ? { name: GEAR[o.id].name, text: GEAR[o.id].text } : null, vibe: HAT_VIBE[o.id],
  })),
  ...ITEMS.map((i): CatalogItem => ({
    id: i.id, name: i.name, slot: i.slot, rarity: i.rarity, icon: `gear/${i.id}.webp`, how: i.price === null ? 'champion' : 'shop', price: i.price, champion: i.champion,
    text: i.text, power: { name: SETS[i.set].name, text: i.text }, set: i.set, vibe: GEAR_VIBE[i.id],
  })),
  ...WEARABLES.map((w): CatalogItem => ({
    id: w.id, name: w.name, slot: w.slot, rarity: w.rarity, icon: w.icon, how: 'shop', price: w.price, text: w.text, power: null, vibe: w.vibe, lib: w,
  })),
  ...VIBES_LIST.map((v): CatalogItem => ({
    id: v.id, name: v.name, slot: 'vibe', rarity: v.rarity, icon: v.icon, how: 'shop', price: v.price, text: v.text, power: null, vibe: v.vibe,
  })),
];
export const CAT: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map(c => [c.id, c]));
export const LIB: Record<string, Wearable> = Object.fromEntries(WEARABLES.map(w => [w.id, w]));

/** The best friendship any buddy has reached: friendship gifts open with it. */
export function bestFriendship(p: Profile): number {
  return Math.max(1, ...Object.values(p.pals ?? {}).map(v => v?.level ?? 1));
}
/** The player has this thing (a hat: some buddy's friendship has reached it). */
export function ownsItem(p: Profile, id: string): boolean {
  const c = CAT[id];
  if (!c) return false;
  if (c.how === 'friendship') return bestFriendship(p) >= (c.level ?? 1) || wardrobeView(advView(p)).owned.includes(id);
  return wardrobeView(advView(p)).owned.includes(id);
}
/** How to get it, in a few words. */
export function howText(c: CatalogItem, islandName: (id: IslandId) => string = id => id): string {
  if (c.how === 'friendship') return `Friendship gift: reach friendship ${c.level} with any buddy`;
  if (c.how === 'champion') return `Beat the ${islandName(c.champion!)} Champion`;
  return `${c.price} shells`;
}
/** What a buddy has on in a slot (the head: its hat). */
export function wornIn(p: Profile, buddy: FriendId, slot: WearSlot): string | null {
  if (slot === 'head') { const h = outfitOf(p, buddy); return h && h !== 'none' ? h : null; }
  return lookView(advView(p), buddy).on[slot] ?? null;
}

/** Buy with shells (call inside game.update); it goes straight on the buddy. */
export function buyItem(p: Profile, buddy: FriendId, id: string): { ok: boolean; why?: string } {
  const c = CAT[id];
  if (!c) return { ok: false, why: 'Not in the shop.' };
  if (c.how === 'friendship') return { ok: false, why: `A friendship gift: reach friendship ${c.level} with any buddy.` };
  const r = buyGear(advOf(p), buddy, id, { price: c.price, slot: c.slot });
  if (r.ok && c.slot === 'head') setLook(p, buddy, { outfit: id });
  return r;
}
/** Put it on a buddy, or take that slot's thing off with null (call inside game.update). */
export function wearItem(p: Profile, buddy: FriendId, slot: WearSlot, id: string | null): boolean {
  if (id && (!ownsItem(p, id) || CAT[id]?.slot !== slot)) return false;
  if (slot === 'head') { setLook(p, buddy, { outfit: id ?? 'none' }); return true; }
  return wearGear(advOf(p), buddy, slot, id, id ? CAT[id].slot : undefined);
}
/** Move it: save a nudge for a worn thing (null: back to where it was). */
export function nudgeItem(p: Profile, buddy: FriendId, id: string, n: Nudge | null) { setNudge(advOf(p), buddy, id, n); }
export function nudgeOf(p: Profile, buddy: FriendId, id: string): Nudge {
  return { ...NO_NUDGE, ...(wardrobeView(advView(p)).looks[buddy]?.nudge?.[id] ?? {}) };
}
/** The one place a 3D buddy's clothes come from: its hat, what it has on in every other slot, and the
 *  nudges. Every scene dresses from this (three/dress.ts), so the look follows the buddy everywhere. */
export function dressOf(p: Profile, buddy: FriendId = p.buddy): Dress {
  const l = lookView(advView(p), buddy);
  return { hat: lookOf(p, buddy).outfit ?? 'none', on: l.on, nudge: l.nudge };
}
