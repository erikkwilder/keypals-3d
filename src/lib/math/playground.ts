// The Number Playground: math that isn't about speed. Three calm games with no clock, each with five
// levels and up to three stars a round:
//   Number Line Hop  where does a number go on a line from 0 to 10, 20, 100 or 1000? (estimating, place)
//   Make Ten Bubbles pop two bubbles that make 10 (then 5, 20 and 100): number bonds
//   Build It         build a number from hundreds, tens and ones: place value
//   Market Stall     price your goods, then give shoppers their change: money (math/market/stall.ts)
//   Smoothie Lab     mix fruit until the colour matches: ratios and percents (math/ratios/lab.ts)
//   Star Sketch      plot the points of a picture on a coordinate grid: the map (math/integers/sketch.ts)
//   Spin Lab         pick what comes up most, then spin and watch a bar graph grow: chance (math/data/lab.ts)
//   Balance Scale    put weights on a balance until it's level, then say what a mystery box weighs
//                    (math/algebra/scale.ts)
// Rounds feed the same friendship, outfits, dances, stickers and daily minutes as every other game, and
// their first tries move the child's level the way a practice trip's do (math/skills/ability.ts).
import type { Profile, MedalWin, XpInfo } from '../engine/profile';
import { buddyPal } from '../engine/profile';
import type { PalProgress, StickerDef } from '../engine/stickers';
import type { Reward } from '../engine/rewards';
import { settlePractice } from '../engine/settle';
import { mathOf } from './progress';
import type { Rng } from '../engine/rng';
import { hasEvidence, noteAbility, pitch, TARGET } from './skills/ability';

export type PlayGame = 'line' | 'bonds' | 'build' | 'stall' | 'lab' | 'sketch' | 'chance' | 'scale';
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
  { id: 'stall', name: 'Market Stall', blurb: 'Price your goods, then give each shopper the right change. No clock, no rush.', color: '#e6a817', levels: [
    { n: 1, title: 'Change from 25¢', hint: 'Count up from the price to 25¢.' },
    { n: 2, title: 'Change from 50¢', hint: 'An apple at 35¢: 40¢, 50¢. That\'s 15¢ change.' },
    { n: 3, title: 'Change from $1', hint: 'Count up to the next quarter, then by quarters.' },
    { n: 4, title: 'Any price, from $1', hint: 'Pennies first, up to the next 5¢.' },
    { n: 5, title: 'Two things', hint: 'Add the two prices, then count up to $1.' },
  ] },
  { id: 'lab', name: 'Smoothie Lab', blurb: 'Mix fruit in the jug until it is the same colour as the glass. The same mix makes the same colour. No clock, no rush.', color: '#ef5f8a', levels: [
    { n: 1, title: 'One to one', hint: 'The same number of each fruit. Some glasses want a full jug: 3 and 3, 4 and 4.' },
    { n: 2, title: 'One to more', hint: '1 : 2 is one of these for every two of those, so 2 : 4 and 3 : 6 are the same mix.' },
    { n: 3, title: 'Match the colour', hint: 'No card: move your jug onto the glass on the colour bar.' },
    { n: 4, title: 'A bigger jug', hint: '6 strawberries for a 2 : 3 mix? 9 bananas.' },
    { n: 5, title: 'Percent smoothies', hint: '25% is a quarter of the fruit: in a jug of 8, that is 2.' },
  ] },
  { id: 'sketch', name: 'Star Sketch', blurb: 'Plot the points on the map and the stars join into a picture. No clock, no rush.', color: '#2c5275', levels: [
    { n: 1, title: 'Little pictures', hint: 'Across first, then up: (2, 4) is 2 across and 4 up.' },
    { n: 2, title: 'Bigger pictures', hint: 'Find the first number on the bottom line, then go up.' },
    { n: 3, title: 'All four corners', hint: 'Minus goes left or down: (−3, 2) is 3 left and 2 up.' },
    { n: 4, title: 'Mirror pictures', hint: 'Flip over the y-axis: the first number changes sign.' },
    { n: 5, title: 'Lake reflections', hint: 'Flip over the x-axis: the second number changes sign.' },
  ] },
  { id: 'chance', name: 'Spin Lab', blurb: 'Pick what will come up most, then spin and watch the bar graph grow. No clock, no rush.', color: '#e85d9a', levels: [
    { n: 1, title: 'Two colours', hint: 'The colour with more parts comes up more.' },
    { n: 2, title: 'Three colours', hint: 'Count the parts of each colour.' },
    { n: 3, title: 'Roll a die', hint: 'Every number is as likely. Watch them even out.' },
    { n: 4, title: 'Two dice', hint: '7 has the most ways: 1 and 6, 2 and 5, 3 and 4...' },
    { n: 5, title: 'Mixed up', hint: 'Lots of parts: count each colour.' },
  ] },
  { id: 'scale', name: 'Balance Scale', blurb: 'Put weights on the balance until it hangs level, then find what the mystery box weighs. No clock.', color: '#6c4fd8', levels: [
    { n: 1, title: 'One box', hint: 'Add weights until it\'s level: the box weighs the same.' },
    { n: 2, title: 'A box and weights', hint: 'Level at 8 with a box and 3? The box is 8 take away 3.' },
    { n: 3, title: 'Two boxes', hint: 'Two boxes balance 10? Share it: 5 each.' },
    { n: 4, title: 'Two boxes and weights', hint: 'Take the weights away first, then share.' },
    { n: 5, title: 'Three boxes and weights', hint: 'Take away, then share by 3.' },
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
/** Each game's skill, and the level each of its rungs is ready for (math/skills/ability.ts): the number
 *  line goes with counting on, the bubbles with adding facts, Build It with hundreds, the stall with change. */
const PLAY_SKILL: Record<PlayGame, { skill: string; level: number[] }> = {
  line: { skill: 'pv-count', level: [1, 2, 3, 4, 5, 5] },
  bonds: { skill: 'add-facts', level: [1, 2, 2, 3, 3, 4] },
  build: { skill: 'pv-hundreds', level: [2, 3, 4, 5, 5, 5] },
  stall: { skill: 'dm-change', level: [1, 2, 3, 4, 5, 5] },
  lab: { skill: 'rt-ratio', level: [1, 2, 3, 4, 5, 5] },
  sketch: { skill: 'in-quad', level: [1, 2, 3, 4, 5, 5] },
  chance: { skill: 'da-likely', level: [1, 2, 3, 4, 5, 5] },
  scale: { skill: 'al-missing', level: [1, 2, 3, 4, 5, 5] },
};
/** The level the child's practice says they're ready for (pitched easy: 90%), once there is practice to
 *  go by (0 before). It opens levels the way a star does and never closes one. */
export function readyLevel(p: Profile, g: PlayGame): number {
  const m = mathOf(p), s = PLAY_SKILL[g];
  if (!hasEvidence(m, s.skill)) return 0;
  return s.level[pitch(m, s.skill, TARGET.quick, { grown: !!p.settings.grown }) - 1];
}
/** A level opens once the one before it has a star, or when the child's practice says they're ready. */
export const playUnlocked = (p: Profile, g: PlayGame, level: number) => level === 1 || (playOf(p, g).stars[level - 2] ?? 0) > 0 || level <= readyLevel(p, g);
/** The level to play next: the first without a star, or where the child is ready for, if that's further. */
export const playNextLevel = (p: Profile, g: PlayGame) => {
  const r = playOf(p, g), ready = readyLevel(p, g);
  for (let l = 1; l <= 5; l++) if (!(r.stars[l - 1] ?? 0)) return Math.max(l, Math.min(5, ready));
  return 5;
};

/** The rung a game's level is asked at: the first rung it calls ready for that level. */
export function playRung(g: PlayGame, level: number): number {
  const l = PLAY_SKILL[g].level, i = l.findIndex(x => x >= level);
  return i < 0 ? l.length : i + 1;
}
/** First tries, the way a practice trip counts them: one question is one answer, right only if its first
 *  try was, so a child stuck on one question isn't marked down again for each go. */
export class FirstTries {
  readonly answers: boolean[] = [];
  private slipped = false;
  /** a wrong try at this question */
  miss() { if (!this.slipped) this.answers.push(false); this.slipped = true; }
  /** this question is done */
  hit() { if (!this.slipped) this.answers.push(true); this.slipped = false; }
}

export type PlayOutcome = { eggsReady?: import('../adventure/glimmers').Rarity[]; shells?: number; buddies: import('../art/cast').FriendId[]; profile: Profile; xp: XpInfo; rewards: Reward[]; stickers: StickerDef[]; medals: MedalWin[]; newBest: boolean; opened: number | null; goalJustHit: boolean };

/** One finished round: its stars, friendship XP, rewards and stickers, and its minutes toward today's goal. */
export function applyPlay(p0: Profile, run: { game: PlayGame; level: number; stars: number; ms: number; at: number; right?: number; answers?: boolean[] }): PlayOutcome {
  const p: Profile = structuredClone(p0);
  const m = (p.math = mathOf(p));
  const play = (m.play ??= {});
  const rec = (play[run.game] ??= { stars: [], plays: 0 });
  const before = rec.stars[run.level - 1] ?? 0;
  const wasOpen = run.level < 5 && playUnlocked(p0, run.game, run.level + 1);
  rec.stars[run.level - 1] = Math.max(before, run.stars);
  rec.plays++;
  // every first try moves the child's level for this game's skill, as in a practice trip (these games have
  // no clock, so a right answer counts as a quick one)
  const skill = PLAY_SKILL[run.game].skill, rung = playRung(run.game, run.level);
  noteAbility(m, (run.answers ?? []).map(ok => ({ skill, rung, ok, at: run.at })), 'trip', !!p.settings.grown);
  const opened = !wasOpen && run.level < 5 && run.stars > 0 ? run.level + 1 : null;
  // the buddy's counters, then the same ending as every practice game (playground minutes count toward
  // the goal too)
  const pal: PalProgress = buddyPal(p);
  pal.runs++;
  if (run.stars === 3) pal.stars3++;
  const done = settlePractice(p, { at: run.at, ms: run.ms, finished: true, stars: run.stars, medals: run.stars === 3 ? ['three'] : [], right: run.right ?? 8, xp: () => Math.round((25 + run.stars * 12 + run.level * 4) * (p.settings.grown ? 0.8 : 1)) });
  return { ...done, profile: p, newBest: run.stars > before, opened };
}
