// What friendship unlocks, buddy by buddy: outfits to wear and dances to celebrate with at the finish.
// They alternate, so every level or two brings something new. The treasure is separate: a picture
// for each run's score, ten steps from a pebble to a rainbow star.
import type { FriendId } from '../art/cast';

export type RewardKind = 'outfit' | 'dance';
export type Reward = { id: string; kind: RewardKind; name: string; level: number; rarity: 'common' | 'rare' | 'epic' | 'legendary'; notFor?: FriendId[] };

const R = (level: number, kind: RewardKind, id: string, name: string, rarity: Reward['rarity'] = 'common', notFor?: FriendId[]): Reward => ({ id, kind, name, level, rarity, ...(notFor ? { notFor } : {}) });

/**
 * Every buddy starts with a fist pump and one dance. Dances were checked on every buddy so hands never
 * pass through a head or hat (src/dev/danceCheck.ts); ones that did were left out, or left out just
 * for the buddy they bump (`notFor`). The classics (floss to moonwalk) are Mixamo and Sketchfab
 * dances remapped onto our skeletons (keypals-3d-spike/tools/blender/retarget.py); song titles are
 * kept out of the names.
 */
export const REWARDS: Reward[] = [
  // one new thing a level at first, two at a time later on
  R(1, 'dance', 'fistpump', 'Fist Pump'),
  R(1, 'dance', 'dance_hiphop', 'Hip Hop Bounce'),
  R(2, 'outfit', 'party_hat', 'Party Hat'),
  R(3, 'dance', 'dance_floss', 'The Floss'),
  R(4, 'outfit', 'flower_crown', 'Flower Crown'),
  R(5, 'dance', 'jump', 'Happy Jump'),
  R(6, 'outfit', 'propeller_cap', 'Propeller Cap', 'rare'),
  R(7, 'dance', 'dance_happyhands', 'Happy Hands', 'rare'),
  R(8, 'outfit', 'cowboy_hat', 'Cowboy Hat', 'rare'),
  R(9, 'dance', 'dance_chicken', 'Chicken Dance', 'rare'),
  R(9, 'dance', 'dance_hiphop2', 'Hip Hop Wave', 'rare'),
  R(10, 'outfit', 'pirate_hat', 'Pirate Hat', 'rare'),
  R(11, 'dance', 'dance_cardio', 'Cardio Groove', 'rare'),
  R(11, 'dance', 'dance_twist', 'The Twist', 'rare'),
  R(12, 'outfit', 'wizard_hat', 'Wizard Hat', 'epic'),
  R(13, 'dance', 'dance_boom', 'Boom Bounce', 'epic'),
  R(13, 'dance', 'dance_robot', 'The Robot', 'epic'),
  R(14, 'outfit', 'viking_helmet', 'Viking Helmet', 'epic'),
  R(15, 'dance', 'dance_hiphop3', 'Hip Hop Shuffle', 'epic'),
  R(15, 'dance', 'dance_hype', 'Hype', 'epic'),
  R(16, 'outfit', 'top_hat', 'Top Hat', 'epic'),
  R(17, 'dance', 'dance_step', 'Step Step', 'epic'),
  R(17, 'dance', 'dance_cabbage', 'Cabbage Patch', 'epic'),
  R(18, 'dance', 'dance_shake', 'Shake It Out', 'legendary'),
  R(18, 'dance', 'dance_macarena', 'Arm Shuffle', 'legendary', ['monkey']),
  R(19, 'dance', 'dance_raiseroof', 'Raise the Roof', 'legendary'),
  R(20, 'outfit', 'gold_crown', 'Golden Crown', 'legendary'),
  R(21, 'dance', 'dance_gangnam', 'Pony Dance', 'legendary', ['monkey']),
  R(22, 'dance', 'dance_allnight', 'All Night Long', 'legendary'),
  R(24, 'dance', 'dance_moonwalk', 'Moonwalk', 'legendary'),
  R(26, 'dance', 'dance_sway', 'Happy Sway', 'legendary'),
];
/** The rewards a buddy can have (a few dances bump into some buddies' heads or hats). */
export const forBuddy = (rs: Reward[], b: FriendId) => rs.filter(r => !r.notFor?.includes(b));
export const REWARD: Record<string, Reward> = Object.fromEntries(REWARDS.map(r => [r.id, r]));
export const OUTFITS = REWARDS.filter(r => r.kind === 'outfit');
export const DANCES = REWARDS.filter(r => r.kind === 'dance');
export const unlockedAt = (level: number) => REWARDS.filter(r => r.level <= level);
export const newBetween = (before: number, after: number) => REWARDS.filter(r => r.level > before && r.level <= after);

/** The treasure for a run's score: ten steps, growing in value. Grown-ups need about 1.6 times as much. */
export const TREASURES = [
  { id: 'pebble', name: 'Shiny Pebble', desc: 'A smooth little stone from the island path. Every treasure hunt starts somewhere!' },
  { id: 'shell', name: 'Seashell', desc: 'Hold it to your ear and you can still hear the sea.' },
  { id: 'marble', name: 'Glass Marble', desc: 'A swirl of colour caught inside clear glass.' },
  { id: 'copper', name: 'Copper Coin', desc: 'An old island coin, warm and orange. Your first real money!' },
  { id: 'silver', name: 'Silver Coin', desc: 'Bright and shiny. Your fingers are getting quick!' },
  { id: 'gold', name: 'Gold Coin', desc: 'Real pirate treasure, heavy and gleaming.' },
  { id: 'ruby', name: 'Ruby', desc: 'A deep red jewel. Only fast, clean typing finds one.' },
  { id: 'diamond', name: 'Diamond', desc: 'The sparkliest jewel on the whole island.' },
  { id: 'egg', name: 'Dragon Egg', desc: "It's warm, and something inside is wiggling..." },
  { id: 'star', name: 'Rainbow Star', desc: 'The best treasure there is. Only the speediest typists ever find one!' },
];
export const TREASURE_SCORE = {
  kids: [1, 8, 14, 20, 26, 32, 40, 50, 62, 78],
  grown: [1, 13, 22, 32, 42, 52, 64, 80, 99, 125],
};
/** The treasure step (0 to 9) a score earns, or -1 for none. */
export function treasureFor(score: number, grown: boolean): number {
  const th = grown ? TREASURE_SCORE.grown : TREASURE_SCORE.kids;
  let t = -1;
  th.forEach((v, i) => { if (score >= v) t = i; });
  return t;
}
