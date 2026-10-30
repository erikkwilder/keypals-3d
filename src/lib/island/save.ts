// My Sky Island on the player's save (profile.island): what they own and where it stands on the island,
// which of their Glimmers live there, the visitors who came and the gifts they left, and the hearts family
// left when they looked round. Everything here is plain logic on the save (screens/SkyIsland.svelte and
// three/islandScene.ts show it), so it's tested in island.test.ts.
//
// - Buying spends shells (the adventure's, the game's one currency) and puts the thing in storage; placing
//   takes it out onto the island's grid. Turning, moving and putting back cost nothing.
// - Visitors only come because of what's built: each placed thing that invites Glimmers (catalog.ts
//   `invites`, most of all the habitats) adds to its element's pull, and a visitor is a Glimmer of one of
//   those elements. Now and then it's one the child hasn't met: a peek, with where to find it (the ladder's
//   own words for goal Glimmers); a visit never gives the Glimmer. A Glimmer whose 3D model isn't made yet
//   (pending) never visits.
// - Gifts are small: a postcard the first time a Glimmer visits, then a crystal of its element or a few
//   shells, never more than GIFT_SHELLS_DAY shells a day, and at most VISITS_A_DAY visitors a day, so the
//   island never turns into a way of farming shells.
// - The island grows with the Glimmers met (the collection goals of the 100-Glimmer ladder: 25, 50, 75 and
//   90 met), so the long goals have a home you can see.
// - Family on the same computer (or in the same grown-up's account, whose players all come to this
//   computer) can look round each other's islands, read only, and leave a heart once a day.
import { dayKey, type Profile } from '../engine/profile';
import { mulberry32, type Rng } from '../engine/rng';
import { ELEMENTS, GLIMMER, ALL_GLIMMERS, type Element, type GlimmerId, type Rarity } from '../adventure/glimmers';
import { advOf, advView, ISLAND } from '../adventure/state';
import { ctxOf, standing } from '../adventure/ladder';
import type { FriendId } from '../art/cast';
import { GIFT_OF, ITEM, type ItemDef } from './catalog';

// ---------- the save ----------
export type Rot = 0 | 1 | 2 | 3;
/** a thing on the island: `x`, `z` are the square of its corner nearest the middle-back (the smallest
 *  x and z it covers); `at` when it was last put or moved there (the newer move wins when two computers
 *  both moved it) */
export type Placed = { item: string; x: number; z: number; rot: Rot; at: number };
export type Gift = { kind: 'postcard' } | { kind: 'deco'; item: string } | { kind: 'shells'; n: number };
/** a visitor: who, when, what it left, and whether the child had met it then */
export type Visit = { id: GlimmerId; at: number; gift: Gift; met: boolean };
/** a heart left by family who looked round */
export type Heart = { from: string; name: string; buddy: FriendId; at: number };
export type IslandSave = {
  /** things bought or given, by item (the starter kit is counted separately: STARTER) */
  owned: Record<string, number>;
  /** what's on the island, by its own id */
  placed: Record<string, Placed>;
  /** the Glimmers living on the island (null: not picked yet, the best ones go) */
  out: GlimmerId[] | null;
  visits: Visit[];
  /** the postcards visitors brought (one from each Glimmer, the first time it visits) */
  postcards: GlimmerId[];
  /** shells visitors gave today */
  shells: { day: string; n: number };
  hearts: Heart[];
  /** the newest heart the owner has seen */
  seenHearts: number;
  /** the starter kit is in (a cottage, a tree, a path and two bushes, so the island is never bare) */
  started: boolean;
  /** the growth stage the child has seen (a bigger one is a moment) */
  grown: number;
};

export const MAX_OUT = 8;
/** time between visitors, and the most visitors a day */
export const VISIT_GAP = 3 * 3600_000, VISITS_A_DAY = 3;
/** how long a visitor stays on the island */
export const STAY = 25 * 60_000;
/** the most shells visitors give in a day, and in one gift */
export const GIFT_SHELLS_DAY = 5, GIFT_SHELLS_MAX = 3;
/** how often a visitor is one the child hasn't met (if one of the invited kind is left to meet) */
export const UNMET_CHANCE = 0.35;
const RARE_PULL: Record<Rarity, number> = { common: 6, uncommon: 4, rare: 2.5, epic: 1.2, legendary: 0.5, mythic: 0.2 };
const VISITS_KEEP = 60, HEARTS_KEEP = 30;

/** The island grows as Glimmers are met: its radius in squares at each stage. 25, 50, 75 and 90 met are
 *  the ladder's collection goals (ladder.ts MEET_STEPS). */
export const GROWTH: { met: number; r: number }[] = [
  { met: 0, r: 5 }, { met: 3, r: 6 }, { met: 8, r: 7 }, { met: 15, r: 8 }, { met: 25, r: 9 }, { met: 50, r: 10 }, { met: 75, r: 11 }, { met: 90, r: 12 },
];

/** The starter kit, and where it stands on a new island. */
export const STARTER: Record<string, number> = { cottage: 1, oak: 1, stones: 4, bush: 2 };
const STARTER_PLACED: Record<string, Omit<Placed, 'at'>> = {
  's-cottage': { item: 'cottage', x: -1, z: -4, rot: 0 },
  's-oak': { item: 'oak', x: -3, z: -3, rot: 0 },
  's-st0': { item: 'stones', x: 0, z: -1, rot: 0 }, 's-st1': { item: 'stones', x: 0, z: 0, rot: 1 },
  's-st2': { item: 'stones', x: 0, z: 1, rot: 2 }, 's-st3': { item: 'stones', x: 0, z: 2, rot: 3 },
  's-bush0': { item: 'bush', x: -3, z: 1, rot: 0 }, 's-bush1': { item: 'bush', x: 3, z: -1, rot: 1 },
};

const empty = (): IslandSave => ({ owned: {}, placed: {}, out: null, visits: [], postcards: [], shells: { day: '', n: 0 }, hearts: [], seenHearts: 0, started: false, grown: 0 });
function fill(s: Partial<IslandSave>): IslandSave {
  const d = empty();
  for (const k of Object.keys(d) as (keyof IslandSave)[]) if (s[k] === undefined) (s as Record<string, unknown>)[k] = d[k];
  return s as IslandSave;
}
function start(s: IslandSave, now: number) {
  if (s.started) return;
  for (const [uid, pl] of Object.entries(STARTER_PLACED)) s.placed[uid] ??= { ...pl, at: now };
  s.started = true;
}
/** The island to change (inside game.update): filled in, the starter kit placed the first time. */
export function islandOf(p: Profile, now = Date.now()): IslandSave {
  const s = fill((p.island ??= empty()));
  start(s, now);
  return s;
}
/** The island to look at (nothing written): someone else's too, as it would look. */
export function islandView(p: Profile): IslandSave {
  // (a plain copy: a screen's save is a live proxy, which structuredClone can't copy)
  const s = fill(JSON.parse(JSON.stringify(p.island ?? empty())) as IslandSave);
  start(s, 0);
  return s;
}

// ---------- owning and placing ----------
export const ownedOf = (s: IslandSave, id: string) => (s.owned[id] ?? 0) + (s.started ? STARTER[id] ?? 0 : 0);
export const placedOf = (s: IslandSave, id: string) => Object.values(s.placed).filter(pl => pl.item === id).length;
/** how many are in storage (owned, not on the island) */
export const storedOf = (s: IslandSave, id: string) => Math.max(0, ownedOf(s, id) - placedOf(s, id));
/** everything in storage */
export function storage(s: IslandSave): { item: ItemDef; n: number }[] {
  const ids = new Set([...Object.keys(s.owned), ...(s.started ? Object.keys(STARTER) : [])]);
  return [...ids].filter(id => ITEM[id] && storedOf(s, id) > 0).map(id => ({ item: ITEM[id], n: storedOf(s, id) }));
}
/** the squares a thing covers, turned: width along x, depth along z */
export function footprint(item: ItemDef, rot: Rot) { return rot % 2 ? { w: item.d, d: item.w } : { w: item.w, d: item.d }; }
export function cellsOf(item: ItemDef, x: number, z: number, rot: Rot): [number, number][] {
  const f = footprint(item, rot), out: [number, number][] = [];
  for (let i = 0; i < f.w; i++) for (let j = 0; j < f.d; j++) out.push([x + i, z + j]);
  return out;
}
/** where a thing's middle is, in squares (a 2 by 2 thing's middle is on the corner between its squares) */
export function centerOf(item: ItemDef, x: number, z: number, rot: Rot) { const f = footprint(item, rot); return { x: x + (f.w - 1) / 2, z: z + (f.d - 1) / 2 }; }
/** is a square on the island (the island is round, `r` squares from the middle) */
export const onIsland = (i: number, j: number, r: number) => Math.hypot(i, j) <= r - 0.5;
/** the squares taken, but for one thing (the one being moved) */
export function taken(s: IslandSave, but?: string): Set<string> {
  const out = new Set<string>();
  for (const [uid, pl] of Object.entries(s.placed)) { if (uid === but || !ITEM[pl.item]) continue; for (const [i, j] of cellsOf(ITEM[pl.item], pl.x, pl.z, pl.rot)) out.add(`${i},${j}`); }
  return out;
}
/** Can a thing go here: all its squares on the island and free? */
export function fits(s: IslandSave, r: number, item: ItemDef, x: number, z: number, rot: Rot, but?: string): boolean {
  const t = taken(s, but);
  return cellsOf(item, x, z, rot).every(([i, j]) => onIsland(i, j, r) && !t.has(`${i},${j}`));
}
/** The free spot nearest a square (for a new thing's first place), or null if it fits nowhere. */
export function freeSpot(s: IslandSave, r: number, item: ItemDef, rot: Rot, near = { x: 0, z: 0 }, but?: string): { x: number; z: number } | null {
  const f = footprint(item, rot), R = Math.ceil(r);
  let best: { x: number; z: number } | null = null, bd = Infinity;
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x + (f.w - 1) / 2 - near.x, z + (f.d - 1) / 2 - near.z);
    if (d < bd && fits(s, r, item, x, z, rot, but)) { bd = d; best = { x, z }; }
  }
  return best;
}

export type Result = { ok: true; uid?: string } | { ok: false; why: string };
/** Buy one (into storage). Inside game.update. */
export function buy(p: Profile, id: string): Result {
  const item = ITEM[id];
  if (!item || item.gift) return { ok: false, why: 'That isn\'t for sale.' };
  const a = advOf(p);
  if (a.shells < item.price) return { ok: false, why: `You need ${item.price - a.shells} more shells.` };
  const s = islandOf(p);
  a.shells -= item.price;
  s.owned[id] = (s.owned[id] ?? 0) + 1;
  return { ok: true };
}
let uidN = 0;
const newUid = (now: number) => `${now.toString(36)}${(uidN++ % 1296).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
/** Put one from storage on the island. */
export function place(p: Profile, id: string, x: number, z: number, rot: Rot, now = Date.now()): Result {
  const s = islandOf(p, now), item = ITEM[id];
  if (!item) return { ok: false, why: 'Not a thing you can place.' };
  if (storedOf(s, id) < 1) return { ok: false, why: 'You don\'t have one in storage.' };
  if (!fits(s, growthOf(p).r, item, x, z, rot)) return { ok: false, why: 'It doesn\'t fit there.' };
  const uid = newUid(now);
  s.placed[uid] = { item: id, x, z, rot, at: now };
  return { ok: true, uid };
}
/** Buy one if there's none in storage, and place it (nothing is spent if it doesn't fit). */
export function buyAndPlace(p: Profile, id: string, x: number, z: number, rot: Rot, now = Date.now()): Result {
  const s = islandOf(p, now), item = ITEM[id];
  if (!item) return { ok: false, why: 'Not a thing you can place.' };
  if (!fits(s, growthOf(p).r, item, x, z, rot)) return { ok: false, why: 'It doesn\'t fit there.' };
  if (storedOf(s, id) < 1) { const b = buy(p, id); if (!b.ok) return b; }
  return place(p, id, x, z, rot, now);
}
/** Move or turn something on the island. */
export function move(p: Profile, uid: string, x: number, z: number, rot: Rot, now = Date.now()): Result {
  const s = islandOf(p, now), pl = s.placed[uid];
  if (!pl) return { ok: false, why: 'It isn\'t on the island.' };
  if (!fits(s, growthOf(p).r, ITEM[pl.item], x, z, rot, uid)) return { ok: false, why: 'It doesn\'t fit there.' };
  s.placed[uid] = { ...pl, x, z, rot, at: now };
  return { ok: true, uid };
}
/** Put something back in storage. */
export function putAway(p: Profile, uid: string): Result {
  const s = islandOf(p);
  if (!s.placed[uid]) return { ok: false, why: 'It isn\'t on the island.' };
  delete s.placed[uid];
  return { ok: true };
}

// ---------- growing ----------
export function metOf(p: Profile): number { const a = advView(p); return (Object.keys(a.glimmers) as GlimmerId[]).filter(id => a.glimmers[id] && GLIMMER[id]).length; }
export function stageOf(met: number): number { let st = 0; GROWTH.forEach((g, i) => { if (met >= g.met) st = i; }); return st; }
/** How big the island is now, and what makes it grow next. */
export function growthOf(p: Profile) {
  const met = metOf(p), stage = stageOf(met), next = GROWTH[stage + 1] ?? null;
  return { met, stage, r: GROWTH[stage].r, next };
}

// ---------- the Glimmers who live there ----------
/** The Glimmers out on the island: the ones picked, or (not picked yet) the team and then the highest
 *  levels, up to MAX_OUT. */
export function outOf(p: Profile): GlimmerId[] {
  const a = advView(p), s = p.island;
  const owned = (Object.keys(a.glimmers) as GlimmerId[]).filter(id => a.glimmers[id] && GLIMMER[id] && !GLIMMER[id].pending);
  if (s?.out) return s.out.filter(id => owned.includes(id)).slice(0, MAX_OUT);
  const team = a.team.filter((t): t is GlimmerId => !!t && owned.includes(t));
  const rest = owned.filter(id => !team.includes(id)).sort((x, y) => (a.glimmers[y]!.level - a.glimmers[x]!.level) || (a.glimmers[x]!.got - a.glimmers[y]!.got));
  return [...team, ...rest].slice(0, MAX_OUT);
}
export function setOut(p: Profile, ids: GlimmerId[]) { islandOf(p).out = [...new Set(ids)].slice(0, MAX_OUT); }

// ---------- visitors ----------
/** How strongly what's on the island calls each element's Glimmers. */
export function invitesOf(s: IslandSave): Record<Element, number> {
  const out = { sun: 0, frost: 0, tide: 0, stone: 0, leaf: 0 } as Record<Element, number>;
  for (const pl of Object.values(s.placed)) for (const [el, n] of Object.entries(ITEM[pl.item]?.invites ?? {})) out[el as Element] += n ?? 0;
  return out;
}
export const visitsOn = (s: IslandSave, day: string) => s.visits.filter(v => dayKey(v.at) === day);
export const lastVisit = (s: IslandSave): Visit | null => s.visits.reduce<Visit | null>((b, v) => (!b || v.at > b.at ? v : b), null);
/** Is a visitor due: something on the island invites one, not too soon after the last, not too many today. */
export function visitDue(s: IslandSave, now: number): boolean {
  const inv = invitesOf(s);
  if (!ELEMENTS.some(e => inv[e] > 0)) return false;
  if (visitsOn(s, dayKey(now)).length >= VISITS_A_DAY) return false;
  const last = lastVisit(s);
  return !last || now - last.at >= VISIT_GAP;
}
/** Who can visit: Glimmers with a 3D model, of an invited element, not living on the island. */
export function visitorPool(p: Profile, s: IslandSave): GlimmerId[] {
  const inv = invitesOf(s), out = new Set(outOf(p));
  return ALL_GLIMMERS.filter(g => !g.pending && inv[g.element] > 0 && !out.has(g.id)).map(g => g.id);
}
/** Pick a visitor: an element by how strongly it's invited, then (now and then) one not met yet, rarer
 *  ones less often. Read only. */
export function pickVisitor(p: Profile, s: IslandSave, rnd: Rng): GlimmerId | null {
  const pool = visitorPool(p, s);
  if (!pool.length) return null;
  const inv = invitesOf(s), a = advView(p), last = lastVisit(s)?.id;
  const els = ELEMENTS.filter(e => pool.some(id => GLIMMER[id].element === e));
  const el = weighted(els, e => inv[e], rnd);
  let of = pool.filter(id => GLIMMER[id].element === el);
  if (of.length > 1 && last) of = of.filter(id => id !== last);
  const unmet = of.filter(id => !a.glimmers[id]), met = of.filter(id => a.glimmers[id]);
  const group = unmet.length && (!met.length || rnd() < UNMET_CHANCE) ? unmet : met.length ? met : unmet;
  return weighted(group, id => RARE_PULL[GLIMMER[id].rarity], rnd);
}
function weighted<T>(xs: T[], w: (x: T) => number, rnd: Rng): T {
  const total = xs.reduce((t, x) => t + Math.max(0, w(x)), 0);
  let r = rnd() * total;
  for (const x of xs) { r -= Math.max(0, w(x)); if (r <= 0) return x; }
  return xs[xs.length - 1];
}
/** A visitor arrives if one is due (inside game.update): its gift goes into the save. Null: nobody. */
export function checkVisitor(p: Profile, now = Date.now(), rnd: Rng = mulberry32(now % 2147483647)): Visit | null {
  const s = islandOf(p, now);
  if (!visitDue(s, now)) return null;
  const id = pickVisitor(p, s, rnd);
  if (!id) return null;
  const v: Visit = { id, at: now, gift: giftFrom(p, s, id, now, rnd), met: !!advView(p).glimmers[id] };
  s.visits = [...s.visits, v].slice(-VISITS_KEEP);
  return v;
}
/** What a visitor leaves (and it goes into the save): its postcard the first time, then a crystal of its
 *  element or a few shells (never past the day's few). */
function giftFrom(p: Profile, s: IslandSave, id: GlimmerId, now: number, rnd: Rng): Gift {
  if (!s.postcards.includes(id)) { s.postcards = [...s.postcards, id]; return { kind: 'postcard' }; }
  const day = dayKey(now);
  if (s.shells.day !== day) s.shells = { day, n: 0 };
  const room = GIFT_SHELLS_DAY - s.shells.n;
  if (rnd() < 0.4 && room > 0) {
    const n = Math.min(room, 1 + Math.floor(rnd() * GIFT_SHELLS_MAX));
    s.shells.n += n;
    advOf(p).shells += n;
    return { kind: 'shells', n };
  }
  const item = GIFT_OF[GLIMMER[id].element];
  s.owned[item] = (s.owned[item] ?? 0) + 1;
  return { kind: 'deco', item };
}
/** The visitor on the island now (it stays a while), or null. */
export function visitorNow(s: IslandSave, now = Date.now()): Visit | null {
  const v = lastVisit(s);
  return v && now - v.at < STAY && now >= v.at ? v : null;
}
/** Where to meet a Glimmer the child hasn't met: its island ("Meet it in Cloudwhale Bay."), or the
 *  100-Glimmer ladder's words for how it comes. */
export function whereToMeet(p: Profile, id: GlimmerId): string {
  const g = GLIMMER[id];
  if (advView(p).glimmers[id]) return `${g.name} is one of yours. It came to play!`;
  if ((g.source ?? 'roll') === 'roll' && g.home && !g.champion) return `Meet it in ${ISLAND[g.home].name}.`;
  return standing(id, ctxOf(p)).hint;
}
/** The words for a gift. */
export function giftWords(g: Gift, from: GlimmerId): string {
  if (g.kind === 'postcard') return `a postcard from the ${GLIMMER[from].name}`;
  if (g.kind === 'shells') return `${g.n} shell${g.n === 1 ? '' : 's'}`;
  const it = ITEM[g.item];
  return it ? `a ${it.name}` : 'a little present';
}

// ---------- family visits ----------
/** The family whose islands a player can visit: everyone else on this computer (a grown-up's signed-in
 *  account brings all its players here), but not class players (`isClass`). */
export function familyOf(players: Profile[], me: string, isClass: (p: Profile) => boolean = () => false): Profile[] {
  return players.filter(p => p.id !== me && !isClass(p));
}
export const heartedToday = (owner: Profile, from: string, now = Date.now()) => (owner.island?.hearts ?? []).some(h => h.from === from && dayKey(h.at) === dayKey(now));
/** Leave a heart on someone's island (once a day each). The only thing a visit changes. */
export function leaveHeart(owner: Profile, from: Profile, now = Date.now()): boolean {
  if (owner.id === from.id || heartedToday(owner, from.id, now)) return false;
  const s = fill((owner.island ??= empty()));
  s.hearts = [...s.hearts, { from: from.id, name: from.name, buddy: from.buddy, at: now }].slice(-HEARTS_KEEP);
  return true;
}
/** Hearts the owner hasn't seen yet, newest first, and the words: "Mia visited and left a heart". */
export function heartNews(s: IslandSave): { hearts: Heart[]; text: string } | null {
  const fresh = s.hearts.filter(h => h.at > s.seenHearts).sort((a, b) => b.at - a.at);
  if (!fresh.length) return null;
  const names = [...new Set(fresh.map(h => h.name))];
  const who = names.length === 1 ? names[0] : names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return { hearts: fresh, text: `${who} visited and left ${fresh.length === 1 ? 'a heart' : 'hearts'}` };
}
export function seeHearts(p: Profile) { const s = islandOf(p); s.seenHearts = Math.max(s.seenHearts, ...s.hearts.map(h => h.at)); }

/** A few words for Home and the menu: a heart waiting, a visitor here, or what's built. */
export function islandLine(p: Profile, now = Date.now()): string {
  const s = p.island;
  if (!s?.started) return 'Build your island with shells';
  const fresh = (s.hearts ?? []).filter(h => h.at > (s.seenHearts ?? 0));
  if (fresh.length) return `${fresh[fresh.length - 1].name} left you a heart!`;
  if (visitorNow(fill(JSON.parse(JSON.stringify(s)) as IslandSave), now)) return 'A visitor is here!';
  const n = Object.keys(s.placed ?? {}).length, v = (s.postcards ?? []).length;
  return `${n} thing${n === 1 ? '' : 's'} built · ${v} visitor${v === 1 ? '' : 's'}`;
}

// ---------- two computers ----------
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any
/** Combine two copies of the island (state/merge.ts calls it with its running-count `add`): things owned
 *  add up what each computer bought; what's on the island keeps everything placed on either and drops what
 *  either put away (with the copy both started from); a thing moved on both keeps the newer move; visitors,
 *  postcards and hearts are kept from both; the Glimmers out are the newer copy's pick. */
export function mergeIsland(m: J, t: J, b: J, mineNewer: boolean, add: (m: unknown, t: unknown, b: unknown) => number | undefined): IslandSave {
  const n = mineNewer ? m : t, o = mineNewer ? t : m;
  const owned: Record<string, number> = {};
  for (const k of new Set([...Object.keys(m.owned ?? {}), ...Object.keys(t.owned ?? {})])) owned[k] = add(m.owned?.[k], t.owned?.[k], b?.owned?.[k]) ?? 0;
  const placed: Record<string, Placed> = {};
  for (const uid of new Set([...Object.keys(m.placed ?? {}), ...Object.keys(t.placed ?? {})])) {
    const x = m.placed?.[uid], y = t.placed?.[uid];
    if (x && y) placed[uid] = (x.at ?? 0) >= (y.at ?? 0) ? x : y;
    else if (!b?.placed?.[uid]) placed[uid] = x ?? y; // new on one side: kept; on the base and missing on one side: put away there
  }
  const byKey = <T,>(xs: T[], key: (x: T) => string) => [...new Map(xs.map(x => [key(x), x])).values()];
  const visits = byKey<Visit>([...(m.visits ?? []), ...(t.visits ?? [])], v => `${v.at}|${v.id}`).sort((x, y) => x.at - y.at).slice(-VISITS_KEEP);
  const hearts = byKey<Heart>([...(m.hearts ?? []), ...(t.hearts ?? [])], h => `${h.at}|${h.from}`).sort((x, y) => x.at - y.at).slice(-HEARTS_KEEP);
  const sm = m.shells ?? { day: '', n: 0 }, st = t.shells ?? { day: '', n: 0 }, sb = b?.shells;
  const shells = sm.day === st.day ? { day: sm.day, n: Math.min(GIFT_SHELLS_DAY, add(sm.n, st.n, sb?.day === sm.day ? sb.n : undefined) ?? 0) } : sm.day > st.day ? sm : st;
  return {
    owned, placed, out: n.out ?? o.out ?? null, visits, postcards: [...new Set([...(n.postcards ?? []), ...(o.postcards ?? [])])], shells, hearts,
    seenHearts: Math.max(m.seenHearts ?? 0, t.seenHearts ?? 0), started: !!m.started || !!t.started, grown: Math.max(m.grown ?? 0, t.grown ?? 0),
  };
}

