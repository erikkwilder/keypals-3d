// The grown-ups' and teachers' rules around My path, and the free-time places:
//   - how many path things make a day (about 3 by default),
//   - "Keep to the path": off; "path first" (the rest of the game opens once today's path things are
//     done); or "path only" (the path and what it starts, all day),
//   - daily time limits for the Fact Garden, My Sky Island, the Wardrobe and Shop, and Dances: off (the
//     usual), 10 to 30 minutes, or earned by practice like Adventure's play time.
// A grown-up sets them for a player on the Grown-ups screen (kept in the player's settings); a teacher sets
// them for a class (classes.js keeps them with the class; the game gets them with the class work). When
// both say something, the stricter one counts. A family's own player linked to a class isn't held by the
// class's rules at home: they're for the players the class made.
//
// When time's up, the door says so kindly ("That's enough island time today. Your island will be here
// tomorrow!") with a way to the path; App.svelte shows the door instead of the place.
import type { Profile, Settings } from '../engine/profile';
import { dayKey } from '../engine/profile';
import type { Screen } from '../state/game.svelte';
import { practiceMinToday } from '../adventure/state';
import { doneToday, pathSave, type PathProfile } from './progress';

export type Keep = 'off' | 'first' | 'only';
export type Limit = 'off' | '10' | '15' | '20' | '30' | 'earned';
export type FreePlace = 'garden' | 'island' | 'closet' | 'dances';
export const FREE_PLACES: FreePlace[] = ['garden', 'island', 'closet', 'dances'];
export const LIMITS: Limit[] = ['off', '10', '15', '20', '30', 'earned'];
export const KEEPS: Keep[] = ['off', 'first', 'only'];
/** What a grown-up or a teacher chose (any part can be missing: the usual then). */
export type PathRules = { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; grade?: number | null };
/** A class's rules, as the server keeps them (classes.js cleanClassSettings): the path and time rules,
 *  and how students may sign in with Google. */
export type ClassSettings = PathRules & { google?: 'on' | 'off'; domain?: string | null };
/** The player's own settings, with the grown-ups' path rules riding along. */
type PathSettings = Settings & { pathGoal?: number; keepPath?: Keep; limits?: Partial<Record<FreePlace, Limit>>; pathGrade?: number | null };

export const DEFAULT_GOAL = 3;
export const PLACE_NAME: Record<FreePlace, string> = { garden: 'Fact Garden', island: 'My Sky Island', closet: 'Wardrobe and Shop', dances: 'Dances' };
export const KEEP_TEXT: Record<Keep, { name: string; text: string }> = {
  off: { name: 'Free to roam', text: 'My path is there as a guide. Everything is open.' },
  first: { name: 'Path first', text: 'The rest of the game opens once today\'s path things are done.' },
  only: { name: 'Path only', text: 'Just the path, and what it starts, all day.' },
};
export const LIMIT_NAME = (l: Limit) => (l === 'off' ? 'No limit' : l === 'earned' ? 'Earned by practice' : `${l} min a day`);

// ---------- what counts for a player ----------
const settingsOf = (p: Profile) => p.settings as PathSettings;
/** The grown-ups' rules for a player (Grown-ups → Time and goals). */
export function homeRules(p: Profile): PathRules {
  const s = settingsOf(p);
  return { keep: s.keepPath, goal: s.pathGoal, limits: s.limits, grade: s.pathGrade ?? null };
}
/** Change the grown-ups' rules (call inside game.update, or on a player then persist). */
export function setHomeRules(p: Profile, patch: { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; grade?: number | null }) {
  const s = settingsOf(p);
  if (patch.grade !== undefined) s.pathGrade = patch.grade === null ? null : Math.max(0, Math.min(8, Math.round(patch.grade)));
  if (patch.keep !== undefined) s.keepPath = patch.keep;
  if (patch.goal !== undefined) s.pathGoal = Math.max(1, Math.min(6, Math.round(patch.goal)));
  if (patch.limits) s.limits = { ...(s.limits ?? {}), ...patch.limits };
}
const keepRank = (k?: Keep) => KEEPS.indexOf(k ?? 'off');
/** Minutes a limit allows today (null: no limit). Earned: 5 free minutes plus a minute per minute of practice. */
export function allowed(l: Limit | undefined, p: Profile, now = Date.now()): number | null {
  if (!l || l === 'off') return null;
  if (l === 'earned') return 5 + Math.floor(practiceMinToday(p, now));
  return Number(l);
}
/** `grade`: where the math path starts (a class's grade first, else the grown-ups' pick; null: the beginning) */
export type Rules = { keep: Keep; goal: number; limits: Partial<Record<FreePlace, Limit>>; grade: number | null; from: 'home' | 'class' | 'none' };
/** The rules that hold for a player: the grown-ups' and any class's together, the stricter of each. */
export function rulesFor(p: Profile, classes: ClassSettings[] = [], now = Date.now()): Rules {
  const all = [homeRules(p), ...classes];
  const keep = all.reduce<Keep>((k, r) => (keepRank(r.keep) > keepRank(k) ? r.keep! : k), 'off');
  const goals = all.map(r => r.goal).filter((g): g is number => !!g && g > 0);
  const goal = goals.length ? Math.max(...goals) : DEFAULT_GOAL;
  const limits: Partial<Record<FreePlace, Limit>> = {};
  for (const place of FREE_PLACES) {
    let best: Limit | undefined, mins = Infinity;
    for (const r of all) { const l = r.limits?.[place]; const a = allowed(l, p, now); if (a !== null && a < mins) { mins = a; best = l; } }
    if (best) limits[place] = best;
  }
  const from = classes.some(c => c.keep && c.keep !== 'off' || Object.values(c.limits ?? {}).some(l => l && l !== 'off')) ? 'class' : keep !== 'off' || Object.keys(limits).length ? 'home' : 'none';
  const grade = classes.find(c => c.grade !== undefined && c.grade !== null)?.grade ?? homeRules(p).grade ?? null;
  return { keep, goal, limits, grade, from };
}

// ---------- free time ----------
/** The free-time place a screen is (null: not one of them). The Wardrobe's dances tab is Dances. */
export function placeOf(screen: Screen, closetTab: string): FreePlace | null {
  if (screen === 'garden') return 'garden';
  if (screen === 'island') return 'island';
  if (screen === 'shop') return 'closet';
  if (screen === 'closet' || screen === 'keypals') return 'closet';
  if (screen === 'dances') return 'dances';
  return null;
}
/** Minutes used in a place today (from the save, plus the minute being counted now). */
export function usedMs(p: Profile, place: FreePlace, now = Date.now(), running = 0): number {
  const t = pathSave(p).time;
  return (t && t.day === dayKey(now) ? t.ms[place] ?? 0 : 0) + running;
}
/** Add time spent in a place (on the player; the caller saves). */
export function addUsed(p: Profile, place: FreePlace, ms: number, now = Date.now()) {
  const pp = p as PathProfile, day = dayKey(now);
  const t = pp.path?.time?.day === day ? pp.path.time : { day, ms: {} };
  pp.path = { ...(pp.path ?? {}), time: { day, ms: { ...t.ms, [place]: (t.ms[place] ?? 0) + Math.max(0, Math.round(ms)) } } };
}
/** How much time is left in a place today (null: no limit). */
export function timeLeft(p: Profile, place: FreePlace, rules: Rules, now = Date.now(), running = 0): { open: boolean; leftMin: number | null; limit: Limit | null } {
  const l = rules.limits[place] ?? null;
  const a = allowed(l ?? undefined, p, now);
  if (a === null) return { open: true, leftMin: null, limit: null };
  const left = a - usedMs(p, place, now, running) / 60000;
  return { open: left > 0, leftMin: Math.max(0, left), limit: l };
}

/** What the door says when a place's time is up. */
export const STOP: Record<FreePlace, { title: string; line: string; art: string }> = {
  island: { title: "That's enough island time today.", line: 'Your island will be here tomorrow!', art: 'island/card.webp' },
  garden: { title: "That's enough garden time today.", line: 'Your flowers will keep growing until tomorrow!', art: 'icons/garden.webp' },
  closet: { title: "That's enough dressing up today.", line: 'Your wardrobe will be here tomorrow!', art: 'icons/outfits.webp' },
  dances: { title: "That's enough dancing today.", line: 'Your buddy will be ready to dance again tomorrow!', art: 'game/icon-dances.webp' },
};

// ---------- keep to the path ----------
/** The places a child roams to: closed while "keep to the path" holds. The path, what it starts (lessons,
 *  trips, games, battles, Learn), Home, the player's own settings and the grown-ups' screens stay open. */
export const ROAMING: Screen[] = ['map', 'arcade', 'island', 'closet', 'keypals', 'dances', 'shop', 'garden', 'drop', 'duel', 'rivals', 'playground', 'mystuff', 'stickers', 'glimmers', 'eggs', 'progress', 'subject', 'topic', 'way'];
/** Whether "keep to the path" holds right now (path first: until today's path things are done). */
export function pathHolds(p: Profile, rules: Rules, now = Date.now()): boolean {
  if (rules.keep === 'off') return false;
  if (rules.keep === 'only') return true;
  return doneToday(p, now) < rules.goal;
}

export type Door = { kind: 'time'; place: FreePlace; earned: boolean } | { kind: 'path'; keep: Keep; left: number; from: Rules['from'] };
/** What stands at the door of a screen, if anything: the place's time is up, or the path comes first. */
export function doorFor(screen: Screen, closetTab: string, p: Profile | null, rules: Rules, now = Date.now(), running = 0): Door | null {
  if (!p) return null;
  if (ROAMING.includes(screen) && pathHolds(p, rules, now)) return { kind: 'path', keep: rules.keep, left: Math.max(0, rules.goal - doneToday(p, now)), from: rules.from };
  const place = placeOf(screen, closetTab);
  if (place) {
    const t = timeLeft(p, place, rules, now, running);
    if (!t.open) return { kind: 'time', place, earned: t.limit === 'earned' };
  }
  return null;
}
