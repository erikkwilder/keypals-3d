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
