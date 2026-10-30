// Dev hooks for looking at My Sky Island (state/dev.ts): #island=demo gives the player shells and nine
// Glimmers; add `built` for an island already built up (a pond, lanterns, fences, flowers, a bench, a
// birdhouse, a habitat), and `family` for a brother, Leo, with an island of his own to visit and a heart
// he left; `fresh` starts the player's island again. Only ever used from the address bar.
import { game } from '../state/game.svelte';
import { newProfile, type Profile } from '../engine/profile';
import { advOf } from '../adventure/state';
import type { GlimmerId } from '../adventure/glimmers';
import { buyAndPlace, islandOf, leaveHeart, type Rot } from './save';

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

export function islandDemo(val: string) {
  const want = new Set(val.split(','));
  // `fresh`: start the island again from the starter kit (to try building from nothing)
  if (want.has('fresh')) game.update(p => { delete p.island; });
  game.update(p => give(p, want.has('built')));
  if (want.has('family')) {
    const me = game.profile!;
    let leo = game.save.profiles.find(p => p.name === 'Leo');
    if (!leo) { leo = newProfile('Leo', 'koala'); game.save.profiles.push(leo); leo = game.save.profiles[game.save.profiles.length - 1]; }
    give(leo, true);
    const la = advOf(leo); la.glimmers.mittenyeti = { level: 3, xp: 0, got: Date.now() }; la.glimmers.rainbootfrog = { level: 2, xp: 0, got: Date.now() };
    buyAndPlace(leo, 'icepool', -5, -2, 0); buyAndPlace(leo, 'palm', 4, 0, 0); buyAndPlace(leo, 'swing', 1, 3, 0);
    leo.updatedAt = Date.now();
    game.update(p => { if (!(p.island?.hearts ?? []).some(h => h.from === leo!.id)) leaveHeart(p, leo!); });
    void me;
    game.persist();
  }
}
