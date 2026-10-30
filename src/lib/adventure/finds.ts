// Finds on the Adventure trails (trails.ts), one of each on every island, each once a day so it stays
// special: a treasure chest (shells, and now and then an egg), a spot hidden behind a bush or a waterfall
// that only shows when you walk close to it (a sparkle, then a find: a jewel the first time), and the
// Bonus Round: five quick questions in a treasure room, its stars paid like practice (engine/settle.ts),
// then the chest at the end. Also where the buddy stands in each world.
import { mulberry32 } from '../engine/rng';
import { dayKey, type Profile } from '../engine/profile';
import { settlePractice, type Settled } from '../engine/settle';
import { factId, seedPartner, updateFact, type Fact } from '../math/facts';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import type { Rarity } from './glimmers';
import { advOf, giveEgg, warmEggs, type Adventure, type Egg, type IslandId, type WorldId } from './state';
import { findId, type FindKind } from './trails';
import { noteSecret } from './ladderSave'; // 100-Glimmer ladder: two of its secrets are found here

/** Collected today already (it fills up again tomorrow). */
export const findDone = (a: Adventure, id: string, now = Date.now()) => a.finds?.[id] === dayKey(now);
/** A hidden spot found before (its trail stays on the map). */
export const hiddenFound = (a: Adventure, id: string) => !!a.hidden?.includes(id);
/** The treasure picture a find shows (public/treasures, engine/rewards.ts TREASURES). */
export type FindPrize = { kind: FindKind; shells: number; egg: Egg | null; eggFull: boolean; treasure: string; first: boolean; warmed: Rarity[] };

const seedOf = (id: string, now: number) => { let h = 2166136261; for (const ch of `${id}|${dayKey(now)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
const mark = (a: Adventure, id: string, now: number) => { a.finds = { ...(a.finds ?? {}), [id]: dayKey(now) }; };
/** an egg into the incubator or the nest (a full nest: shells instead) */
function egg(a: Adventure, rng: () => number, out: FindPrize) {
  const g = giveEgg(a, rng);
  if (g.where === 'full') { a.shells += 15; out.shells += 15; out.eggFull = true; } else out.egg = g.egg;
}

/** Open an island's treasure chest: 10 to 20 shells, and one time in four an egg. null: opened today. */
export function openChest(p: Profile, island: IslandId, now = Date.now()): FindPrize | null {
  const a = advOf(p), id = findId(island, 'chest');
  if (findDone(a, id, now)) return null;
  const rng = mulberry32(seedOf(id, now)), first = !a.finds?.[id];
  const out: FindPrize = { kind: 'chest', shells: 10 + Math.floor(rng() * 11), egg: null, eggFull: false, treasure: 'gold', first, warmed: [] };
  a.shells += out.shells;
  // the very first chest anywhere always has an egg in it: a great first find
  const firstEver = !Object.keys(a.finds ?? {}).some(k => k.endsWith('-chest'));
  if (firstEver || rng() < 0.25) egg(a, rng, out);
  mark(a, id, now);
  return out;
}

/** A hidden spot comes into view (you walked close): it stays on the map from now on. */
export function revealHidden(p: Profile, island: IslandId): boolean {
  const a = advOf(p), id = findId(island, 'hidden');
  if (hiddenFound(a, id)) return false;
  a.hidden = [...(a.hidden ?? []), id];
  return true;
}
/** Take what's in a hidden spot: a jewel and 30 shells the first time, then each day a few shells and a
 *  little warmth for the eggs. null: taken today. */
export function collectHidden(p: Profile, island: IslandId, now = Date.now()): FindPrize | null {
  const a = advOf(p), id = findId(island, 'hidden');
  if (findDone(a, id, now)) return null;
  if (!hiddenFound(a, id)) a.hidden = [...(a.hidden ?? []), id];
  const rng = mulberry32(seedOf(id, now)), first = !a.finds?.[id];
  const out: FindPrize = first
    ? { kind: 'hidden', shells: 30, egg: null, eggFull: false, treasure: rng() < 0.5 ? 'ruby' : 'diamond', first, warmed: [] }
    : { kind: 'hidden', shells: 6 + Math.floor(rng() * 5), egg: null, eggFull: false, treasure: ['marble', 'copper', 'silver', 'shell'][Math.floor(rng() * 4)], first, warmed: [] };
  a.shells += out.shells;
  if (!first) out.warmed = warmEggs(p, 3);
  // Cloudwhale Bay's hidden spot (behind the waterfall, the far end of the Sky Islands) is a ladder secret
  if (island === 'bay') noteSecret(p, a, 'trail');
  mark(a, id, now);
  return out;
}

// ---------- the Bonus Round ----------
export const BONUS_QUESTIONS = 5;
/** Stars for a Bonus Round, like a practice round's: all five right is three stars. */
export const bonusStars = (right: number) => (right >= 5 ? 3 : right >= 4 ? 2 : right >= 3 ? 1 : 0);
/** A Bonus Round all right with every answer this quick is a ladder secret. */
export const BONUS_QUICK_MS = 5000;
export type BonusRun = {
  island: IslandId; at: number; ms: number; right: number; answers: number;
  answered: { f: Fact; ok: boolean; thinkMs: number }[];
  skillAnswers: { key: string; ok: boolean; thinkMs: number }[];
};
export type BonusOutcome = { stars: number; settled: Settled; chest: FindPrize };
/** A Bonus Round played: the answers count for the fact and skill memory (as in a battle), its stars pay
 *  like practice (shells, friendship, stickers, eggs, today's goal), then the chest: 10 shells and 5 more
 *  for each star, an egg for three stars. null: played on this island today already. */
export function applyBonus(p: Profile, r: BonusRun): BonusOutcome | null {
  const a = advOf(p), id = findId(r.island, 'bonus');
  if (findDone(a, id, r.at)) return null;
  if (r.answered.length) {
    const m = (p.math = mathOf(p)), dk = dayKey(r.at);
    for (const x of r.answered) { const fid = factId(x.f); m.facts[fid] = updateFact(m.facts[fid], { ok: x.ok, thinkMs: x.thinkMs, day: dk, at: r.at, fastMs: m.fastMs }); seedPartner(m.facts, x.f); }
  }
  if (r.skillAnswers.length) noteSkillAnswers((p.math = mathOf(p)), r.skillAnswers, r.at);
  const stars = bonusStars(r.right);
  const thinks = [...r.answered, ...r.skillAnswers].map(x => x.thinkMs);
  if (r.right >= BONUS_QUESTIONS && thinks.length >= BONUS_QUESTIONS && thinks.every(ms => ms <= BONUS_QUICK_MS)) noteSecret(p, a, 'bonus');
  const settled = settlePractice(p, { at: r.at, ms: r.ms, finished: true, stars, medals: [], right: r.right, xp: () => 30 + stars * 15 });
  const rng = mulberry32(seedOf(id, r.at));
  const chest: FindPrize = { kind: 'bonus', shells: 10 + stars * 5, egg: null, eggFull: false, treasure: stars >= 3 ? 'diamond' : stars >= 2 ? 'gold' : 'silver', first: !a.finds?.[id], warmed: [] };
  a.shells += chest.shells;
  if (stars >= 3) egg(a, rng, chest);
  mark(a, id, r.at);
  return { stars, settled, chest };
}

// ---------- where the buddy stands ----------
/** Remember the trail point the buddy stands on in a world (back from a battle, it's there again). */
export function saveWalk(p: Profile, world: WorldId, point: string) {
  const a = advOf(p);
  if (a.walkAt?.[world] === point) return;
  a.walkAt = { ...(a.walkAt ?? {}), [world]: point };
}
