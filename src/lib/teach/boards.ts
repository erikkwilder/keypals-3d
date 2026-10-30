// The boards: effort, not accuracy. A class's board (this week's right answers and minutes, first
// names only, only inside the class), the class's weekly goal and its trophy, class against class
// (average right answers per student, class names only), the family board (players in one grown-up's
// account, this week's stars) and the world board for the Arcade's daily challenge (made-up names only).
import type { Profile } from '../engine/profile';
import { newAlias } from './names';
import type { BoardPrefs, ClassProfile } from './activity';

export type BoardRow = { name: string; buddy: string | null; right: number; ms: number; me?: boolean };

/** A board in order: most right answers first (minutes break a tie), with places (equal scores share a place). */
export function ranked<T extends { right: number; ms: number }>(rows: T[], by: 'right' | 'ms' = 'right'): (T & { place: number })[] {
  const key = (r: T) => (by === 'right' ? [r.right, r.ms] : [r.ms, r.right]);
  const sorted = [...rows].sort((a, b) => key(b)[0] - key(a)[0] || key(b)[1] - key(a)[1]);
  let place = 0, last: number | null = null;
  return sorted.map((r, i) => { const v = key(r)[0]; if (v !== last) { place = i + 1; last = v; } return { ...r, place }; });
}

/** The class trophy: how full it is (0 to 1) and its stage (0 empty, 1 bronze, 2 silver, 3 gold). */
export function trophy(right: number, goal: number): { fill: number; stage: 0 | 1 | 2 | 3; left: number } {
  if (!goal) return { fill: 0, stage: 0, left: 0 };
  const fill = Math.max(0, Math.min(1, right / goal));
  return { fill, stage: fill >= 1 ? 3 : fill >= 0.6 ? 2 : fill >= 0.25 ? 1 : 0, left: Math.max(0, goal - right) };
}
/** A weekly goal to suggest for a class: about 100 right answers a student, rounded. */
export const suggestGoal = (students: number) => Math.max(500, Math.round((students * 100) / 100) * 100);

/** The player's board settings (world boards are off until a grown-up turns them on). */
export const boardPrefs = (p: Profile): BoardPrefs => (p as ClassProfile).boards ?? {};
/** Turning world boards on gives the player a made-up name and a random number for the board (never a
 *  save code); turning it off keeps them for next time. */
export function setWorldBoards(p: Profile, on: boolean, rnd: () => number = Math.random): BoardPrefs {
  const cp = p as ClassProfile;
  const b = { ...(cp.boards ?? {}) };
  b.world = on;
  b.alias ??= newAlias(rnd);
  b.id ??= Array.from({ length: 4 }, () => Math.floor(rnd() * 2 ** 32).toString(36)).join('');
  cp.boards = b;
  return b;
}
/** What the world board is sent for a round: the made-up name, the buddy, the score. Nothing typed. */
export function worldEntry(p: Profile, game: string, day: string, score: number) {
  const b = boardPrefs(p);
  if (!b.world || !b.alias || !b.id) return null;
  return { game, day, score, who: b.id, alias: b.alias, buddy: p.buddy };
}
