// Glimmer Drop on the player's save: best score, today's jar best, which Glimmers of the chain they've
// made (the first time is a discovery), and the play time each round spends (the same play time
// Adventure uses: practice earns it, grown-ups set the rule).
import { dayKey, type Profile } from '../engine/profile';
import { advOf, advView, today } from '../adventure/state';

export type DropSave = { best: number; plays: number; found: number[]; daily?: { day: string; best: number } };
const empty = (): DropSave => ({ best: 0, plays: 0, found: [] });

export const dropOf = (p: Profile): DropSave => advView(p).drop ?? empty();
function dropEdit(p: Profile): DropSave {
  const a = advOf(p);
  a.drop ??= empty();
  a.drop.found ??= [];
  return a.drop;
}

/** A Glimmer of the chain made in play: true the first time (a discovery). Call inside game.update. */
export function markFound(p: Profile, tier: number): boolean {
  const d = dropEdit(p);
  if (d.found.includes(tier)) return false;
  d.found = [...d.found, tier].sort((x, y) => x - y);
  return true;
}

/** Play time spent (call inside game.update, now and then during a round and at the end). */
export function spendPlay(p: Profile, ms: number, at = Date.now()) { if (ms > 0) today(advOf(p), at).ms += ms; }

/** A round is over: its score, the biggest Glimmer made, whether it was today's jar. Returns new bests. */
export function recordRound(p: Profile, r: { score: number; tier: number; daily: boolean; day: string; ms: number; at: number }) {
  const d = dropEdit(p);
  const newBest = r.score > d.best;
  d.best = Math.max(d.best, r.score);
  d.plays++;
  for (let t = 0; t <= r.tier; t++) if (!d.found.includes(t)) d.found = [...d.found, t].sort((x, y) => x - y);
  let newDaily = false;
  if (r.daily) {
    if (d.daily?.day !== r.day) d.daily = { day: r.day, best: 0 };
    newDaily = r.score > d.daily.best;
    d.daily.best = Math.max(d.daily.best, r.score);
  }
  spendPlay(p, r.ms, r.at);
  return { newBest, newDaily };
}

/** The family's scores on this device: best ever, and today's jar. */
export function familyBoard(players: Profile[], day = dayKey(Date.now())) {
  return players.map(p => { const d = dropOf(p); return { id: p.id, name: p.name, buddy: p.buddy, best: d.best, today: d.daily?.day === day ? d.daily.best : 0 }; })
    .filter(r => r.best > 0)
    .sort((a, b) => b.today - a.today || b.best - a.best);
}
