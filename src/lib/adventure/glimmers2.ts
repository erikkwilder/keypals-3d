// The Glimmers of the 100-Glimmer ladder (ladder.ts), 2026-10-29: the natives and Champions of the first
// three math worlds (Fraction Falls, Counting Caves, Market Isle) and the 35 that come from goals a child
// can see and plan for: milestones, collections, seasons, secrets and the four legends. Each has a power of
// an existing kind (battle.ts already knows them all), a quirk and a grown-up form whose perk is that
// kind's own grown-up perk. All of them are `pending` until their 3D models are made (the concept
// paintings are in public/game/glimmers): the Glimmer Book shows them "On its way" and nobody can earn one
// yet. When a model ships, take its `pending` off and a child who already met its goal gets it right away.
//
// This file only imports types from glimmers.ts (which spreads these in), so neither waits on the other.
import type { GlimmerDef } from './glimmers';

/** The ids added here. */
export type LadderGlimmerId =
  // world natives and Champions
  | 'pieotter' | 'halfcrab' | 'wheelbeaver' | 'abacuspillar' | 'cartbeetle' | 'crystalbat' | 'crystalmammoth' | 'pennypiglet' | 'fruittoucan' | 'stripechameleon' | 'goldgriffin'
  // milestones
  | 'fireflyfawn' | 'lighthousepuffin' | 'meteorram' | 'sunbursttiger' | 'galaxynarwhal' | 'sunriserobin' | 'blossomhog' | 'snowpineelk' | 'seasonstanuki' | 'eldertreeturtle'
  | 'keycricket' | 'zipbird' | 'rocketroadrunner' | 'balancepanda' | 'hydrahatchling' | 'starsageowl'
  // collection
  | 'gemmagpie' | 'treasurecrab' | 'nestdragon' | 'prismpeacock' | 'acornsprite'
  // seasons
  | 'maplepanda' | 'snowglobepenguin' | 'petalduckling' | 'watermelonturtle' | 'fireworksquirrel' | 'cupcakebear'
  // secrets
  | 'mistseahorse' | 'bookworm' | 'whisperparrot' | 'goldgecko'
  // legends
  | 'crownedlion' | 'moonrabbit' | 'rainbowunicorn' | 'dragonkoi';

/** powerNum from glimmers.ts (copied so this file needs nothing from it at run time) */
const pn = (base: number, lvl: number, every = 4) => base + Math.floor((Math.max(1, lvl) - 1) / every);

// Each power's words follow its kind's (glimmers.ts); `base` sets its number where the kind reads one.
const P = {
  nibble: (name: string) => ({ kind: 'nibble' as const, name, text: (l: number) => `Gives you ${pn(1, l, 6)} energy back after each answer.` }),
  shell: (name: string, base = 1) => ({ kind: 'shell' as const, name, base, text: () => base >= 3 ? 'Blocks the first three rains or zaps in every battle for you.' : base === 2 ? 'Blocks the first two rains or zaps in every battle for you.' : 'Blocks the first rain or zap in every battle for you.' }),
  song: (name: string) => ({ kind: 'song' as const, name, text: (l: number) => `Water cards give you ${pn(3, l)} energy back.` }),
  boost: (name: string, cards: string, base: number) => ({ kind: 'boost' as const, name, base, text: (l: number) => `${cards} cards add ${pn(base, l)} more cheer.` }),
  hide: (name: string) => ({ kind: 'hide' as const, name, text: () => 'Once a battle, a wrong answer won\'t break your row of right answers.' }),
  freeze: (name: string, what: string) => ({ kind: 'freeze' as const, name, text: () => `Every 3 right in a row, it ${what} so it can't send rain.` }),
  secondwind: (name: string, base: number) => ({ kind: 'secondwind' as const, name, base, text: (l: number) => `Once a battle, when your energy runs low, gives you ${pn(base, l, 3)} back.` }),
  dig: (name: string, base: number) => ({ kind: 'dig' as const, name, base, text: (l: number) => `When you win a battle, it finds ${pn(base, l)} extra shells.` }),
  ember: (name: string, base: number) => ({ kind: 'ember' as const, name, base, text: (l: number) => `Adds ${pn(base, l)} more cheer after each of your answers.` }),
  glow: (name: string, what = 'shows you a trick for the answer') => ({ kind: 'glow' as const, name, text: () => `Once a battle, tap Hint and it ${what}.` }),
  lanterns: (name: string, base: number, verb = 'adds') => ({ kind: 'lanterns' as const, name, base, text: (l: number) => `Every 3rd right answer ${verb} ${pn(base, l, 3)} big cheer.` }),
  opener: (name: string, base: number, verb = 'pops') => ({ kind: 'opener' as const, name, base, text: (l: number) => `Your first right answer ${verb} ${pn(base, l)} extra cheer.` }),
  splash: (name: string, base: number, verb = 'splashes') => ({ kind: 'splash' as const, name, base, text: (l: number) => `Answer fast and it ${verb} ${pn(base, l)} more cheer.` }),
  bubbles: (name: string, base: number, what: string) => ({ kind: 'bubbles' as const, name, base, text: () => `Every ${base === 4 ? '4th' : '5th'} right answer ${what} that stops the next rain or zap. 2 shields a battle at most.` }),
  coolhead: (name: string) => ({ kind: 'coolhead' as const, name, text: (l: number) => `Gives you ${pn(2, l, 8)} more seconds to block rain and zaps.` }),
  crystal: (name: string) => ({ kind: 'crystal' as const, name, text: () => 'A Perfect Cheer gives you double shells.' }),
  aurora: (name: string) => ({ kind: 'aurora' as const, name, text: () => 'Once a battle, fills up your Finale right away.' }),
};

export const LADDER_GLIMMERS: (GlimmerDef & { id: LadderGlimmerId })[] = [
  // ---------- Fraction Falls: a pie shop, pools and waterfalls (its Champion stays Thundercloud Lamb) ----------
  { id: 'pieotter', name: 'Piecrust Otter', rarity: 'uncommon', element: 'tide', source: 'native', world: 'falls', pending: true,
    quirk: 'Cuts every pie into equal slices, then shares them all.', power: P.nibble('Pie Break') },
  { id: 'halfcrab', name: 'Halfshell Crab', rarity: 'rare', element: 'stone', source: 'native', world: 'falls', pending: true,
    quirk: 'Its shell is half pink and half blue. It can\'t pick a favourite half.', power: P.shell('Half and Half') },
  { id: 'wheelbeaver', name: 'Waterwheel Beaver', rarity: 'epic', element: 'tide', source: 'native', world: 'falls', pending: true,
    quirk: 'Builds dams in perfectly equal parts. Measures twice.', power: P.song('Wheel Song') },
  // ---------- Counting Caves: crystal caves, mine carts, number veins ----------
  { id: 'abacuspillar', name: 'Abacus Caterpillar', rarity: 'uncommon', element: 'leaf', source: 'native', world: 'caves', pending: true,
    quirk: 'Counts its own feet every morning. Gets a different answer every time.', power: P.boost('Bead Count', 'Leaf', 3) },
  { id: 'cartbeetle', name: 'Minecart Beetle', rarity: 'rare', element: 'stone', source: 'native', world: 'caves', pending: true,
    quirk: 'Rides the mine tracks and says "choo choo", even though it\'s a beetle.', power: P.hide('Down the Tunnel') },
  { id: 'crystalbat', name: 'Crystal Bat', rarity: 'epic', element: 'frost', source: 'native', world: 'caves', pending: true,
    quirk: 'Hangs upside down to count the crystals on the ceiling.', power: P.freeze('Crystal Hush', 'hushes the grumpy Glimmer') },
  { id: 'crystalmammoth', name: 'Crystal Mammoth', rarity: 'legendary', element: 'stone', source: 'native', world: 'caves', champion: 'caves', pending: true,
    quirk: 'Remembers every number it has ever heard.', power: P.secondwind('Mammoth Heart', 12) },
  // ---------- Market Isle: striped stalls, a coin fountain, a golden market hall ----------
  { id: 'pennypiglet', name: 'Penny Piglet', rarity: 'uncommon', element: 'sun', source: 'native', world: 'market', pending: true,
    quirk: 'Jingles when it trots. Saves every coin it finds.', power: P.dig('Piggy Bank', 5) },
  { id: 'fruittoucan', name: 'Fruit Stall Toucan', rarity: 'rare', element: 'sun', source: 'native', world: 'market', pending: true,
    quirk: 'Balances fruit on its beak like a market scale. Never drops one.', power: P.ember('Fruit Toss', 4) },
  { id: 'stripechameleon', name: 'Awning Chameleon', rarity: 'epic', element: 'leaf', source: 'native', world: 'market', pending: true,
    quirk: 'Its stripes match whichever stall it stands next to.', power: P.glow('Colour Trick') },
  { id: 'goldgriffin', name: 'Goldcrest Griffin', rarity: 'legendary', element: 'sun', source: 'native', world: 'market', champion: 'market', pending: true,
    quirk: 'Keeps one shiny coin under its wing for luck.', power: P.lanterns('Golden Wings', 11) },

  // ---------- milestones: right answers ever ----------
  { id: 'fireflyfawn', name: 'Firefly Fawn', rarity: 'rare', element: 'leaf', source: 'milestone', pending: true,
    quirk: 'Every right answer you give lights up one of its fireflies.', power: P.opener('First Light', 6, 'lights up') },
  { id: 'lighthousepuffin', name: 'Lighthouse Puffin', rarity: 'epic', element: 'tide', source: 'milestone', pending: true,
    quirk: 'Wears its lighthouse hat to bed. Blinks it for passing boats.', power: P.bubbles('Lighthouse Beam', 5, 'shines a beam') },
  { id: 'meteorram', name: 'Meteor Ram', rarity: 'epic', element: 'frost', source: 'milestone', pending: true,
    quirk: 'Makes a wish on its own horns. They always come true, a little.', power: P.secondwind('Shooting Star', 10) },
  { id: 'sunbursttiger', name: 'Sunburst Tiger', rarity: 'legendary', element: 'sun', source: 'milestone', pending: true,
    quirk: 'Purrs so warmly that snow melts around it.', power: P.ember('Sunburst', 6) },
  { id: 'galaxynarwhal', name: 'Galaxy Narwhal', rarity: 'legendary', element: 'tide', source: 'milestone', pending: true,
    quirk: 'Swims through the night sky. Knows every star by name.', power: P.boost('Starhorn', 'Water', 6) },
  // ---------- milestones: days played ----------
  { id: 'sunriserobin', name: 'Sunrise Robin', rarity: 'rare', element: 'sun', source: 'milestone', pending: true,
    quirk: 'Sings the sun up on every day you play.', power: P.coolhead('Early Bird') },
  { id: 'blossomhog', name: 'Blossom Hedgehog', rarity: 'epic', element: 'leaf', source: 'milestone', pending: true,
    quirk: 'One more bud opens on its back for every day you play.', power: P.nibble('Bud Snack') },
  { id: 'snowpineelk', name: 'Snowpine Elk', rarity: 'epic', element: 'frost', source: 'milestone', pending: true,
    quirk: 'Little birds nest in its antlers all winter.', power: P.shell('Pine Antlers', 2) },
  { id: 'seasonstanuki', name: 'Four Seasons Tanuki', rarity: 'legendary', element: 'leaf', source: 'milestone', pending: true,
    quirk: 'Its fur changes with the seasons. It has seen a whole year with you.', power: P.boost('Season Change', 'Leaf', 5) },
  { id: 'eldertreeturtle', name: 'Elder Tree Turtle', rarity: 'mythic', element: 'stone', source: 'milestone', pending: true,
    quirk: 'Very, very old. Someone tiny lives in the house on its back.', power: P.shell('Ancient Shell', 3) },
  // ---------- milestones: typing speed ----------
  { id: 'keycricket', name: 'Keycap Cricket', rarity: 'rare', element: 'leaf', source: 'milestone', pending: true,
    quirk: 'Chirps clickety-clack, clickety-clack.', power: P.splash('Clickety Clack', 4, 'clicks') },
  { id: 'zipbird', name: 'Zip Hummingbird', rarity: 'epic', element: 'frost', source: 'milestone', pending: true,
    quirk: 'Flaps eighty times a second. Still says it\'s bored.', power: P.splash('Zip', 5, 'zips') },
  { id: 'rocketroadrunner', name: 'Rocket Roadrunner', rarity: 'legendary', element: 'sun', source: 'milestone', pending: true,
    quirk: 'Gets everywhere first, then waits for everyone with a snack.', power: P.lanterns('Rocket Boost', 12, 'blasts') },
  // ---------- milestones: math facts strong ----------
  { id: 'balancepanda', name: 'Balance Panda', rarity: 'epic', element: 'stone', source: 'milestone', pending: true,
    quirk: 'Can balance anything. Except its lunch.', power: P.hide('Steady Balance') },
  { id: 'hydrahatchling', name: 'Hydra Hatchling', rarity: 'epic', element: 'tide', source: 'milestone', pending: true,
    quirk: 'Three heads, one hug. They take turns choosing dinner.', power: P.ember('Triple Puff', 5) },
  { id: 'starsageowl', name: 'Star Sage Owl', rarity: 'legendary', element: 'frost', source: 'milestone', pending: true,
    quirk: 'Reads the stars like a book and knows how many there are.', power: P.glow('Star Wisdom', 'reads you a trick for the answer from the stars') },

  // ---------- collection ----------
  { id: 'gemmagpie', name: 'Gem Magpie', rarity: 'rare', element: 'stone', source: 'collection', pending: true,
    quirk: 'Collects shiny things. Gives the best ones to friends.', power: P.dig('Shiny Finds', 6) },
  { id: 'treasurecrab', name: 'Treasure Hermit Crab', rarity: 'epic', element: 'tide', source: 'collection', pending: true,
    quirk: 'Lives in a treasure chest. Polishes it every night.', power: P.crystal('Treasure Luck') },
  { id: 'nestdragon', name: 'Nest Dragon', rarity: 'legendary', element: 'leaf', source: 'collection', pending: true,
    quirk: 'Keeps every egg warm. Hums them lullabies.', power: P.boost('Warm Nest', 'Leaf', 6) },
  { id: 'prismpeacock', name: 'Prism Peacock', rarity: 'mythic', element: 'frost', source: 'collection', pending: true,
    quirk: 'Opens its tail and fills the room with rainbows.', power: P.boost('Prism Fan', 'Ice', 7) },
  { id: 'acornsprite', name: 'Acorn Sprite', rarity: 'epic', element: 'leaf', source: 'collection', pending: true,
    quirk: 'Grows a little taller every time a friend grows up.', power: P.bubbles('Acorn Cap', 4, 'pops on an acorn-cap shield') },

  // ---------- seasons ----------
  { id: 'maplepanda', name: 'Maple Red Panda', rarity: 'rare', element: 'sun', source: 'season', pending: true,
    quirk: 'Jumps into every leaf pile. Every single one.', power: P.boost('Maple Glow', 'Sun', 3) },
  { id: 'snowglobepenguin', name: 'Snowglobe Penguin', rarity: 'rare', element: 'frost', source: 'season', pending: true,
    quirk: 'It snows inside its helmet all winter long.', power: P.coolhead('Snow Globe') },
  { id: 'petalduckling', name: 'Petal Duckling', rarity: 'rare', element: 'tide', source: 'season', pending: true,
    quirk: 'Splashes in spring puddles in its petal raincoat.', power: P.splash('Puddle Jump', 3) },
  { id: 'watermelonturtle', name: 'Watermelon Turtle', rarity: 'rare', element: 'tide', source: 'season', pending: true,
    quirk: 'Smells like summer. Shares its shell with no one.', power: P.shell('Melon Shell') },
  { id: 'fireworksquirrel', name: 'Firework Squirrel', rarity: 'epic', element: 'sun', source: 'season', pending: true,
    quirk: 'Stays up until midnight once a year. Then sleeps for a week.', power: P.opener('New Year Pop', 8, 'bursts into') },
  { id: 'cupcakebear', name: 'Cupcake Bear', rarity: 'epic', element: 'sun', source: 'season', pending: true,
    quirk: 'Comes to every Keypals birthday. Brings its own candle.', power: P.nibble('Birthday Treat') },

  // ---------- secrets ----------
  { id: 'mistseahorse', name: 'Mistfin Seahorse', rarity: 'epic', element: 'tide', source: 'secret', pending: true,
    quirk: 'Hides behind waterfalls. Waves at anyone who finds it.', power: P.hide('Mist Hide') },
  { id: 'bookworm', name: 'Seed Bookworm', rarity: 'rare', element: 'leaf', source: 'secret', pending: true,
    quirk: 'Has read every book in the Seed Library. Twice.', power: P.glow('Bookworm Tip', 'reads you a trick for the answer') },
  { id: 'whisperparrot', name: 'Whisper Parrot', rarity: 'epic', element: 'leaf', source: 'secret', pending: true,
    quirk: 'Knows a secret word. Only whispers it to friends.', power: P.freeze('Shh!', 'whispers "shh" to the grumpy Glimmer') },
  { id: 'goldgecko', name: 'Golden Gecko', rarity: 'epic', element: 'stone', source: 'secret', pending: true,
    quirk: 'Sleeps on a pile of coins in the treasure room. Very comfy.', power: P.dig('Gold Rush', 8) },

  // ---------- legends: the four hardest of all ----------
  { id: 'crownedlion', name: 'Crowned Lion', rarity: 'mythic', element: 'sun', source: 'apex', pending: true,
    quirk: 'Only bows to keepers whose Champions have all grown up. Its crown has a gem for each element.', power: P.ember('Royal Roar', 8) },
  { id: 'moonrabbit', name: 'Moon Rabbit', rarity: 'mythic', element: 'frost', source: 'apex', pending: true,
    quirk: 'Lives on the moon. Comes down for friends who never give up.', power: P.aurora('Moonrise') },
  { id: 'rainbowunicorn', name: 'Rainbow Unicorn', rarity: 'mythic', element: 'stone', source: 'apex', pending: true,
    quirk: 'Only visits keepers who have raised twenty Glimmers all the way to the top.', power: P.secondwind('Rainbow Heart', 16) },
  { id: 'dragonkoi', name: 'Rainbow Dragon Koi', rarity: 'mythic', element: 'tide', source: 'apex', pending: true,
    quirk: 'A koi that swam up every waterfall in the world and became a dragon.', power: P.lanterns('Waterfall Leap', 16) },
];

/** Each one's grown-up form: its new name, and its kind's grown-up perk (battle.ts does the same for every
 *  Glimmer of a kind). */
export const LADDER_EVOLVED: Record<LadderGlimmerId, { name: string; perk: string }> = {
  pieotter: { name: 'Pastry Chef Otter', perk: 'Strong ⚡ cards give you 2 more energy back.' },
  halfcrab: { name: 'Fullmoon Crab', perk: 'Blocks the first two rains or zaps, not just one.' },
  wheelbeaver: { name: 'Millhouse Beaver', perk: 'Water cards add an extra Finale star.' },
  abacuspillar: { name: 'Abacus Butterfly', perk: 'Leaf cards also fill an extra Finale star.' },
  cartbeetle: { name: 'Gemrail Beetle', perk: 'Keeps your row of right answers safe twice a battle.' },
  crystalbat: { name: 'Geode Bat', perk: 'Hushes the grumpy Glimmer after 2 right in a row, not 3.' },
  crystalmammoth: { name: 'Diamond Mammoth', perk: 'Mammoth Heart can help you twice a battle.' },
  pennypiglet: { name: 'Golden Piggy', perk: 'Finds shells after a lost battle too.' },
  fruittoucan: { name: 'Banquet Toucan', perk: 'Sun cards add 3 more cheer.' },
  stripechameleon: { name: 'Rainbow Awning Chameleon', perk: 'You can use Hint twice a battle.' },
  goldgriffin: { name: 'Sunvault Griffin', perk: 'Your Finale cheers 10 more.' },
  fireflyfawn: { name: 'Lantern Deer', perk: 'Your first two right answers both light up.' },
  lighthousepuffin: { name: 'Beacon Puffin', perk: 'Shines a beam every 4th right answer instead.' },
  meteorram: { name: 'Comet Ram', perk: 'Shooting Star can help you twice a battle.' },
  sunbursttiger: { name: 'Solar Tiger', perk: 'Sun cards add 3 more cheer.' },
  galaxynarwhal: { name: 'Nebula Narwhal', perk: 'Water cards also fill an extra Finale star.' },
  sunriserobin: { name: 'Daybreak Robin', perk: 'Every rain or zap you block also adds 2 cheer.' },
  blossomhog: { name: 'Bouquet Hedgehog', perk: 'Strong ⚡ cards give you 2 more energy back.' },
  snowpineelk: { name: 'Evergreen Elk', perk: 'Each rain or zap it blocks gives you 2 energy back.' },
  seasonstanuki: { name: 'Great Seasons Tanuki', perk: 'Leaf cards also fill an extra Finale star.' },
  eldertreeturtle: { name: 'World Tree Turtle', perk: 'Each rain or zap it blocks gives you 2 energy back.' },
  keycricket: { name: 'Typewriter Cricket', perk: 'Water cards add 2 more cheer too.' },
  zipbird: { name: 'Lightning Hummingbird', perk: 'Water cards add 2 more cheer too.' },
  rocketroadrunner: { name: 'Comet Roadrunner', perk: 'Your Finale cheers 10 more.' },
  balancepanda: { name: 'Zen Panda', perk: 'Keeps your row of right answers safe twice a battle.' },
  hydrahatchling: { name: 'Tidal Hydra', perk: 'Sun cards add 3 more cheer.' },
  starsageowl: { name: 'Grand Star Sage', perk: 'You can use Hint twice a battle.' },
  gemmagpie: { name: 'Jewel Magpie', perk: 'Finds shells after a lost battle too.' },
  treasurecrab: { name: 'Pirate King Crab', perk: 'Strong ⚡ cards add 2 more cheer.' },
  nestdragon: { name: 'Mother Nest Dragon', perk: 'Leaf cards also fill an extra Finale star.' },
  prismpeacock: { name: 'Rainbow Prism Peacock', perk: 'Ice cards also fill an extra Finale star.' },
  acornsprite: { name: 'Great Oak Sprite', perk: 'Pops on a shield every 3rd right answer instead.' },
  maplepanda: { name: 'Harvest Red Panda', perk: 'Sun cards also fill an extra Finale star.' },
  snowglobepenguin: { name: 'Blizzard Penguin', perk: 'Every rain or zap you block also adds 2 cheer.' },
  petalduckling: { name: 'Blossom Swan', perk: 'Water cards splash 2 more cheer.' },
  watermelonturtle: { name: 'Fruit Bowl Turtle', perk: 'Blocks the first two rains or zaps, not just one.' },
  fireworksquirrel: { name: 'Grand Finale Squirrel', perk: 'Your first two right answers both burst.' },
  cupcakebear: { name: 'Party Cake Bear', perk: 'Strong ⚡ cards give you 2 more energy back.' },
  mistseahorse: { name: 'Waterfall Seahorse', perk: 'Keeps your row of right answers safe twice a battle.' },
  bookworm: { name: 'Library Moth', perk: 'You can use Hint twice a battle.' },
  whisperparrot: { name: 'Secret Keeper Macaw', perk: 'Whispers "shh" after 2 right in a row, not 3.' },
  goldgecko: { name: 'Treasure Dragon Gecko', perk: 'Finds shells after a lost battle too.' },
  crownedlion: { name: 'Lion King of Champions', perk: 'Sun cards add 3 more cheer.' },
  moonrabbit: { name: 'Full Moon Rabbit', perk: 'You start every battle with 2 Finale stars.' },
  rainbowunicorn: { name: 'Starlight Unicorn', perk: 'Rainbow Heart can help you twice a battle.' },
  dragonkoi: { name: 'Sky Dragon Koi', perk: 'Your Finale cheers 10 more.' },
};
