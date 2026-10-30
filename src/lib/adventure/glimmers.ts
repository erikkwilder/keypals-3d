// Adventure: the Glimmers, the islands' creatures. Storm weather turns them into Grumbles (grey, drizzly,
// pouting); your buddy cheers them up in a Cheer Duel, and a cheered-up Glimmer joins your team. Each one
// has a rarity, an element, a power it uses in battle and a bit of personality.
import type { FriendId } from '../art/cast';
// 100-Glimmer ladder (2026-10-29): the Glimmers that come from goals, in their own file (ladder.ts)
import { LADDER_EVOLVED, LADDER_GLIMMERS, type LadderGlimmerId } from './glimmers2';

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

/** Powers. The 2026-10-30 Glimmers added four: `boost` (cards of its own element cheer more), `bubbles` (a
 *  shield every few right answers), `opener` (the first right answer pops extra cheer) and `dig` (shells
 *  when you win). The rest are shared: two Glimmers with the same kind do the same thing, each with its
 *  own number (`base`). */
export type PowerKind = 'splash' | 'shell' | 'nibble' | 'ember' | 'hide' | 'coolhead' | 'freeze' | 'glow' | 'crystal' | 'song' | 'lanterns' | 'blossom' | 'secondwind' | 'aurora'
  | 'boost' | 'bubbles' | 'opener' | 'dig';
/** The first 30: they come from random rolls (battles and eggs). */
export type RollGlimmerId = 'puddlepup' | 'pebbletort' | 'sproutbun' | 'embernewt' | 'fernfox' | 'snowseal' | 'frostowl' | 'sparkmoth' | 'prismhorn' | 'whalecalf' | 'lanternfox' | 'bloomdrake' | 'skywhale' | 'aurorastag'
  | 'sunsnail' | 'mittenyeti' | 'bubbleocto' | 'geodemole' | 'popcornpuff' | 'mushmouse' | 'rainbootfrog' | 'rollodillo'
  | 'teakettledrake' | 'cactuskit' | 'frostjelly' | 'potgolem' | 'stormlamb' | 'pinepango' | 'cometcat' | 'phoenixchick';
export type GlimmerId = RollGlimmerId | LadderGlimmerId;
/** Where a Glimmer comes from (ladder.ts says how each source works): 'roll' (the first 30, absent on
 *  them: battles and eggs), 'native' (a math world's own, and its Champion), 'milestone', 'collection',
 *  'season', 'secret', 'apex' (the four legends). */
export type GlimmerSource = 'roll' | 'native' | 'milestone' | 'collection' | 'season' | 'secret' | 'apex';
export type GlimmerDef = {
  id: GlimmerId; name: string; rarity: Rarity; element: Element;
  /** `base`: the power's number at level 1 when it differs from the kind's usual one (bubbles: every how many right answers) */
  power: { kind: PowerKind; name: string; text: (lvl: number) => string; base?: number };
  quirk: string;
  /** the island where it lives: its battles turn it up more often there */
  home?: 'meadow' | 'treetops' | 'bay';
  /** the island whose Champion it is (an island id: 'meadow', 'caves'...) */
  champion?: string;
  /** shape of its storm cloud when it's a Champion Grumble */
  cloud?: 'fox' | 'drake' | 'whale';
  // ---- the 100-Glimmer ladder (ladder.ts) ----
  /** where it comes from; absent: 'roll' */
  source?: GlimmerSource;
  /** a native's (or a world Champion's) math world: a WorldId such as 'falls', 'caves', 'peaks' */
  world?: string;
  /** its 3D model isn't made yet: the Glimmer Book shows it "On its way" and nobody can earn it. When the
   *  model ships, take this off: a child who already met its goal gets it right away. */
  pending?: boolean;
};

/** A power's number grows a little as the Glimmer levels up. */
export const powerNum = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

/** The first 30: the ones random rolls give (battles, eggs). The ladder's are in glimmers2.ts. */
export const GLIMMERS: GlimmerDef[] = [
  { id: 'puddlepup', home: 'meadow', name: 'Puddle Pup', rarity: 'common', element: 'tide', quirk: 'Shakes off water on everyone, every time.',
    power: { kind: 'splash', name: 'Splash', text: l => `Answer fast and it splashes ${powerNum(3, l)} more cheer.` } },
  { id: 'pebbletort', home: 'meadow', name: 'Pebble Tortoise', rarity: 'common', element: 'stone', quirk: 'Naps between turns. Wakes up for snacks.',
    power: { kind: 'shell', name: 'Pebble Shell', text: () => 'Blocks the first rain or zap in every battle for you.' } },
  { id: 'sproutbun', home: 'treetops', name: 'Sprout Bunny', rarity: 'common', element: 'leaf', quirk: 'Its sprout grows a new leaf on happy days.',
    power: { kind: 'nibble', name: 'Nibble', text: l => `Gives you ${powerNum(1, l, 6)} energy back after each answer.` } },
  { id: 'embernewt', home: 'meadow', name: 'Ember Newt', rarity: 'uncommon', element: 'sun', quirk: 'Leaves tiny warm footprints that glow for a minute.',
    power: { kind: 'ember', name: 'Ember Puff', text: l => `Adds ${powerNum(4, l)} more cheer after each of your answers.` } },
  { id: 'fernfox', home: 'treetops', name: 'Fern Fox', rarity: 'uncommon', element: 'leaf', quirk: 'Hides in its own tail when it is shy.',
    power: { kind: 'hide', name: 'Hide and Seek', text: () => 'Once a battle, a wrong answer won\'t break your row of right answers.' } },
  { id: 'snowseal', home: 'bay', name: 'Snowdrop Seal', rarity: 'uncommon', element: 'frost', quirk: 'Slides everywhere. Has never walked.',
    power: { kind: 'coolhead', name: 'Cool Head', text: l => `Gives you ${powerNum(2, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'frostowl', home: 'treetops', name: 'Frost Owl', rarity: 'rare', element: 'frost', quirk: 'Hoots once for every right answer.',
    power: { kind: 'freeze', name: 'Frost Feathers', text: () => 'Every 3 right in a row, it freezes the grumpy Glimmer so it can\'t send rain.' } },
  { id: 'sparkmoth', home: 'meadow', name: 'Spark Moth', rarity: 'rare', element: 'sun', quirk: 'Glows brighter the faster you answer.',
    power: { kind: 'glow', name: 'Glow', text: () => 'Once a battle, tap Hint and it shows you a trick for the answer.' } },
  { id: 'prismhorn', home: 'treetops', name: 'Prism Hornback', rarity: 'epic', element: 'stone', quirk: 'Its crystal horns ring like bells when it laughs.',
    power: { kind: 'crystal', name: 'Crystal Luck', text: () => 'A Perfect Cheer gives you double shells.' } },
  { id: 'whalecalf', home: 'bay', name: 'Cloud Whale Calf', rarity: 'epic', element: 'tide', quirk: 'Floats. Sings when you win.',
    power: { kind: 'song', name: 'Whale Song', text: l => `Water cards give you ${powerNum(3, l)} energy back.` } },
  { id: 'lanternfox', name: 'Lantern Fox', rarity: 'legendary', element: 'sun', champion: 'meadow', cloud: 'fox', quirk: 'Lights a lantern for every friend it makes.',
    power: { kind: 'lanterns', name: 'Three Lanterns', text: l => `Every 3rd right answer adds ${powerNum(10, l, 3)} big cheer.` } },
  { id: 'bloomdrake', name: 'Bloomhorn Drake', rarity: 'legendary', element: 'leaf', champion: 'treetops', cloud: 'drake', quirk: 'Its horns bloom a new flower every spring.',
    power: { kind: 'blossom', name: 'Blossom', text: l => `Every right answer gives you ${powerNum(1, l, 8)} energy back.` } },
  { id: 'skywhale', name: 'Sky Whale', rarity: 'legendary', element: 'tide', champion: 'bay', cloud: 'whale', quirk: 'Counts the stars on its back at bedtime.',
    power: { kind: 'secondwind', name: 'Second Wind', text: l => `Once a battle, when your energy runs low, gives you ${powerNum(10, l, 3)} back.` } },
  { id: 'aurorastag', name: 'Aurora Stag', rarity: 'mythic', element: 'frost', quirk: 'Only seen on the clearest snowy nights.',
    power: { kind: 'aurora', name: 'Aurora', text: () => 'Once a battle, fills up your Finale right away.' } },

  // ---------- 2026-10-30: sixteen more, quirky ones ----------
  { id: 'sunsnail', home: 'meadow', name: 'Sunny Snail', rarity: 'common', element: 'sun', quirk: 'Never in a hurry. Always arrives warm.',
    power: { kind: 'boost', name: 'Warm Shell', base: 2, text: l => `Sun cards add ${powerNum(2, l)} more cheer.` } },
  { id: 'mittenyeti', home: 'treetops', name: 'Mitten Yeti', rarity: 'common', element: 'frost', quirk: 'Gives the best hugs. They\'re a little bit chilly.',
    power: { kind: 'coolhead', name: 'Cool Mittens', text: l => `Gives you ${powerNum(2, l, 8)} more seconds to block rain and zaps.` } },
  { id: 'bubbleocto', home: 'bay', name: 'Bubble Octopus', rarity: 'common', element: 'tide', quirk: 'Blows bubbles even when it\'s fast asleep.',
    power: { kind: 'bubbles', name: 'Bubble Shield', base: 5, text: () => 'Every 5th right answer blows a bubble that stops the next rain or zap. 2 shields a battle at most.' } },
  { id: 'geodemole', home: 'meadow', name: 'Geode Mole', rarity: 'common', element: 'stone', quirk: 'Digs up shiny things and gives them all away.',
    power: { kind: 'dig', name: 'Shiny Finds', base: 4, text: l => `When you win a battle, it digs up ${powerNum(4, l)} extra shells.` } },
  { id: 'popcornpuff', home: 'meadow', name: 'Popcorn Puffling', rarity: 'uncommon', element: 'sun', quirk: 'Pops when it\'s surprised. Then pops again.',
    power: { kind: 'opener', name: 'First Pop', base: 6, text: l => `Your first right answer pops ${powerNum(6, l)} extra cheer.` } },
  { id: 'mushmouse', home: 'treetops', name: 'Mushroom Mouse', rarity: 'uncommon', element: 'leaf', quirk: 'Its mushroom is its umbrella, its hat and its bed.',
    power: { kind: 'boost', name: 'Mushroom Magic', base: 3, text: l => `Leaf cards add ${powerNum(3, l)} more cheer.` } },
  { id: 'rainbootfrog', home: 'bay', name: 'Rainboot Frog', rarity: 'uncommon', element: 'tide', quirk: 'Jumps in every puddle. Twice, to be sure.',
    power: { kind: 'splash', name: 'Big Splash', base: 4, text: l => `Answer fast and it splashes ${powerNum(4, l)} more cheer.` } },
  { id: 'rollodillo', home: 'meadow', name: 'Rock Candy Armadillo', rarity: 'uncommon', element: 'stone', quirk: 'Rolls everywhere. Says sorry to everything it bumps.',
    power: { kind: 'hide', name: 'Roll Away', text: () => 'Once a battle, a wrong answer won\'t break your row of right answers.' } },
  { id: 'teakettledrake', home: 'meadow', name: 'Teakettle Dragon', rarity: 'rare', element: 'sun', quirk: 'Whistles when it\'s excited. It\'s always excited.',
    power: { kind: 'lanterns', name: 'Whistle Blast', base: 6, text: l => `Every 3rd right answer whistles ${powerNum(6, l, 3)} big cheer.` } },
  { id: 'cactuskit', home: 'treetops', name: 'Cactus Kitten', rarity: 'rare', element: 'leaf', quirk: 'Super soft. Except for the prickles.',
    power: { kind: 'freeze', name: 'Prickly Hug', text: () => 'Every 3 right in a row, it gives the grumpy Glimmer a prickly hug so it can\'t send rain.' } },
  { id: 'frostjelly', home: 'bay', name: 'Snowflake Jelly', rarity: 'rare', element: 'frost', quirk: 'Snows a tiny bit wherever it floats.',
    power: { kind: 'bubbles', name: 'Snow Shield', base: 4, text: () => 'Every 4th right answer makes a snowflake shield that stops the next rain or zap. 2 shields a battle at most.' } },
  { id: 'potgolem', home: 'treetops', name: 'Flowerpot Golem', rarity: 'rare', element: 'stone', quirk: 'Its head is a flowerpot. The flower has opinions.',
    power: { kind: 'glow', name: 'Plant Wisdom', text: () => 'Once a battle, tap Hint and its flower shows you a trick for the answer.' } },
  { id: 'stormlamb', home: 'bay', name: 'Thundercloud Lamb', rarity: 'epic', element: 'tide', quirk: 'Its wool rains, but only rainbows.',
    power: { kind: 'boost', name: 'Rainbow Rain', base: 4, text: l => `Water cards add ${powerNum(4, l)} more cheer.` } },
  { id: 'pinepango', home: 'treetops', name: 'Pinecone Pangolin', rarity: 'epic', element: 'leaf', quirk: 'Curls up into a pinecone when it\'s thinking.',
    power: { kind: 'shell', name: 'Pinecone Curl', base: 2, text: () => 'Blocks the first two rains or zaps in every battle for you.' } },
  { id: 'cometcat', home: 'bay', name: 'Comet Cat', rarity: 'legendary', element: 'frost', quirk: 'Leaves a trail of stars. Tidies them up later.',
    power: { kind: 'lanterns', name: 'Comet Trail', base: 10, text: l => `Every 3rd right answer adds ${powerNum(10, l, 3)} big cheer.` } },
  { id: 'phoenixchick', name: 'Phoenix Chick', rarity: 'mythic', element: 'sun', quirk: 'Every morning it wakes up as a brand-new chick.',
    power: { kind: 'secondwind', name: 'Rise Again', base: 14, text: l => `Once a battle, when your energy runs low, gives you ${powerNum(14, l, 3)} back.` } },
];
/** Every Glimmer: the first 30 (GLIMMERS, the ones random rolls give) and the ladder's (glimmers2.ts).
 *  Random rolls (battles, eggs, the Grumbles you meet) only ever use GLIMMERS. */
export const ALL_GLIMMERS: GlimmerDef[] = [...GLIMMERS, ...LADDER_GLIMMERS];
/** How many Glimmers there will be once every math world's are in (the Glimmer Book's "of 100"). */
export const GLIMMER_TOTAL = 100;
export const GLIMMER: Record<GlimmerId, GlimmerDef> = Object.fromEntries(ALL_GLIMMERS.map(g => [g.id, g])) as Record<GlimmerId, GlimmerDef>;
/** The Glimmers of a rarity that random rolls can give (never the ladder's). */
export const glimmersOf = (r: Rarity) => GLIMMERS.filter(g => g.rarity === r);
/** A ladder Glimmer (it comes from a goal, never from a roll). */
export const isLadder = (id: GlimmerId) => (GLIMMER[id]?.source ?? 'roll') !== 'roll';
/** An island's own Champion once its model is in (Counting Caves and Market Isle have their own coming);
 *  null: the island uses the one in its ISLANDS entry. */
export const ownChampion = (island: string): GlimmerId | null => ALL_GLIMMERS.find(g => g.champion === island && !g.pending)?.id ?? null;
/** A power's number at level 1 for this Glimmer (its own, or the kind's usual one). */
export const powerBase = (id: GlimmerId, usual: number) => GLIMMER[id].power.base ?? usual;

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
  propeller_cap: { kind: 'hover', name: 'Hover', text: 'Floats you over a rain or zap in every battle. 2 shields a battle at most.' },
  cowboy_hat: { kind: 'lasso', name: 'Lasso', text: 'Gives you 4 cards to choose from instead of 3.' },
  pirate_hat: { kind: 'treasure', name: 'Treasure Nose', text: '6 extra shells when you win.' },
  wizard_hat: { kind: 'retry', name: 'Second Chance', text: 'Once a battle, you get another try after a wrong answer.' },
  viking_helmet: { kind: 'shieldwall', name: 'Shield Wall', text: 'Gives you 2 more seconds to block.' },
  top_hat: { kind: 'magic', name: 'Magic Trick', text: 'Your first cards every battle always include a ⚡ strong one.' },
  gold_crown: { kind: 'royal', name: 'Royal Cheer', text: 'Your Finale fills up twice as fast.' },
};

// ---------- evolutions: at level 5 a Glimmer can grow up ----------
/** The level a Glimmer can evolve at. */
export const EVOLVE_AT = 5;
/** An evolved Glimmer's power works as if it were this many levels higher. */
export const EVOLVE_BOOST = 4;
/** Each Glimmer's grown-up form: its new name and the extra thing it does in battles. */
export const EVOLVED: Record<GlimmerId, { name: string; perk: string }> = {
  ...LADDER_EVOLVED,
  puddlepup: { name: 'Tidal Pup', perk: 'Water cards splash 2 more cheer.' },
  pebbletort: { name: 'Boulder Tortoise', perk: 'Blocks the first two rains or zaps, not just one.' },
  sproutbun: { name: 'Blossom Bunny', perk: 'Strong ⚡ cards give you 2 more energy back.' },
  embernewt: { name: 'Flare Newt', perk: 'Sun cards add 3 more cheer.' },
  fernfox: { name: 'Forest Fox', perk: 'Keeps your row of right answers safe twice a battle.' },
  snowseal: { name: 'Blizzard Seal', perk: 'Every rain or zap you block also adds 2 cheer.' },
  frostowl: { name: 'Crystal Owl', perk: 'Freezes the grumpy Glimmer after 2 right in a row, not 3.' },
  sparkmoth: { name: 'Sunbeam Moth', perk: 'You can use Hint twice a battle.' },
  prismhorn: { name: 'Diamond Hornback', perk: 'Strong ⚡ cards add 2 more cheer.' },
  whalecalf: { name: 'Rainbow Whale', perk: 'Water cards add an extra Finale star.' },
  lanternfox: { name: 'Starlight Fox', perk: 'Your Finale cheers 10 more.' },
  bloomdrake: { name: 'Bloom Dragon', perk: 'Leaf cards add 2 more cheer.' },
  skywhale: { name: 'Star Whale', perk: 'Second Wind can help you twice a battle.' },
  aurorastag: { name: 'Great Aurora Stag', perk: 'You start every battle with 2 Finale stars.' },
  sunsnail: { name: 'Solar Snail', perk: 'Sun cards also fill an extra Finale star.' },
  mittenyeti: { name: 'Blizzard Yeti', perk: 'Every rain or zap you block also adds 2 cheer.' },
  bubbleocto: { name: 'Bubble Kraken', perk: 'Blows a bubble every 4th right answer instead.' },
  geodemole: { name: 'Gem Digger Mole', perk: 'Digs up shells after a lost battle too.' },
  popcornpuff: { name: 'Kettlecorn Puffling', perk: 'Your first two right answers both pop.' },
  mushmouse: { name: 'Toadstool Mouse', perk: 'Leaf cards also fill an extra Finale star.' },
  rainbootfrog: { name: 'Stormboot Frog', perk: 'Water cards splash 2 more cheer.' },
  rollodillo: { name: 'Crystal Candy Armadillo', perk: 'Keeps your row of right answers safe twice a battle.' },
  teakettledrake: { name: 'Grand Teapot Dragon', perk: 'Your Finale cheers 10 more.' },
  cactuskit: { name: 'Blossom Cactus Cat', perk: 'Gives its prickly hug after 2 right in a row, not 3.' },
  frostjelly: { name: 'Aurora Jelly', perk: 'Makes a shield every 3rd right answer instead.' },
  potgolem: { name: 'Garden Golem', perk: 'You can use Hint twice a battle.' },
  stormlamb: { name: 'Rainbow Ram', perk: 'Water cards also fill an extra Finale star.' },
  pinepango: { name: 'Ancient Pine Pangolin', perk: 'Each rain or zap it blocks gives you 2 energy back.' },
  cometcat: { name: 'Galaxy Cat', perk: 'Your Finale cheers 10 more.' },
  phoenixchick: { name: 'Sunrise Phoenix', perk: 'Rise Again can help you twice a battle.' },
};
/** The name to show: the grown-up one once it has evolved. */
export const glimmerName = (id: GlimmerId, evolved?: boolean) => (evolved ? EVOLVED[id].name : GLIMMER[id].name);
