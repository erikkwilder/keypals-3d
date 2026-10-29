# Keypals Easter eggs

Little surprises hidden around the game. None of them gives or takes away anything: no stars, shells
or progress. None blocks a tap or slows a game down. The rare ones are rare, but they can always happen.
The code is in `src/lib/fun/`.

## In the 3D world (lessons and trips)

| What | Where | How to find it | How often |
|---|---|---|---|
| **Pebble's big walk** | The island trail (typing lessons and math trips on the trail) | Pebble the tortoise is walking the whole trail, a few metres further every lesson. He gives a little hop as you pass. When he finally reaches the far end, he does a happy dance, and next time he sets off again. | Every trail lesson. His progress is kept on this device. |
| **The Sky Whale** | The island trail, far off in the sky | A big Sky Whale (the Adventure Glimmer) drifts slowly across the sky. | 1 lesson in 5 |
| **A Spark Moth visitor** | The island trail, and the cliff climb | A Spark Moth flutters along beside your buddy for a while, then flies off. | 1 in 4 on the trail, 1 in 3 on the cliff |
| **A flying saucer** | The island trail | A little silver saucer with blinking lights swoops in, hovers, shines its beam down for a moment, then zooms away with a wobbly "wooo-OOO". | 1 lesson in 40 |
| **A shooting star** | The finish line of any lesson or trip | As you reach the finish, a shooting star streaks across the sky with a soft twinkle. | 1 finish in 5 |
| **A tiny door** | Halfway up the cliff climb | A tiny fairy door with a glowing window, a lantern and a striped doormat, just off the climbing line. | Every climb (you have to look) |
| **The snowman** | Near the bottom of the sled run | A snowman with a red scarf. He turns his head to watch you go by, waves a twig arm now and then, and wears a different hat each time: party hat, pirate hat, crown, cowboy hat... | Every sled run |
| **Snowdrop Seal races you** | The sled run | Snowdrop Seal belly-slides beside you down the slope, then does a happy flop at the bottom. | 1 run in 3 |
| **Leaping fish** | The bay (swim lessons and trips) | A painted clownfish leaps out of the water beside the lane, with a splash. | Every swim, every 6 to 13 seconds |
| **Puddle Pup paddles by** | The bay | Puddle Pup paddles just past the lane ropes and does a happy splash as you swim by. | 1 swim in 3 |
| **Pumpkins** | Along the island trail | Pumpkins sit beside the trail. | 20 October to 2 November |
| **Snow** | The island trail | Soft snow falls. | December to 6 January |

## On the screen

| What | Where | How to find it |
|---|---|---|
| **Tickle your buddy** | Home | Tap your buddy (beside "Welcome back"). It giggles and says something new each time. On the seventh tap it sneezes ("ACHOO! Oh, excuse me!"). (On a phone the buddy isn't shown there.) |
| **Say hello** | Home, the typing map, the math map | Type `hello`: your buddy says hello back. |
| **Your buddy's name** | Home, the typing map, the math map | Type your buddy's name (for example `dino`): "That's me! You know my name!" with confetti. On Home, names with T, M or A (Home's shortcut keys) only work on the maps. |
| **The secret word** | The typing map or the math map | Type `keypals`: three bursts of confetti and "You found the secret word!" |
| **Fireflies** | Home | After 7 in the evening (and before 6 in the morning), fireflies drift and blink across Home. |
| **Keypals birthday** | Home | A year (or more) after the day you first played, Home throws you a birthday: confetti and "Happy Keypals birthday!" |
| **Golden letter** | Typing lessons | Now and then (1 lesson in 5) one letter in the middle of the lesson is gold and shimmering. Type it right for confetti and a chime. |
| **One hundred!** | Math trips | 10 × 10: "💯 One hundred!" with confetti. |
| **5, 6, 7, 8!** | Math trips | 7 × 8 = 56 counts "5, 6, 7, 8!" |
| **Rainbow bubble** | Playground: Make Ten Bubbles | Now and then (1 bubble in 30) a bubble shimmers through every colour. Pop it for a giggle and confetti. |
| **Photobomb** | Results after a lesson or trip | Sometimes (1 in 6) another buddy from your team peeks in beside the picture: "Psst! Great job!" |
| **The grumpy Glimmer sneezes** | Adventure battles | Once in a while (1 battle in 8) the grumpy Glimmer sneezes just before the battle starts: "ACHOO! Bless you!" |
| **The cloud whale** | The Adventure map | Every minute or so, a cloud shaped like a smiling whale drifts across the sky over the islands. |

## Checking them (development builds only)

- `#eggs-all` makes every surprise happen at once (the rare ones too). `#eggs-all=pumpkins` or
  `#eggs-all=snow` also picks a season, and `#eggs-all=off` turns it off. It's stored on the device, so
  open the hash once and then go to the screen you want (for example `#mathrun=twins-3` for the bay).
- In the console, `__trailEggs()` shows what the trail rolled this lesson and where things are, and
  `__whaleK = 0..1` puts the Sky Whale at a fixed spot in its drift.
- New sounds are on the sound board (`#sounds`): twinkle, ufo, splashSmall, giggle, sneeze, golden, secret.
