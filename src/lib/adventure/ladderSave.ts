// The 100-Glimmer ladder's counters, kept in the player's adventure (a.ladder): right answers ever, days
// played, days played in each season window, secrets found, and which goals' eggs have come. The first
// time they're read they're filled in from what the save already holds (every fact's and skill's right
// answers, typed words, the practice days, the secret word sticker, the bay's hidden spot), so a child who
// has played for months gets credit for it. ladder.ts reads them; settle/battles/finds note into them.
//
// This file takes the adventure as an argument (it never imports state.ts's values), so state.ts can call
// it without the two waiting on each other.
import { dayKey, type Profile } from '../engine/profile';
import type { Adventure } from './state';

export type LadderSave = {
  /** right answers ever: practice, battles, Bonus Rounds (a typed word counts as one, as for the eggs) */
  right: number;
  /** days played (10 minutes or more of anything: no streaks), and the last day counted */
  days: number; lastDay: string;
  /** days played inside each season window, by window ('winter-2026': December 2026 to February 2027) */
  seasons: Record<string, number>;
  /** secrets found: 'trail' (the bay's hidden spot), 'hut' (the Seed Library), 'word' (the secret word),
   *  'bonus' (a Bonus Round all right and quick) */
  secrets: string[];
  /** goals whose special egg has come: Glimmer id to the day (a season's: its window, so it comes again
   *  next year) */
  given: Record<string, string>;
  /** goals met while their Glimmer was still on its way (pending): the egg comes once it ships */
  waiting: string[];
};

/** A day counts once this many minutes were played. */
export const DAY_MIN = 10;
const DAY_MS = DAY_MIN * 60_000;
export type SecretId = 'trail' | 'hut' | 'word' | 'bonus';

// ---------- the seasons ----------
export type SeasonId = 'autumn' | 'winter' | 'spring' | 'summer' | 'newyear' | 'birthday';
/** Days of play inside a season's window that bring its egg. */
export const SEASON_DAYS = 5;
/** How long the birthday window lasts, from the day the player joined Keypals, every year after. */
export const BIRTHDAY_DAYS = 14;
const ymd = (dk: string) => dk.split('-').map(Number) as [number, number, number];
const keyOf = (t: Date) => dayKey(t.getTime());
/** The birthday window starting in year y (the anniversary of joining), or null before the first one. */
function birthdayWindow(y: number, born: number): { from: string; to: string } | null {
  const b = new Date(born);
  if (y <= b.getFullYear()) return null;
  const start = new Date(y, b.getMonth(), b.getDate()), end = new Date(y, b.getMonth(), b.getDate() + BIRTHDAY_DAYS - 1);
  return { from: keyOf(start), to: keyOf(end) };
}
/** The season windows a day falls in, each named with its year: autumn (September to November), winter
 *  (December to February, named by its December), spring (March to May), summer (June to August), New Year
 *  (26 December to 10 January, named by the new year) and the player's Keypals birthday (two weeks from
 *  the day they joined, every year after the first). */
export function windowsOf(dk: string, born?: number): string[] {
  const [y, m, d] = ymd(dk), out: string[] = [];
  if (m >= 9 && m <= 11) out.push(`autumn-${y}`);
  if (m === 12) out.push(`winter-${y}`); else if (m <= 2) out.push(`winter-${y - 1}`);
  if (m >= 3 && m <= 5) out.push(`spring-${y}`);
  if (m >= 6 && m <= 8) out.push(`summer-${y}`);
  if (m === 12 && d >= 26) out.push(`newyear-${y + 1}`); else if (m === 1 && d <= 10) out.push(`newyear-${y}`);
  if (born) for (const yy of [y - 1, y]) { const w = birthdayWindow(yy, born); if (w && dk >= w.from && dk <= w.to) out.push(`birthday-${yy}`); }
  return out;
}
/** The window of a season a day is in, or null. */
export const windowNow = (s: SeasonId, dk: string, born?: number) => windowsOf(dk, born).find(w => w.startsWith(s + '-')) ?? null;
/** When a season's window next opens (its first day), from a day: for "comes in 12 days". */
export function nextOpening(s: SeasonId, dk: string, born?: number): string | null {
  const [y] = ymd(dk);
  const firsts: Record<Exclude<SeasonId, 'birthday'>, (yy: number) => string> = {
    autumn: yy => `${yy}-09-01`, winter: yy => `${yy}-12-01`, spring: yy => `${yy}-03-01`, summer: yy => `${yy}-06-01`, newyear: yy => `${yy}-12-26`,
  };
  for (const yy of [y, y + 1, y + 2]) {
    const f = s === 'birthday' ? (born ? birthdayWindow(yy, born)?.from ?? null : null) : firsts[s](yy);
    if (f && f > dk) return f;
  }
  return null;
}

// ---------- reading and noting ----------
/** Minutes-worth played on a day: practice (p.days) and today's battles. */
function playedMs(p: Profile, a: Adventure, dk: string) { return (p.days?.[dk]?.ms ?? 0) + (a.day?.key === dk ? a.day.ms : 0); }
/** The counters from what an older save already holds (nothing written). */
export function seedLadder(p: Profile, a: Adventure): LadderSave {
  const m = p.math;
  let right = Math.floor((p.totals?.chars ?? 0) / 5);
  for (const s of Object.values(m?.facts ?? {})) right += s?.right ?? 0;
  for (const s of Object.values(m?.skills ?? {})) right += s?.right ?? 0;
  const L: LadderSave = { right, days: 0, lastDay: '', seasons: {}, secrets: [], given: {}, waiting: [] };
  for (const dk of Object.keys(p.days ?? {}).sort()) if (playedMs(p, a, dk) >= DAY_MS) countDay(L, dk, p.createdAt);
  if (p.book?.stickers?.['secret-word']) L.secrets.push('word');
  if (a.finds?.['bay-hidden']) L.secrets.push('trail');
  return L;
}
function countDay(L: LadderSave, dk: string, born?: number) {
  L.days++; L.lastDay = dk;
  for (const w of windowsOf(dk, born)) L.seasons[w] = (L.seasons[w] ?? 0) + 1;
}
/** The counters to change (filled in from the save the first time). */
export function ladderOf(p: Profile, a: Adventure): LadderSave {
  const L = (a.ladder ??= seedLadder(p, a));
  L.seasons ??= {}; L.secrets ??= []; L.given ??= {}; L.waiting ??= [];
  return L;
}
/** The counters to read (nothing written). */
export const ladderView = (p: Profile, a: Adventure): LadderSave => a.ladder ?? seedLadder(p, a);
/** Today counts as a day played once 10 minutes are in. True if it just did. */
export function noteDay(p: Profile, a: Adventure, at = Date.now()): boolean {
  const L = ladderOf(p, a), dk = dayKey(at);
  if (L.lastDay >= dk || playedMs(p, a, dk) < DAY_MS) return false;
  countDay(L, dk, p.createdAt);
  return true;
}
/** Would today count now (and hasn't yet)? (read only) */
export function dayDue(p: Profile, a: Adventure, at = Date.now()): boolean {
  const dk = dayKey(at), L = ladderView(p, a);
  return L.lastDay < dk && playedMs(p, a, dk) >= DAY_MS;
}
/** Right answers given (practice, a battle, a Bonus Round): they count toward the milestones, and the
 *  minutes toward today. */
export function noteLadder(p: Profile, a: Adventure, right: number, at = Date.now()) {
  const L = ladderOf(p, a);
  L.right += Math.max(0, Math.round(right) || 0);
  noteDay(p, a, at);
}
/** A secret found. True the first time. */
export function noteSecret(p: Profile, a: Adventure, id: SecretId): boolean {
  const L = ladderOf(p, a);
  if (L.secrets.includes(id)) return false;
  L.secrets.push(id);
  return true;
}
