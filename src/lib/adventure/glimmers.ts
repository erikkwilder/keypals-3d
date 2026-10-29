// Adventure: the Glimmers, the islands' creatures. Storm weather turns them into Grumbles (grey, drizzly,
// pouting); your buddy cheers them up in a Cheer Duel, and a cheered-up Glimmer joins your team. Each one
// has a rarity, an element, a power it uses in battle and a bit of personality.
import type { FriendId } from '../art/cast';

export type Element = 'sun' | 'frost' | 'tide' | 'stone' | 'leaf';
/** The ring: each element is strong against the next one round. */
export const ELEMENTS: Element[] = ['sun', 'frost', 'tide', 'stone', 'leaf'];
export const ELEMENT: Record<Element, { name: string; color: string; deep: string; beats: Element; verb: string; card: string }> = {
  sun: { name: 'Sun', color: '#ffb52e', deep: '#e07b00', beats: 'frost', verb: 'melts', card: 'Sun' },
  frost: { name: 'Ice', color: '#7fd6ff', deep: '#2a8fc9', beats: 'tide', verb: 'freezes', card: 'Ice' },
  tide: { name: 'Water', color: '#3fa2ff', deep: '#1c5fd1', beats: 'stone', verb: 'wears down', card: 'Water' },
  stone: { name: 'Stone', color: '#c9a27a', deep: '#7a5a3a', beats: 'leaf', verb: 'squashes', card: 'Stone' },
  leaf: { name: 'Leaf', color: '#5fd17a', deep: '#22914a', beats: 'sun', verb: 'soaks up', card: 'Leaf' },
};
export const strong = (a: Element, b: Element) => ELEMENT[a].beats === b;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
/** `hatch`: right answers in practice an egg of this rarity needs; `dust`: stardust a second one turns into. */
export const RARITY: Record<Rarity, { name: string; color: string; glow: string; hatch: number; dust: number; shells: number }> = {
  common: { name: 'Common', color: '#9aa0ad', glow: '#e8ecf3', hatch: 20, dust: 10, shells: 0 },
  uncommon: { name: 'Uncommon', color: '#3fbf73', glow: '#9ff0bf', hatch: 30, dust: 20, shells: 4 },
  rare: { name: 'Rare', color: '#2f8ef0', glow: '#9fd0ff', hatch: 45, dust: 40, shells: 8 },
  epic: { name: 'Epic', color: '#a061f0', glow: '#d9b8ff', hatch: 70, dust: 80, shells: 14 },
  legendary: { name: 'Legendary', color: '#f0b21f', glow: '#ffe79a', hatch: 110, dust: 160, shells: 25 },
  mythic: { name: 'Mythic', color: '#ff5fb0', glow: '#ffffff', hatch: 160, dust: 300, shells: 40 },
};
export const rarityRank = (r: Rarity) => RARITIES.indexOf(r);

export type PowerKind = 'splash' | 'shell' | 'nibble' | 'ember' | 'hide' | 'coolhead' | 'freeze' | 'glow' | 'crystal' | 'song' | 'lanterns' | 'blossom' | 'secondwind' | 'aurora';
export type GlimmerId = 'puddlepup' | 'pebbletort' | 'sproutbun' | 'embernewt' | 'fernfox' | 'snowseal' | 'frostowl' | 'sparkmoth' | 'prismhorn' | 'whalecalf' | 'lanternfox' | 'bloomdrake' | 'skywhale' | 'aurorastag';
export type GlimmerDef = {
  id: GlimmerId; name: string; rarity: Rarity; element: Element;
  power: { kind: PowerKind; name: string; text: (lvl: number) => string };
  quirk: string;
  /** the island whose Champion it is (Champions are always these) */
  champion?: 'meadow' | 'treetops' | 'bay';
  /** shape of its storm cloud when it's a Champion Grumble */
  cloud?: 'fox' | 'drake' | 'whale';
};

/** A power's number grows a little as the Glimmer levels up. */
export const powerNum = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

export const GLIMMERS: GlimmerDef[] = [
  { id: 'puddlepup', name: 'Puddle Pup', rarity: 'common', element: 'tide', quirk: 'Shakes off water on everyone, every time.',
    power: { kind: 'splash', name: 'Splash', text: l => `Answer fast and it splashes ${powerNum(3, l)} more cheer.` } },
  { id: 'pebbletort', name: 'Pebble Tortoise', rarity: 'common', element: 'stone', quirk: 'Naps between turns. Wakes up for snacks.',
    power: { kind: 'shell', name: 'Pebble Shell', text: () => 'Blocks the first rain or zap in every battle for you.' } },
  { id: 'sproutbun', name: 'Sprout Bunny', rarity: 'common', element: 'leaf', quirk: 'Its sprout grows a new leaf on happy days.',
    power: { kind: 'nibble', name: 'Nibble', text: l => `Gives you ${powerNum(1, l, 6)} energy back after each answer.` } },
  { id: 'embernewt', name: 'Ember Newt', rarity: 'uncommon', element: 'sun', quirk: 'Leaves tiny warm footprints that glow for a minute.',
    power: { kind: 'ember', name: 'Ember Puff', text: l => `Adds ${powerNum(4, l)} more cheer after each of your answers.` } },
  { id: 'fernfox', name: 'Fern Fox', rarity: 'uncommon', element: 'leaf', quirk: 'Hides in its own tail when it is shy.',
    power: { kind: 'hide', name: 'Hide and Seek', text: () => 'Once a battle, a wrong answer won\'t break your row of right answers.' } },
  { id: 'snowseal', name: 'Snowdrop Seal', rarity: 'uncommon', element: 'frost', quirk: 'Slides everywhere. Has never walked.',
    power: { kind: 'coolhead', name: 'Cool Head', text: l => `Gives you ${powerNum(2, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'frostowl', name: 'Frost Owl', rarity: 'rare', element: 'frost', quirk: 'Hoots once for every right answer.',
    power: { kind: 'freeze', name: 'Frost Feathers', text: () => 'Every 3 right in a row, it freezes the grumpy Glimmer so it can\'t send rain.' } },
  { id: 'sparkmoth', name: 'Spark Moth', rarity: 'rare', element: 'sun', quirk: 'Glows brighter the faster you answer.',
    power: { kind: 'glow', name: 'Glow', text: () => 'Once a battle, tap Hint and it shows you a trick for the answer.' } },
  { id: 'prismhorn', name: 'Prism Hornback', rarity: 'epic', element: 'stone', quirk: 'Its crystal horns ring like bells when it laughs.',
    power: { kind: 'crystal', name: 'Crystal Luck', text: () => 'A Perfect Cheer gives you double shells.' } },
  { id: 'whalecalf', name: 'Cloud Whale Calf', rarity: 'epic', element: 'tide', quirk: 'Floats. Sings when you win.',
    power: { kind: 'song', name: 'Whale Song', text: l => `Water cards give you ${powerNum(3, l)} energy back.` } },
  { id: 'lanternfox', name: 'Lantern Fox', rarity: 'legendary', element: 'sun', champion: 'meadow', cloud: 'fox', quirk: 'Lights a lantern for every friend it makes.',
    power: { kind: 'lanterns', name: 'Three Lanterns', text: l => `Every 3rd right answer adds ${powerNum(10, l, 3)} big cheer.` } },
  { id: 'bloomdrake', name: 'Bloomhorn Drake', rarity: 'legendary', element: 'leaf', champion: 'treetops', cloud: 'drake', quirk: 'Its horns bloom a new flower every spring.',
    power: { kind: 'blossom', name: 'Blossom', text: l => `Every right answer gives you ${powerNum(1, l, 8)} energy back.` } },
  { id: 'skywhale', name: 'Sky Whale', rarity: 'legendary', element: 'tide', champion: 'bay', cloud: 'whale', quirk: 'Counts the stars on its back at bedtime.',
    power: { kind: 'secondwind', name: 'Second Wind', text: l => `Once a battle, when your energy runs low, gives you ${powerNum(10, l, 3)} back.` } },
  { id: 'aurorastag', name: 'Aurora Stag', rarity: 'mythic', element: 'frost', quirk: 'Only seen on the clearest snowy nights.',
    power: { kind: 'aurora', name: 'Aurora', text: () => 'Once a battle, fills up your Finale right away.' } },
];
export const GLIMMER: Record<GlimmerId, GlimmerDef> = Object.fromEntries(GLIMMERS.map(g => [g.id, g])) as Record<GlimmerId, GlimmerDef>;
export const glimmersOf = (r: Rarity) => GLIMMERS.filter(g => g.rarity === r);

// ---------- buddies: each plays a little differently ----------
export type RoleId = 'heart' | 'speed' | 'trick' | 'helper' | 'builder' | 'steady';
export const ROLE: Record<RoleId, { name: string; text: string }> = {
  heart: { name: 'Big Heart', text: 'Starts every battle with 6 extra energy.' },
  speed: { name: 'Speedster', text: 'Answer in under 3 seconds for 3 extra cheer.' },
  trick: { name: 'Trickster', text: 'Can swap the cards for new ones once a turn.' },
  helper: { name: 'Helper', text: '3 right in a row gives 3 energy back.' },
  builder: { name: 'Builder', text: 'Every block gives 1 energy back.' },
  steady: { name: 'Steady', text: 'Every other rain or zap only hurts half as much.' },
};
export const BUDDY_ROLE: Record<FriendId, RoleId> = {
  dino: 'heart', cheetah: 'speed', monkey: 'trick', koala: 'helper', box: 'builder', turtle: 'steady',
  fish: 'speed', fluff: 'helper', rabbit: 'speed', dog: 'heart', sloth: 'steady', cat: 'trick', goggles: 'builder',
  antenna: 'trick', sweater: 'helper', axolotl: 'helper', diver: 'steady', terrier: 'heart', pinkbunny: 'speed', elf: 'trick', straw: 'builder',
};

// ---------- outfits: each one does something in battle ----------
export type GearKind = 'confetti' | 'bloomheal' | 'hover' | 'lasso' | 'treasure' | 'retry' | 'shieldwall' | 'magic' | 'royal';
export const GEAR: Record<string, { kind: GearKind; name: string; text: string }> = {
  party_hat: { kind: 'confetti', name: 'Confetti', text: 'Every right answer adds 1 more cheer.' },
  flower_crown: { kind: 'bloomheal', name: 'Bloom', text: 'Facts you already know well give you 2 energy back.' },
  propeller_cap: { kind: 'hover', name: 'Hover', text: 'Floats you over the first rain or zap in a battle.' },
  cowboy_hat: { kind: 'lasso', name: 'Lasso', text: 'Gives you 4 cards to choose from instead of 3.' },
  pirate_hat: { kind: 'treasure', name: 'Treasure Nose', text: '6 extra shells when you win.' },
  wizard_hat: { kind: 'retry', name: 'Second Chance', text: 'Once a battle, you get another try after a wrong answer.' },
  viking_helmet: { kind: 'shieldwall', name: 'Shield Wall', text: 'Gives you 2 more seconds to block.' },
  top_hat: { kind: 'magic', name: 'Magic Trick', text: 'Your first cards every battle always include a ⚡ strong one.' },
  gold_crown: { kind: 'royal', name: 'Royal Cheer', text: 'Your Finale fills up twice as fast.' },
};
