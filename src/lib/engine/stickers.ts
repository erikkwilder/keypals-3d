// Stickers are earned per buddy: every buddy has their own album of the same set, so
// collecting with Dino doesn't fill Kiki's book. Each sticker knows how it looks (shape,
// background, pose) and how it's earned (a check over that friend's progress and the run).

import type { FriendId } from '../art/cast';
import { RIDES } from './rides';
import type { RegionId } from './course';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type StickerShape = 'circle' | 'star' | 'heart' | 'cloud' | 'shield' | 'burst' | 'ticket' | 'hex';
export type StickerBg = 'rays' | 'dots' | 'stripes' | 'confetti' | 'stars' | 'waves' | 'checks' | 'plain';
export type StickerPose = 'cheer' | 'wave' | 'proud' | 'love' | 'cool' | 'sleep' | 'surprised' | 'run' | 'ride' | 'hug' | 'wink';

export type PalProgress = {
  xp: number; level: number; outfit: string;
  stickers: Record<string, number>; medals: Record<string, number>;
  runs: number; chars: number; stars3: number; perfect: number; perfectRow: number; sharp: number;
  bestStreak: number; bestWpm: number; ownKeys: number; rideBest: number; medalsTotal: number;
  goalDays: string[]; regions: string[]; comebacks: number; naps: number; seen: string[];
  /** the celebration at the finish (a dance id, or 'cheer') */
  dance: string;
  /** the best treasure step any run has earned (-1: none yet) */
  treasureBest: number;
  /** celebrations danced at the finish */
  dances: number;
};

export const newPalProgress = (): PalProgress => ({
  xp: 0, level: 1, outfit: 'none', stickers: {}, medals: {}, runs: 0, chars: 0, stars3: 0, perfect: 0, perfectRow: 0, sharp: 0,
  bestStreak: 0, bestWpm: 0, ownKeys: 0, rideBest: 0, medalsTotal: 0, goalDays: [], regions: [], comebacks: 0, naps: 0, seen: [],
  dance: 'dance_hiphop', treasureBest: -1, dances: 0,
});

export type StickerCheck = (p: PalProgress, ctx: { grown: boolean; friend: FriendId }) => boolean;

export type StickerDef = {
  id: string; name: string; desc: string; rarity: Rarity;
  shape: StickerShape; bg: StickerBg; hue: number; hue2: number;
  pose: StickerPose; prop?: 'ride' | 'trophy' | 'star' | 'mountain' | 'number' | 'key' | 'heart' | 'book' | 'clock' | 'medal' | 'crown' | 'bolt' | 'target' | 'treasure' | 'music';
  ride?: number; number?: string; region?: RegionId;
  check: StickerCheck;
};

const S = (d: StickerDef) => d;
const REGION_STICKERS: [RegionId, string, string, number][] = [
  ['village', 'Island Parade', 'Pass the Island Parade.', 140],
  ['treetops', 'Canopy Champ', 'Pass the Canopy Run.', 120],
  ['burrows', 'Lantern Hero', 'Pass the Lantern Run.', 268],
  ['cliffs', 'Summit Star', 'Pass the Summit Run.', 250],
  ['ridge', 'Peak Pal', 'Pass the Peak Run.', 205],
  ['shores', 'Lighthouse Keeper', 'Pass the Lighthouse Run.', 185],
  ['road', 'Road Tripper', 'Finish an Open Road lesson.', 300],
];

const SPEEDS = [10, 15, 20, 28, 36];

export const STICKERS: StickerDef[] = [
  // journey
  ...REGION_STICKERS.map(([r, name, desc, hue], i) => S({ id: `trip-${r}`, name, desc: `${desc}`, rarity: i < 2 ? 'common' : i < 5 ? 'rare' : 'epic', shape: 'shield', bg: 'rays', hue, hue2: (hue + 40) % 360, pose: 'proud', prop: 'mountain', region: r, check: p => p.regions.includes(r) })),
  // rides
  ...RIDES.slice(1).map((r, i) => S({ id: `ridestar-${r.id}`, name: `${r.name} Star`, desc: i === 0 ? 'Break into a run during a lesson.' : `Reach the ${r.name} during a lesson.`, rarity: i < 2 ? 'common' : i < 3 ? 'rare' : i < 4 ? 'epic' : 'legendary', shape: i === 4 ? 'burst' : 'circle', bg: i >= 3 ? 'stars' : 'stripes', hue: [338, 160, 200, 300, 52][i], hue2: [200, 200, 160, 338, 330][i], pose: 'ride', prop: 'ride', ride: i + 1, check: p => p.rideBest >= i + 1 })),
  // three-star runs
  ...[1, 5, 15, 30].map((n, i) => S({ id: `three-${n}`, name: ['Triple Treat', 'Star Sprinkle', 'Star Shower', 'Galaxy Brain'][i], desc: n === 1 ? 'Earn three stars on a lesson.' : `Earn three stars ${n} times.`, rarity: (['common', 'rare', 'epic', 'legendary'] as Rarity[])[i], shape: 'star', bg: 'stars', hue: 48, hue2: 330, pose: 'cheer', prop: 'star', number: n > 1 ? String(n) : undefined, check: p => p.stars3 >= n })),
  // accuracy
  S({ id: 'clean-1', name: 'Squeaky Clean', desc: 'Finish a lesson with no mistakes.', rarity: 'common', shape: 'cloud', bg: 'dots', hue: 190, hue2: 160, pose: 'wink', prop: 'target', check: p => p.perfect >= 1 }),
  S({ id: 'clean-5', name: 'Spotless', desc: 'Five lessons with no mistakes.', rarity: 'rare', shape: 'cloud', bg: 'dots', hue: 175, hue2: 220, pose: 'cool', prop: 'target', number: '5', check: p => p.perfect >= 5 }),
  S({ id: 'clean-row', name: 'Hat Trick', desc: 'Three perfect lessons in a row.', rarity: 'epic', shape: 'burst', bg: 'confetti', hue: 160, hue2: 52, pose: 'proud', prop: 'crown', check: p => p.perfectRow >= 3 }),
  S({ id: 'sharp-10', name: 'Eagle Eyes', desc: '97% or better, ten times.', rarity: 'rare', shape: 'hex', bg: 'checks', hue: 210, hue2: 268, pose: 'surprised', prop: 'target', number: '10', check: p => p.sharp >= 10 }),
  // streaks
  ...[25, 50, 100, 200].map((n, i) => S({ id: `streak-${n}`, name: ['On a Roll', 'Unstoppable', 'Lightning Paws', 'Legend Streak'][i], desc: `${n} keys in a row without a slip.`, rarity: (['common', 'rare', 'epic', 'legendary'] as Rarity[])[i], shape: 'burst', bg: 'rays', hue: [52, 330, 268, 200][i], hue2: [330, 268, 200, 160][i], pose: 'run', prop: 'bolt', number: String(n), check: p => p.bestStreak >= n })),
  // speed
  ...SPEEDS.map((w, i) => S({ id: `speed-${w}`, name: ['Zippy', 'Quick Paws', 'Speedy', 'Rocket Fingers', 'Blur'][i], desc: `Type ${w} words a minute (grown-ups: ${Math.round(w * 1.8)}).`, rarity: i < 2 ? 'common' : i < 4 ? 'rare' : 'epic', shape: 'ticket', bg: 'stripes', hue: [160, 190, 220, 268, 330][i], hue2: [52, 160, 190, 220, 268][i], pose: 'run', prop: 'clock', number: String(w), check: (p, c) => p.bestWpm >= (c.grown ? w * 1.8 : w) })),
  // dedication
  ...[1, 10, 25, 50, 100].map((n, i) => S({ id: `runs-${n}`, name: ['Hello, Friend!', 'Pals', 'Best Buds', 'Inseparable', 'Forever Friends'][i], desc: n === 1 ? 'Finish your first lesson together.' : `Finish ${n} lessons together.`, rarity: i < 2 ? 'common' : i < 4 ? 'rare' : 'legendary', shape: 'heart', bg: 'dots', hue: [338, 330, 320, 300, 280][i], hue2: [52, 338, 52, 338, 52][i], pose: i === 0 ? 'wave' : 'hug', prop: 'heart', number: n > 1 ? String(n) : undefined, check: p => p.runs >= n })),
  ...[1000, 5000, 20000].map((n, i) => S({ id: `chars-${n}`, name: ['Word Nibbler', 'Bookworm', 'Library Legend'][i], desc: `Type ${n.toLocaleString('en-US')} letters together.`, rarity: (['common', 'rare', 'epic'] as Rarity[])[i], shape: 'hex', bg: 'waves', hue: [140, 120, 100][i], hue2: [200, 160, 52][i], pose: 'cool', prop: 'book', check: p => p.chars >= n })),
  // levels
  ...[5, 10, 20, 30].map((n, i) => S({ id: `level-${n}`, name: `Friendship ${n}`, desc: `Reach friendship ${n} with this buddy.`, rarity: (['common', 'rare', 'epic', 'legendary'] as Rarity[])[i], shape: 'shield', bg: 'confetti', hue: [200, 268, 330, 48][i], hue2: [160, 200, 268, 330][i], pose: 'proud', prop: 'number', number: String(n), check: p => p.level >= n })),
  // treasure and dancing
  ...[3, 6, 9].map((t, i) => S({ id: `treasure-${t}`, name: ['Treasure Hunter', 'Treasure Keeper', 'Dragon Hoard'][i], desc: `Earn a ${['Copper Coin', 'Ruby', 'Rainbow Star'][i]} or better on a run.`, rarity: (['common', 'rare', 'legendary'] as Rarity[])[i], shape: 'hex', bg: 'rays', hue: [30, 345, 300][i], hue2: [52, 268, 52][i], pose: 'cheer', prop: 'treasure', check: p => p.treasureBest >= t })),
  ...[1, 10, 50].map((n, i) => S({ id: `dance-${n}`, name: ['First Dance', 'Dance Party', 'Dance Legend'][i], desc: n === 1 ? 'Dance at the finish line.' : `Dance at the finish line ${n} times.`, rarity: (['common', 'rare', 'epic'] as Rarity[])[i], shape: 'star', bg: 'confetti', hue: [300, 268, 330][i], hue2: [52, 200, 160][i], pose: 'cheer', prop: 'music', number: n > 1 ? String(n) : undefined, check: p => p.dances >= n })),
  // goals, medals, comebacks
  ...[1, 5, 15].map((n, i) => S({ id: `goal-${n}`, name: ['Goal!', 'Goal Getter', 'Goal Legend'][i], desc: n === 1 ? 'Hit your daily goal together.' : `Hit your daily goal on ${n} days together.`, rarity: (['common', 'rare', 'epic'] as Rarity[])[i], shape: 'circle', bg: 'rays', hue: [100, 140, 170][i], hue2: [52, 52, 200][i], pose: 'cheer', prop: 'target', number: n > 1 ? String(n) : undefined, check: p => p.goalDays.length >= n })),
  ...[10, 50].map((n, i) => S({ id: `medals-${n}`, name: ['Medal Magnet', 'Trophy Case'][i], desc: `Win ${n} medals together.`, rarity: (['rare', 'epic'] as Rarity[])[i], shape: 'shield', bg: 'stars', hue: [48, 46][i], hue2: [268, 330][i], pose: 'proud', prop: 'medal', number: String(n), check: p => p.medalsTotal >= n })),
  S({ id: 'comeback', name: 'Never Give Up', desc: 'Shake off three slips and finish strong.', rarity: 'common', shape: 'heart', bg: 'waves', hue: 345, hue2: 200, pose: 'cheer', prop: 'heart', check: p => p.comebacks >= 1 }),
  S({ id: 'comeback-5', name: 'Bounce Back', desc: 'Make five comebacks.', rarity: 'rare', shape: 'heart', bg: 'waves', hue: 320, hue2: 52, pose: 'proud', prop: 'heart', number: '5', check: p => p.comebacks >= 5 }),
  S({ id: 'sleepy', name: 'Power Nap', desc: 'Take a break mid-lesson, then finish it.', rarity: 'common', shape: 'cloud', bg: 'stars', hue: 240, hue2: 268, pose: 'sleep', check: p => p.naps >= 1 }),
];

export const STICKER: Record<string, StickerDef> = Object.fromEntries(STICKERS.map(s => [s.id, s]));
export const STICKERS_PER_PAL = STICKERS.length;

// ---------- levels and XP ----------
export const xpToNext = (level: number) => 80 + 30 * (level - 1);
export function levelFromXp(xp: number) {
  let lvl = 1, need = xpToNext(1), rest = xp;
  while (rest >= need && lvl < 60) { rest -= need; lvl++; need = xpToNext(lvl); }
  return { level: lvl, into: rest, need };
}

// ---------- medal tiers ----------
export const MEDAL_TIERS = [
  { name: 'Rose', at: 1 }, { name: 'Silver', at: 5 }, { name: 'Gold', at: 15 }, { name: 'Rainbow', at: 40 },
];
export function medalTier(count: number) {
  let t = -1;
  MEDAL_TIERS.forEach((m, i) => { if (count >= m.at) t = i; });
  return t;
}
