// One way every game pays out, so typing lessons, math trips, the playground, Learn, battles, duels and
// rival games feel like one system to a kid:
//   - Stars: how well a lesson, trip or round went (each game works out its own, 0 to 3).
//   - Friendship: every game played with a buddy makes you better friends; it opens outfits and dances.
//   - Medals and stickers: medals for things you can do again and again, stickers for one-off firsts.
//   - Shells: Adventure money; practice earns them for finishing, stars, medals and new stickers.
//   - Eggs: right answers in practice warm the eggs in the Adventure incubator.
//   - Today's goal: practice minutes (typing, math, the playground) count toward it.
//
// A new practice game (a new math game, a new subject) keeps its own record (its stars, its best, its
// skill memory), updates the buddy's counters the stickers read, and then calls settlePractice. A new
// play mode (like a battle) calls befriend and checkStickers. Nothing else is needed to fit in.
import { AWARD } from './achievements';
import { STICKERS, levelFromXp, medalTier, type StickerDef } from './stickers';
import { forBuddy, newBetween, type Reward } from './rewards';
import { welcomeNew } from './team';
import { buddyPal, dayKey, type MedalWin, type Profile, type XpInfo } from './profile';
import { earnShells, notePractice, practiceShells } from '../adventure/state';
import type { FriendId } from '../art/cast';
import type { Move } from './rides';
import type { Rarity } from '../adventure/glimmers';

/** Practice minutes for today's goal. Returns whether this practice reached the goal. */
export function practiceDay(p: Profile, ms: number, at: number): boolean {
  const dk = dayKey(at);
  const d = (p.days[dk] ??= { ms: 0, runs: 0 });
  const was = !!d.goal;
  d.ms += ms; d.runs++;
  if (!d.goal && d.ms >= p.settings.dailyGoalMin * 60000) d.goal = true;
  const hit = !was && !!d.goal;
  const pal = buddyPal(p);
  if (hit && !pal.goalDays.includes(dk)) pal.goalDays.push(dk);
  return hit;
}

/** Medals won: each counts up its tier (Rose, Silver, Gold, Rainbow). */
export function giveMedals(p: Profile, ids: string[]): MedalWin[] {
  const pal = buddyPal(p), out: MedalWin[] = [];
  for (const id of ids) {
    const was = pal.medals[id] ?? 0;
    pal.medals[id] = was + 1;
    const tier = medalTier(was + 1);
    if (AWARD[id]) out.push({ ...AWARD[id], count: was + 1, tier, tierUp: tier > medalTier(was) });
  }
  pal.medalsTotal += ids.length;
  return out;
}

/** Friendship with the buddy you played with, and the outfits and dances a new level opens (only the
 *  ones this buddy can wear or do). */
export function befriend(p: Profile, gained: number): { xp: XpInfo; rewards: Reward[] } {
  const pal = buddyPal(p);
  const before = levelFromXp(pal.xp);
  pal.xp += gained;
  const after = levelFromXp(pal.xp);
  pal.level = after.level;
  const rewards = forBuddy(newBetween(before.level, after.level), p.buddy);
  for (const r of rewards) if (!pal.seen.includes('reward:' + r.id)) pal.seen.push('reward:' + r.id);
  return { xp: { gained, before, after }, rewards };
}

/** Any stickers this buddy has now earned (checked after every game, battles and duels too). */
export function checkStickers(p: Profile, at: number): StickerDef[] {
  const pal = buddyPal(p), out: StickerDef[] = [];
  for (const st of STICKERS) {
    if (pal.stickers[st.id]) continue;
    if (st.check(pal, { grown: p.settings.grown, friend: p.buddy })) { pal.stickers[st.id] = at; out.push(st); pal.seen.push('sticker:' + st.id); }
  }
  return out;
}

export type Settled = {
  goalJustHit: boolean; medals: MedalWin[]; xp: XpInfo; rewards: Reward[]; stickers: StickerDef[];
  buddies: FriendId[]; eggsReady: Rarity[]; shells: number;
};

/** The end of any practice: today's minutes, medals (plus the goal medal), friendship, stickers, new
 *  buddies, warm eggs and shells, in that order. `xp` works out the friendship from the medal count. */
export function settlePractice(p: Profile, o: { at: number; ms: number; finished: boolean; stars: number; medals: string[]; right: number; xp: (medals: number) => number; move?: Move }): Settled {
  const goalJustHit = practiceDay(p, o.ms, o.at);
  const ids = goalJustHit ? [...o.medals, 'goal'] : o.medals;
  const medals = giveMedals(p, ids);
  const pal = buddyPal(p);
  if (o.finished) {
    pal.dances++;
    // a climb, sled run or swim finished (for the course stickers)
    if (o.move && o.move !== 'run' && !(pal.moves ??= []).includes(o.move)) pal.moves.push(o.move);
  }
  const { xp, rewards } = befriend(p, o.xp(ids.length));
  const stickers = checkStickers(p, o.at);
  const buddies = welcomeNew(p);
  const eggsReady = o.finished ? notePractice(p, o.right) : [];
  const shells = o.finished ? earnShells(p, practiceShells({ stars: o.stars, medals: ids.length, stickers: stickers.length })) : 0;
  return { goalJustHit, medals, xp, rewards, stickers, buddies, eggsReady, shells };
}
