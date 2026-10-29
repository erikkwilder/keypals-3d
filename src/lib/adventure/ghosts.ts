// Rival Ghosts: battle another player's team without both being there. A ghost plays the way its player
// really plays: how often they get answers right, how quickly, and whether they reach for the biggest
// card. Ghosts come from the other players on this device (a brother, a sister, a grown-up), from you a
// week ago, and from island rivals the game makes up (always labelled as made by the game). Nothing goes
// online. Leagues go up a step when you earn enough points in a week; a new week starts the points again.
import { mulberry32 } from '../engine/rng';
import { dayKey, type Profile } from '../engine/profile';
import type { FriendId } from '../art/cast';
import { GLIMMERS, rarityRank, type GlimmerId, type Rarity } from './glimmers';
import type { Member, Subject } from './battle';

/** How someone plays, kept as running totals. */
export type GhostStats = { answers: number; right: number; thinkMs: number; big: number; picks: number };
/** Someone's Rival Ghosts season. */
export type RivalState = {
  nick: string; league: number; week: string; points: number;
  /** rivals already beaten this week (each counts once) */
  beaten: string[];
  /** you, as you were at the start of the week: your "last week" ghost */
  past: GhostCopy | null;
  /** news for when you come back: someone played your ghost */
  inbox: { at: number; who: string; buddy: FriendId; youWon: boolean }[];
  wins: number; played: number;
  /** a league just went up (shown once) */
  promoted?: number;
};
export type GhostCopy = { buddy: FriendId; outfit: string; dance: string; team: Member[]; stats: GhostStats; subject: Subject };

export const LEAGUES = [
  { name: 'Pebble League', color: '#9aa3b5' },
  { name: 'Shell League', color: '#e9a07a' },
  { name: 'Coral League', color: '#ef6f6f' },
  { name: 'Crystal League', color: '#56b6f0' },
  { name: 'Star League', color: '#f2b51e' },
  { name: 'Rainbow League', color: '#b46cff' },
];
/** points in a week that move you up a league */
export const UP_AT = 12;
export const WIN_POINTS = 3, TRY_POINTS = 1;

const ADJ = ['Brave', 'Sunny', 'Zippy', 'Happy', 'Clever', 'Bouncy', 'Swift', 'Lucky', 'Jolly', 'Sparkly', 'Mighty', 'Cosy', 'Breezy', 'Starry', 'Plucky', 'Giggly'];
const ANIMAL = ['Otter', 'Fox', 'Panda', 'Robin', 'Gecko', 'Badger', 'Koala', 'Puffin', 'Lemur', 'Turtle', 'Owl', 'Hedgehog', 'Seal', 'Wombat', 'Kitten', 'Pony'];
/** A nickname from the word lists: no typing names in, so nobody can share who they are. */
export function nickname(seed: number) { const r = mulberry32(seed); return `${ADJ[Math.floor(r() * ADJ.length)]} ${ANIMAL[Math.floor(r() * ANIMAL.length)]}`; }

export const newStats = (): GhostStats => ({ answers: 0, right: 0, thinkMs: 0, big: 0, picks: 0 });
/** Fold one game's answers into the running totals (older play fades so the ghost keeps up). */
export function noteStats(s: GhostStats, o: { answers: number; right: number; thinkMs: number; big?: number; picks?: number }) {
  const keep = s.answers > 120 ? 0.8 : 1;
  s.answers = s.answers * keep + o.answers; s.right = s.right * keep + o.right; s.thinkMs = s.thinkMs * keep + o.thinkMs;
  s.big = s.big * keep + (o.big ?? 0); s.picks = s.picks * keep + (o.picks ?? 0);
}
/** The style a ghost plays with. */
export function styleOf(s: GhostStats) {
  const n = Math.max(1, s.answers);
  return {
    acc: s.answers >= 5 ? Math.min(0.97, Math.max(0.45, s.right / n)) : 0.75,
    thinkMs: s.answers >= 5 ? Math.min(12000, Math.max(1200, s.thinkMs / n)) : 4500,
    big: s.picks >= 4 ? s.big / s.picks : 0.4,
  };
}
/** Words for how a ghost plays, for its card. */
export function playsLike(s: GhostStats): string[] {
  const st = styleOf(s), out: string[] = [];
  out.push(st.acc >= 0.9 ? 'Very careful' : st.acc >= 0.75 ? 'Careful' : 'Takes chances');
  out.push(st.thinkMs <= 3000 ? 'Super quick' : st.thinkMs <= 5500 ? 'Quick' : 'Takes their time');
  if (st.big >= 0.55) out.push('Picks big cards');
  return out;
}

export const newRivals = (seed: number, now = Date.now()): RivalState => ({ nick: nickname(seed), league: 0, week: weekKey(now), points: 0, beaten: [], past: null, inbox: [], wins: 0, played: 0 });
/** The Monday that starts this week, as a day key. */
export function weekKey(now = Date.now()) {
  const d = new Date(now); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return dayKey(d.getTime());
}
export function daysLeft(now = Date.now()) { return 7 - ((new Date(now).getDay() + 6) % 7); }

/** A new week: move up a league if last week's points were enough, keep a copy of you for "last week",
 *  and start the points again. */
export function rollWeek(r: RivalState, me: GhostCopy | null, now = Date.now()) {
  const wk = weekKey(now);
  if (r.week === wk) return false;
  if (r.points >= UP_AT && r.league < LEAGUES.length - 1) { r.league++; r.promoted = r.league; }
  r.week = wk; r.points = 0; r.beaten = [];
  if (me && me.stats.answers >= 5) r.past = structuredClone(me);
  return true;
}

// ---------- the rivals on offer ----------
export type Rival = {
  id: string; kind: 'family' | 'past' | 'island';
  name: string; buddy: FriendId; outfit: string; dance: string; team: Member[];
  subject: Subject; stats: GhostStats; league: number;
  /** a family ghost: the profile it comes from (its questions come from that player's own level) */
  profileId?: string;
};

const STARTER_BUDDIES: FriendId[] = ['dino', 'cheetah', 'monkey', 'koala', 'box', 'turtle'];
/** Island rivals: made by the game, a little better the higher the league. */
function islandRival(seed: number, league: number, subject: Subject): Rival {
  const r = mulberry32(seed);
  const buddy = STARTER_BUDDIES[Math.floor(r() * STARTER_BUDDIES.length)];
  const top: Rarity[] = ['uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary'];
  const pool = GLIMMERS.filter(g => !g.champion && rarityRank(g.rarity) <= rarityRank(top[Math.min(league, top.length - 1)]));
  const team: Member[] = [];
  while (team.length < 2 && pool.length) { const g = pool[Math.floor(r() * pool.length)]; if (!team.some(t => t.id === g.id)) team.push({ id: g.id as GlimmerId, level: 1 + league * 2 + Math.floor(r() * 3) }); }
  const acc = Math.min(0.95, 0.66 + league * 0.05 + (r() - 0.5) * 0.08);
  const answers = 40;
  return {
    id: `island-${seed}`, kind: 'island', name: nickname(seed * 31 + 7), buddy, outfit: 'none', dance: 'dance_hiphop', team, subject,
    stats: { answers, right: answers * acc, thinkMs: answers * (5200 - league * 450 + r() * 900), big: 6 * (0.25 + r() * 0.5), picks: 6 }, league,
  };
}

/** Three rivals for today: family first, then you last week, then island rivals to fill up. Each player
 *  appears only if they have played at least one battle. */
export function rivalsFor(me: Profile, all: Profile[], r: RivalState, ghostOf: (p: Profile) => GhostCopy | null, now = Date.now()): Rival[] {
  const out: Rival[] = [];
  for (const p of all) {
    if (p.id === me.id || out.length >= 2) continue;
    const g = ghostOf(p);
    if (!g || g.stats.answers < 5) continue;
    out.push({ id: `family-${p.id}`, kind: 'family', name: p.name, buddy: g.buddy, outfit: g.outfit, dance: g.dance, team: g.team, subject: g.subject, stats: g.stats, league: p.adventure?.rivals?.league ?? 0, profileId: p.id });
  }
  if (r.past && r.past.stats.answers >= 5) out.push({ id: `past-${r.week}`, kind: 'past', name: 'You, last week', buddy: r.past.buddy, outfit: r.past.outfit, dance: r.past.dance, team: r.past.team, subject: r.past.subject, stats: r.past.stats, league: r.league });
  const day = dayKey(now);
  let n = 0;
  const base = [...`${me.id}${day}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  while (out.length < 3) out.push(islandRival(Math.abs(base + n++ * 977), r.league, me.adventure?.subject ?? 'math'));
  return out.slice(0, 3);
}
