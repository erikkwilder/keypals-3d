// My Sky Island's secrets: ten little surprises to find, each found once, each leaving a keepsake (a
// decoration for the island, in storage) and a sticker in the sticker book's Secrets section, and four of them
// a special paint for building (gold, crystal, glowing, cloud). The "Island secrets" list shows the ones found
// and a soft hint for the rest.
//
//   chest      treasure buried where the grass sparkles: the buddy stands on the sparkle and digs
//   cave       a crystal cave behind a little waterfall on a rock off the edge: build a bridge and walk over
//   skyrock    a rock floating high up and far out: build a ramp and a bridge up to it
//   night      the island at night (opened in the player's evening): stars, fireflies, glowing windows
//   rainbow    a rainbow after a rain shower (some days it rains): tap it
//   bottle     a message in a bottle bobbing in a pond (build one): tap it
//   well       a wish at the Wishing Well (build one): a little surprise every day after
//   note       a note a Glimmer leaves when it's very happy (pet it, feed it, play ball, grant its wishes)
//   whale      the Sky Whale swims past when the buddy stands on top of a tower six blocks high
//   butterfly  one butterfly is golden: tap it
//
// Plain logic on the save (the 3D is in three/islandScene.ts); island.test.ts checks every secret can be
// found and is given once.
import { bookOf, dayKey, type Profile } from '../engine/profile';
import type { StickerDef } from '../engine/stickers';
import type { GlimmerId } from '../adventure/glimmers';
import { BLOCK, PAINTS, cellOfCol, type Rock } from './blocks';
import type { IslandSave } from './save';

export type SecretId = 'chest' | 'cave' | 'skyrock' | 'night' | 'rainbow' | 'bottle' | 'well' | 'note' | 'whale' | 'butterfly';
export type SecretDef = {
  id: SecretId; name: string;
  /** a soft hint while it's not found */
  hint: string;
  /** the words when it's found */
  found: string;
  /** the decoration it leaves (catalog.ts, a keepsake) */
  keepsake: string;
  sticker: StickerDef;
};
const st = (id: SecretId, name: string, desc: string, o: Pick<StickerDef, 'shape' | 'bg' | 'hue' | 'hue2' | 'pose' | 'prop'>): StickerDef =>
  ({ id: `isle-${id}`, name, desc, rarity: 'rare', ...o, check: () => false });

export const SECRETS: SecretDef[] = [
  { id: 'chest', name: 'Buried treasure', keepsake: 'k-chest',
    hint: 'Now and then the grass sparkles. Walk your buddy on to the sparkle.',
    found: 'You dug up buried treasure! Gold blocks are yours to build with.',
    sticker: st('chest', 'Treasure Digger', 'Dig up the treasure on My Sky Island.', { shape: 'burst', bg: 'rays', hue: 45, hue2: 25, pose: 'cheer', prop: 'treasure' }) },
  { id: 'cave', name: 'The waterfall cave', keepsake: 'k-geode',
    hint: 'Something glitters behind a little waterfall, just off the edge. Can you build a way across?',
    found: 'The waterfall opened: a crystal cave! Crystal blocks are yours to build with.',
    sticker: st('cave', 'Cave Finder', 'Find the cave behind the waterfall on My Sky Island.', { shape: 'hex', bg: 'stars', hue: 280, hue2: 200, pose: 'surprised', prop: 'mountain' }) },
  { id: 'skyrock', name: 'The floating rock', keepsake: 'k-starstone',
    hint: 'A rock floats high up, far off the edge. Build a ramp and a bridge to reach it.',
    found: 'You reached the floating rock! Cloud blocks are yours to build with.',
    sticker: st('skyrock', 'Sky Explorer', 'Reach the floating rock off My Sky Island.', { shape: 'cloud', bg: 'rays', hue: 200, hue2: 52, pose: 'proud', prop: 'mountain' }) },
  { id: 'night', name: 'Night on the island', keepsake: 'k-firefly',
    hint: 'Come back to your island in the evening.',
    found: 'Night on your island: stars, fireflies and glowing windows! Glowing blocks are yours to build with.',
    sticker: st('night', 'Night Owl', 'Visit My Sky Island at night.', { shape: 'circle', bg: 'stars', hue: 240, hue2: 268, pose: 'wink', prop: 'star' }) },
  { id: 'rainbow', name: 'A rainbow', keepsake: 'k-raincloud',
    hint: 'Some days it rains on the island. Watch what comes after the rain.',
    found: 'A rainbow after the rain!',
    sticker: st('rainbow', 'Rainbow Chaser', 'Tap the rainbow after the rain on My Sky Island.', { shape: 'cloud', bg: 'rays', hue: 300, hue2: 52, pose: 'cheer', prop: 'star' }) },
  { id: 'bottle', name: 'A message in a bottle', keepsake: 'k-bottle',
    hint: 'Things wash up in ponds. Build a pond and keep an eye on it.',
    found: 'A message in a bottle!',
    sticker: st('bottle', 'Message in a Bottle', 'Find the bottle in a pond on My Sky Island.', { shape: 'ticket', bg: 'waves', hue: 190, hue2: 160, pose: 'surprised', prop: 'book' }) },
  { id: 'well', name: 'A wish at the well', keepsake: 'k-wishstar',
    hint: 'Build a Wishing Well and make a wish.',
    found: 'You made a wish! The well has a little surprise for you every day.',
    sticker: st('well', 'Wish Maker', 'Make a wish at the Wishing Well on My Sky Island.', { shape: 'star', bg: 'confetti', hue: 52, hue2: 200, pose: 'love', prop: 'star' }) },
  { id: 'note', name: 'A note from a Glimmer', keepsake: 'k-letterbox',
    hint: 'Make one of your Glimmers very, very happy.',
    found: 'A Glimmer left you a note!',
    sticker: st('note', 'Best Friends', 'Make a Glimmer so happy it leaves you a note.', { shape: 'heart', bg: 'dots', hue: 338, hue2: 52, pose: 'hug', prop: 'heart' }) },
  { id: 'whale', name: 'The Sky Whale', keepsake: 'k-whalekite',
    hint: 'Build a tower six blocks high, stand on top and look at the sky.',
    found: 'From way up high you spotted the Sky Whale swimming through the clouds!',
    sticker: st('whale', 'Whale Watcher', 'See the Sky Whale from a tall tower on My Sky Island.', { shape: 'cloud', bg: 'waves', hue: 205, hue2: 268, pose: 'surprised', prop: 'star' }) },
  { id: 'butterfly', name: 'The golden butterfly', keepsake: 'k-butterflies',
    hint: 'Watch the butterflies. One of them is very special.',
    found: 'You found the golden butterfly!',
    sticker: st('butterfly', 'Golden Wings', 'Tap the golden butterfly on My Sky Island.', { shape: 'burst', bg: 'confetti', hue: 48, hue2: 330, pose: 'wink', prop: 'crown' }) },
];
export const SECRET = Object.fromEntries(SECRETS.map(s => [s.id, s])) as Record<SecretId, SecretDef>;
/** the island's stickers, for the sticker book's Secrets section (not in the 35 a buddy collects) */
export const ISLE_STICKERS: StickerDef[] = SECRETS.map(s => s.sticker);
/** the special paint each secret gives */
export const PAINT_OF: Partial<Record<SecretId, number>> = Object.fromEntries(PAINTS.filter(p => p.special).map(p => [p.special!.secret, p.id]));

type Save = Pick<IslandSave, 'secrets' | 'owned' | 'mats'>;
export const foundOf = (s: Partial<Save> | undefined, id: SecretId) => !!s?.secrets?.[id];
export const foundCount = (s: Partial<Save> | undefined) => SECRETS.filter(d => foundOf(s, d.id)).length;

/** Found it (inside game.update, on the player's own island): its keepsake into storage, its paint, its
 *  sticker. False if it was found before: each secret is given once. */
export function findSecret(p: Profile, s: Save, id: SecretId, now = Date.now()): boolean {
  if (!SECRET[id] || s.secrets[id]) return false;
  s.secrets[id] = now;
  const k = SECRET[id].keepsake;
  s.owned[k] = (s.owned[k] ?? 0) + 1;
  const paint = PAINT_OF[id];
  if (paint !== undefined && !s.mats.includes(paint)) s.mats = [...s.mats, paint];
  const book = bookOf(p), sid = SECRET[id].sticker.id;
  if (!book.stickers[sid]) { book.stickers[sid] = { at: now, by: p.buddy }; if (!book.fresh.includes(sid)) book.fresh.push(sid); }
  return true;
}

// ---------- where they are and when they show ----------
/** a small number from words (the same words always give the same number) */
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** The two secret rocks off the edge, for an island `r` squares across: the cave rock beside it at the
 *  height of a half block, and the floating rock further out and three blocks up. */
export const CAVE_ANGLE = Math.PI * 0.27, SKY_ANGLE = Math.PI * 0.72;
export function rocksOf(r: number): { cave: Rock; sky: Rock } {
  const rim = r + 0.95;
  const at = (a: number, d: number, rr: number, top: number): Rock => ({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: rr, top });
  return { cave: at(CAVE_ANGLE, rim + 2.05, 1.05, BLOCK * 0.5), sky: at(SKY_ANGLE, rim + 3.9, 0.95, BLOCK * 3) };
}
/** Blocks can't go inside a rock (on top of one is fine). */
export function keepOutOf(r: number) {
  const k = rocksOf(r), list = [k.cave, k.sky];
  return (x: number, y: number, z: number) => list.some(q => y * BLOCK < q.top - 1e-6 && Math.hypot((x + 0.5) * BLOCK - q.x, (z + 0.5) * BLOCK - q.z) < q.r - 0.15);
}
/** standing on a rock (feet on its top) */
export const onRock = (q: Rock, x: number, y: number, z: number) => Math.hypot(x - q.x, z - q.z) <= q.r && Math.abs(y - q.top) < 0.2;

/** Where the grass sparkles today (a free square, the same all day), or null: dug here today already. */
export function sparkleSpot(id: string, s: Pick<IslandSave, 'digs'>, r: number, busy: Set<string>, day: string): { i: number; j: number } | null {
  if (s.digs === day) return null;
  const R = Math.ceil(r), free: { i: number; j: number }[] = [];
  for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) if (Math.hypot(i, j) <= r - 1.5 && !busy.has(`${i},${j}`) && (Math.abs(i) > 1 || Math.abs(j) > 1)) free.push({ i, j });
  if (!free.length) return null;
  return free[hash(`${id}|${day}|dig`) % free.length];
}
/** the island squares something stands on, blocks included (so the sparkle is on open grass) */
export function busyCells(things: Set<string>, blocks: { x: number; z: number }[]): Set<string> {
  const out = new Set(things);
  for (const b of blocks) out.add(`${cellOfCol(b.x)},${cellOfCol(b.z)}`);
  return out;
}

/** Is it night for the player (their evening)? Seven at night to six in the morning. */
export const isNight = (d: Date) => d.getHours() >= 19 || d.getHours() < 6;
/** How dark it is (0 day, 1 night), with a dusk and a dawn in between. */
export function darkness(d: Date): number {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h >= 19.5 || h < 5) return 1;
  if (h >= 18) return (h - 18) / 1.5;
  if (h < 6.5) return 1 - (h - 5) / 1.5;
  return 0;
}

/** Does it rain on the island today? About one day in three; and by the third day the island is opened
 *  (until the rainbow is found) it always does, so nobody waits for ever. */
export function rainToday(id: string, s: Pick<IslandSave, 'secrets' | 'days'>, day: string): boolean {
  if (hash(`${id}|${day}|rain`) % 3 === 0) return true;
  return !s.secrets.rainbow && s.days.last === day && s.days.n >= 3;
}

/** The pond a bottle washes up in (a placed pond or tide pond), until it's found. */
export function bottlePond(s: Pick<IslandSave, 'placed' | 'secrets'>): string | null {
  if (s.secrets.bottle) return null;
  const e = Object.entries(s.placed).find(([, pl]) => pl.item === 'pond' || pl.item === 'tidepond');
  return e ? e[0] : null;
}
/** the messages in bottles */
export const BOTTLE_NOTE = 'Hello from far across the clouds! I\'m a little Glimmer who loves the sea. If you find this, build something wonderful and wave at the sky. Love, the Bubble Octo';

/** The Glimmer leaving a note: one living on the island that's very happy (full friendship), until the
 *  note is found. */
export function noteFrom(s: Pick<IslandSave, 'secrets' | 'friends'>, out: GlimmerId[]): GlimmerId | null {
  if (s.secrets.note) return null;
  return out.find(id => (s.friends[id] ?? 0) >= 100) ?? null;
}
export const NOTE_WORDS = (name: string) => `Dear friend, you make my island the happiest place in the sky. Thank you for playing with me! Love, ${name}`;

/** how high the buddy must stand to see the Sky Whale (six blocks) */
export const WHALE_Y = 6 * BLOCK - 0.05;

/** The island was opened today: count the days (rain comes by the third). */
export function openedToday(s: Pick<IslandSave, 'days'>, now = Date.now()) {
  const day = dayKey(now);
  if (s.days.last !== day) s.days = { last: day, n: s.days.n + 1 };
}
