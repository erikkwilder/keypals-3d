// The Number Playground: math that isn't about speed. Three calm games with no clock, each with five
// levels and up to three stars a round:
//   Number Line Hop  where does a number go on a line from 0 to 10, 20, 100 or 1000? (estimating, place)
//   Make Ten Bubbles pop two bubbles that make 10 (then 5, 20 and 100): number bonds
//   Build It         build a number from hundreds, tens and ones: place value
// Rounds feed the same friendship, outfits, dances, stickers and daily minutes as every other game.
import type { Profile, MedalWin, XpInfo } from '../engine/profile';
import { buddyPal } from '../engine/profile';
import type { PalProgress, StickerDef } from '../engine/stickers';
import type { Reward } from '../engine/rewards';
import { settlePractice } from '../engine/settle';
import { mathOf } from './progress';
import type { Rng } from '../engine/rng';

export type PlayGame = 'line' | 'bonds' | 'build';
export type PlayLevel = { n: number; title: string; hint: string };

export const PLAY_GAMES: { id: PlayGame; name: string; blurb: string; color: string; levels: PlayLevel[] }[] = [
  { id: 'line', name: 'Number Line Hop', blurb: 'Where does the number go? Tap the line and your buddy hops there.', color: '#3fa7e0', levels: [
    { n: 1, title: '0 to 10', hint: 'Every step is one.' },
    { n: 2, title: '0 to 20', hint: '10 is right in the middle.' },
    { n: 3, title: '0 to 100 in tens', hint: '50 is halfway.' },
    { n: 4, title: '0 to 100', hint: 'Find the ten first, then the ones.' },
    { n: 5, title: '0 to 1000', hint: 'Find the hundred first.' },
  ] },
  { id: 'bonds', name: 'Make Ten Bubbles', blurb: 'Pop two bubbles that add up to the number. No clock, no rush.', color: '#ef6fa6', levels: [
    { n: 1, title: 'Make 5', hint: '2 and 3 make 5.' },
    { n: 2, title: 'Make 10', hint: '7 and 3 make 10.' },
    { n: 3, title: 'Make 20', hint: '12 and 8 make 20.' },
    { n: 4, title: 'Make 100 in tens', hint: '30 and 70 make 100.' },
    { n: 5, title: 'Make 100', hint: '64 and 36 make 100: the ones make 10, the tens make 90.' },
  ] },
  { id: 'build', name: 'Build It', blurb: 'Build the number with hundreds, tens and ones blocks.', color: '#ef7d2b', levels: [
    { n: 1, title: 'Tens and ones to 50', hint: '34 is 3 tens and 4 ones.' },
    { n: 2, title: 'Tens and ones to 99', hint: '78 is 7 tens and 8 ones.' },
    { n: 3, title: 'Hundreds to 500', hint: '253 is 2 hundreds, 5 tens and 3 ones.' },
    { n: 4, title: 'Hundreds to 999', hint: 'Start with the hundreds.' },
    { n: 5, title: 'Watch the zeros', hint: '405 has no tens at all.' },
  ] },
];
export const PLAY_GAME = Object.fromEntries(PLAY_GAMES.map(g => [g.id, g])) as Record<PlayGame, (typeof PLAY_GAMES)[number]>;

// ---------- the games' numbers ----------

/** Number Line Hop: the line's end, its ticks and labels, and the numbers to place. */
export function lineSpec(level: number) {
  return [
    { max: 10, step: 1, labels: [0, 5, 10] },
    { max: 20, step: 1, labels: [0, 10, 20] },
    { max: 100, step: 10, labels: [0, 50, 100] },
    { max: 100, step: 10, labels: [0, 50, 100] },
    { max: 1000, step: 100, labels: [0, 500, 1000] },
  ][Math.max(0, Math.min(4, level - 1))];
}
export function lineNumbers(level: number, rng: Rng, count = 8): number[] {
  const { max, step } = lineSpec(level);
  const out: number[] = [];
  while (out.length < count) {
    let n = level === 3 ? step * (1 + Math.floor(rng() * 9)) : level === 5 ? 10 * (1 + Math.floor(rng() * 99)) : 1 + Math.floor(rng() * (max - 1));
    if (level === 4 && n % 10 === 0) n += 3;
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
/** Points for a placement: how close, as a share of the whole line. */
export function linePoints(target: number, placed: number, max: number): 0 | 1 | 2 | 3 {
  const e = Math.abs(target - placed) / max;
  return e <= 0.02 ? 3 : e <= 0.05 ? 2 : e <= 0.1 ? 1 : 0;
}

/** Make Ten Bubbles: the number to make, and a fresh pair that makes it. */
export const bondTarget = (level: number) => [5, 10, 20, 100, 100][Math.max(0, Math.min(4, level - 1))];
export function bondPair(level: number, rng: Rng): [number, number] {
  const t = bondTarget(level);
  // 0 + 5 now and then, but mostly pairs where both numbers count
  const a = level === 4 ? 10 * (1 + Math.floor(rng() * 9)) : level === 5 ? 11 + Math.floor(rng() * 78) : rng() < 0.1 ? (rng() < 0.5 ? 0 : t) : 1 + Math.floor(rng() * (t - 1));
  return [a, t - a];
}

/** Build It: the numbers to build. */
export function buildNumbers(level: number, rng: Rng, count = 6): number[] {
  const out: number[] = [];
  while (out.length < count) {
    const r = () => rng();
    let n = level === 1 ? 10 + Math.floor(r() * 41) : level === 2 ? 10 + Math.floor(r() * 90) : level === 3 ? 100 + Math.floor(r() * 401) : level === 4 ? 100 + Math.floor(r() * 900) : 0;
    if (level === 5) { const h = 1 + Math.floor(r() * 9), t = r() < 0.5 ? 0 : Math.floor(r() * 10), o = t === 0 ? 1 + Math.floor(r() * 9) : 0; n = h * 100 + t * 10 + o; }
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

/** Stars for a round: a share of the best possible (line), or by slips (bubbles, build). Finishing earns one. */
// Stars are earned, like everywhere else: a round with lots of misses gets none (and opens nothing).
export function lineStars(points: number, of: number): 0 | 1 | 2 | 3 { const r = points / Math.max(1, of); return r >= 0.8 ? 3 : r >= 0.55 ? 2 : r >= 0.3 ? 1 : 0; }
export function slipStars(slips: number): 0 | 1 | 2 | 3 { return slips <= 1 ? 3 : slips <= 4 ? 2 : slips <= 8 ? 1 : 0; }

// ---------- progress ----------

export type PlayRecord = { stars: number[]; plays: number; best?: number };
export const playOf = (p: Profile, g: PlayGame): PlayRecord => mathOf(p).play?.[g] ?? { stars: [], plays: 0 };
/** A level opens once the one before it has a star. */
export const playUnlocked = (p: Profile, g: PlayGame, level: number) => level === 1 || (playOf(p, g).stars[level - 2] ?? 0) > 0;
export const playNextLevel = (p: Profile, g: PlayGame) => { const r = playOf(p, g); for (let l = 1; l <= 5; l++) if (!(r.stars[l - 1] ?? 0)) return l; return 5; };

export type PlayOutcome = { eggsReady?: import('../adventure/glimmers').Rarity[]; shells?: number; buddies: import('../art/cast').FriendId[]; profile: Profile; xp: XpInfo; rewards: Reward[]; stickers: StickerDef[]; medals: MedalWin[]; newBest: boolean; opened: number | null; goalJustHit: boolean };

/** One finished round: its stars, friendship XP, rewards and stickers, and its minutes toward today's goal. */
export function applyPlay(p0: Profile, run: { game: PlayGame; level: number; stars: number; ms: number; at: number; right?: number }): PlayOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const play = (m.play ??= {});
  const rec = (play[run.game] ??= { stars: [], plays: 0 });
  const before = rec.stars[run.level - 1] ?? 0;
  const wasOpen = run.level < 5 && playUnlocked(p0, run.game, run.level + 1);
  rec.stars[run.level - 1] = Math.max(before, run.stars);
  rec.plays++;
  const opened = !wasOpen && run.level < 5 && run.stars > 0 ? run.level + 1 : null;
  // the buddy's counters, then the same ending as every practice game (playground minutes count toward
  // the goal too)
  const pal: PalProgress = buddyPal(p);
  pal.runs++;
  if (run.stars === 3) pal.stars3++;
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars: run.stars, medals: run.stars === 3 ? ['three'] : [], right: run.right ?? 8, xp: () => Math.round((25 + run.stars * 12 + run.level * 4) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, newBest: run.stars > before, opened };
}
