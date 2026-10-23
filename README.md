# Keypals

**A free, open-source typing adventure for kids (and grown-ups), from [FancyAnt Games](https://fancyant.com).**

Dino rides with you, and ten little friends live on your fingertips. A friendly coach shows
where every finger goes, then you travel through seven worlds, picking up faster rides as you
get faster and cleaner: from a stroll to roller skates, a bike, a go-kart, a balloon, an eagle,
a jet plane and a rocket. No ads, no accounts, no data collected. Runs on Mac today, and in any
modern browser.

![Title screen](docs/screenshots/title.png)

## How it plays

- **Meet Dino.** A hand-painted dinosaur in a red jacket and sneakers is everyone's buddy to
  start with. He runs, rides, cheers, and pulls a face when you slip. Pick any of the crew instead
  whenever you like.
- **Meet the crew.** One friend per finger, and each friend's name starts with their home key:
  Ada on A, Suki on S, Dot on D, Fig on F, Jun on J, Kip on K, Lulu on L, Semi on the
  semicolon, and the twins Bim & Bom on the space bar. Learning the crew is learning the home row.
- **A coach who talks and shows.** Before the first lesson, and whenever new keys arrive, the
  coach explains the move out loud while two hands on a keyboard show it: fingers land on the
  home row, reach up or down, press, and come home. Skip it any time, or press "Watch how" to
  see it again. Every line is captioned, and the voice can be switched off.
- **A map shaped like the keyboard.** Home Row Village, Top Row Treetops, Bottom Row Burrows,
  Capital Cliffs (Shift), Number Ridge, Symbol Shores, and The Open Road. 48 lessons that add
  a couple of keys at a time.
- **Worlds you travel through.** Each lesson is a journey from a signpost to a finish line.
  The world moves as you type, never repeats, and is full of things to spot: windmills, ponds
  with ducks, markets, lighthouses, cable cars. Friends wait along the path and cheer as you pass.
- **Twelve speed rides.** Your buddy rides along as you type, and the ride follows your live
  score: Stroll, Roller Skates, Skateboard, Bike, Go-Kart, Car, Balloon, Prop Plane, Eagle, Jet
  Plane, Jetpack and Rocket. The rocket is a real stretch, the way the cheetah is in Animal
  Typing. Each lesson remembers your best ride.
- **One big score.** Your score is your speed plus a clean-typing bonus: once a streak passes ten
  keys, every right key earns back part of its time, and a slip resets the streak. Each lesson has
  a goal score: 30% of it is one star, 60% two, the goal three, and about three times the goal is
  platinum. The results show speed + bonus = score, your best and your average, and everything
  you earned. Lessons are short (40 to 120 letters), so another go is always close.
- **A chart for every lesson.** Your speed and score on every try, the goal line, platinum, and
  the ride ladder up the side, so you can see yourself getting faster.
- **Easy to set up, easy to quiet.** The first lesson asks how the game should sound: coach
  voice, sound effects, music. A gear on every screen changes it later, and easy mode asks for
  two thirds of the goal score.
- **Gentle on mistakes.** The cursor waits on the right key and the friend for that key pops up
  to help. No buzzers.
- **Stars, medals, stickers and outfits, for each Keypal.** Earn stars from your score, move on
  after one star (or after finishing a lesson twice, so nobody gets stuck), and win several medals
  at once on a great run. Every Keypal levels up
  on their own and keeps their own sticker book (58 stickers each), medals (rose, silver, gold,
  rainbow) and closet (22 outfits, from party hats to a knight's armor and a rainbow unicorn;
  Dino's outfits are still being painted). Nothing transfers, so every friend is a new adventure.
- **Hints that fade by themselves.** The on-screen keyboard and the finger guide get quieter as
  you master each key, and come back if a key slips.
- **Real words.** Lessons are built from a kid-safe word list filtered to the letters you know.
- **Grown-up mode, teacher tools.** Faster goals and longer reading for adults; a grown-ups page
  with progress charts, a key-by-key heat map, and a "My Words" box that turns a spelling list
  into a lesson.
- **Every layout.** QWERTY, Dvorak, Colemak, Workman, QWERTZ and AZERTY all get the full course.
- **Four looks.** Soft Squish (default), Ink Sticker, Paper Craft and Geo Pop. Fonts include
  extra-clear and dyslexia-friendly choices, plus a less-motion setting.

| | |
|---|---|
| ![The coach shows a reach](docs/screenshots/coach.png) | ![Leveling up mid-lesson: Dino gets the bike](docs/screenshots/level-up.png) |
| ![Results](docs/screenshots/results.png) | ![The map](docs/screenshots/map.png) |
| ![Sticker book](docs/screenshots/sticker-book.png) | ![Keypals: Dino and the crew](docs/screenshots/closet.png) |
| ![Symbol Shores](docs/screenshots/world-shores.png) | ![The crystal caves of Bottom Row Burrows](docs/screenshots/world-burrows.png) |

## Play

- **Mac:** download the `.dmg` from Releases, open it, drag the app to Applications. Runs on
  macOS 10.15 Catalina and newer, on Intel and Apple Silicon.
  (Until signed builds are ready, the first launch needs a right-click on the app and "Open".)
- **Browser:** `npm install && npm run build && npm run preview`, then open the address it prints.

Progress saves on the device, per player (up to 8 players). Grown-ups can save a progress
file and load it on another computer.

## Develop

Requirements: Node 22+. For the desktop app, also Rust (via `rustup`) and Xcode command line tools.

```bash
npm install
npm run dev          # the game in your browser with live reload
npm test             # learning engine tests
npm run content      # checks word lists and stories (allowed letters, kid-safe words)
npm run check        # type checks
npm run tauri dev    # the desktop app
scripts/build-mac.sh # Mac app + disk image in build/
```

Handy dev addresses: `#gallery` (every friend, look, ride and outfit, with an animation lab),
`#painted` (Dino on his own, with buttons for each mood and reaction),
`#run=village-1` (jump into a lesson), `#world=treetops` (watch a region's journey scroll by),
`#map`, `#stickers`, `#closet`, `#settings`, `#grownups`.

### How it's built

- **Svelte 5 + TypeScript + Vite.** Fonts are bundled, so the app works offline.
- **Characters are SVG drawn by code.** One rig (`src/lib/art/pal.ts`) draws every friend in
  every look, with arms, brows, and a face for every mood. A small spring engine
  (`src/lib/anim/palAnimator.ts`) brings them to life: ears and tails that lag behind, blinks,
  glances, idle habits that match each personality, and reactions to every key. Rides
  (`rides2.ts`), outfits (`outfitLibrary.ts`) and stickers (`stickerArt.ts`) are drawn the same way.
- **Dino is painted.** His pieces (head with four faces, jacket front and back, arms, legs,
  seated legs, tail) are painted images in `public/painted/dino/`, cut from painted sheets in
  `art-src/painted/dino/`. `src/lib/art/painted.ts` says where each piece's joint is, and
  `src/lib/anim/paintedAnimator.ts` moves them like a cut-out puppet: the head and arms stay
  pinned to the jacket's joints through every squash and stretch, and each ride has its own pose.
- **Worlds** (`src/lib/art/world/`) are drawn a chunk at a time as you travel, in parallax
  layers, from a small kit of shapes (`kit.ts`). Each region is one file.
- **Voices** are pre-recorded clips in `public/voice/`, made with a text-to-speech service by
  `scripts/voice/` (see its README). If a clip is missing, the game uses the browser's own
  speech voice and shows the caption.
- **Learning engine** (`src/lib/engine/`), plain TypeScript with no UI: keyboard layouts and
  fingers, the course, the text builder, scoring, rides, key mastery, achievements, saves.
- **Sound** is generated live with Web Audio (`src/lib/audio/sound.ts`), including optional
  "melody keys" that play a tune as you type.
- **Desktop** with Tauri 2 (`src-tauri/`).

### Adding things

- **Words and stories:** `src/lib/content/words.ts` and `sentences.ts`, then `npm run content`.
- **Lessons:** `src/lib/engine/course.ts`. Lessons name physical keys, so every layout gets them.
- **Characters and outfits:** add a friend to `src/lib/art/cast.ts`; outfits live in
  `src/lib/art/outfitLibrary.ts`.
- **Worlds:** each region is one file in `src/lib/art/world/regions/` that registers itself.
  `src/lib/art/world/village.ts` is the example to copy. Preview it at `#world=<region>`.
- **Spoken lines:** `src/lib/content/voice.ts`, then regenerate with `scripts/voice/`.

## License

Code: [MIT](LICENSE). Characters, art and writing: [CC BY 4.0](LICENSE-ART.md).
The game's name and the FancyAnt name and logo are not part of either license.
