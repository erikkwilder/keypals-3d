// Your team of Keypals. Six buddies are there from the start; the other fifteen join as you play,
// typing or math, each for a milestone you can see coming. A buddy who joins is yours for good; their
// friendship, stickers and medals start fresh and grow as you play with them.
import type { FriendId } from '../art/cast';
import { BUDDIES } from '../art/cast';
import { ALL_LESSONS, REGIONS } from './course';
import { passed, totalStars, type Profile } from './profile';
import { mathOf, mathStarsTotal, regionPassed, ALL_GARDEN_IDS } from '../math/progress';
import { MATH_REGIONS } from '../math/course';

export const STARTERS: FriendId[] = ['dino', 'cheetah', 'monkey', 'koala', 'box', 'turtle'];

/** What the milestones count, from everything the player has done in any game. */
export function teamStats(p: Profile) {
  const m = mathOf(p);
  const playStars = Object.values(m.play ?? {}).reduce((a, r) => a + (r?.stars ?? []).reduce((x, y) => x + (y ?? 0), 0), 0);
  const typingRegions = REGIONS.filter(r => r.id !== 'road' && r.lessons.every(l => passed(p, l.id))).length;
  const mathRegions = MATH_REGIONS.filter(r => regionPassed(m, r.id)).length;
  const typingPassed = ALL_LESSONS.filter(l => !l.practice && passed(p, l.id)).length;
  const three = Object.values(p.lessons).filter(r => r.stars >= 3).length + Object.values(m.lessons).filter(r => r.stars >= 3).length;
  const kinds = new Set(Object.keys(m.lessons).map(id => id.split('-')[0]).map(r => MATH_REGIONS.find(x => x.id === r || x.id.startsWith(r))?.op).filter(Boolean));
  return {
    stars: totalStars(p) + mathStarsTotal(m) + playStars,
    regions: typingRegions + mathRegions,
    blooms: ALL_GARDEN_IDS.filter(id => m.facts[id]?.stage === 3).length,
    days: Object.values(p.days).filter(d => d.ms > 0).length,
    goalDays: Object.values(p.days).filter(d => d.goal).length,
    ride: Math.max(p.rideBest ?? 0, ...Object.values(p.pals ?? {}).map(v => v?.rideBest ?? 0)),
    three,
    typingPassed,
    kinds: kinds.size + (Object.values(m.play ?? {}).some(r => (r?.plays ?? 0) > 0) ? 1 : 0),
  };
}
type Stats = ReturnType<typeof teamStats>;

/** Two ways to join: how far along the closer one is, in its own words ("12 of 20 lessons"). */
const either = (a: number, ofA: number, wa: string, b: number, ofB: number, wb: string): [number, number, string] => (a / ofA >= b / ofB ? [a, ofA, wa] : [b, ofB, wb]);
/** How each of the fifteen joins: the words on its card, and how far along you are. Stars count from
 *  every game: typing, math trips and the playground. */
export const UNLOCKS: Partial<Record<FriendId, { how: string; at: (s: Stats) => [number, number] | [number, number, string] }>> = {
  fish: { how: 'Earn 10 stars in any game', at: s => [s.stars, 10] },
  fluff: { how: 'Play on 2 different days', at: s => [s.days, 2] },
  rabbit: { how: 'Finish a whole island (typing or math)', at: s => [s.regions, 1] },
  dog: { how: 'Reach speed 4 of 6 in a lesson or trip (the bike on the trail)', at: s => [s.ride, 3] },
  sloth: { how: 'Earn 30 stars in any game', at: s => [s.stars, 30] },
  cat: { how: 'Grow 10 flowers in bloom, or pass 20 typing lessons', at: s => either(s.blooms, 10, 'flowers', s.typingPassed, 20, 'lessons') },
  goggles: { how: 'Finish 2 islands', at: s => [s.regions, 2] },
  antenna: { how: 'Try 4 kinds of math (the playground counts)', at: s => [s.kinds, 4] },
  sweater: { how: 'Reach your daily goal on 3 days', at: s => [s.goalDays, 3] },
  axolotl: { how: 'Earn 60 stars in any game', at: s => [s.stars, 60] },
  diver: { how: 'Get three stars 10 times', at: s => [s.three, 10] },
  terrier: { how: 'Reach top speed in a lesson or trip (the rocket on the trail)', at: s => [s.ride, 5] },
  pinkbunny: { how: 'Finish 4 islands', at: s => [s.regions, 4] },
  elf: { how: 'Earn 100 stars in any game', at: s => [s.stars, 100] },
  straw: { how: 'Grow 30 flowers in bloom, or pass 40 typing lessons', at: s => either(s.blooms, 30, 'flowers', s.typingPassed, 40, 'lessons') },
};

/** Who's on the team now. */
export function teamBuddies(p: Profile): FriendId[] {
  if (p.allBuddies) return BUDDIES.map(b => b.id);
  const s = teamStats(p);
  return BUDDIES.map(b => b.id).filter(id => STARTERS.includes(id) || (UNLOCKS[id] && UNLOCKS[id]!.at(s)[0] >= UNLOCKS[id]!.at(s)[1]));
}
export const onTeam = (p: Profile, id: FriendId) => teamBuddies(p).includes(id);
/** How close a buddy is to joining: 0..1 and words like "23 of 30". */
export function joinProgress(p: Profile, id: FriendId): { share: number; text: string } {
  const u = UNLOCKS[id];
  if (!u) return { share: 1, text: '' };
  const [n, of, what] = u.at(teamStats(p));
  return { share: Math.min(1, n / of), text: `${Math.min(of, Math.floor(n))} of ${of}${what ? ' ' + what : ''}` };
}
/** Buddies who joined since they were last announced (and mark them announced). */
export function welcomeNew(p: Profile): FriendId[] {
  const met = new Set(p.buddiesMet ?? []);
  const now = teamBuddies(p);
  const fresh = now.filter(id => !met.has(id) && !STARTERS.includes(id));
  p.buddiesMet = [...new Set([...met, ...now])];
  return fresh;
}
