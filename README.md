# Keypals 3D (version 2)

The Keypals typing game on a 3D sky island. All of the first game's teaching, scoring and rewards
(lessons, stars, live score with a clean-typing bonus, rides, medals, stickers, friendship levels, the
coach, finger demos, charts, grown-up tools) with a 3D world and 3D buddies.

```bash
npm install
npm run dev        # http://127.0.0.1:5192
npm test
```

## What's new in version 2

- **Buddies:** Dino, Chee (cheetah), Momo (monkey) and Kiki (koala), made from Erik's designs:
  front, side and back pictures with gpt-image-2.5, then Meshy (multi-view 3D model, skeleton, moves).
  Weights redone in Blender (`../keypals-3d-spike/tools/blender/reweight.py`) so raised arms stay round.
- **The trail:** typing moves your buddy along a winding trail on a floating island, at a speed that
  follows your typing rate. Six rides by live score: walk, run, skateboard, bike, car, rocket.
- **Lessons:** each new pair of keys gets a drill that uses only those two keys; mix lessons then bring
  in everything learned so far.
- **Rewards:** outfits are 3D hats; friendship also unlocks finish-line dances (15 real dance moves);
  every run's score earns one of ten treasures, from a pebble to a rainbow star.
- **Code:** `src/lib/three/` (stage, island, character, rides, run scene, showcase, sticker snapshots).
  The art pipeline and source pictures live in `../keypals-3d-spike/`.
