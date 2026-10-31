// The one Shop: everything shells buy, in one catalogue with three sections, one price each, and one way
// to buy it (Erik, 2026-10-30: "merge the shop"). A child learns one place where shells go.
//
// - Wear: what a buddy wears (outfits, colours and vibes: adventure/wardrobe.ts), tried on in the Shop and
//   bought there; worn, moved and sized in the Wardrobe.
// - Island: what goes on My Sky Island (homes, trees and flowers, water, paths, fun things, Glimmer homes,
//   dream things: island/catalog.ts) and the special paints for blocks (island/blocks.ts). The island's own
//   build tray is a window onto this section: the same things, the same prices, bought the same way.
// - Glimmers (its id stays `care`, as in saved "What I earned" lines): eggs, the Glimmer treat (a level for a
//   Glimmer) and island treats (to give Glimmers on the island). Everything here is for your Glimmers and
//   none of it is worn or put on the island, so it keeps its own section, named for who it's for.
//
// Nothing here is new in the save: each thing is kept where it always was (the wardrobe's owned list, the
// island's storage and paints, the nest, the island's treats), so an old save keeps everything it had.
// Every key is "section:id", and no id is in two sections (shop.test.ts checks).
import type { Profile } from '../engine/profile';
import { CATALOG, CAT, buyItem, ownsItem } from '../adventure/wardrobe';
import { SLOT_NAME, WEAR_SLOTS, type WearSlot } from '../adventure/gear';
import { GLIMMER, RARITY, type GlimmerId, type Rarity } from '../adventure/glimmers';
import { SHOP as CARE_SHOP, advOf, advView, buy as buyCare, teamOf } from '../adventure/state';
import type { FriendId } from '../art/cast';
import { ITEMS as ISLAND_ITEMS, KINDS, type ItemKind } from '../island/catalog';
import { PAINTS, SPECIAL } from '../island/blocks';
import { SNACKS, buySnacks } from '../island/play';
import { buy as buyIsland, islandOf, islandView, ownedOf, placedOf } from '../island/save';

export type Section = 'wear' | 'island' | 'care';
export const SECTIONS: { id: Section; name: string; line: string; pic: string }[] = [
  { id: 'wear', name: 'Wear', line: 'Outfits, colours and vibes for your buddy', pic: 'outfits/party_hat.webp' },
  { id: 'island', name: 'Island', line: 'Homes, trees and more for My Sky Island', pic: 'island/tile.webp' },
  { id: 'care', name: 'Glimmers', line: 'Eggs to hatch and treats to give', pic: 'game/egg-rare.webp' },
];

/** a shelf of a section: a wear slot, an island kind, special paints, eggs or treats */
export type Group = WearSlot | ItemKind | 'paint' | 'eggs' | 'treats';
export type ShopEntry = {
  /** "section:id": the one key for the whole Shop */
  key: string;
  section: Section;
  /** the thing's own id where the save keeps it (a wardrobe id, an island item, a paint's number, an egg) */
  id: string;
  name: string;
  /** shells (null: not sold: a friendship gift or a Champion's prize) */
  price: number | null;
  group: Group;
  /** a few words for its card */
  blurb: string;
  /** a picture in public/ (wear and care); island things and paints are drawn in 3D (their thumb id) */
  pic?: string;
  thumb?: string;
  /** one of the few big things worth saving up for */
  dream?: boolean;
  /** an egg: the rarity of Glimmer it hatches */
  egg?: Rarity;
};

export const GROUP_NAME: Record<Group, string> = {
  ...SLOT_NAME,
  ...Object.fromEntries(KINDS.map(k => [k.id, k.name])) as Record<ItemKind, string>,
  gift: 'Gifts', paint: 'Special paints', eggs: 'Eggs', treats: 'Treats',
};

const wear: ShopEntry[] = CATALOG.map(c => ({
  key: `wear:${c.id}`, section: 'wear', id: c.id, name: c.name, price: c.how === 'shop' ? c.price : null, group: c.slot, blurb: c.text, pic: c.icon,
}));
const island: ShopEntry[] = [
  ...ISLAND_ITEMS.filter(i => !i.gift).map((i): ShopEntry => ({
    key: `island:${i.id}`, section: 'island', id: i.id, name: i.name, price: i.price, group: i.kind, blurb: i.blurb, thumb: i.id, dream: i.dream,
  })),
  ...SPECIAL.map((pd): ShopEntry => ({
    key: `paint:${pd.id}`, section: 'island', id: String(pd.id), name: `${pd.name} blocks`, price: pd.special!.price, group: 'paint',
    blurb: `Build with ${pd.name.toLowerCase()} blocks as much as you like.`, thumb: `block:cube:${pd.id}`,
  })),
];
const care: ShopEntry[] = [
  ...CARE_SHOP.map((s): ShopEntry => ({
    key: `care:${s.id}`, section: 'care', id: s.id, name: s.name, price: s.price, group: s.egg ? 'eggs' : 'treats', blurb: s.text,
    pic: s.egg ? `game/egg-${s.egg}.webp` : 'game/icon-star.webp', egg: s.egg,
  })),
  { key: 'care:island-treats', section: 'care', id: 'island-treats', name: 'Island treats', price: SNACKS.price, group: 'treats',
    blurb: `${SNACKS.n} treats to give your Glimmers on My Sky Island.`, pic: 'island/treat.webp' },
];

/** Everything in the Shop, section by section. */
export const SHOP_LIST: ShopEntry[] = [...wear, ...island, ...care];
export const SHOP_ENTRY: Record<string, ShopEntry> = Object.fromEntries(SHOP_LIST.map(e => [e.key, e]));
/** one section's things (in catalogue order) */
export const sectionOf = (s: Section) => SHOP_LIST.filter(e => e.section === s);
/** a section's shelves, in order (only those with something on them) */
export function groupsOf(s: Section): Group[] {
  const order: Group[] = s === 'wear' ? [...WEAR_SLOTS] : s === 'island' ? [...KINDS.map(k => k.id), 'paint'] : ['eggs', 'treats'];
  return order.filter(g => SHOP_LIST.some(e => e.section === s && e.group === g));
}
/** The island's build tray: the Island section's things of one kind (the very same entries). */
export const islandShelf = (kind: ItemKind) => SHOP_LIST.filter(e => e.section === 'island' && e.group === kind);
/** The Shop's entry for an island thing or a special paint (the tray buys through these). */
export const islandEntry = (id: string) => SHOP_ENTRY[`island:${id}`];
export const paintEntry = (id: number) => SHOP_ENTRY[`paint:${id}`];

/** Plain eggs of a rarity the player has: warming in the three warm nests, and waiting their turn. */
export function eggsHeld(p: Profile, rarity: Rarity) {
  const a = advView(p), plain = (e: { rarity: Rarity; kind?: unknown } | null) => !!e && e.rarity === rarity && !e.kind;
  return { warm: a.incubator.filter(plain).length, waiting: a.nest.filter(plain).length };
}
/** How many the player has: an outfit or a paint 1 or 0, island things all of them (on the island and in
 *  storage), island treats the bag, eggs those warming and waiting; the Glimmer treat is used up at once (0). */
export function haveOf(p: Profile, key: string): number {
  const e = SHOP_ENTRY[key];
  if (!e) return 0;
  if (e.section === 'wear') return ownsItem(p, e.id) ? 1 : 0;
  if (e.group === 'paint') return islandView(p).mats.includes(Number(e.id)) ? 1 : 0;
  if (e.section === 'island') return ownedOf(islandView(p), e.id);
  if (e.id === 'island-treats') return islandView(p).treats;
  if (e.egg) { const h = eggsHeld(p, e.egg); return h.warm + h.waiting; }
  return 0;
}
/** Island things on the island now (the rest are in storage). */
export const onIslandOf = (p: Profile, key: string) => { const e = SHOP_ENTRY[key]; return e?.section === 'island' && e.group !== 'paint' ? placedOf(islandView(p), e.id) : 0; };
/** Can it be bought again once you have it? (island things, eggs and treats: yes; outfits and paints: once) */
export const many = (e: ShopEntry) => e.section !== 'wear' && e.group !== 'paint';

/** For a thing in the Glimmers section, in a child's words: what you get, and what happens with it (`who`:
 *  the first Glimmer on the team). */
export function careText(e: ShopEntry, who: GlimmerId | null): { gets: string; then: string; line: string } {
  if (e.egg) {
    const gets = `Hatches ${e.egg === 'uncommon' ? 'an' : 'a'} ${RARITY[e.egg].name} Glimmer`, then = `after ${RARITY[e.egg].hatch} right answers in practice`;
    return { gets, then, line: `${gets} ${then}.` };
  }
  const gets = e.id === 'treat' ? 'A Glimmer goes up one level' : `${SNACKS.n} treats for My Sky Island`;
  const then = e.id === 'treat' ? (who ? `For ${GLIMMER[who].name}, first on your team` : 'Meet a Glimmer in Adventure first') : 'Feed a Glimmer there to make friends';
  return { gets, then, line: `${gets}. ${then}.` };
}
/** Where a thing in the Glimmers section goes, and how many you have there. */
export function careHave(p: Profile, e: ShopEntry): string {
  if (e.egg) {
    const { warm, waiting } = eggsHeld(p, e.egg), n = warm + waiting;
    if (!n) return 'It goes in a warm nest and hatches as you practise.';
    return `You have ${n}: ${warm} in a warm nest, ${waiting} waiting.`;
  }
  if (e.id === 'treat') return 'Eaten straight away, so there are none to keep.';
  const n = haveOf(p, e.key);
  return n ? `You have ${n} in your treat bag on My Sky Island.` : 'They go in your treat bag on My Sky Island.';
}

export type Bought = { ok: boolean; why?: string; where?: string };
/** Buy it (inside game.update): the one way the Shop and the island's tray spend shells. `buddy` wears a new
 *  outfit; the Glimmer treat goes to the first Glimmer on the team. Island things go to storage. */
export function buyShop(p: Profile, key: string, o: { buddy?: FriendId } = {}): Bought {
  const e = SHOP_ENTRY[key];
  if (!e || e.price === null) return { ok: false, why: 'That isn\'t for sale.' };
  if (advView(p).shells < e.price) return { ok: false, why: `You need ${e.price - advView(p).shells} more shells.` };
  if (e.section === 'wear') return buyItem(p, o.buddy ?? p.buddy, e.id);
  if (e.group === 'paint') {
    const s = islandOf(p), n = Number(e.id);
    if (s.mats.includes(n)) return { ok: false, why: 'You have these already.' };
    advOf(p).shells -= e.price;
    s.mats = [...new Set([...s.mats, n])];
    return { ok: true };
  }
  if (e.section === 'island') { const r = buyIsland(p, e.id); return r.ok ? { ok: true } : { ok: false, why: r.why }; }
  if (e.id === 'island-treats') return buySnacks(p);
  return buyCare(p, e.id, e.id === 'treat' ? teamOf(advOf(p))[0]?.id : undefined);
}

/** The colour of a wear thing's rarity (for its card's edge). */
export const rarityColour = (e: ShopEntry) => (e.section === 'wear' ? RARITY[CAT[e.id]?.rarity ?? 'common'].color : null);
/** a special paint's colour (for its swatch) */
export const paintColour = (e: ShopEntry) => (e.group === 'paint' ? PAINTS[Number(e.id)]?.color ?? 0xffffff : null);
