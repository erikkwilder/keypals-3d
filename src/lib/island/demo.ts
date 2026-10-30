// Dev hooks for looking at My Sky Island (state/dev.ts): #island=demo gives the player shells and nine
// Glimmers; add `built` for an island already built up (a pond, lanterns, fences, flowers, a bench, a
// birdhouse, a habitat), and `family` for a brother, Leo, with an island of his own to visit and a heart
// he left; `fresh` starts the player's island again. For the blocks and secrets: `house` (a little block
// house), `big` (a castle of about 300 blocks, to check it stays smooth), `night`, `day` and `rain` (the evening,
// the daytime, a rain shower now), `treats` (a bag of treats), `happy` (Puddle Pup nearly full friendship), `well` (a
// Wishing Well and a pond), `nosecrets` (the secrets not found yet). Only ever used from the address bar.
import { game } from '../state/game.svelte';
import { newProfile, type Profile } from '../engine/profile';
import { advOf } from '../adventure/state';
import type { GlimmerId } from '../adventure/glimmers';
import { buyAndPlace, growthOf, islandOf, leaveHeart, type Rot } from './save';
import { ctxOf, placeBlock, type Block } from './blocks';
import { keepOutOf } from './secrets';
import { islandDev } from './dev';

const MINE: [GlimmerId, number, boolean?][] = [['puddlepup', 6, true], ['sproutbun', 4], ['embernewt', 5], ['frostowl', 3], ['sunsnail', 2], ['fernfox', 3], ['bubbleocto', 2], ['popcornpuff', 2], ['geodemole', 1]];
const BUILT: [string, number, number, Rot][] = [
  ['pond', 1, 0, 0], ['lamp', -2, -1, 0], ['lamp', 3, -2, 0], ['flowers', -1, -1, 0], ['flowers', 2, -1, 0], ['flowers', -3, 2, 0], ['flowerbed', 3, 2, 0],
  ['bench', -3, -1, 1], ['birdhouse', 4, -2, 0], ['fence', -2, 4, 0], ['fence', -1, 4, 0], ['fence', 2, 4, 0], ['fence', 3, 4, 0], ['sundais', -5, 1, 0],
];

function give(p: Profile, built: boolean) {
  const a = advOf(p);
  a.shells = Math.max(a.shells, 1500);
  const now = Date.now();
  for (const [id, level, evolved] of MINE) { const o = (a.glimmers[id] ??= { level, xp: 0, got: now }); o.level = Math.max(o.level, level); if (evolved) o.evolved = true; }
  islandOf(p);
  if (built) for (const [id, x, z, rot] of BUILT) buyAndPlace(p, id, x, z, rot);
}

/** Blocks for a demo: as many as fit. */
function blocks(p: Profile, list: Block[]) {
  const s = islandOf(p), r = growthOf(p).r;
  let n = 0;
  for (const b of list) if (placeBlock(s, ctxOf(s, r, keepOutOf(r)), b).ok) n++;
  return n;
}
const B = (x: number, y: number, z: number, s: Block['s'] = 'cube', p = 14, r: Rot = 0): Block => ({ x, y, z, s, r, p });
/** a little house: walls of wood three blocks high, a door at the front, windows, a roof of tiles */
function house(x0: number, z0: number, w = 6, d = 6): Block[] {
  const out: Block[] = [];
  for (let y = 0; y < 3; y++) for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) {
    if (x > x0 && x < x0 + w - 1 && z > z0 && z < z0 + d - 1) continue;
    const front = z === z0 + d - 1, door = front && x === x0 + 2;
    if (door) { if (y === 0) out.push(B(x, 0, z, 'door', 1)); continue; }
    const win = y === 1 && ((front && x === x0 + 4) || ((x === x0 || x === x0 + w - 1) && z === z0 + 2));
    out.push(B(x, y, z, win ? 'window' : 'cube', win ? 0 : y === 0 ? 15 : 1, (x === x0 ? 1 : x === x0 + w - 1 ? 3 : front ? 0 : 2) as Rot));
  }
  for (let x = x0; x < x0 + w; x++) for (let z = z0; z < z0 + d; z++) out.push(B(x, 3, z, 'half', 18));
  return out;
}
/** a castle of about 300 blocks: a house, two towers, a wall, stairs and a bridge off the edge */
function castle(): Block[] {
  const out: Block[] = [...house(3, 1)];
  for (const [tx, tz] of [[-8, 2], [3, 10]]) for (let y = 0; y < 8; y++) for (let x = tx; x < tx + 2; x++) for (let z = tz; z < tz + 2; z++) out.push(B(x, y, z, y === 7 ? 'pillar' : 'cube', [15, 16, 2, 9][(x + z + y) % 4]));
  for (let x = -6; x <= 1; x++) for (let y = 0; y < 2; y++) out.push(B(x, y, 9, y === 1 && x % 2 ? 'fence' : 'cube', [16, 15][y]));
  for (let i = 0; i < 4; i++) { for (let y = 0; y < i; y++) out.push(B(-2 + i, y, 6, 'cube', 4)); out.push(B(-2 + i, i, 6, 'stairs', 11, 1)); }
  for (let x = 12; x <= 20; x++) out.push(B(x, 0, 4, 'half', 17));
  for (let x = -12; x <= -9; x++) for (let z = -2; z <= 0; z++) for (let y = 0; y < 3 - Math.abs(z + 1); y++) out.push(B(x, y, z, 'cube', [21, 19, 22, 20][(x + z + y + 40) % 4]));
  return out;
}

export function islandDemo(val: string) {
  const want = new Set(val.split(','));
  // `fresh`: start the island again from the starter kit (to try building from nothing)
  if (want.has('fresh')) game.update(p => { delete p.island; });
  game.update(p => give(p, want.has('built')));
  islandDev.night = want.has('night'); islandDev.day = want.has('day'); islandDev.rain = want.has('rain');
  game.update(p => {
    const s = islandOf(p);
    if (want.has('nosecrets')) { s.secrets = {}; s.mats = []; s.digs = ''; s.well = ''; }
    if (want.has('big')) { s.mats = [19, 20, 21, 22]; blocks(p, castle()); }
    else if (want.has('house')) blocks(p, house(4, 2));
    if (want.has('treats')) s.treats = Math.max(s.treats, 9);
    if (want.has('happy')) s.friends = { ...s.friends, puddlepup: 95 };
    if (want.has('well')) { advOf(p).shells += 300; buyAndPlace(p, 'well', -4, 2, 0); buyAndPlace(p, 'pond', 3, -2, 0); }
  });
  if (want.has('family')) {
    const me = game.profile!;
    let leo = game.save.profiles.find(p => p.name === 'Leo');
    if (!leo) { leo = newProfile('Leo', 'koala'); game.save.profiles.push(leo); leo = game.save.profiles[game.save.profiles.length - 1]; }
    give(leo, true);
    const la = advOf(leo); la.glimmers.mittenyeti = { level: 3, xp: 0, got: Date.now() }; la.glimmers.rainbootfrog = { level: 2, xp: 0, got: Date.now() };
    buyAndPlace(leo, 'icepool', -5, -2, 0); buyAndPlace(leo, 'palm', 4, 0, 0); buyAndPlace(leo, 'swing', 1, 3, 0);
    // (a fresh try: the heart you left Leo today is taken back, so you can leave it again)
    if (want.has('fresh') && leo.island) leo.island.hearts = leo.island.hearts.filter(h => h.from !== me.id);
    leo.updatedAt = Date.now();
    game.update(p => { if (!(p.island?.hearts ?? []).some(h => h.from === leo!.id)) leaveHeart(p, leo!); });
    game.persist();
  }
}
