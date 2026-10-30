// Playing with your Glimmers on My Sky Island: pet one (hearts and a happy hop), feed it a treat (island
// treats come from the Shop, three for a few shells), throw a ball for it to fetch, and now and then one
// makes a wish ("Puddle Pup wishes for a pond!"): build it and it's thrilled. All of that grows a Glimmer's
// friendship (shown as hearts; full friendship and it leaves you a note, one of the island's secrets) and, a
// little, its level, but never shells: the only shells the island gives are the visitors' few and the
// Wishing Well's, and together they stay within the day's few (GIFT_SHELLS_DAY in save.ts).
//
// Plain logic on the save (the 3D is in three/islandScene.ts); island.test.ts checks it.
import { dayKey, type Profile } from '../engine/profile';
import type { Rng } from '../engine/rng';
import { advOf, giveXp } from '../adventure/state';
import { GLIMMER, type Element, type GlimmerId } from '../adventure/glimmers';
import { statsOf, type BuildStats } from './blocks';
import { findSecret, noteFrom } from './secrets';
import { growthOf, islandOf, islandShells, outOf, type IslandSave } from './save';

/** full friendship (a Glimmer this happy leaves a note) */
export const FRIEND_MAX = 100;
/** friendship from petting, a treat and a fetched ball, and the most a Glimmer gets from them a day */
export const JOY = { pet: 3, treat: 10, ball: 4, wish: 25 }, JOY_DAY = 40;
/** treats: how many come in a bag and what it costs */
export const SNACKS = { n: 3, price: 15 };
/** the most Glimmer experience the island gives a day (all Glimmers together), and for a treat and a wish */
export const XP_DAY = 24, XP = { treat: 3, wish: 8 };
/** the most wishes granted a day, and the wait before the next one is asked */
export const WISHES_DAY = 3, WISH_GAP = 90_000;

const today = <T extends { day: string }>(x: T, day: string, blank: () => T): T => (x.day === day ? x : blank());

/** A Glimmer's friendship on the island (0 to FRIEND_MAX). */
export const friendOf = (s: Pick<IslandSave, 'friends'> | undefined, id: GlimmerId) => Math.min(FRIEND_MAX, s?.friends?.[id] ?? 0);
/** friendship as hearts out of five */
export const heartsOf = (s: Pick<IslandSave, 'friends'> | undefined, id: GlimmerId) => Math.floor(friendOf(s, id) / (FRIEND_MAX / 5));

/** Some friendship (petting, treats and balls only so much a day; a wish always). Returns how much it got. */
function befriend(s: IslandSave, id: GlimmerId, n: number, now: number, capped = true): number {
  const day = dayKey(now);
  s.joy = today(s.joy, day, () => ({ day, n: {} }));
  const had = s.joy.n[id] ?? 0, room = capped ? Math.max(0, JOY_DAY - had) : n, got = Math.min(n, room, FRIEND_MAX - friendOf(s, id));
  if (got <= 0) return 0;
  if (capped) s.joy.n = { ...s.joy.n, [id]: had + got };
  s.friends = { ...s.friends, [id]: friendOf(s, id) + got };
  return got;
}
/** A little Glimmer experience (within the day's few). */
function xpFor(p: Profile, s: IslandSave, id: GlimmerId, n: number, now: number): number {
  const day = dayKey(now), o = advOf(p).glimmers[id];
  if (!o) return 0;
  s.xp = today(s.xp, day, () => ({ day, n: 0 }));
  const got = Math.min(n, XP_DAY - s.xp.n);
  if (got <= 0) return 0;
  s.xp.n += got;
  giveXp(o, got);
  return got;
}
export type Joy = { joy: number; xp: number; note: boolean };
const lives = (p: Profile, id: GlimmerId) => outOf(p).includes(id);

/** Pet a Glimmer (tap it). */
export function pet(p: Profile, id: GlimmerId, now = Date.now()): Joy {
  const s = islandOf(p, now);
  if (!lives(p, id)) return { joy: 0, xp: 0, note: false };
  const joy = befriend(s, id, JOY.pet, now);
  return { joy, xp: 0, note: noteFrom(s, outOf(p)) === id };
}
/** Buy a bag of treats (the Shop, or the island when you have none). */
export function buySnacks(p: Profile): { ok: boolean; why?: string } {
  const a = advOf(p);
  if (a.shells < SNACKS.price) return { ok: false, why: `You need ${SNACKS.price - a.shells} more shells.` };
  const s = islandOf(p);
  a.shells -= SNACKS.price;
  s.treats += SNACKS.n;
  return { ok: true };
}
/** Feed a Glimmer a treat. */
export function feed(p: Profile, id: GlimmerId, now = Date.now()): Joy & { ok: boolean; why?: string } {
  const s = islandOf(p, now);
  if (!lives(p, id)) return { ok: false, why: 'It doesn\'t live here.', joy: 0, xp: 0, note: false };
  if (s.treats < 1) return { ok: false, why: 'No treats left.', joy: 0, xp: 0, note: false };
  s.treats--;
  const joy = befriend(s, id, JOY.treat, now), xp = xpFor(p, s, id, XP.treat, now);
  return { ok: true, joy, xp, note: noteFrom(s, outOf(p)) === id };
}
/** A Glimmer brought the ball back. */
export function fetched(p: Profile, id: GlimmerId, now = Date.now()): Joy {
  const s = islandOf(p, now);
  if (!lives(p, id)) return { joy: 0, xp: 0, note: false };
  const joy = befriend(s, id, JOY.ball, now);
  return { joy, xp: 0, note: noteFrom(s, outOf(p)) === id };
}

// ---------- wishes ----------
export type Want = 'pond' | 'fountain' | 'tidepond' | 'icepool' | 'pine' | 'sundais' | 'lamp' | 'stonecave' | 'boulder' | 'leafgrove' | 'flowers' | 'tree'
  | 'bench' | 'swing' | 'tower' | 'bridge' | 'house' | 'glowblock' | 'window';
type W = { words: string; pic: string; ok: (s: IslandSave, b: BuildStats) => boolean };
const has = (s: IslandSave, ...ids: string[]) => Object.values(s.placed).some(pl => ids.includes(pl.item));
/** what a Glimmer can wish for: the words ("wishes for a pond"), a picture (a catalogue thing, or a piece),
 *  and when it's there */
export const WANTS: Record<Want, W> = {
  pond: { words: 'a pond', pic: 'pond', ok: s => has(s, 'pond', 'tidepond', 'fountain') },
  fountain: { words: 'a fountain', pic: 'fountain', ok: s => has(s, 'fountain') },
  tidepond: { words: 'a Tide Pond', pic: 'tidepond', ok: s => has(s, 'tidepond') },
  icepool: { words: 'an Ice Pool', pic: 'icepool', ok: s => has(s, 'icepool') },
  pine: { words: 'a pine tree', pic: 'pine', ok: s => has(s, 'pine') },
  sundais: { words: 'a Sun Dais', pic: 'sundais', ok: s => has(s, 'sundais') },
  lamp: { words: 'a lantern', pic: 'lamp', ok: s => has(s, 'lamp') },
  stonecave: { words: 'a Stone Cave', pic: 'stonecave', ok: s => has(s, 'stonecave') },
  boulder: { words: 'a big rock', pic: 'boulder', ok: s => has(s, 'boulder') },
  leafgrove: { words: 'a Leaf Grove', pic: 'leafgrove', ok: s => has(s, 'leafgrove') },
  flowers: { words: 'some flowers', pic: 'flowers', ok: s => has(s, 'flowers', 'flowerbed') },
  tree: { words: 'a tree', pic: 'roundtree', ok: s => has(s, 'oak', 'puffy', 'roundtree', 'pine', 'palm', 'umbrella', 'treehouse') },
  bench: { words: 'a bench to nap on', pic: 'bench', ok: s => has(s, 'bench') },
  swing: { words: 'a swing', pic: 'swing', ok: s => has(s, 'swing') },
  tower: { words: 'a tower four blocks high', pic: 'block:pillar', ok: (_, b) => b.tallest >= 4 },
  bridge: { words: 'a bridge off the edge', pic: 'block:half', ok: (_, b) => b.off >= 2 },
  house: { words: 'a house with a door and a window', pic: 'block:door', ok: (_, b) => b.doors >= 1 && b.windows >= 1 && b.count >= 12 },
  glowblock: { words: 'a glowing block', pic: 'block:cube', ok: (_, b) => b.glows >= 1 },
  window: { words: 'a window to look out of', pic: 'block:window', ok: (_, b) => b.windows >= 1 },
};
const BY_ELEMENT: Record<Element, Want[]> = {
  tide: ['pond', 'tidepond', 'fountain'], frost: ['icepool', 'pine'], sun: ['sundais', 'lamp', 'glowblock'],
  stone: ['stonecave', 'boulder', 'tower'], leaf: ['leafgrove', 'flowers', 'tree'],
};
const ANYONE: Want[] = ['bench', 'swing', 'tower', 'bridge', 'house', 'window'];
export type Wish = { id: GlimmerId; want: Want; at: number };
export const wishWords = (w: Wish) => `${GLIMMER[w.id]?.name ?? 'A Glimmer'} wishes for ${WANTS[w.want].words}!`;
const statsFor = (p: Profile, s: IslandSave) => statsOf(s.blocks, growthOf(p).r);
/** Is a wish there on the island now? */
export const wishMet = (p: Profile, s: IslandSave, want: Want) => WANTS[want].ok(s, statsFor(p, s));

/** Now and then a Glimmer living on the island makes a wish (something not on the island yet): its own
 *  kind's things first. Inside game.update; null when nobody wishes now (one at a time, a little while
 *  after the last, WISHES_DAY a day). */
export function newWish(p: Profile, now: number, rnd: Rng): Wish | null {
  const s = islandOf(p, now), day = dayKey(now);
  if (s.wish) return null;
  s.wishes = today(s.wishes, day, () => ({ day, n: 0, at: 0 }));
  if (s.wishes.n >= WISHES_DAY || now - s.wishes.at < WISH_GAP) return null;
  const out = outOf(p);
  if (!out.length) return null;
  const b = statsFor(p, s);
  for (let tries = 0; tries < 6; tries++) {
    const id = out[Math.floor(rnd() * out.length)];
    const mine = BY_ELEMENT[GLIMMER[id].element].filter(w => !WANTS[w].ok(s, b));
    const any = ANYONE.filter(w => !WANTS[w].ok(s, b));
    const list = mine.length && rnd() < 0.7 ? mine : any.length ? any : mine;
    if (!list.length) continue;
    const w: Wish = { id, want: list[Math.floor(rnd() * list.length)], at: now };
    s.wish = w;
    return w;
  }
  return null;
}
/** Is the wish there now? Then the Glimmer is thrilled: lots of friendship and a little experience (never
 *  shells). Inside game.update; null if there's no wish or it isn't met yet. */
export function grantWish(p: Profile, now = Date.now()): (Wish & Joy) | null {
  const s = islandOf(p, now), w = s.wish;
  if (!w) return null;
  if (!outOf(p).includes(w.id)) { s.wish = null; return null; }
  if (!wishMet(p, s, w.want)) return null;
  const day = dayKey(now);
  s.wish = null;
  s.wishes = today(s.wishes, day, () => ({ day, n: 0, at: 0 }));
  s.wishes = { day, n: s.wishes.n + 1, at: now };
  const joy = befriend(s, w.id, JOY.wish, now, false), xp = xpFor(p, s, w.id, XP.wish, now);
  return { ...w, joy, xp, note: noteFrom(s, outOf(p)) === w.id };
}

// ---------- the Wishing Well ----------
export type WellGift = { kind: 'treat' } | { kind: 'shells'; n: number } | { kind: 'thing'; item: string };
/** Can you wish today? (a Wishing Well on the island, and no wish made yet today) */
export const canWish = (s: Pick<IslandSave, 'placed' | 'well'>, now = Date.now()) => s.well !== dayKey(now) && Object.values(s.placed).some(pl => pl.item === 'well');
/** Make a wish at the well: the first time is one of the island's secrets; every day after, a little
 *  surprise: a treat, a couple of shells (within the island's few a day) or some flowers. */
export function wishAtWell(p: Profile, now: number, rnd: Rng): { first: boolean; gift: WellGift } | null {
  const s = islandOf(p, now);
  if (!canWish(s, now)) return null;
  s.well = dayKey(now);
  const first = findSecret(p, s, 'well', now);
  const r = rnd();
  if (r < 0.35) { const n = islandShells(p, s, 2, now); if (n > 0) return { first, gift: { kind: 'shells', n } }; }
  if (r < 0.75) { s.treats++; return { first, gift: { kind: 'treat' } }; }
  s.owned.flowers = (s.owned.flowers ?? 0) + 1;
  return { first, gift: { kind: 'thing', item: 'flowers' } };
}

// ---------- digging for treasure ----------
/** Dig where the grass sparkles (the buddy is standing on it): the first time it's the buried treasure
 *  (a secret); after that, a treat now and then. Once a day. */
export function dig(p: Profile, now = Date.now()): { first: boolean; treat: boolean } | null {
  const s = islandOf(p, now), day = dayKey(now);
  if (s.digs === day) return null;
  s.digs = day;
  const first = findSecret(p, s, 'chest', now);
  if (!first) s.treats++;
  return { first, treat: !first };
}
