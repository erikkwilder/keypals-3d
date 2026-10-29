# Keypals sound map

Almost every sound is made live with Web Audio in `src/lib/audio/sound.ts`. The few that have to sound
real (an eggshell cracking, a fish splashing) are short recordings in `public/sfx/`, made for Keypals with
ElevenLabs' sound generator, trimmed, faded and levelled, and played through the same effects channel (a
made-live stand-in plays if one can't load). Open the game with `#sounds` on the address to hear each one
with a Play button, plus "Hear a whole battle" in order.

## The rules

1. **Falling notes mean "that wasn't right"**, and they play only for **your own** wrong answer. It is a
   soft two-note "boo-op", because children hear it a lot. A wrong key while typing is quieter still
   (a muted tap).
2. **"Not yet" is not "wrong".** Locked stops, buddies you haven't met and not having enough shells
   knock twice. Nothing falls.
3. **The grumpy Glimmer is a cartoon character.** It goes "hmph-hmph" with a wobble in its voice. It is
   never a low buzzer, which children hear as an error.
4. **Watch-out sounds go up.** Rain coming is far-off thunder and a rising "dee-DEE!". Getting rained on is
   a splash with pitter-patter drops (a cartoon bump), not a failure sound.
5. **Other people are neutral.** The other player's turn rings a friendly doorbell. A ghost's miss is a
   soft puff. Only the person who answered wrong hears the "boo-op", and in a duel that is the player at
   the keys.
6. **Good things rise, and big moments get a short fanfare.** The rarer or bigger the prize, the longer
   the run up.
7. **One moment, one sound.** Starting a battle sounds the same in Adventure, a Family Duel and a Rival
   Ghosts game. Buying anything sounds like shells. Putting anything on sounds like "fwip, ding".
8. **Whooshes swell in and go up.** A burst of noise that starts at full volume sounds like a snap or a
   crack, and one that sweeps down sounds like something deflating: both read as "bad". Every whoosh
   fades in over a good part of its length, rises, and the happy ones land on a bright note (2026-10-30,
   after Erik heard "Off we go", the battle start and the fish splash as bad sounds).

## The table

| When | Sound (`sfx.`) | What it sounds like | Why |
|---|---|---|---|
| **Answers and typing** | | | |
| A right key (typing, math trips) | `key(finger)` | a little note for that finger | quiet; shows which finger without breaking flow |
| Your answer wasn't right (any game) | `miss()` | soft "boo-op", two notes down | the only falling sound in the game |
| A wrong key while typing (lessons, typing cards, typing blocks, copying a fixed answer) | `slip()` | a tiny muted tap | heard many times a lesson, so it barely registers |
| Second Chance gives you another go | `miss()` | "boo-op" | it was still a wrong answer |
| A hint (the Glow, a trick) | `hint()` | "bing!" | an idea, not a reward |
| **Buttons and screens** | | | |
| Tap a button | `click()` | a click | |
| Open a card, pick a tab, an info box | `pop()` | a bubbly pop | |
| Off we go: a lesson, a trip, a duel, a rival game | `whoosh()` | an airy whoosh that swells in and rises, landing on a bright two-note chime with a sparkle | it started at full volume, so it sounded like a snap (Erik: "sounds like a bad thing, like a snap or a crack") |
| Locked, not enough shells, a code that didn't work | `nope()` | two soft knocks | was the "wrong answer" sound, which made locked buttons feel like mistakes |
| **Battles** (Adventure, Family Duel, Rival Ghosts) | | | |
| A battle starts | `battleStart()` | two drum hits, a rising "here we go", a bright chord with a sparkle | starting is exciting: it ends up, never on the grumpy "hmph" (Erik heard the "hmph" at the end as the start being bad); the grumble stays its own sound |
| A power flies | `cast(element)` | each element its own swoosh (stone now thunks up, not down) | plays only when the answer was right |
| The cheer lands | `hit(size)` | a soft thump and notes going up, more notes when bigger | the bright notes now lead; the thump no longer slides down like a sigh |
| Perfect Cheer | `perfect()` | a bright fanfare | |
| A team Glimmer or gear helps | `helper()` | a bright chime | |
| Energy back | `heal()` | three soft rising notes | no longer also used for the Glow hint or the evolution hum |
| Frozen | `freeze()` | icy sparkles | |
| Rain, a zap, snow or pebbles coming | `rainComing()` | thunder, then a rising "dee-DEE!" | was two falling notes, which sounded like a mistake |
| The zap flies | `zap()` | a cartoon crackle | was a square-wave sweep down (a buzzer) |
| The rain is sent (other kinds) | `whoosh()` | a whoosh | |
| You blocked it / half of it | `shield(true/false)` | a glassy chime / with a crack | |
| It landed on you | `rainHit()` | a splash and pitter-patter drops | was a falling "ouch" |
| Finale stars are full | `finaleReady()` | "ding, ding, DING!" | was the medal sound |
| Finale | `finale()` | a drum roll and a chord | |
| Aurora (Finale ready at once) | `aurora()` | a shimmering wash | was the "a Glimmer appears" fanfare |
| You cheered it up (the cloud bursts) | `cheeredUp()` | a swish, a POP, a happy run up | the burst used to be silent for about a second (three in a duel); in a battle won with a Perfect Cheer, the Perfect fanfare plays instead so the two don't pile up |
| Then its card | `reveal(rarity)` | a run up, grander for rarer ones | |
| Out of energy | `tryAgain()` | a soft "aww", then a little lift | used to be silent |
| **Family Duel and Rival Ghosts only** | | | |
| Next player's turn | `turn(side)` | a friendly doorbell (player 1 a little higher) | tells you whose turn it is without looking |
| A rain cloud flies to the other side | `rainSend()` | a cheeky "fwoosh", a boing up and a "ding-ding!" | sending one is your reward for three in a row, so it's happy for the sender; the other side hears the rising "watch out" when it arrives |
| A ghost's (or another player's) power didn't land | `fizzle()` | a soft puff | a ghost's miss used to play your "wrong" sound |
| Last turn | `lastTurn()` | a drum and two notes going up | was the medal sound |
| **Prizes** | | | |
| Stars on the results | `star(i)` | each star a note higher | |
| Finished (lesson, trip, practice stop, Learn lesson, new player made) | `complete()` | a four-note fanfare | |
| A medal | `medal()` (`badge()`) | two bright notes and a sparkle | now only for medals |
| Something new is yours (outfit, dance, buddy, egg) | `unlock()` | a twinkle and a bell | was "Finished!" |
| Bought with shells (gear, eggs, treats, anywhere) | `buy()` | shells clink, then a bell | was "Finished!" in one shop and the medal in another |
| Put it on (outfit, gear, team Glimmer, Play as, Make my buddy) | `equip()` | "fwip" and a ding | was the medal sound or "Finished!" |
| Friendship goes up | `levelUp(n)` | a rising run and a shimmer | |
| Treasure | `treasure(step)` | a rising run, longer for better treasure | |
| An egg hatches | `crack(1..3)`, then `crack(4)` | three real eggshell cracks (recorded), each bigger, then the shell bursting open with pieces tinkling | the made-live crack didn't sound like an egg; timed to the cracks growing across the egg in the hatch |
| Cut the pizza (Pizza Rush) | `slice()` | a crisp "shhk" that lifts, and a tick | it used the egg crack |
| A Glimmer appears (battle, duel, egg) | `reveal(rarity)` | a run up, grander for rarer ones | |
| A Glimmer evolves | `evolveCharge(n)` then `evolve(rarity)` | a hum that climbs a step at a time, then a sweep into its reveal | was the heal sound on repeat, then the Finale drum roll |
| The hands cheer (finger lesson) | `cheer()` | three quick notes up | was the medal sound |
| A fish leaps, Puddle Pup paddles by (swim lessons and trips) | `splashSmall()` | a real little splash and "plop" (recorded, two takes, pitch varied a touch) | the made-live one swept down and read as a bad sound |
| Steering the sled, squeaking past a gate, a gust in Glimmer Drop | `carve()`, `nearMiss()`, `gust()` | soft swells that rise | they started at full volume or swept down |
| Sky Slalom: the wind | `wind(speed)`, every frame | soft air that swells and brightens with the speed, quiet even at turbo, and fades by itself when the run stops | new |
| Sky Slalom: through a boost ring | `ringPass()` | an airy swell and a bright "ting-ting-ting!" going up | it borrowed the golden-letter bell |
| Sky Slalom: turbo ready, then fired | `turboReady()`, `turbo()` | a bright "ding-DING!"; then a rocket "vwoooom" that climbs and a chord on top | they borrowed the Finale and the unlock sounds |
| Tower Stack: the crane brings a block, it drops, it lands | `creak()`, `blockDrop()`, `thunk(height)` | a quiet wooden ratchet (recorded); a light "fwip"; a real wooden "tok" (recorded, two takes), a touch brighter as the tower grows | the drop borrowed the sled carve; the made-live "tok" slid down |
| Tower Stack: a perfect landing | `thunk()`, `sparkle()`, `ding(combo)` | the "tok" with a sparkle and a ding that climbs with the streak | |
| Tower Stack: a block misses the top | `blockSlip()` | a soft puff and a cartoon "boing" | it borrowed the "Off we go" whoosh |
| Pizza Rush: the next customer steps up | `nextUp()` | a friendly shop bell, "ding-dong" going up | new |

Ride changes and "10 in a row" in typing lessons stay silent on purpose: a sound there pulled attention
from typing. The banner and confetti show it instead.
