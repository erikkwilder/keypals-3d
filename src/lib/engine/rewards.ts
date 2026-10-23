// What friendship unlocks, buddy by buddy: outfits to wear and dances to celebrate with at the finish.
// They alternate, so every level or two brings something new. The treasure is separate: a picture
// for each run's score, ten steps from a pebble to a rainbow star.

export type RewardKind = 'outfit' | 'dance';
export type Reward = { id: string; kind: RewardKind; name: string; level: number; rarity: 'common' | 'rare' | 'epic' | 'legendary' };

const R = (level: number, kind: RewardKind, id: string, name: string, rarity: Reward['rarity'] = 'common'): Reward => ({ id, kind, name, level, rarity });

/** Every buddy starts with the victory cheer and one dance. */
export const REWARDS: Reward[] = [
  R(1, 'dance', 'cheer', 'Victory Cheer'),
  R(1, 'dance', 'dance_hiphop', 'Hip Hop Bounce'),
  R(2, 'outfit', 'party_hat', 'Party Hat'),
  R(3, 'dance', 'dance_letters', 'Letter Arms'),
  R(4, 'outfit', 'flower_crown', 'Flower Crown'),
  R(5, 'dance', 'dance_jacks', 'Jumping Jacks'),
  R(6, 'outfit', 'propeller_cap', 'Propeller Cap', 'rare'),
  R(7, 'dance', 'dance_happyhands', 'Happy Hands'),
  R(8, 'outfit', 'cowboy_hat', 'Cowboy Hat', 'rare'),
  R(9, 'dance', 'dance_bubble', 'Bubble Pop', 'rare'),
  R(10, 'outfit', 'pirate_hat', 'Pirate Hat', 'rare'),
  R(11, 'dance', 'dance_cardio', 'Cardio Groove', 'rare'),
  R(12, 'outfit', 'wizard_hat', 'Wizard Hat', 'epic'),
  R(13, 'dance', 'dance_boom', 'Boom Bounce', 'epic'),
  R(14, 'outfit', 'viking_helmet', 'Viking Helmet', 'epic'),
  R(15, 'dance', 'dance_popstar', 'Pop Star', 'epic'),
  R(16, 'outfit', 'top_hat', 'Top Hat', 'epic'),
  R(17, 'dance', 'dance_groove', 'Spin Groove', 'epic'),
  R(18, 'dance', 'dance_spinjump', 'Spin Jump', 'legendary'),
  R(20, 'outfit', 'gold_crown', 'Golden Crown', 'legendary'),
  R(22, 'dance', 'dance_superlove', 'Superstar', 'legendary'),
  R(24, 'dance', 'dance_shake', 'Shake It Out', 'legendary'),
  R(26, 'dance', 'dance_allnight', 'All Night Long', 'legendary'),
  R(28, 'dance', 'dance_step', 'Step Step', 'legendary'),
  R(30, 'dance', 'dance_sway', 'Happy Sway', 'legendary'),
];
export const REWARD: Record<string, Reward> = Object.fromEntries(REWARDS.map(r => [r.id, r]));
export const OUTFITS = REWARDS.filter(r => r.kind === 'outfit');
export const DANCES = REWARDS.filter(r => r.kind === 'dance');
export const unlockedAt = (level: number) => REWARDS.filter(r => r.level <= level);
export const newBetween = (before: number, after: number) => REWARDS.filter(r => r.level > before && r.level <= after);

/** The treasure for a run's score: ten steps, growing in value. Grown-ups need about 1.6 times as much. */
export const TREASURES = [
  { id: 'pebble', name: 'Shiny Pebble' },
  { id: 'shell', name: 'Seashell' },
  { id: 'marble', name: 'Glass Marble' },
  { id: 'copper', name: 'Copper Coin' },
  { id: 'silver', name: 'Silver Coin' },
  { id: 'gold', name: 'Gold Coin' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'egg', name: 'Dragon Egg' },
  { id: 'star', name: 'Rainbow Star' },
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
