// Family Duel and Rival Ghosts, on the players' side: setting up each side from a player (their own
// questions, buddy, outfit, team), a guest's side, a ghost's side, what a game earns, and the week's
// Rival Ghosts season.
import { buddyPal, danceOf, dayKey, outfitOf, type Profile, type XpInfo } from '../engine/profile';
import { levelFromXp } from '../engine/stickers';
import { forBuddy, newBetween, type Reward } from '../engine/rewards';
import { WORDS_KIDS } from '../content/words';
import { mathOf } from '../math/progress';
import { factId, seedPartner, updateFact, type Fact } from '../math/facts';
import { advOf, advView, giveXp, mathPool, meet, teamOf, today, typingPool } from './state';
import { BUDDY_ROLE, GEAR, type GlimmerId, type Rarity } from './glimmers';
import { guestPool, type GuestLevel, type SideSetup } from './duel';
import { newRivals, newStats, noteStats, rollWeek, styleOf, TRY_POINTS, WIN_POINTS, type GhostCopy, type Rival, type RivalState } from './ghosts';
import type { Subject } from './battle';
import type { FriendId } from '../art/cast';

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);

/** A player's side: their own questions, buddy, outfit power, role and team. */
export function sideOf(p: Profile, subject?: Subject): SideSetup {
  const a = advView(p), sub = subject ?? a.subject, outfit = outfitOf(p);
  return {
    name: p.name, buddy: p.buddy, kind: 'player', profileId: p.id, subject: sub,
    pool: sub === 'math' ? mathPool(p) : typingPool(p), role: BUDDY_ROLE[p.buddy] ?? 'heart',
    gear: GEAR[outfit]?.kind ?? null, team: teamOf(a), outfit, dance: danceOf(p), fastMs: p.math?.fastMs,
  };
}
/** A guest's side (a grown-up or a friend without a player here): questions at the level they pick. */
export function guestSide(name: string, buddy: FriendId, level: GuestLevel, subject: Subject): SideSetup {
  return { name, buddy, kind: 'guest', subject, pool: guestPool(level, subject, WORDS_KIDS), role: BUDDY_ROLE[buddy] ?? 'heart', gear: null, team: [], outfit: 'none', dance: 'dance_hiphop' };
}
/** How a player plays, for their ghost (null until they've played some). */
export function ghostCopyOf(p: Profile): GhostCopy | null {
  const a = advView(p);
  if (!a.ghost || a.ghost.answers < 1) return null;
  return { buddy: p.buddy, outfit: outfitOf(p), dance: danceOf(p), team: teamOf(a), stats: a.ghost, subject: a.subject };
}
/** A rival's side: it plays by itself, the way its player plays. Family ghosts answer their own
 *  player's questions; you-last-week and island rivals answer yours. */
export function rivalSide(r: Rival, me: Profile, all: Profile[]): SideSetup {
  const from = r.profileId ? all.find(p => p.id === r.profileId) : null;
  const sub = from ? advView(from).subject : advView(me).subject;
  const src = from ?? me;
  return {
    name: r.name, buddy: r.buddy, kind: 'ghost', profileId: r.profileId, subject: sub,
    pool: sub === 'math' ? mathPool(src) : typingPool(src), role: BUDDY_ROLE[r.buddy] ?? 'heart',
    gear: GEAR[r.outfit]?.kind ?? null, team: r.team, outfit: r.outfit, dance: r.dance, ghost: styleOf(r.stats),
  };
}

/** The season, read-only (for showing). */
export function seasonView(p: Profile): RivalState { return advView(p).rivals ?? newRivals(Math.abs(hash(p.id))); }
/** The season, ready to change (call inside game.update): a new week is rolled over first. */
export function season(p: Profile, now = Date.now()): RivalState {
  const a = advOf(p);
  a.rivals ??= newRivals(Math.abs(hash(p.id)), now);
  rollWeek(a.rivals, ghostCopyOf(p), now);
  return a.rivals;
}

export type VersusRun = {
  mode: 'duel' | 'rival'; won: boolean; perfect: boolean; glimmer: GlimmerId; rarity: Rarity;
  answers: number; right: number; thinkMs: number; big: number; picks: number;
  answered: { f: Fact; ok: boolean; thinkMs: number }[]; ms: number; at: number;
  rival?: Rival; subject: Subject;
};
export type VersusOutcome = {
  shells: number; xp: XpInfo; rewards: Reward[];
  met: { id: GlimmerId; rarity: Rarity; isNew: boolean; level: number; ups: number } | null;
  teamUps: { id: GlimmerId; level: number }[];
  points: number; league: number; promoted: boolean;
};

/** What a Family Duel or a Rival Ghosts game earns a player. The winner's prize is the Glimmer; everyone
 *  who played gets shells and friendship, and the answers count for the fact memory as in practice. */
export function applyVersus(p: Profile, r: VersusRun): VersusOutcome {
  const a = advOf(p);
  const day = today(a, r.at);
  day.ms += r.ms; day.answers += r.answers; day.right += r.right;
  if (r.subject === 'math' && r.answered.length) {
    const m = (p.math = mathOf(p)), dk = dayKey(r.at);
    for (const x of r.answered) { const id = factId(x.f); m.facts[id] = updateFact(m.facts[id], { ok: x.ok, thinkMs: x.thinkMs, day: dk, at: r.at, fastMs: m.fastMs }); seedPartner(m.facts, x.f); }
  }
  noteStats((a.ghost ??= newStats()), { answers: r.answers, right: r.right, thinkMs: r.thinkMs, big: r.big, picks: r.picks });
  const pal = buddyPal(p), before = levelFromXp(pal.xp);
  const gained = r.won ? 40 + (r.perfect ? 10 : 0) : 15;
  pal.xp += gained;
  const after = levelFromXp(pal.xp);
  pal.level = after.level;
  const rewards = forBuddy(newBetween(before.level, after.level), p.buddy);
  for (const rw of rewards) if (!pal.seen.includes('reward:' + rw.id)) pal.seen.push('reward:' + rw.id);
  const out: VersusOutcome = { shells: 0, xp: { gained, before, after }, rewards, met: null, teamUps: [], points: 0, league: 0, promoted: false };
  for (const t of teamOf(a)) { const o = a.glimmers[t.id]; if (o) { const ups = giveXp(o, r.won ? 10 : 4); if (ups) out.teamUps.push({ id: t.id, level: o.level }); } }
  if (r.won) out.met = { id: r.glimmer, rarity: r.rarity, ...meet(a, r.glimmer) };
  if (r.mode === 'duel') {
    a.duels ??= { played: 0, won: 0 };
    a.duels.played++; if (r.won) a.duels.won++;
    out.shells = r.won ? 20 : 10;
  } else {
    const s = season(p, r.at);
    s.played++;
    let pts = TRY_POINTS;
    if (r.won) {
      s.wins++;
      // a rival counts for full points once a week
      const first = !!r.rival && !s.beaten.includes(r.rival.id);
      pts = first ? WIN_POINTS + (r.perfect ? 1 : 0) : 1;
      if (first && r.rival) s.beaten.push(r.rival.id);
    }
    s.points += pts;
    out.points = pts; out.league = s.league;
    out.shells = r.won ? 15 + s.league * 3 : 5;
  }
  a.shells += out.shells;
  return out;
}

/** Tell a family player that someone played their ghost (shown next time they open Rival Ghosts). */
export function tellGhostOwner(owner: Profile, who: string, buddy: FriendId, ghostWon: boolean, now = Date.now()) {
  const s = season(owner, now);
  s.inbox = [{ at: now, who, buddy, youWon: ghostWon }, ...s.inbox].slice(0, 6);
}
