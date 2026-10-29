// The Arcade: quick, bright score games on the math the player already has. A round is a minute or two
// and gets faster as you do well; every answer feeds the same fact memory as a trip, so playing really
// is practising. Arcade counts as practice: it earns stars, shells, treasure, friendship and stickers
// through the shared payout (engine/settle.ts), but arcade stars don't open lessons. Each day one game
// has the daily challenge: the same course for everyone in the family, and a bonus for beating its goal.
import { buddyPal, dayKey, type Profile } from '../engine/profile';
import { settlePractice, type Settled } from '../engine/settle';
import { earnShells } from '../adventure/state';
import { mathOf } from '../math/progress';
import { answerOf, factId, FAST_MS, opSign, seedPartner, updateFact, type Fact, type Op } from '../math/facts';
import { mulberry32, type Rng } from '../engine/rng';

export type ArcadeId = 'slalom' | 'catch' | 'tower';
export type ArcadeGame = {
  id: ArcadeId; name: string;
  /** what it is, in a line */
  blurb: string;
  /** what it practises */
  learns: string;
  /** the cabinet's painted picture */
  art: string;
  /** the scores for one, two and three stars */
  stars: [number, number, number];
  /** round length in seconds */
  secs: number;
  /** the cabinet's colour */
  color: string;
  /** how to play, in a few short lines for the start card */
  how: string[];
};

export const ARCADE_GAMES: ArcadeGame[] = [
  {
    id: 'slalom', name: 'Sky Slalom', blurb: 'Race down the snowy sky mountain. Steer through the gate with the right answer!',
    learns: 'Quick facts', art: 'arcade/cab-slalom.webp', stars: [1500, 3500, 6500], secs: 75, color: '#3d9cf0',
    how: ['Steer left and right', 'Ride through the right answer', 'Right ones in a row build a combo'],
  },
  {
    id: 'catch', name: 'Glimmer Catch', blurb: 'Glimmers float down with sums on them. Catch every one that makes the number!',
    learns: 'Facts that make a number', art: 'arcade/cab-catch.webp', stars: [1200, 3000, 5500], secs: 60, color: '#4cb86a',
    how: ['Move your buddy and the net', 'Catch the ones that make the number', 'A golden Glimmer is worth a lot!'],
  },
  {
    id: 'tower', name: 'Tower Stack', blurb: 'Answer to drop the block. Quick and right lands it straight: build the tallest tower!',
    learns: 'Quick, careful facts', art: 'arcade/cab-tower.webp', stars: [1200, 3000, 5500], secs: 90, color: '#f08a3c',
    how: ['Type the answer to drop the block', 'Quick and right lands it straight', 'Wobbly towers can tumble!'],
  },
];
export const ARCADE: Record<ArcadeId, ArcadeGame> = Object.fromEntries(ARCADE_GAMES.map(g => [g.id, g])) as Record<ArcadeId, ArcadeGame>;

// ---------- the player's records ----------
export type ArcadeRecord = { best: number; stars: number; plays: number; daily?: { day: string; best: number }; lastAt?: number };
export type ArcadeSave = Partial<Record<ArcadeId, ArcadeRecord>>;
export const arcadeOf = (p: Profile): ArcadeSave => p.arcade ?? {};
export const recordOf = (p: Profile, id: ArcadeId): ArcadeRecord => arcadeOf(p)[id] ?? { best: 0, stars: 0, plays: 0 };
export function starsFor(id: ArcadeId, score: number): 0 | 1 | 2 | 3 {
  const [a, b, c] = ARCADE[id].stars;
  return score >= c ? 3 : score >= b ? 2 : score >= a ? 1 : 0;
}
/** The stars the Arcade counts toward "stars in any game" (new buddies): each game's best. */
export const arcadeStars = (p: Profile) => Object.values(arcadeOf(p)).reduce((t, r) => t + (r?.stars ?? 0), 0);

// ---------- the daily challenge ----------
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
/** Today's game: the three take turns, day by day. */
export function dailyGame(day = dayKey(Date.now())): ArcadeId {
  const n = Math.abs(hash(day)) % ARCADE_GAMES.length;
  return ARCADE_GAMES[n].id;
}
/** The same course for everyone today. */
export const dailySeed = (id: ArcadeId, day = dayKey(Date.now())) => Math.abs(hash(`${day}:${id}`));
/** Beat this score in today's challenge for the bonus: the two-star score. */
export const dailyGoal = (id: ArcadeId) => ARCADE[id].stars[1];
export const DAILY_SHELLS = 25;
export const dailyBeaten = (p: Profile, id: ArcadeId, day = dayKey(Date.now())) => { const d = recordOf(p, id).daily; return !!d && d.day === day && d.best >= dailyGoal(id); };

// ---------- questions: the player's own facts, the shaky ones more often ----------
export type PoolFact = { f: Fact; stage: number; w?: number };
/** Deals facts from the player's pool: weak ones up to three times as likely, never the same one twice
 *  close together. */
export class FactDeck {
  private recent: string[] = [];
  constructor(readonly facts: PoolFact[], readonly rng: Rng) {}
  next(avoid: (f: Fact) => boolean = () => false): Fact {
    const ok = this.facts.filter(x => !this.recent.includes(factId(x.f)) && !avoid(x.f));
    const from = ok.length ? ok : this.facts;
    const tot = from.reduce((a, x) => a + 1 + 2 * (x.w ?? 0), 0);
    let r = this.rng() * tot, pick = from[from.length - 1];
    for (const x of from) { r -= 1 + 2 * (x.w ?? 0); if (r <= 0) { pick = x; break; } }
    this.recent.push(factId(pick.f));
    if (this.recent.length > Math.min(4, Math.max(1, this.facts.length - 2))) this.recent.shift();
    return pick.f;
  }
}
/** Wrong answers that look right: one off, the next row of the table, the sum for a product... */
export function distractors(f: Fact, n: number, rng: Rng): number[] {
  const ans = answerOf(f), op: Op = f.op ?? 'x', out = new Set<number>();
  const near = op === 'x' ? [ans + f.a, ans - f.a, ans + f.b, ans - f.b, f.a + f.b, ans + 1, ans - 1, ans + 2, ans - 2, ans + 10]
    : op === '+' ? [ans + 1, ans - 1, ans + 2, ans - 2, ans + 10, ans - 10, Math.abs(f.a - f.b)]
    : op === '-' ? [ans + 1, ans - 1, ans + 2, ans - 2, f.a + f.b, ans + 10]
    : [ans + 1, ans - 1, ans + 2, ans - 2, f.b, Math.round(f.a / Math.max(1, f.b - 1))];
  const cands = near.filter(v => Number.isInteger(v) && v >= 0 && v !== ans);
  while (out.size < n && cands.length) out.add(cands.splice(Math.floor(rng() * cands.length), 1)[0]);
  let k = 3;
  while (out.size < n) { const v = ans + k * (rng() < 0.5 ? -1 : 1); if (v >= 0 && v !== ans) out.add(v); k++; }
  return [...out];
}
export const factText = (f: Fact) => `${f.a} ${opSign(f)} ${f.b}`;
export const seeded = (seed: number) => mulberry32(seed >>> 0);

// ---------- the end of a round ----------
export type Answered = { f: Fact; ok: boolean; thinkMs: number };
export type ArcadeRun = { id: ArcadeId; score: number; ms: number; at: number; answered: Answered[]; daily: boolean };
export type ArcadeOutcome = Settled & {
  profile: Profile; score: number; stars: 0 | 1 | 2 | 3; best: number; newBest: boolean;
  /** the daily challenge's goal was beaten for the first time today (and the bonus shells) */
  dailyBeat: boolean; dailyShells: number;
};

/** The treasure a round finds: up the ladder as the score goes past the three-star score. */
export function arcadeTreasure(id: ArcadeId, score: number): number {
  const r = score / ARCADE[id].stars[2];
  return r < 0.2 ? -1 : Math.min(9, Math.floor(r * 6.5));
}

/** A finished round: the fact memory, the record, the daily challenge, and the shared practice payout. */
export function applyArcade(p0: Profile, run: ArcadeRun): ArcadeOutcome {
  const p: Profile = structuredClone(p0);
  const grown = !!p.settings.grown;
  // every answer counts for the fact memory, as in a trip
  const m = (p.math = mathOf(p)), dk = dayKey(run.at), fastMs = m.fastMs ?? FAST_MS;
  for (const a of run.answered) { const id = factId(a.f); m.facts[id] = updateFact(m.facts[id], { ok: a.ok, thinkMs: a.thinkMs, day: dk, at: run.at, fastMs }); seedPartner(m.facts, a.f); }
  // the record and the daily challenge
  const save = (p.arcade ??= {});
  const was = save[run.id] ?? { best: 0, stars: 0, plays: 0 };
  const stars = starsFor(run.id, run.score);
  const rec: ArcadeRecord = { ...was, best: Math.max(was.best, run.score), stars: Math.max(was.stars, stars), plays: was.plays + 1, lastAt: run.at };
  let dailyBeat = false;
  if (run.daily) {
    const before = was.daily?.day === dk ? was.daily.best : 0;
    rec.daily = { day: dk, best: Math.max(before, run.score) };
    dailyBeat = before < dailyGoal(run.id) && run.score >= dailyGoal(run.id);
  }
  save[run.id] = rec;
  // the buddy's counters (stickers read them)
  const pal = buddyPal(p);
  pal.runs++;
  if (stars === 3) pal.stars3++;
  // medals: three stars, no slips over a good round, ten quick ones in a row
  const right = run.answered.filter(a => a.ok).length;
  const medals: string[] = [];
  if (stars === 3) medals.push('three');
  if (run.answered.length >= 10 && right === run.answered.length) medals.push('clean');
  let row = 0, bestRow = 0;
  for (const a of run.answered) { row = a.ok && a.thinkMs <= fastMs ? row + 1 : 0; bestRow = Math.max(bestRow, row); }
  if (bestRow >= 10) medals.push('quickdraw');
  const done = settlePractice(p, {
    at: run.at, ms: run.ms, finished: true, stars, medals, right,
    xp: n => Math.round((24 + right * 2 + stars * 8 + Math.min(n, 5) * 4) * (grown ? 0.8 : 1)),
    treasure: arcadeTreasure(run.id, run.score),
  });
  const dailyShells = dailyBeat ? earnShells(p, DAILY_SHELLS) : 0;
  return { ...done, profile: p, score: run.score, stars, best: rec.best, newBest: run.score > was.best && was.plays > 0, dailyBeat, dailyShells };
}
