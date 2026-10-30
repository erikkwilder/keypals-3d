// Achievements. Medals can be won on any run (several at once, mix and match); badges are
// won once and live in the sticker book. Some badges unlock outfits for your buddy.

import type { FriendId } from '../art/cast';
import { RIDES } from './rides';

export type Icon =
  | 'sparkle' | 'target' | 'wave' | 'trophy' | 'bolt' | 'heart' | 'eye' | 'star' | 'stars' | 'arrow'
  | 'book' | 'ring' | 'house' | 'tree' | 'burrow' | 'cliff' | 'mountain' | 'shell' | 'road' | 'clock'
  | 'words' | 'semi' | 'space' | 'gift' | 'crown' | 'wand' | 'ride' | 'friend' | 'hand';

export type AwardDef = {
  id: string;
  kind: 'medal' | 'badge';
  name: string;
  desc: string; // how to earn it (shown on locked stickers too)
  icon: Icon;
  hue: number;
  ride?: number; // ride tier for ride icons
  friend?: FriendId; // friend face for fan clubs
  unlocks?: string;
  secret?: boolean;
  /** which game a medal comes from, for the medal book: typing only, math only, or any game */
  game?: 'typing' | 'math' | 'any';
};

const M = (id: string, name: string, desc: string, icon: Icon, hue: number, extra: Partial<AwardDef> = {}): AwardDef => ({ id, kind: 'medal', name, desc, icon, hue, ...extra });
const B = (id: string, name: string, desc: string, icon: Icon, hue: number, extra: Partial<AwardDef> = {}): AwardDef => ({ id, kind: 'badge', name, desc, icon, hue, ...extra });

const ALL_MEDALS: AwardDef[] = [
  M('clean', 'Clean Sweep', 'Finish a lesson or trip with no mistakes at all.', 'sparkle', 160, { game: 'any' }),
  M('sharp', 'Sharp Eyes', 'Finish a lesson 97% right or better (a perfect one is a Clean Sweep).', 'target', 200, { game: 'typing' }),
  M('steady', 'Steady Paws', 'Keep a nice, even rhythm.', 'wave', 228),
  M('pb', 'Personal Best', 'Beat your best: type faster than ever, or ride faster than ever on a trip.', 'trophy', 48, { game: 'any' }),
  M('ride-record', 'Ride Record', 'Ride faster than ever on a lesson.', 'ride', 290, { game: 'any' }),
  ...RIDES.slice(1).map((r, i) => M(`ride-${r.id}`, ['Off and Running', 'Skate Starter', 'Pedal Pusher', 'Road Cruiser', 'Rocket Rider'][i], i === 0 ? 'Break into a run during a lesson or trip.' : `Reach the ${r.name} during a lesson or trip.`, 'ride', [338, 160, 200, 300, 52][i], { ride: i + 1, game: 'any' })),
  M('streak-25', 'Hot Streak', '25 keys or more in a row without a slip.', 'bolt', 52),
  M('streak-50', 'Blazing Streak', '50 keys in a row without a slip.', 'bolt', 330),
  M('streak-100', 'Unstoppable', '100 keys in a row without a slip.', 'bolt', 268),
  M('comeback', 'Comeback Kid', 'Make a few slips, then finish strong: the last 15 keys or 8 answers all right.', 'heart', 345, { game: 'any' }),
  M('nopeek', 'No Peeking', 'Finish a lesson with the keyboard picture hidden.', 'eye', 250),
  M('hands-free', 'Hands Free', 'Finish a lesson with the hands guide hidden.', 'hand', 300),
  M('touch-typist', 'Touch Typist', 'Keyboard and hands both hidden, 95% or better.', 'crown', 268),
  M('firsttry', 'First Try', 'Pass a lesson or trip on your first go.', 'star', 52, { game: 'any' }),
  M('three', 'Triple Star', 'Earn all three stars on a lesson or trip.', 'stars', 48, { game: 'any' }),
  M('speedy', 'Speeding Up', 'Type faster than your usual speed.', 'arrow', 180),
  M('marathon', 'Long Haul', 'Finish a long run (300+ letters).', 'book', 140),
  M('goal', 'Goal Reached', "Hit today's practice goal (typing and math both count).", 'ring', 100, { game: 'any' }),
  M('quickdraw', 'Quick Draw', 'Answer 10 math facts fast in a row.', 'bolt', 200, { game: 'math' }),
  M('bloom', 'In Bloom', 'A math fact blooms in your Fact Garden.', 'tree', 120, { game: 'math' }),
];

// Pared down (2026-10-28): a good run used to win six or seven medals at once, many saying the same
// thing. These are no longer won; old counts stay in saved games, and the book no longer shows them:
// Steady Paws (an even rhythm: hard to see or aim for), Speeding Up (Personal Best says it), the five ride
// medals and Ride Record (the speed-step stickers and Personal Best say them), Long Haul (it paid for a
// long lesson, not for anything the child did).
// Brought back (2026-10-30), each the next step of a skill, and a run wins only the top one of each family
// (typingMedals and mathComeback below): Sharp Eyes under Clean Sweep (97% right: the accuracy most kids
// can reach on a long lesson); Blazing Streak and Unstoppable over Hot Streak (50 and 100 keys in a row);
// No Peeking and Hands Free under Touch Typist (the first steps of typing without looking); and Comeback
// Kid (slips, then a strong finish: it pays for not giving up, in typing and math).
const RETIRED_MEDALS = new Set(['steady', 'ride-record', ...RIDES.slice(1).map(r => `ride-${r.id}`), 'speedy', 'marathon']);
/** the medals a run can win: fifteen of them */
export const MEDALS: AwardDef[] = ALL_MEDALS.filter(m => !RETIRED_MEDALS.has(m.id));

export const BADGES: AwardDef[] = [
  B('hello', 'Hello, Island!', 'Finish your very first lesson.', 'gift', 330),
  B('region-village', 'Home Sweet Home', 'Finish Home Row Island.', 'house', 140),
  B('region-treetops', 'Treetop Explorer', 'Finish Top Row Treetops.', 'tree', 120),
  B('region-burrows', 'Burrow Buddy', 'Finish Bottom Row Burrows.', 'burrow', 290),
  B('region-cliffs', 'Cliff Climber', 'Finish Capital Cliffs.', 'cliff', 250),
  B('region-ridge', 'Ridge Ranger', 'Finish Number Ridge.', 'mountain', 205),
  B('region-shores', 'Shore Seeker', 'Finish Symbol Shores.', 'shell', 185),
  B('stars-10', 'Star Collector', 'Collect 10 stars.', 'star', 48),
  B('stars-50', 'Star Gazer', 'Collect 50 stars.', 'stars', 48),
  B('stars-100', 'Star Keeper', 'Collect 100 stars.', 'stars', 300),
  B('stars-140', 'Superstar', 'Collect 140 stars.', 'crown', 48),
  ...RIDES.slice(1).map((r, i) => B(`first-${r.id}`, `First ${r.name}`, `Reach the ${r.name} for the first time.`, 'ride', [338, 160, 200, 300, 52][i], { ride: i + 1 })),
  B('semi-wink', 'Semicolon Star', 'Type 50 semicolons.', 'semi', 322),
  B('goal-1', 'Goal Getter', 'Hit your daily goal for the first time.', 'ring', 100),
  B('goal-5', 'Goal Hero', 'Hit your daily goal on 5 different days.', 'ring', 160),
  B('goal-20', 'Goal Legend', 'Hit your daily goal on 20 different days.', 'ring', 270),
  B('time-30', 'Warmed Up', 'Practice for 30 minutes in all.', 'clock', 200),
  B('time-120', 'Practice Pro', 'Practice for 2 hours in all.', 'clock', 230),
  B('time-600', 'Keyboard Champion', 'Practice for 10 hours in all.', 'clock', 280),
  B('words-500', 'Word Walker', 'Type 500 words.', 'words', 170),
  B('words-2500', 'Word Runner', 'Type 2,500 words.', 'words', 210),
  B('words-10000', 'Word Rocket', 'Type 10,000 words.', 'words', 300),
  B('perfect-5', 'Perfect Five', 'Get 100% on five runs.', 'sparkle', 160),
  B('stories-5', 'Bookworm', 'Type five stories or fact runs.', 'book', 140),
  B('custom-1', 'My Own Words', 'Practice your own word list.', 'wand', 280),
  B('triple-village', 'Island Star', 'Three stars on every Home Row Island lesson.', 'crown', 140, { secret: true }),
];

export const AWARD: Record<string, AwardDef> = Object.fromEntries([...ALL_MEDALS, ...BADGES].map(a => [a.id, a]));

/** A typing lesson's medals, at most one of each family: no slips (Clean Sweep, else Sharp Eyes), a
 *  streak (Unstoppable, else Blazing Streak, else Hot Streak), typing without looking (Touch Typist, else
 *  No Peeking, else Hands Free); plus Comeback Kid, Personal Best, First Try and Triple Star. */
export function typingMedals(r: {
  finished: boolean; chars: number; errors: number; acc: number; maxStreak: number; finalStreak: number;
  keyboardHidden: boolean; handsHidden: boolean; passedNow: boolean; firstGo: boolean; personalBest: boolean; stars: number;
}): string[] {
  const m: string[] = [];
  if (r.finished && r.chars >= 15 && r.errors === 0) m.push('clean');
  else if (r.finished && r.chars >= 50 && r.acc >= 0.97) m.push('sharp');
  if (r.personalBest) m.push('pb');
  if (r.maxStreak >= 100) m.push('streak-100');
  else if (r.maxStreak >= 50) m.push('streak-50');
  else if (r.maxStreak >= 25) m.push('streak-25');
  if (r.finished && r.errors >= 3 && r.finalStreak >= 15) m.push('comeback');
  if (r.finished && r.keyboardHidden && r.handsHidden && r.acc >= 0.95) m.push('touch-typist');
  else if (r.finished && r.keyboardHidden) m.push('nopeek');
  else if (r.finished && r.handsHidden) m.push('hands-free');
  if (r.passedNow && r.firstGo) m.push('firsttry');
  if (r.stars === 3) m.push('three');
  return m;
}

/** Comeback Kid in a math trip: three or more missed, and the last eight answers all right. */
export function mathComeback(results: { ok: boolean; intro?: boolean }[], finished: boolean): boolean {
  const scored = results.filter(r => !r.intro);
  let tail = 0;
  for (let i = scored.length - 1; i >= 0 && scored[i].ok; i--) tail++;
  return finished && scored.length - scored.filter(r => r.ok).length >= 3 && tail >= 8;
}
