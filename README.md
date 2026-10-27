# Keypals 3D (version 2)

The Keypals typing game on 3D sky islands, live at [fancyant.com/keypals](https://fancyant.com/keypals).
All of the first game's teaching, scoring and rewards (lessons, stars, live score with a clean-typing
bonus, rides, medals, stickers, friendship levels, the coach, finger demos, charts, grown-up tools)
with a 3D world and 3D buddies. The first, flat version is at fancyant.com/keypals1.

```bash
npm install
npm run dev        # http://127.0.0.1:5192  (#run=treetops-1 opens a lesson straight away)
npm test
```

## What's new in version 2

- **Buddies:** Dino, Chee (cheetah), Momo (monkey), Kiki (koala), Bop (box head) and Tuck (turtle),
  made from Erik's designs: front, side and back pictures with gpt-image-2.5, then Meshy (multi-view
  3D model, skeleton, moves), weights redone in Blender so raised arms stay round. One script does a
  new buddy start to finish: `../keypals-3d-spike/tools/new_buddy.sh`.
- **Worlds:** each region has its own island (`src/lib/three/themes.ts`), styled after its map banner:
  Home Row Island (meadows and ruins), Top Row Treetops (giant trees, rope walkways), Bottom Row
  Burrows (hills with round doors, mushrooms), Capital Cliffs (arches, spires, waterfalls), Number Ridge
  (pines, cairns, snowy peaks), Symbol Shores (beach, real sea, palms, lighthouses) and The Open Road
  (signposts, rainbow, balloons).
- **The trail:** typing moves your buddy along a winding trail, at a speed that follows your typing
  rate. Six rides by live score: walk, run, skateboard, bike, car, rocket (flying level, buddy in the
  cockpit). A ghost racer runs at your best pace, crosses the line after you if you win, and every
  round says whether you beat it.
- **Lessons:** each new pair of keys gets a drill that uses only those two keys; mix lessons then bring
  in everything learned so far.
- **Rewards:** outfits are 3D hats; friendship unlocks finish-line dances (checked so hands never pass
  through a head); every run's score earns one of ten treasures, from a pebble to a rainbow star (tap
  any of them on the results screen to see what it is).
- **Smooth mode:** older computers switch to it by themselves (old Intel graphics, or frames that
  can't keep up): fewer pixels, 30 frames a second, no real shadows, simpler lighting, fewer extras.
  Settings → Graphics: Auto, Full or Smooth.
- **Music:** made live in the browser, in each region's key. Styles: Sunny, Adventure, Dreamy, Arcade,
  Chill, or Mix (Settings → Music style).
- **Code:** `src/lib/three/` (stage, island, themes, character, rides, run scene, showcase, sticker
  snapshots). The art pipeline and source pictures live in `../keypals-3d-spike/`.

## Keypals Math (branch `math`, not live yet)

A second game in the same world, picked from home with the **Typing | Math** switch. Times tables move
your buddy along the island trail: type the answer (number row, number pad or the on-screen pad; it
checks itself once there are enough digits), and quick, right answers climb the same six rides.

- **The Times Trail:** Twin Bridges (the 2s, with the 0 and 1 rules), Ten Cliffs (10s), High Five
  Shores (5s) and Hop Hollow (4s), each on one of the islands. Each has a Meet lesson, practice, a mix
  and a checkpoint run that can be taken first to test out. "Show What You Know" places a new player.
- **A trip** is 20 facts: at most three new ones, met with their trick (a dot picture) and repeated
  after 1, 3 and 6 other facts; the rest are known facts, the shakiest and the ones due for review most
  often. A miss shows the answer and its trick, the child types it, and the fact comes back 2 to 4
  facts later. No countdown, no buzzer; Calm mode turns the rides off.
- **Fact memory:** sprout, bud, bloom (quick on three different days), reviews after 1, 3, 7, 14 and
  30 days, a slip costs one step, and learning 6 × 2 starts 2 × 6 growing. The **Fact Garden** shows
  every fact, coloured by its latest answer; grown-ups can set what counts as quick (2 to 6 seconds).
- **Rewards:** the same as typing: treasure, medals (plus Quick Draw and In Bloom), stickers,
  friendship, outfits and dances; math time counts toward the daily goal.
- **Code:** `src/lib/math/` (facts, course, picker, meter, progress, tests) and the screens `MathMap`,
  `MathRun`, `MathResults` and `FactGarden`. Dev shortcuts: `#math`, `#mathrun=twins-2`, `#garden`.

## Licence

Keypals is free to play and **source-available**: read the code, run it for any noncommercial purpose
and send improvements (see [CONTRIBUTING.md](CONTRIBUTING.md)). The code is under
[PolyForm Strict 1.0.0](LICENSE), which doesn't allow publishing changed copies or your own version;
art, characters, voices and music are all rights reserved ([LICENSE-ART.md](LICENSE-ART.md)).
