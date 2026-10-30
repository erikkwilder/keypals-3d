// Gear and the wardrobe. Everything a buddy can wear belongs to the PLAYER: bought or won once, any
// buddy can wear it. Each buddy remembers its own look: what it has on in each slot, and any nudges
// made with the Wardrobe's "Move it" tool. (Hats are the head slot; which hat a buddy wears is kept
// with its look in the profile, profile.ts setLook.) The nine battle pieces here help in Adventure
// battles, and wearing all three pieces of a set gives a set bonus too; they come from the shop
// (shells) or, for the rarest, from beating a Champion. The whole catalog (hats, these pieces and the
// just-for-fun library) is in wardrobe.ts.
import type { Rarity } from './glimmers';
import type { Adventure, IslandId } from './state';

/** Where a thing is worn (a vibe is an aura round the buddy: vibes.ts; a colour paints the buddy
 *  itself: colours.ts). */
export type WearSlot = 'head' | 'face' | 'neck' | 'back' | 'hand' | 'feet' | 'vibe' | 'colour';
export const WEAR_SLOTS: WearSlot[] = ['head', 'face', 'neck', 'back', 'hand', 'feet', 'vibe', 'colour'];
/** (the battle pieces' slots) */
export type Slot = WearSlot;
export const SLOTS: Slot[] = ['hand', 'back', 'feet'];
export const SLOT_NAME: Record<WearSlot, string> = { head: 'Head', face: 'Face', neck: 'Neck', back: 'Back', hand: 'In hand', feet: 'Feet', vibe: 'Vibes', colour: 'Colour' };

/** A nudge from the Move it tool: x, y, z as a share of the buddy's height (x to the buddy's left, y up,
 *  z forward), s a size multiplier, r a turn in radians. */
export type Nudge = { x: number; y: number; z: number; s: number; r: number };
export const NO_NUDGE: Nudge = { x: 0, y: 0, z: 0, s: 1, r: 0 };
/** Everything a 3D buddy needs to get dressed: its hat, what's on each other slot, and the nudges. */
export type Dress = { hat: string; on: Partial<Record<WearSlot, string>>; nudge: Record<string, Nudge> };

export type ItemKind = 'bubble' | 'kite' | 'boombox' | 'cape' | 'wings' | 'rocketpack' | 'spring' | 'cloudstep' | 'zoom';
export type SetId = 'playground' | 'sky' | 'champion';
export type SetKind = 'playset' | 'skyset' | 'champset';
/** what a battle needs to know about the gear: the pieces' powers and any set bonus */
export type KitKind = ItemKind | SetKind;

export type GearItem = {
  id: string; slot: WearSlot; name: string; rarity: Rarity; kind: ItemKind; set: SetId;
  /** the power in plain words */
  text: string;
  /** shells in the Island Shop (null: only from a Champion) */
  price: number | null;
  /** the Champion that gives it */
  champion?: IslandId;
};

export const ITEMS: GearItem[] = [
  // the Playground set: the first things to save up for
  { id: 'bubble_wand', slot: 'hand', name: 'Bubble Wand', rarity: 'common', kind: 'bubble', set: 'playground', price: 90, text: 'Every 4th right answer blows a bubble that stops the next rain or zap. 2 shields a battle at most.' },
  { id: 'hero_cape', slot: 'back', name: 'Hero Cape', rarity: 'uncommon', kind: 'cape', set: 'playground', price: 150, text: 'Rain and zaps you don\'t block only take half as much energy.' },
  { id: 'spring_shoes', slot: 'feet', name: 'Spring Shoes', rarity: 'common', kind: 'spring', set: 'playground', price: 80, text: 'Bouncy! 4 more energy in every battle.' },
  // the Sky set
  { id: 'sky_kite', slot: 'hand', name: 'Sky Kite', rarity: 'rare', kind: 'kite', set: 'sky', price: 240, text: '3 right in a row? The kite catches the wind: 3 more cheer.' },
  { id: 'fairy_wings', slot: 'back', name: 'Fairy Wings', rarity: 'rare', kind: 'wings', set: 'sky', price: 260, text: 'Every battle starts with 2 Finale stars already filled.' },
  { id: 'cloud_slippers', slot: 'feet', name: 'Cloud Slippers', rarity: 'epic', kind: 'cloudstep', set: 'sky', price: 380, text: 'Every block in time gives you 2 energy back.' },
  // the Champion set: one piece from each island's Champion
  { id: 'boombox', slot: 'hand', name: 'Boombox', rarity: 'epic', kind: 'boombox', set: 'champion', price: null, champion: 'meadow', text: 'Turns up the music: your Finale is twice as strong.' },
  { id: 'rocket_pack', slot: 'back', name: 'Rocket Pack', rarity: 'legendary', kind: 'rocketpack', set: 'champion', price: null, champion: 'treetops', text: 'Fast right answers blast 2 more cheer.' },
  { id: 'rocket_sneakers', slot: 'feet', name: 'Rocket Sneakers', rarity: 'mythic', kind: 'zoom', set: 'champion', price: null, champion: 'bay', text: 'Fast right answers fill an extra Finale star.' },
];
export const ITEM: Record<string, GearItem> = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export const SETS: Record<SetId, { name: string; kind: SetKind; text: string }> = {
  playground: { name: 'Playground set', kind: 'playset', text: 'Every 5th right answer gives 3 energy back.' },
  sky: { name: 'Sky set', kind: 'skyset', text: 'A rain or zap in every battle floats right past you. 2 shields a battle at most.' },
  champion: { name: 'Champion set', kind: 'champset', text: 'Fast right answers give 1 energy back too.' },
};
export const SET_IDS = Object.keys(SETS) as SetId[];
export const setItems = (s: SetId) => ITEMS.filter(i => i.set === s);

/** How to get a piece, in a few words. */
export function howToGet(i: GearItem, islandName: (id: IslandId) => string = id => id): string {
  return i.price !== null ? `Island Shop: ${i.price} shells` : `Beat the ${islandName(i.champion!)} Champion`;
}

// ---------- the wardrobe: the player's things, each buddy's look ----------
export type BuddyLook = { on: Partial<Record<WearSlot, string>>; nudge?: Record<string, Nudge> };
export type Wardrobe = { owned: string[]; looks: Partial<Record<string, BuddyLook>> };
/** (old saves: each buddy kept its own gear; a 'shoes' slot) */
export type BuddyGear = { owned: string[]; on: Partial<Record<string, string>> };
const legacySlot = (s: string): WearSlot => (s === 'shoes' ? 'feet' : (s as WearSlot));

/** The wardrobe as saved, or as old saves had it (every buddy's pieces become the player's, and each
 *  buddy keeps what it was wearing). */
function fromLegacy(a: Adventure): Wardrobe {
  const owned = new Set<string>(), looks: Wardrobe['looks'] = {};
  for (const [buddy, g] of Object.entries(a.gear ?? {})) {
    if (!g) continue;
    for (const id of g.owned ?? []) owned.add(id);
    const on: BuddyLook['on'] = {};
    for (const [sl, id] of Object.entries(g.on ?? {})) if (id) on[legacySlot(sl)] = id;
    looks[buddy] = { on };
  }
  return { owned: [...owned], looks };
}
/** The player's wardrobe to read (nothing written). */
export function wardrobeView(a: Adventure): Wardrobe {
  return a.wardrobe ? { owned: a.wardrobe.owned ?? [], looks: a.wardrobe.looks ?? {} } : fromLegacy(a);
}
/** The player's wardrobe to change (call inside game.update, with advOf(p)). An old save moves over
 *  the first time: nothing a kid had is lost. */
export function wardrobeOf(a: Adventure): Wardrobe {
  a.wardrobe ??= fromLegacy(a);
  a.wardrobe.owned ??= []; a.wardrobe.looks ??= {};
  return a.wardrobe;
}
/** A buddy's look to change. */
export function lookOfBuddy(a: Adventure, buddy: string): BuddyLook {
  const w = wardrobeOf(a);
  const l = (w.looks[buddy] ??= { on: {} });
  l.on ??= {};
  return l;
}
/** What a buddy wears in the non-head slots, and its nudges (read only). */
export function lookView(a: Adventure, buddy: string): { on: Partial<Record<WearSlot, string>>; nudge: Record<string, Nudge> } {
  const w = wardrobeView(a), l = w.looks[buddy];
  const on: Partial<Record<WearSlot, string>> = {};
  for (const [sl, id] of Object.entries(l?.on ?? {})) if (id && sl !== 'head' && w.owned.includes(id)) on[sl as WearSlot] = id;
  return { on, nudge: { ...(l?.nudge ?? {}) } };
}
/** The player owns this thing (hats from friendship are checked in wardrobe.ts). */
export const ownsGear = (a: Adventure, _buddy: string, id: string) => wardrobeView(a).owned.includes(id);

/** (kept for the screens that ask about one buddy) the player's things, and what this buddy has on. */
export function gearView(a: Adventure, buddy: string): BuddyGear & { on: Partial<Record<WearSlot, string>> } {
  return { owned: wardrobeView(a).owned, on: lookView(a, buddy).on };
}

/** The battle sets a buddy is wearing all of. */
export function setsOn(g: { on: Partial<Record<WearSlot, string>> }): SetId[] {
  return SET_IDS.filter(s => setItems(s).every(i => g.on[i.slot] === i.id));
}
/** What a battle needs: the worn battle pieces' powers, then any set bonus. */
export function kitOf(a: Adventure, buddy: string): KitKind[] {
  const on = lookView(a, buddy).on;
  const kinds: KitKind[] = [];
  for (const s of SLOTS) { const id = on[s]; if (id && ITEM[id]) kinds.push(ITEM[id].kind); }
  for (const s of setsOn({ on })) kinds.push(SETS[s].kind);
  return kinds;
}
/** Just the battle pieces a buddy has on (what battles list and use). */
export function battleWornOf(a: Adventure, buddy: string): Partial<Record<WearSlot, string>> {
  const on = lookView(a, buddy).on, out: Partial<Record<WearSlot, string>> = {};
  for (const s of SLOTS) { const id = on[s]; if (id && ITEM[id]) out[s] = id; }
  return out;
}
/** The worn pieces' ids by slot (for the 3D model): every slot but the head. */
export function wornOf(a: Adventure, buddy: string): Partial<Record<WearSlot, string>> {
  return lookView(a, buddy).on;
}

/** Buy a thing with shells (it's the player's), and put it on this buddy. `price` and `slot` come from
 *  the catalog; a battle piece's are its own. */
export function buyGear(a: Adventure, buddy: string, id: string, item?: { price: number | null; slot: WearSlot }): { ok: boolean; why?: string } {
  const it = item ?? ITEM[id];
  if (!it) return { ok: false, why: 'Not in the shop.' };
  if (it.price === null) return { ok: false, why: 'Only a Champion gives this one.' };
  const w = wardrobeOf(a);
  if (w.owned.includes(id)) return { ok: false, why: 'You have it already.' };
  if (a.shells < it.price) return { ok: false, why: `You need ${it.price - a.shells} more shells.` };
  a.shells -= it.price;
  w.owned.push(id);
  if (it.slot !== 'head') lookOfBuddy(a, buddy).on[it.slot] = id;
  return { ok: true };
}
/** Put a thing on a buddy's slot (or take the slot's thing off with null). Not for the head (hats are
 *  setLook in profile.ts). `slot` is checked against the catalog by the caller for library things. */
export function wearGear(a: Adventure, buddy: string, slot: WearSlot, id: string | null, itemSlot?: WearSlot): boolean {
  if (slot === 'head') return false;
  const l = lookOfBuddy(a, buddy);
  if (id === null) { delete l.on[slot]; return true; }
  if (!wardrobeOf(a).owned.includes(id) || (itemSlot ?? ITEM[id]?.slot) !== slot) return false;
  l.on[slot] = id;
  return true;
}
/** Move it: save a nudge for one thing on one buddy (null puts it back where it was). */
export function setNudge(a: Adventure, buddy: string, id: string, n: Nudge | null) {
  const l = lookOfBuddy(a, buddy);
  l.nudge ??= {};
  if (!n || (n.x === 0 && n.y === 0 && n.z === 0 && n.s === 1 && n.r === 0)) delete l.nudge[id];
  else l.nudge[id] = { x: n.x, y: n.y, z: n.z, s: n.s, r: n.r };
}
/** A Champion beaten: its piece is the player's (if not already), and the buddy who beat it puts it on
 *  if that slot is free. */
export function championPrize(a: Adventure, buddy: string, island: IslandId): GearItem | null {
  const it = ITEMS.find(i => i.champion === island);
  if (!it) return null;
  const w = wardrobeOf(a);
  if (w.owned.includes(it.id)) return null;
  w.owned.push(it.id);
  const l = lookOfBuddy(a, buddy);
  if (!l.on[it.slot]) l.on[it.slot] = it.id;
  return it;
}

/** Gear that does something as a battle starts, for the badges then. */
export function startPerks(kit: KitKind[]): { item: string; what: string; did: string }[] {
  const out: { item: string; what: string; did: string }[] = [];
  if (kit.includes('spring')) out.push({ item: 'spring_shoes', what: 'Spring Shoes', did: '+4 energy' });
  if (kit.includes('wings')) out.push({ item: 'fairy_wings', what: 'Fairy Wings', did: '2 Finale stars' });
  if (kit.includes('skyset')) out.push({ item: 'sky_kite', what: 'Sky set', did: 'a rain floats past' });
  return out;
}
/** The item picture for a gear power named in a battle event. */
export function itemByName(name: string): GearItem | undefined { return ITEMS.find(i => i.name === name); }
