// Evolutions. At level 5 a Glimmer can grow up: it doesn't happen on its own, the player taps Evolve and
// watches it. The grown-up form has a new name and painting, glows with its element's markings in 3D, and
// in battles its power works as if it were four levels higher, plus one extra thing of its own (EVOLVED).
import type { Profile } from '../engine/profile';
import { ALL_GLIMMERS, EVOLVE_AT, EVOLVED, GLIMMER, type GlimmerId } from './glimmers';
import { advOf, type Adventure } from './state';

export const isEvolved = (a: Adventure, id: GlimmerId) => !!a.glimmers[id]?.evolved;
/** Owned, level 5 or more, and not grown up yet. */
export function canEvolve(a: Adventure, id: GlimmerId): boolean {
  const o = a.glimmers[id];
  return !!o && !o.evolved && o.level >= EVOLVE_AT;
}
/** Levels still to go before it can evolve (0: ready or already evolved). */
export function levelsToEvolve(a: Adventure, id: GlimmerId): number {
  const o = a.glimmers[id];
  if (!o || o.evolved) return 0;
  return Math.max(0, EVOLVE_AT - o.level);
}
/** Every Glimmer that could evolve right now. */
export const readyToEvolve = (a: Adventure): GlimmerId[] => ALL_GLIMMERS.filter(g => canEvolve(a, g.id)).map(g => g.id);

/** Grow it up (inside game.update). False if it can't yet. */
export function evolve(p: Profile, id: GlimmerId): boolean {
  const a = advOf(p);
  if (!canEvolve(a, id)) return false;
  a.glimmers[id]!.evolved = true;
  return true;
}

/** Its painting: the grown-up one once evolved. Relative to the site's base. */
export const glimmerArt = (id: GlimmerId, evolved?: boolean) => `game/glimmers/${id}${evolved ? '-evo' : ''}.webp`;
/** The round picture of a Glimmer (team rows, badges): its face, centred, cut from its painting. */
export const glimmerFace = (id: GlimmerId, evolved?: boolean) => `game/glimmers/face/${id}${evolved ? '-evo' : ''}.webp`;
/** Before and after, for the evolve card. */
export const evolution = (id: GlimmerId) => ({ from: GLIMMER[id].name, to: EVOLVED[id].name, perk: EVOLVED[id].perk });
