// Gear: three more things a buddy can wear beside its outfit (the hat): something in hand, something on
// the back and shoes. Each piece helps in Adventure battles, and wearing all three pieces of a set gives a
// set bonus too. Pieces come from the Island Shop (shells) or, for the rarest, from beating a Champion.
// Every buddy keeps its own gear, as it keeps its own outfits and friendship.
import type { Rarity } from './glimmers';
import type { Adventure, IslandId } from './state';

export type Slot = 'hand' | 'back' | 'shoes';
export const SLOTS: Slot[] = ['hand', 'back', 'shoes'];
export const SLOT_NAME: Record<Slot | 'hat', string> = { hat: 'Hat', hand: 'In hand', back: 'On the back', shoes: 'Shoes' };

export type ItemKind = 'bubble' | 'kite' | 'boombox' | 'cape' | 'wings' | 'rocketpack' | 'spring' | 'cloudstep' | 'zoom';
export type SetId = 'playground' | 'sky' | 'champion';
export type SetKind = 'playset' | 'skyset' | 'champset';
/** what a battle needs to know about the gear: the pieces' powers and any set bonus */
export type KitKind = ItemKind | SetKind;

export type GearItem = {
  id: string; slot: Slot; name: string; rarity: Rarity; kind: ItemKind; set: SetId;
  /** the power in plain words */
  text: string;
  /** shells in the Island Shop (null: only from a Champion) */
  price: number | null;
  /** the Champion that gives it */
  champion?: IslandId;
};

export const ITEMS: GearItem[] = [
  // the Playground set: the first things to save up for
  { id: 'bubble_wand', slot: 'hand', name: 'Bubble Wand', rarity: 'common', kind: 'bubble', set: 'playground', price: 90, text: 'Every 4th right answer blows a bubble that stops the next rain or zap.' },
  { id: 'hero_cape', slot: 'back', name: 'Hero Cape', rarity: 'uncommon', kind: 'cape', set: 'playground', price: 150, text: 'Rain and zaps you don\'t block only take half as much energy.' },
  { id: 'spring_shoes', slot: 'shoes', name: 'Spring Shoes', rarity: 'common', kind: 'spring', set: 'playground', price: 80, text: 'Bouncy! 4 more energy in every battle.' },
  // the Sky set
  { id: 'sky_kite', slot: 'hand', name: 'Sky Kite', rarity: 'rare', kind: 'kite', set: 'sky', price: 240, text: '3 right in a row? The kite catches the wind: 3 more cheer.' },
  { id: 'fairy_wings', slot: 'back', name: 'Fairy Wings', rarity: 'rare', kind: 'wings', set: 'sky', price: 260, text: 'Every battle starts with 2 Finale stars already filled.' },
  { id: 'cloud_slippers', slot: 'shoes', name: 'Cloud Slippers', rarity: 'epic', kind: 'cloudstep', set: 'sky', price: 380, text: 'Every block in time gives you 2 energy back.' },
  // the Champion set: one piece from each island's Champion
  { id: 'boombox', slot: 'hand', name: 'Boombox', rarity: 'epic', kind: 'boombox', set: 'champion', price: null, champion: 'meadow', text: 'Turns up the music: your Finale is twice as strong.' },
  { id: 'rocket_pack', slot: 'back', name: 'Rocket Pack', rarity: 'legendary', kind: 'rocketpack', set: 'champion', price: null, champion: 'treetops', text: 'Fast right answers blast 2 more cheer.' },
  { id: 'rocket_sneakers', slot: 'shoes', name: 'Rocket Sneakers', rarity: 'mythic', kind: 'zoom', set: 'champion', price: null, champion: 'bay', text: 'Fast right answers fill an extra Finale star.' },
];
export const ITEM: Record<string, GearItem> = Object.fromEntries(ITEMS.map(i => [i.id, i]));

export const SETS: Record<SetId, { name: string; kind: SetKind; text: string }> = {
  playground: { name: 'Playground set', kind: 'playset', text: 'Every 5th right answer gives 3 energy back.' },
  sky: { name: 'Sky set', kind: 'skyset', text: 'The first rain or zap in a battle floats right past you.' },
  champion: { name: 'Champion set', kind: 'champset', text: 'Fast right answers give 1 energy back too.' },
};
export const SET_IDS = Object.keys(SETS) as SetId[];
export const setItems = (s: SetId) => ITEMS.filter(i => i.set === s);

/** How to get a piece, in a few words. */
export function howToGet(i: GearItem, islandName: (id: IslandId) => string = id => id): string {
  return i.price !== null ? `Island Shop: ${i.price} shells` : `Beat the ${islandName(i.champion!)} Champion`;
}

// ---------- each buddy's gear ----------
export type BuddyGear = { owned: string[]; on: Partial<Record<Slot, string>> };
const empty = (): BuddyGear => ({ owned: [], on: {} });

/** A buddy's gear to read (nothing written). */
export function gearView(a: Adventure, buddy: string): BuddyGear {
  const g = a.gear?.[buddy];
  return g ? { owned: g.owned ?? [], on: g.on ?? {} } : empty();
}
/** A buddy's gear to change (filled in). Call inside game.update, with advOf(p). */
export function gearOf(a: Adventure, buddy: string): BuddyGear {
  a.gear ??= {};
  const g = (a.gear[buddy] ??= empty());
  g.owned ??= []; g.on ??= {};
  return g;
}
export const ownsGear = (a: Adventure, buddy: string, id: string) => gearView(a, buddy).owned.includes(id);

/** The sets a buddy is wearing all of. */
export function setsOn(g: BuddyGear): SetId[] {
  return SET_IDS.filter(s => setItems(s).every(i => g.on[i.slot] === i.id));
}
/** What a battle needs: the worn pieces' powers, then any set bonus. */
export function kitOf(a: Adventure, buddy: string): KitKind[] {
  const g = gearView(a, buddy);
  const kinds: KitKind[] = [];
  for (const s of SLOTS) { const id = g.on[s]; if (id && ITEM[id] && g.owned.includes(id)) kinds.push(ITEM[id].kind); }
  for (const s of setsOn(g)) kinds.push(SETS[s].kind);
  return kinds;
}
/** The worn pieces' ids by slot (for the 3D model). */
export function wornOf(a: Adventure, buddy: string): Partial<Record<Slot, string>> {
  const g = gearView(a, buddy), out: Partial<Record<Slot, string>> = {};
  for (const s of SLOTS) { const id = g.on[s]; if (id && g.owned.includes(id)) out[s] = id; }
  return out;
}

/** Buy a piece for a buddy with shells, and put it on. */
export function buyGear(a: Adventure, buddy: string, id: string): { ok: boolean; why?: string } {
  const it = ITEM[id];
  if (!it) return { ok: false, why: 'Not in the shop.' };
  if (it.price === null) return { ok: false, why: 'Only a Champion gives this one.' };
  const g = gearOf(a, buddy);
  if (g.owned.includes(id)) return { ok: false, why: 'You have it already.' };
  if (a.shells < it.price) return { ok: false, why: `You need ${it.price - a.shells} more shells.` };
  a.shells -= it.price;
  g.owned.push(id);
  g.on[it.slot] = id;
  return { ok: true };
}
/** Put a piece on (or take the slot's piece off with null). */
export function wearGear(a: Adventure, buddy: string, slot: Slot, id: string | null): boolean {
  const g = gearOf(a, buddy);
  if (id === null) { delete g.on[slot]; return true; }
  if (!g.owned.includes(id) || ITEM[id]?.slot !== slot) return false;
  g.on[slot] = id;
  return true;
}
/** A Champion beaten: its piece goes to the buddy who beat it (if that buddy doesn't have it yet). */
export function championPrize(a: Adventure, buddy: string, island: IslandId): GearItem | null {
  const it = ITEMS.find(i => i.champion === island);
  if (!it) return null;
  const g = gearOf(a, buddy);
  if (g.owned.includes(it.id)) return null;
  g.owned.push(it.id);
  if (!g.on[it.slot]) g.on[it.slot] = it.id;
  return it;
}

/** Gear that does something as a battle starts, for the badges then. */
export function startPerks(kit: KitKind[]): { item: string; what: string; did: string }[] {
  const out: { item: string; what: string; did: string }[] = [];
  if (kit.includes('spring')) out.push({ item: 'spring_shoes', what: 'Spring Shoes', did: '+4 energy' });
  if (kit.includes('wings')) out.push({ item: 'fairy_wings', what: 'Fairy Wings', did: '2 Finale stars' });
  if (kit.includes('skyset')) out.push({ item: 'sky_kite', what: 'Sky set', did: 'first rain floats past' });
  return out;
}
/** The item picture for a gear power named in a battle event. */
export function itemByName(name: string): GearItem | undefined { return ITEMS.find(i => i.name === name); }
